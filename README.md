# StreamBox

You pause a video, open another tab, and come back later expecting your place to be saved. StreamBox is a video-streaming demo with catalog search, watchlists, playback progress, reviews, and an admin page. Much of the work is in keeping that state consistent when requests arrive twice, out of order, or at the same time.

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

- **Repeated clicks:** a unique `{user, title}` database index prevents duplicate watchlist, progress, and review records. Repeating a request updates the existing record.
- **Playback updates:** the player sends its position with a timestamp. Older updates are ignored, so a delayed request cannot rewind saved progress.
- **Ratings:** totals and the average change together in one database update.
- **Admin edits:** saving checks the version originally opened. If another admin has changed it, the server returns `409 Conflict` instead of overwriting their work.
- **Streaming:** the player requests portions of a video using HTTP range requests and short-lived tokens for that title.
- **Catalog pages:** a cursor remembers where the previous page ended, avoiding a scan through all earlier results.

The API lives under `/api`; [the guide](GUIDE.md#rest-api) covers endpoints, database indexes, and deployment. Docker can run the app as well as MongoDB through the `app` profile.

## Checks

```bash
npm test
npm run loadtest
```

The integration suite uses a separate `_test` database; concurrency checks use `_load`. The catalog and accounts are demo data, and this project does not supply a licensed video library.

[Setup, API, and deployment details](GUIDE.md)
