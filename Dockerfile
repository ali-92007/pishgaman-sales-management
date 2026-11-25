# ایمیج Node سبک (Debian bookworm)
FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    # از دانلود Chrome توسط Puppeteer در زمان npm install جلوگیری می‌کند
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    # کرومِ نصب‌شده با apt استفاده می‌شود
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    # کش فایل زبان OCR داخل ایمیج/ولیوم
    TESSERACT_CACHE_PATH=/app/.tesseract-cache

# Chromium با همه‌ی کتابخانه‌های سیستمی + فونت‌ها برای رندر درست صفحات فارسی
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        chromium \
        ca-certificates \
        fonts-noto-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# اگر package-lock.json در بیلدکانتکست باشد استفاده می‌شود (نصب قابل تکرار)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

# کل سورس؛ eng.traineddata اگر موجود باشد پایین‌تر به کش OCR منتقل می‌شود
COPY . .

# پوشه‌های سشن/لاگ + انتقال اختیاری فایل زبان OCR به کش (در نسخه zip موجود است؛
# در کلون گیت در اولین اجرا به‌صورت خودکار دانلود و در ولیوم tessdata کش می‌شود)
RUN mkdir -p /app/sessions /app/logs /app/.tesseract-cache \
    && if [ -f /app/eng.traineddata ]; then mv /app/eng.traineddata /app/.tesseract-cache/; fi \
    && chown -R node:node /app

USER node

CMD ["node", "src/index.js"]
