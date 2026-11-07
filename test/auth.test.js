const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { api, setup, teardown, reset, makeUser } = require('./helpers');

describe('auth', () => {
  before(setup);
  after(teardown);
  beforeEach(reset);

  it('registers, logs in, and returns the current user', async () => {
    const reg = await api().post('/api/auth/register')
      .send({ name: 'Ava', email: 'Ava@Example.test', password: 'supersecret' });
    assert.equal(reg.status, 201);
    assert.equal(reg.body.user.email, 'ava@example.test');
    assert.ok(reg.body.token);
    assert.equal(reg.body.user.passwordHash, undefined);

    const login = await api().post('/api/auth/login').send({ email: 'ava@example.test', password: 'supersecret' });
    assert.equal(login.status, 200);

    const me = await api().get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    assert.equal(me.status, 200);
    assert.equal(me.body.user.name, 'Ava');
  });

  it('rejects wrong passwords and bad input', async () => {
    await api().post('/api/auth/register').send({ name: 'Bo', email: 'bo@example.test', password: 'supersecret' });
    const bad = await api().post('/api/auth/login').send({ email: 'bo@example.test', password: 'nope-nope' });
    assert.equal(bad.status, 401);

    const invalid = await api().post('/api/auth/register').send({ name: '', email: 'not-an-email', password: 'short' });
    assert.equal(invalid.status, 400);
    assert.ok(invalid.body.error.details.email);
    assert.ok(invalid.body.error.details.password);
  });

  it('ignores operator injection in login fields', async () => {
    const res = await api().post('/api/auth/login').send({ email: { $gt: '' }, password: { $gt: '' } });
    assert.equal(res.status, 400);
  });

  it('allows only one account per email under concurrent sign-ups', async () => {
    const body = { name: 'Race', email: 'race@example.test', password: 'supersecret' };
    const results = await Promise.all(Array.from({ length: 10 }, () => api().post('/api/auth/register').send(body)));
    const statuses = results.map((r) => r.status).sort();
    assert.equal(statuses.filter((s) => s === 201).length, 1);
    assert.equal(statuses.filter((s) => s === 409).length, 9);
  });

  it('signs into one shared guest account, even under concurrent clicks', async () => {
    const User = require('../src/models/User');
    const results = await Promise.all(Array.from({ length: 10 }, () => api().post('/api/auth/demo')));
    assert.ok(results.every((r) => r.status === 200 && r.body.token));
    assert.ok(results.every((r) => r.body.user.role === 'demo'));
    assert.equal(await User.countDocuments({ role: 'demo' }), 1);
  });

  it('lets guests use My List but not post reviews', async () => {
    const { makeTitle } = require('./helpers');
    const t = await makeTitle();
    const { body } = await api().post('/api/auth/demo');
    const auth = { Authorization: `Bearer ${body.token}` };
    // New guest accounts start with popular titles already listed, so this may be a no-op.
    assert.ok([200, 201].includes((await api().put(`/api/me/watchlist/${t._id}`).set(auth)).status));
    const list = await api().get('/api/me/watchlist').set(auth);
    assert.ok(list.body.items.some((i) => String(i._id) === String(t._id)));
    const review = await api().put(`/api/titles/${t._id}/reviews/mine`).set(auth).send({ rating: 5 });
    assert.equal(review.status, 403);
    const login = await api().post('/api/auth/login').send({ email: 'demo@streambox.test', password: 'anything-at-all' });
    assert.equal(login.status, 401);
  });

  it('deletes an account with its reviews, list, and progress', async () => {
    const { makeUser, makeTitle } = require('./helpers');
    const User = require('../src/models/User');
    const Title = require('../src/models/Title');
    const Review = require('../src/models/Review');
    const t = await makeTitle();
    const { user, auth } = await makeUser();
    await api().put(`/api/titles/${t._id}/reviews/mine`).set(auth).send({ rating: 4 }).expect(201);
    await api().put(`/api/me/watchlist/${t._id}`).set(auth).expect(201);

    await api().delete('/api/me').set(auth).expect(204);
    assert.equal(await User.countDocuments({ _id: user._id }), 0);
    // The old token must not be able to write data for the deleted account.
    await api().put(`/api/me/watchlist/${t._id}`).set(auth).expect(401);
    await api().put(`/api/titles/${t._id}/reviews/mine`).set(auth).send({ rating: 5 }).expect(401);
    assert.equal(await Review.countDocuments({ user: user._id }), 0);
    const fresh = await Title.findById(t._id).lean();
    assert.deepEqual([fresh.ratingCount, fresh.ratingSum], [0, 0]);

    const { body } = await api().post('/api/auth/demo');
    await api().delete('/api/me').set({ Authorization: `Bearer ${body.token}` }).expect(403);
  });

  it('protects admin routes', async () => {
    const { auth } = await makeUser();
    const noAuth = await api().post('/api/titles').send({});
    assert.equal(noAuth.status, 401);
    const notAdmin = await api().post('/api/titles').set(auth).send({});
    assert.equal(notAdmin.status, 403);
  });
});
