// One-off data changes that run at startup. Each is recorded in the
// `migrations` collection once it succeeds, so it never runs twice.
const fs = require('fs');
const path = require('path');
const { Schema, model } = require('mongoose');
const Title = require('./models/Title');
const User = require('./models/User');
const Review = require('./models/Review');
const WatchlistItem = require('./models/WatchlistItem');
const WatchProgress = require('./models/WatchProgress');

const Migration = model('Migration', new Schema({ _id: String, ranAt: Date }, { versionKey: false }));

// The made-up titles from the original sample catalog.
const OLD_TITLES = [
  'The Last Lighthouse', 'Circuit Breakers', 'Paper Moons', 'Salt and Iron', 'Nightshift at Station 9',
  "The Clockmaker's Daughter", 'Dead Reckoning Road', 'Tiny Kingdoms', 'Orbit Nine', "Grandma's Kitchen Wars",
  'The Hollow Pines', 'Pixel Knights', 'Ledger', 'Summer at Blue Harbor', 'Ironclad Vale', 'Signal Lost',
  'Street Food Atlas', 'Mister Button', 'The Quiet Hours', 'Rogue Frequency', 'Moss & Stone', 'Starfall Academy',
  'The Understudy', 'Harvest Moon Motel', 'Glass Frontier', 'Dancing on Main Street', 'Cold Case Coast',
  'The Cartographer', 'Overclocked', 'Wildflower Season', 'Monster Mechanics', 'The Archivist',
];

async function removeTitles(filter) {
  const ids = (await Title.find(filter).select('_id').lean()).map((t) => t._id);
  if (!ids.length) return 0;
  await Promise.all([
    Review.deleteMany({ title: { $in: ids } }),
    WatchlistItem.deleteMany({ title: { $in: ids } }),
    WatchProgress.deleteMany({ title: { $in: ids } }),
    Title.deleteMany({ _id: { $in: ids } }),
  ]);
  return ids.length;
}

async function removeUsers(filter) {
  const ids = (await User.find(filter).select('_id').lean()).map((u) => u._id);
  if (!ids.length) return 0;
  await Promise.all([
    Review.deleteMany({ user: { $in: ids } }),
    WatchlistItem.deleteMany({ user: { $in: ids } }),
    WatchProgress.deleteMany({ user: { $in: ids } }),
    User.deleteMany({ _id: { $in: ids } }),
  ]);
  return ids.length;
}

const migrations = [
  {
    id: '2026-11-blender-catalog',
    // Swap the made-up catalog for the Blender films without resetting accounts.
    async up() {
      const films = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'scripts', 'catalog.json'), 'utf8'));
      for (const f of films) {
        await Title.updateOne({ youtubeId: f.youtubeId }, { $set: { ...f, featured: Boolean(f.featured) } }, { upsert: true, runValidators: true });
      }
      const titles = await removeTitles({ name: { $in: OLD_TITLES }, youtubeId: { $in: ['', null] } });
      // Sample reviewers only existed to own made-up reviews; the old guest account was renamed.
      const users = await removeUsers({ $or: [{ email: /@reviewers\.example$/ }, { email: 'demo@streambox.test', role: 'demo' }] });
      return `${films.length} films synced, ${titles} old titles and ${users} sample accounts removed`;
    },
  },
];

async function runMigrations(log = console.log) {
  for (const m of migrations) {
    if (await Migration.exists({ _id: m.id })) continue;
    const summary = await m.up();
    await Migration.create({ _id: m.id, ranAt: new Date() });
    log(`Migration ${m.id}: ${summary}`);
  }
}

module.exports = { runMigrations, OLD_TITLES };
