/**
 * Local OCR pipeline self-test (does not need access to the target site).
 * Generates a synthetic captcha-like image, then runs the exact same
 * preprocessing + OCR pipeline used for the real captcha.
 *
 * Usage:
 *   npm run test:ocr            # tests with the default sample "A7K2Z"
 *   npm run test:ocr -- K99LMX  # tests with a custom sample
 *
 * Exit code 0 = OCR matched the sample exactly.
 */
const sharp = require('sharp');
const { ocrImage } = require('../src/captcha');

async function makeSampleImage(text) {
  const w = 200;
  const h = 64;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 3}" stroke="#999999" stroke-width="2"/>
    <line x1="0" y1="${h / 3}" x2="${w}" y2="${(2 * h) / 3}" stroke="#bbbbbb" stroke-width="1"/>
    <text x="12" y="45" font-family="DejaVu Sans" font-size="34" fill="#111111" letter-spacing="6">${text}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

(async () => {
  const expected = process.argv[2] || 'A7K2Z';
  const buf = await makeSampleImage(expected);
  const res = await ocrImage(buf);
  console.log(`expected: ${expected}`);
  console.log(
    `ocr     : ${res.text} (len=${res.length}, conf=${res.confidence}, ok=${res.ok})`
  );
  process.exit(res.text === expected ? 0 : 1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
