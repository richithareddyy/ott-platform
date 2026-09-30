const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { api, setup, teardown, reset, makeUser, makeTitle } = require('./helpers');

describe('catalog', () => {
  before(setup);
  after(teardown);
  beforeEach(reset);

  it('pages through titles with a stable cursor and no duplicates', async () => {
    // Many ties on viewCount exercise the _id tie-breaker.
    for (let i = 0; i < 25; i += 1) await makeTitle({ viewCount: i % 3 });
    const seen = new Set();
    let cursor;
    let pages = 0;
    do {
      const res = await api().get('/api/titles').query({ sort: 'popular', limit: 7, ...(cursor && { cursor }) });
      assert.equal(res.status, 200);
      for (const t of res.body.items) {
        assert.ok(!seen.has(t._id), 'duplicate across pages');
        seen.add(t._id);
      }
      cursor = res.body.nextCursor;
      pages += 1;
    } while (cursor);
    assert.equal(seen.size, 25);
    assert.equal(pages, 4);
  });

  it('filters by genre and rejects unknown genres', async () => {
    await makeTitle({ genres: ['Comedy'] });
    await makeTitle({ genres: ['Horror'] });
    const res = await api().get('/api/titles').query({ genre: 'Comedy' });
    assert.equal(res.body.items.length, 1);
    const bad = await api().get('/api/titles').query({ genre: 'Opera' });
    assert.equal(bad.status, 400);
  });

  it('searches by name and cast', async () => {
    await makeTitle({ name: 'The Lighthouse Keeper', cast: ['Maya Okafor'] });
    await makeTitle({ name: 'Something Else' });
    const byName = await api().get('/api/titles/search').query({ q: 'lighthouse' });
    assert.equal(byName.body.total, 1);
    const byCast = await api().get('/api/titles/search').query({ q: 'okafor' });
    assert.equal(byCast.body.items[0].name, 'The Lighthouse Keeper');
  });

  it('builds home rows grouped by genre', async () => {
    await makeTitle({ genres: ['Drama', 'Comedy'], featured: true });
    const res = await api().get('/api/titles/rows');
    assert.equal(res.status, 200);
    assert.equal(res.body.featured.length, 1);
    assert.deepEqual(res.body.rows.map((r) => r.genre), ['Comedy', 'Drama']);
  });

  it('returns viewer state on the detail endpoint', async () => {
    const t = await makeTitle();
    const { auth } = await makeUser();
    await api().put(`/api/me/watchlist/${t._id}`).set(auth);
    const res = await api().get(`/api/titles/${t._id}`).set(auth);
    assert.equal(res.body.viewer.inWatchlist, true);
    const anon = await api().get(`/api/titles/${t._id}`);
    assert.equal(anon.body.viewer, null);
    assert.equal((await api().get('/api/titles/not-an-id')).status, 400);
  });

  it('lets admins create, edit with version checks, and delete titles', async () => {
    const { auth } = await makeUser('admin');
    const created = await api().post('/api/titles').set(auth).send({
      name: 'New Show', type: 'series', synopsis: 'Pilot.', genres: ['Comedy'],
      releaseYear: 2025, maturityRating: 'TV-14', durationMinutes: 30,
    });
    assert.equal(created.status, 201);
    const id = created.body.title._id;
    assert.equal(created.body.title.version, 0);

    const edit1 = await api().patch(`/api/titles/${id}`).set(auth).send({ version: 0, name: 'Renamed' });
    assert.equal(edit1.status, 200);
    assert.equal(edit1.body.title.version, 1);

    // A second admin still holding version 0 must not overwrite the first edit.
    const stale = await api().patch(`/api/titles/${id}`).set(auth).send({ version: 0, name: 'Clobbered' });
    assert.equal(stale.status, 409);

    const del = await api().delete(`/api/titles/${id}`).set(auth);
    assert.equal(del.status, 204);
    assert.equal((await api().get(`/api/titles/${id}`)).status, 404);
  });
});
