const config = require('./config');
const db = require('./db');
const { createApp } = require('./app');

// Common Atlas setup mistakes, so a failed deploy log says what to fix.
function dbHint(err) {
  if (err.name === 'MongoParseError') {
    return 'MONGO_URI is malformed. Remove any <db_password> placeholder and URL-encode special characters in the password.';
  }
  if (/bad auth|authentication failed/i.test(err.message)) return 'Check the database username and password in MONGO_URI.';
  if (/ENOTFOUND|querySrv/i.test(err.message)) return 'Check the cluster host in MONGO_URI.';
  if (/timed out|ECONNREFUSED/i.test(err.message)) return 'Check that Atlas Network Access allows this server.';
  return null;
}

async function main() {
  try {
    await db.connect();
  } catch (err) {
    const hint = dbHint(err);
    console.error(`Database connection failed: ${err.name}: ${err.message}`);
    if (hint) console.error(`Hint: ${hint}`);
    process.exit(1);
  }
  console.log('Connected to MongoDB');
  const server = createApp().listen(config.port, () => {
    console.log(`OTT platform listening on http://localhost:${config.port}`);
  });
  server.on('error', async (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${config.port} is already in use. Stop the other process or set PORT in .env.`);
    } else {
      console.error('Server error:', err);
    }
    await db.disconnect().catch(() => {});
    process.exit(1);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await db.disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
