# Sami WireGuard PRO
A Render-friendly Node/Express WireGuard sales platform starter with a gaming/cyber storefront, admin dashboard, products, orders, receipt uploads, service delivery records, customers, tickets, audit log and settings.

## Run
npm install
npm start

Open http://localhost:10000
Admin: /admin

Set ADMIN_USER, ADMIN_PASSWORD and JWT_SECRET in Render Environment Variables. The app listens on HOST/PORT and defaults to 0.0.0.0/10000 for Render.

## Important production note
This starter uses a JSON file for persistence to keep the first deployment simple and avoid native SQLite build problems. Render free instances have ephemeral storage, so for production use, move data/uploads to Postgres + object storage/persistent disk. Telegram Bot API automation and payment gateway are intentionally left as integration layers for the next phase.
