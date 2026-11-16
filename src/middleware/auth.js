const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const { HttpError } = require('../utils/http');

function signAccessToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role, name: user.name, scope: 'api' }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

// Scoped to one title and passed in the <video> src query string, since media
// elements can't send an Authorization header.
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

// Revocation policy: a token only proves who signed in. On every request the
// account is loaded again, so a deleted account is rejected immediately and the
// role in the database, not the role in the token, decides what is allowed.
// A demoted admin therefore loses admin access on their next request.
async function userFromToken(token) {
  const p = verify(token, 'api');
  const user = await User.findById(p.sub).select('name role').lean();
  if (!user) throw new HttpError(401, 'This account no longer exists');
  return { id: String(user._id), role: user.role, name: user.name };
}

async function requireAuth(req, _res, next) {
  const token = readBearer(req);
  if (!token) return next(new HttpError(401, 'Authentication required'));
  try {
    req.user = await userFromToken(token);
    next();
  } catch (err) {
    next(err);
  }
}

// A bad or expired token, or one for a deleted account, is treated as anonymous.
async function optionalAuth(req, _res, next) {
  const token = readBearer(req);
  if (token) {
    try {
      req.user = await userFromToken(token);
    } catch (err) {
      if (!(err instanceof HttpError)) return next(err); // a database failure is not "anonymous"
    }
  }
  next();
}

function requireAdmin(req, _res, next) {
  if (!req.user || req.user.role !== 'admin') return next(new HttpError(403, 'Admin access required'));
  next();
}

module.exports = { signAccessToken, signStreamToken, verify, requireAuth, optionalAuth, requireAdmin };
