# StreamBox

You pause a video, open another tab, and come back later expecting your place to be saved. StreamBox is a video-streaming demo with catalog search, watchlists, playback progress, reviews, and an admin page. Much of the work is in keeping that state consistent when requests arrive twice, out of order, or at the same time.

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

## Credits and licenses

StreamBox is a portfolio project, not a commercial streaming service, and is not affiliated with the Blender Foundation, Blender Studio, YouTube, or Google.

- **Films:** open movies by the Blender Foundation and Blender Studio, embedded unchanged from Blender's official YouTube channels and used under their Creative Commons licenses (CC BY 2.5, 3.0, and 4.0; Cosmos Laundromat is CC BY-SA 3.0). Each film's creator, license, and source are listed in `scripts/catalog.json`, on its title page, and on the in-app Credits page. Artwork is a frame from each film served by YouTube; synopses are written for this project.
- **YouTube:** playback and thumbnails use YouTube API Services, subject to the [YouTube Terms of Service](https://www.youtube.com/t/terms) and the [Google Privacy Policy](https://policies.google.com/privacy).
- **Font:** [Inter](https://rsms.me/inter/) by Rasmus Andersson, SIL Open Font License 1.1, loaded from Google Fonts.
- **Packages:** Express, Mongoose, jsonwebtoken, bcrypt.js, and Supertest are MIT-licensed; their notices ship with each package.

The app includes Terms, Privacy, Credits, and Copyright pages (footer links), and signed-in users can delete their account and data from the Account page.

The code in this repository has no open-source license; all rights are reserved by the author.

[Setup, API, and deployment details](GUIDE.md)
