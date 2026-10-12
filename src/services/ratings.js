const Title = require('../models/Title');

// Pipeline update so ratingAvg is recomputed from the new sum/count in the same
// atomic write; concurrent reviews can't leave the average stale.
function applyRatingDelta(titleId, countDelta, sumDelta) {
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
  ]);
}

module.exports = { applyRatingDelta };
