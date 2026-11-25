const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('child_process');
const { setup, teardown, reset, makeUser, makeTitle } = require('./helpers');
const User = require('../src/models/User');
const Title = require('../src/models/Title');
const { assertSeedTarget } = require('../scripts/seed');

describe('seed guard', () => {
  before(setup);
  after(teardown);
  beforeEach(reset);

  it('refuses a different database before deleting anything', async () => {
    await makeUser();
    await makeTitle();
    const env = {
      ...process.env,
      SEED_ADMIN_EMAIL: 'admin@example.test', SEED_ADMIN_PASSWORD: 'password123',
      SEED_USER_EMAIL: 'viewer@example.test', SEED_USER_PASSWORD: 'password123',
    };
    delete env.SEED_ALLOW_ANY_DB;
    const run = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'seed.js')], { env, encoding: 'utf8' });

    assert.equal(run.status, 1);
    assert.match(run.stdout, /Seed target: host \S+, database ott_platform_test/);
    assert.match(run.stderr, /Refusing to seed/);
    assert.equal(await User.countDocuments(), 1, 'users must be untouched');
    assert.equal(await Title.countDocuments(), 1, 'titles must be untouched');

    const check = (address, database, vars = {}) => () => assertSeedTarget({ address, database }, vars);
    assert.throws(check('localhost:27017', 'other'), /Refusing to seed/);
    assert.throws(check('cluster0.example.net:27017', 'ott_platform'), /Refusing to seed/);
    assert.throws(check('unknown', 'ott_platform'), /Refusing to seed/);
    assert.throws(check('localhost:27017', 'other', { SEED_ALLOW_ANY_DB: 'true' }), /Refusing to seed/);
    assert.doesNotThrow(check('localhost:27017', 'ott_platform'));
    assert.doesNotThrow(check('127.0.0.1:27017', 'ott_platform'));
    assert.doesNotThrow(check('cluster0.example.net:27017', 'other', { SEED_ALLOW_ANY_DB: '1' }));
  });
});
