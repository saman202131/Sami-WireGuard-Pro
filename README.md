# Sami WireGuard PRO MAX — Bot + Mini App integration

## Deploy
- Upload the **contents** of this ZIP to the root of your GitHub repository.
- Render Build Command: `npm install`
- Render Start Command: `npm start`
- Set `ADMIN_PASSWORD` in Render Environment.
- Set `TELEGRAM_BOT_TOKEN` to the token from BotFather. Keep it server-side only; never paste it into HTML or a public repository.
- Set `MINI_APP_URL` to the public HTTPS URL.
- Use a persistent Render disk or database for `data.json`; otherwise data can be lost on redeploy/restart.

## Connect the bot
1. Open `/admin`, create an API key and save it.
2. Put that same key into the bot's **server-side** environment/config and send it as `X-Secret-Key`.
3. Bot can read the current website catalog with `GET /api/integration/catalog`.
4. Bot can update website catalog with `PUT /api/integration/catalog` and JSON body `{ "services": [...] }`.
5. For a purchase created from the bot, call `POST /api/integration/orders` with JSON `{ "serviceId":"wg10-service-id", "planId":"wg10-plan-id", "telegramUserId":"123456789", "username":"buyer" }`. Use exact IDs returned by the catalog. It creates the order in the same website order list and attempts to message the buyer.
6. To update a shared order status call `POST /api/integration/orders/{ORDER_ID}/status` with `{ "status":"approved" }`, `{ "status":"rejected" }`, or `{ "status":"fulfilled" }`.

Every bot request above must include `X-Secret-Key: THE_SAME_KEY`. The `X-API-Key` alias is also accepted. The bot code must actually call these endpoints for data and orders to synchronize; entering a key in the website does not modify the bot automatically.

## Telegram notifications
The site sends order, receipt and status messages via Telegram Bot API when `TELEGRAM_BOT_TOKEN` is configured and a Telegram chat ID is available. A user generally must start the bot first so Telegram permits direct messages. Telegram Web App spin identity is validated against `TELEGRAM_BOT_TOKEN`.

## Roulette
In `/admin` > Roulette, enter a JSON array, e.g.:
```json
[
  {"label":"۵٪ تخفیف","weight":35},
  {"label":"۱۰٪ تخفیف","weight":25},
  {"label":"۱۵٪ تخفیف","weight":15},
  {"label":"شانس دوباره","weight":15},
  {"label":"جایزه ویژه","weight":10}
]
```
`weight` is relative probability, not necessarily a percentage that adds up to 100. Each verified Telegram account is limited to one spin in this app's JSON storage. Results are recorded and sent to the buyer; the administrator must validate/apply the reward. Discount labels are not automatically deducted from order totals in this version.

## Important limits
- Card-transfer receipt is a manual review workflow, not an automatic bank/payment confirmation.
- This package does not provision WireGuard/Vitory/DNS accounts automatically. To deliver access automatically, the actual supplier/panel API must be integrated.
- The bot must implement the documented API calls. Without modifying bot code, catalog sync and bot-originated order sync cannot be automatic.
- For production, move from JSON storage to a persistent database, configure backups, and rate-limit public endpoints.


## اتصال با کلیدی که داخل ربات ساخته می‌شود
1. در ربات کلید API/Secret را بساز و کپی کن.
2. در `/admin` وارد «اتصال ربات ↔ سایت» شو؛ کلید ربات را در فیلد «کلید محرمانه‌ای که داخل ربات ساخته‌ای» بچسبان و ذخیره کن.
3. همان کلید باید از سمت سرور ربات در هدر `X-Secret-Key` فرستاده شود.
4. مسیرها: `GET /api/integration/catalog`, `PUT /api/integration/catalog`, `POST /api/integration/orders`, `POST /api/integration/orders/:id/status`.
5. برای سفارش‌های سایت، توکن ربات را در Render با `TELEGRAM_BOT_TOKEN` تنظیم کن؛ کاربر باید ربات را قبلاً Start کرده باشد.

توجه: کلید مشترک احراز هویت را فراهم می‌کند اما خودش کد ربات را تغییر نمی‌دهد. برای همگام‌سازی قیمت و سفارش، کد ربات باید endpointها را فراخوانی کند. صدور خودکار VPN به API پنل تأمین‌کننده نیاز دارد.
