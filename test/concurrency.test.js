const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { api, setup, teardown, reset, makeUser, makeTitle } = require('./helpers');
const Title = require('../src/models/Title');
const WatchlistItem = require('../src/models/WatchlistItem');
const WatchProgress = require('../src/models/WatchProgress');
const Review = require('../src/models/Review');

describe('concurrent requests', () => {
  before(setup);
  after(teardown);
  beforeEach(reset);

  it('creates exactly one watchlist entry from 25 simultaneous adds', async () => {
    const t = await makeTitle();
    const { user, auth } = await makeUser();
    const results = await Promise.all(Array.from({ length: 25 }, () => api().put(`/api/me/watchlist/${t._id}`).set(auth)));
    assert.ok(results.every((r) => r.status === 200 || r.status === 201));
    assert.equal(results.filter((r) => r.status === 201).length, 1);
    assert.equal(await WatchlistItem.countDocuments({ user: user._id }), 1);
  });

  it('keeps rating aggregates exact when many users review at once', async () => {
    const t = await makeTitle();
    const users = await Promise.all(Array.from({ length: 30 }, () => makeUser()));
    const ratings = users.map((_, i) => (i % 5) + 1);
    await Promise.all(users.map((u, i) => api().put(`/api/titles/${t._id}/reviews/mine`).set(u.auth).send({ rating: ratings[i] })));

    const fresh = await Title.findById(t._id).lean();
    const expectedSum = ratings.reduce((a, b) => a + b, 0);
    assert.equal(fresh.ratingCount, 30);
    assert.equal(fresh.ratingSum, expectedSum);
    assert.equal(fresh.ratingAvg, Math.round((expectedSum / 30) * 100) / 100);
  });

  it('applies rating changes from the same user racing on two devices', async () => {
    const t = await makeTitle();
    const { user, auth } = await makeUser();
    await Promise.all([1, 2, 3, 4, 5, 3, 4].map((rating) =>
      api().put(`/api/titles/${t._id}/reviews/mine`).set(auth).send({ rating })));

    const review = await Review.findOne({ user: user._id, title: t._id }).lean();
    const fresh = await Title.findById(t._id).lean();
    assert.equal(await Review.countDocuments({ title: t._id }), 1);
    assert.equal(fresh.ratingCount, 1);
    assert.equal(fresh.ratingSum, review.rating); // aggregate matches whichever write landed last

    await api().delete(`/api/titles/${t._id}/reviews/mine`).set(auth).expect(204);
    const after = await Title.findById(t._id).lean();
    assert.deepEqual([after.ratingCount, after.ratingSum, after.ratingAvg], [0, 0, 0]);
  });

  it('never lets an older progress heartbeat overwrite a newer one', async () => {
    const t = await makeTitle();
    const { user, auth } = await makeUser();
    const base = Date.now() - 60000;
    // 40 heartbeats sent in shuffled order, as retries and multiple tabs would.
    const beats = Array.from({ length: 40 }, (_, i) => ({ positionSeconds: i * 10, durationSeconds: 6000, reportedAt: base + i * 1000 }));
    beats.sort(() => Math.random() - 0.5);
    const results = await Promise.all(beats.map((b) => api().put(`/api/me/progress/${t._id}`).set(auth).send(b)));
    assert.ok(results.every((r) => r.status === 200));

    const progress = await WatchProgress.find({ user: user._id, title: t._id }).lean();
    assert.equal(progress.length, 1);
    assert.equal(progress[0].positionSeconds, 390);

    const late = await api().put(`/api/me/progress/${t._id}`).set(auth).send({ positionSeconds: 5, reportedAt: base });
    assert.equal(late.body.applied, false);
  });

  it('counts one unique view per user however many heartbeats arrive', async () => {
    const t = await makeTitle();
    const users = await Promise.all(Array.from({ length: 10 }, () => makeUser()));
    await Promise.all(users.flatMap((u) => Array.from({ length: 5 }, (_, i) =>
      api().put(`/api/me/progress/${t._id}`).set(u.auth).send({ positionSeconds: i, reportedAt: Date.now() - 1000 + i }))));
    const fresh = await Title.findById(t._id).lean();
    assert.equal(fresh.viewCount, 10);
  });

  it('marks titles complete and drops them from continue watching', async () => {
    const t = await makeTitle();
    const { auth } = await makeUser();
    await api().put(`/api/me/progress/${t._id}`).set(auth).send({ positionSeconds: 100, durationSeconds: 1000, reportedAt: Date.now() - 5000 });
    let cont = await api().get('/api/me/continue-watching').set(auth);
    assert.equal(cont.body.items.length, 1);
    await api().put(`/api/me/progress/${t._id}`).set(auth).send({ positionSeconds: 990, durationSeconds: 1000, reportedAt: Date.now() });
    cont = await api().get('/api/me/continue-watching').set(auth);
    assert.equal(cont.body.items.length, 0);
  });
});
