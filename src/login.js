const config = require('./config');
const session = require('./session');
const captchaReader = require('./captcha');
const { queryFirst, waitForFirst, isVisible } = require('./dom');
const logger = require('./logger');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function openPanel(page) {
  await page.goto(config.baseUrl, {
    waitUntil: 'domcontentloaded',
    timeout: config.navTimeoutMs,
  });
}

/**
 * Heuristic: we are logged in when the page has real content
 * and the login username field is gone/hidden.
 */
async function isLoggedIn(page) {
  try {
    const hasBody = await page.evaluate(
      () => !!document.body && document.body.innerText.trim().length > 0
    );
    if (!hasBody) return false;
    const userEl = await queryFirst(page, config.selectors.username);
    if (!userEl) return true;
    return !(await isVisible(userEl));
  } catch {
    // page is navigating or the execution context was destroyed
    return false;
  }
}

async function fillField(page, el, value) {
  await el.evaluate((e) => {
    e.focus();
    e.value = '';
  });
  await page.keyboard.type(value, { delay: 35 });
  await el.evaluate((e) => {
    e.dispatchEvent(new Event('input', { bubbles: true }));
    e.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

/**
 * One full login attempt: fill credentials, solve captcha, submit,
 * then wait and check whether the login succeeded.
 */
async function tryLoginOnce(page) {
  let dialogMsg = null;
  const onDialog = async (dialog) => {
    dialogMsg = dialog.message();
    logger.warn(`Browser dialog: ${dialogMsg}`);
    await dialog.dismiss().catch(() => {});
  };
  page.on('dialog', onDialog);

  try {
    const userEl = await waitForFirst(page, config.selectors.username, { timeout: 15000 });
    if (!userEl) throw new Error('username input not found on the login page');
    await fillField(page, userEl, config.username);

    const passEl = await waitForFirst(page, config.selectors.password, { timeout: 8000 });
    if (!passEl) throw new Error('password input not found on the login page');
    await fillField(page, passEl, config.password);

    const cap = await captchaReader.readCaptcha(page);
    logger.info(
      `Captcha OCR -> "${cap.text}" (len=${cap.length}, conf=${cap.confidence ?? '?'}, src=${cap.source})`
    );
    if (!cap.ok) {
      return { ok: false, reason: `OCR result not usable ("${cap.text}")` };
    }

    const capEl = await waitForFirst(page, config.selectors.captchaInput, { timeout: 8000 });
    if (!capEl) throw new Error('captcha input not found on the login page');
    await fillField(page, capEl, cap.text);

    const submitBtn = await waitForFirst(page, config.selectors.submit, { timeout: 8000 });
    if (!submitBtn) throw new Error('submit button not found on the login page');
    await submitBtn.click();

    const deadline = Date.now() + config.loginDetectMs;
    while (Date.now() < deadline) {
      await sleep(700);
      if (dialogMsg) return { ok: false, reason: `dialog: ${dialogMsg}` };
      if (await isLoggedIn(page)) return { ok: true };
    }
    return { ok: false, reason: 'login form is still visible after submit' };
  } finally {
    page.off('dialog', onDialog);
  }
}

/**
 * Full login flow:
 *  1) open the panel; if a saved session exists, try it first
 *  2) otherwise retry the fresh-login flow up to MAX_LOGIN_RETRIES times
 *  3) on success, persist cookies + storage to the session file
 */
async function runLogin(page, { forceNew = false } = {}) {
  // --fresh: drop every cookie first so the login page really renders,
  // even if the browser context still holds a valid session.
  if (forceNew) {
    await session.clearBrowserCookies(page);
  }

  await openPanel(page);

  if (!forceNew) {
    const saved = session.loadSession();
    if (saved) {
      logger.info(`Found saved session (${saved.savedAt}) — trying it first`);
      await session.restoreCookies(page, saved);
      await openPanel(page);
      const applied = await session.applyStorage(page, saved.storage);
      if (applied) await openPanel(page);
      await sleep(2000);
      if (await isLoggedIn(page)) {
        logger.info('Saved session is still valid — skipping login.');
        return { ok: true, via: 'saved-session' };
      }
      logger.info('Saved session is not valid anymore — starting fresh login.');
    }
  }

  if (!config.hasCredentials) {
    throw new Error('PISHGAMAN_USERNAME / PISHGAMAN_PASSWORD are not set in .env');
  }

  for (let attempt = 1; attempt <= config.maxLoginRetries; attempt++) {
    logger.info(`Login attempt ${attempt}/${config.maxLoginRetries}`);
    await openPanel(page); // fresh page = fresh captcha

    const res = await tryLoginOnce(page);
    if (res.ok) {
      await sleep(1500); // let any post-login redirect settle
      await session.saveSession(page, config.username);
      logger.info('Login OK — session saved for future runs.');
      return { ok: true, via: 'fresh-login', attempts: attempt };
    }
    logger.warn(`Attempt ${attempt} failed: ${res.reason}`);

    if (attempt < config.maxLoginRetries) {
      await sleep(config.retryDelayMs + Math.floor(Math.random() * 1200));
    }
  }

  throw new Error(
    `Login failed after ${config.maxLoginRetries} attempts. Run "npm run probe" and check the logs/ folder for captcha dumps.`
  );
}

module.exports = { runLogin, isLoggedIn };
