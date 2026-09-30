/**
 * Seeds the database with the sample catalog, demo accounts, and reviews.
 *
 *   npm run seed                 reset and load the sample catalog
 *   npm run seed -- --bulk 50000 also generate 50,000 synthetic titles (for load testing)
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const config = require('../src/config');
const db = require('../src/db');
const User = require('../src/models/User');
const Title = require('../src/models/Title');
const Review = require('../src/models/Review');
const WatchlistItem = require('../src/models/WatchlistItem');
const WatchProgress = require('../src/models/WatchProgress');

const args = process.argv.slice(2);
const bulkIdx = args.indexOf('--bulk');
const bulkCount = bulkIdx >= 0 ? Number(args[bulkIdx + 1]) || 0 : 0;

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[rand(0, arr.length - 1)];

const REVIEW_LINES = {
  2: ['Not for me, but I see the appeal.', 'Too slow in the middle.', ''],
  3: ['Solid weekend watch.', 'Slow start, decent payoff.', ''],
  4: ['Beautifully shot and well acted.', 'The ending caught me off guard.', 'Great for the whole family.', ''],
  5: ['Could not stop watching.', 'The soundtrack alone is worth it.', 'An instant favourite.', ''],
};

function mediaFiles() {
  try {
    return fs.readdirSync(config.mediaDir).filter((f) => /\.(mp4|webm|m4v)$/i.test(f)).sort();
  } catch {
    return [];
  }
}

async function recomputeRatings() {
  const stats = await Review.aggregate([{ $group: { _id: '$title', count: { $sum: 1 }, sum: { $sum: '$rating' } } }]);
  if (!stats.length) return;
  await Title.bulkWrite(stats.map((s) => ({
    updateOne: {
      filter: { _id: s._id },
      update: { $set: { ratingCount: s.count, ratingSum: s.sum, ratingAvg: Math.round((s.sum / s.count) * 100) / 100 } },
    },
  })));
}

async function seedBulk(n) {
  const words = ['Silent', 'Crimson', 'Northern', 'Hidden', 'Broken', 'Golden', 'Midnight', 'Lost', 'Electric', 'Distant',
    'River', 'Empire', 'Signal', 'Garden', 'Horizon', 'Station', 'Harbor', 'Echo', 'Forest', 'Machine'];
  const batchSize = 5000;
  let inserted = 0;
  const started = Date.now();
  while (inserted < n) {
    const size = Math.min(batchSize, n - inserted);
    const docs = Array.from({ length: size }, (_, i) => {
      const genres = [...new Set([pick(Title.GENRES), pick(Title.GENRES)])];
      return {
        name: `${pick(words)} ${pick(words)} ${inserted + i + 1}`,
        type: Math.random() < 0.7 ? 'movie' : 'series',
        synopsis: `Synthetic catalog entry ${inserted + i + 1} generated for load testing.`,
        genres,
        releaseYear: rand(1970, 2025),
        maturityRating: pick(Title.MATURITY),
        durationMinutes: rand(20, 160),
        posterHue: rand(0, 359),
        viewCount: rand(0, 5000),
      };
    });
    // Unordered bulk insert: the server can apply the batch in parallel and
    // one bad document does not abort the rest.
    await Title.insertMany(docs, { ordered: false, lean: true });
    inserted += size;
    process.stdout.write(`\r  bulk titles: ${inserted.toLocaleString()} / ${n.toLocaleString()}`);
  }
  process.stdout.write(`  (${((Date.now() - started) / 1000).toFixed(1)}s)\n`);
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const userEmail = process.env.SEED_USER_EMAIL;
  const userPassword = process.env.SEED_USER_PASSWORD;
  if (!adminEmail || !adminPassword || !userEmail || !userPassword) {
    console.error('Set SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_USER_EMAIL and SEED_USER_PASSWORD (see .env.example).');
    process.exit(1);
  }

  await db.connect();
  console.log(`Seeding ${config.mongoUri.replace(/\/\/[^@]*@/, '//***@')}`);

  await Promise.all([User, Title, Review, WatchlistItem, WatchProgress].map((m) => m.deleteMany({})));
  await Promise.all([User, Title, Review, WatchlistItem, WatchProgress].map((m) => m.syncIndexes()));

  const [admin, demo] = await User.create([
    { name: 'Admin', email: adminEmail, passwordHash: await bcrypt.hash(adminPassword, 10), role: 'admin' },
    { name: 'Demo Viewer', email: userEmail, passwordHash: await bcrypt.hash(userPassword, 10) },
  ]);
  // Reviewer accounts get random, unrecoverable passwords; they only exist to own sample reviews.
  const reviewerHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
  const reviewers = await User.insertMany(
    ['Jordan', 'Priya', 'Mateo', 'Aiko', 'Sam', 'Noor'].map((n) => ({
      name: n, email: `${n.toLowerCase()}@reviewers.example`, passwordHash: reviewerHash,
    }))
  );

  const files = mediaFiles();
  const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, 'catalog.json'), 'utf8'));
  const titles = await Title.insertMany(catalog.map((t, i) => ({
    ...t,
    featured: Boolean(t.featured),
    posterHue: (i * 47 + 13) % 360,
    viewCount: rand(200, 20000),
    videoFile: files.length ? files[i % files.length] : '',
  })));

  const reviews = [];
  for (const title of titles) {
    for (const r of reviewers) {
      if (Math.random() < 0.55) {
        const rating = rand(2, 5);
        reviews.push({ user: r._id, userName: r.name, title: title._id, rating, body: pick(REVIEW_LINES[rating]) });
      }
    }
  }
  await Review.insertMany(reviews, { ordered: false });
  await recomputeRatings();

  await WatchlistItem.insertMany(titles.slice(2, 6).map((t) => ({ user: demo._id, title: t._id })));

  if (bulkCount > 0) await seedBulk(bulkCount);

  console.log(`  users: ${2 + reviewers.length} (admin: ${admin.email}, viewer: ${demo.email})`);
  console.log(`  titles: ${titles.length + bulkCount}, reviews: ${reviews.length}`);
  console.log(files.length
    ? `  videos: ${files.length} file(s) from media/ assigned to titles`
    : '  videos: none found in media/ (add .mp4 files and re-run to enable playback)');
  await db.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.disconnect().catch(() => {});
  process.exit(1);
});
