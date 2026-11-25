const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { createWorker } = require('tesseract.js');
const config = require('./config');
const { queryFirst } = require('./dom');
const logger = require('./logger');

let workerPromise = null;
let workerLang = null;

async function getOcrWorker(lang) {
  if (!workerPromise || workerLang !== lang) {
    workerLang = lang;
    workerPromise = createWorker(lang, 1, {
      cachePath: config.tesseractCachePath,
      logger: (m) => {
        if (process.env.DEBUG === '1' && m.status === 'recognizing text') {
          logger.debug(`OCR progress: ${(m.progress * 100).toFixed(0)}%`);
        }
      },
    });
  }
  return workerPromise;
}

/**
 * Downloads the captcha image bytes using the browser session.
 * Preference order:
 *  1) re-fetch the image URL with session cookies (original quality)
 *  2) data URI embedded in the img src
 *  3) element screenshot (fallback)
 */
async function fetchCaptchaBytes(page) {
  const imgEl = await queryFirst(page, config.selectors.captchaImage);
  if (!imgEl) throw new Error('captcha image element not found on page');

  const info = await imgEl.evaluate((e) => ({ src: e.getAttribute('src') || '' }));

  if (info.src && !info.src.startsWith('data:')) {
    try {
      const b64 = await page.evaluate(async (src) => {
        const res = await fetch(new URL(src, location.href).href, { credentials: 'include' });
        if (!res.ok) return null;
        const buf = await res.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return btoa(bin);
      }, info.src);
      if (b64) return { bytes: Buffer.from(b64, 'base64'), source: 'network' };
    } catch (err) {
      logger.warn(`Could not fetch captcha image over session (${err.message}) — falling back`);
    }
  }

  if (info.src && info.src.startsWith('data:')) {
    const commaIdx = info.src.indexOf(',');
    if (commaIdx > -1) {
      return { bytes: Buffer.from(info.src.slice(commaIdx + 1), 'base64'), source: 'data-uri' };
    }
  }

  const shot = await imgEl.screenshot();
  return { bytes: Buffer.from(shot), source: 'screenshot' };
}

/**
 * Prepares the captcha for OCR: grayscale, contrast stretch,
 * auto-invert (if light text on dark background), upscale, binarize.
 */
async function preprocessImage(rawBuf) {
  const { scale, threshold } = config.captcha;
  const meta = await sharp(rawBuf, { failOn: 'none' }).metadata();
  const srcWidth = meta.width || 120;
  const targetWidth = Math.max(srcWidth * scale, 320);

  const stats = await sharp(rawBuf, { failOn: 'none' }).greyscale().stats();
  const mean = stats.channels[0].mean;

  let pipe = sharp(rawBuf, { failOn: 'none' }).greyscale().normalise();
  if (mean < 110) {
    pipe = pipe.negate(); // light text on dark background -> dark text on light
  }
  return pipe
    .resize({ width: targetWidth, kernel: 'nearest' })
    .threshold(threshold)
    .png()
    .toBuffer();
}

/**
 * Runs OCR on a captcha image buffer and returns a cleaned result.
 */
async function ocrImage(rawBuf) {
  const processed = await preprocessImage(rawBuf);

  if (process.env.DEBUG === '1') {
    try {
      const dir = path.resolve(process.cwd(), 'logs');
      fs.mkdirSync(dir, { recursive: true });
      const stamp = Date.now();
      fs.writeFileSync(path.join(dir, `captcha-raw-${stamp}.png`), rawBuf);
      fs.writeFileSync(path.join(dir, `captcha-clean-${stamp}.png`), processed);
    } catch (err) {
      logger.debug(`captcha dump failed: ${err.message}`);
    }
  }

  const worker = await getOcrWorker(config.captcha.lang);
  await worker.setParameters({
    tessedit_char_whitelist: config.captcha.whitelist,
    tessedit_pageseg_mode: String(config.captcha.psm),
  });

  const { data } = await worker.recognize(processed);
  let text = (data.text || '').replace(/\s+/g, '');

  const whitelist = new Set(config.captcha.whitelist.split(''));
  text = Array.from(text)
    .filter((ch) => whitelist.has(ch))
    .join('');
  if (config.captcha.forceUppercase) text = text.toUpperCase();

  const ok = text.length >= config.captcha.minLen && text.length <= config.captcha.maxLen;
  return { text, length: text.length, confidence: data.confidence, ok };
}

/**
 * Fetches the captcha from the current page and OCRs it.
 */
async function readCaptcha(page) {
  const { bytes, source } = await fetchCaptchaBytes(page);
  logger.debug(`captcha source: ${source}`);
  const result = await ocrImage(bytes);
  result.source = source;
  return result;
}

module.exports = { readCaptcha, ocrImage, preprocessImage, fetchCaptchaBytes };
