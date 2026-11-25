require('dotenv').config();
const path = require('path');

function envStr(name, fallback = '') {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

function envInt(name, fallback) {
  const v = parseInt(process.env[name], 10);
  return Number.isFinite(v) ? v : fallback;
}

function envBool(name, fallback) {
  const v = process.env[name];
  if (v === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

const config = {
  baseUrl: envStr('BASE_URL', 'https://my.pishgaman.net/panel/'),
  username: envStr('PISHGAMAN_USERNAME'),
  password: envStr('PISHGAMAN_PASSWORD'),

  headless: envBool('HEADLESS', true),
  slowMo: envInt('SLOW_MO_MS', 0),
  navTimeoutMs: envInt('NAV_TIMEOUT_MS', 60000),
  acceptInsecureCerts: envBool('ACCEPT_INSECURE_CERTS', true),
  // مسیر دستی مرورگر (مثلاً /usr/bin/chromium داخل Docker)؛ خالی = پیش‌فرض Puppeteer
  executablePath: envStr('CHROME_PATH', ''),

  maxLoginRetries: envInt('MAX_LOGIN_RETRIES', 5),
  retryDelayMs: envInt('RETRY_DELAY_MS', 2000),
  loginDetectMs: envInt('LOGIN_DETECT_MS', 12000),

  sessionFile: path.resolve(process.cwd(), envStr('SESSION_FILE', 'sessions/session.json')),

  // محل کش فایل زبان OCR (مثل eng.traineddata)؛ داخل Docker روی ولیوم تنظیم می‌شود
  tesseractCachePath: envStr('TESSERACT_CACHE_PATH', '.'),

  captcha: {
    imageId: envStr('CAPTCHA_IMAGE_ID', 'loginCaptchaImage'),
    whitelist: envStr('CAPTCHA_WHITELIST', '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'),
    minLen: envInt('CAPTCHA_MIN_LEN', 3),
    maxLen: envInt('CAPTCHA_MAX_LEN', 10),
    scale: envInt('CAPTCHA_SCALE', 4),
    threshold: envInt('CAPTCHA_THRESHOLD', 140),
    lang: envStr('CAPTCHA_OCR_LANG', 'eng'),
    psm: envInt('CAPTCHA_OCR_PSM', 7),
    forceUppercase: envBool('CAPTCHA_FORCE_UPPERCASE', false),
  },

  // Selectors are tried in order; entries starting with "xpath:" are XPath expressions.
  // These match the login form of my.pishgaman.net/panel/ (captured from DevTools).
  selectors: {
    username: [
      'input[name="username"]',
      'input[placeholder="نام کاربری"]',
      'xpath:/html/body/div/div[2]/div[1]/div/div[2]/form/div[1]/input',
    ],
    password: [
      'input[type="password"]',
      'input[name="password"]',
      'xpath:/html/body/div/div[2]/div[1]/div/div[2]/form/div[2]/input',
    ],
    captchaImage: [
      '#loginCaptchaImage',
      'img[id*="aptcha"]',
      'xpath://*[@id="loginCaptchaImage"]',
    ],
    captchaInput: [
      'input[name="captcha"]',
      'input[name*="captcha" i]',
      'xpath:/html/body/div/div[2]/div[1]/div/div[2]/form/div[4]/input',
    ],
    submit: [
      'form button[type="submit"]',
      'xpath:/html/body/div/div[2]/div[1]/div/div[2]/form/div[5]/button',
      'form button',
    ],
  },
};

config.hasCredentials = Boolean(config.username && config.password);

module.exports = config;
