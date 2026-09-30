const { Schema, model } = require('mongoose');

// Stored as its own collection rather than an array on User: no unbounded
// document growth, and adds/removes from different devices never contend on
// the same user document.
const watchlistItemSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: Schema.Types.ObjectId, ref: 'Title', required: true },
  },
  { timestamps: { createdAt: 'addedAt', updatedAt: false } }
);

// One entry per user/title; also serves the "my list, newest first" query.
watchlistItemSchema.index({ user: 1, title: 1 }, { unique: true });
watchlistItemSchema.index({ user: 1, addedAt: -1 });

module.exports = model('WatchlistItem', watchlistItemSchema);
