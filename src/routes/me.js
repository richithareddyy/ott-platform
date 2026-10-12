const express = require('express');
const Title = require('../models/Title');
const WatchlistItem = require('../models/WatchlistItem');
const WatchProgress = require('../models/WatchProgress');
const { asyncHandler, assertObjectId, HttpError, isDuplicateKey } = require('../utils/http');
const { validate } = require('../utils/validate');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const COMPLETE_RATIO = 0.95;

async function assertTitleExists(id) {
  if (!(await Title.exists({ _id: id }))) throw new HttpError(404, 'Title not found');
}

router.get(
  '/watchlist',
  asyncHandler(async (req, res) => {
    const items = await WatchlistItem.find({ user: req.user.id })
      .sort({ addedAt: -1 })
      .limit(200)
      .populate({ path: 'title', select: Title.CARD_FIELDS, options: { lean: true } })
      .lean();
    res.json({ items: items.filter((i) => i.title).map((i) => ({ ...i.title, addedAt: i.addedAt })) });
  })
);

// Idempotent: $setOnInsert plus the unique (user, title) index means repeated
// or concurrent adds leave exactly one entry.
router.put(
  '/watchlist/:titleId',
  asyncHandler(async (req, res) => {
    const titleId = assertObjectId(req.params.titleId, 'title id');
    await assertTitleExists(titleId);
    let created = false;
    try {
      const r = await WatchlistItem.updateOne(
        { user: req.user.id, title: titleId },
        { $setOnInsert: { user: req.user.id, title: titleId, addedAt: new Date() } },
        { upsert: true }
      );
      created = r.upsertedCount === 1;
    } catch (err) {
      if (!isDuplicateKey(err)) throw err; // lost the insert race, so it's already there
    }
    res.status(created ? 201 : 200).json({ inWatchlist: true });
  })
);

router.delete(
  '/watchlist/:titleId',
  asyncHandler(async (req, res) => {
    const titleId = assertObjectId(req.params.titleId, 'title id');
    await WatchlistItem.deleteOne({ user: req.user.id, title: titleId });
    res.json({ inWatchlist: false });
  })
);

router.get(
  '/continue-watching',
  asyncHandler(async (req, res) => {
    const items = await WatchProgress.find({ user: req.user.id, completed: false })
      .sort({ updatedAt: -1 })
      .limit(20)
      .populate({ path: 'title', select: Title.CARD_FIELDS, options: { lean: true } })
      .lean();
    res.json({
      items: items
        .filter((p) => p.title)
        .map((p) => ({ ...p.title, positionSeconds: p.positionSeconds, durationSeconds: p.durationSeconds })),
    });
  })
);

// Player heartbeat. These can arrive out of order (retries, several tabs), so
// a write only applies if its reportedAt is newer than the stored one.
router.put(
  '/progress/:titleId',
  asyncHandler(async (req, res) => {
    const titleId = assertObjectId(req.params.titleId, 'title id');
    const body = validate(req.body, {
      positionSeconds: { type: 'number', required: true, min: 0, max: 60 * 60 * 24 },
      durationSeconds: { type: 'number', min: 0, max: 60 * 60 * 24, default: 0 },
      reportedAt: { type: 'number', integer: true, min: 0 },
    });
    const now = Date.now();
    const reportedAt = new Date(Math.min(body.reportedAt ?? now, now + 60 * 1000));
    const completed = body.durationSeconds > 0 && body.positionSeconds / body.durationSeconds >= COMPLETE_RATIO;
    await assertTitleExists(titleId);

    const filter = { user: req.user.id, title: titleId, reportedAt: { $lt: reportedAt } };
    const update = {
      $set: {
        positionSeconds: body.positionSeconds,
        durationSeconds: body.durationSeconds,
        completed,
        reportedAt,
        updatedAt: new Date(),
      },
    };

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const r = await WatchProgress.updateOne(filter, update, { upsert: true });
        if (r.upsertedCount === 1) {
          // First play by this user, so count a view.
          await Title.updateOne({ _id: titleId }, { $inc: { viewCount: 1 } });
        }
        return res.json({ applied: true, completed });
      } catch (err) {
        if (!isDuplicateKey(err)) throw err;
        // The doc exists but didn't match: either this heartbeat is stale or a
        // concurrent first write just created it. One retry tells them apart.
      }
    }
    res.json({ applied: false, stale: true });
  })
);

router.delete(
  '/progress/:titleId',
  asyncHandler(async (req, res) => {
    const titleId = assertObjectId(req.params.titleId, 'title id');
    await WatchProgress.deleteOne({ user: req.user.id, title: titleId });
    res.status(204).end();
  })
);

module.exports = router;
