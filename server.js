require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const multer = require("multer");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DB_FILE = path.join(DATA_DIR, "store.json");

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "CHANGE_THIS_SECRET_BEFORE_PRODUCTION";

const ADMIN_USERNAME =
  process.env.ADMIN_USERNAME || "admin";

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "change-this-password";

const MAX_UPLOAD_SIZE =
  Number(process.env.MAX_UPLOAD_SIZE || 8 * 1024 * 1024);

const isProduction = process.env.NODE_ENV === "production";

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/* =========================================================
   DEFAULT DATABASE
   ========================================================= */

const DEFAULTS = {
  settings: {
    siteName: "Sami WireGuard",
    siteDescription:
      "سرویس اینترنت پایدار، سریع و مطمئن با WireGuard",
    supportUsername: "saman_s87",
    botUsername: "sami91928bot",
    channelUsername: "SamiWireGuard",
    cardNumber: "",
    cardName: "",
    telegramEnabled: true,
    smsEnabled: false
  },

  categories: [
    {
      id: "wg",
      name: "WireGuard",
      slug: "wireguard",
      active: true,
      sort: 1
    },
    {
      id: "dns",
      name: "DNS",
      slug: "dns",
      active: true,
      sort: 2
    },
    {
      id: "v2ray",
      name: "V2Ray",
      slug: "v2ray",
      active: true,
      sort: 3
    }
  ],

  flashSale: {
    enabled: false,
    title: "فروش ویژه",
    description: "",
    discountPercent: 0,
    endsAt: null,
    productIds: []
  },

  wheel: {
    enabled: false,
    title: "گردونه شانس",
    description: "",
    spinsPerDay: 1
  },

  products: [],

  users: [],

  orders: [],

  services: [],

  tickets: [],

  coupons: [],

  notifications: [],

  admins: [],

  audit: [],

  servers: [],

  transactions: [],

  missions: [],

  referrals: [],

  wheelPrizes: [],

  spins: [],

  otpRequests: []
};

/* =========================================================
   DATABASE
   ========================================================= */

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    saveDB(DEFAULTS);
    return structuredClone(DEFAULTS);
  }

  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    const parsed = JSON.parse(raw);

    let changed = false;

    for (const [key, value] of Object.entries(DEFAULTS)) {
      if (parsed[key] === undefined) {
        parsed[key] = structuredClone(value);
        changed = true;
      }
    }

    if (changed) {
      saveDB(parsed);
    }

    return parsed;
  } catch (error) {
    console.error("Database read error:", error);

    const backupName = `store-broken-${Date.now()}.json`;
    const backupPath = path.join(DATA_DIR, backupName);

    try {
      fs.copyFileSync(DB_FILE, backupPath);
    } catch {}

    saveDB(DEFAULTS);

    return structuredClone(DEFAULTS);
  }
}

function saveDB(db) {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(db, null, 2),
    "utf8"
  );
}

/* =========================================================
   HELPERS
   ========================================================= */

function makeId(prefix = "") {
  return (
    prefix +
    crypto.randomBytes(8).toString("hex") +
    Date.now().toString(36)
  );
}

function now() {
  return new Date().toISOString();
}

function normalizePhone(phone) {
  if (!phone) return "";

  let value = String(phone).trim();

  value = value.replace(/[^\d+]/g, "");

  if (value.startsWith("0098")) {
    value = "+98" + value.slice(4);
  }

  if (value.startsWith("98") && !value.startsWith("+98")) {
    value = "+" + value;
  }

  if (value.startsWith("09")) {
    value = "+98" + value.slice(1);
  }

  return value;
}

function validPhone(phone) {
  return /^\+98\d{10}$/.test(phone);
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function audit(db, req, action, details = {}) {
  db.audit.unshift({
    id: makeId("audit_"),
    action,
    adminUsername: req.admin?.username || null,
    userId: req.user?.id || null,
    ip:
      req.headers["x-forwarded-for"] ||
      req.socket.remoteAddress ||
      null,
    details,
    createdAt: now()
  });

  if (db.audit.length > 1000) {
    db.audit.length = 1000;
  }
}

function publicUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    phone: user.phone,
    name: user.name || "",
    role: user.role || "customer",
    createdAt: user.createdAt
  };
}

function signUserToken(user) {
  return jwt.sign(
    {
      type: "user",
      id: user.id,
      phone: user.phone,
      role: user.role || "customer"
    },
    JWT_SECRET,
    {
      expiresIn: "30d"
    }
  );
}

function signAdminToken(admin) {
  return jwt.sign(
    {
      type: "admin",
      username: admin.username,
      role: admin.role || "admin"
    },
    JWT_SECRET,
    {
      expiresIn: "12h"
    }
  );
}

/* =========================================================
   MIDDLEWARE
   ========================================================= */

app.disable("x-powered-by");

app.use(express.json({ limit: "2mb" }));

app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb"
  })
);

/* =========================================================
   UPLOADS
   ========================================================= */

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();

    const safeExt = [
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
      ".pdf"
    ].includes(ext)
      ? ext
      : ".bin";

    cb(
      null,
      `${Date.now()}-${crypto
        .randomBytes(6)
        .toString("hex")}${safeExt}`
    );
  }
});

const upload = multer({
  storage,

  limits: {
    fileSize: MAX_UPLOAD_SIZE
  },

  fileFilter: (req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf"
    ];

    if (!allowed.includes(file.mimetype)) {
      return cb(
        new Error(
          "فرمت فایل مجاز نیست. فقط JPG، PNG، WEBP و PDF."
        )
      );
    }

    cb(null, true);
  }
});

/*
 * Receipt files are intentionally served only through
 * the authenticated receipt route below.
 *
 * We do NOT expose data/uploads as a public directory.
 */

/* =========================================================
   AUTH MIDDLEWARE
   ========================================================= */

function getBearerToken(req) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return null;
  }

  return header.slice(7);
}

function auth(req, res, next) {
  const token = getBearerToken(req);

  if (!token) {
    return res.status(401).json({
      ok: false,
      message: "احراز هویت لازم است."
    });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    if (payload.type !== "user") {
      return res.status(401).json({
        ok: false,
        message: "توکن کاربر معتبر نیست."
      });
    }

    const db = readDB();

    const user = db.users.find(
      (item) => item.id === payload.id
    );

    if (!user) {
      return res.status(401).json({
        ok: false,
        message: "کاربر پیدا نشد."
      });
    }

    req.user = user;

    next();
  } catch {
    return res.status(401).json({
      ok: false,
      message: "نشست شما منقضی شده است."
    });
  }
}

function adminAuth(req, res, next) {
  const token = getBearerToken(req);

  if (!token) {
    return res.status(401).json({
      ok: false,
      message: "ورود مدیر لازم است."
    });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    if (payload.type !== "admin") {
      return res.status(401).json({
        ok: false,
        message: "توکن مدیر معتبر نیست."
      });
    }

    req.admin = payload;

    next();
  } catch {
    return res.status(401).json({
      ok: false,
      message: "نشست مدیر منقضی شده است."
    });
  }
}

function ownerAuth(req, res, next) {
  if (
    !req.admin ||
    !["owner", "superadmin"].includes(req.admin.role)
  ) {
    return res.status(403).json({
      ok: false,
      message: "دسترسی مالک لازم است."
    });
  }

  next();
}

/* =========================================================
   HEALTH
   ========================================================= */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "sami-wireguard",
    time: now()
  });
});

/* =========================================================
   AUTH — ADMIN
   ========================================================= */

app.post("/api/login", async (req, res) => {
  try {
    const username = String(
      req.body.username || ""
    ).trim();

    const password = String(
      req.body.password || ""
    );

    if (!username || !password) {
      return res.status(400).json({
        ok: false,
        message: "نام کاربری و رمز عبور را وارد کنید."
      });
    }

    /*
     * Environment admin has priority.
     */
    if (
      username === ADMIN_USERNAME &&
      password === ADMIN_PASSWORD
    ) {
      const admin = {
        username,
        role: "owner"
      };

      const token = signAdminToken(admin);

      return res.json({
        ok: true,
        token,
        admin
      });
    }

    const db = readDB();

    const admin = db.admins.find(
      (item) => item.username === username && item.active !== false
    );

    if (!admin) {
      return res.status(401).json({
        ok: false,
        message: "نام کاربری یا رمز عبور اشتباه است."
      });
    }

    const matched = await bcrypt.compare(
      password,
      admin.passwordHash
    );

    if (!matched) {
      return res.status(401).json({
        ok: false,
        message: "نام کاربری یا رمز عبور اشتباه است."
      });
    }

    const token = signAdminToken(admin);

    audit(db, req, "admin_login", {
      username
    });

    saveDB(db);

    res.json({
      ok: true,
      token,
      admin: {
        username: admin.username,
        role: admin.role || "admin"
      }
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "خطا در ورود مدیر."
    });
  }
});

app.get("/api/admin/me", adminAuth, (req, res) => {
  res.json({
    ok: true,
    admin: {
      username: req.admin.username,
      role: req.admin.role || "admin"
    }
  });
});

/* =========================================================
   AUTH — SMS OTP
   ========================================================= */

app.post("/api/auth/request-otp", async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);

    if (!validPhone(phone)) {
      return res.status(400).json({
        ok: false,
        message: "شماره موبایل معتبر نیست."
      });
    }

    const db = readDB();

    const recent = db.otpRequests.find(
      (item) =>
        item.phone === phone &&
        Date.now() - new Date(item.createdAt).getTime() <
          60 * 1000
    );

    if (recent) {
      return res.status(429).json({
        ok: false,
        message:
          "لطفاً قبل از درخواست کد جدید کمی صبر کنید."
      });
    }

    const code = String(
      Math.floor(100000 + Math.random() * 900000)
    );

    const otp = {
      id: makeId("otp_"),
      phone,
      code,
      createdAt: now(),
      expiresAt: new Date(
        Date.now() + 5 * 60 * 1000
      ).toISOString(),
      verified: false,
      attempts: 0
    };

    db.otpRequests = db.otpRequests.filter(
      (item) =>
        item.phone !== phone ||
        Date.now() -
          new Date(item.createdAt).getTime() <
          10 * 60 * 1000
    );

    db.otpRequests.push(otp);

    saveDB(db);

    /*
     * IMPORTANT:
     * In production the code must be sent through a real SMS
     * provider and MUST NOT be returned to the browser.
     */

    const response = {
      ok: true,
      message: "کد تأیید ارسال شد."
    };

    if (!isProduction || process.env.EXPOSE_OTP_IN_DEV === "true") {
      response.developmentCode = code;
    }

    res.json(response);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "خطا در ارسال کد تأیید."
    });
  }
});

app.post("/api/auth/verify-otp", async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const code = String(req.body.code || "").trim();

    if (!validPhone(phone)) {
      return res.status(400).json({
        ok: false,
        message: "شماره موبایل معتبر نیست."
      });
    }

    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({
        ok: false,
        message: "کد تأیید باید ۶ رقمی باشد."
      });
    }

    const db = readDB();

    const otp = [...db.otpRequests]
      .reverse()
      .find(
        (item) =>
          item.phone === phone &&
          !item.verified
      );

    if (!otp) {
      return res.status(400).json({
        ok: false,
        message: "کد تأیید پیدا نشد."
      });
    }

    if (
      new Date(otp.expiresAt).getTime() <
      Date.now()
    ) {
      return res.status(400).json({
        ok: false,
        message: "کد تأیید منقضی شده است."
      });
    }

    if (otp.attempts >= 5) {
      return res.status(429).json({
        ok: false,
        message: "تعداد تلاش‌ها بیش از حد مجاز است."
      });
    }

    if (otp.code !== code) {
      otp.attempts += 1;
      saveDB(db);

      return res.status(400).json({
        ok: false,
        message: "کد تأیید اشتباه است."
      });
    }

    otp.verified = true;
    otp.verifiedAt = now();

    let user = db.users.find(
      (item) => item.phone === phone
    );

    const isNewUser = !user;

    if (!user) {
      user = {
        id: makeId("usr_"),
        phone,
        name: "",
        role: "customer",
        createdAt: now(),
        lastLoginAt: now()
      };

      db.users.push(user);
    } else {
      user.lastLoginAt = now();
    }

    audit(db, req, "user_login", {
      phone,
      isNewUser
    });

    saveDB(db);

    const token = signUserToken(user);

    res.json({
      ok: true,
      token,
      user: publicUser(user),
      isNewUser
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "خطا در تأیید کد."
    });
  }
});

app.get("/api/me", auth, (req, res) => {
  res.json({
    ok: true,
    user: publicUser(req.user)
  });
});

/* =========================================================
   STORE
   ========================================================= */

app.get("/api/store", (req, res) => {
  const db = readDB();

  const products = db.products
    .filter((item) => item.active !== false)
    .sort((a, b) => {
      if (a.featured !== b.featured) {
        return a.featured ? -1 : 1;
      }

      return safeNumber(a.sort, 999) -
        safeNumber(b.sort, 999);
    });

  const categories = db.categories
    .filter((item) => item.active !== false)
    .sort(
      (a, b) =>
        safeNumber(a.sort, 999) -
        safeNumber(b.sort, 999)
    );

  res.json({
    ok: true,

    settings: db.settings,

    categories,

    products,

    flashSale: db.flashSale,

    wheel: db.wheel
  });
});

/* =========================================================
   PRODUCTS
   ========================================================= */

app.get("/api/products", (req, res) => {
  const db = readDB();

  res.json({
    ok: true,
    products: db.products
  });
});

app.post("/api/products", adminAuth, (req, res) => {
  const db = readDB();

  const product = {
    id: req.body.id || makeId("prd_"),
    name: String(req.body.name || "محصول جدید"),
    category: String(req.body.category || "wg"),
    rarity: String(req.body.rarity || ""),
    price: safeNumber(req.body.price),
    duration: String(req.body.duration || ""),
    volume: String(req.body.volume || ""),
    server: String(req.body.server || ""),
    ping: String(req.body.ping || ""),
    stock: safeNumber(req.body.stock),
    active:
      req.body.active === undefined
        ? true
        : Boolean(req.body.active),
    featured: Boolean(req.body.featured),
    features: Array.isArray(req.body.features)
      ? req.body.features
      : [],
    sort: safeNumber(req.body.sort, 999),
    createdAt: now(),
    updatedAt: now()
  };

  const existingIndex = db.products.findIndex(
    (item) => item.id === product.id
  );

  if (existingIndex >= 0) {
    product.createdAt =
      db.products[existingIndex].createdAt ||
      product.createdAt;

    db.products[existingIndex] = {
      ...db.products[existingIndex],
      ...product,
      updatedAt: now()
    };
  } else {
    db.products.push(product);
  }

  audit(db, req, "product_save", {
    productId: product.id
  });

  saveDB(db);

  res.json({
    ok: true,
    product
  });
});

app.delete(
  "/api/products/:id",
  adminAuth,
  (req, res) => {
    const db = readDB();

    const index = db.products.findIndex(
      (item) => item.id === req.params.id
    );

    if (index < 0) {
      return res.status(404).json({
        ok: false,
        message: "محصول پیدا نشد."
      });
    }

    const removed = db.products.splice(index, 1)[0];

    audit(db, req, "product_delete", {
      productId: removed.id
    });

    saveDB(db);

    res.json({
      ok: true
    });
  }
);

/* =========================================================
   CATEGORIES
   ========================================================= */

app.get("/api/categories", (req, res) => {
  const db = readDB();

  res.json({
    ok: true,
    categories: db.categories
  });
});

app.put("/api/categories", adminAuth, (req, res) => {
  const db = readDB();

  if (!Array.isArray(req.body.categories)) {
    return res.status(400).json({
      ok: false,
      message: "ساختار دسته‌بندی‌ها معتبر نیست."
    });
  }

  db.categories = req.body.categories.map(
    (category, index) => ({
      id:
        category.id ||
        makeId("cat_"),
      name:
        String(category.name || "").trim() ||
        `دسته ${index + 1}`,
      slug:
        String(category.slug || "").trim() ||
        `category-${index + 1}`,
      active:
        category.active !== false,
      sort:
        safeNumber(category.sort, index + 1)
    })
  );

  audit(db, req, "categories_update");

  saveDB(db);

  res.json({
    ok: true,
    categories: db.categories
  });
});

/* =========================================================
   ORDERS
   ========================================================= */

app.post(
  "/api/orders",
  auth,
  upload.single("receipt"),
  (req, res) => {
    try {
      const db = readDB();

      const productId = String(
        req.body.productId || ""
      );

      const product = db.products.find(
        (item) =>
          item.id === productId &&
          item.active !== false
      );

      if (!product) {
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }

        return res.status(404).json({
          ok: false,
          message: "محصول پیدا نشد."
        });
      }

      if (safeNumber(product.stock) <= 0) {
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }

        return res.status(400).json({
          ok: false,
          message: "موجودی این محصول تمام شده است."
        });
      }

      if (!req.file) {
        return re
