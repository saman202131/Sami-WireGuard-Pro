# Sami WireGuard PRO MAX

Premium mobile-first WireGuard/DNS/V2Ray-ready store with admin dashboard, manual payment, receipt upload, service delivery, wheel, coupons, analytics, audit and PWA.

## Render
Build: `npm install`
Start: `npm start`

Environment variables:
- `ADMIN_USER`
- `ADMIN_PASSWORD`
- `JWT_SECRET`
- `SITE_NAME`
- `TELEGRAM_BOT_TOKEN` (optional; token can also be configured from Owner settings)

Default local login: `admin` / `ChangeThisNow123!`
Change the credentials in Render before production use.

## Defaults
WireGuard is enabled. DNS and V2Ray are disabled and can be enabled separately from Owner > Settings.

## Notes
This version uses JSON file storage to avoid native database build problems on Render Free. For production scale, move storage to a managed database/object storage.
