// Exercise the actual built Worker and asset handler without remote bindings,
// production secrets, Supabase credentials or production database writes.
import { unstable_dev } from 'wrangler';
import { randomBytes } from 'node:crypto';

let worker, failed = false;
try {
  const password = randomBytes(24).toString('hex');
  worker = await unstable_dev('dist/server/index.js', {
    config: 'dist/server/wrangler.json', local: true, port: 0, inspectorPort: 0,
    persist: false, logLevel: 'error',
    experimental: { disableExperimentalWarning: true, disableDevRegistry: true, watch: false },
    vars: {
      SITE_ACCESS_PASSWORD: password,
      SITE_ACCESS_SESSION_SECRET: randomBytes(32).toString('hex'),
      GRAIL_SERVER_SECRET: randomBytes(32).toString('hex'),
    },
  });
  process.env.ACCESS_TEST_URL = `http://${worker.address}:${worker.port}`;
  process.env.ACCESS_TEST_PASSWORD = password;
  process.env.ACCESS_TEST_PLATFORM = 'cloudflare';
  await import('./check-site-access.mjs');
} catch (error) { failed = true; console.error(error); }
finally {
  await worker?.stop();
  // Wrangler's optional background services otherwise keep a finished check
  // alive. All assertions and worker cleanup have completed at this point.
  process.exit(failed ? 1 : 0);
}
