# Sami WireGuard — One Piece v3

یک پروژه Node/Express یکپارچه و mobile-first.

## اجرا
```bash
npm install
npm start
```

## مدیریت
`/admin`

متغیرهای Render:
- `ADMIN_USER`
- `ADMIN_PASSWORD`
- `JWT_SECRET`

پیش‌فرض توسعه:
- user: `admin`
- password: `ChangeThisNow123!`

قبل از انتشار رمز پیش‌فرض را با Environment Variables عوض کنید.

## ساختار
همه فایل‌های فرانت‌اند در ریشه پروژه هستند و `public` وجود ندارد.

## جریان سفارش
محصول → پرداخت دستی → آپلود رسید → pending → تأیید مدیر → یک spin → تحویل دستی link/config/QR/notes.

## گردونه
هر سفارش تأییدشده دقیقاً یک spin ایجاد می‌کند. احتمال فعال‌ها باید دقیقاً 100% باشد.
