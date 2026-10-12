# Sami WireGuard PRO Mini App

Persian, mobile-first Telegram Mini App and admin dashboard for Sami WireGuard.

## Deploy to Render
1. Push this folder to a GitHub repository.
2. Create a Render **Web Service** from that repository.
3. Build command: `npm install`
4. Start command: `npm start`
5. Set `ADMIN_PASSWORD` to a long, unique password in Render Environment. Do not commit real secrets.
6. Optionally set `SUPPORT_USERNAME`, `CHANNEL_URL`, `MINI_APP_URL`, and `MINI_APP_TITLE`.
7. Set the Telegram Mini App URL to the public HTTPS Render URL in your bot's Mini App configuration.
8. Admin page: `/admin.html`; health check: `/health`; connection diagnostics: `/api/connection/status`.

## Current functionality
- Storefront with WireGuard Gaming, DNS Dynamite, and Vitory services; plans can be edited in admin.
- Admin login, general settings, service/plan CRUD through the editor, roulette visibility/title settings, order listing and status changes.
- Order requests are stored as pending orders in `data.json`.
- Health and connection diagnostics endpoints.

## Important integration limits
This package does **not** pretend external systems are connected when they are not. A real payment gateway, Telegram bot synchronization/API key, Telegram `initData` server-side validation, prize-awarding roulette, VPN-provider provisioning, Telegram notifications, coupons, referrals, loyalty points, and reliable analytics require their respective API credentials, provider specifications, and additional integration. The current roulette is intentionally non-awarding. Orders are requests only; no money is charged and no VPN config is issued automatically.

The default JSON storage is suitable for a small test deployment, not reliable production commerce. Attach a persistent disk and set `DATA_FILE`, or integrate a database before relying on order records. Configure a strong `ADMIN_PASSWORD` before deployment.
