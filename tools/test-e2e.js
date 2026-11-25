/**
 * End-to-end test of the login flow against the mock portal
 * (no access to the real site needed).
 *
 * Run: npm run test:e2e
 *
 * Verifies:
 *  1) fresh login works and retries after a forced wrong-captcha alert
 *  2) the second run reuses the saved session (cookies) — no login needed
 *  3) --fresh login works again afterwards
 */
const assert = require('assert');
const fs = require('fs');
const { startMockPortal } = require('./mock-portal');

(async () => {
  const { server, port } = await startMockPortal({ failFirstLogin: true });

  // Configure the app through env, exactly like a real .env run
  process.env.BASE_URL = `http://127.0.0.1:${port}/panel/`;
  process.env.PISHGAMAN_USERNAME = 'testuser';
  process.env.PISHGAMAN_PASSWORD = 'testpass';
  process.env.HEADLESS = 'true';
  process.env.DEBUG = '0';
  process.env.MAX_LOGIN_RETRIES = '5';
  process.env.SESSION_FILE = 'sessions/test-session.json';

  if (fs.existsSync('sessions/test-session.json')) {
    fs.unlinkSync('sessions/test-session.json');
  }

  // NOTE: src modules are required AFTER the env vars are set on purpose,
  // because src/config.js reads process.env at load time.
  const { launchBrowser } = require('../src/browser');
  const { runLogin } = require('../src/login');
  const logger = require('../src/logger');

  const { browser, page } = await launchBrowser();
  let failed = false;
  try {
    // 1) fresh login — the mock forces the first captcha submission to fail,
    //    so a retry must happen and succeed.
    const r1 = await runLogin(page, { forceNew: true });
    assert.strictEqual(r1.ok, true, 'fresh login should succeed');
    assert.strictEqual(r1.via, 'fresh-login', 'first run must use fresh-login');
    assert.ok(
      r1.attempts >= 2,
      `expected retry after forced captcha failure, got attempts=${r1.attempts}`
    );
    logger.info(`TEST 1 PASS — fresh login after ${r1.attempts} attempts (retry logic verified)`);

    // 2) second run must reuse the saved session
    const r2 = await runLogin(page, { forceNew: false });
    assert.strictEqual(r2.ok, true, 'saved-session run should succeed');
    assert.strictEqual(r2.via, 'saved-session', 'second run must use the saved session');
    logger.info('TEST 2 PASS — saved session reused, no login needed');

    // 3) forced fresh login still works afterwards
    const r3 = await runLogin(page, { forceNew: true });
    assert.strictEqual(r3.ok, true, 'second fresh login should succeed');
    logger.info('TEST 3 PASS — --fresh login works again');

    console.log('\nALL E2E TESTS PASSED');
  } catch (err) {
    failed = true;
    console.error('\nE2E TEST FAILED:', err.message);
  } finally {
    await browser.close().catch(() => {});
    server.close();
  }
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
