/**
 * Verifies that MONGO_URI can connect and authenticate, without printing it.
 *   MONGO_URI="..." node scripts/check-db.js
 */
const mongoose = require('mongoose');

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is not set.');
    process.exit(1);
  }
  if (/<|>/.test(uri)) console.warn('Warning: the string still contains < or > characters (placeholder brackets?).');

  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    console.error('MONGO_URI is not a valid URL. Special characters in the password (@ : / ? # %) must be URL-encoded.');
    process.exit(1);
  }
  console.log(`Host:     ${parsed.host}`);
  console.log(`User:     ${decodeURIComponent(parsed.username) || '(none)'}`);
  console.log(`Database: ${parsed.pathname.slice(1) || '(none — add /ott_platform before the ?)'}`);

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    await mongoose.connection.db.admin().ping();
    console.log('\nSuccess: connected and authenticated.');
    await mongoose.disconnect();
  } catch (err) {
    const msg = String(err.message);
    console.error(`\nFailed: ${msg}`);
    if (/bad auth|authentication failed/i.test(msg)) {
      console.error('Hint: the username or password is wrong. Use the Database Access user (not your Atlas login) and its current password.');
    } else if (/ENOTFOUND|querySrv/i.test(msg)) {
      console.error('Hint: the cluster host name is wrong.');
    } else if (/timed out|ECONNREFUSED/i.test(msg)) {
      console.error('Hint: network access blocked. Check the Atlas IP Access List.');
    }
    process.exit(1);
  }
}

main();
