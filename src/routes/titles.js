const express = require('express');
const Title = require('../models/Title');
const Review = require('../models/Review');
const WatchlistItem = require('../models/WatchlistItem');
const WatchProgress = require('../models/WatchProgress');
const { GENRES, MATURITY } = Title;
const { asyncHandler, assertObjectId, HttpError } = require('../utils/http');
const { validate } = require('../utils/validate');
const { encodeCursor, decodeCursor, afterCursor } = require('../utils/cursor');
const { optionalAuth, requireAuth, requireAdmin, signStreamToken } = require('../middleware/auth');
const { applyRatingDelta } = require('../services/ratings');
const { isDuplicateKey } = require('../utils/http');

const router = express.Router();

const SORTS = { popular: 'viewCount', newest: 'releaseYear', top: 'ratingAvg' };

const titleRules = {
  name: { type: 'string', required: true, maxLength: 120 },
  type: { type: 'string', required: true, enum: ['movie', 'series'] },
  synopsis: { type: 'string', required: true, maxLength: 1000 },
  genres: { type: 'stringArray', required: true, minItems: 1, maxItems: 4, enum: GENRES },
  releaseYear: { type: 'number', required: true, integer: true, min: 1900, max: 2100 },
  maturityRating: { type: 'string', required: true, enum: MATURITY },
  durationMinutes: { type: 'number', required: true, integer: true, min: 1, max: 1000 },
  cast: { type: 'stringArray', maxItems: 20 },
  videoFile: { type: 'string', maxLength: 200, pattern: /^[\w.-]*$/ },
  posterHue: { type: 'number', integer: true, min: 0, max: 359 },
  featured: { type: 'boolean' },
};

// Home-page rows change slowly but are requested on every visit, so they are
// cached briefly in memory to absorb bursts of traffic.
let rowsCache = { at: 0, data: null };
const ROWS_TTL_MS = process.env.NODE_ENV === 'test' ? -1 : 30 * 1000;
const invalidateRows = () => { rowsCache = { at: 0, data: null }; };

router.get('/genres', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=3600').json({ genres: GENRES, maturityRatings: MATURITY });
});

router.get(
  '/rows',
  asyncHandler(async (_req, res) => {
    if (!rowsCache.data || Date.now() - rowsCache.at > ROWS_TTL_MS) {
      const cardProjection = Object.fromEntries(Title.CARD_FIELDS.split(' ').map((f) => [f, `$${f}`]));
      const [featured, byGenre] = await Promise.all([
        Title.find({ featured: true }).sort({ viewCount: -1 }).limit(5)
          .select(`${Title.CARD_FIELDS} synopsis`).lean(),
        Title.aggregate([
          { $unwind: '$genres' },
          {
            $group: {
              _id: '$genres',
              // $topN keeps only 12 per group in memory instead of pushing everything.
              titles: { $topN: { n: 12, sortBy: { viewCount: -1, _id: -1 }, output: { _id: '$_id', ...cardProjection } } },
            },
          },
          { $sort: { _id: 1 } },
        ]),
      ]);
      rowsCache = {
        at: Date.now(),
        data: { featured, rows: byGenre.map((g) => ({ genre: g._id, titles: g.titles })) },
      };
    }
    res.json(rowsCache.data);
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = validate(req.query, {
      genre: { type: 'string', enum: GENRES },
      type: { type: 'string', enum: ['movie', 'series'] },
      sort: { type: 'string', enum: Object.keys(SORTS), default: 'popular' },
      limit: { type: 'number', integer: true, min: 1, max: 50, default: 24 },
      cursor: { type: 'string', maxLength: 200 },
    });
    const field = SORTS[q.sort];
    const filter = {};
    if (q.genre) filter.genres = q.genre;
    if (q.type) filter.type = q.type;
    if (q.cursor) Object.assign(filter, afterCursor(field, decodeCursor(q.cursor)));

    // Keyset pagination: cost stays constant however deep the client scrolls,
    // unlike skip/limit which scans and discards every earlier document.
    const items = await Title.find(filter)
      .sort({ [field]: -1, _id: -1 })
      .limit(q.limit + 1)
      .select(Title.CARD_FIELDS)
      .lean();
    const hasMore = items.length > q.limit;
    if (hasMore) items.pop();
    res.json({ items, nextCursor: hasMore ? encodeCursor(items[items.length - 1], field) : null });
  })
);

router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const q = validate(req.query, {
      q: { type: 'string', required: true, minLength: 1, maxLength: 100 },
      page: { type: 'number', integer: true, min: 1, max: 50, default: 1 },
      limit: { type: 'number', integer: true, min: 1, max: 50, default: 24 },
    });
    const filter = { $text: { $search: q.q } };
    const [items, total] = await Promise.all([
      Title.find(filter, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' }, viewCount: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .select(Title.CARD_FIELDS)
        .lean(),
      Title.countDocuments(filter),
    ]);
    res.json({ items, total, page: q.page, pages: Math.ceil(total / q.limit) });
  })
);

router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const id = assertObjectId(req.params.id, 'title id');
    const [title, inWatchlist, progress, myReview] = await Promise.all([
      Title.findById(id).lean(),
      req.user ? WatchlistItem.exists({ user: req.user.id, title: id }) : null,
      req.user ? WatchProgress.findOne({ user: req.user.id, title: id }).select('positionSeconds durationSeconds completed').lean() : null,
      req.user ? Review.findOne({ user: req.user.id, title: id }).select('rating body').lean() : null,
    ]);
    if (!title) throw new HttpError(404, 'Title not found');
    const { __v: version, ...rest } = title;
    res.json({
      title: { ...rest, version, hasVideo: Boolean(title.videoFile) },
      viewer: req.user ? { inWatchlist: Boolean(inWatchlist), progress, myReview } : null,
    });
  })
);

router.post(
  '/:id/play',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = assertObjectId(req.params.id, 'title id');
    const [title, progress] = await Promise.all([
      Title.findById(id).select('name videoFile durationMinutes').lean(),
      WatchProgress.findOne({ user: req.user.id, title: id }).select('positionSeconds completed').lean(),
    ]);
    if (!title) throw new HttpError(404, 'Title not found');
    const token = signStreamToken(req.user.id, id);
    res.json({
      streamUrl: title.videoFile ? `/api/stream/${id}?token=${encodeURIComponent(token)}` : null,
      resumeAt: progress && !progress.completed ? progress.positionSeconds : 0,
    });
  })
);

/* ----------------------------- Reviews ----------------------------- */

router.get(
  '/:id/reviews',
  asyncHandler(async (req, res) => {
    const id = assertObjectId(req.params.id, 'title id');
    const q = validate(req.query, {
      limit: { type: 'number', integer: true, min: 1, max: 50, default: 10 },
      before: { type: 'string', maxLength: 30 },
    });
    const filter = { title: id };
    if (q.before) filter._id = { $lt: assertObjectId(q.before, 'cursor') };
    const items = await Review.find(filter)
      .sort({ _id: -1 })
      .limit(q.limit + 1)
      .select('userName rating body createdAt')
      .lean();
    const hasMore = items.length > q.limit;
    if (hasMore) items.pop();
    res.json({ items, nextCursor: hasMore ? String(items[items.length - 1]._id) : null });
  })
);

// Create or replace the current user's review. findOneAndUpdate returns the
// previous document atomically, so the aggregate delta is always exact even
// if the same user submits from two devices at once.
router.put(
  '/:id/reviews/mine',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = assertObjectId(req.params.id, 'title id');
    const body = validate(req.body, {
      rating: { type: 'number', required: true, integer: true, min: 1, max: 5 },
      body: { type: 'string', maxLength: 2000, default: '' },
    });
    if (!(await Title.exists({ _id: id }))) throw new HttpError(404, 'Title not found');

    let previous;
    for (let attempt = 0; ; attempt += 1) {
      try {
        previous = await Review.findOneAndUpdate(
          { user: req.user.id, title: id },
          { $set: { rating: body.rating, body: body.body, userName: req.user.name } },
          { upsert: true, new: false, runValidators: true, setDefaultsOnInsert: true }
        ).lean();
        break;
      } catch (err) {
        // Two first-time upserts raced; the loser retries as an update.
        if (isDuplicateKey(err) && attempt === 0) continue;
        throw err;
      }
    }

    if (previous) await applyRatingDelta(id, 0, body.rating - previous.rating);
    else await applyRatingDelta(id, 1, body.rating);
    invalidateRows();
    res.status(previous ? 200 : 201).json({ review: { rating: body.rating, body: body.body } });
  })
);

router.delete(
  '/:id/reviews/mine',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = assertObjectId(req.params.id, 'title id');
    const removed = await Review.findOneAndDelete({ user: req.user.id, title: id }).lean();
    if (!removed) throw new HttpError(404, 'You have not reviewed this title');
    await applyRatingDelta(id, -1, -removed.rating);
    res.status(204).end();
  })
);

/* ------------------------------ Admin ------------------------------ */

router.post(
  '/',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = validate(req.body, titleRules);
    const title = await Title.create(data);
    invalidateRows();
    res.status(201).json({ title: { ...title.toObject(), version: title.__v } });
  })
);

// Optimistic concurrency: the client must send the version it last read.
// If another admin saved in between, the filter misses and we return 409
// instead of silently overwriting their changes.
router.patch(
  '/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = assertObjectId(req.params.id, 'title id');
    const { version } = validate(req.body, { version: { type: 'number', required: true, integer: true, min: 0 } });
    const changes = validate(req.body, titleRules, { partial: true });
    if (!Object.keys(changes).length) throw new HttpError(400, 'No changes supplied');

    const updated = await Title.findOneAndUpdate(
      { _id: id, __v: version },
      { $set: changes, $inc: { __v: 1 } },
      { new: true, runValidators: true }
    ).lean();
    if (!updated) {
      const exists = await Title.exists({ _id: id });
      if (!exists) throw new HttpError(404, 'Title not found');
      throw new HttpError(409, 'This title was modified by someone else. Reload and try again.');
    }
    invalidateRows();
    const { __v, ...rest } = updated;
    res.json({ title: { ...rest, version: __v } });
  })
);

router.delete(
  '/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = assertObjectId(req.params.id, 'title id');
    const removed = await Title.findByIdAndDelete(id).lean();
    if (!removed) throw new HttpError(404, 'Title not found');
    await Promise.all([
      Review.deleteMany({ title: id }),
      WatchlistItem.deleteMany({ title: id }),
      WatchProgress.deleteMany({ title: id }),
    ]);
    invalidateRows();
    res.status(204).end();
  })
);

module.exports = router;
