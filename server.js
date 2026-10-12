const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 10000;
const DATA_FILE = path.join(__dirname, "data.json");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const adminSessions = new Set();

app.use(express.json({ limit: "200kb" }));
app.use(express.static(path.join(__dirname, "public")));

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
  roulette: { enabled: true, title: "گردونه شانس سامی" },
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
    roulette: { enabled: !!data.roulette?.enabled, title: data.roulette?.title || "گردونه شانس سامی" } };
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
app.put("/api/admin/config", adminOnly, (req, res) => {
  const current = readData(), incoming = req.body || {};
  if (typeof incoming.announcement === "string") current.announcement = incoming.announcement.slice(0, 240);
  if (typeof incoming.supportUsername === "string") current.supportUsername = incoming.supportUsername.replace(/^@/, "").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 40);
  if (typeof incoming.channelUrl === "string" && /^https:\/\/t\.me\/[a-zA-Z0-9_]+/.test(incoming.channelUrl)) current.channelUrl = incoming.channelUrl.slice(0, 160);
  if (incoming.roulette && typeof incoming.roulette.enabled === "boolean") {
    current.roulette = { enabled: incoming.roulette.enabled, title: String(incoming.roulette.title || "گردونه شانس سامی").slice(0, 70) };
  }
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

app.get("/api/admin/orders", adminOnly, (req, res) => res.json(readData().orders));
app.patch("/api/admin/orders/:id", adminOnly, (req, res) => {
  const data = readData();
  const order = data.orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "سفارش پیدا نشد." });
  const status = req.body && req.body.status;
  if (!["pending", "approved", "rejected"].includes(status)) return res.status(400).json({ error: "وضعیت نامعتبر است." });
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
    title: process.env.MINI_APP_TITLE || "مینی‌اپ اختصاصی",
    urlConfigured: /^https:\/\//i.test(baseUrl),
    url: /^https:\/\//i.test(baseUrl) ? baseUrl : "",
    purchaseSystem: true,
    paymentSystem: false,
    paymentNote: "ثبت سفارش فعال است؛ درگاه پرداخت واقعی هنوز متصل نشده است.",
    telegramIdentityValidation: false,
    lastSync: null,
    services: data.services.map(s => ({ id: s.id, name: s.name, enabled: !!s.enabled })),
    checkedAt: new Date().toISOString()
  });
});
app.get("/admin", (_, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, "0.0.0.0", () => console.log(`Sami Mini App listening on ${PORT}`));
