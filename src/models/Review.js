const { Schema, model } = require('mongoose');

const reviewSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true }, // denormalized to avoid a join on read
    title: { type: Schema.Types.ObjectId, ref: 'Title', required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    body: { type: String, trim: true, maxlength: 2000, default: '' },
  },
  { timestamps: true }
);

reviewSchema.index({ user: 1, title: 1 }, { unique: true });
reviewSchema.index({ title: 1, createdAt: -1, _id: -1 });

module.exports = model('Review', reviewSchema);
