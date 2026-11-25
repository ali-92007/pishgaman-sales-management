const fs = require('fs');
const config = require('./config');
const { launchBrowser } = require('./browser');
const { queryFirst, waitForFirst } = require('./dom');
const captchaReader = require('./captcha');
const logger = require('./logger');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Diagnostic tool (no login attempted):
 *  - opens the panel page
 *  - lists all input/button elements it finds
 *  - verifies the configured selectors
 *  - downloads the captcha and runs OCR once
 *  - saves a full-page screenshot to logs/
 */
(async () => {
  const { browser, page } = await launchBrowser();
  try {
    logger.info(`Opening ${config.baseUrl} ...`);
    await page.goto(config.baseUrl, {
      waitUntil: 'domcontentloaded',
      timeout: config.navTimeoutMs,
    });
    await sleep(2500);
    logger.info(`Final URL: ${page.url()}`);

    const fields = await page.evaluate(() =>
      Array.from(document.querySelectorAll('input, button')).map((el) => ({
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type') || '',
        name: el.getAttribute('name') || '',
        id: el.getAttribute('id') || '',
        placeholder: el.getAttribute('placeholder') || '',
        visible: !!(el.offsetWidth || el.offsetHeight),
      }))
    );
    logger.info(`Found ${fields.length} input/button elements:`);
    for (const f of fields) logger.info(`  ${JSON.stringify(f)}`);

    logger.info('Checking configured selectors:');
    for (const [field, selectors] of Object.entries(config.selectors)) {
      const el = await queryFirst(page, selectors);
      logger.info(`  ${field}: ${el ? 'FOUND' : 'MISSING'}`);
    }

    const captchaEl = await waitForFirst(page, config.selectors.captchaImage, { timeout: 10000 });
    if (captchaEl) {
      const src = await captchaEl.evaluate((e) => e.getAttribute('src') || '(empty)');
      logger.info(`Captcha image src: ${src}`);
      try {
        const res = await captchaReader.readCaptcha(page);
        logger.info(
          `Captcha OCR sample: ${JSON.stringify({
            text: res.text,
            length: res.length,
            confidence: res.confidence,
            source: res.source,
            ok: res.ok,
          })}`
        );
      } catch (err) {
        logger.warn(`Captcha OCR failed: ${err.message}`);
      }
    } else {
      logger.warn('Captcha image element not found');
    }

    fs.mkdirSync('logs', { recursive: true });
    await page.screenshot({ path: 'logs/probe-screenshot.png', fullPage: true });
    logger.info('Screenshot saved to logs/probe-screenshot.png');
  } finally {
    await browser.close().catch(() => {});
  }
})().catch((err) => {
  logger.error(err.message);
  process.exitCode = 1;
});
