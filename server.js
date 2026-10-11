'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');

const PORT = Number(process.env.PORT || 10000);
const HOST = '0.0.0.0';
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const SITE = fs.existsSync(path.join(PUBLIC, 'index.html')) ? PUBLIC : ROOT;
const DATA_FILE = process.env.DATA_FILE || path.join(ROOT, 'data.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const MAX_BODY = 200 * 1024;
const SESSION_TTL = 12 * 60 * 60 * 1000;
const sessions = new Map();

const initialData = {
  brand: 'Sami WireGuard',
  announcement: '',
  supportUsername: '@saman_s87',
  channelUrl: 'https://t.me/SamiWireGuard',

  services: [
    {
      id: 'wireguard',
      title: 'WireGuard Gaming',
      description: 'بسته‌های وایرگارد گیمینگ',
      enabled: true,
      plans: [
        {
          id: 'wg-10',
          title: '۱۰ گیگ',
          volume: '10GB',
          duration: '۳۰ روز',
          price: 160000,
          enabled: true
        },
        {
          id: 'wg-20',
          title: '۲۰ گیگ',
          volume: '20GB',
          duration: '۳۰ روز',
          price: 300000,
          enabled: true
        },
        {
          id: 'wg-30',
          title: '۳۰ گیگ',
          volume: '30GB',
          duration: '۳۰ روز',
          price: 420000,
          enabled: true
        }
      ]
    },
    {
      id: 'v2ray',
      title: 'V2Ray',
      description: 'بسته‌های V2Ray',
      enabled: false,
      plans: []
    },
    {
      id: 'dns',
      title: 'DNS Gaming',
      description: 'سرویس DNS',
      enabled: false,
      plans: []
    }
  ],

  roulette: {
    enabled: false,
    title: 'باشگاه سامی',
    maxSpinsPerUser: 1,
    prizes: [],
    history: []
  },

  coupons: [],
  customers: [],
  referrals: [],
  loyalty: [],
  inventory: [],
  notifications: [],
  orders: []
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function send(res, status, data) {
  if (res.writableEnded) return;

  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });

  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();

      if (Buffer.byteLength(body) > MAX_BODY) {
        reject(Object.assign(
          new Error('حجم درخواست بیش از حد مجاز است.'),
          { statusCode: 413 }
        ));
        req.destroy();
      }
    });

    req.on('end', () => {
      if (!body.trim()) return resolve({});

      try {
        const parsed = JSON.parse(body);

        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return reject(Object.assign(
            new Error('اطلاعات ارسالی معتبر نیست.'),
            { statusCode: 400 }
          ));
        }

        resolve(parsed);
      } catch {
        reject(Object.assign(
          new Error('ساختار JSON نامعتبر است.'),
          { statusCode: 400 }
        ));
      }
    });

    req.on('error', reject);
  });
}

function text(value, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}

function ensureData() {
  const dir = path.dirname(DATA_FILE);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(initialData, null, 2),
      'utf8'
    );
  }
}

function saveData(data) {
  const dir = path.dirname(DATA_FILE);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const temporary = DATA_FILE + '.' + crypto.randomUUID() + '.tmp';

  fs.writeFileSync(
    temporary,
    JSON.stringify(data, null, 2),
    { encoding: 'utf8', mode: 0o600 }
  );

  fs.renameSync(temporary, DATA_FILE);
}

function readData() {
  ensureData();

  let data;

  try {
    data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    throw new Error(
      'فایل data.json قابل خواندن نیست. برای جلوگیری از حذف اطلاعات، آن را بررسی کنید.'
    );
  }

  let migrated = false;

  for (const [key, value] of Object.entries(initialData)) {
    if (data[key] === undefined || data[key] === null) {
      data[key] = clone(value);
      migrated = true;
    }
  }

  const arrays = [
    'services',
    'orders',
    'coupons',
    'customers',
    'referrals',
    'loyalty',
    'inventory',
    'notifications'
  ];

  for (const key of arrays) {
    if (!Array.isArray(data[key])) {
      data[key] = [];
      migrated = true;
    }
  }

  if (!data.roulette || typeof data.roulette !== 'object') {
    data.roulette = clone(initialData.roulette);
    migrated = true;
  }

  if (!Array.isArray(data.roulette.prizes)) {
    data.roulette.prizes = [];
    migrated = true;
  }

  if (!Array.isArray(data.roulette.history)) {
    data.roulette.history = [];
    migrated = true;
  }

  if (!Number.isInteger(data.roulette.maxSpinsPerUser)) {
    data.roulette.maxSpinsPerUser = 1;
    migrated = true;
  }

  if (migrated) saveData(data);

  return data;
}

function cleanPlan(plan, index) {
  return {
    id: text(plan.id || `plan-${index + 1}`, 80),
    title: text(plan.title || plan.name || `بسته ${index + 1}`, 100),
    volume: text(plan.volume, 50),
    duration: text(plan.duration, 50),
    price: Math.max(0, Math.round(Number(plan.price) || 0)),
    enabled: plan.enabled !== false
  };
}

function cleanService(service, index) {
  return {
    id: text(service.id || `service-${index + 1}`, 80),
    title: text(service.title || service.name || 'سرویس', 100),
    description: text(service.description, 500),
    enabled: service.enabled !== false,
    plans: Array.isArray(service.plans)
      ? service.plans.slice(0, 100).map(cleanPlan)
      : []
  };
}

function publicConfig(data) {
  return {
    brand: text(data.brand || 'Sami WireGuard', 100),
    announcement: text(data.announcement, 1000),
    supportUsername: text(data.supportUsername || '@saman_s87', 100),
    channelUrl: text(data.channelUrl || 'https://t.me/SamiWireGuard', 300),

    services: data.services
      .filter(service => service.enabled !== false)
      .map(service => ({
        ...service,
        plans: (service.plans || []).filter(plan => plan.enabled !== false)
      })),

    roulette: {
      enabled: Boolean(data.roulette.enabled),
      title: text(data.roulette.title || 'باشگاه سامی', 100)
    }
  };
}

function tokenFrom(req) {
  const match = String(req.headers.authorization || '')
    .match(/^Bearer\s+(.+)$/i);

  return match ? match[1] : '';
}

function isAdmin(req) {
  const token = tokenFrom(req);
  const expiry = sessions.get(token);

  if (!token || !expiry) return false;

  if (expiry < Date.now()) {
    sessions.delete(token);
    return false;
  }

  return true;
}

function adminRequired(req, res) {
  if (isAdmin(req)) return true;

  send(res, 401, {
    error: 'ورود مدیر منقضی شده است. دوباره وارد شوید.'
  });

  return false;
}

function findPlan(data, serviceId, planId) {
  const service = data.services.find(
    item => item.id === serviceId && item.enabled !== false
  );

  if (!service) return null;

  const plan = (service.plans || []).find(
    item => item.id === planId && item.enabled !== false
  );

  if (!plan) return null;

  return { service, plan };
}

function couponError(coupon) {
  if (!coupon) return 'کد تخفیف پیدا نشد.';
  if (coupon.enabled === false) return 'کد تخفیف غیرفعال است.';

  if (
    coupon.expiresAt &&
    Number.isFinite(Date.parse(coupon.expiresAt)) &&
    Date.parse(coupon.expiresAt) < Date.now()
  ) {
    return 'کد تخفیف منقضی شده است.';
  }

  if (Number(coupon.used || 0) >= Number(coupon.maxUses || 1)) {
    return 'ظرفیت استفاده از این کد تمام شده است.';
  }

  return '';
}

function mimeType(file) {
  const extension = path.extname(file).toLowerCase();

  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon'
  };

  return types[extension] || 'application/octet-stream';
}

function serveStatic(res, pathname) {
  let relative;

  try {
    relative = pathname === '/'
      ? 'index.html'
      : decodeURIComponent(pathname).replace(/^\/+/, '');
  } catch {
    return send(res, 400, { error: 'مسیر نامعتبر است.' });
  }

  if (relative === 'admin') relative = 'admin.html';

  if (
    relative.includes('\0') ||
    relative.split(/[\\/]/).includes('..')
  ) {
    return send(res, 400, { error: 'مسیر نامعتبر است.' });
  }

  const root = path.resolve(SITE);
  const file = path.resolve(root, relative);

  if (!file.startsWith(root + path.sep)) {
    return send(res, 403, { error: 'دسترسی مجاز نیست.' });
  }

  const blocked = new Set([
    'server.js',
    'package.json',
    'data.json',
    '.env',
    '.env.example',
    'README.md'
  ]);

  if (blocked.has(path.basename(file))) {
    return send(res, 404, { error: 'صفحه پیدا نشد.' });
  }

  fs.readFile(file, (error, content) => {
    if (error) {
      return send(res, 404, { error: 'صفحه پیدا نشد.' });
    }

    res.writeHead(200, {
      'Content-Type': mimeType(file),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': path.extname(file) === '.html'
        ? 'no-cache'
        : 'public, max-age=300'
    });

    res.end(content);
  });
}

async function handle(req, res) {
  const url = new URL(
    req.url,
    `http://${req.headers.host || 'localhost'}`
  );

  const pathname = url.pathname;
  const method = req.method || 'GET';

  if (method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (method === 'GET' && pathname === '/health') {
    return send(res, 200, {
      ok: true,
      service: 'Sami WireGuard PRO',
      time: new Date().toISOString()
    });
  }

  if (method === 'GET' && pathname === '/api/config') {
    return send(res, 200, publicConfig(readData()));
  }

  if (method === 'GET' && pathname === '/api/ping') {
    const target = url.searchParams.get('target') || 'cloudflare';

    const validTargets = ['cloudflare', 'google', 'dns'];

    if (!validTargets.includes(target)) {
      return send(res, 400, { error: 'هدف نامعتبر است.' });
    }

    return send(res, 200, {
      ok: true,
      target,
      note: 'این پاسخ، پینگ واقعی بازی یا گوشی کاربر نیست.'
    });
  }

  if (method === 'POST' && pathname === '/api/admin/login') {
    if (!ADMIN_PASSWORD) {
      return send(res, 503, {
        error: 'متغیر ADMIN_PASSWORD در تنظیمات Render تنظیم نشده است.'
      });
    }

    const body = await readBody(req);
    const provided = Buffer.from(String(body.password || ''));
    const expected = Buffer.from(ADMIN_PASSWORD);

    if (
      provided.length !== expected.length ||
      !crypto.timingSafeEqual(provided, expected)
    ) {
      return send(res, 401, { error: 'رمز مدیر اشتباه است.' });
    }

    const token = crypto.randomBytes(32).toString('hex');

    sessions.set(token, Date.now() + SESSION_TTL);

    return send(res, 200, {
      ok: true,
      token,
      expiresIn: SESSION_TTL
    });
  }

  if (pathname.startsWith('/api/admin/')) {
    if (!adminRequired(req, res)) return;

    const data = readData();

    if (method === 'GET' && pathname === '/api/admin/config') {
      return send(res, 200, {
        brand: data.brand,
        announcement: data.announcement,
        supportUsername: data.supportUsername,
        channelUrl: data.channelUrl,
        services: data.services,
        roulette: data.roulette
      });
    }

    if (method === 'PUT' && pathname === '/api/admin/config') {
      const body = await readBody(req);

      if (typeof body.brand === 'string') {
        data.brand = text(body.brand, 100);
      }

      if (typeof body.announcement === 'string') {
        data.announcement = text(body.announcement, 1000);
      }

      if (typeof body.supportUsername === 'string') {
        data.supportUsername = text(body.supportUsername, 100);
      }

      if (typeof body.channelUrl === 'string') {
        data.channelUrl = text(body.channelUrl, 300);
      }

      if (Array.isArray(body.services)) {
        const services = body.services.slice(0, 50).map(cleanService);
        const serviceIds = new Set();

        for (const service of services) {
          if (serviceIds.has(service.id)) {
            return send(res, 400, {
              error: 'شناسه سرویس‌ها باید یکتا باشد.'
            });
          }

          serviceIds.add(service.id);

          const planIds = new Set();

          for (const plan of service.plans) {
            if (planIds.has(plan.id)) {
              return send(res, 400, {
                error: 'شناسه بسته‌ها در هر سرویس باید یکتا باشد.'
              });
            }

            planIds.add(plan.id);
          }
        }

        data.services = services;
      }

      if (body.roulette && typeof body.roulette === 'object') {
        data.roulette.enabled = Boolean(body.roulette.enabled);
        data.roulette.title = text(
          body.roulette.title || 'باشگاه سامی',
          100
        );
      }

      saveData(data);

      return send(res, 200, {
        ok: true,
        config: publicConfig(data)
      });
    }

    if (method === 'GET' && pathname === '/api/admin/stats') {
      const orders = data.orders;
      const approved = orders.filter(o => o.status === 'approved');
      const pending = orders.filter(o => o.status === 'pending');
      const rejected = orders.filter(o => o.status === 'rejected');

      const today = new Date().toISOString().slice(0, 10);
      const month = today.slice(0, 7);

      const sum = list => list.reduce(
        (total, order) => total + (Number(order.price) || 0),
        0
      );

      return send(res, 200, {
        totalOrders: orders.length,
        approvedOrders: approved.length,
        pendingOrders: pending.length,
        rejectedOrders: rejected.length,
        totalSales: sum(approved),
        todaySales: sum(approved.filter(
          o => String(o.createdAt || '').startsWith(today)
        )),
        monthSales: sum(approved.filter(
          o => String(o.createdAt || '').startsWith(month)
        )),
        customerCount: new Set(
          orders
            .map(o => String(o.telegramUserId || ''))
            .filter(Boolean)
        ).size
      });
    }

    if (method === 'GET' && pathname === '/api/admin/orders') {
      return send(res, 200, data.orders);
    }

    const orderMatch = pathname.match(
      /^\/api\/admin\/orders\/([^/]+)$/
    );

    if (method === 'PATCH' && orderMatch) {
      const id = decodeURIComponent(orderMatch[1]);
      const body = await readBody(req);

      const order = data.orders.find(item => item.id === id);

      if (!order) {
        return send(res, 404, { error: 'سفارش پیدا نشد.' });
      }

      if (!['pending', 'approved', 'rejected'].includes(body.status)) {
        return send(res, 400, { error: 'وضعیت سفارش نامعتبر است.' });
      }

      order.status = body.status;
      order.updatedAt = new Date().toISOString();

      saveData(data);

      return send(res, 200, { ok: true, order });
    }

    if (method === 'GET' && pathname === '/api/admin/customers') {
      const customers = new Map();

      for (const order of data.orders) {
        const id = String(order.telegramUserId || '');

        if (!id) continue;

        if (!customers.has(id)) {
          customers.set(id, {
            telegramUserId: id,
            username: order.username || '',
            orders: 0,
            approvedOrders: 0,
            totalSpent: 0,
            lastOrderAt: ''
          });
        }

        const customer = customers.get(id);
        customer.orders++;

        if (order.status === 'approved') {
          customer.approvedOrders++;
          customer.totalSpent += Number(order.price) || 0;
        }

        if (String(order.createdAt || '') > customer.lastOrderAt) {
          customer.lastOrderAt = order.createdAt || '';
          customer.username = order.username || customer.username;
        }
      }

      return send(res, 200, [...customers.values()]);
    }

    if (method === 'GET' && pathname === '/api/admin/coupons') {
      return send(res, 200, data.coupons);
    }

    if (method === 'POST' && pathname === '/api/admin/coupons') {
      const body = await readBody(req);

      const code = text(body.code, 32)
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, '');

      const type = body.type === 'fixed' ? 'fixed' : 'percent';
      const value = Number(body.value);
      const maxUses = Number(body.maxUses);

      if (!code || !Number.isFinite(value) || value <= 0) {
        return send(res, 400, {
          error: 'کد و مقدار تخفیف معتبر وارد کن.'
        });
      }

      if (data.coupons.some(coupon => coupon.code === code)) {
        return send(res, 409, {
          error: 'این کد تخفیف از قبل وجود دارد.'
        });
      }

      if (type === 'percent' && value > 100) {
        return send(res, 400, {
          error: 'درصد تخفیف نباید بیشتر از ۱۰۰ باشد.'
        });
      }

      const coupon = {
        id: crypto.randomUUID(),
        code,
        type,
        value,
        maxUses: Number.isInteger(maxUses) && maxUses > 0
          ? Math.min(maxUses, 1000000)
          : 1,
        used: 0,
        expiresAt: body.expiresAt
          ? text(body.expiresAt, 40)
          : null,
        enabled: true,
        createdAt: new Date().toISOString()
      };

      data.coupons.push(coupon);
      saveData(data);

      return send(res, 201, { ok: true, coupon });
    }

    const couponMatch = pathname.match(
      /^\/api\/admin\/coupons\/([^/]+)$/
    );

    if (method === 'DELETE' && couponMatch) {
      const id = decodeURIComponent(couponMatch[1]);
      const before = data.coupons.length;

      data.coupons = data.coupons.filter(coupon => coupon.id !== id);

      if (data.coupons.length === before) {
        return send(res, 404, { error: 'کد تخفیف پیدا نشد.' });
      }

      saveData(data);

      return send(res, 200, { ok: true });
    }

    if (method === 'GET' && pathname === '/api/admin/roulette') {
      return send(res, 200, {
        roulette: data.roulette,
        history: data.roulette.history
      });
    }

    if (method === 'POST' && pathname === '/api/admin/roulette/prizes') {
      const body = await readBody(req);

      const title = text(body.title, 80);
      const probability = Number(body.probability);
      const stock = Number(body.stock);

      if (
        !title ||
        !Number.isFinite(probability) ||
        probability <= 0 ||
        probability > 100
      ) {
        return send(res, 400, {
          error: 'نام جایزه و احتمال بین ۰ تا ۱۰۰ وارد کن.'
        });
      }

      const prize = {
        id: crypto.randomUUID(),
        title,
        probability,
        stock: Number.isInteger(stock) && stock >= 0
          ? Math.min(stock, 1000000)
          : 0,
        enabled: true,
        createdAt: new Date().toISOString()
      };

      data.roulette.prizes.push(prize);
      saveData(data);

      return send(res, 201, { ok: true, prize });
    }

    const prizeMatch = pathname.match(
      /^\/api\/admin\/roulette\/prizes\/([^/]+)$/
    );

    if (method === 'DELETE' && prizeMatch) {
      const id = decodeURIComponent(prizeMatch[1]);
      const before = data.roulette.prizes.length;

      data.roulette.prizes = data.roulette.prizes.filter(
        prize => prize.id !== id
      );

            if (before === data.roulette.prizes.length) {
        return send(res, 404, { error: 'جایزه پیدا نشد.' });
      }

      saveData(data);

      return send(res, 200, { ok: true });
    }

    return send(res, 404, {
      error: 'مسیر مدیریتی پیدا نشد.'
    });
  }

  if (method === 'POST' && pathname === '/api/orders') {
    const data = readData();
    const body = await readBody(req);

    const serviceId = text(body.serviceId, 80);
    const planId = text(body.planId, 80);
    const found = findPlan(data, serviceId, planId);

    if (!found) {
      return send(res, 400, {
        error: 'سرویس یا بسته انتخاب‌شده معتبر نیست.'
      });
    }

    const order = {
      id: 'SW-' +
        Date.now().toString(36).toUpperCase() +
        '-' +
        crypto.randomBytes(3).toString('hex').toUpperCase(),

      serviceId: found.service.id,
      serviceTitle: found.service.title,
      planId: found.plan.id,
      planTitle: found.plan.title,
      volume: found.plan.volume || '',
      duration: found.plan.duration || '',
      price: found.plan.price,

      // شناسه ارسالی از مرورگر هنوز هویت تأییدشده تلگرام نیست.
      telegramUserId: text(body.telegramUserId, 80),
      username: text(body.username, 100),

      status: 'pending',
      createdAt: new Date().toISOString()
    };

    data.orders.unshift(order);
    data.orders = data.orders.slice(0, 500);

    saveData(data);

    return send(res, 201, {
      ok: true,
      order
    });
  }

  if (method === 'POST' && pathname === '/api/coupons/validate') {
    const data = readData();
    const body = await readBody(req);

    const code = text(body.code, 32).toUpperCase();

    const found = findPlan(
      data,
      text(body.serviceId, 80),
      text(body.planId, 80)
    );

    if (!found) {
      return send(res, 400, {
        error: 'بسته انتخاب‌شده معتبر نیست.'
      });
    }

    const coupon = data.coupons.find(
      item => item.code === code
    );

    const problem = couponError(coupon);

    if (problem) {
      return send(res, 400, {
        error: problem
      });
    }

    const basePrice = found.plan.price;

    const discount = coupon.type === 'fixed'
      ? Math.min(basePrice, Number(coupon.value) || 0)
      : Math.min(
          basePrice,
          Math.floor(
            basePrice * (Number(coupon.value) || 0) / 100
          )
        );

    return send(res, 200, {
      ok: true,
      code: coupon.code,
      basePrice,
      discount,
      finalPrice: Math.max(0, basePrice - discount),
      note: 'کد بررسی شده؛ هنوز مصرف نشده است.'
    });
  }

  if (method === 'POST' && pathname === '/api/roulette/spin') {
    return send(res, 503, {
      error: 'گردونه تا زمان تأیید امن هویت کاربر تلگرام غیرفعال است.'
    });
  }

  if (method === 'GET' || method === 'HEAD') {
    return serveStatic(res, pathname);
  }

  return send(res, 404, {
    error: 'مسیر پیدا نشد.'
  });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch(error => {
    if (res.headersSent) {
      res.end();
      return;
    }

    const status = Number(error.statusCode) || 500;

    if (status >= 500) {
      console.error(error);
    }

    send(res, status, {
      error: status === 500
        ? 'خطای داخلی سرور رخ داد.'
        : error.message
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Sami WireGuard PRO listening on ${HOST}:${PORT}`);
  console.log(`Serving files from ${SITE}`);

  if (!ADMIN_PASSWORD) {
    console.warn(
      'WARNING: ADMIN_PASSWORD تنظیم نشده؛ ورود مدیر کار نمی‌کند.'
    );
  }
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
