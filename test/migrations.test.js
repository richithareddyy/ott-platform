const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setup, teardown, reset, makeUser, makeTitle } = require('./helpers');
const { runMigrations, OLD_TITLES } = require('../src/migrations');
const Title = require('../src/models/Title');
const User = require('../src/models/User');
const Review = require('../src/models/Review');

describe('migrations', () => {
  before(setup);
  after(teardown);
  beforeEach(reset);

  it('swaps the old catalog for the films and keeps real accounts', async () => {
    const old = await makeTitle({ name: OLD_TITLES[0] });
    const reviewer = await User.create({ name: 'Jordan', email: 'jordan@reviewers.example', passwordHash: 'x' });
    await Review.create({ user: reviewer._id, userName: 'Jordan', title: old._id, rating: 4 });
    const { user } = await makeUser();

    await runMigrations(() => {});

    assert.equal(await Title.countDocuments({ name: OLD_TITLES[0] }), 0);
    assert.equal(await Title.countDocuments({ youtubeId: { $ne: '' } }), 9);
    assert.equal(await Review.countDocuments(), 0);
    assert.equal(await User.countDocuments({ _id: reviewer._id }), 0);
    assert.equal(await User.countDocuments({ _id: user._id }), 1);

    // Recorded as applied, so a second start changes nothing.
    await Title.deleteMany({ name: 'Sintel' });
    await runMigrations(() => {});
    assert.equal(await Title.countDocuments({ name: 'Sintel' }), 0);
  });
});
