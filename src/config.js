const path = require('path');

const env = process.env.NODE_ENV || 'development';

const config = {
  env,
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ott_platform',
  mongoPoolSize: Number(process.env.MONGO_POOL_SIZE) || 50,
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  streamTokenTtl: process.env.STREAM_TOKEN_TTL || '2h',
  mediaDir: path.resolve(process.env.MEDIA_DIR || path.join(__dirname, '..', 'media')),
};

if (env === 'production' && config.jwtSecret === 'dev-only-secret-change-me') {
  throw new Error('JWT_SECRET must be set in production');
}

module.exports = config;
