const Title = require('../models/Title');

// Pipeline update so ratingAvg is recomputed from the new sum/count in the same
// write. Callers run it in the same transaction as the review change it
// reflects, so the review and the aggregate commit or roll back together.
function applyRatingDelta(titleId, countDelta, sumDelta, session) {
  return Title.updateOne({ _id: titleId }, [
    {
      $set: {
        ratingCount: { $max: [0, { $add: ['$ratingCount', countDelta] }] },
        ratingSum: { $max: [0, { $add: ['$ratingSum', sumDelta] }] },
      },
    },
    {
      $set: {
        ratingAvg: {
          $cond: [
            { $gt: ['$ratingCount', 0] },
            { $round: [{ $divide: ['$ratingSum', '$ratingCount'] }, 2] },
            0,
          ],
        },
      },
    },
  ], { session });
}

module.exports = { applyRatingDelta };
