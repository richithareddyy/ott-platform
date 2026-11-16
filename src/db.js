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
  // Rating writes rely on multi-document transactions, which need a replica set
  // (every Atlas cluster is one; docker compose runs a single-node set).
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName) {
    await mongoose.disconnect();
    throw new Error('MongoDB is running standalone. Kinoloft needs a replica set for transactions; use `docker compose up -d` or a MongoDB Atlas cluster.');
  }
  return mongoose.connection;
}

// Runs fn(session) in a transaction. The driver retries the whole callback on
// transient errors such as write conflicts between concurrent transactions,
// so fn must do all of its reads and writes through the session.
function withTransaction(fn) {
  return mongoose.connection.transaction(fn);
}

async function syncIndexes() {
  for (const model of Object.values(mongoose.models)) await model.syncIndexes();
}

async function disconnect() {
  await mongoose.disconnect();
}

module.exports = { connect, disconnect, syncIndexes, withTransaction, mongoose };
