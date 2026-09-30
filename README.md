# StreamBox: Web-Based OTT Platform

A full-stack video streaming platform built with **Node.js, Express.js, MongoDB, and vanilla JavaScript**. Viewers can browse and search a catalog, keep a watchlist, stream video with seeking and resume, and rate and review titles. Admins manage the catalog.

The backend is a REST API designed around MongoDB schemas that stay correct under high concurrency: simultaneous clicks, player heartbeats arriving out of order, and many users reviewing the same title at once.

## Features

- **Accounts:** registration and login with bcrypt password hashing and JWT authentication, plus user and admin roles.
- **Catalog:** home page with featured titles and per-genre rows. Browse by genre, type, and sort order, with infinite "load more" paging. Full-text search across titles, cast, and synopses.
- **Streaming:** HTTP range requests (`206 Partial Content`) so players can seek and buffer in chunks. Short-lived stream tokens are scoped to one title.
- **Watch progress:** the player saves position every 10 seconds and on pause, and resumes where you left off. A "Continue watching" row lists unfinished titles.
- **Watchlist:** add and remove titles from My List.
- **Ratings and reviews:** one review per user per title, with live average ratings.
- **Admin:** create, edit, and delete titles. Edits use optimistic concurrency so two admins cannot silently overwrite each other.

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ |
| API | Express.js 4 |
| Database | MongoDB 7 with Mongoose 8 |
| Auth | JSON Web Tokens and bcrypt |
| Frontend | Vanilla JavaScript single-page app (hash router), HTML, CSS |
| Tests | Node's built-in test runner and Supertest |
| Infrastructure | Docker Compose |

## Getting started

Prerequisites: Node.js 20.12 or newer, and Docker (for MongoDB).

```bash
cp .env.example .env         # then set JWT_SECRET and the seed passwords
docker compose up -d --wait  # starts MongoDB on port 27017
npm install
npm run seed                 # loads the sample catalog and demo accounts
npm start                    # http://localhost:4000
```

Sign in with the demo viewer or admin account defined in `.env` (`SEED_USER_*` and `SEED_ADMIN_*`).

**Video files.** No videos are included in this repository. To enable playback, copy `.mp4` or `.webm` files into `media/` and re-run `npm run seed`, which assigns them to titles. You can also set a title's video file from the Admin page.

**Run everything in Docker.** To run the app in a container as well:

```bash
docker compose --profile app up --build
```

## Deployment

The app deploys as a single Docker web service with a hosted MongoDB database.

1. **Database:** create a free MongoDB Atlas cluster.
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

| Command | Description |
|---|---|
| `npm start` | Start the server |
| `npm run dev` | Start with auto-restart on file changes |
| `npm run seed` | Reset the database and load the sample catalog |
| `npm run seed:bulk` | Seed plus 50,000 synthetic titles for performance testing |
| `npm test` | Run the integration test suite (uses a separate `_test` database) |
| `npm run loadtest` | Run the concurrency load test (uses a separate `_load` database) |

## REST API

All endpoints are under `/api`. Errors use one shape: `{ "error": { "message", "details?" } }`.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | none | Create an account and return a token |
| POST | `/auth/login` | none | Sign in and return a token |
| GET | `/auth/me` | user | Current user |
| GET | `/titles` | none | List titles: `genre`, `type`, `sort=popular\|newest\|top`, `limit`, `cursor` |
| GET | `/titles/search` | none | Full-text search: `q`, `page`, `limit` |
| GET | `/titles/rows` | none | Featured titles and top titles per genre (home page) |
| GET | `/titles/genres` | none | Allowed genres and maturity ratings |
| GET | `/titles/:id` | optional | Title details, plus viewer state when signed in |
| POST | `/titles/:id/play` | user | Stream URL (with stream token) and resume position |
| GET | `/titles/:id/reviews` | none | Reviews, newest first: `limit`, `before` |
| PUT | `/titles/:id/reviews/mine` | user | Create or update your review |
| DELETE | `/titles/:id/reviews/mine` | user | Delete your review |
| POST | `/titles` | admin | Create a title |
| PATCH | `/titles/:id` | admin | Update a title (requires `version`, returns 409 on conflict) |
| DELETE | `/titles/:id` | admin | Delete a title and its related data |
| GET | `/me/watchlist` | user | My List |
| PUT | `/me/watchlist/:titleId` | user | Add to My List (idempotent) |
| DELETE | `/me/watchlist/:titleId` | user | Remove from My List |
| GET | `/me/continue-watching` | user | Unfinished titles, most recent first |
| PUT | `/me/progress/:titleId` | user | Player heartbeat: `positionSeconds`, `durationSeconds`, `reportedAt` |
| DELETE | `/me/progress/:titleId` | user | Clear progress |
| GET | `/stream/:titleId?token=…` | stream token | Video bytes with Range support |
| GET | `/health` | none | Liveness and database status |

## Schema design and concurrency

Collections: `users`, `titles`, `watchlistitems`, `watchprogresses`, and `reviews`.

| Problem | Approach |
|---|---|
| Double-clicks or multiple devices creating duplicate list entries, reviews, or progress records | A **unique compound index on `{user, title}`** in each collection, plus idempotent **upserts**. A request that loses an insert race gets a duplicate-key error, which is handled as "already exists" or retried as an update. |
| Watchlists and history growing without bound inside the user document | Stored as **separate collections**, not arrays on `User`. Documents stay small, and writes from different sessions never contend on one hot document. |
| Many users rating the same title at once | Rating totals (`ratingCount`, `ratingSum`, `ratingAvg`) are updated with a **single atomic aggregation-pipeline update**, so the average is recomputed from the new sum and count in the same write. When a user changes a rating, `findOneAndUpdate` returns the previous value atomically, so the delta is exact. |
| Player heartbeats arriving out of order (retries, several tabs) | Each write carries the client's `reportedAt` time and only applies when it is **newer than the stored value**, so a delayed heartbeat can never rewind playback position. |
| Counting views | `viewCount` is incremented only when a progress document is **first inserted**, which gives one unique view per user per title. |
| Two admins editing the same title | **Optimistic concurrency:** the update filter includes the version the client read (`__v`). A stale edit matches nothing and returns `409 Conflict`. |
| Deep catalog paging getting slower | **Keyset (cursor) pagination** on `(sortField, _id)` backed by compound indexes. Cost stays the same on page 1 and page 1,000, unlike `skip`. |
| Heavy home-page reads | `$topN` aggregation (keeps only 12 titles per genre in memory) plus a 30-second in-memory cache. List endpoints use **projections** and **`lean()`** queries. |
| Search | A weighted **text index** (name > cast > synopsis). |
| Connection pressure | A configurable **connection pool** (`MONGO_POOL_SIZE`, default 50). |

Indexes are declared in [src/models](src/models). They are built automatically in development and by `npm run seed`.

### Load test

`npm run loadtest` starts the API in-process against a separate database. It runs concurrent clients issuing a weighted mix of browse, detail, search, heartbeat, watchlist, and review requests, with writes concentrated on 10 "hot" titles to force contention. It then verifies data integrity.

Example run on a development laptop (single Node process, MongoDB in Docker, 100 concurrent clients for 15 seconds):

```
Total: 51,633 requests in 15.0s = 3440 req/s, 0 errors (0.00%)

  duplicate watchlist entries:   0
  duplicate progress documents:  0
  duplicate reviews:             0
  titles with wrong rating sums: 0
  titles with wrong view counts: 0
```

Results depend on hardware. Options: `--users`, `--titles`, `--concurrency`, and `--duration`.

## Project structure

```
├── src/
│   ├── server.js            # entry point, graceful shutdown
│   ├── app.js               # Express app and route mounting
│   ├── config.js, db.js
│   ├── models/              # Mongoose schemas and indexes
│   ├── routes/              # auth, titles (+ reviews, admin), me, stream
│   ├── middleware/          # auth, rate limiting, error handling
│   ├── services/ratings.js  # atomic rating aggregate update
│   └── utils/               # validation, cursors, HTTP helpers
├── public/                  # single-page frontend (HTML/CSS/JS)
├── scripts/                 # seed data, bulk generator, load test
├── test/                    # integration tests
├── media/                   # video files (not committed)
├── docker-compose.yml
└── Dockerfile
```

## Security notes

- Passwords are hashed with bcrypt. Tokens are signed with `JWT_SECRET`, which is required in production.
- Request bodies are validated against an allow-list of fields and types, which blocks MongoDB operator injection such as `{"$gt": ""}`.
- Login and registration are rate limited per IP. The limiter is in memory; use a shared store when running several instances.
- Video paths are restricted to the `media/` directory. Stream tokens expire and only work for the title they were issued for.
