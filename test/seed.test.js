const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const net = require('net');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { mongoose } = require('../src/db');
const { setup, teardown, reset, makeUser, makeTitle } = require('./helpers');
const User = require('../src/models/User');
const Title = require('../src/models/Title');
const { assertSeedTarget, assertNamedServer } = require('../scripts/seed');

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

  // A proxy gives the test database a second address, so the replica set really
  // does advertise a host:port other than the one in MONGO_URI.
  it('refuses a server other than the one MONGO_URI names, even with SEED_ALLOW_ANY_DB', async () => {
    await makeUser();
    await makeTitle();
    const { host, port, name } = mongoose.connection;
    const proxy = net.createServer((socket) => {
      const upstream = net.connect(port, host);
      socket.on('error', () => upstream.destroy());
      upstream.on('error', () => socket.destroy());
      socket.pipe(upstream).pipe(socket);
    });
    await new Promise((resolve) => { proxy.listen(0, '127.0.0.1', resolve); });
    const address = `127.0.0.1:${proxy.address().port}`;

    const empty = mongoose.connection.useDb(`${name}_redirect`);

    try {
      for (const target of [name, `${name}?directConnection=true`, empty.name]) {
        const env = {
          ...process.env,
          MONGO_URI: `mongodb://${address}/${target}`, SEED_ALLOW_ANY_DB: '1',
          SEED_ADMIN_EMAIL: 'admin@example.test', SEED_ADMIN_PASSWORD: 'password123',
          SEED_USER_EMAIL: 'viewer@example.test', SEED_USER_PASSWORD: 'password123',
        };
        delete env.SEED_ALLOW_REDIRECT;
        // Not spawnSync: the proxy runs in this process and needs the event loop.
        const child = spawn(process.execPath, [path.join(__dirname, '..', 'scripts', 'seed.js')], { env });
        let stderr = '';
        child.stderr.on('data', (chunk) => { stderr += chunk; });
        const status = await new Promise((resolve) => { child.on('close', resolve); });

        assert.equal(status, 1);
        assert.ok(stderr.includes(`MONGO_URI names ${address}, but the server reached identifies itself as `), stderr);
        assert.equal(await User.countDocuments(), 1, 'users must be untouched');
        assert.equal(await Title.countDocuments(), 1, 'titles must be untouched');
      }
      assert.deepEqual(await empty.db.listCollections().toArray(), [], 'not even empty collections are created');
    } finally {
      await empty.dropDatabase();
      proxy.close();
    }

    const check = (named, hello, vars = {}) => () => assertNamedServer({ named, hello }, vars);
    const redirected = [['127.0.0.1:27917'], { me: 'localhost:27017', hosts: ['localhost:27017'] }];
    assert.throws(check(...redirected), /names 127\.0\.0\.1:27917, but .* as localhost:27017/);
    assert.throws(check(...redirected, { SEED_ALLOW_ANY_DB: '1' }), /Refusing to seed/);
    assert.throws(check(...redirected, { SEED_ALLOW_REDIRECT: 'true' }), /Refusing to seed/);
    assert.doesNotThrow(check(...redirected, { SEED_ALLOW_REDIRECT: '1' }));
    assert.throws(check(['a.example.net:27017'], { me: 'b.example.net:27017' }), /Refusing to seed/);
    assert.throws(check(['localhost:27017'], { hosts: ['localhost:27018'] }), /Refusing to seed/);
    assert.throws(check(['localhost:27017'], {}), /as unknown/);
    assert.doesNotThrow(check(['127.0.0.1:27017'], { me: 'localhost:27017' }));
    assert.doesNotThrow(check(['[::1]:27017'], { me: 'localhost:27017' }));
    assert.doesNotThrow(check(['localhost:27017'], { hosts: ['localhost:27017'] }));
    assert.doesNotThrow(check(['a.example.net:27017', 'b.example.net:27017'], { me: 'B.example.net:27017' }));
  });
});
