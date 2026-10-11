const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 10000;
const DATA_FILE = path.join(__dirname, "data.json");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-me-now";

app.use(express.json({ limit: "200kb" }));
app.use(express.static(path.join(__dirname, "public")));

const initial = {
  brand: "Sami WireGuard",
  announcement: "اتصال پایدار، مدیریت ساده و خرید سریع",
  services: [
    { id: "wireguard", name: "WireGuard", subtitle: "کانفیگ و اشتراک WireGuard", icon: "◈", enabled: true, accent: "blue", plans: [
      { id: "wg10", title: "۱۰ گیگابایت", volume: "10 GB", days: 30, price: 160000 },
      { id: "wg20", title: "۲۰ گیگابایت", volume: "20 GB", days: 30, price: 290000 },
      { id: "wg50", title: "۵۰ گیگابایت", volume: "50 GB", days: 30, price: 590000 }
    ]},
    { id: "v2ray", name: "V2Ray", subtitle: "اشتراک و لینک اتصال", icon: "✦", enabled: true, accent: "purple", plans: [
      { id: "v210", title: "۱۰ گیگابایت", volume: "10 GB", days: 30, price: 160000 },
      { id: "v220", title: "۲۰ گیگابایت", volume: "20 GB", days: 30, price: 290000 },
      { id: "v250", title: "۵۰ گیگابایت", volume: "50 GB", days: 30, price: 590000 }
    ]},
    { id: "dns", name: "DNS", subtitle: "سرویس DNS", icon: "⌁", enabled: true, accent: "cyan", plans: [
      { id: "dns30", title: "۳۰ روزه", volume: "DNS", days: 30, price: 50000 }
    ]}
  ],
  orders: []
};

function readData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch { fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2)); return structuredClone(initial); }
}
function saveData(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }
function safePublic(data) {
  return { brand: data.brand, announcement: data.announcement,
    services: data.services.map(s => ({ ...s, plans: s.plans || [] })) };
}
function adminOnly(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token !== process.env.ADMIN_SESSION_TOKEN) return res.status(401).json({ error: "دسترسی مدیر تأیید نشد." });
  next();
}
app.get("/api/config", (req, res) => res.json(safePublic(readData())));

app.post("/api/admin/login", (req, res) => {
  if (!req.body || req.body.password !== ADMIN_PASSWORD) return res.status(401).json({ error: "رمز عبور اشتباه است." });
  const token = crypto.randomBytes(32).toString("hex");
  process.env.ADMIN_SESSION_TOKEN = token;
  res.json({ token });
});

app.get("/api/admin/config", adminOnly, (req, res) => res.json(readData()));
app.put("/api/admin/config", adminOnly, (req, res) => {
  const current = readData();
  const incoming = req.body || {};
  if (typeof incoming.announcement === "string") current.announcement = incoming.announcement.slice(0, 240);
  if (Array.isArray(incoming.services)) {
    for (const service of current.services) {
      const change = incoming.services.find(s => s.id === service.id);
      if (change && typeof change.enabled === "boolean") service.enabled = change.enabled;
      if (change && Array.isArray(change.plans)) {
        service.plans = change.plans.slice(0, 20).map((p, i) => ({
          id: String(p.id || `${service.id}-${i}`).slice(0, 50),
          title: String(p.title || "بسته").slice(0, 70),
          volume: String(p.volume || "").slice(0, 30),
          days: Math.max(1, Math.min(3650, Number(p.days) || 30)),
          price: Math.max(0, Math.round(Number(p.price) || 0))
        }));
      }
    }
  }
  saveData(current);
  res.json({ ok: true, config: safePublic(current) });
});

// Demo order intake: saves a pending request. It does NOT charge money or provision VPN access.
app.post("/api/orders", (req, res) => {
  const data = readData();
  const { serviceId, planId, telegramUserId, username } = req.body || {};
  const service = data.services.find(s => s.id === serviceId && s.enabled);
  const plan = service && service.plans.find(p => p.id === planId);
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

app.get("/health", (_, res) => res.json({ ok: true }));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, "0.0.0.0", () => console.log(`Sami Mini App listening on ${PORT}`));
