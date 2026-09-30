const { isValidObjectId } = require('mongoose');

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Forwards rejected promises from async route handlers to the error middleware.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function assertObjectId(id, label = 'id') {
  if (!isValidObjectId(id)) throw new HttpError(400, `Invalid ${label}`);
  return id;
}

const isDuplicateKey = (err) => err && err.code === 11000;

module.exports = { HttpError, asyncHandler, assertObjectId, isDuplicateKey };
