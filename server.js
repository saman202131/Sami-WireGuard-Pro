require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const QRCode = require("qrcode");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;

const DATA_DIR = path.join(ROOT, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DB_FILE = path.join(DATA_DIR, "store.json");

const NODE_ENV = process.env.NODE_ENV || "development";

const JWT_SECRET =
  process.env.JWT_SECRET || "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET";

const ADMIN_USERNAME =
  process.env.ADMIN_USERNAME || "admin";

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "change-this-password";

const MAX_UPLOAD_MB =
  Number(process.env.MAX_RECEIPT_MB || 8);

const DEFAULTS = {
  settings: {
    siteName: "SAMI VPN",
    siteShortName: "SAMI",
    supportUsername: "saman_s87",
    botUsername: "sami91928bot",
    channelUsername: "SamiWireGuard",

    currency: "IRT",
    defaultLanguage: "fa",
    supportedLanguages: ["fa", "en"],

    cardNumber: "",
    cardHolder: "",
    paymentInstructions:
      "پس از واریز، تصویر رسید پرداخت را ارسال کنید.",

    telegramEnabled: false,
    telegramBotUsername: "",
    telegramConnectedAt: null,

    smsEnabled: false,
    smsProvider: "",
    smsSender: "",

    maintenanceMode: false,

    siteTitle: "SAMI VPN",
    siteDescription:
      "Premium VPN, WireGuard and DNS services."
  },

  categories: [
    {
      id: "cat-wireguard",
      name: "WireGuard",
      slug: "wireguard",
      description: "Fast and modern WireGuard VPN services.",
      active: true,
      sort: 1
    },
    {
      id: "cat-dns",
      name: "DNS",
      slug: "dns",
      description: "Secure and optimized DNS services.",
      active: true,
      sort: 2
    },
    {
      id: "cat-vless",
      name: "VLESS",
      slug: "vless",
      description: "VLESS services.",
      active: true,
      sort: 3
    },
    {
      id: "cat-trojan",
      name: "Trojan",
      slug: "trojan",
      description: "Trojan services.",
      active: true,
      sort: 4
    },
    {
      id: "cat-openvpn",
      name: "OpenVPN",
      slug: "openvpn",
      description: "OpenVPN services.",
      active: true,
      sort: 5
    },
    {
      id: "cat-special",
      name: "Special Services",
      slug: "special",
      description: "Gaming, streaming and dedicated services.",
      active: true,
      sort: 6
    }
  ],

  products: [],

  users: [],

  orders: [],

  services: [],

  devices: [],

  tickets: [],

  coupons: [],

  notifications: [],

  referrals: [],

  points: [],

  missions: [],

  rewards: [],

  spins: [],

  wheelPrizes: [
    {
      id: "prize-5",
      title: "5% Discount",
      type: "coupon",
      value: 5,
      probability: 35,
      active: true
    },
    {
      id: "prize-10",
      title: "10% Discount",
      type: "coupon",
      value: 10,
      probability: 25,
      active: true
    },
    {
      id: "prize-20",
      title: "20% Discount",
      type: "coupon",
      value: 20,
      probability: 10,
      active: true
    },
    {
      id: "prize-day",
      title: "1 Free Day",
      type: "free_days",
      value: 1,
      probability: 10,
      active: true
    },
    {
      id: "prize-volume",
      title: "Extra Traffic",
      type: "traffic",
      value: 10,
      probability: 10,
      active: true
    },
    {
      id: "prize-again",
      title: "Try Again",
      type: "nothing",
      value: 0,
      probability: 10,
      active: true
    }
  ],

  wheel: {
    enabled: true,
    title: "Lucky Wheel",
    description: "Spin the wheel and win a reward.",
    spinsPerDay: 1
  },

  flashSale: {
    enabled: false,
    title: "Flash Sale",
    description: "",
    discountPercent: 0,
    startsAt: null,
    endsAt: null,
    productIds: []
  },

  servers: [],

  transactions: [],

  otpRequests: [],

  admins: [],

  audit: []
};

function ensureDirectories() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readDB() {
  ensureDirectories();

  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(
      DB_FILE,
      JSON.stringify(DEFAULTS, null, 2),
      "utf8"
    );

    return clone(DEFAULTS);
  }

  let db;

  try {
    db = JSON.parse(
      fs.readFileSync(DB_FILE, "utf8")
    );
  } catch (error) {
    console.error("Database read error:", error);

    db = clone(DEFAULTS);
  }

  let changed = false;

  for (const key of Object.keys(DEFAULTS)) {
    if (
      db[key] === undefined ||
      db[key] === null
    ) {
      db[key] = clone(DEFAULTS[key]);
      changed = true;
    }
  }

  if (changed) {
    saveDB(db);
  }

  return db;
}

function saveDB(db) {
  ensureDirectories();

  const tempFile = `${DB_FILE}.tmp`;

  fs.writeFileSync(
    tempFile,
    JSON.stringify(db, null, 2),
    "utf8"
  );

  fs.renameSync(tempFile, DB_FILE);
}

let db = readDB();

function reloadDB() {
  db = readDB();
  return db;
}

function persist() {
  saveDB(db);
}

function makeId(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${crypto
    .randomBytes(4)
    .toString("hex")}`;
}

function now() {
  return new Date().toISOString();
}

function normalizePhone(phone) {
  if (!phone) return "";

  let value = String(phone).trim();

  value = value.replace(/[^\d+]/g, "");

  if (value.startsWith("00")) {
    value = `+${value.slice(2)}`;
  }

  if (value.startsWith("09")) {
    value = `+98${value.slice(1)}`;
  }

  if (/^9\d{9}$/.test(value)) {
    value = `+98${value}`;
  }

  return value;
}

function validPhone(phone) {
  const value = normalizePhone(phone);

  return /^\+\d{8,15}$/.test(value);
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function safeText(value, fallback = "") {
  if (value === undefined || value === null) {
    return fallback;
  }

  return String(value).trim();
}

function bool(value) {
  return (
    value === true ||
    value === "true" ||
    value === 1 ||
    value === "1"
  );
}

function publicUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    phone: user.phone,
    name: user.name || "",
    email: user.email || "",
    language: user.language || "fa",
    role: user.role || "user",
    points: safeNumber(user.points),
    referralCode: user.referralCode || "",
    active: user.active !== false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function signUserToken(user) {
  return jwt.sign(
    {
      type: "user",
      sub: user.id,
      role: user.role || "user"
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
      sub: admin.id,
      role: admin.role || "admin"
    },
    JWT_SECRET,
    {
      expiresIn: "12h"
    }
  );
}

function getToken(req) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return null;
  }

  return header.slice(7).trim();
}

function verifyToken(req) {
  const token = getToken(req);

  if (!token) return null;

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function audit(action, actor, details = {}) {
  db.audit.unshift({
    id: makeId("audit"),
    action,
    actor: actor
      ? {
          id: actor.id,
          type: actor.type || "unknown",
          username: actor.username || "",
          role: actor.role || ""
        }
      : null,
    details,
    createdAt: now()
  });

  if (db.audit.length > 2000) {
    db.audit = db.audit.slice(0, 2000);
  }

  persist();
}

function userAuth(req, res, next) {
  const payload = verifyToken(req);

  if (
    !payload ||
    payload.type !== "user"
  ) {
    return res.status(401).json({
      ok: false,
      error: "Authentication required."
    });
  }

  const user = db.users.find(
    (item) => item.id === payload.sub
  );

  if (!user || user.active === false) {
    return res.status(401).json({
      ok: false,
      error: "User account is unavailable."
    });
  }

  req.user = user;

  next();
}

function adminAuth(req, res, next) {
  const payload = verifyToken(req);

  if (
    !payload ||
    payload.type !== "admin"
  ) {
    return res.status(401).json({
      ok: false,
      error: "Admin authentication required."
    });
  }

  const admin = db.admins.find(
    (item) => item.id === payload.sub
  );

  if (!admin || admin.active === false) {
    return res.status(401).json({
      ok: false,
      error: "Admin account is unavailable."
    });
  }

  req.admin = admin;

  next();
}

function ownerAuth(req, res, next) {
  adminAuth(req, res, () => {
    if (req.admin.role !== "owner") {
      return res.status(403).json({
        ok: false,
        error: "Owner permission required."
      });
    }

    next();
  });
}

function roleAuth(...allowedRoles) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        ok: false,
        error: "Authentication required."
      });
    }

    if (
      !allowedRoles.includes(
        req.admin.role
      )
    ) {
      return res.status(403).json({
        ok: false,
        error: "Insufficient permissions."
      });
    }

    next();
  };
}

function ensureInitialAdmin() {
  const existing = db.admins.find(
    (admin) =>
      admin.username === ADMIN_USERNAME
  );

  if (existing) return;

  const passwordHash =
    bcrypt.hashSync(
      ADMIN_PASSWORD,
      12
    );

  db.admins.push({
    id: makeId("admin"),
    username: ADMIN_USERNAME,
    passwordHash,
    name: "Owner",
    role: "owner",
    active: true,
    createdAt: now(),
    updatedAt: now()
  });

  persist();

  console.log(
    `Initial admin created: ${ADMIN_USERNAME}`
  );

  if (
    ADMIN_PASSWORD ===
    "change-this-password"
  ) {
    console.warn(
      "WARNING: Change ADMIN_PASSWORD in .env before production."
    );
  }
}

ensureInitialAdmin();

app.disable("x-powered-by");

if (NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "same-site"
    }
  })
);

app.use(
  express.json({
    limit: "2mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb"
  })
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    ok: false,
    error: "Too many requests. Please try again later."
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    ok: false,
    error: "Too many authentication attempts."
  }
});

app.use("/api", apiLimiter);

/* =========================================================
   HEALTH
========================================================= */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "SAMI VPN",
    environment: NODE_ENV,
    time: now()
  });
});

/* =========================================================
   AUTH
========================================================= */

app.post(
  "/api/login",
  authLimiter,
  async (req, res) => {
    const username =
      safeText(req.body.username);

    const password =
      safeText(req.body.password);

    if (!username || !password) {
      return res.status(400).json({
        ok: false,
        error: "Username and password are required."
      });
    }

    let admin = db.admins.find(
      (item) =>
        item.username === username &&
        item.active !== false
    );

    if (!admin && username === ADMIN_USERNAME) {
      const passwordMatches =
        password === ADMIN_PASSWORD;

      if (passwordMatches) {
        admin = {
          id: "env-owner",
          username: ADMIN_USERNAME,
          name: "Owner",
          role: "owner",
          active: true
        };
      }
    }

    if (!admin) {
      return res.status(401).json({
        ok: false,
        error: "Invalid credentials."
      });
    }

    let valid = false;

    if (admin.passwordHash) {
      valid = await bcrypt.compare(
        password,
        admin.passwordHash
      );
    } else if (
      admin.username === ADMIN_USERNAME
    ) {
      valid =
        password === ADMIN_PASSWORD;
    }

    if (!valid) {
      return res.status(401).json({
        ok: false,
        error: "Invalid credentials."
      });
    }

    const token =
      signAdminToken(admin);

    audit(
      "admin_login",
      {
        id: admin.id,
        type: "admin",
        username: admin.username,
        role: admin.role
      }
    );

    res.json({
      ok: true,
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        name: admin.name,
        role: admin.role
      }
    });
  }
);

app.get(
  "/api/admin/me",
  adminAuth,
  (req, res) => {
    res.json({
      ok: true,
      admin: {
        id: req.admin.id,
        username: req.admin.username,
        name: req.admin.name,
        role: req.admin.role
      }
    });
  }
);

app.post(
  "/api/auth/request-otp",
  authLimiter,
  (req, res) => {
    const phone =
      normalizePhone(req.body.phone);

    if (!validPhone(phone)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid phone number."
      });
    }

    const recent =
      db.otpRequests.find(
        (item) =>
          item.phone === phone &&
          Date.now() -
            new Date(item.createdAt).getTime() <
            60 * 1000
      );

    if (recent) {
      return res.status(429).json({
        ok: false,
        error: "Please wait before requesting another code."
      });
    }

    const code =
      String(
        crypto.randomInt(
          100000,
          1000000
        )
      );

    const request = {
      id: makeId("otp"),
      phone,
      codeHash: crypto
        .createHash("sha256")
        .update(code)
        .digest("hex"),
      attempts: 0,
      expiresAt:
        Date.now() +
        5 * 60 * 1000,
      createdAt: now()
    };

    db.otpRequests.push(request);

    db.otpRequests =
      db.otpRequests.filter(
        (item) =>
          item.expiresAt > Date.now()
      );

    persist();

    /*
      Production:
      Connect your SMS provider here.

      Development:
      Returning developmentCode is allowed only
      outside production.
    */

    const response = {
      ok: true,
      message:
        "Verification code sent."
    };

    if (
      NODE_ENV !== "production" ||
      process.env.EXPOSE_OTP_IN_DEV === "true"
    ) {
      response.developmentCode =
        code;
    }

    res.json(response);
  }
);

app.post(
  "/api/auth/verify-otp",
  authLimiter,
  (req, res) => {
    const phone =
      normalizePhone(req.body.phone);

    const code =
      safeText(req.body.code);

    if (!validPhone(phone)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid phone number."
      });
    }

    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid verification code."
      });
    }

    const request =
      db.otpRequests
        .filter(
          (item) =>
            item.phone === phone
        )
        .sort(
          (a, b) =>
            new Date(b.createdAt) -
            new Date(a.createdAt)
        )[0];

    if (!request) {
      return res.status(400).json({
        ok: false,
        error: "Verification request not found."
      });
    }

    if (
      request.expiresAt <
      Date.now()
    ) {
      return res.status(400).json({
        ok: false,
        error: "Verification code expired."
      });
    }

    if (request.attempts >= 5) {
      return res.status(429).json({
        ok: false,
        error: "Too many attempts."
      });
    }

    request.attempts += 1;

    const hash =
      crypto
        .createHash("sha256")
        .update(code)
        .digest("hex");

    if (hash !== request.codeHash) {
      persist();

      return res.status(400).json({
        ok: false,
        error: "Incorrect verification code."
      });
    }

    db.otpRequests =
      db.otpRequests.filter(
        (item) =>
          item.id !== request.id
      );

    let user =
      db.users.find(
        (item) =>
          item.phone === phone
      );

    if (!user) {
      user = {
        id: makeId("user"),
        phone,
        name: "",
        email: "",
        language:
          req.body.language === "en"
            ? "en"
            : "fa",
        role: "user",
        points: 0,
        referralCode:
          `SAMI-${crypto
            .randomBytes(3)
            .toString("hex")
            .toUpperCase()}`,
        active: true,
        createdAt: now(),
        updatedAt: now()
      };

      db.users.push(user);

      audit(
        "user_registered",
        {
          id: user.id,
          type: "user",
          role: "user"
        },
        {
          phone
        }
      );
    } else {
      user.updatedAt = now();
    }

    persist();

    const token =
      signUserToken(user);

    res.json({
      ok: true,
      token,
      user: publicUser(user)
    });
  }
);

app.get(
  "/api/me",
  userAuth,
  (req, res) => {
    res.json({
      ok: true,
      user: publicUser(req.user)
    });
  }
);

/* =========================================================
   STORE
========================================================= */

app.get(
  "/api/store",
  (req, res) => {
    const activeCategories =
      db.categories
        .filter(
          (item) =>
            item.active !== false
        )
        .sort(
          (a, b) =>
            safeNumber(a.sort) -
            safeNumber(b.sort)
        );

    const activeProducts =
      db.products
        .filter(
          (item) =>
            item.active !== false
        )
        .sort(
          (a, b) =>
            safeNumber(a.sort) -
            safeNumber(b.sort)
        );

    res.json({
      ok: true,
      settings: {
        siteName:
          db.settings.siteName,
        siteShortName:
          db.settings.siteShortName,
        supportUsername:
          db.settings.supportUsername,
        botUsername:
          db.settings.botUsername,
        channelUsername:
          db.settings.channelUsername,
        currency:
          db.settings.currency,
        defaultLanguage:
          db.settings.defaultLanguage,
        supportedLanguages:
          db.settings.supportedLanguages,
        siteTitle:
          db.settings.siteTitle,
        siteDescription:
          db.settings.siteDescription,
        maintenanceMode:
          db.settings.maintenanceMode
      },
      categories:
        activeCategories,
      products:
        activeProducts,
      flashSale:
        db.flashSale,
      wheel:
        db.wheel
    });
  }
);

/* =========================================================
   PRODUCTS
========================================================= */

app.get(
  "/api/products",
  adminAuth,
  (req, res) => {
    res.json({
      ok: true,
      products: db.products
    });
  }
);

app.post(
  "/api/products",
  adminAuth,
  (req, res) => {
    const body = req.body || {};

    const product = {
      id:
        safeText(body.id) ||
        makeId("product"),

      name:
        safeText(body.name) ||
        "Untitled Product",

      category:
        safeText(body.category) ||
        "wireguard",

           protocol:
        safeText(body.protocol) ||
        "WireGuard",

      rarity:
        safeText(body.rarity) ||
        "standard",

      price:
        safeNumber(body.price),

      duration:
        safeText(body.duration) ||
        "30 روز",

      volume:
        safeText(body.volume) ||
        "نامحدود",

      server:
        safeText(body.server) ||
        "Auto",

      ping:
        safeText(body.ping) ||
        "کم",

      stock:
        Math.max(
          0,
          Math.floor(
            safeNumber(body.stock)
          )
        ),

      description:
        safeText(body.description) ||
        "",

      features:
        Array.isArray(body.features)
          ? body.features
              .map((item) => safeText(item))
              .filter(Boolean)
          : [],

      featured:
        body.featured === true ||
        body.featured === "true" ||
        body.featured === "1",

      active:
        body.active !== false &&
        body.active !== "false" &&
        body.active !== "0",

      image:
        safeText(body.image) ||
        "",

      createdAt:
        now(),

      updatedAt:
        now()
    };

    db.products.push(product);

    saveDB(db);

    audit(
      req.admin,
      "product.create",
      {
        productId: product.id,
        name: product.name
      }
    );

    res.json({
      ok: true,
      product
    });
  }
);
