const { HttpError } = require('../utils/http');

/**
 * Fixed-window in-memory rate limiter keyed by client IP.
 * Suitable for a single instance; use a shared store (e.g. Redis) when scaling out.
 */
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, windowMs);
  timer.unref();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return next(new HttpError(429, 'Too many requests, please try again later'));
    }
    next();
  };
}

module.exports = { rateLimit };
