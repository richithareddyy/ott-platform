const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { api, setup, teardown, reset, makeUser, makeTitle, mediaDir } = require('./helpers');
const { parseRange } = require('../src/routes/stream');

const SIZE = 5000;

describe('streaming', () => {
  before(async () => {
    await setup();
    fs.writeFileSync(path.join(mediaDir, 'clip.mp4'), Buffer.alloc(SIZE, 7));
  });
  after(teardown);
  beforeEach(reset);

  async function playable() {
    const t = await makeTitle({ videoFile: 'clip.mp4' });
    const { auth } = await makeUser();
    const play = await api().post(`/api/titles/${t._id}/play`).set(auth);
    assert.equal(play.status, 200);
    return { t, auth, url: play.body.streamUrl };
  }

  it('serves byte ranges with 206 Partial Content', async () => {
    const { url } = await playable();
    const res = await api().get(url).set('Range', 'bytes=100-199');
    assert.equal(res.status, 206);
    assert.equal(res.headers['content-range'], `bytes 100-199/${SIZE}`);
    assert.equal(res.headers['content-length'], '100');
    assert.equal(res.headers['content-type'], 'video/mp4');
  });

  it('serves the whole file without a Range header and 416 for bad ranges', async () => {
    const { url } = await playable();
    const full = await api().get(url);
    assert.equal(full.status, 200);
    assert.equal(full.headers['content-length'], String(SIZE));
    const bad = await api().get(url).set('Range', `bytes=${SIZE + 10}-`);
    assert.equal(bad.status, 416);
  });

  it('rejects missing, wrong-title, and API tokens', async () => {
    const { t, auth, url } = await playable();
    assert.equal((await api().get(`/api/stream/${t._id}`)).status, 401);
    const other = await makeTitle({ videoFile: 'clip.mp4' });
    const token = new URL(url, 'http://x').searchParams.get('token');
    assert.equal((await api().get(`/api/stream/${other._id}?token=${token}`)).status, 403);
    const apiToken = auth.Authorization.slice(7);
    assert.equal((await api().get(`/api/stream/${t._id}?token=${apiToken}`)).status, 401);
  });

  it('returns resume position from saved progress', async () => {
    const { t, auth } = await playable();
    await api().put(`/api/me/progress/${t._id}`).set(auth).send({ positionSeconds: 321, durationSeconds: 6000 });
    const play = await api().post(`/api/titles/${t._id}/play`).set(auth);
    assert.equal(play.body.resumeAt, 321);
  });

  it('parses range headers', () => {
    assert.deepEqual(parseRange('bytes=0-9', 100), { start: 0, end: 9 });
    assert.deepEqual(parseRange('bytes=90-', 100), { start: 90, end: 99 });
    assert.deepEqual(parseRange('bytes=-10', 100), { start: 90, end: 99 });
    assert.deepEqual(parseRange('bytes=50-500', 100), { start: 50, end: 99 });
    assert.equal(parseRange('bytes=100-', 100), null);
    assert.equal(parseRange('items=0-1', 100), null);
  });
});
