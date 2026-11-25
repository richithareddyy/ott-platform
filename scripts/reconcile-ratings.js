// Finds titles whose stored rating aggregate disagrees with their reviews.
// Reports only, unless --apply is passed; orphaned reviews are only reported.
//
//   npm run ratings:check                 report, exit 1 if any aggregate is wrong
//   npm run ratings:check -- --apply      also repair the aggregates, exit 0
//
// Orphaned reviews alone exit 0. A failure such as no connection exits 2.
const db = require('../src/db');
const Title = require('../src/models/Title');
const Review = require('../src/models/Review');
const User = require('../src/models/User');

const truthFor = (reviews) => ({ ratingCount: reviews.count, ratingSum: reviews.sum });
const avgOf = ({ ratingCount, ratingSum }) => (ratingCount ? Math.round((ratingSum / ratingCount) * 100) / 100 : 0);

async function findInconsistencies() {
  const totals = await Review.aggregate([{ $group: { _id: '$title', count: { $sum: 1 }, sum: { $sum: '$rating' } } }]);
  const byTitle = new Map(totals.map((t) => [String(t._id), t]));
  const titles = await Title.find().select('name ratingCount ratingSum ratingAvg').lean();
  const titleIds = new Set(titles.map((t) => String(t._id)));

  const mismatched = [];
  for (const t of titles) {
    const expected = truthFor(byTitle.get(String(t._id)) || { count: 0, sum: 0 });
    if (t.ratingCount !== expected.ratingCount || t.ratingSum !== expected.ratingSum || t.ratingAvg !== avgOf(expected)) {
      mismatched.push({ id: String(t._id), name: t.name, stored: { ratingCount: t.ratingCount, ratingSum: t.ratingSum, ratingAvg: t.ratingAvg }, expected: { ...expected, ratingAvg: avgOf(expected) } });
    }
  }

  const reviewUsers = await Review.distinct('user');
  const existingUsers = new Set((await User.find({ _id: { $in: reviewUsers } }).select('_id').lean()).map((u) => String(u._id)));
  const orphans = await Review.find({
    $or: [
      { title: { $nin: [...titleIds] } },
      { user: { $nin: [...existingUsers] } },
    ],
  }).select('title user rating').lean();

  return { checkedTitles: titles.length, mismatched, orphans };
}

// Recomputes one title inside a transaction: the reviews are read from the same
// snapshot the aggregate is written against, and a concurrent review write to
// the same title conflicts and is retried instead of being overwritten.
async function repairTitle(titleId) {
  return db.withTransaction(async (session) => {
    const [total] = await Review.aggregate([
      { $match: { title: new db.mongoose.Types.ObjectId(titleId) } },
      { $group: { _id: null, count: { $sum: 1 }, sum: { $sum: '$rating' } } },
    ]).session(session);
    const expected = truthFor(total || { count: 0, sum: 0 });
    await Title.updateOne({ _id: titleId }, { $set: { ...expected, ratingAvg: avgOf(expected) } }, { session });
    return expected;
  });
}

async function main() {
  const apply = process.argv.includes('--apply');
  await db.connect();
  const target = (process.env.MONGO_URI || '').replace(/\/\/[^@]*@/, '//***@') || '(default local database)';
  console.log(`Checking rating aggregates in ${target}`);

  const { checkedTitles, mismatched, orphans } = await findInconsistencies();
  console.log(`  titles checked: ${checkedTitles}`);
  console.log(`  titles with a wrong aggregate: ${mismatched.length}`);
  for (const m of mismatched) {
    console.log(`    ${m.name} (${m.id}): stored ${m.stored.ratingCount}/${m.stored.ratingSum}, reviews say ${m.expected.ratingCount}/${m.expected.ratingSum}`);
  }
  console.log(`  orphaned reviews (missing title or user): ${orphans.length}`);
  for (const o of orphans.slice(0, 20)) console.log(`    review ${o._id} title=${o.title} user=${o.user}`);

  if (apply && mismatched.length) {
    for (const m of mismatched) {
      const fixed = await repairTitle(m.id);
      console.log(`  repaired ${m.name}: now ${fixed.ratingCount}/${fixed.ratingSum}`);
    }
    console.log('  Orphaned reviews were not changed; remove them deliberately if needed.');
  } else if (mismatched.length) {
    console.log('  No changes made. Re-run with --apply to repair the aggregates.');
  }
  await db.disconnect();
  process.exit(mismatched.length && !apply ? 1 : 0);
}

if (require.main === module) {
  main().catch(async (err) => {
    console.error(err.message);
    await db.disconnect().catch(() => {});
    process.exit(2);
  });
}

module.exports = { findInconsistencies, repairTitle };
