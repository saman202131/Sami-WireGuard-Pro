# Sami WireGuard PRO MAX

فروشگاه و پنل مدیریت Full-stack برای Sami WireGuard با Node.js/Express و دیتابیس JSON بدون پکیج native.

## Run locally

```bash
npm install
npm start
```

Server listens on `0.0.0.0` and uses `process.env.PORT` (Render compatible).

Open `/` for the storefront and `/admin` for the management panel.

## Environment Variables

Required/recommended:

```env
PORT=10000
ADMIN_USER=admin
ADMIN_PASSWORD=change-this-password
JWT_SECRET=use-a-long-random-secret
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=sami91928bot
TELEGRAM_SUPPORT_USERNAME=saman_s87
TELEGRAM_CHANNEL_USERNAME=SamiWireGuard
CARD_NUMBER=
CARD_NAME=Sami WireGuard
CURRENCY=تومان
```

If `ADMIN_PASSWORD` is not set, the development seed password is `admin123`. **Change it before deployment.**

## GitHub

1. Create a new GitHub repository.
2. Upload the project files (do not upload `.env`, `data/db.json`, uploaded receipts, or backups).
3. Commit and push.

## Render

1. Create a new **Web Service** from the GitHub repository.
2. Runtime: Node.
3. Build Command: `npm install`.
4. Start Command: `npm start`.
5. Add the environment variables above in Render → Environment.
6. Deploy. The app automatically binds to `0.0.0.0` and Render's `PORT`.

### Persistence note

This version uses a JSON data store to avoid native modules such as `better-sqlite3`. Render Free instances have ephemeral filesystems, so persistent production data should eventually be moved to a managed PostgreSQL/Redis-compatible service. The Backup UI can create/download JSON backups while the instance is running.

## Implemented core flows

- Public storefront with active category filtering, search and real product data.
- Admin authentication with bcrypt password hashing, HTTP-only JWT cookie, rate limiting and role/permission middleware.
- Product CRUD/archive, category activation, order creation, receipt upload, order status changes and manual service delivery.
- Customer records, wallet ledger, coupons, VIP data, missions, referral codes, tickets/messages, notifications, server monitor records, audit logs and backups.
- Wheel probability validation (must equal 100%), one spin per successful order, prize inventory and wallet-credit prize handling.
- Telegram token is server-side only; test connection endpoint and event notifications are included.
- PWA manifest/service worker and responsive mobile-first UI.

## Security notes

- Never commit `.env`.
- Set a strong `JWT_SECRET` and `ADMIN_PASSWORD` in Render.
- Receipt files are not exposed through the public static directory; admin access is required.
- The Telegram bot token is never returned by public endpoints.
- For serious production use, migrate JSON storage to managed PostgreSQL and use object storage for receipts/backups.
