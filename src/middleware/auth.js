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

function userFromToken(token) {
  const p = verify(token, 'api');
  return { id: p.sub, role: p.role, name: p.name };
}

function requireAuth(req, _res, next) {
  const token = readBearer(req);
  if (!token) return next(new HttpError(401, 'Authentication required'));
  try {
    req.user = userFromToken(token);
    next();
  } catch (err) {
    next(err);
  }
}

// A bad or expired token is treated as anonymous rather than an error.
function optionalAuth(req, _res, next) {
  const token = readBearer(req);
  if (token) {
    try {
      req.user = userFromToken(token);
    } catch {}
  }
  next();
}

// Tokens outlive deleted accounts, so routes that write per-user data confirm
// the account still exists before saving anything for it.
async function requireAccount(req, _res, next) {
  try {
    if (!(await User.exists({ _id: req.user.id }))) return next(new HttpError(401, 'This account no longer exists'));
    next();
  } catch (err) {
    next(err);
  }
}

function requireAdmin(req, _res, next) {
  if (!req.user || req.user.role !== 'admin') return next(new HttpError(403, 'Admin access required'));
  next();
}

module.exports = { signAccessToken, signStreamToken, verify, requireAuth, requireAccount, optionalAuth, requireAdmin };
