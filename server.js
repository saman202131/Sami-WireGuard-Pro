'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');

const PORT = Number(process.env.PORT || 10000);
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DATA_FILE = process.env.DATA_FILE || path.join(ROOT_DIR, 'data.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

const adminSessions = new Set();
const MAX_BODY = 200 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

/*
 * اگر index.html داخل public باشد، همان پوشه استفاده می‌شود.
 * در غیر این صورت، فایل‌های سایت از پوشه اصلی پروژه خوانده می‌شوند.
 */
function getSiteDir() {
  const publicIndex = path.join(PUBLIC_DIR, 'index.html');
  const rootIndex = path.join(ROOT_DIR, 'index.html');

  if (fs.existsSync(publicIndex)) return PUBLIC_DIR;
  if (fs.existsSync(rootIndex)) return ROOT_DIR;

  return PUBLIC_DIR;
}

const initial = {
  brand: 'Sami WireGuard',
  supportUsername: process.env.SUPPORT_USERNAME || 'saman_s87',
  channelUrl: process.env.CHANNEL_URL || 'https://t.me/SamiWireGuard',
  announcement: 'اتصال پایدار، مدیریت ساده و خرید سریع',

  services: [
    {
      id: 'wireguard',
      name: 'WireGuard',
      subtitle: 'کانفیگ و اشتراک WireGuard',
      icon: '⚡',
      enabled: true,
      accent: 'blue',
      plans: [
        {
          id: 'wg10',
          title: '۱۰ گیگابایت',
          volume: '10 GB',
          days: 30,
          price: 160000,
          enabled: true
        },
        {
          id: 'wg20',
          title: '۲۰ گیگابایت',
          volume: '20 GB',
          days: 30,
          price: 290000,
          enabled: true
        },
        {
          id: 'wg50',
          title: '۵۰ گیگابایت',
          volume: '50 GB',
          days: 30,
          price: 590000,
          enabled: true
        }
      ]
    },
    {
      id: 'v2ray',
      name: 'V2Ray',
      subtitle: 'اشتراک و لینک اتصال',
      icon: '🛡️',
      enabled: true,
      accent: 'purple',
      plans: [
        {
          id: 'v210',
          title: '۱۰ گیگابایت',
          volume: '10 GB',
          days: 30,
          price: 160000,
          enabled: true
        },
        {
          id: 'v220',
          title: '۲۰ گیگابایت',
          volume: '20 GB',
          days: 30,
          price: 290000,
          enabled: true
        },
        {
          id: 'v250',
          title: '۵۰ گیگابایت',
          volume: '50 GB',
          days: 30,
          price: 590000,
          enabled: true
        }
      ]
    },
    {
      id: 'dns',
      name: 'DNS',
      subtitle: 'سرویس DNS',
      icon: '🌐',
      enabled: true,
      accent: 'cyan',
      plans: [
        {
          id: 'dns30',
          title: '۳۰ روزه',
          volume: 'DNS',
          days: 30,
          price: 50000,
          enabled: true
        }
      ]
    }
  ],

  roulette: {
    enabled: true,
    title: 'باشگاه سامی'
  },

  orders: []
};

function saveData(data) {
  const directory = path.dirname(DATA_FILE);
  fs.mkdirSync(directory, { recursive: true });

  const temporaryFile = DATA_FILE + '.tmp';

  fs.writeFileSync(
    temporaryFile,
    JSON.stringify(data, null, 2),
    'utf8'
  );

  fs.renameSync(temporaryFile, DATA_FILE);
}

function readData() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

    if (!Array.isArray(data.services)) {
      data.services = structuredClone(initial.services);
    }

    if (!Array.isArray(data.orders)) {
      data.orders = [];
    }

    return data;
  } catch {
    const data = structuredClone(initial);
    saveData(data);
    return data;
  }
}

function safePublic(data) {
  return {
    brand: data.brand,
    announcement: data.announcement,
    supportUsername: data.supportUsername || 'saman_s87',
    channelUrl: data.channelUrl || 'https://t.me/SamiWireGuard',

    services: (data.services || []).map(service => ({
      ...service,
      plans: service.plans || []
    })),

    roulette: {
      enabled: !!data.roulette?.enabled,
      title: data.roulette?.title || 'باشگاه سامی'
    }
  };
}

function send(res, status, body, headers = {}) {
  const isText = typeof body === 'string';

  const payload = isText
    ? body
    : JSON.stringify(body);

  res.writeHead(status, {
    'content-type': isText
      ? 'text/plain; charset=utf-8'
      : 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers
  });

  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;

    req.on('data', chunk => {
      size += chunk.length;

      if (size > MAX_BODY) {
        reject(
          Object.assign(
            new Error('حجم درخواست بیش از حد است.'),
            { status: 413 }
          )
        );

        req.destroy();
        return;
      }

      body += chunk.toString('utf8');
    });

    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(
          Object.assign(
            new Error('JSON درخواست نامعتبر است.'),
            { status: 400 }
          )
        );
      }
    });

    req.on('error', reject);
  });
}

function isAdmin(req) {
  const authorization = req.headers.authorization || '';

  const token = authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : '';

  return !!token && adminSessions.has(token);
}

function cleanService(raw, current) {
  const id = String(raw.id || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 48);

  if (!id || !raw.name) return null;

  const previous = current.services.find(service => service.id === id);

  const plans = Array.isArray(raw.plans)
    ? raw.plans
    : (previous?.plans || []);

  return {
    id,

    name: String(raw.name).slice(0, 60),

    subtitle: String(
      raw.subtitle || raw.description || 'سرویس ویژه سامی'
    ).slice(0, 120),

    icon: String(raw.icon || '✦').slice(0, 8),

    accent: ['blue', 'purple', 'cyan', 'green', 'gold', 'red']
      .includes(raw.accent || raw.color)
      ? (raw.accent || raw.color)
      : 'blue',

    enabled: raw.enabled !== false,

    plans: plans.slice(0, 40).map((plan, index) => ({
      id: String(plan.id || `${id}-${index + 1}`)
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '')
        .slice(0, 50),

      title: String(plan.title || plan.name || 'بسته').slice(0, 70),

      volume: String(plan.volume || '').slice(0, 30),

      days: Math.max(
        1,
        Math.min(3650, Number(plan.days) || 30)
      ),

      price: Math.max(
        0,
        Math.round(Number(plan.price) || 0)
      ),

      enabled: plan.enabled !== false
    }))
  };
}

function serveFile(req, res, file) {
  let stat;

  try {
    stat = fs.statSync(file);

    if (!stat.isFile()) {
      return false;
    }
  } catch {
    return false;
  }

  const extension = path.extname(file).toLowerCase();

  res.writeHead(200, {
    'content-type': MIME[extension] || 'application/octet-stream',
    'cache-control': extension === '.html'
      ? 'no-cache'
      : 'public, max-age=300'
  });

  if (req.method === 'HEAD') {
    res.end();
    return true;
  }

  const stream = fs.createReadStream(file);

  stream.on('error', error => {
    console.error('File read error:', error.message);

    if (!res.headersSent) {
      send(res, 500, 'خطا در خواندن فایل.');
    } else {
      res.destroy();
    }
  });

  stream.pipe(res);

  return true;
}

async function handle(req, res) {
  let url;

  try {
    url = new URL(req.url, 'http://localhost');
  } catch {
    return send(res, 400, { error: 'آدرس درخواست نامعتبر است.' });
  }

  let pathname;

  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return send(res, 400, { error: 'آدرس درخواست نامعتبر است.' });
  }

  const method = req.method || 'GET';

  // وضعیت سرور
  if (method === 'GET' && pathname === '/health') {
    return send(res, 200, { ok: true });
  }

  // اطلاعات عمومی فروشگاه
  if (method === 'GET' && pathname === '/api/config') {
    return send(res, 200, safePublic(readData()));
  }

  // بررسی پاسخ‌گویی مقصدهای عمومی
  if (method === 'GET' && pathname === '/api/ping') {
    const targets = {
      cloudflare: 'https://www.cloudflare.com/cdn-cgi/trace',
      google: 'https://www.google.com/generate_204',
      dns: 'https://dns.google/resolve?name=example.com&type=A'
    };

    const target = url.searchParams.get('target') || '';

    if (!Object.prototype.hasOwnProperty.call(targets, target)) {
      return send(res, 400, {
        ok: false,
        error: 'مقصد تست نامعتبر است.'
      });
    }

    const started = Date.now();

    try {
      const response = await fetch(targets[target], {
        method: 'GET',
        signal: AbortSignal.timeout(4000),
        headers: {
          'user-agent': 'SamiWireGuard-PingCheck/1.0'
        }
      });

      const ms = Date.now() - started;

      if (response.body) {
        await response.body.cancel().catch(() => {});
      }

      return send(res, 200, {
        ok: response.ok,
        ms,
        target,
        status: response.status,
        note: 'server-side public endpoint response time'
      });
    } catch {
      return send(res, 200, {
        ok: false,
        ms: null,
        target,
        note: 'destination did not respond from hosting'
      });
    }
  }

  // ورود مدیر
  if (method === 'POST' && pathname === '/api/admin/login') {
    const body = await readBody(req);

    if (!ADMIN_PASSWORD) {
      return send(res, 503, {
        error: 'ابتدا ADMIN_PASSWORD را در Environment رندر تنظیم کن.'
      });
    }

    if (body.password !== ADMIN_PASSWORD) {
      return send(res, 401, {
        error: 'رمز عبور اشتباه است.'
      });
    }

    const token = crypto.randomBytes(32).toString('hex');

    adminSessions.add(token);

    return send(res, 200, { token });
  }

  // محافظت از مسیرهای مدیریت
  if (
    pathname.startsWith('/api/admin/') &&
    !isAdmin(req)
  ) {
    return send(res, 401, {
      error: 'دسترسی مدیر تأیید نشد.'
    });
  }

  // دریافت تنظیمات مدیر
  if (method === 'GET' && pathname === '/api/admin/config') {
    return send(res, 200, readData());
  }

  // ذخیره تنظیمات مدیر
  if (method === 'PUT' && pathname === '/api/admin/config') {
    const current = readData();
    const incoming = await readBody(req);

    if (typeof incoming.announcement === 'string') {
      current.announcement = incoming.announcement.slice(0, 240);
    }

    if (typeof incoming.supportUsername === 'string') {
      current.supportUsername = incoming.supportUsername
        .replace(/^@/, '')
        .replace(/[^a-zA-Z0-9_]/g, '')
        .slice(0, 40);
    }

    if (
      typeof incoming.channelUrl === 'string' &&
      /^https:\/\/t\.me\/[a-zA-Z0-9_]+/.test(incoming.channelUrl)
    ) {
      current.channelUrl = incoming.channelUrl.slice(0, 160);
    }

    if (
      incoming.roulette &&
      typeof incoming.roulette.enabled === 'boolean'
    ) {
      current.roulette = {
        enabled: incoming.roulette.enabled,
        title: String(
          incoming.roulette.title || 'باشگاه سامی'
        ).slice(0, 70)
      };
    }

    if (Array.isArray(incoming.services)) {
      current.services = incoming.services
        .slice(0, 30)
        .map(service => cleanService(service, current))
        .filter(Boolean);
    }

    saveData(current);

    return send(res, 200, {
      ok: true,
      config: safePublic(current)
    });
  }

  // ثبت سفارش
  if (method === 'POST' && pathname === '/api/orders') {
    const data = readData();
    const body = await readBody(req);

    const {
      serviceId,
      planId,
      telegramUserId,
      username
    } = body;

    const service = data.services.find(
      item => item.id === serviceId && item.enabled
    );

    const plan = service &&
      (service.plans || []).find(
        item => item.id === planId && item.enabled !== false
      );

    if (!service || !plan) {
      return send(res, 400, {
        error: 'این سرویس یا بسته فعلاً در دسترس نیست.'
      });
    }

    const order = {
      id: 'SW-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
      serviceId,
      serviceName: service.name,
      planId,
      planTitle: plan.title,
      price: plan.price,
      telegramUserId: String(telegramUserId || '').slice(0, 40),
      username: String(username || '').slice(0, 80),
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    data.orders.unshift(order);
    data.orders = data.orders.slice(0, 500);

    saveData(data);

    return send(res, 200, {
      ok: true,
      order
    });
  }

  // سفارش‌های مدیر
  if (method === 'GET' && pathname === '/api/admin/orders') {
    return send(res, 200, readData().orders || []);
  }

  // تغییر وضعیت سفارش
  const orderMatch = pathname.match(/^\/api\/admin\/orders\/([^/]+)$/);

  if (method === 'PATCH' && orderMatch) {
    const data = readData();

    const order = data.orders.find(
      item => item.id === orderMatch[1]
    );

    if (!order) {
      return send(res, 404, {
        error: 'سفارش پیدا نشد.'
      });
    }

    const body = await readBody(req);

    if (!['pending', 'approved', 'rejected'].includes(body.status)) {
      return send(res, 400, {
        error: 'وضعیت نامعتبر است.'
      });
    }

    order.status = body.status;

    saveData(data);

    return send(res, 200, {
      ok: true,
      order
    });
  }

  // گردونه
  if (method === 'POST' && pathname === '/api/roulette/spin') {
    return send(res, 503, {
      error: 'گردونه فعلاً نمایشی است؛ برای جایزه واقعی باید هویت تلگرام و محدودیت ضدتقلب سمت سرور تکمیل شود.'
    });
  }

  // فایل‌های سایت
  if (method === 'GET' || method === 'HEAD') {
    const siteDir = getSiteDir();

    let relative;

    if (pathname === '/') {
      relative = 'index.html';
    } else if (pathname === '/admin') {
      relative = 'admin.html';
    } else {
      relative = pathname.replace(/^\/+/, '');
    }

    // جلوگیری از دسترسی به فایل‌های خصوصی پروژه
    if (
      relative.includes('..') ||
      relative.includes('\\') ||
      relative.startsWith('.') ||
      relative === 'server.js' ||
      relative === 'package.json' ||
      relative === 'package-lock.json' ||
      relative === 'data.json' ||
      relative.startsWith('data.json.') ||
      relative === 'README.md' ||
      relative === 'node_modules'
    ) {
      return send(res, 404, {
        error: 'فایل پیدا نشد.'
      });
    }

    const file = path.resolve(siteDir, relative);

    if (
      file !== siteDir &&
      !file.startsWith(siteDir + path.sep)
    ) {
      return send(res, 403, {
        error: 'دسترسی مجاز نیست.'
      });
    }

    if (serveFile(req, res, file)) {
      return;
    }

    // فقط برای مسیرهای معمول سایت صفحه اصلی برگردانده می‌شود.
    if (
      !pathname.startsWith('/api/') &&
      !path.extname(pathname)
    ) {
      const index = path.join(siteDir, 'index.html');

      if (serveFile(req, res, index)) {
        return;
      }

      return send(res, 500, {
        error: 'فایل index.html پیدا نشد. فایل باید داخل public یا پوشه اصلی پروژه باشد.'
      });
    }

    return send(res, 404, {
      error: 'فایل پیدا نشد.'
    });
  }

  return send(res, 404, {
    error: 'مسیر پیدا نشد.'
  });
}

const server = http.createServer((req, res) => {
  Promise.resolve(handle(req, res)).catch(error => {
    console.error('Request error:', error);

    if (!res.headersSent) {
      send(res, error.status || 500, {
        error: error.status
          ? error.message
          : 'خطای داخلی سرور.'
      });
    } else {
      res.destroy();
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Sami WireGuard listening on ${PORT}`);
});
