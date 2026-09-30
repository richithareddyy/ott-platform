const fs = require('fs');
const os = require('os');
const path = require('path');

// Configure the environment before any app module reads it.
process.env.NODE_ENV = 'test';
process.env.AUTH_RATE_LIMIT = '100000';
process.env.MEDIA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ott-media-'));
process.env.MONGO_URI = process.env.MONGO_URI_TEST || 'mongodb://127.0.0.1:27017/ott_platform_test';

const request = require('supertest');
const bcrypt = require('bcryptjs');
const db = require('../src/db');
const { createApp } = require('../src/app');
const User = require('../src/models/User');
const Title = require('../src/models/Title');
const { signAccessToken } = require('../src/middleware/auth');

const app = createApp();
const api = () => request(app);
let counter = 0;

async function setup() {
  await db.connect(process.env.MONGO_URI);
  await db.mongoose.connection.dropDatabase();
  await Promise.all(Object.values(db.mongoose.models).map((m) => m.syncIndexes()));
}

async function teardown() {
  await db.mongoose.connection.dropDatabase();
  await db.disconnect();
}

async function reset() {
  await Promise.all(Object.values(db.mongoose.models).map((m) => m.deleteMany({})));
}

async function makeUser(role = 'user') {
  counter += 1;
  const user = await User.create({
    name: `${role}${counter}`,
    email: `${role}${counter}@example.test`,
    passwordHash: await bcrypt.hash('password123', 4),
    role,
  });
  return { user, token: signAccessToken(user), auth: { Authorization: `Bearer ${signAccessToken(user)}` } };
}

function makeTitle(overrides = {}) {
  counter += 1;
  return Title.create({
    name: `Test Title ${counter}`,
    type: 'movie',
    synopsis: 'A title used in automated tests.',
    genres: ['Drama'],
    releaseYear: 2020,
    maturityRating: 'PG',
    durationMinutes: 100,
    ...overrides,
  });
}

module.exports = { api, setup, teardown, reset, makeUser, makeTitle, mediaDir: process.env.MEDIA_DIR };
