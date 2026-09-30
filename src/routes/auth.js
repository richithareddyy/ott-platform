const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { asyncHandler, HttpError, isDuplicateKey } = require('../utils/http');
const { validate } = require('../utils/validate');
const { signAccessToken, requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');

const router = express.Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: Number(process.env.AUTH_RATE_LIMIT) || 50 });

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = validate(req.body, {
      name: { type: 'string', required: true, minLength: 1, maxLength: 60 },
      email: { type: 'string', required: true, maxLength: 254, pattern: EMAIL },
      password: { type: 'string', required: true, minLength: 8, maxLength: 128 },
    });
    const passwordHash = await bcrypt.hash(body.password, 10);
    try {
      const user = await User.create({ name: body.name, email: body.email.toLowerCase(), passwordHash });
      res.status(201).json({ token: signAccessToken(user), user: user.toPublic() });
    } catch (err) {
      if (isDuplicateKey(err)) throw new HttpError(409, 'An account with this email already exists');
      throw err;
    }
  })
);

router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = validate(req.body, {
      email: { type: 'string', required: true, maxLength: 254 },
      password: { type: 'string', required: true, maxLength: 128 },
    });
    const user = await User.findOne({ email: body.email.toLowerCase() }).select('+passwordHash');
    const ok = user && (await bcrypt.compare(body.password, user.passwordHash));
    if (!ok) throw new HttpError(401, 'Incorrect email or password');
    res.json({ token: signAccessToken(user), user: user.toPublic() });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) throw new HttpError(401, 'Account no longer exists');
    res.json({ user: user.toPublic() });
  })
);

module.exports = router;
