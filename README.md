# StreamBox

A video-streaming web project with catalog search, watchlists, playback progress, reviews, and an admin interface.

**Node.js · Express · MongoDB · Mongoose · JavaScript · Docker**

I built this to work through the backend details behind a streaming interface: HTTP range requests for playback, indexed catalog queries, and concurrent updates to user data. The frontend is a vanilla JavaScript app with a hash router. Poster artwork is generated procedurally as SVG.

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

- Range requests let a player request part of a video file.
- Watchlist and progress updates account for concurrent requests.
- Reviews are limited to one per user/title, with aggregate ratings.
- Admin edits use optimistic concurrency to detect conflicting changes.

The API lives under `/api`; [the guide](GUIDE.md#rest-api) covers endpoints, database indexes, and deployment. Docker can run the app as well as MongoDB through the `app` profile.

## Checks

```bash
npm test
npm run loadtest
```

The integration suite uses a separate `_test` database; concurrency checks use `_load`. The catalog and accounts are demo data, and this project does not supply a licensed video library.

[Setup, API, and deployment details](GUIDE.md)
