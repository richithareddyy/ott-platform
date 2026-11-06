# StreamBox

A video-streaming site with catalog search, watchlists, playback progress, reviews, and an admin page. Double-clicks, multiple tabs, retried heartbeats, and two admins editing one title all create race conditions, and working through those was the point of the project.

The backend is Node.js, Express, and MongoDB. The frontend is vanilla JavaScript with a hash router, and poster artwork is generated procedurally as SVG.

## Run locally

Requires Node.js 22.9+ and Docker for MongoDB. From the repository root:

```bash
cp .env.example .env
docker compose up -d --wait
npm install
npm run seed
npm start
```

Before starting, set `JWT_SECRET` and the seed account passwords in `.env`. Open http://localhost:4000 and use the configured demo viewer or admin account.

**Seeding resets the target database.** Use it only for a disposable demo database. No videos are included; add `.mp4` or `.webm` files to `media/` and seed again, or assign a video through the admin page.

## Technical decisions

- **Duplicates:** watchlist items, progress, and reviews each have a unique `{user, title}` index plus idempotent upserts. A request that loses an insert race is treated as “already exists.”
- **Heartbeats:** each one carries the client’s report time and only applies if it’s newer than the stored value, so a delayed retry can’t rewind playback.
- **Ratings:** totals and the average are recomputed in a single atomic pipeline update.
- **Admin edits:** the update filter includes the version the client read, so a stale edit matches nothing and returns `409 Conflict`.
- **Playback:** range requests (`206 Partial Content`) with short-lived stream tokens scoped to one title.
- **Paging:** keyset cursors on `(sortField, _id)`, so deep pages don’t scan skipped rows.

The API lives under `/api`; [the guide](GUIDE.md#rest-api) covers endpoints, database indexes, and deployment. Docker can run the app as well as MongoDB through the `app` profile.

## Checks

```bash
npm test
npm run loadtest
```

The integration suite uses a separate `_test` database; concurrency checks use `_load`. The catalog and accounts are demo data, and this project does not supply a licensed video library.

[Setup, API, and deployment details](GUIDE.md)
