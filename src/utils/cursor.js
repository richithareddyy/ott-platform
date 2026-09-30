const { Types } = require('mongoose');
const { HttpError } = require('./http');

// Opaque keyset-pagination cursor: the sort value and _id of the last item.
function encodeCursor(doc, field) {
  return Buffer.from(JSON.stringify({ v: doc[field], id: String(doc._id) })).toString('base64url');
}

function decodeCursor(cursor) {
  try {
    const { v, id } = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (typeof v !== 'number' || !Types.ObjectId.isValid(id)) throw new Error();
    return { v, id: new Types.ObjectId(id) };
  } catch {
    throw new HttpError(400, 'Invalid cursor');
  }
}

// Filter for "items after the cursor" when sorting { field: -1, _id: -1 }.
function afterCursor(field, { v, id }) {
  return { $or: [{ [field]: { $lt: v } }, { [field]: v, _id: { $lt: id } }] };
}

module.exports = { encodeCursor, decodeCursor, afterCursor };
