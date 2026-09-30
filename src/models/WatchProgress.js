const { Schema, model } = require('mongoose');

const watchProgressSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: Schema.Types.ObjectId, ref: 'Title', required: true },
  positionSeconds: { type: Number, min: 0, required: true },
  durationSeconds: { type: Number, min: 0, default: 0 },
  completed: { type: Boolean, default: false },
  // Client-reported time of the heartbeat; used to drop out-of-order writes.
  reportedAt: { type: Date, required: true },
  updatedAt: { type: Date, default: Date.now },
});

watchProgressSchema.index({ user: 1, title: 1 }, { unique: true });
// "Continue watching": a user's unfinished titles, most recent first.
watchProgressSchema.index({ user: 1, completed: 1, updatedAt: -1 });

module.exports = model('WatchProgress', watchProgressSchema);
