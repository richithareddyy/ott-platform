const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const Title = require('../models/Title');
const { asyncHandler, assertObjectId, HttpError } = require('../utils/http');
const { verify } = require('../middleware/auth');

const router = express.Router();

const MIME = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.m4v': 'video/mp4', '.mov': 'video/quicktime' };
const MAX_CHUNK = 2 * 1024 * 1024; // for open-ended ranges like "bytes=1000-"

function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let start;
  let end;
  if (m[1] === '') {
    // "bytes=-500" means the last 500 bytes
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? Math.min(start + MAX_CHUNK - 1, size - 1) : Math.min(Number(m[2]), size - 1);
  }
  if (start > end || start >= size) return null;
  return { start, end };
}

router.get(
  '/:titleId',
  asyncHandler(async (req, res) => {
    const titleId = assertObjectId(req.params.titleId, 'title id');
    const payload = verify(String(req.query.token || ''), 'stream');
    if (payload.tid !== titleId) throw new HttpError(403, 'Token is not valid for this title');

    const title = await Title.findById(titleId).select('videoFile').lean();
    if (!title || !title.videoFile) throw new HttpError(404, 'No video available for this title');

    // basename() keeps a crafted videoFile from escaping the media directory.
    const filePath = path.join(config.mediaDir, path.basename(title.videoFile));
    let stat;
    try {
      stat = await fs.promises.stat(filePath);
    } catch {
      throw new HttpError(404, 'Video file not found on server');
    }

    const size = stat.size;
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.set({
      'Accept-Ranges': 'bytes',
      'Content-Type': type,
      'Cache-Control': 'private, max-age=3600',
      'Last-Modified': stat.mtime.toUTCString(),
    });

    if (!req.headers.range) {
      res.set('Content-Length', String(size));
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(filePath).pipe(res);
    }

    const range = parseRange(req.headers.range, size);
    if (!range) {
      res.set('Content-Range', `bytes */${size}`);
      return res.status(416).end();
    }
    res.status(206).set({
      'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
      'Content-Length': String(range.end - range.start + 1),
    });
    if (req.method === 'HEAD') return res.end();
    const stream = fs.createReadStream(filePath, { start: range.start, end: range.end });
    stream.on('error', () => res.destroy());
    req.on('close', () => stream.destroy());
    stream.pipe(res);
  })
);

module.exports = router;
module.exports.parseRange = parseRange;
