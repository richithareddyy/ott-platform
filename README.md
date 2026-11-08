# Kinoloft

You pause a video, open another tab, and come back later expecting your place to be saved. Kinoloft is a video-streaming demo with catalog search, watchlists, playback progress, reviews, and an admin page. Much of the work is in keeping that state consistent when requests arrive twice, out of order, or at the same time.

The backend is Node.js, Express, and MongoDB. The frontend is vanilla JavaScript with a hash router. The catalog is nine Creative Commons open movies by the Blender Foundation and Blender Studio, played through YouTube's embedded player; see [Credits and licenses](#credits-and-licenses).

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

**Seeding resets the target database.** Use it only for a disposable demo database. It loads the films from `scripts/catalog.json` with empty ratings, reviews, and view counts. Titles without a YouTube video can still play local `.mp4` or `.webm` files from `media/`.

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

The integration suite uses a separate `_test` database; concurrency checks use `_load`.

**27 integration tests** cover authentication, server-side admin authorization (anonymous, viewer, guest, and forged-token requests on every catalog-changing route), duplicate writes under concurrency, exact rating totals, stale playback updates, conflicting admin edits, byte-range streaming, account deletion, search, and the catalog migration.

**Load test, run 7 November 2026.** One Node.js 24 process and MongoDB 7.0 in Docker on an Apple M5 laptop (10 cores); 200 users, 100 concurrent clients, 20 seconds, writes concentrated on 10 titles:

| Operation | Requests | p50 ms | p95 ms | p99 ms |
|---|---:|---:|---:|---:|
| Browse catalog | 10,341 | 27.0 | 37.8 | 55.2 |
| Home rows | 5,291 | 25.4 | 37.7 | 61.4 |
| Title detail | 7,936 | 27.1 | 38.4 | 58.1 |
| Search | 4,283 | 27.1 | 39.1 | 61.4 |
| Playback heartbeat (write) | 15,507 | 44.9 | 67.2 | 97.8 |
| Add to list (write) | 4,723 | 44.5 | 61.4 | 95.1 |
| Review (write) | 4,192 | 54.1 | 75.0 | 114.0 |

52,273 requests in 20.0 s (about 2,600 requests per second) with 0 errors. The audit afterwards found 0 duplicate list entries, progress records, or reviews, and 0 titles with wrong rating sums or view counts. Writes cost an extra lookup because they confirm the account still exists (so a token from a deleted account can't write); that check is the main reason write latency is higher than reads. These are local numbers; the free hosted instance is slower and sleeps when idle.

## Credits and licenses

Kinoloft is a portfolio project, not a commercial streaming service, and is not affiliated with the Blender Foundation, Blender Studio, YouTube, or Google.

- **Films:** open movies by the Blender Foundation and Blender Studio, embedded unchanged from Blender's official YouTube channels and used under their Creative Commons licenses (CC BY 2.5, 3.0, and 4.0; Cosmos Laundromat is CC BY-SA 3.0). Each film's creator, license, and source are listed in `scripts/catalog.json`, on its title page, and on the in-app Credits page. Artwork is a frame from each film served by YouTube; synopses are written for this project.
- **YouTube:** playback and thumbnails use YouTube API Services, subject to the [YouTube Terms of Service](https://www.youtube.com/t/terms) and the [Google Privacy Policy](https://policies.google.com/privacy).
- **Fonts:** [Inter](https://rsms.me/inter/) by Rasmus Andersson, Fraunces by Undercase Type, and IBM Plex Mono by IBM, all SIL Open Font License 1.1, loaded from Google Fonts.
- **Packages:** Express, Mongoose, jsonwebtoken, bcrypt.js, and Supertest are MIT-licensed; their notices ship with each package.

The app includes Terms, Privacy, Credits, and Copyright pages (footer links), and signed-in users can delete their account and data from the Account page.

The code in this repository has no open-source license; all rights are reserved by the author.

[Setup, API, and deployment details](GUIDE.md)
