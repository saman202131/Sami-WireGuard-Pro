# Sami WireGuard — Final Admin-Managed Edition

نسخه یکپارچه فروشگاه + پنل مدیریت + داشبورد کاربر + OTP + سفارش دستی + Telegram Bot.

## اجرا

```bash
npm install
cp .env.example .env
npm start
```

سپس:
- فروشگاه: `http://localhost:3000`
- داشبورد کاربر: `http://localhost:3000/dashboard`
- مدیریت: `http://localhost:3000/admin`

## ورود مدیریت
مقادیر `ADMIN_USERNAME` و `ADMIN_PASSWORD` را در `.env` تغییر بده.

## SMS
در حالت توسعه `EXPOSE_OTP_IN_DEV=true` است تا بدون سرویس پیامک بتوانی تست کنی. برای production آن را `false` کن و provider سازگار با API پروژه را تنظیم کن.

## Telegram
می‌توانی Token و Owner ID را از پنل مدیریت وارد کنی یا از `.env` بدهی. Bot از polling استفاده می‌کند و منوی محصولات، ثبت سفارش، پیگیری سفارش و ارسال رسید را پشتیبانی می‌کند.

## امنیت
در production از HTTPS، رمز قوی، JWT secret تصادفی و reverse proxy استفاده کن. Helmet و نسخه patched Multer در پروژه قرار داده شده‌اند. برای production حتماً `npm audit` را نیز اجرا کن.
