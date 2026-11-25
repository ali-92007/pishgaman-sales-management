const fs = require('fs');
const path = require('path');
const config = require('./config');
const logger = require('./logger');

async function getCookies(page) {
  const ctx = page.browserContext();
  if (typeof ctx.cookies === 'function') {
    return ctx.cookies();
  }
  return page.cookies();
}

/**
 * Saves cookies + localStorage + sessionStorage of the current page
 * to the session file for future runs.
 */
async function saveSession(page, username) {
  const cookies = await getCookies(page);
  const storage = await page.evaluate(() => {
    const dump = (store) => {
      const out = {};
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        out[k] = store.getItem(k);
      }
      return out;
    };
    return {
      origin: location.origin,
      localStorage: dump(window.localStorage),
      sessionStorage: dump(window.sessionStorage),
    };
  });

  const payload = {
    savedAt: new Date().toISOString(),
    username,
    baseUrl: config.baseUrl,
    cookieCount: cookies.length,
    cookies,
    storage,
  };

  fs.mkdirSync(path.dirname(config.sessionFile), { recursive: true });
  fs.writeFileSync(config.sessionFile, JSON.stringify(payload, null, 2), { mode: 0o600 });
  logger.info(`Session saved to ${config.sessionFile} (${cookies.length} cookies)`);
  return payload;
}

/**
 * Loads the session file (returns null if missing/corrupt).
 */
function loadSession() {
  try {
    if (!fs.existsSync(config.sessionFile)) return null;
    const data = JSON.parse(fs.readFileSync(config.sessionFile, 'utf8'));
    if (!data || !Array.isArray(data.cookies)) return null;
    return data;
  } catch (err) {
    logger.warn(`Could not read session file: ${err.message}`);
    return null;
  }
}

/**
 * Restores saved cookies into the browser context.
 */
async function restoreCookies(page, saved) {
  const cookies = (saved.cookies || [])
    .filter((c) => c && c.name && typeof c.value === 'string')
    .map((c) => {
      const out = { name: c.name, value: c.value };
      if (c.domain) out.domain = c.domain;
      if (c.path) out.path = c.path;
      if (typeof c.expires === 'number') out.expires = c.expires;
      if (typeof c.httpOnly === 'boolean') out.httpOnly = c.httpOnly;
      if (typeof c.secure === 'boolean') out.secure = c.secure;
      if (c.sameSite) out.sameSite = c.sameSite;
      return out;
    });
  if (!cookies.length) return false;

  const ctx = page.browserContext();
  if (typeof ctx.setCookie === 'function') {
    await ctx.setCookie(...cookies);
  } else {
    await page.setCookie(...cookies);
  }
  logger.info(`Restored ${cookies.length} cookies from saved session`);
  return true;
}

/**
 * Re-applies saved localStorage/sessionStorage to the current page.
 */
async function applyStorage(page, storage) {
  if (!storage) return false;
  try {
    await page.evaluate((s) => {
      const fill = (store, data) => {
        for (const [k, v] of Object.entries(data || {})) store.setItem(k, v);
      };
      fill(window.localStorage, s.localStorage);
      fill(window.sessionStorage, s.sessionStorage);
    }, storage);
    return true;
  } catch (err) {
    logger.debug(`applyStorage failed: ${err.message}`);
    return false;
  }
}

/**
 * Clears all cookies of the browser context (used by --fresh logins).
 */
async function clearBrowserCookies(page) {
  const ctx = page.browserContext();
  if (typeof ctx.clearCookies === 'function') {
    await ctx.clearCookies();
    logger.debug('Browser context cookies cleared');
    return;
  }
  const client = await page.createCDPSession();
  try {
    await client.send('Network.clearBrowserCookies');
    logger.debug('Browser cookies cleared via CDP');
  } finally {
    await client.detach().catch(() => {});
  }
}

module.exports = {
  saveSession,
  loadSession,
  restoreCookies,
  applyStorage,
  getCookies,
  clearBrowserCookies,
};
