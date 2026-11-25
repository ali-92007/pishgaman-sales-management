# مدیریت فروش پیشگامان (pishgaman-sales-management)

ابزار اتوماسیون سامانه‌ی مشتریان پیشگامان (`my.pishgaman.net`) برای مدیریت فروش.

> طبق هماهنگی انجام‌شده با پشتیبانی پیشگامان، این سامانه API رسمی ندارد و این پروژه از رابط وب همان پنل استفاده می‌کند.

## مرحله ۱ — لاگین خودکار با OCR کپچا ✅

- ورود به `https://my.pishgaman.net/panel/`
- پرکردن خودکار نام کاربری و رمز عبور از `.env`
- دانلود تصویر کپچا (`#loginCaptchaImage`) و خواندن آن با OCR (Tesseract.js)
- وارد کردن کد کپچا و کلیک روی دکمه ورود
- ذخیره کوکی‌ها + localStorage در `sessions/session.json` برای استفاده‌های بعدی
- در اجراهای بعدی اگر سشن معتبر باشد، بدون لاگین مجدد وارد می‌شود
- اگر کپچا اشتباه خوانده شود، به‌صورت خودکار با کپچای جدید دوباره تلاش می‌کند

## پیش‌نیازها

- Node.js نسخه ۱۸ یا بالاتر و npm — **یا** Docker (بخش «اجرا با Docker»)

## نصب

از حالت zip:

```bash
unzip pishgaman-sales-management.zip
cd pishgaman-sales-management
npm install
```

(اگر از گیت استفاده می‌کنید: `git clone https://github.com/ali-92007/pishgaman-sales-management.git`)

## تنظیمات

```bash
cp .env.example .env
```

سپس فایل `.env` را باز کنید و این دو مقدار را پر کنید:

```
PISHGAMAN_USERNAME=نام-کاربری-شما
PISHGAMAN_PASSWORD=رمز-عبور-شما
```

> نکته امنیتی: فایل `.env` و پوشه `sessions/` در `.gitignore` هستند و هرگز به گیت پوش نمی‌شوند. فایل سشن شامل کوکی‌های احراز هویت است و نباید با کسی به اشتراک گذاشته شود.

## اجرا

| دستور | کار |
| --- | --- |
| `npm run probe` | تست اولیه صفحه **بدون لاگین**: لیست فیلدها، بررسی سلکتورها، خواندن کپچا، اسکرین‌شات |
| `npm start` | لاگین کامل + ذخیره سشن |
| `npm start -- --fresh` | نادیده گرفتن سشن ذخیره‌شده و لاگین از نو |
| `npm start -- --stay` | بعد از لاگین مرورگر ۶۰ ثانیه باز می‌ماند (برای بازرسی دستی) |
| `npm run test:ocr` | تست محلی موتور OCR بدون نیاز به سایت |
| `npm run test:e2e` | تست کامل جریان لاگین روی یک پورتال شبیه‌سازی‌شده محلی |

**پیشنهاد:** اول `npm run probe` را اجرا کنید تا مطمئن شوید سلکتورها درست پیدا می‌شوند؛ اگر مشکلی بود، خروجی آن را بفرستید.

## اجرا با Docker

بدون نیاز به نصب Node.js و کروم روی سیستم:

```bash
# ۱) تنظیمات
cp .env.example .env    # و پر کردن PISHGAMAN_USERNAME / PISHGAMAN_PASSWORD

# ۲) ساخت ایمیج (فقط بار اول)
docker compose build

# ۳) اجرا
docker compose run --rm app                             # لاگین خودکار + ذخیره سشن
docker compose run --rm app node src/index.js --fresh   # لاگین از نو
docker compose run --rm app node src/probe.js           # عیب‌یابی صفحه (بدون لاگین)
```

نکات:

- قبل از اولین اجرا پوشه‌ها را بسازید: `mkdir -p sessions logs` (سشن و لاگ‌ها روی سیستم شما مانت می‌شوند).
- فایل زبان OCR (`eng.traineddata`) اختیاری است: در نسخه‌ی zip موجود است و داخل ایمیج کپی می‌شود (OCR حتی بدون اینترنت کار می‌کند)؛ اگر از گیت کلون کنید، در اولین اجرا دانلود و در ولیوم داکری `tessdata` کش می‌شود.
- نسخه‌ی zip شامل `package-lock.json` است و نصب تکرارپذیر می‌شود؛ در مخزن گیت فقط `package.json` نگه‌داری می‌شود.
- برای اجرای دستی با `docker run` (بدون compose)، `--env-file .env` را حتماً بدهید و `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` را تنظیم کنید.

## متغیرهای محیطی (`.env`)

| متغیر | پیش‌فرض | توضیح |
| --- | --- | --- |
| `PISHGAMAN_USERNAME` | — | نام کاربری پنل (لازم) |
| `PISHGAMAN_PASSWORD` | — | رمز عبور (لازم) |
| `BASE_URL` | `https://my.pishgaman.net/panel/` | آدرس پنل |
| `HEADLESS` | `true` | `false` = مرورگر با پنجره نمایش داده شود |
| `MAX_LOGIN_RETRIES` | `5` | حداکثر تلاش برای لاگین |
| `CAPTCHA_WHITELIST` | ارقام + حروف بزرگ | کاراکترهای مجاز کپچا (محدودتر = دقیق‌تر) |
| `CAPTCHA_MIN_LEN` / `CAPTCHA_MAX_LEN` | `3` / `10` | طول مجاز نتیجه OCR |
| `CAPTCHA_SCALE` | `4` | بزرگ‌نمایی تصویر کپچا قبل از OCR |
| `CAPTCHA_THRESHOLD` | `140` | آستانه سیاه/سفید کردن تصویر |
| `CAPTCHA_OCR_PSM` | `7` | حالت تشخیص Tesseract (۷ = یک خط متن) |
| `CAPTCHA_FORCE_UPPERCASE` | `false` | تبدیل نتیجه OCR به حروف بزرگ |
| `SESSION_FILE` | `sessions/session.json` | محل ذخیره سشن |
| `CHROME_PATH` | — | مسیر دستی مرورگر (داخل Docker خودکار تنظیم می‌شود) |
| `TESSERACT_CACHE_PATH` | `.` | محل کش فایل زبان OCR (`eng.traineddata`) |
| `DEBUG` | `1` | ذخیره تصاویر خام/پردازش‌شده کپچا در `logs/` |

## ساختار پروژه

```
src/
  index.js      نقطه شروع (npm start)
  config.js     تنظیمات و سلکتورها (CSS + XPath)
  browser.js    راه‌اندازی Puppeteer
  dom.js        ابزارهای یافتن المنت‌ها
  captcha.js    دانلود + پیش‌پردازش + OCR کپچا
  login.js      منطق لاگین و تلاش مجدد
  session.js    ذخیره/بازیابی کوکی‌ها و استوریج
  probe.js      ابزار عیب‌یابی صفحه (npm run probe)
tools/
  test-ocr.js       تست محلی OCR
  mock-portal.js    پورتال شبیه‌سازی‌شده برای تست E2E
  test-e2e.js       تست کامل جریان لاگین (npm run test:e2e)
Dockerfile          ایمیج داکر (Node + Chromium)
docker-compose.yml  اجرای ساده با Docker
eng.traineddata     فایل زبان OCR (اختیاری — در نسخه zip موجود است)
logs/               لاگ‌ها و تصاویر کپچا (کامیت نمی‌شود)
sessions/           سشن ذخیره‌شده (کامیت نمی‌شود)
```

## عیب‌یابی

- **کپچا درست خوانده نمی‌شود:** با `DEBUG=1` تصاویر `logs/captcha-raw-*.png` (خام) و `logs/captcha-clean-*.png` (پردازش‌شده) را ببینید و `CAPTCHA_THRESHOLD` و `CAPTCHA_SCALE` را تنظیم کنید. اگر کپچا فقط عدد است، `CAPTCHA_WHITELIST=0123456789` بگذارید — دقت به‌طور محسوس بالا می‌رود.
- **سلکتور پیدا نمی‌شود:** خروجی `npm run probe` را بفرستید تا مسیرها در `src/config.js` اصلاح شود.
- **پیام خطای داخل سایت:** پیام‌های `alert()` مرورگر در لاگ (`logs/app.log`) ثبت می‌شوند.
- **لاگ کامل:** همه‌ی رویدادها در `logs/app.log` ذخیره می‌شوند.

## نقشه راه

- [x] مرحله ۱: لاگین خودکار با OCR کپچا و ذخیره سشن
- [ ] مرحله ۲: خواندن اطلاعات فروش از پنل (در انتظار جزئیات)
- [ ] مرحله ۳: ذخیره‌سازی، گزارش و مدیریت فروش
