# Kinoloft

You pause a video, open another tab, and come back later expecting your place to be saved. Kinoloft is a video-streaming demo with catalog search, watchlists, playback progress, reviews, and an admin page. Much of the work is in keeping that state consistent when requests arrive twice, out of order, or at the same time.

The backend is Node.js, Express, and MongoDB. The frontend is vanilla JavaScript with a hash router. The catalog is nine Creative Commons open movies by the Blender Foundation and Blender Studio, played through YouTube's embedded player; see [Credits and licenses](#credits-and-licenses).

## Run locally

Requires Node.js 22.9+ and Docker for MongoDB. MongoDB must run as a **replica set**, because review and account changes use multi-document transactions; `docker compose` starts a single-node set, and every MongoDB Atlas cluster (including the free tier) already is one. The server refuses to start against a standalone MongoDB. From the repository root:

```bash
cp .env.example .env
docker compose up -d --wait
npm install
npm run seed
npm start
```

After copying `.env`, set `JWT_SECRET` and the seed account passwords in it before running `npm run seed`. (`JWT_SECRET` is enforced only when `NODE_ENV=production`; the app profile below also requires it.) Open http://localhost:4000 and use the configured demo viewer or admin account, or **Try the demo**.

**Seeding resets the target database.** Use it only for a disposable demo database. It loads the films from `scripts/catalog.json` with empty ratings, reviews, and view counts, creates the admin and viewer accounts, and puts four films in the viewer's list. Starting the server also syncs indexes and runs any pending data migration once; the first start on an unseeded database loads the films by itself, without accounts. Titles without a YouTube video can play local `.mp4` or `.webm` files from `media/` once one is assigned on the Admin page.

## Technical decisions

- **Repeated clicks:** a unique `{user, title}` database index prevents duplicate watchlist, progress, and review records. Repeating a request changes the existing record (progress, reviews) or leaves it as it is (watchlist).
- **Playback updates:** the player sends its position with a timestamp. Updates that are not newer than the saved one are ignored, so a delayed request cannot rewind saved progress.
- **Ratings:** a review and its title's count, sum, and average change in one transaction. Creating, editing, or deleting a review, and deleting an account with reviews, either commit together or roll back together, so a failure between the writes leaves nothing half-applied and an identical retry starts clean. Concurrent reviews on the same title conflict and are retried rather than overwritten.
- **Sign-in revocation:** a token only proves who signed in. Every API request made with a sign-in token reloads the account, so a deleted account is rejected at once and the role stored in the database, not the role in the token, decides access: a demoted admin loses admin rights on their next request. Stream tokens are the exception: they are checked only for signature, expiry, and title.
- **Admin edits:** saving checks the version originally opened. If another admin has changed it, the server returns `409 Conflict` instead of overwriting their work.
- **Streaming:** the nine films stream from YouTube, and the app reads the player's position to save progress. Locally hosted files are served by the app instead, using HTTP range requests and short-lived tokens for that title.
- **Catalog pages:** when browsing, a cursor remembers where the previous page ended, avoiding a scan through all earlier results. Search results use page numbers.

The API lives under `/api`; [the guide](GUIDE.md#rest-api) covers endpoints, database indexes, and deployment. Docker can run the app as well as MongoDB through the `app` profile.

## Checks

```bash
npm test
npm run loadtest
```

The integration suite uses a separate `_test` database and the load test uses `_load`; both are dropped by the scripts, so point them only at disposable databases. CI (`.github/workflows/ci.yml`) runs the tests on Node 22.9.0 and 24 against a single-node replica set, then a short concurrency smoke test that fails on any error or integrity violation.

**44 integration tests** cover authentication, authorization on every catalog-changing route (legitimate, ordinary, expired, forged, deleted, demoted, and promoted principals), rating consistency when a write fails between the review and its aggregate (create, edit, delete, account deletion, and identical retries), concurrent review changes, duplicate writes, stale playback updates, conflicting admin edits, byte-range streaming, search, and the catalog migration.

**Checking existing data.** `npm run ratings:check` recomputes every title's aggregate from its reviews and lists any mismatch and any orphaned review. It changes nothing and exits non-zero if it finds a problem. `npm run ratings:check -- --apply` repairs mismatched aggregates, each inside a transaction; orphaned reviews are only reported. Run it against production deliberately, with `MONGO_URI` set.

**Load test, run 15 November 2026.** One Node.js 24 process and MongoDB 7.0 (single-node replica set) in Docker on an Apple M5 laptop (10 cores); 200 users, 100 concurrent clients, 20 seconds, writes concentrated on 10 titles:

| Operation | Requests | p50 ms | p95 ms | p99 ms |
|---|---:|---:|---:|---:|
| Browse catalog | 8,891 | 26.9 | 40.7 | 55.4 |
| Home rows | 4,379 | 25.3 | 40.2 | 58.7 |
| Title detail | 6,530 | 37.4 | 58.3 | 81.3 |
| Search | 3,539 | 27.2 | 42.0 | 59.9 |
| Playback heartbeat (write) | 13,007 | 48.1 | 78.2 | 109.4 |
| Add to list (write) | 3,946 | 46.8 | 72.0 | 102.6 |
| Review (write, transactional) | 3,529 | 84.2 | 235.9 | 399.0 |

43,821 requests in 20.0 s (about 2,200 requests per second) with 0 errors. The audit afterwards found 0 duplicate list entries, progress records, or reviews, and 0 titles with wrong rating sums or view counts. Correctness costs latency: review writes on the same few titles conflict inside transactions and are retried, which is why their tail is longest, and signed-in requests now include an account lookup. These are local numbers; the free hosted instance is slower and sleeps when idle.

## Credits and licenses

Kinoloft is a portfolio project, not a commercial streaming service, and is not affiliated with the Blender Foundation, Blender Studio, YouTube, or Google.

- **Films:** open movies by the Blender Foundation and Blender Studio, embedded unchanged from Blender's official YouTube channels and used under their Creative Commons licenses (CC BY 2.5, 3.0, and 4.0; Cosmos Laundromat is CC BY-SA 3.0). Each film's creator, license, and source are listed in `scripts/catalog.json`, on its title page, and on the in-app Credits page. Artwork is a frame from each film served by YouTube; synopses are written for this project.
- **YouTube:** playback and thumbnails use YouTube API Services, subject to the [YouTube Terms of Service](https://www.youtube.com/t/terms) and the [Google Privacy Policy](https://policies.google.com/privacy).
- **Fonts:** [Inter](https://rsms.me/inter/) by Rasmus Andersson, Fraunces by Undercase Type, and IBM Plex Mono by IBM, all SIL Open Font License 1.1, loaded from Google Fonts.
- **Packages:** Express, Mongoose, jsonwebtoken, bcrypt.js, and Supertest are MIT-licensed; their notices ship with each package.

The app includes Terms, Privacy, Credits, and Copyright pages (footer links), and signed-in users can delete their account and data from the Account page.

The code in this repository is available under the [MIT License](LICENSE). The films and fonts keep their own licenses, listed above.

[Setup, API, and deployment details](GUIDE.md)
