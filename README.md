# Sami WireGuard Mini App

مینی‌اپ فروشگاهی فارسی با طراحی تیره/نئونی، سه سرویس WireGuard / V2Ray / DNS، صفحه مدیریت و ثبت درخواست سفارش.

## مهم قبل از استفاده واقعی
این پروژه یک **نسخه پایه قابل اجرا** است، نه اتصال کامل به پنل‌های VPN شما. در این نسخه:
- کلیدهای فعال/غیرفعال، نمایش و امکان سفارش سرویس در فروشگاه را کنترل می‌کنند.
- سفارش‌ها در `data.json` ذخیره می‌شوند.
- پرداخت واقعی، صدور کانفیگ، QR واقعی، مصرف/حجم، تمدید، و قطع واقعی کاربران پیاده‌سازی نشده‌اند؛ برای آن‌ها باید API و مستندات پنل WireGuard، پنل V2Ray و DNS شما مشخص شود.
- ذخیره‌سازی فایل روی Render Free ممکن است با redeploy/restart پاک شود. برای استفاده تجاری، PostgreSQL یا دیسک پایدار تنظیم کنید.
- قبل از انتشار، `ADMIN_PASSWORD` را به رمز طولانی و غیرقابل حدس تغییر دهید. فایل `.env` و توکن‌ها را هرگز در GitHub آپلود نکنید.

## اجرا محلی
1. Node.js 18 یا جدیدتر نصب باشد.
2. در پوشه پروژه:
   ```bash
   npm install
   ```
3. `.env.example` را به `.env` کپی و `ADMIN_PASSWORD` را عوض کنید.
4. اجرا:
   ```bash
   npm start
   ```
5. فروشگاه: `http://localhost:10000`
6. مدیریت: `http://localhost:10000/admin.html`

## انتشار در GitHub و Render
1. ZIP را باز کن و همه فایل‌های داخل پوشه را در یک repository جدید GitHub آپلود کن.
2. در Render روی **New + → Web Service** بزن و repository را وصل کن.
3. Runtime را Node انتخاب کن. Build Command: `npm install` و Start Command: `npm start`.
4. در **Environment** متغیر `ADMIN_PASSWORD` را اضافه کن و رمز قوی بگذار. `SUPPORT_USERNAME` و `CHANNEL_URL` هم قابل تنظیم‌اند.
5. Deploy کن و آدرس HTTPS سایت را باز کن. صفحه مدیریت: `/admin.html`.

## اتصال به تلگرام
برای دکمه Mini App باید URL نهایی HTTPS باشد.
1. در `@BotFather` دستور `/mybots` را بزن.
2. ربات `SamiWireGuard` را انتخاب کن.
3. وارد **Bot Settings → Configure Mini App** شو و آدرس HTTPS Render را ثبت کن؛ اگر گزینه Main Mini App نمایش داده شد همان‌جا هم تنظیمش کن.
4. برای دکمه داخل منوی ربات، **Bot Settings → Menu Button** را باز کن و URL مینی‌اپ را ثبت کن.
5. آدرس `https://YOUR-APP.onrender.com` را جایگزین آدرس واقعی کن.

## اتصال API پنل‌ها
برای تکمیل سفارش خودکار لازم است از هر سه سرویس این اطلاعات را از مستندات رسمی پنل تهیه کنی: آدرس API، روش احراز هویت، endpoint ساخت کاربر/اشتراک، endpoint مشاهده حجم و endpoint غیرفعال‌سازی. رمز پنل و API key را در فایل‌های فرانت‌اند قرار نده؛ فقط در Environment سرور نگه‌دار.
