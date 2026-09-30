const Title = require('../models/Title');

/**
 * Applies a change to a title's rating aggregates in a single atomic update.
 * The aggregation-pipeline form lets ratingAvg be recomputed from the *new*
 * sum/count inside the same write, so concurrent reviews never leave the
 * average out of sync with its inputs.
 */
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
