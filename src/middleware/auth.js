const jwt = require('jsonwebtoken');
const config = require('../config');
const { HttpError } = require('../utils/http');

function signAccessToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role, name: user.name, scope: 'api' }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

// Short-lived token scoped to a single title, passed in the <video> src query
// string because media elements cannot send an Authorization header.
function signStreamToken(userId, titleId) {
  return jwt.sign({ sub: String(userId), tid: String(titleId), scope: 'stream' }, config.jwtSecret, {
    expiresIn: config.streamTokenTtl,
  });
}

function verify(token, scope) {
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (payload.scope !== scope) throw new Error('wrong scope');
    return payload;
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }
}

function readBearer(req) {
  const header = req.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

function requireAuth(req, _res, next) {
  const token = readBearer(req);
  if (!token) return next(new HttpError(401, 'Authentication required'));
  try {
    const p = verify(token, 'api');
    req.user = { id: p.sub, role: p.role, name: p.name };
    next();
  } catch (err) {
    next(err);
  }
}

function optionalAuth(req, _res, next) {
  const token = readBearer(req);
  if (token) {
    try {
      const p = verify(token, 'api');
      req.user = { id: p.sub, role: p.role, name: p.name };
    } catch {
      /* treat as anonymous */
    }
  }
  next();
}

function requireAdmin(req, _res, next) {
  if (!req.user || req.user.role !== 'admin') return next(new HttpError(403, 'Admin access required'));
  next();
}

module.exports = { signAccessToken, signStreamToken, verify, requireAuth, optionalAuth, requireAdmin };
