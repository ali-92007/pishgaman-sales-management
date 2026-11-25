/**
 * Minimal mock of the Pishgaman panel login, used by tools/test-e2e.js
 * to run the full login flow end-to-end without access to the real site.
 *
 * It reproduces the same DOM structure as the real login page:
 *   /html/body/div/div[2]/div[1]/div/div[2]/form/div[1..5]
 * with a captcha image (#loginCaptchaImage), an invalid-captcha alert()
 * path, session cookies and a dashboard page.
 */
const http = require('http');
const crypto = require('crypto');

const CHAR_POOL = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(len = 5) {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += CHAR_POOL[crypto.randomInt(CHAR_POOL.length)];
  }
  return out;
}

function captchaSvg(code) {
  const letters = code
    .split('')
    .map((ch, i) => {
      const angle = (i % 2 === 0 ? -1 : 1) * (2 + ((i * 5) % 6));
      const x = 22 + i * 30;
      return `<text x="${x}" y="44" font-family="DejaVu Sans" font-size="32" fill="#1a1a1a" transform="rotate(${angle} ${x + 12} 30)">${ch}</text>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60">
  <rect width="100%" height="100%" fill="#f1f1f1"/>
  <path d="M0 30 Q 50 12 100 30 T 200 30" stroke="#9aa0a6" stroke-width="2" fill="none" opacity="0.7"/>
  <path d="M0 45 Q 60 55 120 40 T 200 48" stroke="#9aa0a6" stroke-width="1" fill="none" opacity="0.5"/>
  ${letters}
</svg>`;
}

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx > -1) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}

function parseBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      const out = {};
      new URLSearchParams(data).forEach((v, k) => {
        out[k] = v;
      });
      resolve(out);
    });
  });
}

/**
 * Starts the mock portal.
 * options.failFirstLogin: force the first login POST to fail with an
 * "invalid captcha" alert (simulates a wrong OCR read) to exercise retries.
 */
function startMockPortal({ port = 0, failFirstLogin = true } = {}) {
  const sessions = new Set();
  const captchaCodes = new Map(); // token -> code
  let loginAttempts = 0;

  function newLoginToken() {
    const token = crypto.randomBytes(8).toString('hex');
    captchaCodes.set(token, randomCode());
    return token;
  }

  function loginPageHtml(alertMsg) {
    const token = newLoginToken();
    return `<!DOCTYPE html>
<html lang="fa">
<head><meta charset="utf-8"><title>پنل مشتریان پیشگامان — ورود</title></head>
<body>
  <div>لوگو</div>
  <div>
    <div>
      <div>
        <div>
          <form method="POST" action="/panel/login">
            <div><input class="uk-input" type="text" placeholder="نام کاربری" required="required" name="username" style="padding-left: 40px;"></div>
            <div><input class="uk-input" type="password" placeholder="رمز عبور" required="required" name="password"></div>
            <div><input type="hidden" name="captchaToken" value="${token}"><img id="loginCaptchaImage" src="/captcha?token=${token}" alt="کد امنیتی"></div>
            <div><input class="uk-input" type="text" placeholder="کد امنیتی" required="required" name="captcha"></div>
            <div><button type="submit">ورود</button></div>
          </form>
        </div>
      </div>
    </div>
  </div>
  ${alertMsg ? `<script>alert(${JSON.stringify(alertMsg)});</script>` : ''}
</body>
</html>`;
  }

  function dashboardHtml(username) {
    return `<!DOCTYPE html>
<html lang="fa">
<head><meta charset="utf-8"><title>داشبورد — پنل مشتریان پیشگامان</title></head>
<body>
  <div>پنل مشتریان پیشگامان</div>
  <div>
    <h1>داشبورد فروش</h1>
    <p>خوش آمدید ${username}! گزارش فروش این ماه آماده است.</p>
    <div id="sales-summary">مجموع فروش: ۱۲۳,۴۵۶,۰۰۰ تومان</div>
  </div>
</body>
</html>`;
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const cookies = parseCookies(req.headers.cookie);

    if (url.pathname === '/captcha') {
      const code = captchaCodes.get(url.searchParams.get('token') || '') || randomCode();
      res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' });
      res.end(captchaSvg(code));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/panel/login') {
      const body = await parseBody(req);
      loginAttempts += 1;
      const mustFail = failFirstLogin && loginAttempts === 1;
      const expected = captchaCodes.get(body.captchaToken || '');
      captchaCodes.delete(body.captchaToken || '');
      const captchaOk = !mustFail && body.captcha && expected && body.captcha.toUpperCase() === expected;
      if (captchaOk && body.username && body.password) {
        const sid = crypto.randomBytes(16).toString('hex');
        sessions.add(sid);
        res.writeHead(302, {
          'Set-Cookie': `sid=${sid}; Path=/; HttpOnly`,
          Location: '/panel/dashboard',
        });
        res.end();
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(loginPageHtml('کد امنیتی وارد شده اشتباه است'));
      }
      return;
    }

    if (
      req.method === 'GET' &&
      (url.pathname === '/panel/' || url.pathname === '/panel/dashboard')
    ) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      if (cookies.sid && sessions.has(cookies.sid)) {
        res.end(dashboardHtml('testuser'));
      } else {
        res.end(loginPageHtml());
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('not found');
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

module.exports = { startMockPortal };
