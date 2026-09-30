const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const { notFound, errorHandler } = require('./middleware/errors');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin',
    });
    next();
  });
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', async (_req, res) => {
    const up = mongoose.connection.readyState === 1;
    res.status(up ? 200 : 503).json({ status: up ? 'ok' : 'degraded', db: up ? 'connected' : 'disconnected' });
  });

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/titles', require('./routes/titles'));
  app.use('/api/me', require('./routes/me'));
  app.use('/api/stream', require('./routes/stream'));
  app.use('/api', notFound);

  const publicDir = path.join(__dirname, '..', 'public');
  app.use(express.static(publicDir, { maxAge: '1h' }));
  app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
