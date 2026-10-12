# Sami WireGuard Mini App — Render path fix

## Deploy
1. Upload the CONTENTS of this ZIP to the root of your GitHub repository (not the ZIP as a nested folder).
2. In Render use **Build Command**: `npm install`
3. Use **Start Command**: `npm start`
4. Set `ADMIN_PASSWORD` in Render Environment before opening `/admin.html`.
5. Set `MINI_APP_URL` to your deployed HTTPS URL and optionally set `SUPPORT_USERNAME` and `CHANNEL_URL`.

This package contains `public/index.html` plus root-level `index.html` and `admin.html` fallbacks. The server chooses an existing entrypoint so a missing `public/` directory no longer causes the repeated ENOENT error. The fallback does not replace external integrations: live payments, verified Telegram Mini App identity, VPN provisioning and Telegram bot API integration must be configured separately.

## Routes
- `/` storefront
- `/admin.html` or `/admin` admin panel
- `/health` health check
- `/api/config` public storefront configuration
- `/api/connection/status` connection status summary

## Persistence/security notes
Data is currently stored in `data.json`. On Render, attach a persistent disk or move storage to a managed database if orders must survive redeploys. Set a strong `ADMIN_PASSWORD`. Do not expose API secrets in frontend code.
