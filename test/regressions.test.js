// Regression tests for the November 15 audit findings: rating aggregates that
// drift after a failure between writes, and admin tokens that outlive the
// account or role they were issued for.
const { describe, it, before, after, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { api, setup, teardown, reset, makeUser, makeTitle } = require('./helpers');
const Title = require('../src/models/Title');
const User = require('../src/models/User');
const Review = require('../src/models/Review');

// The truth a title's aggregate must match: its reviews.
async function expectedAggregate(titleId) {
  const reviews = await Review.find({ title: titleId }).lean();
  return { ratingCount: reviews.length, ratingSum: reviews.reduce((s, r) => s + r.rating, 0) };
}

async function storedAggregate(titleId) {
  const { ratingCount, ratingSum } = await Title.findById(titleId).lean();
  return { ratingCount, ratingSum };
}

// Make the next pipeline-style Title.updateOne (the rating aggregate write) throw.
function failNextAggregateWrite() {
  const original = Title.updateOne;
  const m = mock.method(Title, 'updateOne', function (filter, update, ...rest) {
    if (Array.isArray(update)) {
      m.mock.restore();
      throw new Error('injected failure between review and aggregate writes');
    }
    return original.call(this, filter, update, ...rest);
  });
  return m;
}

describe('audit regressions', () => {
  before(setup);
  after(teardown);
  beforeEach(reset);

  it('keeps the aggregate consistent when the aggregate write fails and the review is retried', async () => {
    const t = await makeTitle();
    const { auth } = await makeUser();

    failNextAggregateWrite();
    const failed = await api().put(`/api/titles/${t._id}/reviews/mine`).set(auth).send({ rating: 5 });
    assert.equal(failed.status, 500);

    const retry = await api().put(`/api/titles/${t._id}/reviews/mine`).set(auth).send({ rating: 5 });
    assert.ok([200, 201].includes(retry.status));
    assert.deepEqual(await storedAggregate(t._id), await expectedAggregate(t._id));
    assert.deepEqual(await storedAggregate(t._id), { ratingCount: 1, ratingSum: 5 });
  });

  it('rolls back a failed first review so nothing is half-saved', async () => {
    const t = await makeTitle();
    const { user, auth } = await makeUser();
    failNextAggregateWrite();
    await api().put(`/api/titles/${t._id}/reviews/mine`).set(auth).send({ rating: 4 }).expect(500);
    assert.equal(await Review.countDocuments({ user: user._id }), 0);
    assert.deepEqual(await storedAggregate(t._id), { ratingCount: 0, ratingSum: 0 });
  });

  it('keeps the old rating when an edit fails, and applies it on retry', async () => {
    const t = await makeTitle();
    const { user, auth } = await makeUser();
    await api().put(`/api/titles/${t._id}/reviews/mine`).set(auth).send({ rating: 3 }).expect(201);

    failNextAggregateWrite();
    await api().put(`/api/titles/${t._id}/reviews/mine`).set(auth).send({ rating: 5 }).expect(500);
    assert.equal((await Review.findOne({ user: user._id }).lean()).rating, 3);
    assert.deepEqual(await storedAggregate(t._id), { ratingCount: 1, ratingSum: 3 });

    await api().put(`/api/titles/${t._id}/reviews/mine`).set(auth).send({ rating: 5 }).expect(200);
    assert.deepEqual(await storedAggregate(t._id), { ratingCount: 1, ratingSum: 5 });
  });

  it('does not double-count identical successful retries', async () => {
    const t = await makeTitle();
    const { auth } = await makeUser();
    for (let i = 0; i < 3; i += 1) await api().put(`/api/titles/${t._id}/reviews/mine`).set(auth).send({ rating: 4 });
    assert.deepEqual(await storedAggregate(t._id), { ratingCount: 1, ratingSum: 4 });
  });

  it('keeps the review when a delete fails, and removes both on retry', async () => {
    const t = await makeTitle();
    const { auth } = await makeUser();
    await api().put(`/api/titles/${t._id}/reviews/mine`).set(auth).send({ rating: 2 }).expect(201);

    failNextAggregateWrite();
    await api().delete(`/api/titles/${t._id}/reviews/mine`).set(auth).expect(500);
    assert.equal(await Review.countDocuments({ title: t._id }), 1);
    assert.deepEqual(await storedAggregate(t._id), { ratingCount: 1, ratingSum: 2 });

    await api().delete(`/api/titles/${t._id}/reviews/mine`).set(auth).expect(204);
    assert.deepEqual(await storedAggregate(t._id), { ratingCount: 0, ratingSum: 0 });
    await api().delete(`/api/titles/${t._id}/reviews/mine`).set(auth).expect(404);
  });

  it('keeps the account and its ratings when account deletion fails, then deletes cleanly', async () => {
    const [a, b] = [await makeTitle(), await makeTitle()];
    const { user, auth } = await makeUser();
    await api().put(`/api/titles/${a._id}/reviews/mine`).set(auth).send({ rating: 5 }).expect(201);
    await api().put(`/api/titles/${b._id}/reviews/mine`).set(auth).send({ rating: 1 }).expect(201);

    failNextAggregateWrite();
    await api().delete('/api/me').set(auth).expect(500);
    assert.equal(await User.countDocuments({ _id: user._id }), 1);
    assert.equal(await Review.countDocuments({ user: user._id }), 2);
    assert.deepEqual(await storedAggregate(a._id), { ratingCount: 1, ratingSum: 5 });

    await api().delete('/api/me').set(auth).expect(204);
    assert.equal(await User.countDocuments({ _id: user._id }), 0);
    for (const t of [a, b]) assert.deepEqual(await storedAggregate(t._id), await expectedAggregate(t._id));
  });

  it('stays consistent under concurrent creates, edits, and deletes', async () => {
    const t = await makeTitle();
    const users = await Promise.all(Array.from({ length: 12 }, () => makeUser()));
    const send = (u, rating) => api().put(`/api/titles/${t._id}/reviews/mine`).set(u.auth).send({ rating });
    const remove = (u) => api().delete(`/api/titles/${t._id}/reviews/mine`).set(u.auth);
    await Promise.all(users.flatMap((u, i) => [send(u, (i % 5) + 1), send(u, ((i + 2) % 5) + 1), i % 3 === 0 ? remove(u) : send(u, 3)]));
    assert.deepEqual(await storedAggregate(t._id), await expectedAggregate(t._id));
  });

  it('rejects a deleted admin\'s token on privileged routes', async () => {
    const t = await makeTitle();
    const { user, auth } = await makeUser('admin');
    await User.deleteOne({ _id: user._id });
    const res = await api().patch(`/api/titles/${t._id}`).set(auth).send({ version: 0, name: 'Edited by a deleted admin' });
    assert.equal(res.status, 401);
    assert.equal((await Title.findById(t._id).lean()).name, t.name);
  });

  it('rejects a demoted admin\'s token on privileged routes', async () => {
    const t = await makeTitle();
    const { user, auth } = await makeUser('admin');
    await User.updateOne({ _id: user._id }, { role: 'user' });
    const res = await api().patch(`/api/titles/${t._id}`).set(auth).send({ version: 0, name: 'Edited by a demoted admin' });
    assert.equal(res.status, 403);
  });

  it('reconciliation reports drift without changing data, and repairs only on request', async () => {
    const { findInconsistencies, repairTitle } = require('../scripts/reconcile-ratings');
    const t = await makeTitle();
    const { auth } = await makeUser();
    await api().put(`/api/titles/${t._id}/reviews/mine`).set(auth).send({ rating: 5 }).expect(201);
    // Simulate drift left by the old non-transactional code.
    await Title.updateOne({ _id: t._id }, { $set: { ratingCount: 0, ratingSum: 0, ratingAvg: 0 } });

    const report = await findInconsistencies();
    assert.equal(report.mismatched.length, 1);
    assert.deepEqual(report.mismatched[0].expected, { ratingCount: 1, ratingSum: 5, ratingAvg: 5 });
    assert.deepEqual(await storedAggregate(t._id), { ratingCount: 0, ratingSum: 0 }, 'reporting must not modify data');

    await repairTitle(String(t._id));
    assert.deepEqual(await storedAggregate(t._id), { ratingCount: 1, ratingSum: 5 });
    assert.equal((await findInconsistencies()).mismatched.length, 0);
  });

  describe('authorization on catalog routes', () => {
    const jwt = require('jsonwebtoken');
    const config = require('../src/config');
    const newTitle = { name: 'New Film', type: 'movie', synopsis: 'x', genres: ['Drama'], releaseYear: 2020, maturityRating: 'NR', durationMinutes: 5 };
    // Each privileged call with the status expected for a given principal.
    async function attempt(auth, t) {
      return {
        create: (await api().post('/api/titles').set(auth).send(newTitle)).status,
        edit: (await api().patch(`/api/titles/${t._id}`).set(auth).send({ version: 0, name: 'Renamed' })).status,
        remove: (await api().delete(`/api/titles/${t._id}`).set(auth)).status,
      };
    }

    it('allows a legitimate admin', async () => {
      const { auth } = await makeUser('admin');
      assert.deepEqual(await attempt(auth, await makeTitle()), { create: 201, edit: 200, remove: 204 });
    });

    it('refuses an ordinary user', async () => {
      const { auth } = await makeUser();
      assert.deepEqual(await attempt(auth, await makeTitle()), { create: 403, edit: 403, remove: 403 });
    });

    it('refuses an expired admin token', async () => {
      const { user } = await makeUser('admin');
      const expired = jwt.sign({ sub: String(user._id), role: 'admin', name: user.name, scope: 'api' }, config.jwtSecret, { expiresIn: -10 });
      assert.deepEqual(await attempt({ Authorization: `Bearer ${expired}` }, await makeTitle()), { create: 401, edit: 401, remove: 401 });
    });

    it('refuses a deleted admin on every privileged route', async () => {
      const { user, auth } = await makeUser('admin');
      const t = await makeTitle();
      await User.deleteOne({ _id: user._id });
      assert.deepEqual(await attempt(auth, t), { create: 401, edit: 401, remove: 401 });
      assert.equal(await Title.countDocuments({ _id: t._id }), 1);
    });

    it('refuses a demoted admin on every privileged route', async () => {
      const { user, auth } = await makeUser('admin');
      await User.updateOne({ _id: user._id }, { role: 'user' });
      assert.deepEqual(await attempt(auth, await makeTitle()), { create: 403, edit: 403, remove: 403 });
    });

    it('honours a promotion without a new sign-in', async () => {
      const { user, auth } = await makeUser();
      await User.updateOne({ _id: user._id }, { role: 'admin' });
      assert.deepEqual(await attempt(auth, await makeTitle()), { create: 201, edit: 200, remove: 204 });
    });

    it('treats a deleted user as anonymous on optional sign-in routes and rejects them elsewhere', async () => {
      const t = await makeTitle();
      const { user, auth } = await makeUser();
      await User.deleteOne({ _id: user._id });
      const detail = await api().get(`/api/titles/${t._id}`).set(auth);
      assert.equal(detail.status, 200);
      assert.equal(detail.body.viewer, null);
      assert.equal((await api().get('/api/me/watchlist').set(auth)).status, 401);
      assert.equal((await api().get('/api/auth/me').set(auth)).status, 401);
    });
  });
});
