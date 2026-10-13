const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 10000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "data.json");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
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
  roulette: { enabled: true, title: "گردونه شانس سامی", prizes: [{label:"۵٪ تخفیف",weight:35},{label:"۱۰٪ تخفیف",weight:25},{label:"۱۵٪ تخفیف",weight:15},{label:"شانس دوباره",weight:15},{label:"جایزه ویژه",weight:10}], spins: {} },
  integration: { miniAppUrl: process.env.MINI_APP_URL || "", title: process.env.MINI_APP_TITLE || "Sami WireGuard", apiKey: "", botUsername: "", lastSync: null, lastTest: null },
  payment: { cardNumber: "", cardHolder: "", bankName: "", paymentNote: "پس از واریز، رسید را بارگذاری کن." },
  orders: [], tickets: [], coupons: [], wallets: {}, referrals: {}, providers: [], audit: [], expenses: [], maintenance: false, loyalty: {}, idempotency: {}
};

function readData() {
  try {
    const saved = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    // Backward-compatible migration: new PRO MAX keys get defaults without deleting saved data.
    const merged = { ...structuredClone(initial), ...saved };
    for (const k of ['integration','payment','storeStatus','promo','roulette']) merged[k] = { ...(initial[k] || {}), ...(saved[k] || {}) };
    for (const k of ['services','orders','tickets','coupons','providers','audit','expenses']) if (!Array.isArray(merged[k])) merged[k] = [];
    for (const k of ['wallets','referrals','loyalty','idempotency']) if (!merged[k] || typeof merged[k] !== 'object') merged[k] = {};
    if (!merged.roulette.spins || typeof merged.roulette.spins !== 'object') merged.roulette.spins = {};
    return merged;
  } catch { fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true }); fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2)); return structuredClone(initial); }
}
function saveData(data) { fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true }); fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }
function audit(data, action, details = {}) { data.audit = Array.isArray(data.audit) ? data.audit : []; data.audit.unshift({ id: crypto.randomUUID(), action: String(action).slice(0,80), details, at: new Date().toISOString() }); data.audit = data.audit.slice(0,1000); }
function userKey(v) { return String(v || '').trim().slice(0,80); }
function adminRoute(method, route, handler) { app[method](route, adminOnly, handler); }
async function notifyTelegram(chatId, text, replyMarkup = null) {
  if (!TELEGRAM_BOT_TOKEN || !chatId) return { sent: false, reason: !TELEGRAM_BOT_TOKEN ? "TELEGRAM_BOT_TOKEN تنظیم نشده" : "شناسه تلگرام موجود نیست" };
  try {
    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: String(chatId), text, parse_mode: "HTML", disable_web_page_preview: true, ...(replyMarkup ? { reply_markup: replyMarkup } : {}) }) });
    const j = await r.json(); return { sent: !!j.ok, reason: j.ok ? "ok" : (j.description || "Telegram API error") };
  } catch (e) { return { sent: false, reason: "Telegram request failed" }; }
}
function verifyTelegramInitData(initData) {
  if (!TELEGRAM_BOT_TOKEN || !initData) return null;
  try {
    const params = new URLSearchParams(initData), hash = params.get("hash"); if (!hash) return null;
    params.delete("hash"); const dataCheck = [...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join("\n");
    const secret = crypto.createHmac("sha256", "WebAppData").update(TELEGRAM_BOT_TOKEN).digest();
    const expected = crypto.createHmac("sha256", secret).update(dataCheck).digest("hex");
    if (hash.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expected))) return null;
    const authDate = Number(params.get("auth_date") || 0); if (!authDate || Math.abs(Date.now()/1000-authDate)>86400) return null;
    const u = JSON.parse(params.get("user") || "{}"); return u.id ? String(u.id) : null;
  } catch { return null; }
}
function orderMessage(order, heading = "🛍️ سفارش جدید شما ثبت شد") {
  return `${heading}\n\nکد سفارش: <code>${String(order.id).replace(/[&<>]/g, "")}</code>\nسرویس: ${String(order.serviceName || "").replace(/[&<>]/g, "")}\nبسته: ${String(order.planTitle || "").replace(/[&<>]/g, "")}\nمبلغ: ${new Intl.NumberFormat("fa-IR").format(Number(order.price)||0)} تومان\nوضعیت: ${String(order.status || "pending")}\n\nبرای تکمیل خرید، رسید را در مینی‌اپ ارسال کن. پس از تأیید پرداخت، تحویل سرویس طبق وضعیت سفارش انجام می‌شود.\n🎁 بعد از خرید، می‌توانی یک‌بار گردونه شانس را بررسی کنی.`;
}
function safePublic(data) {
  return { brand: data.brand, announcement: data.announcement, supportUsername: data.supportUsername || "saman_s87", channelUrl: data.channelUrl || "https://t.me/SamiWireGuard",
    services: data.services.map(s => ({ ...s, plans: s.plans || [] })),
    roulette: { enabled: !!data.roulette?.enabled, title: data.roulette?.title || "گردونه شانس سامی", prizes: Array.isArray(data.roulette?.prizes) ? data.roulette.prizes : [] },
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
app.post("/api/integration/orders", integrationOnly, async (req, res) => {
  const data = readData(), b = req.body || {}; const idem=String(req.headers['idempotency-key']||b.idempotencyKey||'').slice(0,120); data.idempotency=data.idempotency||{}; if(idem&&data.idempotency[idem]){const prior=data.orders.find(o=>o.id===data.idempotency[idem]);if(prior)return res.json({ok:true,order:prior,duplicate:true});}
  const service = data.services.find(s => s.id === b.serviceId);
  const plan = service && (service.plans || []).find(p => p.id === b.planId);
  if (!service || !plan) return res.status(400).json({ error: "serviceId یا planId در فهرست سایت پیدا نشد؛ ابتدا catalog را همگام کن." });
  const order = { id: "SW-" + crypto.randomBytes(4).toString("hex").toUpperCase(), serviceId: service.id, serviceName: service.name, planId: plan.id, planTitle: plan.title, price: plan.price, telegramUserId: String(b.telegramUserId || b.chatId || "").slice(0,40), username: String(b.username || "").slice(0,80), source: "bot", status: "pending", createdAt: new Date().toISOString() };
  data.orders.unshift(order); data.orders = data.orders.slice(0,500); if(idem)data.idempotency[idem]=order.id; audit(data,'order.created',{id:order.id,source:'bot'}); saveData(data);
  const wheelOn = !!data.roulette?.enabled; const miniAppUrl = data.integration?.miniAppUrl || process.env.MINI_APP_URL || ""; const notification = await notifyTelegram(order.telegramUserId, orderMessage(order) + (wheelOn ? "\n\n🎉 خرید شما ثبت شد! یک شانس برای چرخاندن گردونه دارید." : "\n\n🎉 خرید شما ثبت شد!"), wheelOn && /^https:\/\//i.test(miniAppUrl) ? { inline_keyboard: [[{ text: "🎡 چرخاندن گردونه شانس", web_app: { url: miniAppUrl } }]] } : null);
  res.json({ ok: true, order, notification, wheelAvailable: !!order.telegramUserId });
});
app.post("/api/integration/orders/:id/status", integrationOnly, (req, res) => {
  const data = readData(), order = data.orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "سفارش پیدا نشد." });
  const status = req.body?.status; if (!["pending","approved","rejected","fulfilled"].includes(status)) return res.status(400).json({ error: "وضعیت نامعتبر است." });
  order.status = status; if (status === "approved" || status === "fulfilled") order.updatedAt = new Date().toISOString();
  data.integration = { ...(data.integration||{}), lastSync: new Date().toISOString() }; saveData(data); notifyTelegram(order.telegramUserId, orderMessage(order, status === "approved" ? "✅ پرداخت سفارش تأیید شد" : status === "rejected" ? "❌ سفارش رد شد" : status === "fulfilled" ? "🎉 سرویس سفارش آماده شد" : "🔔 وضعیت سفارش تغییر کرد")).catch(()=>{}); res.json({ ok:true, order });
});
app.put("/api/admin/config", adminOnly, (req, res) => {
  const current = readData(), incoming = req.body || {};
  if (typeof incoming.announcement === "string") current.announcement = incoming.announcement.slice(0, 240);
  if (typeof incoming.supportUsername === "string") current.supportUsername = incoming.supportUsername.replace(/^@/, "").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 40);
  if (typeof incoming.channelUrl === "string" && /^https:\/\/t\.me\/[a-zA-Z0-9_]+/.test(incoming.channelUrl)) current.channelUrl = incoming.channelUrl.slice(0, 160);
  if (incoming.roulette && typeof incoming.roulette.enabled === "boolean") {
    if (Array.isArray(incoming.roulette.prizes)) { const validPrizes=incoming.roulette.prizes.filter(p=>p && String(p.label||'').trim() && Number(p.weight)>0); const total=validPrizes.reduce((n,p)=>n+Number(p.weight),0); if(incoming.roulette.enabled && (!validPrizes.length || Math.abs(total-100)>0.000001)) return res.status(400).json({error:`مجموع احتمال‌های گردونه باید دقیقاً ۱۰۰٪ باشد (فعلی: ${total}٪).`}); }
    current.roulette = { ...(current.roulette || {}), enabled: incoming.roulette.enabled, title: String(incoming.roulette.title || "گردونه شانس سامی").slice(0, 70), prizes: Array.isArray(incoming.roulette.prizes) ? incoming.roulette.prizes.slice(0,20).map(p=>({ label:String(p.label||"جایزه").slice(0,80), weight:Math.max(0,Math.min(100,Number(p.weight)||0)), type:['discount','volume','gift','extra'].includes(p.type)?p.type:'gift', value:Math.max(0,Math.min(1000000,Number(p.value)||0)) })).filter(p=>p.label && p.weight>0) : (current.roulette?.prizes || []), spins: current.roulette?.spins || {} };
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
app.post("/api/orders", async (req, res) => {
  const data = readData();
  if (data.maintenance || data.storeStatus?.online === false) return res.status(503).json({ error: data.storeStatus.message || "ثبت سفارش موقتاً متوقف است." });
  const { serviceId, planId, telegramUserId, username } = req.body || {};
  const couponCode = String(req.body?.couponCode || "").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0,32);
  const idem = String(req.headers["idempotency-key"] || req.body?.idempotencyKey || "").slice(0,120); data.idempotency = data.idempotency || {}; if (idem && data.idempotency[idem]) { const prior=data.orders.find(o=>o.id===data.idempotency[idem]); if(prior) return res.json({ok:true,order:prior,duplicate:true}); }
  const service = data.services.find(s => s.id === serviceId && s.enabled);
  const plan = service && service.plans.find(p => p.id === planId && p.enabled !== false);
  if (!service || !plan) return res.status(400).json({ error: "این سرویس یا بسته فعلاً در دسترس نیست." });
  let finalPrice = Number(plan.price) || 0, coupon = null, discount = 0;
  if (couponCode) {
    coupon = (data.coupons || []).find(c => c.code === couponCode && c.enabled && c.used < c.maxUses && (!c.expiresAt || Date.parse(c.expiresAt) > Date.now()));
    if (!coupon) return res.status(400).json({ error: "کد تخفیف نامعتبر، غیرفعال یا منقضی شده است." });
    discount = coupon.type === "fixed" ? Math.min(finalPrice, Number(coupon.value) || 0) : Math.floor(finalPrice * Math.min(100, Number(coupon.value) || 0) / 100);
    finalPrice = Math.max(0, finalPrice - discount);
  }
  const order = {
    id: "SW-" + crypto.randomBytes(4).toString("hex").toUpperCase(),
    serviceId, serviceName: service.name, planId, planTitle: plan.title, price: finalPrice, originalPrice: Number(plan.price)||0, discount, couponCode: coupon ? coupon.code : "",
    telegramUserId: String(telegramUserId || "").slice(0, 40),
    username: String(username || "").slice(0, 80),
    status: "pending", createdAt: new Date().toISOString()
  };
  data.orders.unshift(order);
  data.orders = data.orders.slice(0, 500); if(idem) data.idempotency[idem]=order.id; if(coupon) coupon.used = (Number(coupon.used)||0)+1; audit(data,"order.created",{id:order.id,source:"web",discount});
  saveData(data);
  const wheelOn = !!data.roulette?.enabled; const miniAppUrl = data.integration?.miniAppUrl || process.env.MINI_APP_URL || ""; const notification = await notifyTelegram(order.telegramUserId, orderMessage(order) + (wheelOn ? "\n\n🎉 خرید شما ثبت شد! یک شانس برای چرخاندن گردونه دارید." : "\n\n🎉 خرید شما ثبت شد!"), wheelOn && /^https:\/\//i.test(miniAppUrl) ? { inline_keyboard: [[{ text: "🎡 چرخاندن گردونه شانس", web_app: { url: miniAppUrl } }]] } : null);
  res.json({ ok: true, order, notification, wheelAvailable: !!order.telegramUserId });
});

app.get("/api/orders/:id", (req, res) => { const d = readData(); const o = d.orders.find(x => x.id === req.params.id); if (!o) return res.status(404).json({ error: "سفارش پیدا نشد." }); res.json({ ok: true, order: { id:o.id, serviceName:o.serviceName, planTitle:o.planTitle, status:o.status, paymentStatus:o.paymentStatus || "pending", createdAt:o.createdAt } }); });
app.post("/api/orders/:id/receipt", async (req, res) => {
  const data = readData(), order = data.orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "سفارش پیدا نشد." });
  const { imageData, telegramUserId } = req.body || {};
  if (order.telegramUserId && String(telegramUserId || "") !== order.telegramUserId) return res.status(403).json({ error: "این سفارش متعلق به این کاربر نیست." });
  if (typeof imageData !== "string" || !/^data:image\/(png|jpeg|webp);base64,/.test(imageData) || imageData.length > 1200000) return res.status(400).json({ error: "تصویر معتبر نیست؛ PNG/JPG/WebP تا حدود 850 کیلوبایت مجاز است." });
  order.receiptImage = imageData; order.receiptUploadedAt = new Date().toISOString(); order.paymentStatus = "receipt_submitted"; saveData(data);
  await notifyTelegram(order.telegramUserId, `📩 رسید پرداخت سفارش ${order.id} دریافت شد و برای بررسی مدیر ثبت شد.`);
  res.json({ ok: true, message: "رسید ثبت شد و منتظر بررسی مدیر است." });
});
app.get("/api/admin/orders", adminOnly, (req, res) => res.json(readData().orders));
app.patch("/api/admin/orders/:id", adminOnly, async (req, res) => {
  const data = readData();
  const order = data.orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "سفارش پیدا نشد." });
  const status = req.body && req.body.status;
  if (!["pending", "approved", "rejected", "fulfilled"].includes(status)) return res.status(400).json({ error: "وضعیت نامعتبر است." });
  order.status = status; if(status === "approved" || status === "fulfilled") order.paymentStatus = "verified"; if(status === "rejected") order.paymentStatus = "rejected"; order.updatedAt = new Date().toISOString(); audit(data,"order.status_changed",{id:order.id,status});
  saveData(data);
  await notifyTelegram(order.telegramUserId, orderMessage(order, status === "approved" ? "✅ پرداخت سفارش تأیید شد" : status === "rejected" ? "❌ سفارش رد شد" : status === "fulfilled" ? "🎉 سرویس سفارش آماده شد" : "🔔 وضعیت سفارش تغییر کرد"));
  res.json({ ok: true, order });
});

app.post("/api/roulette/spin", async (req, res) => {
  const data = readData(), uid = verifyTelegramInitData(String(req.body?.initData || ""));
  if (!data.roulette?.enabled) return res.status(403).json({ error: "گردونه غیرفعال است." });
  if (!uid) return res.status(401).json({ error: "هویت تلگرام تأیید نشد؛ مینی‌اپ را از داخل ربات باز کن و TELEGRAM_BOT_TOKEN را تنظیم کن." });
  data.roulette.spins = data.roulette.spins || {};
  const eligibleOrders=(data.orders||[]).filter(o=>String(o.telegramUserId||'')===uid&&['approved','fulfilled'].includes(o.status)); if(!eligibleOrders.length)return res.status(403).json({error:'برای چرخاندن گردونه ابتدا باید یک سفارش پرداخت‌شده داشته باشی.'}); data.roulette.spins=data.roulette.spins||{}; const used=Number(data.roulette.spins[uid]?.count||0); if(used>=eligibleOrders.length)return res.status(409).json({error:'برای هر سفارش تأییدشده فقط یک نوبت گردونه مجاز است.',prize:data.roulette.spins[uid]?.prize});
  const prizes = (data.roulette.prizes || []).filter(p => p.label && Number(p.weight)>0);
  if (!prizes.length) return res.status(503).json({ error: "مدیر هنوز جایزه و درصدهای گردونه را تنظیم نکرده است." });
  const total = prizes.reduce((a,p)=>a+Number(p.weight),0); let n=Math.random()*total, prize=prizes[prizes.length-1];
  for (const p of prizes) { n-=Number(p.weight); if(n<=0){prize=p;break;} }
  data.roulette.spins[uid] = { prize: prize.label, at: new Date().toISOString(), count: used+1, orderId: eligibleOrders[used]?.id || null }; audit(data,'roulette.spun',{userId:uid,prize:prize.label,orderId:eligibleOrders[used]?.id||null}); saveData(data);
  await notifyTelegram(uid, `🎁 نتیجه گردونه شانس سامی\nجایزه شما: ${prize.label}\nکد نتیجه: ${crypto.randomBytes(3).toString("hex").toUpperCase()}\nبرای اعمال جایزه، این پیام را برای پشتیبانی ارسال کن.`);
  res.json({ ok:true, prize:prize.label, message:"نتیجه ثبت شد؛ برای اعمال جایزه، کد نتیجه را به پشتیبانی بده." });
});
// Admin tools: real server-side records for tickets, coupons, wallet, providers, reports and backups.
adminRoute('get','/api/admin/analytics',(req,res)=>{const d=readData(), orders=d.orders||[], paid=orders.filter(o=>['approved','fulfilled'].includes(o.status));res.json({orders:orders.length,pending:orders.filter(o=>o.status==='pending').length,receipts:orders.filter(o=>o.paymentStatus==='receipt_submitted').length,paidRevenue:paid.reduce((n,o)=>n+(Number(o.price)||0),0),byService:Object.values(orders.reduce((a,o)=>{a[o.serviceName]=(a[o.serviceName]||0)+1;return a},{})).length?orders.reduce((a,o)=>{a[o.serviceName]=(a[o.serviceName]||0)+1;return a},{}):{},tickets:(d.tickets||[]).length,customers:[...new Set(orders.map(o=>o.telegramUserId).filter(Boolean))].length,expenses:(d.expenses||[]).reduce((n,x)=>n+(Number(x.amount)||0),0),net:paid.reduce((n,o)=>n+(Number(o.price)||0),0)-(d.expenses||[]).reduce((n,x)=>n+(Number(x.amount)||0),0)});} );
adminRoute('get','/api/admin/tickets',(req,res)=>res.json(readData().tickets||[]));
adminRoute('post','/api/admin/tickets',(req,res)=>{const d=readData(),b=req.body||{};if(!b.subject||!b.message)return res.status(400).json({error:'عنوان و متن تیکت الزامی است.'});const t={id:'TK-'+crypto.randomBytes(4).toString('hex').toUpperCase(),userId:userKey(b.userId),subject:String(b.subject).slice(0,120),message:String(b.message).slice(0,2000),status:'open',createdAt:new Date().toISOString(),replies:[]};d.tickets=d.tickets||[];d.tickets.unshift(t);audit(d,'ticket.created',{id:t.id});saveData(d);res.json({ok:true,ticket:t});});
adminRoute('patch','/api/admin/tickets/:id',(req,res)=>{const d=readData(),t=(d.tickets||[]).find(x=>x.id===req.params.id);if(!t)return res.status(404).json({error:'تیکت پیدا نشد.'});if(['open','in_progress','closed'].includes(req.body.status))t.status=req.body.status;if(req.body.reply){t.replies=t.replies||[];t.replies.push({message:String(req.body.reply).slice(0,2000),at:new Date().toISOString()});}audit(d,'ticket.updated',{id:t.id,status:t.status});saveData(d);res.json({ok:true,ticket:t});});
adminRoute('get','/api/admin/coupons',(req,res)=>res.json(readData().coupons||[]));
adminRoute('post','/api/admin/coupons',(req,res)=>{const d=readData(),b=req.body||{},code=String(b.code||'').toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,32);if(!code||!Number.isFinite(Number(b.value))||Number(b.value)<=0)return res.status(400).json({error:'کد و مقدار معتبر وارد کن.'});d.coupons=d.coupons||[];if(d.coupons.some(c=>c.code===code))return res.status(409).json({error:'این کد قبلاً ثبت شده است.'});const c={code,type:b.type==='fixed'?'fixed':'percent',value:Math.min(Number(b.value),b.type==='fixed'?100000000:100),maxUses:Math.max(1,Math.min(100000,Number(b.maxUses)||100)),used:0,enabled:b.enabled!==false,expiresAt:b.expiresAt||null,createdAt:new Date().toISOString()};d.coupons.push(c);audit(d,'coupon.created',{code});saveData(d);res.json({ok:true,coupon:c});});
adminRoute('patch','/api/admin/coupons/:code',(req,res)=>{const d=readData(),c=(d.coupons||[]).find(x=>x.code===String(req.params.code).toUpperCase());if(!c)return res.status(404).json({error:'کد تخفیف پیدا نشد.'});if(typeof req.body.enabled==='boolean')c.enabled=req.body.enabled;audit(d,'coupon.updated',{code:c.code});saveData(d);res.json({ok:true,coupon:c});});
app.post('/api/coupons/validate',(req,res)=>{const d=readData(),code=String(req.body?.code||'').toUpperCase(),c=(d.coupons||[]).find(x=>x.code===code&&x.enabled&&x.used<x.maxUses&&(!x.expiresAt||Date.parse(x.expiresAt)>Date.now()));if(!c)return res.status(400).json({error:'کد تخفیف نامعتبر، غیرفعال یا منقضی شده است.'});const amount=Math.max(0,Number(req.body?.amount)||0),discount=c.type==='fixed'?Math.min(amount,c.value):Math.floor(amount*c.value/100);res.json({ok:true,code:c.code,discount,finalAmount:amount-discount,type:c.type,value:c.value});});
app.get('/api/wallet/:userId',(req,res)=>{const id=userKey(req.params.userId),verified=verifyTelegramInitData(String(req.query.initData||''));if(!verified||verified!==id)return res.status(401).json({error:'برای مشاهده کیف پول، هویت تلگرام همین کاربر باید تأیید شود.'});const d=readData();res.json({userId:id,balance:Number((d.wallets||{})[id]||0),points:Number((d.loyalty||{})[id]||0)});});
adminRoute('post','/api/admin/wallet/adjust',(req,res)=>{const d=readData(),id=userKey(req.body?.userId),amount=Math.round(Number(req.body?.amount)||0);if(!id||!amount)return res.status(400).json({error:'شناسه کاربر و مبلغ غیرصفر الزامی است.'});d.wallets=d.wallets||{};const next=(Number(d.wallets[id])||0)+amount;if(next<0)return res.status(400).json({error:'موجودی کیف پول منفی نمی‌تواند شود.'});d.wallets[id]=next;audit(d,'wallet.adjusted',{userId:id,amount,balance:next});saveData(d);res.json({ok:true,userId:id,balance:next});});
adminRoute('get','/api/admin/providers',(req,res)=>res.json(readData().providers||[]));
adminRoute('post','/api/admin/providers',(req,res)=>{const d=readData(),b=req.body||{};if(!b.name)return res.status(400).json({error:'نام تأمین‌کننده الزامی است.'});d.providers=d.providers||[];const p={id:b.id||'PR-'+crypto.randomBytes(4).toString('hex').toUpperCase(),name:String(b.name).slice(0,100),type:String(b.type||'wireguard').slice(0,40),baseUrl:String(b.baseUrl||'').slice(0,300),apiKey:String(b.apiKey||'').slice(0,300),enabled:b.enabled!==false,priority:Math.max(1,Number(b.priority)||1),lastCheck:null};d.providers.push(p);audit(d,'provider.created',{id:p.id,name:p.name});saveData(d);res.json({ok:true,provider:p});});
adminRoute('patch','/api/admin/providers/:id',(req,res)=>{const d=readData(),p=(d.providers||[]).find(x=>x.id===req.params.id);if(!p)return res.status(404).json({error:'تأمین‌کننده پیدا نشد.'});for(const k of ['name','type','baseUrl','apiKey'])if(typeof req.body[k]==='string')p[k]=req.body[k].slice(0,300);if(typeof req.body.enabled==='boolean')p.enabled=req.body.enabled;if(req.body.priority)p.priority=Math.max(1,Number(req.body.priority)||1);audit(d,'provider.updated',{id:p.id});saveData(d);res.json({ok:true,provider:p});});
adminRoute('post','/api/admin/expenses',(req,res)=>{const d=readData(),b=req.body||{},amount=Number(b.amount);if(!b.title||!Number.isFinite(amount)||amount<=0)return res.status(400).json({error:'شرح و مبلغ هزینه معتبر لازم است.'});d.expenses=d.expenses||[];const e={id:'EX-'+crypto.randomBytes(4).toString('hex').toUpperCase(),title:String(b.title).slice(0,120),amount:Math.round(amount),category:String(b.category||'general').slice(0,50),at:new Date().toISOString()};d.expenses.unshift(e);audit(d,'expense.created',{id:e.id,amount:e.amount});saveData(d);res.json({ok:true,expense:e});});
adminRoute('get','/api/admin/audit',(req,res)=>res.json((readData().audit||[]).slice(0,500)));
adminRoute('get','/api/admin/backup',(req,res)=>{const d=readData();res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="sami-wireguard-backup.json"');res.send(JSON.stringify({...d,backupCreatedAt:new Date().toISOString()},null,2));});
adminRoute('post','/api/admin/backup/restore',(req,res)=>{const b=req.body;if(!b||!Array.isArray(b.services)||!Array.isArray(b.orders))return res.status(400).json({error:'فایل پشتیبان معتبر نیست.'});const current=readData();const restored={...initial,...b};restored.integration={...initial.integration,...b.integration};restored.orders=b.orders.slice(0,5000);audit(restored,'backup.restored',{orders:restored.orders.length});saveData(restored);res.json({ok:true,message:'پشتیبان بازیابی شد؛ صفحه را تازه‌سازی کن.'});});
adminRoute('post','/api/admin/maintenance',(req,res)=>{const d=readData();d.maintenance=!!req.body?.enabled;d.storeStatus={...(d.storeStatus||{}),online:!d.maintenance,message:d.maintenance?String(req.body?.message||'فروشگاه موقتاً در حال تعمیر است.').slice(0,240):(d.storeStatus?.message||'ثبت سفارش فعال است.')};audit(d,'maintenance.changed',{enabled:d.maintenance});saveData(d);res.json({ok:true,maintenance:d.maintenance});});
app.post('/api/tickets',(req,res)=>{const d=readData(),b=req.body||{};if(!b.userId||!b.subject||!b.message)return res.status(400).json({error:'شناسه کاربر، عنوان و متن الزامی است.'});const t={id:'TK-'+crypto.randomBytes(4).toString('hex').toUpperCase(),userId:userKey(b.userId),subject:String(b.subject).slice(0,120),message:String(b.message).slice(0,2000),status:'open',createdAt:new Date().toISOString(),replies:[]};d.tickets=d.tickets||[];d.tickets.unshift(t);saveData(d);res.json({ok:true,ticketId:t.id,status:t.status});});
// Expanded PRO MAX API surface: customer profile, referrals, loyalty, roles, notifications,
// reports/export, catalog, maintenance, provider checks and idempotent bot order intake.
function csvEscape(v){const x=String(v??'');return '"'+x.replace(/"/g,'""')+'"';}
function publicOrder(o){const {receiptImage,...safe}=o;return safe;}
app.get('/api/profile/:userId',(req,res)=>{const uid=userKey(req.params.userId),verified=verifyTelegramInitData(String(req.query.initData||''));if(!verified||verified!==uid)return res.status(401).json({error:'برای مشاهده پروفایل، هویت تلگرام همین کاربر باید تأیید شود.'});const d=readData();if(!uid)return res.status(400).json({error:'شناسه کاربر لازم است.'});const orders=(d.orders||[]).filter(o=>String(o.telegramUserId||'')===uid).map(publicOrder);res.json({userId:uid,balance:Number(d.wallets?.[uid]||0),points:Number(d.loyalty?.[uid]||0),tier:Number(d.loyalty?.[uid]||0)>=1000?'VIP':Number(d.loyalty?.[uid]||0)>=300?'Gold':'Basic',orders,referralCode:(d.referrals?.codes||{})[uid]||null});});
app.get('/api/user/orders/:userId',(req,res)=>{const uid=userKey(req.params.userId),verified=verifyTelegramInitData(String(req.query.initData||''));if(!verified||verified!==uid)return res.status(401).json({error:'هویت تلگرام تأیید نشد.'});const d=readData();res.json((d.orders||[]).filter(o=>String(o.telegramUserId||'')===uid).map(publicOrder));});
app.get('/api/user/tickets/:userId',(req,res)=>{const uid=userKey(req.params.userId),verified=verifyTelegramInitData(String(req.query.initData||''));if(!verified||verified!==uid)return res.status(401).json({error:'هویت تلگرام تأیید نشد.'});const d=readData();res.json((d.tickets||[]).filter(t=>String(t.userId)===uid));});
app.post('/api/referrals/code',(req,res)=>{const uid=userKey(req.body?.userId),verified=verifyTelegramInitData(String(req.body?.initData||''));if(!verified||verified!==uid)return res.status(401).json({error:'هویت تلگرام تأیید نشد.'});const d=readData();if(!uid)return res.status(400).json({error:'شناسه کاربر لازم است.'});d.referrals=d.referrals||{codes:{},events:[]};d.referrals.codes=d.referrals.codes||{};if(!d.referrals.codes[uid])d.referrals.codes[uid]='SAM-'+crypto.randomBytes(4).toString('hex').toUpperCase();saveData(d);res.json({ok:true,code:d.referrals.codes[uid]});});
app.post('/api/referrals/claim',(req,res)=>{const invitee=userKey(req.body?.userId),verified=verifyTelegramInitData(String(req.body?.initData||''));if(!verified||verified!==invitee)return res.status(401).json({error:'هویت تلگرام تأیید نشد.'});const d=readData(),code=String(req.body?.code||'').toUpperCase();d.referrals=d.referrals||{codes:{},events:[]};d.referrals.codes=d.referrals.codes||{};d.referrals.events=d.referrals.events||[];const inviter=Object.keys(d.referrals.codes).find(k=>d.referrals.codes[k]===code);if(!invitee||!inviter||inviter===invitee||d.referrals.events.some(e=>e.invitee===invitee))return res.status(400).json({error:'کد دعوت نامعتبر یا قبلاً استفاده شده است.'});d.referrals.events.push({inviter,invitee,at:new Date().toISOString(),status:'registered'});d.loyalty=d.loyalty||{};d.loyalty[inviter]=(Number(d.loyalty[inviter])||0)+25;audit(d,'referral.claimed',{inviter,invitee});saveData(d);res.json({ok:true,message:'دعوت ثبت شد؛ امتیاز اولیه برای معرف ثبت شد.'});});
app.get('/api/admin/referrals',adminOnly,(req,res)=>res.json(readData().referrals||{codes:{},events:[]}));
app.post('/api/admin/loyalty/adjust',adminOnly,(req,res)=>{const d=readData(),uid=userKey(req.body?.userId),points=Math.round(Number(req.body?.points)||0);if(!uid||!points)return res.status(400).json({error:'شناسه و امتیاز معتبر لازم است.'});d.loyalty=d.loyalty||{};d.loyalty[uid]=Math.max(0,(Number(d.loyalty[uid])||0)+points);audit(d,'loyalty.adjusted',{userId:uid,points});saveData(d);res.json({ok:true,userId:uid,points:d.loyalty[uid]});});
app.get('/api/admin/customers',adminOnly,(req,res)=>{const d=readData(),ids=[...new Set((d.orders||[]).map(o=>String(o.telegramUserId||'')).filter(Boolean))];res.json(ids.map(id=>({userId:id,orders:d.orders.filter(o=>String(o.telegramUserId||'')===id).length,spent:d.orders.filter(o=>String(o.telegramUserId||'')===id&&['approved','fulfilled'].includes(o.status)).reduce((n,o)=>n+(Number(o.price)||0),0),balance:Number(d.wallets?.[id]||0),points:Number(d.loyalty?.[id]||0),lastOrder:d.orders.find(o=>String(o.telegramUserId||'')===id)?.createdAt||null})));});
app.post('/api/admin/notifications',adminOnly,async(req,res)=>{const d=readData(),message=String(req.body?.message||'').trim().slice(0,3500);if(!message)return res.status(400).json({error:'متن پیام الزامی است.'});const ids=[...new Set((d.orders||[]).map(o=>String(o.telegramUserId||'')).filter(Boolean))];let sent=0;for(const id of ids){const r=await notifyTelegram(id,message);if(r.sent)sent++;}d.notifications=d.notifications||[];d.notifications.unshift({id:crypto.randomUUID(),message,recipients:ids.length,sent,at:new Date().toISOString()});audit(d,'notification.broadcast',{recipients:ids.length,sent});saveData(d);res.json({ok:true,recipients:ids.length,sent,configured:!!TELEGRAM_BOT_TOKEN});});
app.get('/api/admin/notifications',adminOnly,(req,res)=>res.json(readData().notifications||[]));
app.get('/api/admin/expenses',adminOnly,(req,res)=>res.json(readData().expenses||[]));
app.get('/api/admin/export/orders.csv',adminOnly,(req,res)=>{const d=readData(),rows=[['id','userId','service','plan','price','status','paymentStatus','source','createdAt'],...(d.orders||[]).map(o=>[o.id,o.telegramUserId,o.serviceName,o.planTitle,o.price,o.status,o.paymentStatus,o.source,o.createdAt])];res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="sami-orders.csv"');res.send('\uFEFF'+rows.map(r=>r.map(csvEscape).join(',')).join('\r\n'));});
app.get('/api/admin/export/customers.csv',adminOnly,(req,res)=>{const d=readData(),ids=[...new Set((d.orders||[]).map(o=>String(o.telegramUserId||'')).filter(Boolean))],rows=[['userId','orders','paidTotal','wallet','points'],...ids.map(id=>[id,d.orders.filter(o=>String(o.telegramUserId||'')===id).length,d.orders.filter(o=>String(o.telegramUserId||'')===id&&['approved','fulfilled'].includes(o.status)).reduce((n,o)=>n+(Number(o.price)||0),0),d.wallets?.[id]||0,d.loyalty?.[id]||0])];res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="sami-customers.csv"');res.send('\uFEFF'+rows.map(r=>r.map(csvEscape).join(',')).join('\r\n'));});
app.get('/api/admin/roles',adminOnly,(req,res)=>res.json(readData().roles||[{role:'owner',permissions:['*']},{role:'sales',permissions:['orders','catalog']},{role:'support',permissions:['tickets','customers']},{role:'finance',permissions:['analytics','expenses','wallet']} ]));
app.put('/api/admin/roles',adminOnly,(req,res)=>{const roles=req.body?.roles;if(!Array.isArray(roles)||roles.length>20)return res.status(400).json({error:'فهرست نقش‌ها معتبر نیست.'});const d=readData();d.roles=roles.map(r=>({role:String(r.role||'').slice(0,40),permissions:Array.isArray(r.permissions)?r.permissions.map(String).slice(0,30):[]}));audit(d,'roles.updated',{count:d.roles.length});saveData(d);res.json({ok:true,roles:d.roles});});
app.get('/api/admin/system',(req,res,next)=>adminOnly(req,res,()=>{const d=readData();res.json({node:process.version,uptime:process.uptime(),dataFile:DATA_FILE,storageExists:fs.existsSync(DATA_FILE),orders:(d.orders||[]).length,services:(d.services||[]).length,maintenance:!!d.maintenance,telegramConfigured:!!TELEGRAM_BOT_TOKEN,integrationKeyConfigured:!!(d.integration?.apiKey||process.env.INTEGRATION_API_KEY),persistentStorageWarning:!process.env.DATA_FILE&&!process.env.RENDER_DISK_PATH});}));
app.post('/api/admin/providers/:id/check',adminOnly,async(req,res)=>{const d=readData(),p=(d.providers||[]).find(x=>x.id===req.params.id);if(!p)return res.status(404).json({error:'تأمین‌کننده پیدا نشد.'});let result={ok:false,reason:'آدرس یا endpoint سلامت تأمین‌کننده تعریف نشده است.'};if(p.baseUrl&&/^https:\/\//i.test(p.baseUrl)){try{const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),5000),r=await fetch(p.baseUrl.replace(/\/$/,'')+(p.healthPath||'/health'),{signal:ctrl.signal});clearTimeout(timer);result={ok:r.ok,status:r.status,reason:r.ok?'پاسخ سالم دریافت شد':'پاسخ خطا از تأمین‌کننده'};}catch(e){result={ok:false,reason:'اتصال ناموفق یا timeout'};}}p.lastCheck={...result,at:new Date().toISOString()};saveData(d);res.json({ok:true,provider:p,result});});
app.get('/api/admin/catalog',adminOnly,(req,res)=>res.json(readData().services||[]));
app.put('/api/admin/catalog',adminOnly,(req,res)=>{const services=req.body?.services;if(!Array.isArray(services)||services.length>30)return res.status(400).json({error:'فهرست سرویس‌ها معتبر نیست.'});const d=readData();d.services=services.map((s,i)=>({id:String(s.id||`service-${i}`).toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,48),name:String(s.name||'سرویس').slice(0,60),subtitle:String(s.subtitle||'').slice(0,120),icon:String(s.icon||'✦').slice(0,5),accent:['blue','purple','cyan','green','gold','red'].includes(s.accent)?s.accent:'blue',enabled:s.enabled!==false,plans:(Array.isArray(s.plans)?s.plans:[]).slice(0,40).map((p,j)=>({id:String(p.id||`plan-${i}-${j}`).toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,50),title:String(p.title||'بسته').slice(0,70),volume:String(p.volume||'').slice(0,30),days:Math.max(1,Math.min(3650,Number(p.days)||30)),price:Math.max(0,Math.round(Number(p.price)||0)),enabled:p.enabled!==false}))}));audit(d,'catalog.updated',{services:d.services.length});saveData(d);res.json({ok:true,services:d.services});});
app.get('/api/admin/roulette/history',adminOnly,(req,res)=>{const d=readData();res.json(Object.entries(d.roulette?.spins||{}).map(([userId,x])=>({userId,...x})));});
app.get('/api/admin/queue',adminOnly,(req,res)=>{const d=readData();res.json({failedNotifications:(d.notifications||[]).filter(x=>x.sent<x.recipients),pendingOrders:(d.orders||[]).filter(x=>x.status==='pending'),receipts:(d.orders||[]).filter(x=>x.paymentStatus==='receipt_submitted')});});
app.get('/api/admin/health',adminOnly,(req,res)=>{const d=readData();res.json({ok:true,checkedAt:new Date().toISOString(),storage:fs.existsSync(DATA_FILE),servicesEnabled:d.services.filter(s=>s.enabled).length,pendingOrders:d.orders.filter(o=>o.status==='pending').length,telegram:!!TELEGRAM_BOT_TOKEN,integration:!!(d.integration?.apiKey||process.env.INTEGRATION_API_KEY),paymentGateway:false,providerAutoProvisioning:false});});
// Optional signed bot status endpoint, using the same integration secret.
app.get('/api/integration/orders',integrationOnly,(req,res)=>{const d=readData(),limit=Math.max(1,Math.min(200,Number(req.query.limit)||50));res.json({ok:true,orders:d.orders.slice(0,limit).map(publicOrder),lastSync:d.integration?.lastSync||null});});

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
