const puppeteer = require('puppeteer');
const config = require('./config');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

async function launchBrowser() {
  const browser = await puppeteer.launch({
    headless: config.headless,
    slowMo: config.slowMo || 0,
    acceptInsecureCerts: config.acceptInsecureCerts,
    executablePath: config.executablePath || undefined,
    defaultViewport: { width: 1366, height: 900 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--window-size=1366,900',
      '--lang=fa-IR',
    ],
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(config.navTimeoutMs);
  page.setDefaultNavigationTimeout(config.navTimeoutMs);
  await page.setUserAgent(USER_AGENT);
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7',
  });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  return { browser, page };
}

module.exports = { launchBrowser };
