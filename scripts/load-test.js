/**
 * Concurrency load test.
 *
 * Starts the app in-process against a separate database, simulates many
 * viewers issuing a realistic mix of requests at the same time, reports
 * throughput and latency, then checks that the data is still consistent.
 *
 *   npm run loadtest -- --users 200 --concurrency 100 --duration 20
 */
const bcrypt = require('bcryptjs');

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1]]] : acc), [])
);
const USERS = Number(args.users) || 200;
const CONCURRENCY = Number(args.concurrency) || 100;
const DURATION_S = Number(args.duration) || 20;
const TITLES = Number(args.titles) || 300;

process.env.AUTH_RATE_LIMIT = '1000000';
process.env.MONGO_URI = process.env.MONGO_URI_LOAD || 'mongodb://127.0.0.1:27017/ott_platform_load';

const db = require('../src/db');
const { createApp } = require('../src/app');
const User = require('../src/models/User');
const Title = require('../src/models/Title');
const Review = require('../src/models/Review');
const WatchlistItem = require('../src/models/WatchlistItem');
const WatchProgress = require('../src/models/WatchProgress');
const { signAccessToken } = require('../src/middleware/auth');

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] || 0;

async function prepare() {
  await db.connect(process.env.MONGO_URI);
  await db.mongoose.connection.dropDatabase();
  await Promise.all([User, Title, Review, WatchlistItem, WatchProgress].map((m) => m.syncIndexes()));

  const titles = await Title.insertMany(Array.from({ length: TITLES }, (_, i) => ({
    name: `Load Title ${i}`, type: i % 3 ? 'movie' : 'series', synopsis: `Load test title number ${i}.`,
    genres: [pick(Title.GENRES)], releaseYear: 1990 + (i % 35), maturityRating: pick(Title.MATURITY),
    durationMinutes: 90, featured: i < 5,
  })));
  const hash = await bcrypt.hash('load-test-only', 4);
  const users = await User.insertMany(Array.from({ length: USERS }, (_, i) => ({
    name: `viewer${i}`, email: `viewer${i}@load.test`, passwordHash: hash,
  })));
  return { titleIds: titles.map((t) => String(t._id)), tokens: users.map((u) => signAccessToken(u)) };
}

async function run(base, { titleIds, tokens }) {
  // Weighted mix loosely modelled on streaming traffic: mostly reads and
  // player heartbeats, with fewer writes to lists and reviews.
  // A small pool of "hot" titles concentrates writes to force contention.
  const hot = titleIds.slice(0, 10);
  const clock = new Map(); // per user+title monotonically increasing heartbeat time
  const ops = [
    [20, 'browse', () => ['GET', `/api/titles?sort=${pick(['popular', 'newest', 'top'])}&limit=24`]],
    [10, 'rows', () => ['GET', '/api/titles/rows']],
    [15, 'detail', (tok) => ['GET', `/api/titles/${pick(titleIds)}`, tok]],
    [8, 'search', () => ['GET', `/api/titles/search?q=${pick(['load', 'title', 'number'])}`]],
    [30, 'heartbeat', (tok, u) => {
      const id = pick(hot);
      const k = `${u}:${id}`;
      const t = (clock.get(k) || Date.now() - 600000) + 1000;
      clock.set(k, t);
      return ['PUT', `/api/me/progress/${id}`, tok, { positionSeconds: (t / 1000) % 5000, durationSeconds: 5400, reportedAt: t }];
    }],
    [9, 'watchlist', (tok) => ['PUT', `/api/me/watchlist/${pick(hot)}`, tok]],
    [8, 'review', (tok) => ['PUT', `/api/titles/${pick(hot)}/reviews/mine`, tok, { rating: 1 + Math.floor(Math.random() * 5) }]],
  ];
  const totalWeight = ops.reduce((s, [w]) => s + w, 0);
  const chooseOp = () => {
    let r = Math.random() * totalWeight;
    for (const op of ops) if ((r -= op[0]) < 0) return op;
    return ops[0];
  };

  const stats = new Map(ops.map(([, name]) => [name, { lat: [], errors: 0 }]));
  const deadline = Date.now() + DURATION_S * 1000;

  async function worker() {
    while (Date.now() < deadline) {
      const u = Math.floor(Math.random() * tokens.length);
      const [, name, build] = chooseOp();
      const [method, path, tok, body] = build(tokens[u], u);
      const started = performance.now();
      let ok = false;
      try {
        const res = await fetch(base + path, {
          method,
          headers: { 'Content-Type': 'application/json', ...(tok && { Authorization: `Bearer ${tok}` }) },
          body: body ? JSON.stringify(body) : undefined,
        });
        await res.arrayBuffer();
        ok = res.ok;
      } catch { /* counted as error */ }
      const s = stats.get(name);
      s.lat.push(performance.now() - started);
      if (!ok) s.errors += 1;
    }
  }

  const started = Date.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return { stats, elapsed: (Date.now() - started) / 1000 };
}

async function verify() {
  const dupes = async (Model) => (await Model.aggregate([
    { $group: { _id: { u: '$user', t: '$title' }, n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }, { $count: 'n' },
  ]))[0]?.n || 0;
  const [wlDupes, progDupes, reviewDupes] = await Promise.all([dupes(WatchlistItem), dupes(WatchProgress), dupes(Review)]);

  const actual = await Review.aggregate([{ $group: { _id: '$title', count: { $sum: 1 }, sum: { $sum: '$rating' } } }]);
  const titles = await Title.find({ _id: { $in: actual.map((a) => a._id) } }).select('ratingCount ratingSum').lean();
  const byId = new Map(titles.map((t) => [String(t._id), t]));
  const ratingMismatches = actual.filter((a) => {
    const t = byId.get(String(a._id));
    return !t || t.ratingCount !== a.count || t.ratingSum !== a.sum;
  }).length;

  const viewStats = await WatchProgress.aggregate([{ $group: { _id: '$title', n: { $sum: 1 } } }]);
  const viewTitles = await Title.find({ _id: { $in: viewStats.map((v) => v._id) } }).select('viewCount').lean();
  const viewMap = new Map(viewTitles.map((t) => [String(t._id), t.viewCount]));
  const viewMismatches = viewStats.filter((v) => viewMap.get(String(v._id)) !== v.n).length;

  return { wlDupes, progDupes, reviewDupes, ratingMismatches, viewMismatches };
}

async function main() {
  console.log(`Preparing ${TITLES} titles and ${USERS} users in ${process.env.MONGO_URI} ...`);
  const data = await prepare();
  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;

  console.log(`Running ${CONCURRENCY} concurrent clients for ${DURATION_S}s ...\n`);
  const { stats, elapsed } = await run(base, data);

  let total = 0;
  let errors = 0;
  const rows = [];
  for (const [name, s] of stats) {
    const sorted = s.lat.sort((a, b) => a - b);
    total += sorted.length;
    errors += s.errors;
    rows.push({ op: name, requests: sorted.length, errors: s.errors, 'p50 ms': +pct(sorted, 50).toFixed(1), 'p95 ms': +pct(sorted, 95).toFixed(1), 'p99 ms': +pct(sorted, 99).toFixed(1) });
  }
  console.table(rows);
  console.log(`Total: ${total.toLocaleString()} requests in ${elapsed.toFixed(1)}s = ${(total / elapsed).toFixed(0)} req/s, ${errors} errors (${((errors / total) * 100).toFixed(2)}%)\n`);

  const v = await verify();
  console.log('Integrity checks after the run:');
  console.log(`  duplicate watchlist entries:   ${v.wlDupes}`);
  console.log(`  duplicate progress documents:  ${v.progDupes}`);
  console.log(`  duplicate reviews:             ${v.reviewDupes}`);
  console.log(`  titles with wrong rating sums: ${v.ratingMismatches}`);
  console.log(`  titles with wrong view counts: ${v.viewMismatches}`);
  const clean = Object.values(v).every((n) => n === 0);
  console.log(clean ? '\nAll integrity checks passed.' : '\nIntegrity problems found.');

  server.close();
  await db.mongoose.connection.dropDatabase();
  await db.disconnect();
  process.exit(clean && errors === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await db.disconnect().catch(() => {});
  process.exit(1);
});
