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

  it('protects admin routes', async () => {
    const { auth } = await makeUser();
    const noAuth = await api().post('/api/titles').send({});
    assert.equal(noAuth.status, 401);
    const notAdmin = await api().post('/api/titles').set(auth).send({});
    assert.equal(notAdmin.status, 403);
  });
});
