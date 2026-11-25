# Kinoloft · OTT Platform

A web-based video streaming project with catalog browsing, search, watchlists, playback progress, ratings, and an admin interface. Built with **Node.js, Express, MongoDB, and vanilla JavaScript**.

[Getting started](#getting-started) · [Features](#features) · [REST API](#rest-api) · [Database design](#schema-design-and-concurrency) · [Load test](#load-test)

The interesting part of this project is what happens when browser sessions overlap: two watchlist adds, a late playback heartbeat, or two edits to the same catalog entry. The implementation uses database constraints and conditional writes to handle those cases.

## At a glance

| Viewers | Administrators | Backend |
| --- | --- | --- |
| Browse titles, manage a watchlist, resume playback, and write reviews | Create and edit catalog entries with version checks | REST API, indexed MongoDB collections, and HTTP range streaming |

**Demo scope:** Guest access uses a shared account and cannot post public reviews. The catalog's nine films play from YouTube, so no video files are included; local files are optional and play only after one is assigned to a title on the Admin page.

The backend handles duplicate list entries, out-of-order playback updates, and conflicting catalog edits. The database design and load-test sections explain these mechanisms and their evaluation.

## Features

- **Accounts:** registration and login with bcrypt password hashing and JWT authentication, plus user and admin roles. The account is reloaded on every API request made with a sign-in token. Users can delete their own account and its data from the Account page; the shared guest account cannot be deleted.
- **One-click demo:** **Try the demo** signs visitors into a shared guest account. Signed-out visitors who press Play or + My List are moved into it automatically, with no sign-in wall. Guests can't post public reviews.
- **Films and artwork:** the catalog is nine Creative Commons open movies by the Blender Foundation and Blender Studio, played through YouTube's IFrame Player API in privacy-enhanced mode, with watch progress saved from the player. Artwork is an auto-generated frame from each film, cropped past letterbox bars. Titles without a YouTube video fall back to procedurally generated SVG artwork.
- **Home page:** one featured film that changes daily, Continue watching when there is something to resume, a tabbed program of up to five other titles, short films, the archive, genre tiles that link to Browse, and a Most watched row once at least three titles have views.
- **Browse:** filter by genre and type and sort by popularity, year, or rating. A **Show more** button loads the next 24 titles using a cursor.
- **Search:** full-text search across titles, directors, credits, cast, genres, and synopses, with numbered pages. When no whole word matches, it falls back to titles that contain the text.
- **Streaming:** the nine films stream from YouTube. Locally hosted files are served with HTTP range requests (`206 Partial Content`) so players can seek and buffer in chunks, and short-lived stream tokens are scoped to one title.
- **Watch progress:** both players save position about every 10 seconds, on pause, at the end, and on leaving, and resume where you left off. A "Continue watching" row lists unfinished titles.
- **Watchlist:** add and remove titles from My List.
- **Ratings and reviews:** one review per user per title, with live average ratings.
- **Admin:** create, edit, and delete titles. Edits use optimistic concurrency so two admins cannot silently overwrite each other.

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22.9+ for the npm scripts |
| API | Express.js 4 |
| Database | MongoDB 7 with Mongoose 8 |
| Auth | JSON Web Tokens and bcrypt |
| Frontend | Vanilla JavaScript single-page app (hash router), HTML, CSS |
| Tests | Node's built-in test runner and Supertest |
| Infrastructure | Docker Compose |

## Getting started

Prerequisites: Node.js 22.9 or newer, and Docker (for MongoDB). The npm scripts use [`--env-file-if-exists`](https://nodejs.org/download/release/v22.23.0/docs/api/cli.html#--env-file-if-existsfile) and pass a glob pattern to `node --test`; 22.9 is the earliest release that supports both. The Dockerfile already uses Node 22.

```bash
git clone https://github.com/richithareddyy/ott-platform.git
cd ott-platform
cp .env.example .env         # then set JWT_SECRET and the seed passwords
docker compose up -d --wait  # starts MongoDB on port 27017
npm install
npm run seed                 # loads the sample catalog and demo accounts
npm start                    # http://localhost:4000
```

Sign in with the demo viewer or admin account defined in `.env` (`SEED_USER_*` and `SEED_ADMIN_*`).

**Video files.** The seeded films stream from YouTube. For titles without a YouTube ID, copy `.mp4` or `.webm` files into `media/` and assign one from the Admin page; the range-request streaming endpoint serves them.

**Startup.** Starting the server syncs indexes and runs any pending data migration once. On an unseeded database the migration loads the nine films, without accounts.

**Run everything in Docker.** To run the app in a container as well:

```bash
docker compose --profile app up --build
```

## Deployment

The app deploys as a single Docker web service with a hosted MongoDB database.

1. **Database:** create a free MongoDB Atlas cluster. Atlas clusters are replica sets, which the app requires for transactions; a standalone MongoDB server is refused at startup.
   - Add a database user.
   - Allow network access from anywhere (`0.0.0.0/0`).
   - Copy the connection string, and add `/ott_platform` before the `?` so it names the database.
2. **Web service:** on Render, choose **New > Blueprint** and select this repository. `render.yaml` configures the service and generates `JWT_SECRET`. When prompted, set `MONGO_URI` to the Atlas connection string.
3. **Seed the hosted database** from your machine, using strong passwords for the demo accounts:

   ```bash
   MONGO_URI="<atlas connection string>" SEED_ADMIN_PASSWORD="<strong password>" npm run seed
   ```

Free Render services sleep when idle, so the first request after a pause can take up to a minute.

## Scripts

`npm run seed` resets the target database before loading sample data. Use it only with a database intended for this demo.

| Command | Description |
|---|---|
| `npm start` | Start the server |
| `npm run dev` | Start with auto-restart on file changes |
| `npm run seed` | Reset the database, load the film catalog, and create the admin and viewer accounts |
| `npm run seed:bulk` | Seed plus 50,000 synthetic titles for performance testing |
| `npm test` | Run the test suite (uses a separate `_test` database) |
| `npm run ratings:check` | Report titles whose rating aggregate disagrees with their reviews, and orphaned reviews; exits 1 if any aggregate is wrong, while orphaned reviews alone exit 0 |
| `npm run ratings:check -- --apply` | Also repair the wrong aggregates; orphaned reviews are only reported |
| `npm run loadtest` | Run the concurrency load test (uses a separate `_load` database) |
| `node scripts/check-db.js` | Check that `MONGO_URI` connects and authenticates, without printing it |

## REST API

All endpoints are under `/api`. Errors use one shape: `{ "error": { "message", "details?" } }`.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | none | Create an account and return a token |
| POST | `/auth/login` | none | Sign in and return a token |
| POST | `/auth/demo` | none | Sign in to the shared guest account |
| GET | `/auth/me` | user | Current user |
| GET | `/titles` | none | List titles: `genre`, `type`, `sort=popular\|newest\|top`, `limit`, `cursor` |
| GET | `/titles/search` | none | Full-text search with partial-title fallback: `q`, `page`, `limit` |
| GET | `/titles/rows` | none | Featured titles and top titles per genre (home page) |
| GET | `/titles/genres` | none | Allowed genres and maturity ratings |
| GET | `/titles/:id` | optional | Title details, plus viewer state when signed in |
| POST | `/titles/:id/play` | user | Resume position, plus a stream URL (with stream token) when the title has a local file |
| GET | `/titles/:id/reviews` | none | Reviews, newest first: `limit`, `before` |
| PUT | `/titles/:id/reviews/mine` | user | Create or update your review |
| DELETE | `/titles/:id/reviews/mine` | user | Delete your review |
| POST | `/titles` | admin | Create a title |
| PATCH | `/titles/:id` | admin | Update a title (requires `version`, returns 409 on conflict) |
| DELETE | `/titles/:id` | admin | Delete a title and its related data |
| DELETE | `/me` | user | Delete your account, reviews, list, and progress (403 for the shared guest) |
| GET | `/me/watchlist` | user | My List |
| PUT | `/me/watchlist/:titleId` | user | Add to My List (idempotent) |
| DELETE | `/me/watchlist/:titleId` | user | Remove from My List |
| GET | `/me/continue-watching` | user | Unfinished titles, most recent first |
| PUT | `/me/progress/:titleId` | user | Player heartbeat: `positionSeconds`, `durationSeconds`, `reportedAt` |
| DELETE | `/me/progress/:titleId` | user | Clear progress |
| GET | `/stream/:titleId?token=…` | stream token | Video bytes with Range support |
| GET | `/health` | none | Liveness and database status |

## Schema design and concurrency

Collections: `users`, `titles`, `watchlistitems`, `watchprogresses`, `reviews`, and `migrations` (which startup migrations have run).

| Problem | Approach |
|---|---|
| Double-clicks or multiple devices creating duplicate list entries, reviews, or progress records | A **unique compound index on `{user, title}`** in each collection, plus idempotent **upserts**. A request that loses an insert race gets a duplicate-key error, which is handled as "already exists" or retried as an update. |
| Watchlists and history growing without bound inside the user document | Stored as **separate collections**, not arrays on `User`. Documents stay small, and writes from different sessions never contend on one hot document. |
| Many users rating the same title at once | Rating totals (`ratingCount`, `ratingSum`, `ratingAvg`) are updated with a **single atomic aggregation-pipeline update**, so the average is recomputed from the new sum and count in the same write. When a user changes a rating, `findOneAndUpdate` returns the previous value atomically, so the delta is exact. The review and the totals change in one **transaction**; conflicting transactions are retried. |
| Player heartbeats arriving out of order (retries, several tabs) | Each write carries the client's `reportedAt` time and only applies when it is **newer than the stored value**, so a delayed heartbeat can never rewind playback position. |
| Counting views | `viewCount` is incremented only when a progress document is **first inserted**, which counts one view per progress-record creation. Deleting progress and playing again can increment it again. |
| Two admins editing the same title | **Optimistic concurrency:** the update filter includes the version the client read (`__v`). A stale edit matches nothing and returns `409 Conflict`. |
| Deep catalog paging getting slower | **Keyset (cursor) pagination** on `(sortField, _id)` backed by compound indexes. This avoids scanning skipped rows as the page offset grows; actual latency still depends on the query and data. |
| Heavy home-page reads | `$topN` aggregation (keeps only 12 titles per genre in memory) plus a 30-second in-memory cache for `/titles/rows`. List endpoints use **projections** and **`lean()`** queries. |
| Search | A weighted **text index** (name > director > cast > credit and genres > synopsis), with a case-insensitive partial match on the title when it finds nothing. Search uses numbered pages (`skip`/`limit`), not a cursor. |
| Connection pressure | A configurable **connection pool** (`MONGO_POOL_SIZE`, default 50). |

Indexes are declared in [src/models](src/models). Mongoose's automatic index building is off; the server syncs every index at startup, so a changed definition replaces the old one, and `npm run seed` syncs them too.

### Load test

`npm run loadtest` starts the API in-process against a separate database. It runs concurrent clients issuing a weighted mix of browse, detail, search, heartbeat, watchlist, and review requests, with writes concentrated on 10 "hot" titles to force contention. It then verifies data integrity.

Example run, first recorded in this repository on 30 September 2026 (the exact run date was not kept and the raw log is not committed). It predates transactional rating writes (16 November 2026) and the 20 November 2026 dependency update, and has **not been re-measured since**. Development laptop, single Node process, MongoDB in Docker, 100 concurrent clients for 15 seconds:

```
Total: 51,633 requests in 15.0s = 3440 req/s, 0 errors (0.00%)

  duplicate watchlist entries:   0
  duplicate progress documents:  0
  duplicate reviews:             0
  titles with wrong rating sums: 0
  titles with wrong view counts: 0
```

Results depend on hardware and machine load. The [README](README.md#checks) has a newer run, also from before the dependency update. Defaults are 200 users, 300 titles, 100 concurrent clients, and 20 seconds. Options: `--users`, `--titles`, `--concurrency`, and `--duration`.

## Project structure

```
├── src/
│   ├── server.js            # entry point, graceful shutdown
│   ├── app.js               # Express app and route mounting
│   ├── config.js, db.js
│   ├── migrations.js        # one-off data changes run at startup
│   ├── models/              # Mongoose schemas and indexes
│   ├── routes/              # auth, titles (+ reviews, admin), me, stream
│   ├── middleware/          # auth, rate limiting, error handling
│   ├── services/ratings.js  # rating aggregate update, run inside the review's transaction
│   └── utils/               # validation, cursors, HTTP helpers
├── public/                  # single-page frontend (HTML/CSS/JS)
├── scripts/                 # film catalog, seed, load test, ratings check, database check
├── test/                    # automated tests
├── media/                   # video files (not committed)
├── .github/workflows/ci.yml # tests and concurrency smoke test
├── docker-compose.yml
├── Dockerfile
├── render.yaml              # Render deployment
├── .env.example
└── LICENSE                  # MIT
```

## Tests and remaining tradeoffs

`npm test` uses Node's test runner and Supertest against MongoDB. Tests cover authentication, authorization on catalog-changing routes, catalog operations, byte-range responses, duplicate writes, rating aggregates (including failed and retried writes), stale playback updates, conflicting admin edits, the ratings check, and the startup migration. The default database is `ott_platform_test`; `MONGO_URI_TEST` overrides it. The test helper drops that database during setup and teardown.

Review changes and title rating aggregates commit in one transaction, and so does account deletion. Progress creation and view-count updates are still separate writes: each is atomic, but a process failure between them can leave a view count one short. Deleting a title is not transactional either: the title and its reviews, list entries, and progress are removed in separate writes. `npm run ratings:check` reports rating drift without changing data. The load test checks concurrency within a running process; it does not test crash recovery. The service plays YouTube embeds, serves local media files, and does not implement transcoding, adaptive streaming, subscriptions, or DRM.

## Security notes

- Passwords are hashed with bcrypt. Tokens are signed with `JWT_SECRET`, which is required in production.
- Request bodies are validated against an allow-list of fields and types, which blocks MongoDB operator injection such as `{"$gt": ""}`.
- Login, registration, and demo sign-in share a limit of 50 requests per 15 minutes per IP (`AUTH_RATE_LIMIT` overrides it). The limiter is in memory; use a shared store when running several instances.
- Video paths are restricted to the `media/` directory. Stream tokens expire and only work for the title they were issued for.
