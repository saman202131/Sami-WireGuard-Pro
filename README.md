# Sami WireGuard — Final Telegram ID Edition

نسخه نهایی فروشگاه + داشبورد کاربر + پنل مدیریت + Telegram Bot.

## تغییر مهم
این نسخه **هیچ SMS / OTP / شماره موبایلی** ندارد.
ثبت‌نام مشتری با:
- Telegram ID
- نام
- username اختیاری

انجام می‌شود.

> نکته امنیتی: وارد کردن Telegram ID به‌تنهایی اثبات رمزنگاری‌شده مالکیت آن ID نیست. برای احراز هویت قوی‌تر می‌توان Telegram Login Widget را در مرحله بعد اضافه کرد.

## امکانات
- فروشگاه آبی/مشکی
- فارسی + ساختار آماده برای English
- ثبت کاربر با Telegram ID
- داشبورد کاربر
- سفارش و آپلود رسید
- تأیید/رد سفارش توسط مدیریت
- تحویل دستی لینک، فایل `.conf`، QR و توضیحات
- تیکت پشتیبانی
- کد تخفیف
- Flash Sale
- گردونه شانس
- امتیاز و Referral
- جست‌وجوی کاربران با Telegram ID / username / نام
- تنظیمات Bot Token
- Bot ID / username
- Owner/Admin Telegram ID
- Support Telegram ID/username
- Channel ID/username
- Telegram bot commands
- Backup
- Audit log
- Render config

## اجرا
```bash
npm install
cp .env.example .env
npm start
```

## Render
در Environment این موارد را تنظیم کن:
- `JWT_SECRET`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

توکن ربات را می‌توانی از پنل مدیریت هم تنظیم کنی.

## مسیرها
- `/` فروشگاه
- `/dashboard` داشبورد کاربر
- `/admin` پنل مدیریت
- `/api/health` سلامت سرور

## Telegram Bot
بعد از تنظیم Bot Token و فعال‌کردن ربات:
- `/start`
- `/id`
- `/products`
- `/orders`
- `/support`

توکن ربات در API عمومی نمایش داده نمی‌شود.
