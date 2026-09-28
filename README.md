# Sami WireGuard PRO MAX

فروشگاه Node.js/Express آماده GitHub و Render، بدون دیتابیس native و بدون `better-sqlite3`.

## امکانات واقعی
- فروشگاه Mobile First با UI Dark Cyber / Glassmorphism / Neon
- WireGuard / DNS / V2Ray با فعال/غیرفعال‌سازی از پنل
- جستجو و فیلتر، Featured و Best Seller، تخفیف و Flash Sale
- حساب مشتری با Telegram + PIN، تاریخچه سفارش و سرویس
- سفارش کارت‌به‌کارت و Upload واقعی رسید
- مدیریت وضعیت سفارش و تحویل دستی Subscription / conf / QR / توضیحات
- Wallet و Audit Trail
- Coupon، VIP، Referral و Missions data model
- Ticket System و اعلان داخلی
- Wheel با یک Spin برای هر سفارش موفقِ تأییدشده و اعتبارسنجی دقیق مجموع Probability برابر 100%
- Telegram notification/test با Bot Token فقط سمت سرور
- Server monitor با برچسب Demo برای داده‌های غیرواقعی
- Analytics، Audit Logs، Backup/Restore و Multi Admin
- Password hashing، JWT cookie، login rate limit، role/permission middleware
- PWA / service worker

## اجرا محلی
```bash
cp .env.example .env
npm install
npm start
```
سپس `http://localhost:10000` را باز کن و برای پنل به `/admin` برو.

ورود اولیه پنل از این متغیرها ساخته می‌شود:
- `ADMIN_USER`
- `ADMIN_PASSWORD`
- `JWT_SECRET`

اگر این‌ها را تعیین نکنی، برای توسعه محلی مقدار پیش‌فرض `admin / admin123` استفاده می‌شود. قبل از انتشار حتماً تغییرشان بده.

## GitHub + Render
1. کل محتویات همین پوشه را در ریشه Repository قرار بده؛ `package.json` و `server.js` باید مستقیماً در ریشه باشند.
2. در Render یک **Web Service** از Repository بساز.
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Environment Variables را تنظیم کن:
   - `ADMIN_USER`
   - `ADMIN_PASSWORD`
   - `JWT_SECRET`
   - `TELEGRAM_BOT_TOKEN` (اختیاری ولی برای اعلان‌ها لازم است)
   - `TELEGRAM_BOT_USERNAME`
   - `TELEGRAM_SUPPORT_USERNAME`
   - `TELEGRAM_CHANNEL_USERNAME`
   - `CARD_NUMBER`
   - `CARD_NAME`
   - `CURRENCY`
6. Render به صورت خودکار `PORT` را می‌دهد؛ برنامه روی `0.0.0.0` و `process.env.PORT` گوش می‌کند.
7. سایت: `/` — پنل: `/admin`

## نکته مهم درباره Render Free
این نسخه از فایل JSON برای persistence استفاده می‌کند تا native database لازم نباشد. فایل‌سیستم سرویس‌های رایگان/ephemeral Render برای نگهداری دائمی داده مناسب نیست؛ برای داده‌های فروش واقعی، Backup مرتب بگیر یا بعداً یک دیتابیس خارجی Postgres/سرویس storage اضافه کن.

## Telegram
Bot Token هرگز در HTML/JS ارسال نمی‌شود. از بخش Telegram پنل می‌توانی Usernameها و Token را تنظیم و Test Connection اجرا کنی. Bot باید اجازه ارسال پیام به مقصد تنظیم‌شده را داشته باشد.

## Upload
رسید مشتری و فایل‌های سرویس در `data/uploads` ذخیره می‌شوند و مسیر عمومی static ندارند؛ دسترسی به آن‌ها فقط از endpoint احراز‌شده پنل انجام می‌شود.
