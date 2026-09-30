const mongoose = require('mongoose');
const config = require('./config');

mongoose.set('strictQuery', true);

async function connect(uri = config.mongoUri) {
  await mongoose.connect(uri, {
    maxPoolSize: config.mongoPoolSize,
    minPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
    // Ensure declared indexes exist on startup (a no-op once they are built).
    autoIndex: true,
  });
  return mongoose.connection;
}

async function disconnect() {
  await mongoose.disconnect();
}

module.exports = { connect, disconnect, mongoose };
