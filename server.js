require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");
const multer = require("multer");
const QRCode = require("qrcode");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

const ROOT = __dirname;
const DATA = path.join(ROOT, "data");
const UPLOADS = path.join(DATA, "uploads");
const DB = path.join(DATA, "store.json");
fs.mkdirSync(UPLOADS, { recursive: true });

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "change-me";
if (process.env.NODE_ENV === "production" && JWT_SECRET === "change-me") {
  throw new Error("Set JWT_SECRET in production");
}

const defaults = {
  settings: {
    siteName: "Sami WireGuard",
    siteNameEn: "Sami WireGuard",
    supportId: process.env.TELEGRAM_SUPPORT_ID || "saman_s87",
    botId: process.env.TELEGRAM_BOT_USERNAME || "sami91928bot",
    channelId: process.env.TELEGRAM_CHANNEL_ID || "SamiWireGuard",
    botToken: process.env.TELEGRAM_BOT_TOKEN || "",
    adminBotToken: process.env.ADMIN_BOT_TOKEN || "",
    ownerId: process.env.TELEGRAM_OWNER_ID || "",
    telegramEnabled: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    cardNumber: "",
    cardName: "",
    cardBank: "",
    paymentInstructions: "",
    receiptText: "رسید شما دریافت شد و سفارش در حال بررسی است.",
    approvalText: "پرداخت شما با موفقیت تأیید شد! 🎁 یک دور چرخونه رایگان دریافت کردید.",
    rejectionText: "پرداخت سفارش شما تأیید نشد. لطفاً رسید معتبر ارسال کنید.",
    gatewayEnabled: false,
    gatewayUrl: "",
    currency: "تومان",
    maintenance: false
  },
  categories: [
    { id: "wireguard", name: "WireGuard", nameEn: "WireGuard", active: true, sort: 1 },
    { id: "service", name: "خدمات", nameEn: "Services", active: true, sort: 2 }
  ],
  products: [],
  users: [],
  orders: [],
  services: [],
  tickets: [],
  coupons: [],
  notifications: [],
  servers: [],
  audit: [],
  flashSale: { active: false, percent: 0, start: "", end: "" },
  wheel: {
    active: true, dailyLimit: 1,
    prizes: [
      { id: "p1", title: "۵٪ تخفیف", type: "coupon", value: 5, weight: 35 },
      { id: "p2", title: "۱۰٪ تخفیف", type: "coupon", value: 10, weight: 25 },
      { id: "p3", title: "۱۰۰ امتیاز", type: "points", value: 100, weight: 25 },
      { id: "p4", title: "پوچ", type: "none", value: 0, weight: 15 }
    ]
  },
  missions: [{ id: "first-order", title: "اولین خرید", reward: 100, active: true }],
  referrals: { enabled: true, reward: 10 },
  spins: []
};

function clone(x) { return JSON.parse(JSON.stringify(x)); }
function ensureDB() { if (!fs.existsSync(DB)) fs.writeFileSync(DB, JSON.stringify(defaults, null, 2)); }
function read() { try { const d=JSON.parse(fs.readFileSync(DB,"utf8")); d.settings={...clone(defaults.settings),...(d.settings||{})}; d.wheel={...clone(defaults.wheel),...(d.wheel||{}),spins:(d.wheel?.spins||d.spins||[])}; return d; } catch { return clone(defaults); } }
function write(d) { fs.writeFileSync(DB, JSON.stringify(d, null, 2)); return d; }
function id(prefix) { return `${prefix}_${crypto.randomBytes(7).toString("hex")}`; }
function now() { return new Date().toISOString(); }
function cleanTelegramId(v) { return String(v ?? "").trim().replace(/\s+/g, ""); }
function validTelegramId(v) { return /^\d{5,20}$/.test(cleanTelegramId(v)); }
function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id, telegramId: u.telegramId, name: u.name || "",
    username: u.username || "", createdAt: u.createdAt,
    points: Number(u.points || 0), referralCode: u.referralCode || ""
  };
}
function sign(payload, days = 7) { return jwt.sign(payload, JWT_SECRET, { expiresIn: `${days}d` }); }
function audit(d, actor, action, detail = {}) {
  d.audit.unshift({ id: id("aud"), actor, action, detail, at: now() });
  d.audit = d.audit.slice(0, 1000);
}
function auth(req, res, next) {
  try {
    const raw = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    req.user = jwt.verify(raw, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "نیاز به ورود دارید." });
  }
}
function admin(req, res, next) {
  auth(req, res, () => {
    if (req.user.role === "admin" || req.user.role === "owner") return next();
    res.status(403).json({ error: "دسترسی مدیر لازم است." });
  });
}
function owner(req, res, next) {
  admin(req, res, () => req.user.role === "owner"
    ? next() : res.status(403).json({ error: "دسترسی مالک لازم است." }));
}
const rate = new Map();
function limited(key, max, ms) {
  const t = Date.now();
  const arr = (rate.get(key) || []).filter(x => t - x < ms);
  arr.push(t); rate.set(key, arr);
  return arr.length <= max;
}

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS,
    filename: (req, file, cb) =>
      cb(null, `${Date.now()}-${crypto.randomBytes(5).toString("hex")}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: Number(process.env.MAX_UPLOAD_SIZE || 5242880) },
  fileFilter: (req, file, cb) =>
    cb(null, /^(image\/|application\/pdf$|text\/plain$)/i.test(file.mimetype))
});

ensureDB();

/* Health / public store */
app.get("/api/health", (req, res) => res.json({ ok: true, time: now(), version: "6.0.0" }));
app.get("/api/store", (req, res) => {
  const d = read();
  res.json({
    settings: {
      siteName: d.settings.siteName,
      siteNameEn: d.settings.siteNameEn,
      supportId: d.settings.supportId,
      botId: d.settings.botId,
      channelId: d.settings.channelId,
      cardNumber: d.settings.cardNumber,
      cardName: d.settings.cardName,
      cardBank: d.settings.cardBank,
      paymentInstructions: d.settings.paymentInstructions,
      receiptText: d.settings.receiptText,
      gatewayEnabled: Boolean(d.settings.gatewayEnabled),
      gatewayUrl: d.settings.gatewayUrl,
      currency: d.settings.currency,
      maintenance: d.settings.maintenance
    },
    categories: d.categories.filter(x => x.active).sort((a,b) => a.sort - b.sort),
    products: d.products.filter(x => x.active),
    flashSale: d.flashSale,
    wheel: { active: d.wheel.active, dailyLimit: d.wheel.dailyLimit }
  });
});

/* Admin login */
app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!limited(`login:${req.ip}`, 10, 15 * 60 * 1000))
    return res.status(429).json({ error: "تلاش‌های زیاد. بعداً دوباره امتحان کنید." });
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD)
    return res.json({ token: sign({ role: "owner", username }), admin: { username, role: "owner" } });
  res.status(401).json({ error: "نام کاربری یا رمز عبور نادرست است." });
});

/* Customer authentication: Telegram ID + password. No SMS/phone verification. */
app.post("/api/auth/register", async (req, res) => {
  const telegramId = cleanTelegramId(req.body.telegramId);
  const password = String(req.body.password || "");
  const name = String(req.body.name || "Telegram User").slice(0, 80);
  const username = String(req.body.username || "").replace(/^@/, "").slice(0, 80);
  if (!validTelegramId(telegramId)) return res.status(400).json({ error: "Telegram ID باید یک عدد معتبر باشد." });
  if (password.length < 6) return res.status(400).json({ error: "رمز عبور باید حداقل ۶ کاراکتر باشد." });
  const d = read();
  if (d.users.some(x => x.telegramId === telegramId)) return res.status(409).json({ error: "این Telegram ID قبلاً ثبت‌نام کرده است. از بخش ورود استفاده کنید." });
  const u = { id: id("usr"), telegramId, name, username, passwordHash: await bcrypt.hash(password, 12),
    createdAt: now(), points: 0, referralCode: crypto.randomBytes(4).toString("hex").toUpperCase(), sessions: [] };
  d.users.push(u); audit(d, u.id, "user.register", { telegramId }); write(d);
  res.json({ token: sign({ role: "user", id: u.id }), user: publicUser(u) });
});

app.post("/api/auth/login", async (req, res) => {
  const telegramId = cleanTelegramId(req.body.telegramId);
  const password = String(req.body.password || "");
  if (!limited(`customer-login:${req.ip}:${telegramId}`, 8, 15 * 60 * 1000)) return res.status(429).json({ error: "تلاش‌های ورود زیاد است. بعداً دوباره امتحان کنید." });
  const d = read(), u = d.users.find(x => x.telegramId === telegramId);
  if (!u || u.blocked) return res.status(401).json({ error: "آیدی تلگرام یا رمز عبور اشتباه است." });
  if (!u.passwordHash) return res.status(401).json({ error: "این حساب قدیمی است؛ لطفاً بازیابی حساب را از پشتیبانی انجام دهید." });
  if (!(await bcrypt.compare(password, u.passwordHash))) return res.status(401).json({ error: "آیدی تلگرام یا رمز عبور اشتباه است." });
  u.lastLoginAt = now(); u.sessions = (u.sessions || []).slice(-4).concat([{ id: id("ses"), at: now() }]);
  audit(d, u.id, "user.login", { telegramId }); write(d);
  res.json({ token: sign({ role: "user", id: u.id }), user: publicUser(u) });
});

/* Legacy Telegram login kept only for compatibility with older clients. */
app.post("/api/auth/telegram", (req, res) => res.status(410).json({ error: "نسخه جدید از ثبت‌نام و ورود با Telegram ID + رمز استفاده می‌کند." }));

app.get("/api/me", auth, (req, res) => {
  const d = read(), u = d.users.find(x => x.id === req.user.id);
  if (!u) return res.status(404).json({ error: "کاربر یافت نشد." });
  res.json({ user: publicUser(u) });
});
app.put("/api/profile", auth, (req, res) => {
  const d = read(), u = d.users.find(x => x.id === req.user.id);
  if (!u) return res.status(404).json({ error: "کاربر یافت نشد." });
  u.name = String(req.body.name || u.name).slice(0, 80);
  write(d); res.json({ user: publicUser(u) });
});

app.get("/api/products", (req, res) => res.json(read().products.filter(x => x.active)));
app.get("/api/orders/my", auth, (req, res) => res.json(read().orders.filter(x => x.userId === req.user.id)));
app.get("/api/services/my", auth, (req, res) => res.json(read().services.filter(x => x.userId === req.user.id)));
app.get("/api/tickets/my", auth, (req, res) => res.json(read().tickets.filter(x => x.userId === req.user.id)));
app.get("/api/notifications", auth, (req, res) =>
  res.json(read().notifications.filter(x => !x.userId || x.userId === req.user.id)));
app.get("/api/wheel/status", auth, (req,res)=>{ const d=read(); const spins=(d.wheel.spins||[]).filter(x=>x.userId===req.user.id&&!x.used); res.json({available:spins.length, history:(d.wheel.spins||[]).filter(x=>x.userId===req.user.id).slice(-30)}); });
app.get("/api/referral", auth, (req, res) => {
  const d = read(), u = d.users.find(x => x.id === req.user.id);
  res.json({ code: u.referralCode, points: u.points || 0, enabled: d.referrals.enabled, reward: d.referrals.reward });
});

/* Orders: quantity 1..10, custom service names, payment method and receipt */
app.post("/api/orders", auth, upload.single("receipt"), (req, res) => {
  const d = read();
  const u = d.users.find(x => x.id === req.user.id);
  const p = d.products.find(x => x.id === req.body.productId && x.active);
  const quantity = Math.max(1, Math.min(10, Number(req.body.quantity || 1)));
  if (!u || !p) return res.status(400).json({ error: "محصول یافت نشد." });
  if (Number(p.stock) > 0 && Number(p.stock) < quantity) return res.status(400).json({ error: "موجودی کافی نیست." });
  const paymentMethod = req.body.paymentMethod === "gateway" ? "gateway" : "card";
  if (paymentMethod === "gateway" && !d.settings.gatewayEnabled) return res.status(400).json({ error: "درگاه پرداخت فعلاً غیرفعال است." });
  if (paymentMethod === "card" && !req.file) return res.status(400).json({ error: "ارسال رسید برای پرداخت کارت‌به‌کارت الزامی است." });
  let total = Number(p.price || 0) * quantity;
  let coupon = null;
  const couponCode = String(req.body.coupon || "").trim().toUpperCase();
  if (couponCode) {
    coupon = d.coupons.find(c => c.code === couponCode && c.active &&
      (!c.expiresAt || new Date(c.expiresAt) > new Date()) && (!c.maxUses || Number(c.uses) < Number(c.maxUses)));
    if (coupon) total = coupon.type === "percent" ? Math.max(0, total - total * coupon.value / 100) : Math.max(0, total - coupon.value);
  }
  if (d.flashSale.active && (!d.flashSale.end || new Date(d.flashSale.end) > new Date())) total = Math.max(0, total - total * Number(d.flashSale.percent || 0) / 100);
  let customNames = [];
  try { customNames = JSON.parse(String(req.body.customNames || "[]")); } catch {}
  if (!Array.isArray(customNames)) customNames = [];
  customNames = customNames.slice(0, quantity).map(x => String(x || "").trim().slice(0, 80));
  while (customNames.length < quantity) customNames.push("");
  const referralCode = String(req.body.referral || "").trim().toUpperCase();
  const ref = d.users.find(x => x.referralCode === referralCode && x.id !== u.id);
  const order = { id: id("ord"), userId: u.id, productId: p.id, productName: p.name, quantity,
    customNames, telegramId: u.telegramId, total, unitPrice: Number(p.price || 0), paymentMethod,
    discountCoupon: coupon?.code || "", referralCode: ref?.referralCode || "",
    receipt: req.file ? `/uploads/${req.file.filename}` : "", status: "pending", delivery: null, createdAt: now(), updatedAt: now() };
  if (coupon) coupon.uses = Number(coupon.uses || 0) + 1;
  d.orders.unshift(order); audit(d, u.id, "order.create", { orderId: order.id, total, quantity, paymentMethod }); write(d);
  adminNotifyNewOrder(order).catch(()=>{});
  res.json({ order, payment: { cardBank:d.settings.cardBank, cardNumber:d.settings.cardNumber, cardName:d.settings.cardName, instructions:d.settings.paymentInstructions, gatewayEnabled:d.settings.gatewayEnabled } });
});

/* Wheel: spins are granted only after approved purchases */
app.post("/api/wheel/spin", auth, (req, res) => {
  const d = read(), u = d.users.find(x => x.id === req.user.id);
  if (!d.wheel.active) return res.status(400).json({ error: "گردونه غیرفعال است." });
  const available = (d.wheel.spins || []).filter(x => x.userId === u.id && !x.used);
  if (!available.length) return res.status(400).json({ error: "چرخش رایگان ندارید." });
  const total = d.wheel.prizes.reduce((a, x) => a + Number(x.weight || 0), 0);
  if (Math.abs(total - 100) > 0.0001) return res.status(400).json({ error: "درصدهای گردونه باید دقیقاً ۱۰۰٪ باشند." });
  let n = Math.random() * total, win = d.wheel.prizes[0];
  for (const p of d.wheel.prizes) { n -= Number(p.weight || 0); if (n <= 0) { win = p; break; } }
  const spin = available[0]; spin.used = true; spin.reward = win.title; spin.usedAt = now();
  let result = { ...win };
  if (win.type === "points") u.points = Number(u.points || 0) + Number(win.value || 0);
  if (win.type === "coupon") {
    const code = `SPIN${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    d.coupons.push({ id:id("cpn"), code, type:"percent", value:Number(win.value||0), maxUses:1, uses:0, expiresAt:new Date(Date.now()+7*86400000).toISOString(), active:true, userId:u.id }); result.couponCode=code;
  }
  write(d); res.json({ prize: result, remaining: d.wheel.spins.filter(x => x.userId === u.id && !x.used).length });
});

/* Admin dashboard */
app.get("/api/admin/dashboard", admin, (req, res) => {
  const d = read();
  const sales = d.orders.filter(x => ["approved", "delivered"].includes(x.status))
    .reduce((a, x) => a + Number(x.total || 0), 0);
  res.json({
    users: d.users.length, products: d.products.length, orders: d.orders.length,
    pending: d.orders.filter(x => x.status === "pending").length, sales,
    services: d.services.length, tickets: d.tickets.filter(x => x.status !== "closed").length
  });
});

/* Admin user search: Telegram ID/name/username */
app.get("/api/admin/users/search", admin, (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  if (!q) return res.json([]);
  const d = read();
  const result = d.users.filter(u =>
    String(u.telegramId).includes(q) ||
    String(u.name || "").toLowerCase().includes(q) ||
    String(u.username || "").toLowerCase().includes(q)
  ).slice(0, 50).map(publicUser);
  res.json(result);
});
app.get("/api/admin/users/:id", admin, (req, res) => {
  const d = read(), u = d.users.find(x => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: "کاربر یافت نشد." });
  res.json({
    user: publicUser(u),
    orders: d.orders.filter(x => x.userId === u.id),
    services: d.services.filter(x => x.userId === u.id),
    tickets: d.tickets.filter(x => x.userId === u.id),
    notifications: d.notifications.filter(x => x.userId === u.id)
  });
});

/* Admin full state (secrets excluded) */
app.get("/api/admin/all", admin, (req, res) => {
  const d = read();
  res.json({
    settings: {
      siteName: d.settings.siteName, siteNameEn: d.settings.siteNameEn,
      supportId: d.settings.supportId, botId: d.settings.botId, channelId: d.settings.channelId,
      botConfigured: Boolean(d.settings.botToken), adminBotConfigured: Boolean(d.settings.adminBotToken), ownerId: d.settings.ownerId,
      telegramEnabled: d.settings.telegramEnabled, cardNumber: d.settings.cardNumber,
      cardName: d.settings.cardName, cardBank: d.settings.cardBank, paymentInstructions: d.settings.paymentInstructions,
      receiptText: d.settings.receiptText, approvalText: d.settings.approvalText, rejectionText: d.settings.rejectionText,
      gatewayEnabled: Boolean(d.settings.gatewayEnabled), gatewayUrl: d.settings.gatewayUrl, currency: d.settings.currency, maintenance: d.settings.maintenance
    },
    categories: d.categories, products: d.products, orders: d.orders,
    users: d.users.map(publicUser), services: d.services, tickets: d.tickets,
    coupons: d.coupons, servers: d.servers, notifications: d.notifications,
    flashSale: d.flashSale, wheel: d.wheel, missions: d.missions,
    referrals: d.referrals, audit: d.audit.slice(0, 300)
  });
});

/* Admin settings: bot token + bot ID + owner/admin ID + support ID + channel ID */
app.put("/api/admin/settings", admin, (req, res) => {
  const d = read();
  const allowed = [
    "siteName","siteNameEn","supportId","botId","channelId","botToken","adminBotToken","ownerId",
    "telegramEnabled","cardNumber","cardName","cardBank","paymentInstructions","receiptText","approvalText","rejectionText","gatewayEnabled","gatewayUrl","currency","maintenance"
  ];
  for (const k of allowed) if (req.body[k] !== undefined) d.settings[k] = req.body[k];
  audit(d, req.user.username || req.user.id, "settings.update", { keys: Object.keys(req.body) });
  write(d);
  res.json({ ok: true, botConfigured: Boolean(d.settings.botToken) });
  if (Object.prototype.hasOwnProperty.call(req.body, "botToken") || Object.prototype.hasOwnProperty.call(req.body, "telegramEnabled")) setTimeout(startTelegram, 100);
  if (Object.prototype.hasOwnProperty.call(req.body, "adminBotToken")) setTimeout(startAdminBot, 100);
});

/* Product/category/server management */
app.post("/api/admin/categories", admin, (req, res) => {
  const d = read();
  const x = {
    id: req.body.id || id("cat"), name: String(req.body.name || ""),
    nameEn: String(req.body.nameEn || req.body.name || ""),
    active: req.body.active !== false, sort: Number(req.body.sort || 0)
  };
  const i = d.categories.findIndex(a => a.id === x.id);
  if (i >= 0) d.categories[i] = x; else d.categories.push(x);
  write(d); res.json({ category: x });
});
app.delete("/api/admin/categories/:id", admin, (req, res) => {
  const d = read(); d.categories = d.categories.filter(x => x.id !== req.params.id);
  write(d); res.json({ ok: true });
});
app.post("/api/admin/products", admin, (req, res) => {
  const d = read(), old = d.products.find(x => x.id === req.body.id);
  const x = {
    ...(old || {}), id: req.body.id || id("prd"),
    name: String(req.body.name || old?.name || ""),
    nameEn: String(req.body.nameEn || old?.nameEn || req.body.name || ""),
    category: req.body.category || old?.category || "wireguard",
    protocol: req.body.protocol || old?.protocol || "WireGuard",
    price: Number(req.body.price ?? old?.price ?? 0),
    duration: String(req.body.duration ?? old?.duration ?? ""),
    volume: String(req.body.volume ?? old?.volume ?? ""),
    server: String(req.body.server ?? old?.server ?? ""),
    ping: String(req.body.ping ?? old?.ping ?? ""),
    stock: Number(req.body.stock ?? old?.stock ?? 0),
    description: String(req.body.description ?? old?.description ?? ""),
    descriptionEn: String(req.body.descriptionEn ?? old?.descriptionEn ?? ""),
    features: Array.isArray(req.body.features) ? req.body.features :
      String(req.body.features ?? old?.features ?? "").split("\n").map(s => s.trim()).filter(Boolean),
    image: String(req.body.image ?? old?.image ?? ""),
    featured: Boolean(req.body.featured ?? old?.featured),
    active: req.body.active !== undefined ? Boolean(req.body.active) : old?.active !== false
  };
  const i = d.products.findIndex(a => a.id === x.id);
  if (i >= 0) d.products[i] = x; else d.products.push(x);
  audit(d, req.user.username, "product.save", { id: x.id });
  write(d); res.json({ product: x });
});
app.delete("/api/admin/products/:id", admin, (req, res) => {
  const d = read(); d.products = d.products.filter(x => x.id !== req.params.id);
  write(d); res.json({ ok: true });
});
app.post("/api/admin/servers", admin, (req, res) => {
  const d = read();
  const x = { id: req.body.id || id("srv"), name: String(req.body.name || ""),
    location: String(req.body.location || ""), ping: String(req.body.ping || ""),
    capacity: Number(req.body.capacity || 0), active: req.body.active !== false };
  const i = d.servers.findIndex(a => a.id === x.id);
  if (i >= 0) d.servers[i] = x; else d.servers.push(x);
  write(d); res.json({ server: x });
});

/* Admin order approval + manual delivery (.conf + QR + notes) */
app.post("/api/admin/orders/:id/status", admin, (req, res) => {
  const d = read(), o = d.orders.find(x => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: "سفارش یافت نشد." });
  const before = o.status, next = String(req.body.status || o.status);
  const p = d.products.find(x => x.id === o.productId);
  o.status = next; o.updatedAt = now();
  if (next === "approved" && before !== "approved") {
    if (p && Number(p.stock) > 0) p.stock = Math.max(0, Number(p.stock) - Number(o.quantity || 1));
    d.wheel.spins = d.wheel.spins || [];
    for (let i=0;i<Number(o.quantity||1);i++) d.wheel.spins.push({id:id("wspin"),userId:o.userId,orderId:o.id,used:false,createdAt:now()});
    const u=d.users.find(x=>x.id===o.userId); if(u) { const prior=d.orders.filter(x=>x.userId===u.id&&x.id!==o.id&&["approved","delivered"].includes(x.status)).length; if(prior===0){const m=d.missions.find(x=>x.id==="first-order"&&x.active); if(m)u.points=Number(u.points||0)+Number(m.reward||0);} if(o.referralCode&&d.referrals.enabled){const r=d.users.find(x=>x.referralCode===o.referralCode&&x.id!==o.userId);if(r)r.points=Number(r.points||0)+Number(d.referrals.reward||0);}}}
  if (next === "rejected" && ["approved","delivered"].includes(before) && p && Number(p.stock) > 0) p.stock = Number(p.stock) + Number(o.quantity || 1);
  audit(d, req.user.username, "order.status", { id:o.id, status:next }); write(d);
  notifyCustomerStatus(d,o,next).catch(()=>{}); res.json({ order:o });
});

app.post("/api/admin/orders/:id/delivery", admin, upload.single("config"), async (req, res) => {
  const d=read(), o=d.orders.find(x=>x.id===req.params.id); if(!o)return res.status(404).json({error:"سفارش یافت نشد."});
  const link=String(req.body.link||""); let qr=String(req.body.qr||""); if(link&&!qr){try{qr=await QRCode.toDataURL(link,{width:420,margin:2})}catch{}}
  const names=Array.isArray(o.customNames)?o.customNames:[o.customNames||""]; const base=String(req.body.serviceName||"").trim();
  o.status="delivered"; o.delivery={link,config:req.file?`/uploads/${req.file.filename}`:"",qr,notes:String(req.body.notes||""),deliveredAt:now(),services:[]};
  for(let i=0;i<Number(o.quantity||1);i++){const name=String(names[i]||base||`${o.productName} ${i+1}`).slice(0,80); const svc={id:id("svc"),userId:o.userId,orderId:o.id,productId:o.productId,title:name,link,config:o.delivery.config,qr,notes:o.delivery.notes,active:true,createdAt:now()}; d.services.push(svc); o.delivery.services.push(svc.id);}
  audit(d,req.user.username,"order.delivery",{id:o.id,quantity:o.quantity}); write(d); await telegramNotifyUser(d,o); res.json({order:o});
});

/* Tickets */
app.post("/api/tickets", auth, (req, res) => {
  const d = read();
  const t = { id: id("tic"), userId: req.user.id,
    subject: String(req.body.subject || "پشتیبانی").slice(0, 120),
    message: String(req.body.message || "").slice(0, 5000),
    status: "open", replies: [], createdAt: now(), updatedAt: now() };
  d.tickets.unshift(t); write(d); res.json({ ticket: t });
});
app.post("/api/admin/tickets/:id", admin, (req, res) => {
  const d = read(), t = d.tickets.find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: "تیکت یافت نشد." });
  if (req.body.status) t.status = req.body.status;
  if (req.body.reply) t.replies.push({ from: "admin", message: String(req.body.reply).slice(0, 5000), at: now() });
  t.updatedAt = now(); write(d); res.json({ ticket: t });
});

/* Coupons / flash / wheel / referrals / notifications */
app.post("/api/admin/coupons", admin, (req, res) => {
  const d = read();
  const x = { id: req.body.id || id("cpn"), code: String(req.body.code || "").toUpperCase(),
    type: req.body.type === "fixed" ? "fixed" : "percent", value: Number(req.body.value || 0),
    maxUses: Number(req.body.maxUses || 0), uses: Number(req.body.uses || 0),
    expiresAt: req.body.expiresAt || "", active: req.body.active !== false };
  const i = d.coupons.findIndex(a => a.id === x.id);
  if (i >= 0) d.coupons[i] = x; else d.coupons.push(x);
  write(d); res.json({ coupon: x });
});
app.put("/api/admin/flash-sale", admin, (req, res) => {
  const d = read();
  d.flashSale = { active: Boolean(req.body.active), percent: Number(req.body.percent || 0),
    start: req.body.start || "", end: req.body.end || "" };
  write(d); res.json(d.flashSale);
});
app.put("/api/admin/wheel", admin, (req, res) => {
  const d = read();
  d.wheel = { active: Boolean(req.body.active), dailyLimit: Number(req.body.dailyLimit || 1),
    prizes: Array.isArray(req.body.prizes) ? req.body.prizes : [] };
  write(d); res.json(d.wheel);
});
app.put("/api/admin/missions", admin, (req, res) => {
  const d = read(); d.missions = Array.isArray(req.body.missions) ? req.body.missions : [];
  write(d); res.json(d.missions);
});
app.put("/api/admin/referrals", admin, (req, res) => {
  const d = read(); d.referrals = { enabled: Boolean(req.body.enabled), reward: Number(req.body.reward || 0) };
  write(d); res.json(d.referrals);
});
app.post("/api/admin/notifications", admin, (req, res) => {
  const d = read();
  const n = { id: id("not"), title: String(req.body.title || ""),
    message: String(req.body.message || ""), userId: req.body.userId || "", createdAt: now() };
  d.notifications.unshift(n); write(d); res.json(n);
});
app.get("/api/admin/qr", admin, async (req, res) => {
  try { res.json({ data: await QRCode.toDataURL(String(req.query.text || ""), { width: 420, margin: 2 }) }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.get("/api/admin/backup", owner, (req, res) => {
  const d = read();
  d.settings.botToken = "";
  res.setHeader("Content-Disposition", `attachment; filename=sami-backup-${Date.now()}.json`);
  res.json(d);
});

/* Private Admin Control Bot (separate from the existing sales bot) */
let adminBot=null, adminBotTokenActive="";
async function stopAdminBot(){if(adminBot){try{await adminBot.stopPolling()}catch{}} adminBot=null; adminBotTokenActive="";}
async function startAdminBot(){const d=read(),token=String(d.settings.adminBotToken||""); if(!token||process.env.ADMIN_BOT_POLLING==="false"){await stopAdminBot();return;} if(adminBot&&adminBotTokenActive===token)return; await stopAdminBot(); try{adminBot=new TelegramBot(token,{polling:true}); adminBotTokenActive=token;
  const allowed=()=>{const ids=String(process.env.ADMIN_TELEGRAM_IDS||d.settings.ownerId||"").split(",").map(x=>x.trim()).filter(Boolean); return ids;};
  const guard=(m)=>allowed().includes(String(m.from.id));
  adminBot.onText(/^\/start/,m=>{if(guard(m))adminBot.sendMessage(m.chat.id,"Sami WireGuard Admin Control\n/orders\n/stats\n/settings");});
  adminBot.onText(/^\/stats/,m=>{if(!guard(m))return;const dd=read();adminBot.sendMessage(m.chat.id,`👤 کاربران: ${dd.users.length}\n🧾 سفارش: ${dd.orders.length}\n⏳ در انتظار: ${dd.orders.filter(x=>x.status==='pending').length}\n💰 فروش تأییدشده: ${dd.orders.filter(x=>['approved','delivered'].includes(x.status)).reduce((a,x)=>a+Number(x.total||0),0)}`)});
  adminBot.onText(/^\/orders/,async m=>{if(!guard(m))return;const dd=read(),os=dd.orders.filter(x=>x.status==='pending').slice(0,10);if(!os.length)return adminBot.sendMessage(m.chat.id,"سفارش در انتظار ندارید.");for(const o of os){await adminBot.sendMessage(m.chat.id,`🧾 سفارش ${o.id}\nTelegram ID: ${o.telegramId}\nمحصول: ${o.productName}\nتعداد: ${o.quantity}\nمبلغ: ${o.total}\nپرداخت: ${o.paymentMethod}`,{reply_markup:{inline_keyboard:[[{text:"✅ تأیید",callback_data:`approve:${o.id}`},{text:"❌ رد",callback_data:`reject:${o.id}`}]]}});if(o.receipt&&process.env.PUBLIC_URL)await adminBot.sendMessage(m.chat.id,`${process.env.PUBLIC_URL}${o.receipt}`)}});
  adminBot.on("callback_query",async q=>{if(!guard(q))return;const [action,oid]=String(q.data||"").split(":");if(!["approve","reject"].includes(action))return;const dd=read(),o=dd.orders.find(x=>x.id===oid);if(!o)return;const p=dd.products.find(x=>x.id===o.productId);if(action==='approve'&&o.status!=='approved'){o.status='approved';if(p&&Number(p.stock)>0)p.stock=Math.max(0,Number(p.stock)-Number(o.quantity||1));dd.wheel.spins=dd.wheel.spins||[];for(let i=0;i<Number(o.quantity||1);i++)dd.wheel.spins.push({id:id('wspin'),userId:o.userId,orderId:o.id,used:false,createdAt:now()});write(dd);await adminBot.answerCallbackQuery(q.id,{text:'پرداخت تأیید شد'});await adminBot.editMessageReplyMarkup({inline_keyboard:[]},{chat_id:q.message.chat.id,message_id:q.message.message_id});notifyCustomerStatus(dd,o,'approved').catch(()=>{});}else if(action==='reject'){o.status='rejected';write(dd);await adminBot.answerCallbackQuery(q.id,{text:'سفارش رد شد'});notifyCustomerStatus(dd,o,'rejected').catch(()=>{});}});
  adminBot.on("polling_error",()=>{});
 }catch(e){console.error('Admin bot start failed:',e.message);adminBot=null;adminBotTokenActive="";}}
async function adminNotifyNewOrder(o){const d=read(),token=String(d.settings.adminBotToken||"");if(!token)return;const ids=String(process.env.ADMIN_TELEGRAM_IDS||d.settings.ownerId||"").split(",").map(x=>x.trim()).filter(Boolean);if(!ids.length)return;try{const b=new TelegramBot(token,{polling:false});const text=`🔔 سفارش جدید\n🧾 ${o.id}\n👤 Telegram ID: ${o.telegramId}\n📦 ${o.productName}\n🔢 تعداد: ${o.quantity}\n💰 مبلغ: ${o.total}\n💳 پرداخت: ${o.paymentMethod}`;for(const chat of ids){await b.sendMessage(chat,text,{reply_markup:{inline_keyboard:[[{text:'✅ تأیید پرداخت',callback_data:`approve:${o.id}`},{text:'❌ رد پرداخت',callback_data:`reject:${o.id}`}]]}});if(o.receipt&&process.env.PUBLIC_URL)await b.sendMessage(chat,`${process.env.PUBLIC_URL}${o.receipt}`)}}catch{}}
async function notifyCustomerStatus(d,o,status){const u=d.users.find(x=>x.id===o.userId),token=d.settings.botToken;if(!token||!u?.telegramId)return;try{const b=new TelegramBot(token,{polling:false});if(status==='approved')await b.sendMessage(u.telegramId,`${d.settings.approvalText}\n🧾 ${o.id}\n🎁 ${o.quantity} چرخش رایگان`);if(status==='rejected')await b.sendMessage(u.telegramId,d.settings.rejectionText+`\n🧾 ${o.id}`)}catch{}}

/* Telegram bot */
let bot = null;
let botTokenActive = "";
async function stopTelegram() {
  if (bot) { try { await bot.stopPolling(); } catch {} }
  bot = null; botTokenActive = "";
}
async function startTelegram() {
  const d = read(), token = String(d.settings.botToken || "");
  if (!token || d.settings.telegramEnabled === false || process.env.TELEGRAM_POLLING === "false") {
    await stopTelegram(); return;
  }
  if (bot && botTokenActive === token) return;
  await stopTelegram();
  try {
    bot = new TelegramBot(token, { polling: true });
    botTokenActive = token;

    bot.onText(/^\/start/, async m => {
      await bot.sendMessage(m.chat.id,
        `به ${d.settings.siteName} خوش آمدید.\n\n` +
        `/id — نمایش Telegram ID\n/products — محصولات\n/orders — سفارش‌های من\n/support — پشتیبانی`);
    });
    bot.onText(/^\/id/, m => bot.sendMessage(m.chat.id, `Telegram ID شما: ${m.from.id}`));
    bot.onText(/^\/products/, async m => {
      const dd = read();
      const text = dd.products.filter(x => x.active).slice(0, 20)
        .map(x => `• ${x.name} — ${x.price} ${dd.settings.currency}\nخرید از سایت: /buy_${x.id}`).join("\n");
      bot.sendMessage(m.chat.id, text || "محصولی موجود نیست.");
    });
    bot.onText(/^\/orders/, m => {
      const dd = read(), u = dd.users.find(x => x.telegramId === String(m.from.id));
      if (!u) return bot.sendMessage(m.chat.id, "ابتدا در سایت با Telegram ID ثبت‌نام کنید.");
      const os = dd.orders.filter(x => x.userId === u.id).slice(0, 10);
      bot.sendMessage(m.chat.id, os.length
        ? os.map(x => `${x.id} | ${x.productName} | ${x.status}`).join("\n")
        : "سفارشی ندارید.");
    });
    bot.onText(/^\/support/, m => {
      const dd = read();
      bot.sendMessage(m.chat.id, `پشتیبانی: @${String(dd.settings.supportId).replace(/^@/, "")}`);
    });
    bot.onText(/^\/buy_(.+)/, m => {
      const dd = read(), p = dd.products.find(x => x.id === m[1] && x.active);
      if (!p) return bot.sendMessage(m.chat.id, "محصول پیدا نشد.");
      bot.sendMessage(m.chat.id,
        `${p.name}\nقیمت: ${p.price} ${dd.settings.currency}\n\n` +
        `برای خرید به سایت مراجعه کنید:\nhttps://t.me/${String(dd.settings.botId).replace(/^@/, "")}`);
    });
    bot.on("polling_error", () => {});
  } catch (e) {
    console.error("Telegram bot start failed:", e.message);
    bot = null; botTokenActive = "";
  }
}
async function telegramNotifyUser(d, order) {
  const token = d.settings.botToken, u = d.users.find(x => x.id === order.userId);
  if (!token || !u?.telegramId) return;
  try {
    const b = new TelegramBot(token, { polling: false });
    await b.sendMessage(u.telegramId,
      `سفارش ${order.id} تحویل شد.\n${order.productName}\n` +
      (order.delivery?.link ? `لینک: ${order.delivery.link}\n` : "") +
      (order.delivery?.config ? `فایل کانفیگ: ${order.delivery.config}\n` : "") +
      (order.delivery?.notes ? `یادداشت: ${order.delivery.notes}` : ""));
  } catch {}
}

/* Static files */
app.use("/uploads", express.static(UPLOADS, { maxAge: "1h" }));
app.use((req, res, next) => {
  if (/^\/(?:server\.js|package(?:-lock)?\.json|\.env(?:\.|$)|README\.md|data(?:\/|$)|\.gitignore|render\.yaml)/i.test(req.path))
    return res.status(404).end();
  next();
});
app.use(express.static(ROOT));
app.get("/admin", (req, res) => res.sendFile(path.join(ROOT, "admin.html")));
app.get("/dashboard", (req, res) => res.sendFile(path.join(ROOT, "dashboard.html")));
app.get("*", (req, res) => res.sendFile(path.join(ROOT, "index.html")));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "خطای داخلی سرور." });
});

app.listen(PORT, () => {
  console.log(`Sami WireGuard 6.0.0 listening on ${PORT}`);
  startTelegram();
  startAdminBot();
});
