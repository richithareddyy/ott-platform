const config = require('./config');
const db = require('./db');
const { createApp } = require('./app');

function explainDbError(err) {
  const msg = String(err && err.message);
  if (err && err.name === 'MongoParseError') {
    return 'MONGO_URI is not a valid connection string. Check for leftover <db_password> brackets, and URL-encode special characters in the password (@ : / ? # %).';
  }
  if (/bad auth|authentication failed/i.test(msg)) {
    return 'Database rejected the username or password in MONGO_URI.';
  }
  if (/ENOTFOUND|querySrv/i.test(msg)) {
    return 'Could not find the database host in MONGO_URI. Check the cluster address.';
  }
  if (/Server selection timed out|ECONNREFUSED|whitelist|IP/i.test(msg)) {
    return 'Could not reach the database. Check the Atlas Network Access list allows this server (0.0.0.0/0).';
  }
  return null;
}

async function main() {
  try {
    await db.connect();
  } catch (err) {
    const hint = explainDbError(err);
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
