const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 10000;
const DATA_FILE = path.join(__dirname, "data.json");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const adminSessions = new Set();

app.use(express.json({ limit: "2mb" }));
const PUBLIC_DIR = path.join(__dirname, "public");
const ROOT_INDEX = path.join(__dirname, "index.html");
const ROOT_ADMIN = path.join(__dirname, "admin.html");
const PUBLIC_INDEX = path.join(PUBLIC_DIR, "index.html");
const PUBLIC_ADMIN = path.join(PUBLIC_DIR, "admin.html");
const STATIC_DIR = fs.existsSync(PUBLIC_INDEX) ? PUBLIC_DIR : __dirname;
app.use(express.static(STATIC_DIR));
// Also serve public assets when the deployment contains both root and public files.
if (STATIC_DIR !== __dirname && fs.existsSync(ROOT_INDEX)) app.use(express.static(__dirname));

const initial = {
  brand: "Sami WireGuard",
  supportUsername: process.env.SUPPORT_USERNAME || "saman_s87",
  channelUrl: process.env.CHANNEL_URL || "https://t.me/SamiWireGuard",
  announcement: "اتصال پایدار، مدیریت ساده و خرید سریع",
  services: [
    { id: "wireguard-gaming", name: "WireGuard Gaming", subtitle: "اتصال گیمینگ و اشتراک وایرگارد", icon: "◈", enabled: true, accent: "blue", plans: [
      { id: "wg10", title: "۱۰ گیگابایت", volume: "10 GB", days: 30, price: 160000, enabled: true },
      { id: "wg20", title: "۲۰ گیگابایت", volume: "20 GB", days: 30, price: 290000, enabled: true },
      { id: "wg50", title: "۵۰ گیگابایت", volume: "50 GB", days: 30, price: 590000, enabled: true }
    ]},
    { id: "dns-dynamite", name: "DNS Dynamite", subtitle: "سرویس DNS جداگانه", icon: "⌁", enabled: true, accent: "cyan", plans: [
      { id: "dns30", title: "۳۰ روزه", volume: "DNS", days: 30, price: 50000, enabled: true }
    ]},
    { id: "vitory", name: "Vitory", subtitle: "سرویس Vitory با ۱۳ لوکیشن", icon: "✦", enabled: true, accent: "purple", plans: [
      { id: "vit4", title: "۴ گیگابایت", volume: "4 GB", days: 30, price: 100000, enabled: true }
    ]}
  ],
  storeStatus: { online: true, message: "ثبت سفارش فعال است؛ تحویل سرویس پس از بررسی سفارش انجام می‌شود." },
  benefits: ["مدیریت ساده بسته‌ها و سفارش‌ها", "پشتیبانی مستقیم از طریق تلگرام", "انتخاب سرویس متناسب با نیازت", "نمایش شفاف قیمت و مدت اعتبار"],
  faqs: [
    { q: "بعد از ثبت سفارش چه کار کنم؟", a: "کد سفارش را نگه دار و برای هماهنگی پرداخت و تحویل با پشتیبانی تماس بگیر." },
    { q: "WireGuard و DNS چه فرقی دارند؟", a: "WireGuard یک تونل شبکه است؛ DNS Dynamite یک سرویس DNS جداگانه است. این دو محصول یکسان نیستند." },
    { q: "آیا خرید و تحویل خودکار است؟", a: "در نسخه فعلی سفارش ثبت می‌شود و تأیید پرداخت و تحویل خودکار فقط پس از اتصال درگاه و پنل تأمین‌کننده فعال خواهد شد." },
    { q: "چطور سفارش قبلی را پیگیری کنم؟", a: "کد سفارش را از پیام ثبت سفارش بردار و برای پشتیبانی بفرست." }
  ],
  promo: { enabled: true, title: "باشگاه مشتریان سامی", message: "برای اطلاع از پیشنهادها و بسته‌های جدید، کانال رسمی را دنبال کن." },
  roulette: { enabled: true, title: "گردونه شانس سامی" },
  integration: { miniAppUrl: process.env.MINI_APP_URL || "", title: process.env.MINI_APP_TITLE || "Sami WireGuard", apiKey: "", botUsername: "", lastSync: null, lastTest: null },
  payment: { cardNumber: "", cardHolder: "", bankName: "", paymentNote: "پس از واریز، رسید را بارگذاری کن." },
  orders: []
};

function readData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch { fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2)); return structuredClone(initial); }
}
function saveData(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }
function safePublic(data) {
  return { brand: data.brand, announcement: data.announcement, supportUsername: data.supportUsername || "saman_s87", channelUrl: data.channelUrl || "https://t.me/SamiWireGuard",
    services: data.services.map(s => ({ ...s, plans: s.plans || [] })),
    roulette: { enabled: !!data.roulette?.enabled, title: data.roulette?.title || "گردونه شانس سامی" },
    storeStatus: data.storeStatus || { online: true, message: "ثبت سفارش فعال است." },
    benefits: Array.isArray(data.benefits) ? data.benefits.slice(0, 12) : [],
    faqs: Array.isArray(data.faqs) ? data.faqs.slice(0, 20) : [],
    promo: data.promo || { enabled: false, title: "باشگاه مشتریان سامی", message: "" },
    payment: { cardNumber: data.payment?.cardNumber || "", cardHolder: data.payment?.cardHolder || "", bankName: data.payment?.bankName || "", paymentNote: data.payment?.paymentNote || "" } };
}
function adminOnly(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !adminSessions.has(token)) return res.status(401).json({ error: "دسترسی مدیر تأیید نشد." });
  next();
}
app.get("/api/config", (req, res) => res.json(safePublic(readData())));

app.post("/api/admin/login", (req, res) => {
  if (!ADMIN_PASSWORD) return res.status(503).json({ error: "ابتدا ADMIN_PASSWORD را در Environment رندر تنظیم کن." });
  if (!req.body || req.body.password !== ADMIN_PASSWORD) return res.status(401).json({ error: "رمز عبور اشتباه است." });
  const token = crypto.randomBytes(32).toString("hex");
  adminSessions.add(token);
  res.json({ token });
});

app.get("/api/admin/config", adminOnly, (req, res) => res.json(readData()));

// Admin-managed connection settings. API key is only returned to authenticated admins.
app.put("/api/admin/integration", adminOnly, (req, res) => {
  const data = readData(), body = req.body || {};
  const url = String(body.miniAppUrl || "").trim();
  if (url && !/^https:\/\//i.test(url)) return res.status(400).json({ error: "آدرس باید با https:// شروع شود." });
  data.integration = { ...(data.integration || {}), miniAppUrl: url.slice(0, 300), title: String(body.title || "Sami WireGuard").slice(0, 80), botUsername: String(body.botUsername || "").replace(/^@/, "").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 40), apiKey: String(body.apiKey || data.integration?.apiKey || "").slice(0, 200), updatedAt: new Date().toISOString() };
  saveData(data); res.json({ ok: true, integration: data.integration });
});
app.post("/api/admin/integration/key", adminOnly, (req, res) => {
  const data = readData(); data.integration = data.integration || {};
  data.integration.apiKey = crypto.randomBytes(32).toString("hex"); data.integration.updatedAt = new Date().toISOString(); saveData(data);
  res.json({ ok: true, apiKey: data.integration.apiKey });
});
app.post("/api/admin/integration/test", adminOnly, async (req, res) => {
  const data = readData(), i = data.integration || {};
  const results = { site: true, apiKey: !!i.apiKey, url: /^https:\/\//i.test(i.miniAppUrl || ""), bot: false, notes: [] };
  if (!results.apiKey) results.notes.push("کلید API ساخته نشده است.");
  if (!results.url) results.notes.push("آدرس HTTPS مینی‌اپ ثبت نشده است.");
  if (i.botUsername) results.notes.push("نام کاربری ربات ثبت شده؛ برای تست واقعی ربات باید کد ربات از API این سایت استفاده کند.");
  else results.notes.push("نام کاربری ربات ثبت نشده است.");
  data.integration = { ...i, lastTest: { at: new Date().toISOString(), results } }; saveData(data);
  res.json({ ok: true, results, message: results.apiKey && results.url ? "تنظیمات اولیه آماده‌اند؛ اتصال واقعی ربات بعد از افزودن کد API به ربات قابل تأیید است." : "تنظیمات اتصال کامل نیست." });
});
function integrationOnly(req, res, next) {
  const data = readData(), expected = data.integration?.apiKey || process.env.INTEGRATION_API_KEY || "";
  const provided = req.headers["x-secret-key"] || req.headers["x-api-key"] || "";
  if (!expected || !provided || Buffer.byteLength(String(provided)) !== Buffer.byteLength(String(expected)) || !crypto.timingSafeEqual(Buffer.from(String(provided)), Buffer.from(String(expected)))) return res.status(401).json({ error: "API key نامعتبر است." });
  next();
}
// Bot-side integration endpoints: the bot can pull catalog, push catalog changes, and send order updates.
app.get("/api/integration/catalog", integrationOnly, (req, res) => { const d = readData(); res.json({ ok: true, updatedAt: new Date().toISOString(), services: d.services }); });
app.put("/api/integration/catalog", integrationOnly, (req, res) => {
  const data = readData(), incoming = req.body?.services;
  if (!Array.isArray(incoming) || incoming.length > 30) return res.status(400).json({ error: "فهرست services نامعتبر است." });
  const cleaned = incoming.map((s, i) => ({ id: String(s.id || `bot-service-${i}`).toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0,48), name: String(s.name || "سرویس جدید").slice(0,60), subtitle: String(s.subtitle || "").slice(0,120), icon: String(s.icon || "✦").slice(0,5), accent: ["blue","purple","cyan","green","gold","red"].includes(s.accent) ? s.accent : "blue", enabled: s.enabled !== false, plans: (Array.isArray(s.plans) ? s.plans : []).slice(0,40).map((p,j)=>({ id:String(p.id || `plan-${i}-${j}`).toLowerCase().replace(/[^a-z0-9_-]/g,"").slice(0,50), title:String(p.title || "بسته").slice(0,70), volume:String(p.volume || "").slice(0,30), days:Math.max(1,Math.min(3650,Number(p.days)||30)), price:Math.max(0,Math.round(Number(p.price)||0)), enabled:p.enabled !== false })) }));
  data.services = cleaned; data.integration = { ...(data.integration||{}), lastSync: new Date().toISOString() }; saveData(data); res.json({ ok:true, count:cleaned.length, lastSync:data.integration.lastSync });
});
app.post("/api/integration/orders/:id/status", integrationOnly, (req, res) => {
  const data = readData(), order = data.orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "سفارش پیدا نشد." });
  const status = req.body?.status; if (!["pending","approved","rejected","fulfilled"].includes(status)) return res.status(400).json({ error: "وضعیت نامعتبر است." });
  order.status = status; if (status === "approved" || status === "fulfilled") order.updatedAt = new Date().toISOString();
  data.integration = { ...(data.integration||{}), lastSync: new Date().toISOString() }; saveData(data); res.json({ ok:true, order });
});
app.put("/api/admin/config", adminOnly, (req, res) => {
  const current = readData(), incoming = req.body || {};
  if (typeof incoming.announcement === "string") current.announcement = incoming.announcement.slice(0, 240);
  if (typeof incoming.supportUsername === "string") current.supportUsername = incoming.supportUsername.replace(/^@/, "").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 40);
  if (typeof incoming.channelUrl === "string" && /^https:\/\/t\.me\/[a-zA-Z0-9_]+/.test(incoming.channelUrl)) current.channelUrl = incoming.channelUrl.slice(0, 160);
  if (incoming.roulette && typeof incoming.roulette.enabled === "boolean") {
    current.roulette = { enabled: incoming.roulette.enabled, title: String(incoming.roulette.title || "گردونه شانس سامی").slice(0, 70) };
  }
  if (incoming.storeStatus && typeof incoming.storeStatus.online === "boolean") current.storeStatus = { online: incoming.storeStatus.online, message: String(incoming.storeStatus.message || "").slice(0, 240) };
  if (Array.isArray(incoming.benefits)) current.benefits = incoming.benefits.slice(0, 12).map(x => String(x).slice(0, 160)).filter(Boolean);
  if (Array.isArray(incoming.faqs)) current.faqs = incoming.faqs.slice(0, 20).map(x => ({ q: String(x.q || "").slice(0, 160), a: String(x.a || "").slice(0, 500) })).filter(x => x.q && x.a);
  if (incoming.promo && typeof incoming.promo.enabled === "boolean") current.promo = { enabled: incoming.promo.enabled, title: String(incoming.promo.title || "باشگاه مشتریان سامی").slice(0, 80), message: String(incoming.promo.message || "").slice(0, 240) };
  if (incoming.payment && typeof incoming.payment === "object") current.payment = { cardNumber: String(incoming.payment.cardNumber || "").replace(/[^0-9 -]/g, "").slice(0, 30), cardHolder: String(incoming.payment.cardHolder || "").slice(0, 100), bankName: String(incoming.payment.bankName || "").slice(0, 80), paymentNote: String(incoming.payment.paymentNote || "").slice(0, 300) };
  if (Array.isArray(incoming.services)) {
    const cleaned = [];
    for (const raw of incoming.services.slice(0, 30)) {
      const id = String(raw.id || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 48);
      if (!id || !raw.name) continue;
      const previous = current.services.find(x => x.id === id);
      cleaned.push({
        id, name: String(raw.name).slice(0, 60),
        subtitle: String(raw.subtitle || raw.description || "سرویس ویژه سامی").slice(0, 120),
        icon: String(raw.icon || "✦").slice(0, 5),
        accent: ["blue", "purple", "cyan", "green", "gold", "red"].includes(raw.accent || raw.color) ? (raw.accent || raw.color) : "blue",
        enabled: raw.enabled !== false,
        plans: (Array.isArray(raw.plans) ? raw.plans : (previous?.plans || [])).slice(0, 40).map((p, i) => ({
          id: String(p.id || `${id}-${i+1}`).toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 50),
          title: String(p.title || p.name || "بسته").slice(0, 70), volume: String(p.volume || "").slice(0, 30),
          days: Math.max(1, Math.min(3650, Number(p.days) || 30)), price: Math.max(0, Math.round(Number(p.price) || 0)), enabled: p.enabled !== false
        }))
      });
    }
    current.services = cleaned;
  }
  saveData(current); res.json({ ok: true, config: safePublic(current) });
});

// Demo order intake: saves a pending request. It does NOT charge money or provision VPN access.
app.post("/api/orders", (req, res) => {
  const data = readData();
  if (data.storeStatus?.online === false) return res.status(503).json({ error: data.storeStatus.message || "ثبت سفارش موقتاً متوقف است." });
  const { serviceId, planId, telegramUserId, username } = req.body || {};
  const service = data.services.find(s => s.id === serviceId && s.enabled);
  const plan = service && service.plans.find(p => p.id === planId && p.enabled !== false);
  if (!service || !plan) return res.status(400).json({ error: "این سرویس یا بسته فعلاً در دسترس نیست." });
  const order = {
    id: "SW-" + crypto.randomBytes(4).toString("hex").toUpperCase(),
    serviceId, serviceName: service.name, planId, planTitle: plan.title, price: plan.price,
    telegramUserId: String(telegramUserId || "").slice(0, 40),
    username: String(username || "").slice(0, 80),
    status: "pending", createdAt: new Date().toISOString()
  };
  data.orders.unshift(order);
  data.orders = data.orders.slice(0, 500);
  saveData(data);
  res.json({ ok: true, order });
});

app.post("/api/orders/:id/receipt", (req, res) => {
  const data = readData(), order = data.orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "سفارش پیدا نشد." });
  const { imageData, telegramUserId } = req.body || {};
  if (order.telegramUserId && String(telegramUserId || "") !== order.telegramUserId) return res.status(403).json({ error: "این سفارش متعلق به این کاربر نیست." });
  if (typeof imageData !== "string" || !/^data:image\/(png|jpeg|webp);base64,/.test(imageData) || imageData.length > 1200000) return res.status(400).json({ error: "تصویر معتبر نیست؛ PNG/JPG/WebP تا حدود 850 کیلوبایت مجاز است." });
  order.receiptImage = imageData; order.receiptUploadedAt = new Date().toISOString(); order.paymentStatus = "receipt_submitted"; saveData(data);
  res.json({ ok: true, message: "رسید ثبت شد و منتظر بررسی مدیر است." });
});
app.get("/api/admin/orders", adminOnly, (req, res) => res.json(readData().orders));
app.patch("/api/admin/orders/:id", adminOnly, (req, res) => {
  const data = readData();
  const order = data.orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "سفارش پیدا نشد." });
  const status = req.body && req.body.status;
  if (!["pending", "approved", "rejected", "fulfilled"].includes(status)) return res.status(400).json({ error: "وضعیت نامعتبر است." });
  order.status = status;
  saveData(data);
  res.json({ ok: true, order });
});

app.post("/api/roulette/spin", (_, res) => res.status(503).json({ error: "گردونه فعلاً نمایشی است؛ برای جایزه واقعی باید هویت تلگرام و محدودیت ضدتقلب سمت سرور تکمیل شود." }));
app.get("/health", (_, res) => res.json({ ok: true, service: "Sami WireGuard Mini App", timestamp: new Date().toISOString() }));
app.get("/api/connection/status", (req, res) => {
  const data = readData();
  const baseUrl = process.env.MINI_APP_URL || "";
  res.json({
    active: true,
    title: data.integration?.title || process.env.MINI_APP_TITLE || "مینی‌اپ اختصاصی",
    urlConfigured: /^https:\/\//i.test(data.integration?.miniAppUrl || baseUrl),
    url: /^https:\/\//i.test(data.integration?.miniAppUrl || baseUrl) ? (data.integration?.miniAppUrl || baseUrl) : "",
    purchaseSystem: true,
    paymentSystem: false,
    paymentNote: "ثبت سفارش فعال است؛ درگاه پرداخت واقعی هنوز متصل نشده است.",
    telegramIdentityValidation: false,
    lastSync: data.integration?.lastSync || null,
    integrationApiReady: !!data.integration?.apiKey,
    lastTest: data.integration?.lastTest || null,
    services: data.services.map(s => ({ id: s.id, name: s.name, enabled: !!s.enabled })),
    checkedAt: new Date().toISOString()
  });
});
app.get(["/admin", "/admin.html"], (_, res) => {
  const file = fs.existsSync(PUBLIC_ADMIN) ? PUBLIC_ADMIN : ROOT_ADMIN;
  if (!fs.existsSync(file)) return res.status(404).send("Admin page not found. Ensure admin.html is included in the deployment ZIP.");
  return res.sendFile(file);
});
app.get("*", (req, res) => {
  const file = fs.existsSync(PUBLIC_INDEX) ? PUBLIC_INDEX : ROOT_INDEX;
  if (!fs.existsSync(file)) {
    console.error("Frontend entrypoint missing. Checked:", PUBLIC_INDEX, ROOT_INDEX);
    return res.status(500).type("text/plain").send("Sami WireGuard frontend file is missing. Ensure index.html is in the project root or public/ folder, then redeploy.");
  }
  return res.sendFile(file);
});
app.listen(PORT, "0.0.0.0", () => console.log(`Sami Mini App listening on ${PORT}`));
