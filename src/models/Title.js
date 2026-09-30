const { Schema, model } = require('mongoose');

const GENRES = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
  'Drama', 'Family', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller',
];
const MATURITY = ['G', 'PG', 'PG-13', 'R', 'TV-Y', 'TV-PG', 'TV-14', 'TV-MA'];

const titleSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, enum: ['movie', 'series'], required: true },
    synopsis: { type: String, required: true, maxlength: 1000 },
    genres: {
      type: [{ type: String, enum: GENRES }],
      validate: [(v) => v.length > 0 && v.length <= 4, 'A title needs 1-4 genres'],
    },
    releaseYear: { type: Number, min: 1900, max: 2100, required: true },
    maturityRating: { type: String, enum: MATURITY, required: true },
    durationMinutes: { type: Number, min: 1, max: 1000, required: true },
    cast: { type: [String], default: [] },
    videoFile: { type: String, default: '' },
    posterHue: { type: Number, min: 0, max: 359, default: 210 },
    featured: { type: Boolean, default: false },

    // Denormalized counters, updated with atomic operators so concurrent
    // reviews and plays never overwrite each other.
    viewCount: { type: Number, default: 0, min: 0 },
    ratingCount: { type: Number, default: 0, min: 0 },
    ratingSum: { type: Number, default: 0, min: 0 },
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
  },
  // __v doubles as the version for optimistic concurrency on admin edits.
  { timestamps: true }
);

// Catalog browse: filter by genre, sort by popularity / recency / rating.
// _id is the tie-breaker so keyset pagination is stable.
titleSchema.index({ genres: 1, viewCount: -1, _id: -1 });
titleSchema.index({ genres: 1, releaseYear: -1, _id: -1 });
titleSchema.index({ genres: 1, ratingAvg: -1, _id: -1 });
titleSchema.index({ viewCount: -1, _id: -1 });
titleSchema.index({ releaseYear: -1, _id: -1 });
titleSchema.index({ ratingAvg: -1, _id: -1 });
// Partial index: only the handful of featured titles are indexed.
titleSchema.index({ featured: 1, viewCount: -1 }, { partialFilterExpression: { featured: true } });
// Full-text search with weights favouring the title name.
titleSchema.index(
  { name: 'text', cast: 'text', synopsis: 'text' },
  { weights: { name: 10, cast: 4, synopsis: 1 }, name: 'title_text' }
);

// Fields returned for cards/rows; keeps list payloads small.
titleSchema.statics.CARD_FIELDS =
  'name type genres releaseYear maturityRating durationMinutes posterHue ratingAvg ratingCount viewCount';

module.exports = model('Title', titleSchema);
module.exports.GENRES = GENRES;
module.exports.MATURITY = MATURITY;
