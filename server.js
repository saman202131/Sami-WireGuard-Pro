const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const multer = require("multer");

const app = express();

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA = path.join(ROOT, "data");
const DB = path.join(DATA, "store.json");
const UPLOADS = path.join(ROOT, "uploads");

fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(UPLOADS, { recursive: true });

const defaults = {
  settings: {
    siteName: "SAMI // WIREGUARD",
    supportUsername: "saman_s87",
    botUsername: "sami91928bot",
    channelUsername: "SamiWireGuard",
    cardNumber: "",
    cardName: "",

    categories: [
      {
        id: "wg",
        name: "WireGuard",
        mode: "TACTICAL",
        active: true
      },
      {
        id: "dns",
        name: "DNS",
        mode: "SPEED",
        active: true
      },
      {
        id: "v2ray",
        name: "V2Ray",
        mode: "STEALTH",
        active: true
      }
    ],

    flashSale: {
      active: false,
      title: "FLASH SALE",
      percent: 0,
      endsAt: ""
    },

    wheel: {
      active: false,
      startAt: "",
      endAt: ""
    }
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

function readDB() {
  if (!fs.existsSync(DB)) {
    fs.writeFileSync(DB, JSON.stringify(defaults, null, 2));
  }

  const data = JSON.parse(fs.readFileSync(DB, "utf8"));

  for (const key of Object.keys(defaults)) {
    if (data[key] === undefined) {
      data[key] = defaults[key];
    }
  }

  return data;
}

function saveDB(data) {
  fs.writeFileSync(DB, JSON.stringify(data, null, 2));
}

function makeId(prefix = "id") {
  return (
    prefix +
    "_" +
    Date.now().toString(36) +
    "_" +
    crypto.randomBytes(4).toString("hex")
  );
}

function normalizePhone(phone) {
  return String(phone || "")
    .replace(/[^\d+]/g, "")
    .replace(/^0098/, "+98")
    .replace(/^98/, "+98");
}

function validPhone(phone) {
  return /^\+98\d{10}$/.test(phone);
}

function audit(data, user, action, detail = "") {
  data.audit.unshift({
    id: makeId("log"),
    at: new Date().toISOString(),
    user,
    action,
    detail
  });

  data.audit = data.audit.slice(0, 1000);
}

/* ----------------------------- */
/* APP MIDDLEWARE                */
/* ----------------------------- */

app.use(express.json({ limit: "3mb" }));
app.use(express.urlencoded({ extended: true }));

const upload = multer({
  dest: UPLOADS,
  limits: {
    fileSize: 8 * 1024 * 1024
  }
});

const SECRET =
  process.env.JWT_SECRET || "CHANGE_THIS_SECRET_IN_ENV";

function createToken(user, role = "user") {
  return jwt.sign(
    {
      user,
      role
    },
    SECRET,
    {
      expiresIn: "30d"
    }
  );
}

function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "unauthorized"
      });
    }

    req.user = jwt.verify(
      header.replace("Bearer ", ""),
      SECRET
    );

    next();
  } catch {
    res.status(401).json({
      error: "unauthorized"
    });
  }
}

function adminAuth(req, res, next) {
  auth(req, res, () => {
    if (
      req.user.role === "admin" ||
      req.user.role === "owner"
    ) {
      return next();
    }

    return res.status(403).json({
      error: "forbidden"
    });
  });
}

function ownerAuth(req, res, next) {
  auth(req, res, () => {
    if (req.user.role === "owner") {
      return next();
    }

    return res.status(403).json({
      error: "owner_only"
    });
  });
}

/* ----------------------------- */
/* ADMIN LOGIN                   */
/* ----------------------------- */

app.post("/api/login", (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  const adminUsername =
    process.env.ADMIN_USER || "admin";

  const adminPassword =
    process.env.ADMIN_PASSWORD || "saman.2021";

  if (
    username === adminUsername &&
    password === adminPassword
  ) {
    const token = createToken(username, "owner");

    return res.json({
      token,
      user: {
        username,
        role: "owner"
      }
    });
  }

  const data = readDB();

  const admin = data.admins.find(
    x =>
      x.username === username &&
      x.active !== false
  );

  if (!admin) {
    return res.status(401).json({
      error: "invalid_login"
    });
  }

  let valid = false;

  if (admin.passwordHash) {
    valid = bcrypt.compareSync(
      password,
      admin.passwordHash
    );
  } else if (admin.password) {
    valid = admin.password === password;
  }

  if (!valid) {
    return res.status(401).json({
      error: "invalid_login"
    });
  }

  const token = createToken(
    username,
    admin.role || "admin"
  );

  res.json({
    token,
    user: {
      username,
      role: admin.role || "admin"
    }
  });
});

/* ----------------------------- */
/* OTP / REGISTER                */
/* ----------------------------- */

app.post("/api/auth/request-otp", (req, res) => {
  const data = readDB();

  const phone = normalizePhone(
    req.body.phone
  );

  if (!validPhone(phone)) {
    return res.status(400).json({
      error: "invalid_phone",
      message:
        "شماره موبایل معتبر ایران وارد کنید."
    });
  }

  const now = Date.now();

  const previous = data.otpRequests.find(
    x =>
      x.phone === phone &&
      now - x.createdAt < 60 * 1000
  );

  if (previous) {
    return res.status(429).json({
      error: "otp_wait",
      message:
        "لطفاً قبل از ارسال مجدد کمی صبر کنید."
    });
  }

  const code =
    process.env.NODE_ENV === "production"
      ? String(
          Math.floor(
            100000 + Math.random() * 900000
          )
        )
      : "123456";

  data.otpRequests = data.otpRequests.filter(
    x =>
      now - x.createdAt <
      10 * 60 * 1000
  );

  data.otpRequests.push({
    id: makeId("otp"),
    phone,
    code,
    createdAt: now,
    attempts: 0
  });

  saveDB(data);

  /*
    در حالت production اینجا باید API سرویس پیامکی
    فراخوانی شود.

    مثلاً:
    Kavenegar
    IPPanel
    FarazSMS
    یا سرویس SMS موردنظر شما
  */

  res.json({
    ok: true,
    message:
      "کد تأیید ارسال شد.",

    /*
      فقط برای توسعه:
      در production این مقدار حذف می‌شود.
    */
    ...(process.env.NODE_ENV !== "production"
      ? {
          developmentCode: code
        }
      : {})
  });
});

app.post("/api/auth/verify-otp", (req, res) => {
  const data = readDB();

  const phone = normalizePhone(
    req.body.phone
  );

  const code = String(
    req.body.code || ""
  ).trim();

  const otp = data.otpRequests.find(
    x =>
      x.phone === phone &&
      Date.now() - x.createdAt <
        10 * 60 * 1000
  );

  if (!otp) {
    return res.status(400).json({
      error: "otp_expired",
      message:
        "کد منقضی شده است."
    });
  }

  otp.attempts++;

  if (otp.attempts > 5) {
    saveDB(data);

    return res.status(429).json({
      error: "too_many_attempts"
    });
  }

  if (otp.code !== code) {
    saveDB(data);

    return res.status(400).json({
      error: "invalid_otp",
      message:
        "کد وارد شده صحیح نیست."
    });
  }

  data.otpRequests =
    data.otpRequests.filter(
      x => x.id !== otp.id
    );

  let user = data.users.find(
    x => x.phone === phone
  );

  if (!user) {
    user = {
      id: makeId("usr"),
      phone,
      username: "PLAYER_" +
        crypto
          .randomBytes(3)
          .toString("hex")
          .toUpperCase(),
      createdAt:
        new Date().toISOString(),
      lastLoginAt:
        new Date().toISOString(),
      active: true
    };

    data.users.unshift(user);
  } else {
    user.lastLoginAt =
      new Date().toISOString();
  }

  saveDB(data);

  const token = createToken(
    user.id,
    "user"
  );

  res.json({
    ok: true,
    token,
    user: {
      id: user.id,
      phone: user.phone,
      username: user.username
    }
  });
});

/* ----------------------------- */
/* CURRENT USER                  */
/* ----------------------------- */

app.get("/api/me", auth, (req, res) => {
  if (req.user.role !== "user") {
    return res.status(403).json({
      error: "user_only"
    });
  }

  const data = readDB();

  const user = data.users.find(
    x => x.id === req.user.user
  );

  if (!user) {
    return res.status(404).json({
      error: "user_not_found"
    });
  }

  const orders = data.orders.filter(
    x => x.userId === user.id
  );

  const services = data.services.filter(
    x => x.userId === user.id
  );

  res.json({
    user,
    orders,
    services
  });
});

/* ----------------------------- */
/* STORE                        */
/* ----------------------------- */

app.get("/api/store", (req, res) => {
  const data = readDB();

  const products = data.products
    .filter(x => x.active !== false)
    .map(x => ({
      id: x.id,
      name: x.name,
      category: x.category,
      rarity: x.rarity || "RARE",
      price: Number(x.price || 0),
      duration: x.duration || "",
      volume: x.volume || "",
      server: x.server || "",
      ping: x.ping || "",
      stock: Number(x.stock || 0),
      featured: !!x.featured,
      active: true
    }));

  const categories =
    data.settings.categories
      .filter(x => x.active !== false);

  res.json({
    settings: {
      siteName:
        data.settings.siteName,

      supportUsername:
        data.settings.supportUsername,

      botUsername:
        data.settings.botUsername,

      channelUsername:
        data.settings.channelUsername,

      cardNumber:
        data.settings.cardNumber,

      cardName:
        data.settings.cardName,

      flashSale:
        data.settings.flashSale
    },

    categories,

    products
  });
});

/* ----------------------------- */
/* PRODUCTS - ADMIN             */
/* ----------------------------- */

app.get(
  "/api/products",
  adminAuth,
  (req, res) => {
    res.json(readDB().products);
  }
);

app.post(
  "/api/products",
  adminAuth,
  (req, res) => {
    const data = readDB();

    const product = {
      id: makeId("prd"),

      name:
        String(
          req.body.name ||
          "Cyber Service"
        ).trim(),

      category:
        req.body.category || "wg",

      rarity:
        req.body.rarity || "RARE",

      price:
        Number(req.body.price || 0),

      duration:
        req.body.duration || "",

      volume:
        req.body.volume || "",

      server:
        req.body.server || "",

      ping:
        req.body.ping || "",

      stock:
        Number(req.body.stock || 0),

      active:
        req.body.active !== false,

      featured:
        !!req.body.featured,

      createdAt:
        new Date().toISOString()
    };

    data.products.unshift(product);

    audit(
      data,
      req.user.user,
      "product.create",
      product.name
    );

    saveDB(data);

    res.json(product);
  }
);

app.put(
  "/api/products/:id",
  adminAuth,
  (req, res) => {
    const data = readDB();

    const product =
      data.products.find(
        x => x.id === req.params.id
      );

    if (!product) {
      return res.status(404).json({
        error: "not_found"
      });
    }

    const fields = [
      "name",
      "category",
      "rarity",
      "duration",
      "volume",
      "server",
      "ping",
      "active",
      "featured"
    ];

    for (const field of fields) {
      if (
        req.body[field] !== undefined
      ) {
        product[field] =
          req.body[field];
      }
    }

    if (req.body.price !== undefined) {
      product.price =
        Number(req.body.price);
    }

    if (req.body.stock !== undefined) {
      product.stock =
        Number(req.body.stock);
    }

    audit(
      data,
      req.user.user,
      "product.update",
      product.name
    );

    saveDB(data);

    res.json(product);
  }
);

app.delete(
  "/api/products/:id",
  adminAuth,
  (req, res) => {
    const data = readDB();

    data.products =
      data.products.filter(
        x => x.id !== req.params.id
      );

    audit(
      data,
      req.user.user,
      "product.delete",
      req.params.id
    );

    saveDB(data);

    res.json({
      ok: true
    });
  }
);

/* ----------------------------- */
/* ORDERS                        */
/* ----------------------------- */

app.post(
  "/api/orders",
  auth,
  upload.single("receipt"),
  (req, res) => {
    if (req.user.role !== "user") {
      return res.status(403).json({
        error: "user_only"
      });
    }

    const data = readDB();

    const user = data.users.find(
      x => x.id === req.user.user
    );

    if (!user) {
      return res.status(404).json({
        error: "user_not_found"
      });
    }

    const product =
      data.products.find(
        x =>
          x.id === req.body.productId &&
          x.active !== false
      );

    if (!product) {
      return res.status(404).json({
        error: "product_not_found"
      });
    }

    if (Number(product.stock) <= 0) {
      return res.status(409).json({
        error: "out_of_stock"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: "receipt_required"
      });
    }

    product.stock--;

    const order = {
      id: makeId("ord"),

      userId: user.id,

      productId: product.id,

      productName:
        product.name,

      amount:
        Number(product.price),

      customerPhone:
        user.phone,

      receipt:
        "/uploads/" +
        req.file.filename,

      status: "pending",

      createdAt:
        new Date().toISOString(),

      delivery: null,

      stockRefunded: false
    };

    data.orders.unshift(order);

    audit(
      data,
      user.id,
      "order.create",
      order.id
    );

    saveDB(data);

    res.json({
      ok: true,
      order
    });
  }
);

app.get(
  "/api/orders",
  adminAuth,
  (req, res) => {
    res.json(readDB().orders);
  }
);

app.get(
  "/api/my-orders",
  auth,
  (req, res) => {
    if (req.user.role !== "user") {
      return res.status(403).json({
        error: "user_only"
      });
    }

    const data = readDB();

    res.json(
      data.orders.filter(
        x => x.userId === req.user.user
      )
    );
  }
);

/* ----------------------------- */
/* ORDER STATUS                  */
/* ----------------------------- */

app.put(
  "/api/orders/:id/status",
  adminAuth,
  (req, res) => {
    const data = readDB();

    const order =
      data.orders.find(
        x => x.id === req.params.id
      );

    if (!order) {
      return res.status(404).json({
        error: "not_found"
      });
    }

    const newStatus =
      String(
        req.body.status || ""
      ).trim();

    const allowed = [
      "pending",
      "approved",
      "rejected",
      "delivered"
    ];

    if (!allowed.includes(newStatus)) {
      return res.status(400).json({
        error: "invalid_status"
      });
    }

    order.status = newStatus;

    if (
      newStatus === "rejected" &&
      !order.stockRefunded
    ) {
      const product =
        data.products.find(
          x => x.id === order.productId
        );

      if (product) {
        product.stock =
          Number(product.stock || 0) + 1;
      }

      order.stockRefunded = true;
    }

    audit(
      data,
      req.user.user,
      "order.status",
      order.id +
        " -> " +
        newStatus
    );

    saveDB(data);

    res.json(order);
  }
);

/* ----------------------------- */
/* DELIVERY                      */
/* ----------------------------- */

app.put(
  "/api/orders/:id/delivery",
  adminAuth,
  (req, res) => {
    const data = readDB();

    const order =
      data.orders.find(
        x => x.id === req.params.id
      );

    if (!order) {
      return res.status(404).json({
        error: "not_found"
      });
    }

    order.delivery = {
      link:
        req.body.link || "",

      config:
        req.body.config || "",

      qr:
        req.body.qr || "",

      notes:
        req.body.notes || "",

      deliveredAt:
        new Date().toISOString(),

      by:
        req.user.user
    };

    order.status = "delivered";

    const oldService =
      data.services.find(
        x => x.orderId === order.id
      );

    const service = {
      id:
        oldService?.id ||
        makeId("svc"),

      orderId:
        order.id,

      userId:
        order.userId,

      productId:
        order.productId,

      productName:
        order.productName,

      link:
        order.delivery.link,

      config:
        order.delivery.config,

      qr:
        order.delivery.qr,

      notes:
        order.delivery.notes,

      status:
        "active",

      createdAt:
        oldService?.createdAt ||
        new Date().toISOString(),

      deliveredAt:
        order.delivery.deliveredAt
    };

    if (oldService) {
      Object.assign(
        oldService,
        service
      );
    } else {
      data.services.unshift(
        service
      );
    }

    audit(
      data,
      req.user.user,
      "order.delivery",
      order.id
    );

    saveDB(data);

    res.json({
      ok: true,
      order,
      service
    });
  }
);

/* ----------------------------- */
/* SETTINGS                      */
/* ----------------------------- */

app.get(
  "/api/settings",
  adminAuth,
  (req, res) => {
    const data = readDB();

    res.json({
      ...data.settings,

      botToken:
        data.settings.botToken
          ? "••••••••"
          : ""
    });
  }
);

app.put(
  "/api/settings",
  ownerAuth,
  (req, res) => {
    const data = readDB();

    const fields = [
      "siteName",
      "supportUsername",
      "botUsername",
      "channelUsername",
      "cardNumber",
      "cardName"
    ];

    for (const field of fields) {
      if (
        req.body[field] !== undefined
      ) {
        data.settings[field] =
          req.body[field];
      }
    }

    if (
      req.body.botToken &&
      req.body.botToken !==
        "••••••••"
    ) {
      data.settings.botToken =
        req.body.botToken;
    }

    if (req.body.categories) {
      data.settings.categories =
        req.body.categories;
    }

    if (req.body.flashSale) {
      data.settings.flashSale =
        req.body.flashSale;
    }

    if (req.body.wheel) {
      data.settings.wheel =
        req.body.wheel;
    }

    audit(
      data,
      req.user.user,
      "settings.update",
      "settings"
    );

    saveDB(data);

    res.json({
      ok: true
    });
  }
);

/* ----------------------------- */
/* CATEGORIES                    */
/* ----------------------------- */

app.get(
  "/api/categories",
  adminAuth,
  (req, res) => {
    res.json(
      readDB().settings.categories
    );
  }
);

app.put(
  "/api/categories/:id",
  adminAuth,
  (req, res) => {
    const data = readDB();

    const category =
      data.settings.categories.find(
        x => x.id === req.params.id
      );

    if (!category) {
      return res.status(404).json({
        error: "not_found"
      });
    }

    if (
      req.body.active !== undefined
    ) {
      category.active =
        req.body.active !== false;
    }

    saveDB(data);

    res.json(category);
  }
);

/* ----------------------------- */
/* CUSTOMERS                     */
/* ----------------------------- */

app.get(
  "/api/customers",
  adminAuth,
  (req, res) => {
    res.json(readDB().users);
  }
);

/* ----------------------------- */
/* SERVICES                      */
/* ----------------------------- */

app.get(  "/api/services",
  adminAuth,
  (req, res) => {
    res.json(readDB().services);
  }
);

app.get(
  "/api/my-services",
  auth,
  (req, res) => {
    if (req.user.role !== "user") {
      return res.status(403).json({
        error: "user_only"
      });
    }

    const data = readDB();

    res.json(
      data.services.filter(
        x => x.userId === req.user.user
      )
    );
  }
);

/* ----------------------------- */
/* TICKETS                       */
/* ----------------------------- */

app.get(
  "/api/tickets",
  adminAuth,
  (req, res) => {
    res.json(readDB().tickets);
  }
);

app.post(
  "/api/tickets",
  auth,
  (req, res) => {
    if (req.user.role !== "user") {
      return res.status(403).json({
        error: "user_only"
      });
    }

    const data = readDB();

    const ticket = {
      id: makeId("tkt"),

      userId: req.user.user,

      subject:
        String(
          req.body.subject ||
          "Support"
        ).trim(),

      message:
        String(
          req.body.message || ""
        ).trim(),

      status: "open",

      replies: [],

      createdAt:
        new Date().toISOString(),

      updatedAt:
        new Date().toISOString()
    };

    data.tickets.unshift(ticket);

    audit(
      data,
      req.user.user,
      "ticket.create",
      ticket.id
    );

    saveDB(data);

    res.json({
      ok: true,
      ticket
    });
  }
);

app.put(
  "/api/tickets/:id",
  adminAuth,
  (req, res) => {
    const data = readDB();

    const ticket =
      data.tickets.find(
        x => x.id === req.params.id
      );

    if (!ticket) {
      return res.status(404).json({
        error: "not_found"
      });
    }

    if (
      req.body.status !== undefined
    ) {
      ticket.status =
        req.body.status;
    }

    ticket.updatedAt =
      new Date().toISOString();

    saveDB(data);

    res.json(ticket);
  }
);

/* ----------------------------- */
/* COUPONS                       */
/* ----------------------------- */

app.get(
  "/api/coupons",
  adminAuth,
  (req, res) => {
    res.json(readDB().coupons);
  }
);

app.post(
  "/api/coupons",
  adminAuth,
  (req, res) => {
    const data = readDB();

    const coupon = {
      id: makeId("cpn"),

      code:
        String(
          req.body.code || ""
        )
          .trim()
          .toUpperCase(),

      type:
        req.body.type ||
        "percent",

      value:
        Number(
          req.body.value || 0
        ),

      active:
        req.body.active !== false,

      createdAt:
        new Date().toISOString()
    };

    data.coupons.unshift(coupon);

    saveDB(data);

    res.json(coupon);
  }
);

app.delete(
  "/api/coupons/:id",
  adminAuth,
  (req, res) => {
    const data = readDB();

    const index =
      data.coupons.findIndex(
        x => x.id === req.params.id
      );

    if (index === -1) {
      return res.status(404).json({
        error: "not_found"
      });
    }

    data.coupons.splice(index, 1);

    saveDB(data);

    res.json({
      ok: true
    });
  }
);

/* ----------------------------- */
/* SERVERS                       */
/* ----------------------------- */

app.get(
  "/api/servers",
  adminAuth,
  (req, res) => {
    res.json(readDB().servers);
  }
);

app.post(
  "/api/servers",
  adminAuth,
  (req, res) => {
    const data = readDB();

    const server = {
      id: makeId("srv"),

      name:
        req.body.name ||
        "Server",

      host:
        req.body.host || "",

      port:
        Number(
          req.body.port || 51820
        ),

      protocol:
        req.body.protocol ||
        "wireguard",

      location:
        req.body.location || "",

      active:
        req.body.active !== false,

      createdAt:
        new Date().toISOString()
    };

    data.servers.unshift(server);

    saveDB(data);

    res.json(server);
  }
);

app.delete(
  "/api/servers/:id",
  adminAuth,
  (req, res) => {
    const data = readDB();

    const index =
      data.servers.findIndex(
        x => x.id === req.params.id
      );

    if (index === -1) {
      return res.status(404).json({
        error: "not_found"
      });
    }

    data.servers.splice(index, 1);

    saveDB(data);

    res.json({
      ok: true
    });
  }
);

/* ----------------------------- */
/* NOTIFICATIONS                 */
/* ----------------------------- */

app.get(
  "/api/notifications",
  adminAuth,
  (req, res) => {
    res.json(
      readDB().notifications
    );
  }
);

app.post(
  "/api/notifications",
  adminAuth,
  (req, res) => {
    const data = readDB();

    const notification = {
      id: makeId("ntf"),

      userId:
        req.body.userId || null,

      type:
        req.body.type ||
        "system",

      title:
        req.body.title ||
        "Notification",

      message:
        req.body.message ||
        "",

      read: false,

      createdAt:
        new Date().toISOString()
    };

    data.notifications.unshift(
      notification
    );

    saveDB(data);

    res.json(notification);
  }
);

/* ----------------------------- */
/* AUDIT                         */
/* ----------------------------- */

app.get(
  "/api/audit",
  adminAuth,
  (req, res) => {
    res.json(readDB().audit);
  }
);

/* ----------------------------- */
/* ANALYTICS                     */
/* ----------------------------- */

app.get(
  "/api/analytics",
  adminAuth,
  (req, res) => {
    const data = readDB();

    const paidOrders =
      data.orders.filter(
        x =>
          x.status === "approved" ||
          x.status === "delivered"
      );

    const revenue =
      paidOrders.reduce(
        (sum, order) =>
          sum +
          Number(
            order.amount || 0
          ),
        0
      );

    res.json({
      users:
        data.users.length,

      products:
        data.products.length,

      orders:
        data.orders.length,

      pendingOrders:
        data.orders.filter(
          x =>
            x.status ===
            "pending"
        ).length,

      approvedOrders:
        data.orders.filter(
          x =>
            x.status ===
            "approved"
        ).length,

      deliveredOrders:
        data.orders.filter(
          x =>
            x.status ===
            "delivered"
        ).length,

      services:
        data.services.length,

      tickets:
        data.tickets.length,

      revenue
    });
  }
);

/* ----------------------------- */
/* DASHBOARD                     */
/* ----------------------------- */

app.get(
  "/api/dashboard",
  adminAuth,
  (req, res) => {
    const data = readDB();

    res.json({
      users:
        data.users.length,

      products:
        data.products.length,

      orders:
        data.orders.length,

      pendingOrders:
        data.orders.filter(
          x =>
            x.status ===
            "pending"
        ).length,

      delivered:
        data.orders.filter(
          x =>
            x.status ===
            "delivered"
        ).length,

      services:
        data.services.length,

      tickets:
        data.tickets.filter(
          x =>
            x.status ===
            "open"
        ).length
    });
  }
);

/* ----------------------------- */
/* FEATURE DATA                  */
/* ----------------------------- */

app.get(
  "/api/feature-data",
  adminAuth,
  (req, res) => {
    const data = readDB();

    res.json({
      flashSale:
        data.settings.flashSale,

      wheel:
        data.settings.wheel,

      missions:
        data.missions,

      referrals:
        data.referrals,

      wheelPrizes:
        data.wheelPrizes,

      spins:
        data.spins
    });
  }
);

/* ----------------------------- */
/* BACKUP                        */
/* ----------------------------- */

app.get(
  "/api/backup",
  adminAuth,
  (req, res) => {
    const data = readDB();

    const filename =
      `sami-wireguard-backup-${Date.now()}.json`;

    res.setHeader(
      "Content-Type",
      "application/json"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

    res.send(
      JSON.stringify(
        data,
        null,
        2
      )
    );
  }
);

/* ----------------------------- */
/* API 404                       */
/* ----------------------------- */

app.use(
  "/api",
  (req, res) => {
    res.status(404).json({
      error: "api_not_found"
    });
  }
);

/* ----------------------------- */
/* STATIC FILES                  */
/* ----------------------------- */

app.use(
  express.static(ROOT)
);

/* ----------------------------- */
/* ADMIN PAGE                    */
/* ----------------------------- */

app.get(
  "/admin",
  (req, res) => {
    res.sendFile(
      path.join(
        ROOT,
        "admin.html"
      )
    );
  }
);

/* ----------------------------- */
/* FRONTEND                      */
/* ----------------------------- */

app.get(
  "/{*splat}",
  (req, res) => {
    res.sendFile(
      path.join(
        ROOT,
        "index.html"
      )
    );
  }
);

/* ----------------------------- */
/* ERROR HANDLER                 */
/* ----------------------------- */

app.use(
  (err, req, res, next) => {
    console.error(
      "SERVER ERROR:",
      err
    );

    if (
      err &&
      err.code ===
        "LIMIT_FILE_SIZE"
    ) {
      return res.status(400).json({
        error:
          "file_too_large"
      });
    }

    res.status(500).json({
      error:
        "internal_server_error"
    });
  }
);

/* ----------------------------- */
/* START SERVER                  */
/* ----------------------------- */

app.listen(
  PORT,
  () => {
    console.log(
      "======================================"
    );

    console.log(
      " SAMI // WIREGUARD"
    );

    console.log(
      ` Server: http://localhost:${PORT}`
    );

    console.log(
      ` Admin:  http://localhost:${PORT}/admin`
    );

    console.log(
      "======================================"
    );
  }
);
