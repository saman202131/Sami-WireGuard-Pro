# Sami WireGuard PRO MAX

مینی‌اپ فروشگاهی Node.js/Express با پنل مدیریت و API اتصال ربات. نیازمند Node.js 18 یا جدیدتر.

## اجرا
1. `npm install`
2. متغیر `ADMIN_PASSWORD` را تنظیم کن.
3. در صورت نیاز به احراز هویت Telegram Mini App، متغیر `TELEGRAM_BOT_TOKEN` را تنظیم کن.
4. `npm start`
5. فروشگاه در `/` و پنل مدیریت در `/admin` در دسترس است.

## متغیرهای محیطی مهم
- `PORT`: پورت اجرا (در Render خودکار تعیین می‌شود).
- `ADMIN_PASSWORD`: رمز ورود پنل مدیریت؛ ضروری.
- `TELEGRAM_BOT_TOKEN`: اعلان تلگرام و اعتبارسنجی initData.
- `INTEGRATION_API_KEY`: کلید API سرور ربات، مگر آنکه از پنل کلید ساخته و ذخیره شود.
- `MINI_APP_URL`, `MINI_APP_TITLE`, `SUPPORT_USERNAME`, `CHANNEL_URL`: تنظیمات اختیاری.
- `DATA_FILE`: مسیر فایل داده؛ برای استقرار پایدار آن را روی دیسک پایدار یا از دیتابیس خارجی استفاده کن.

## API اتصال ربات
همه درخواست‌های `/api/integration/*` باید هدر `X-Secret-Key: <کلید>` داشته باشند.
- `GET /api/integration/catalog`
- `PUT /api/integration/catalog` با بدنه `{ "services": [...] }`
- `GET /api/integration/orders?limit=50`
- `POST /api/integration/orders` با `serviceId`, `planId`, `telegramUserId` و ترجیحاً `Idempotency-Key`
- `POST /api/integration/orders/:id/status` با وضعیت `pending`, `approved`, `rejected` یا `fulfilled`

## آزمایش
- `npm run check` — بررسی استاتیک نحو، ساختار فایل‌ها و مسیرهای API.
- `GET /health` — بررسی ساده سلامت برنامه.

## محدودیت‌های مهم
این پروژه به‌تنهایی درگاه بانکی یا API تولید کانفیگ WireGuard/DNS/Vitory ندارد. برای تحویل خودکار باید API مستند تأمین‌کننده و برای پرداخت آنلاین درگاه واقعی وصل شود. ربات تلگرام هم باید کد سمت سرور خودش را برای فراخوانی APIها داشته باشد. فایل JSON به‌تنهایی ذخیره‌سازی پایدار تضمین‌شده روی Render نیست. ماتریس کامل وضعیت قابلیت‌ها در `FEATURE_MATRIX_FA.md` آمده است.

## نقشه جامع ایده‌ها
فهرست قابلیت‌های مطرح‌شده و موارد پیشنهادی برای توسعه بعدی در `IDEAS_ROADMAP_FA.md` قرار دارد. این فهرست نقشه راه است و به معنی پیاده‌سازی همه موارد نیست؛ وضعیت واقعی را در `FEATURE_MATRIX_FA.md` ببین.

ربات: `@sami91928bot` — کانال: `@SamiWireGuard` — پشتیبانی: `@saman_s87`.
