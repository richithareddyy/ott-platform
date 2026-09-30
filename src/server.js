const config = require('./config');
const db = require('./db');
const { createApp } = require('./app');

async function main() {
  await db.connect();
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
