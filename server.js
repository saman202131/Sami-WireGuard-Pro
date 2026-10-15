const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 10000;
const DATA_FILE = process.env.DATA_FILE || path.join(process.env.DATA_DIR || __dirname, "data.json");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const ADMIN_TELEGRAM_CHAT_ID = process.env.ADMIN_TELEGRAM_CHAT_ID || "";
const adminSessions = new Set();
const loginAttempts = new Map();
const integrationOrderKeys = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;
function clientKey(req) { return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim(); }
function loginBlocked(req) {
  const now = Date.now(), key = clientKey(req), entry = loginAttempts.get(key);
  if (!entry || now - entry.startedAt > LOGIN_WINDOW_MS) { loginAttempts.set(key, { startedAt: now, count: 0 }); return false; }
  return entry.count >= LOGIN_MAX_ATTEMPTS;
}
function countLoginFailure(req) {
  const now = Date.now(), key = clientKey(req); let entry = loginAttempts.get(key);
  if (!entry || now - entry.startedAt > LOGIN_WINDOW_MS) entry = { startedAt: now, count: 0 };
  entry.count += 1; loginAttempts.set(key, entry);
}

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
  brand: "⚡ Sami WireGuard | 🎮 سرویس گیمینگ",
  botUsername: process.env.TELEGRAM_BOT_USERNAME || "sami91928bot",
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
    { id: "dns-custom", name: "DNS اختصاصی دست‌ساز | Custom DNS", subtitle: "پلن اختصاصی با حجم نامحدود؛ ساخت و قیمت‌گذاری دستی توسط مدیریت", icon: "✧", enabled: true, accent: "green", plans: [] },
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
  roulette: { enabled: false, title: "گردونه شانس سامی", startsAt: null, endsAt: null, prizes: [{label:"۵٪ تخفیف",weight:35},{label:"۱۰٪ تخفیف",weight:25},{label:"۱۵٪ تخفیف",weight:15},{label:"شانس دوباره",weight:15},{label:"جایزه ویژه",weight:10}], spins: {} },
  integration: { miniAppUrl: process.env.MINI_APP_URL || "https://sami-wireguard-pro.onrender.com", title: process.env.MINI_APP_TITLE || "Sami WireGuard PRO MAX", apiKey: "", botUsername: process.env.TELEGRAM_BOT_USERNAME || "sami91928bot", lastSync: null, lastTest: null },
  payment: { cardNumber: "", cardHolder: "", bankName: "", paymentNote: "پس از واریز، رسید را بارگذاری کن." },
  orders: [], tickets: [], coupons: [], wallets: {}, walletLedger: [], referrals: {}, providers: [], gamingServers: [], audit: [], expenses: [], maintenance: false, loyalty: {}, idempotency: {}
};

function readData() {
  try {
    const saved = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    // Backward-compatible migration: new PRO MAX keys get defaults without deleting saved data.
    const merged = { ...structuredClone(initial), ...saved };
    for (const k of ['integration','payment','storeStatus','promo','roulette']) merged[k] = { ...(initial[k] || {}), ...(saved[k] || {}) };
    for (const k of ['services','orders','tickets','coupons','providers','gamingServers','walletLedger','audit','expenses']) if (!Array.isArray(merged[k])) merged[k] = [];
    for (const k of ['wallets','referrals','loyalty','idempotency']) if (!merged[k] || typeof merged[k] !== 'object') merged[k] = {};
    // Apply project identity defaults to older persisted databases without replacing user-entered non-empty values.
    if (!merged.brand || merged.brand === 'Sami WireGuard') merged.brand = '⚡ Sami WireGuard | 🎮 سرویس گیمینگ';
    if (!merged.botUsername) merged.botUsername = process.env.TELEGRAM_BOT_USERNAME || 'sami91928bot';
    if (!merged.supportUsername) merged.supportUsername = process.env.SUPPORT_USERNAME || 'saman_s87';
    if (!merged.channelUrl) merged.channelUrl = process.env.CHANNEL_URL || 'https://t.me/SamiWireGuard';
    if (!merged.integration.miniAppUrl) merged.integration.miniAppUrl = process.env.MINI_APP_URL || 'https://sami-wireguard-pro.onrender.com';
    if (!merged.integration.title || merged.integration.title === 'Sami WireGuard') merged.integration.title = 'Sami WireGuard PRO MAX';
    if (!merged.integration.botUsername) merged.integration.botUsername = merged.botUsername;
    if (!merged.roulette.spins || typeof merged.roulette.spins !== 'object') merged.roulette.spins = {};
    return merged;
  } catch { fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true }); fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2)); return structuredClone(initial); }
}
function saveData(data) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  // Atomic replacement reduces the chance of a partially-written JSON database on process interruption.
  const tempFile = `${DATA_FILE}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), { mode: 0o600 });
  try { fs.renameSync(tempFile, DATA_FILE); }
  catch (err) { try { fs.rmSync(tempFile, { force: true }); } catch {} throw err; }
}
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
  const approved = ["approved", "fulfilled"].includes(String(order.status || ""));
  const tracking = approved ? `\nکد پیگیری: <code>${String(order.id).replace(/[&<>]/g, "")}</code>` : "";
  return `${heading}\n\n${tracking ? tracking + "\n" : ""}سرویس: ${String(order.serviceName || "").replace(/[&<>]/g, "")}\nبسته: ${String(order.planTitle || "").replace(/[&<>]/g, "")}\nمبلغ: ${new Intl.NumberFormat("fa-IR").format(Number(order.price)||0)} تومان\nوضعیت: ${String(order.status || "pending")}\n\nبرای تکمیل خرید، رسید را در مینی‌اپ ارسال کن. کد پیگیری پس از تأیید رسید در اختیارت قرار می‌گیرد.\n🎁 بعد از خرید، می‌توانی گردونه شانس را بررسی کنی.`;
}
function safePublic(data) {
  return { brand: data.brand || "⚡ Sami WireGuard | 🎮 سرویس گیمینگ", botUsername: data.botUsername || data.integration?.botUsername || "sami91928bot", announcement: data.announcement, supportUsername: data.supportUsername || "saman_s87", channelUrl: data.channelUrl || "https://t.me/SamiWireGuard",
    services: data.services.map(s => ({ ...s, plans: s.plans || [] })),
    roulette: { enabled: !!data.roulette?.enabled, title: data.roulette?.title || "گردونه شانس سامی", startsAt: data.roulette?.startsAt || null, endsAt: data.roulette?.endsAt || null, prizes: Array.isArray(data.roulette?.prizes) ? data.roulette.prizes : [] },
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
  if (loginBlocked(req)) return res.status(429).json({ error: "تعداد تلاش‌ها زیاد است؛ ۱۵ دقیقه بعد دوباره امتحان کن." });
  if (!ADMIN_PASSWORD) return res.status(503).json({ error: "ابتدا ADMIN_PASSWORD را در Environment رندر تنظیم کن." });
  if (!req.body || req.body.password !== ADMIN_PASSWORD) { countLoginFailure(req); return res.status(401).json({ error: "رمز عبور اشتباه است." }); }
  loginAttempts.delete(clientKey(req));
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
  const botApiBase = String(body.botApiBase ?? data.integration?.botApiBase ?? "").trim().replace(/\/$/, "");
  const botCatalogPath = String(body.botCatalogPath ?? data.integration?.botCatalogPath ?? "/api/plans").trim();
  const botApiHeader = String(body.botApiHeader ?? data.integration?.botApiHeader ?? "X-Secret-Key").trim();
  if (botApiBase && !/^https:\/\//i.test(botApiBase)) return res.status(400).json({ error: "آدرس پایه API ربات باید HTTPS باشد." });
  if (!botCatalogPath.startsWith("/") || botCatalogPath.startsWith("//") || botCatalogPath.includes("..")) return res.status(400).json({ error: "مسیر API نامعتبر است." });
  if (!/^[A-Za-z0-9-]{1,60}$/.test(botApiHeader)) return res.status(400).json({ error: "نام هدر API نامعتبر است." });
  data.integration = { ...(data.integration || {}), miniAppUrl: url.slice(0, 300), title: String(body.title || "Sami WireGuard PRO MAX").slice(0, 80), botUsername: String(body.botUsername || data.botUsername || "sami91928bot").replace(/^@/, "").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 40), apiKey: String(body.apiKey || data.integration?.apiKey || "").slice(0, 200), botApiBase: botApiBase.slice(0,300), botCatalogPath: botCatalogPath.slice(0,200), botApiHeader, botApiKey: String(body.botApiKey || data.integration?.botApiKey || "").slice(0,500), autoSyncEnabled: body.autoSyncEnabled === undefined ? !!data.integration?.autoSyncEnabled : !!body.autoSyncEnabled, updatedAt: new Date().toISOString() };
  data.botUsername = data.integration.botUsername || data.botUsername || "sami91928bot"; saveData(data); res.json({ ok: true, integration: data.integration });
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
async function requestBotCatalog(data) {
  const i = data.integration || {};
  if (!i.botApiBase || !i.botCatalogPath || !i.botApiKey) throw new Error("آدرس پایه API، مسیر پلن‌ها و کلید API ربات را در پنل ذخیره کن.");
  const target = new URL(i.botCatalogPath, i.botApiBase);
  if (target.protocol !== "https:" || target.origin !== new URL(i.botApiBase).origin) throw new Error("آدرس API باید HTTPS و در همان دامنه تنظیم‌شده باشد.");
  const headers = { Accept: "application/json" }; headers[i.botApiHeader || "X-Secret-Key"] = i.botApiKey;
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10000);
  try { const r = await fetch(target, { headers, signal: controller.signal }); if (!r.ok) throw new Error(`API ربات پاسخ HTTP ${r.status} داد.`); const json = await r.json(); const services = Array.isArray(json) ? json : (json.services || json.plans || json.data?.services || json.data?.plans); if (!Array.isArray(services)) throw new Error("پاسخ API باید آرایه services یا plans داشته باشد."); return services; }
  finally { clearTimeout(timer); }
}
app.post("/api/admin/integration/bot-test", adminOnly, async (req,res) => { try { const services = await requestBotCatalog(readData()); res.json({ ok:true, message:"API ربات پاسخ معتبر داد.", serviceCount:services.length, testedAt:new Date().toISOString() }); } catch(e) { res.status(502).json({ ok:false, error:e.message || "تست API ناموفق بود." }); } });
app.post("/api/admin/integration/bot-sync", adminOnly, async (req,res) => { try { const data=readData(), incoming=await requestBotCatalog(data); let added=0, updated=0; const current=new Map((data.services||[]).map(s=>[String(s.id),s]));
  for (const [i,raw] of incoming.entries()) { const id=String(raw.id || raw.serviceId || `bot-service-${i}`).toLowerCase().replace(/[^a-z0-9_-]/g,"").slice(0,48); if(!id) continue; const prev=current.get(id); const plansRaw=Array.isArray(raw.plans)?raw.plans:[]; const plans=plansRaw.slice(0,40).map((p,j)=>({id:String(p.id||p.planId||`plan-${i}-${j}`).toLowerCase().replace(/[^a-z0-9_-]/g,"").slice(0,50),title:String(p.title||p.name||"بسته").slice(0,70),volume:String(p.volume||p.dataLimit||"").slice(0,30),days:Math.max(1,Math.min(3650,Number(p.days||p.durationDays)||30)),price:Math.max(0,Math.round(Number(p.price)||0)),enabled:p.enabled!==false}));
  const service={...(prev||{}),id,name:String(raw.name||raw.title||prev?.name||"سرویس ربات").slice(0,60),subtitle:String(raw.subtitle||prev?.subtitle||"").slice(0,120),icon:String(raw.icon||prev?.icon||"✦").slice(0,5),accent: ["blue","purple","cyan","green","gold","red"].includes(raw.accent)?raw.accent:(prev?.accent||"blue"),enabled:raw.enabled!==false,plans:plans.length?plans:(prev?.plans||[]),source:"bot",syncedAt:new Date().toISOString()};
  current.set(id,service); if(prev)updated++; else added++; }
  data.services=[...current.values()]; data.integration={...(data.integration||{}),lastSync:new Date().toISOString(),lastSyncResult:{added,updated,received:incoming.length}}; saveData(data); res.json({ok:true,added,updated,received:incoming.length,lastSync:data.integration.lastSync,note:"سرویس‌های حذف‌نشده از API نگه داشته شدند؛ پلن‌های دریافتی با شناسه ثابت به‌روزرسانی شدند."});
 } catch(e) { res.status(502).json({ok:false,error:e.message||"همگام‌سازی ناموفق بود."}); } });
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
  const idemKey = String(req.headers["idempotency-key"] || req.body?.externalOrderId || "").trim().slice(0, 160);
  const data = readData(), b = req.body || {};
  if (idemKey) {
    const existing = data.orders.find(o => o.source === "bot" && o.externalOrderId === idemKey);
    if (existing) return res.json({ ok: true, order: existing, idempotentReplay: true });
    if (integrationOrderKeys.has(idemKey)) return res.json({ ok: true, order: integrationOrderKeys.get(idemKey), idempotentReplay: true });
  } const idem=String(req.headers['idempotency-key']||b.idempotencyKey||'').slice(0,120); data.idempotency=data.idempotency||{}; if(idem&&data.idempotency[idem]){const prior=data.orders.find(o=>o.id===data.idempotency[idem]);if(prior)return res.json({ok:true,order:prior,duplicate:true});}
  const service = data.services.find(s => s.id === b.serviceId);
  const plan = service && (service.plans || []).find(p => p.id === b.planId);
  if (!service || !plan) return res.status(400).json({ error: "serviceId یا planId در فهرست سایت پیدا نشد؛ ابتدا catalog را همگام کن." });
  const order = { id: "SW-" + crypto.randomBytes(4).toString("hex").toUpperCase(), serviceId: service.id, serviceName: service.name, planId: plan.id, planTitle: plan.title, price: plan.price, telegramUserId: String(b.telegramUserId || b.chatId || "").slice(0,40), username: String(b.username || "").slice(0,80), source: "bot", status: "pending", externalOrderId: idemKey || undefined, createdAt: new Date().toISOString() };
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
  if (typeof incoming.brand === "string") current.brand = incoming.brand.trim().slice(0, 100) || "⚡ Sami WireGuard | 🎮 سرویس گیمینگ";
  if (typeof incoming.botUsername === "string") current.botUsername = incoming.botUsername.replace(/^@/, "").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 40);
  if (typeof incoming.announcement === "string") current.announcement = incoming.announcement.slice(0, 240);
  if (typeof incoming.supportUsername === "string") current.supportUsername = incoming.supportUsername.replace(/^@/, "").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 40);
  if (typeof incoming.channelUrl === "string" && /^https:\/\/t\.me\/[a-zA-Z0-9_]+/.test(incoming.channelUrl)) current.channelUrl = incoming.channelUrl.slice(0, 160);
  if (incoming.roulette && typeof incoming.roulette.enabled === "boolean") {
    if (Array.isArray(incoming.roulette.prizes)) { const validPrizes=incoming.roulette.prizes.filter(p=>p && String(p.label||'').trim() && Number(p.weight)>0); const total=validPrizes.reduce((n,p)=>n+Number(p.weight),0); if(incoming.roulette.enabled && (!validPrizes.length || Math.abs(total-100)>0.000001)) return res.status(400).json({error:`مجموع احتمال‌های گردونه باید دقیقاً ۱۰۰٪ باشد (فعلی: ${total}٪).`}); }
    current.roulette = { ...(current.roulette || {}), enabled: incoming.roulette.enabled, title: String(incoming.roulette.title || "گردونه شانس سامی").slice(0, 70), startsAt: incoming.roulette.startsAt || null, endsAt: incoming.roulette.endsAt || null, prizes: Array.isArray(incoming.roulette.prizes) ? incoming.roulette.prizes.slice(0,20).map(p=>({ label:String(p.label||"جایزه").slice(0,80), weight:Math.max(0,Math.min(100,Number(p.weight)||0)), type:['discount','volume','gift','extra'].includes(p.type)?p.type:'gift', value:Math.max(0,Math.min(1000000,Number(p.value)||0)) })).filter(p=>p.label && p.weight>0) : (current.roulette?.prizes || []), spins: current.roulette?.spins || {} };
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
          days: Math.max(1, Math.min(3650, Number(p.days) || 30)), price: Math.max(0, Math.round(Number(p.price) || 0)), spinChances: Math.max(0,Math.min(100,Math.floor(Number(p.spinChances ?? 1)||0))), enabled: p.enabled !== false
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
  const recipientTelegramUserId = String(req.body?.recipientTelegramUserId || "").replace(/\D/g, "").slice(0,20);
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
    recipientTelegramUserId: recipientTelegramUserId && recipientTelegramUserId !== String(telegramUserId||"") ? recipientTelegramUserId : "",
    status: "pending", createdAt: new Date().toISOString()
  };
  data.orders.unshift(order);
  data.orders = data.orders.slice(0, 500); if(idem) data.idempotency[idem]=order.id; if(coupon) coupon.used = (Number(coupon.used)||0)+1; audit(data,"order.created",{id:order.id,source:"web",discount});
  saveData(data);
  const wheelOn = !!data.roulette?.enabled; const miniAppUrl = data.integration?.miniAppUrl || process.env.MINI_APP_URL || ""; const notification = await notifyTelegram(order.telegramUserId, orderMessage(order) + (wheelOn ? "\n\n🎉 خرید شما ثبت شد! یک شانس برای چرخاندن گردونه دارید." : "\n\n🎉 خرید شما ثبت شد!"), wheelOn && /^https:\/\//i.test(miniAppUrl) ? { inline_keyboard: [[{ text: "🎡 چرخاندن گردونه شانس", web_app: { url: miniAppUrl } }]] } : null);
  if(order.recipientTelegramUserId) await notifyTelegram(order.telegramUserId, `🎁 سفارش ${order.id} به‌عنوان هدیه برای کاربر ${order.recipientTelegramUserId} ثبت شد. پس از تأیید پرداخت، وضعیت تحویل به اطلاع دریافت‌کننده می‌رسد.`);
  res.json({ ok: true, order, notification, wheelAvailable: !!order.telegramUserId });
});

app.post('/api/orders/wallet',async(req,res)=>{const uid=verifyTelegramInitData(String(req.body?.initData||''));if(!uid||uid!==String(req.body?.telegramUserId||''))return res.status(401).json({error:'هویت تلگرام تأیید نشد.'});const d=readData();if(d.maintenance||d.storeStatus?.online===false)return res.status(503).json({error:d.storeStatus?.message||'ثبت سفارش موقتاً متوقف است.'});const service=d.services.find(s=>s.id===req.body?.serviceId&&s.enabled),plan=service?.plans?.find(p=>p.id===req.body?.planId&&p.enabled!==false);if(!service||!plan)return res.status(400).json({error:'پلن در دسترس نیست.'});const price=Math.max(0,Math.round(Number(plan.price)||0)),balance=Number(d.wallets?.[uid]||0);if(balance<price)return res.status(400).json({error:`موجودی کیف پول کافی نیست. موجودی: ${balance} تومان؛ مبلغ: ${price} تومان.`});d.wallets=d.wallets||{};d.wallets[uid]=balance-price;const order={id:'SW-'+crypto.randomBytes(4).toString('hex').toUpperCase(),serviceId:service.id,serviceName:service.name,planId:plan.id,planTitle:plan.title,price,originalPrice:price,discount:0,couponCode:'',telegramUserId:uid,username:String(req.body?.username||'').slice(0,80),status:'approved',paymentStatus:'verified',paymentMethod:'wallet',createdAt:new Date().toISOString(),approvedAt:new Date().toISOString(),wheelChancesGranted:Math.max(0,Math.min(100,Math.floor(Number(plan.spinChances??1)||0)))};d.orders.unshift(order);d.orders=d.orders.slice(0,500);d.walletLedger=d.walletLedger||[];d.walletLedger.unshift({id:'WL-'+crypto.randomBytes(4).toString('hex').toUpperCase(),userId:uid,amount:-price,balance:d.wallets[uid],source:'order_payment',orderId:order.id,at:new Date().toISOString()});d.loyalty=d.loyalty||{};d.loyalty[uid]=(Number(d.loyalty[uid])||0)+Math.max(1,Math.floor(price/10000));audit(d,'order.paid_by_wallet',{id:order.id,userId:uid,price,balance:d.wallets[uid]});saveData(d);await notifyTelegram(uid,`✅ پرداخت سفارش از کیف پول موفق بود.\\nسفارش: ${order.id}\\nپلن: ${plan.title}\\nمبلغ کسرشده: ${price} تومان\\nموجودی باقی‌مانده: ${d.wallets[uid]} تومان`);res.json({ok:true,order,balance:d.wallets[uid]});});

app.get("/api/orders/:id", (req, res) => { const d = readData(); const o = d.orders.find(x => x.id === req.params.id); if (!o) return res.status(404).json({ error: "سفارش پیدا نشد." }); res.json({ ok: true, order: { id:o.id, serviceName:o.serviceName, planTitle:o.planTitle, status:o.status, paymentStatus:o.paymentStatus || "pending", reviewReason:o.reviewReason||"", subscriptionUrl:o.subscriptionUrl||"", wheelChancesGranted:Number(o.wheelChancesGranted)||0, createdAt:o.createdAt } }); });
app.post("/api/orders/:id/receipt", async (req, res) => {
  const data = readData(), order = data.orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "سفارش پیدا نشد." });
  const { imageData, telegramUserId } = req.body || {};
  if (order.telegramUserId && String(telegramUserId || "") !== order.telegramUserId) return res.status(403).json({ error: "این سفارش متعلق به این کاربر نیست." });
  if (typeof imageData !== "string" || !/^data:image\/(png|jpeg|webp);base64,/.test(imageData) || imageData.length > 1200000) return res.status(400).json({ error: "تصویر معتبر نیست؛ PNG/JPG/WebP تا حدود 850 کیلوبایت مجاز است." });
  order.receiptImage = imageData; order.receiptUploadedAt = new Date().toISOString(); order.paymentStatus = "receipt_submitted"; order.status = "receipt_submitted"; saveData(data);
  const adminText = `📥 رسید جدید Sami WireGuard\nسفارش: ${order.id}\nکاربر: ${order.telegramUserId || "نامشخص"} (@${order.username || "بدون نام کاربری"})\nپلن: ${order.planTitle}\nمبلغ: ${Number(order.price)||0} تومان\nبرای بررسی در پنل مدیریت وارد بخش سفارش‌ها شو.`;
  if (ADMIN_TELEGRAM_CHAT_ID) await notifyTelegram(ADMIN_TELEGRAM_CHAT_ID, adminText);
  await notifyTelegram(order.telegramUserId, `📩 رسید پرداخت شما ثبت شد و در انتظار بررسی است. پس از تأیید مدیر، کد پیگیری برایت ارسال می‌شود.`);
  res.json({ ok: true, message: "رسید ثبت شد و منتظر بررسی مدیر است.", orderId: order.id, status: order.status });
});
app.get("/api/admin/orders", adminOnly, (req, res) => { const d=readData(),now=Date.now(),orders=d.orders||[]; const enriched=orders.map(o=>{const flags=[];const created=Date.parse(o.createdAt||'')||0;if(o.telegramUserId){const recent=orders.filter(x=>x.id!==o.id&&String(x.telegramUserId||'')===String(o.telegramUserId)&&Math.abs((Date.parse(x.createdAt||'')||0)-created)<10*60*1000);if(recent.length)flags.push('چند سفارش از یک کاربر در ۱۰ دقیقه');const hourly=orders.filter(x=>String(x.telegramUserId||'')===String(o.telegramUserId)&&now-(Date.parse(x.createdAt||'')||0)<60*60*1000);if(hourly.length>=5)flags.push('تعداد سفارش زیاد در یک ساعت');}if(Number(o.discount||0)>Number(o.originalPrice||0)*0.8&&Number(o.originalPrice||0)>0)flags.push('تخفیف بیش از ۸۰٪');return {...o,riskFlags:flags};});res.json(enriched); });
app.patch("/api/admin/orders/:id", adminOnly, async (req, res) => {
  const data = readData(); const order = data.orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "سفارش پیدا نشد." });
  const status = String(req.body?.status || "");
  if (!["pending", "approved", "rejected", "warned", "fulfilled"].includes(status)) return res.status(400).json({ error: "وضعیت نامعتبر است." });
  const reason = String(req.body?.reason || "").trim().slice(0,500);
  const subscriptionUrl = String(req.body?.subscriptionUrl || "").trim().slice(0,2000);
  if (["rejected", "warned"].includes(status) && !reason) return res.status(400).json({error:"برای رد یا اخطار، توضیح مشکل را وارد کن."});
  if (status === "approved" && order.paymentMethod !== "wallet" && !order.receiptImage) return res.status(400).json({error:"تا وقتی تصویر رسید پرداخت ارسال نشده، تأیید سفارش ممکن نیست."});
  if (status === "fulfilled" && order.paymentMethod !== "wallet" && !order.receiptImage && order.paymentStatus !== "verified") return res.status(400).json({error:"برای تحویل، ابتدا رسید پرداخت باید ارسال و تأیید شود."});
  if (subscriptionUrl && !/^https:\/\//i.test(subscriptionUrl)) return res.status(400).json({error:"لینک سرویس باید با https شروع شود."});
  order.status = status; order.reviewReason = reason; order.updatedAt = new Date().toISOString();
  if(status === "approved" || status === "fulfilled") { order.paymentStatus = "verified"; order.approvedAt = order.approvedAt || new Date().toISOString(); }
  if(status === "rejected") order.paymentStatus = "rejected";
  if(status === "warned") order.paymentStatus = "warning";
  if(subscriptionUrl) order.subscriptionUrl = subscriptionUrl;
  if(status === "approved" && !order.loyaltyAwarded && order.telegramUserId) { data.loyalty=data.loyalty||{}; data.loyalty[order.telegramUserId]=(Number(data.loyalty[order.telegramUserId])||0)+Math.max(1,Math.floor((Number(order.price)||0)/10000)); order.loyaltyAwarded=true; }
  if(status === "approved" && order.telegramUserId && !order.referralRewardChecked){data.referrals=data.referrals||{codes:{},events:[]};data.referrals.events=data.referrals.events||[];const event=data.referrals.events.find(e=>e.invitee===String(order.telegramUserId)&&e.status==='registered');if(event){data.loyalty=data.loyalty||{};data.loyalty[event.inviter]=(Number(data.loyalty[event.inviter])||0)+100;event.status='purchase_rewarded';event.rewardedAt=new Date().toISOString();}order.referralRewardChecked=true;}
  if(status === "approved" && !order.wheelChancesGranted) { const service=data.services.find(s=>s.id===order.serviceId); const plan=service?.plans?.find(p=>p.id===order.planId); order.wheelChancesGranted=Math.max(0,Math.min(100,Number(plan?.spinChances ?? 1)||0)); order.wheelChancesGrantedAt=new Date().toISOString(); }
  audit(data,"order.status_changed",{id:order.id,status,reason:!!reason,subscriptionLink:!!subscriptionUrl}); saveData(data);
  let text = status === "approved" ? `✅ پرداخت سفارش ${order.id} تأیید شد.\nپلن: ${order.planTitle}\nکد پیگیری: ${order.id}\nشانس گردونه: ${order.wheelChancesGranted||0}` : status === "rejected" ? `❌ رسید سفارش ${order.id} لغو شد.\nعلت: ${reason}\nلطفاً مشکل را اصلاح کن و رسید معتبر ارسال کن.` : status === "warned" ? `⚠️ اخطار درباره رسید سفارش ${order.id}\nعلت: ${reason}\nرسید جعلی یا تکرار تخلف ممکن است باعث مسدودشدن دسترسی شود. اگر اشتباه شده با پشتیبانی تماس بگیر.` : status === "fulfilled" ? `🎉 سرویس سفارش ${order.id} تحویل شد.\n${subscriptionUrl ? `لینک اشتراک: ${subscriptionUrl}` : "برای دریافت سرویس به مینی‌اپ مراجعه کن."}` : `🔔 وضعیت سفارش ${order.id}: ${status}\n${reason}`;
  if(subscriptionUrl && status !== "fulfilled") text += `\nلینک اشتراک: ${subscriptionUrl}`;
  await notifyTelegram(order.telegramUserId, text);
  if(order.recipientTelegramUserId && ['approved','fulfilled'].includes(status)) { const giftText=status==='approved'?`🎁 هدیه‌ای برای شما خریداری شده و پرداخت آن تأیید شده است.\nسفارش: ${order.id}\nسرویس: ${order.serviceName} · ${order.planTitle}\nبرای تحویل نهایی منتظر پیام بعدی باشید.`:`🎉 هدیه Sami WireGuard برای شما آماده شد.\nسفارش: ${order.id}\n${subscriptionUrl?`لینک اشتراک: ${subscriptionUrl}`:'برای دریافت لینک با پشتیبانی تماس بگیرید.'}`; await notifyTelegram(order.recipientTelegramUserId,giftText); }
  res.json({ ok:true, order });
});

app.get("/api/roulette/status", (req,res)=>{const d=readData(),uid=verifyTelegramInitData(String(req.query.initData||""));if(!uid)return res.status(401).json({error:"هویت تلگرام تأیید نشد"});const now=Date.now(),campaignActive=(!d.roulette?.startsAt||Date.parse(d.roulette.startsAt)<=now)&&(!d.roulette?.endsAt||Date.parse(d.roulette.endsAt)>now);const orders=(d.orders||[]).filter(o=>String(o.telegramUserId||"")===uid&&["approved","fulfilled"].includes(o.status));const granted=orders.reduce((n,o)=>n+Math.max(0,Number(o.wheelChancesGranted??1)||0),0)+Math.max(0,Number(d.roulette?.bonusSpins?.[uid]||0));const used=Number(d.roulette?.spins?.[uid]?.count||0);res.json({ok:true,enabled:!!d.roulette?.enabled&&campaignActive,campaignActive,startsAt:d.roulette?.startsAt||null,endsAt:d.roulette?.endsAt||null,granted,used,remaining:Math.max(0,granted-used),history:(d.roulette?.spins?.[uid]?.history||[]).slice(0,30)});});
app.get("/api/roulette/history",(req,res)=>{const d=readData(),uid=verifyTelegramInitData(String(req.query.initData||""));if(!uid)return res.status(401).json({error:"هویت تلگرام تأیید نشد"});res.json({ok:true,history:(d.roulette?.spins?.[uid]?.history||[]).slice(0,50)});});
app.post("/api/roulette/spin", async (req, res) => {
  const data = readData(), uid = verifyTelegramInitData(String(req.body?.initData || ""));
  if (!data.roulette?.enabled || (data.roulette.startsAt&&Date.parse(data.roulette.startsAt)>Date.now()) || (data.roulette.endsAt&&Date.parse(data.roulette.endsAt)<=Date.now())) return res.status(403).json({ error: "گردونه در حال حاضر خارج از بازه کمپین است." });
  if (!uid) return res.status(401).json({ error: "هویت تلگرام تأیید نشد؛ مینی‌اپ را از داخل ربات باز کن و TELEGRAM_BOT_TOKEN را تنظیم کن." });
  data.roulette.spins = data.roulette.spins || {};
  const eligibleOrders=(data.orders||[]).filter(o=>String(o.telegramUserId||'')===uid&&['approved','fulfilled'].includes(o.status)); const granted=eligibleOrders.reduce((n,o)=>n+Math.max(0,Number(o.wheelChancesGranted ?? 1)||0),0)+Math.max(0,Number(data.roulette?.bonusSpins?.[uid]||0)); if(!granted)return res.status(403).json({error:'هنوز شانسی برای گردونه نداری؛ پس از تأیید رسید، شانس پلن به حسابت اضافه می‌شود.'}); data.roulette.spins=data.roulette.spins||{}; const used=Number(data.roulette.spins[uid]?.count||0); if(used>=granted)return res.status(409).json({error:`همه شانس‌هایت استفاده شده. تعداد شانس خریدهای تأییدشده: ${granted}`,remaining:0});
  const prizes = (data.roulette.prizes || []).filter(p => p.label && Number(p.weight)>0).slice(0,8);
  if (!prizes.length) return res.status(503).json({ error: "مدیر هنوز جایزه و درصدهای گردونه را تنظیم نکرده است." });
  const total = prizes.reduce((a,p)=>a+Number(p.weight),0); let n=Math.random()*total, prize=prizes[prizes.length-1];
  for (const p of prizes) { n-=Number(p.weight); if(n<=0){prize=p;break;} }
  const spinEntry={id:crypto.randomUUID(),prize:prize.label,type:prize.type||"gift",value:Number(prize.value)||0,at:new Date().toISOString(),orderId:eligibleOrders.find(o=>Number(o.wheelChancesGranted??1)>0)?.id||null,code:"SAM-"+crypto.randomBytes(3).toString("hex").toUpperCase()}; if(prize.type==='extra'){data.roulette.bonusSpins=data.roulette.bonusSpins||{};data.roulette.bonusSpins[uid]=Number(data.roulette.bonusSpins[uid]||0)+1;} if(prize.type==='discount'&&Number(prize.value)>0){data.coupons=data.coupons||[];spinEntry.couponCode='WIN-'+crypto.randomBytes(4).toString('hex').toUpperCase();data.coupons.push({code:spinEntry.couponCode,type:'percent',value:Math.min(100,Number(prize.value)),maxUses:1,used:0,enabled:true,expiresAt:new Date(Date.now()+30*86400000).toISOString(),createdAt:new Date().toISOString(),source:'roulette',userId:uid});} const previous=data.roulette.spins[uid]||{}; const history=Array.isArray(previous.history)?previous.history:((previous.prize&&previous.at)?[{prize:previous.prize,at:previous.at,orderId:previous.orderId}]:[]); history.unshift(spinEntry); data.roulette.spins[uid]={...previous,...spinEntry,count:used+1,history:history.slice(0,100)}; audit(data,'roulette.spun',{userId:uid,prize:prize.label,orderId:spinEntry.orderId}); saveData(data);
  await notifyTelegram(uid, `🎁 نتیجه گردونه شانس سامی\nجایزه شما: ${prize.label}\nکد نتیجه: ${spinEntry.code}${spinEntry.couponCode?`\nکد تخفیف قابل استفاده: ${spinEntry.couponCode}`:""}\nبرای اعمال جایزه دستی، این پیام را برای پشتیبانی ارسال کن.`);
  res.json({ ok:true, prize:prize.label, prizeIndex:prizes.indexOf(prize), prizeType:prize.type||"gift", prizeValue:Number(prize.value)||0, historyEntry:spinEntry, remaining:Math.max(0,granted-used-1), message:spinEntry.couponCode?`کد تخفیف شما: ${spinEntry.couponCode}`:(prize.type==='extra'?"یک شانس اضافه دریافت کردی!":"نتیجه ثبت شد؛ برای اعمال جایزه دستی، کد نتیجه را به پشتیبانی بده.") });
});
// Gaming server directory. Latency is measured as HTTPS endpoint response time, not ICMP/game ping.
app.get('/api/gaming/speedtest',(req,res)=>{const requested=Math.max(65536,Math.min(1048576,Number(req.query.bytes)||262144));res.setHeader('Content-Type','application/octet-stream');res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');res.setHeader('X-Content-Type-Options','nosniff');res.send(Buffer.alloc(requested,0x53));});
app.get('/api/gaming/servers',(req,res)=>{const d=readData();res.json({servers:(d.gamingServers||[]).filter(s=>s.enabled!==false).map(({id,name,game,url,enabled,lastCheck})=>({id,name,game,enabled,url,online:lastCheck?.ok??null,latencyMs:lastCheck?.latencyMs??null,lastCheckedAt:lastCheck?.at??null,checkNote:lastCheck?.note||'هنوز بررسی نشده'}))});});
adminRoute('post','/api/admin/gaming/servers',(req,res)=>{const d=readData(),b=req.body||{},name=String(b.name||'').trim().slice(0,80),game=String(b.game||'عمومی').slice(0,80),url=String(b.url||'').trim();if(!name||!/^https:\/\//i.test(url))return res.status(400).json({error:'نام سرور و آدرس HTTPS معتبر الزامی است.'});let u;try{u=new URL(url)}catch{return res.status(400).json({error:'آدرس سرور معتبر نیست.'})}if(['localhost','127.0.0.1','0.0.0.0','::1'].includes(u.hostname.toLowerCase())||u.hostname.endsWith('.local'))return res.status(400).json({error:'آدرس محلی مجاز نیست.'});d.gamingServers=d.gamingServers||[];if(d.gamingServers.length>=50)return res.status(400).json({error:'حداکثر ۵۰ سرور قابل ثبت است.'});const server={id:'GS-'+crypto.randomBytes(4).toString('hex').toUpperCase(),name,game,url:u.toString(),enabled:true,lastCheck:null,createdAt:new Date().toISOString()};d.gamingServers.push(server);audit(d,'gaming_server.created',{id:server.id,game});saveData(d);res.json({ok:true,servers:d.gamingServers});});
adminRoute('post','/api/admin/gaming/servers/check',async(req,res)=>{const d=readData();d.gamingServers=d.gamingServers||[];for(const server of d.gamingServers){const started=Date.now();try{const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),4500);const response=await fetch(server.url,{method:'GET',redirect:'manual',signal:ctrl.signal,headers:{'User-Agent':'SamiGamingMonitor/1.0'}});clearTimeout(timer);server.lastCheck={ok:response.status>=200&&response.status<400,status:response.status,latencyMs:Date.now()-started,at:new Date().toISOString(),note:response.status>=200&&response.status<400?'endpoint پاسخ داد':'endpoint پاسخ خطا داد'};try{await response.body?.cancel()}catch{}}catch(e){server.lastCheck={ok:false,latencyMs:null,at:new Date().toISOString(),note:e.name==='AbortError'?'مهلت پاسخ تمام شد':'اتصال ناموفق'};}}audit(d,'gaming_servers.checked',{count:d.gamingServers.length});saveData(d);res.json({ok:true,servers:d.gamingServers.map(({id,name,game,url,enabled,lastCheck})=>({id,name,game,url,enabled,lastCheck}))});});
adminRoute('patch','/api/admin/gaming/servers/:id', (req,res)=>{const d=readData(),s=(d.gamingServers||[]).find(x=>x.id===req.params.id);if(!s)return res.status(404).json({error:'سرور پیدا نشد.'});if(typeof req.body?.enabled==='boolean')s.enabled=req.body.enabled;audit(d,'gaming_server.updated',{id:s.id,enabled:s.enabled});saveData(d);res.json({ok:true,server:s});});

// Admin tools: real server-side records for tickets, coupons, wallet, providers, reports and backups.
adminRoute('get','/api/admin/analytics',(req,res)=>{const d=readData(), orders=d.orders||[], paid=orders.filter(o=>['approved','fulfilled'].includes(o.status));res.json({orders:orders.length,pending:orders.filter(o=>o.status==='pending').length,receipts:orders.filter(o=>o.paymentStatus==='receipt_submitted').length,paidRevenue:paid.reduce((n,o)=>n+(Number(o.price)||0),0),byService:Object.values(orders.reduce((a,o)=>{a[o.serviceName]=(a[o.serviceName]||0)+1;return a},{})).length?orders.reduce((a,o)=>{a[o.serviceName]=(a[o.serviceName]||0)+1;return a},{}):{},tickets:(d.tickets||[]).length,riskFlags:orders.filter(o=>{const c=orders.filter(x=>x.id!==o.id&&x.telegramUserId&&x.telegramUserId===o.telegramUserId&&Math.abs((Date.parse(x.createdAt||'')||0)-(Date.parse(o.createdAt||'')||0))<600000);return c.length>0||((Number(o.discount)||0)>(Number(o.originalPrice)||0)*0.8&&Number(o.originalPrice)>0)}).length,customers:[...new Set(orders.map(o=>o.telegramUserId).filter(Boolean))].length,expenses:(d.expenses||[]).reduce((n,x)=>n+(Number(x.amount)||0),0),net:paid.reduce((n,o)=>n+(Number(o.price)||0),0)-(d.expenses||[]).reduce((n,x)=>n+(Number(x.amount)||0),0)});} );
adminRoute('get','/api/admin/tickets',(req,res)=>res.json(readData().tickets||[]));
adminRoute('post','/api/admin/tickets',(req,res)=>{const d=readData(),b=req.body||{};if(!b.subject||!b.message)return res.status(400).json({error:'عنوان و متن تیکت الزامی است.'});const t={id:'TK-'+crypto.randomBytes(4).toString('hex').toUpperCase(),userId:userKey(b.userId),subject:String(b.subject).slice(0,120),message:String(b.message).slice(0,2000),status:'open',createdAt:new Date().toISOString(),replies:[]};d.tickets=d.tickets||[];d.tickets.unshift(t);audit(d,'ticket.created',{id:t.id});saveData(d);res.json({ok:true,ticket:t});});
adminRoute('patch','/api/admin/tickets/:id',(req,res)=>{const d=readData(),t=(d.tickets||[]).find(x=>x.id===req.params.id);if(!t)return res.status(404).json({error:'تیکت پیدا نشد.'});if(['open','in_progress','closed'].includes(req.body.status))t.status=req.body.status;if(req.body.reply){t.replies=t.replies||[];t.replies.push({message:String(req.body.reply).slice(0,2000),at:new Date().toISOString()});}audit(d,'ticket.updated',{id:t.id,status:t.status});saveData(d);res.json({ok:true,ticket:t});});
adminRoute('get','/api/admin/coupons',(req,res)=>res.json(readData().coupons||[]));
adminRoute('post','/api/admin/coupons',(req,res)=>{const d=readData(),b=req.body||{},code=String(b.code||'').toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,32);if(!code||!Number.isFinite(Number(b.value))||Number(b.value)<=0)return res.status(400).json({error:'کد و مقدار معتبر وارد کن.'});d.coupons=d.coupons||[];if(d.coupons.some(c=>c.code===code))return res.status(409).json({error:'این کد قبلاً ثبت شده است.'});const c={code,type:b.type==='fixed'?'fixed':'percent',value:Math.min(Number(b.value),b.type==='fixed'?100000000:100),maxUses:Math.max(1,Math.min(100000,Number(b.maxUses)||100)),used:0,enabled:b.enabled!==false,expiresAt:b.expiresAt||null,createdAt:new Date().toISOString()};d.coupons.push(c);audit(d,'coupon.created',{code});saveData(d);res.json({ok:true,coupon:c});});
adminRoute('patch','/api/admin/coupons/:code',(req,res)=>{const d=readData(),c=(d.coupons||[]).find(x=>x.code===String(req.params.code).toUpperCase());if(!c)return res.status(404).json({error:'کد تخفیف پیدا نشد.'});if(typeof req.body.enabled==='boolean')c.enabled=req.body.enabled;audit(d,'coupon.updated',{code:c.code});saveData(d);res.json({ok:true,coupon:c});});
app.post('/api/coupons/validate',(req,res)=>{const d=readData(),code=String(req.body?.code||'').toUpperCase(),c=(d.coupons||[]).find(x=>x.code===code&&x.enabled&&x.used<x.maxUses&&(!x.expiresAt||Date.parse(x.expiresAt)>Date.now()));if(!c)return res.status(400).json({error:'کد تخفیف نامعتبر، غیرفعال یا منقضی شده است.'});const amount=Math.max(0,Number(req.body?.amount)||0),discount=c.type==='fixed'?Math.min(amount,c.value):Math.floor(amount*c.value/100);res.json({ok:true,code:c.code,discount,finalAmount:amount-discount,type:c.type,value:c.value});});
app.get('/api/wallet/:userId/ledger',(req,res)=>{const id=userKey(req.params.userId),verified=verifyTelegramInitData(String(req.query.initData||''));if(!verified||verified!==id)return res.status(401).json({error:'هویت تلگرام تأیید نشد.'});const d=readData();res.json((d.walletLedger||[]).filter(x=>String(x.userId)===id).slice(0,100));});
app.get('/api/wallet/:userId',(req,res)=>{const id=userKey(req.params.userId),verified=verifyTelegramInitData(String(req.query.initData||''));if(!verified||verified!==id)return res.status(401).json({error:'برای مشاهده کیف پول، هویت تلگرام همین کاربر باید تأیید شود.'});const d=readData();res.json({userId:id,balance:Number((d.wallets||{})[id]||0),points:Number((d.loyalty||{})[id]||0)});});
adminRoute('get','/api/admin/wallet/:userId/ledger',(req,res)=>{const d=readData(),id=userKey(req.params.userId);res.json((d.walletLedger||[]).filter(x=>String(x.userId)===id).slice(0,200));});
adminRoute('post','/api/admin/wallet/adjust',(req,res)=>{const d=readData(),id=userKey(req.body?.userId),amount=Math.round(Number(req.body?.amount)||0);if(!id||!amount)return res.status(400).json({error:'شناسه کاربر و مبلغ غیرصفر الزامی است.'});d.wallets=d.wallets||{};const next=(Number(d.wallets[id])||0)+amount;if(next<0)return res.status(400).json({error:'موجودی کیف پول منفی نمی‌تواند شود.'});d.wallets[id]=next;d.walletLedger=d.walletLedger||[];d.walletLedger.unshift({id:'WL-'+crypto.randomBytes(4).toString('hex').toUpperCase(),userId:id,amount,balance:next,source:'admin_adjustment',at:new Date().toISOString()});d.walletLedger=d.walletLedger.slice(0,5000);audit(d,'wallet.adjusted',{userId:id,amount,balance:next});saveData(d);res.json({ok:true,userId:id,balance:next,ledger:d.walletLedger[0]});});
adminRoute('get','/api/admin/providers',(req,res)=>res.json(readData().providers||[]));
adminRoute('post','/api/admin/providers',(req,res)=>{const d=readData(),b=req.body||{};if(!b.name)return res.status(400).json({error:'نام تأمین‌کننده الزامی است.'});d.providers=d.providers||[];const p={id:b.id||'PR-'+crypto.randomBytes(4).toString('hex').toUpperCase(),name:String(b.name).slice(0,100),type:String(b.type||'wireguard').slice(0,40),baseUrl:String(b.baseUrl||'').slice(0,300),apiKey:String(b.apiKey||'').slice(0,300),enabled:b.enabled!==false,priority:Math.max(1,Number(b.priority)||1),lastCheck:null};d.providers.push(p);audit(d,'provider.created',{id:p.id,name:p.name});saveData(d);res.json({ok:true,provider:p});});
adminRoute('patch','/api/admin/providers/:id',(req,res)=>{const d=readData(),p=(d.providers||[]).find(x=>x.id===req.params.id);if(!p)return res.status(404).json({error:'تأمین‌کننده پیدا نشد.'});for(const k of ['name','type','baseUrl','apiKey'])if(typeof req.body[k]==='string')p[k]=req.body[k].slice(0,300);if(typeof req.body.enabled==='boolean')p.enabled=req.body.enabled;if(req.body.priority)p.priority=Math.max(1,Number(req.body.priority)||1);audit(d,'provider.updated',{id:p.id});saveData(d);res.json({ok:true,provider:p});});
adminRoute('post','/api/admin/expenses',(req,res)=>{const d=readData(),b=req.body||{},amount=Number(b.amount);if(!b.title||!Number.isFinite(amount)||amount<=0)return res.status(400).json({error:'شرح و مبلغ هزینه معتبر لازم است.'});d.expenses=d.expenses||[];const e={id:'EX-'+crypto.randomBytes(4).toString('hex').toUpperCase(),title:String(b.title).slice(0,120),amount:Math.round(amount),category:String(b.category||'general').slice(0,50),at:new Date().toISOString()};d.expenses.unshift(e);audit(d,'expense.created',{id:e.id,amount:e.amount});saveData(d);res.json({ok:true,expense:e});});
adminRoute('get','/api/admin/audit',(req,res)=>res.json((readData().audit||[]).slice(0,500)));
// Portable migration key: carries customer orders, wallet balances/ledger and account-related state between deployments.
adminRoute('post','/api/admin/migration/export',(req,res)=>{
  const data=readData();
  const payload={format:'SAMI-MIGRATION',version:1,createdAt:new Date().toISOString(),data:{orders:data.orders||[],wallets:data.wallets||{},walletLedger:data.walletLedger||[],loyalty:data.loyalty||{},referrals:data.referrals||{},tickets:data.tickets||[],roulette:data.roulette||{},reviews:data.reviews||[],giftCards:data.giftCards||[],notifications:data.notifications||{},users:data.users||[]}};
  const raw=JSON.stringify(payload), checksum=crypto.createHash('sha256').update(raw).digest('hex');
  const key='SAMI-MOVE-V1.'+Buffer.from(JSON.stringify({payload,checksum})).toString('base64url');
  audit(data,'migration.exported',{orders:payload.data.orders.length});saveData(data);
  res.json({ok:true,key,counts:{orders:payload.data.orders.length,walletUsers:Object.keys(payload.data.wallets).length,ledger:payload.data.walletLedger.length},createdAt:payload.createdAt});
});
adminRoute('post','/api/admin/migration/import',(req,res)=>{
  const key=String(req.body?.key||'').trim();
  if(!key.startsWith('SAMI-MOVE-V1.'))return res.status(400).json({error:'کلید انتقال معتبر نیست.'});
  let envelope;try{envelope=JSON.parse(Buffer.from(key.slice('SAMI-MOVE-V1.'.length),'base64url').toString('utf8'))}catch{return res.status(400).json({error:'فرمت کلید انتقال خراب است یا کامل کپی نشده.'})}
  const raw=JSON.stringify(envelope.payload||{}), checksum=crypto.createHash('sha256').update(raw).digest('hex');
  if(!envelope.payload||envelope.payload.format!=='SAMI-MIGRATION'||envelope.payload.version!==1||checksum!==envelope.checksum||!envelope.payload.data)return res.status(400).json({error:'کلید انتقال ناقص یا دست‌کاری شده است.'});
  const src=envelope.payload.data,d=readData();
  const mergeById=(target,source)=>{const map=new Map((Array.isArray(target)?target:[]).map(x=>[String(x.id||''),x]));for(const item of (Array.isArray(source)?source:[])){const id=String(item.id||'');if(id&&!map.has(id))map.set(id,item)}return [...map.values()]};
  const before={orders:(d.orders||[]).length,ledger:(d.walletLedger||[]).length};
  d.orders=mergeById(d.orders,src.orders).sort((a,b)=>(Date.parse(b.createdAt||'')||0)-(Date.parse(a.createdAt||'')||0)).slice(0,5000);
  d.walletLedger=mergeById(d.walletLedger,src.walletLedger).slice(0,20000);
  for(const [uid,balance] of Object.entries(src.wallets||{})) if(!Object.prototype.hasOwnProperty.call(d.wallets||{},uid)) {d.wallets=d.wallets||{};d.wallets[uid]=Math.max(0,Number(balance)||0)}
  for(const field of ['loyalty','referrals','notifications']){d[field]=d[field]||{};for(const [uid,value] of Object.entries(src[field]||{}))if(!Object.prototype.hasOwnProperty.call(d[field],uid))d[field][uid]=value;}
  for(const field of ['tickets','reviews','giftCards']) if(Array.isArray(src[field]))d[field]=mergeById(d[field],src[field]);
  d.roulette=d.roulette||{};d.roulette.spins=d.roulette.spins||{};for(const [uid,record] of Object.entries(src.roulette?.spins||{}))if(!d.roulette.spins[uid])d.roulette.spins[uid]=record;
  audit(d,'migration.imported',{sourceCreatedAt:envelope.payload.createdAt,ordersAdded:d.orders.length-before.orders,ledgerAdded:d.walletLedger.length-before.ledger});saveData(d);
  res.json({ok:true,message:'انتقال اطلاعات انجام شد. سفارش‌ها و سوابق تکراری دوباره اضافه نشدند؛ موجودی کیف پول فقط برای شناسه‌هایی که اینجا موجودی نداشتند وارد شد.',counts:{ordersBefore:before.orders,ordersAfter:d.orders.length,ledgerBefore:before.ledger,ledgerAfter:d.walletLedger.length,walletUsers:Object.keys(d.wallets||{}).length}});
});
adminRoute('get','/api/admin/backup',(req,res)=>{const d=readData();res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="sami-wireguard-backup.json"');res.send(JSON.stringify({...d,backupCreatedAt:new Date().toISOString()},null,2));});
adminRoute('post','/api/admin/backup/restore',(req,res)=>{const b=req.body;if(!b||!Array.isArray(b.services)||!Array.isArray(b.orders))return res.status(400).json({error:'فایل پشتیبان معتبر نیست.'});const current=readData();const restored={...initial,...b};restored.integration={...initial.integration,...b.integration};restored.orders=b.orders.slice(0,5000);audit(restored,'backup.restored',{orders:restored.orders.length});saveData(restored);res.json({ok:true,message:'پشتیبان بازیابی شد؛ صفحه را تازه‌سازی کن.'});});
adminRoute('post','/api/admin/maintenance',(req,res)=>{const d=readData();d.maintenance=!!req.body?.enabled;d.storeStatus={...(d.storeStatus||{}),online:!d.maintenance,message:d.maintenance?String(req.body?.message||'فروشگاه موقتاً در حال تعمیر است.').slice(0,240):(d.storeStatus?.message||'ثبت سفارش فعال است.')};audit(d,'maintenance.changed',{enabled:d.maintenance});saveData(d);res.json({ok:true,maintenance:d.maintenance});});
app.post('/api/tickets',(req,res)=>{const d=readData(),b=req.body||{},uid=userKey(b.userId),verified=verifyTelegramInitData(String(b.initData||''));if(!verified||verified!==uid)return res.status(401).json({error:'برای ثبت تیکت، هویت تلگرام خود را تأیید کن.'});if(!uid||!b.subject||!b.message)return res.status(400).json({error:'شناسه کاربر، عنوان و متن الزامی است.'});const t={id:'TK-'+crypto.randomBytes(4).toString('hex').toUpperCase(),userId:uid,subject:String(b.subject).slice(0,120),message:String(b.message).slice(0,2000),status:'open',createdAt:new Date().toISOString(),replies:[]};d.tickets=d.tickets||[];d.tickets.unshift(t);saveData(d);res.json({ok:true,ticketId:t.id,status:t.status});});
// Expanded PRO MAX API surface: customer profile, referrals, loyalty, roles, notifications,
// reports/export, catalog, maintenance, provider checks and idempotent bot order intake.
function csvEscape(v){const x=String(v??'');return '"'+x.replace(/"/g,'""')+'"';}
function publicOrder(o){const {receiptImage,...safe}=o;return safe;}
app.get('/api/profile/:userId',(req,res)=>{const uid=userKey(req.params.userId),verified=verifyTelegramInitData(String(req.query.initData||''));if(!verified||verified!==uid)return res.status(401).json({error:'برای مشاهده پروفایل، هویت تلگرام همین کاربر باید تأیید شود.'});const d=readData();if(!uid)return res.status(400).json({error:'شناسه کاربر لازم است.'});const orders=(d.orders||[]).filter(o=>String(o.telegramUserId||'')===uid).map(publicOrder);res.json({userId:uid,balance:Number(d.wallets?.[uid]||0),points:Number(d.loyalty?.[uid]||0),tier:Number(d.loyalty?.[uid]||0)>=1000?'VIP':Number(d.loyalty?.[uid]||0)>=600?'Gold':Number(d.loyalty?.[uid]||0)>=150?'Silver':'Bronze',orders,referralCode:(d.referrals?.codes||{})[uid]||null});});
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


// Sami XP / daily reward / reviews / gift cards — user identity is verified from Telegram initData.
app.get('/api/gamer/hub',(req,res)=>{const uid=userKey(req.query.userId),verified=verifyTelegramInitData(String(req.query.initData||''));if(!verified||verified!==uid)return res.status(401).json({error:'هویت تلگرام تأیید نشد.'});const d=readData(),orders=(d.orders||[]).filter(o=>String(o.telegramUserId||'')===uid),points=Number(d.loyalty?.[uid]||0),today=new Date().toISOString().slice(0,10),daily=d.dailyRewards?.[uid]||{};const achievements=[{id:'first-order',title:'اولین خرید',desc:'ثبت اولین سفارش تأییدشده',done:orders.some(o=>['approved','fulfilled'].includes(o.status))},{id:'collector',title:'کلکسیونر',desc:'سه سفارش تأییدشده',done:orders.filter(o=>['approved','fulfilled'].includes(o.status)).length>=3},{id:'xp-100',title:'۱۰۰ XP',desc:'رسیدن به ۱۰۰ امتیاز',done:points>=100},{id:'referrer',title:'دعوت‌کننده',desc:'ثبت حداقل یک دعوت',done:(d.referrals?.events||[]).some(e=>e.inviter===uid)}];res.json({ok:true,userId:uid,points,tier:points>=1000?'VIP':points>=600?'Gold':points>=150?'Silver':'Bronze',orders:orders.length,dailyClaimed:daily.lastClaimDate===today,streak:Number(daily.streak||0),achievements,notifications:(d.userNotifications||[]).filter(n=>n.userId===uid).slice(0,30),reviews:(d.reviews||[]).filter(r=>r.userId===uid).slice(0,20)});});
app.post('/api/gamer/daily-claim',(req,res)=>{const uid=userKey(req.body?.userId),verified=verifyTelegramInitData(String(req.body?.initData||''));if(!verified||verified!==uid)return res.status(401).json({error:'هویت تلگرام تأیید نشد.'});const d=readData(),today=new Date().toISOString().slice(0,10);d.dailyRewards=d.dailyRewards||{};const old=d.dailyRewards[uid]||{};if(old.lastClaimDate===today)return res.status(409).json({error:'جایزه امروز را قبلاً دریافت کرده‌ای.'});const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10),streak=old.lastClaimDate===yesterday?Math.min(7,Number(old.streak||0)+1):1,reward=10+Math.min(streak,7)*5;d.dailyRewards[uid]={lastClaimDate:today,streak,totalClaims:Number(old.totalClaims||0)+1};d.loyalty=d.loyalty||{};d.loyalty[uid]=(Number(d.loyalty[uid])||0)+reward;d.userNotifications=d.userNotifications||[];d.userNotifications.unshift({id:crypto.randomUUID(),userId:uid,title:'جایزه روزانه دریافت شد',message:`${reward} امتیاز XP به حساب اضافه شد.`,at:new Date().toISOString(),read:false});audit(d,'daily_reward.claimed',{userId:uid,reward,streak});saveData(d);res.json({ok:true,reward,streak,points:d.loyalty[uid]});});
app.get('/api/reviews',(req,res)=>{const d=readData(),reviews=(d.reviews||[]).filter(r=>r.approved!==false).slice(0,100);res.json({ok:true,reviews,average:reviews.length?Math.round(reviews.reduce((n,r)=>n+r.rating,0)/reviews.length*10)/10:0,count:reviews.length});});
app.post('/api/reviews',(req,res)=>{const uid=userKey(req.body?.userId),verified=verifyTelegramInitData(String(req.body?.initData||'')),rating=Math.round(Number(req.body?.rating)||0),orderId=String(req.body?.orderId||'').slice(0,40),comment=String(req.body?.comment||'').trim().slice(0,600);if(!verified||verified!==uid)return res.status(401).json({error:'هویت تلگرام تأیید نشد.'});if(rating<1||rating>5)return res.status(400).json({error:'امتیاز باید بین ۱ تا ۵ باشد.'});const d=readData(),order=(d.orders||[]).find(o=>o.id===orderId&&String(o.telegramUserId)===uid&&['approved','fulfilled'].includes(o.status));if(!order)return res.status(400).json({error:'فقط برای سفارش تأییدشده خودت می‌توانی نظر ثبت کنی.'});d.reviews=d.reviews||[];if(d.reviews.some(r=>r.orderId===orderId))return res.status(409).json({error:'برای این سفارش قبلاً نظر ثبت شده است.'});const review={id:crypto.randomUUID(),userId:uid,orderId,serviceName:order.serviceName,rating,comment,approved:false,createdAt:new Date().toISOString()};d.reviews.unshift(review);audit(d,'review.created',{id:review.id,orderId,rating});saveData(d);res.json({ok:true,message:'نظر ثبت شد و پس از بررسی مدیر نمایش داده می‌شود.'});});
app.get('/api/admin/reviews',(req,res,next)=>adminOnly(req,res,()=>res.json(readData().reviews||[])));
app.post('/api/admin/reviews/:id',(req,res)=>adminOnly(req,res,()=>{const d=readData(),r=(d.reviews||[]).find(x=>x.id===req.params.id);if(!r)return res.status(404).json({error:'نظر پیدا نشد.'});r.approved=!!req.body?.approved;audit(d,'review.moderated',{id:r.id,approved:r.approved});saveData(d);res.json({ok:true,review:r});}));
app.post('/api/admin/gift-cards',(req,res)=>adminOnly(req,res,()=>{const d=readData(),amount=Math.round(Number(req.body?.amount)||0),uses=Math.max(1,Math.min(1000,Math.floor(Number(req.body?.uses)||1)));if(amount<1000||amount>100000000)return res.status(400).json({error:'مبلغ کارت هدیه باید بین ۱۰۰۰ تا ۱۰۰ میلیون تومان باشد.'});d.giftCards=d.giftCards||[];const card={code:'GIFT-'+crypto.randomBytes(5).toString('hex').toUpperCase(),amount,remaining:amount*uses,uses,maxUses:uses,enabled:true,createdAt:new Date().toISOString()};d.giftCards.unshift(card);audit(d,'gift_card.created',{code:card.code,amount});saveData(d);res.json({ok:true,card});}));
app.post('/api/gift-cards/redeem',(req,res)=>{const uid=userKey(req.body?.userId),verified=verifyTelegramInitData(String(req.body?.initData||'')),code=String(req.body?.code||'').trim().toUpperCase();if(!verified||verified!==uid)return res.status(401).json({error:'هویت تلگرام تأیید نشد.'});const d=readData(),c=(d.giftCards||[]).find(x=>x.code===code&&x.enabled&&x.uses>0&&x.remaining>0);if(!c)return res.status(400).json({error:'کارت هدیه نامعتبر یا مصرف‌شده است.'});c.uses--;const credit=Math.min(c.amount,c.remaining);c.remaining-=credit;d.wallets=d.wallets||{};d.wallets[uid]=(Number(d.wallets[uid])||0)+credit;d.walletLedger=d.walletLedger||[];d.walletLedger.unshift({id:'WL-'+crypto.randomBytes(4).toString('hex').toUpperCase(),userId:uid,amount:credit,balance:d.wallets[uid],source:'gift_card',giftCode:c.code,at:new Date().toISOString()});if(c.uses<=0||c.remaining<=0)c.enabled=false;audit(d,'gift_card.redeemed',{code:c.code,userId:uid,credit});saveData(d);res.json({ok:true,credited:credit,balance:d.wallets[uid]});});
app.get('/api/admin/gift-cards',(req,res,next)=>adminOnly(req,res,()=>res.json(readData().giftCards||[])));

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
// Renewal reminder worker: sends at most one reminder per approved order, 3 days before its configured plan duration ends.
async function sendRenewalReminders(){try{const d=readData(),now=Date.now();let changed=false;for(const o of (d.orders||[])){if(!['approved','fulfilled'].includes(o.status)||!o.telegramUserId||o.renewalReminderSentAt||!o.approvedAt)continue;const svc=d.services.find(s=>s.id===o.serviceId),plan=svc?.plans?.find(p=>p.id===o.planId),days=Math.max(1,Number(plan?.days)||30),expires=Date.parse(o.approvedAt)+days*86400000;if(expires-now<=3*86400000&&expires>now){const result=await notifyTelegram(o.telegramUserId,`⏳ یادآوری تمدید سامی\nاعتبار تقریبی پلن «${o.planTitle}» سفارش ${o.id} تا حدود ۳ روز دیگر به پایان می‌رسد. برای تمدید از مینی‌اپ خرید تازه ثبت کن.`);if(result.sent){o.renewalReminderSentAt=new Date().toISOString();changed=true;}}}if(changed)saveData(d);}catch(e){console.error('Renewal reminder worker failed:',e.message)}}
setInterval(sendRenewalReminders,6*60*60*1000).unref();
app.listen(PORT, "0.0.0.0", () => console.log(`Sami Mini App listening on ${PORT}`));
