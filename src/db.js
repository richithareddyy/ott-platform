const mongoose = require('mongoose');
const config = require('./config');

mongoose.set('strictQuery', true);

async function connect(uri = config.mongoUri) {
  await mongoose.connect(uri, {
    maxPoolSize: config.mongoPoolSize,
    minPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
    // Indexes are synced explicitly at startup (see syncIndexes), so a changed
    // index definition replaces the old one instead of conflicting with it.
    autoIndex: false,
  });
  return mongoose.connection;
}

async function syncIndexes() {
  for (const model of Object.values(mongoose.models)) await model.syncIndexes();
}

async function disconnect() {
  await mongoose.disconnect();
}

module.exports = { connect, disconnect, syncIndexes, mongoose };
