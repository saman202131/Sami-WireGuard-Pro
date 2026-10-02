require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const multer = require("multer");

const app = express();

const PORT =
  Number(process.env.PORT || 3000);

const ROOT =
  __dirname;

const DATA_DIR =
  path.join(
    ROOT,
    "data"
  );

const UPLOAD_DIR =
  path.join(
    DATA_DIR,
    "uploads"
  );

const DB_FILE =
  path.join(
    DATA_DIR,
    "store.json"
  );

const NODE_ENV =
  process.env.NODE_ENV ||
  "development";

const IS_PRODUCTION =
  NODE_ENV ===
  "production";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "";

const ADMIN_USERNAME =
  process.env.ADMIN_USERNAME ||
  "admin";

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD ||
  "";

const EXPOSE_OTP_IN_DEV =
  process.env.EXPOSE_OTP_IN_DEV ===
  "true";

const MAX_UPLOAD_SIZE =
  Number(
    process.env.MAX_UPLOAD_SIZE ||
    5 * 1024 * 1024
  );

if (
  IS_PRODUCTION &&
  !JWT_SECRET
) {
  throw new Error(
    "JWT_SECRET must be configured in production."
  );
}

if (
  IS_PRODUCTION &&
  !ADMIN_PASSWORD
) {
  throw new Error(
    "ADMIN_PASSWORD must be configured in production."
  );
}

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(
    DATA_DIR,
    {
      recursive: true
    }
  );
}

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(
    UPLOAD_DIR,
    {
      recursive: true
    }
  );
}

app.disable(
  "x-powered-by"
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
const DEFAULTS = {

  settings: {
    siteName:
      "Sami WireGuard",

    brandName:
      "SAMI / WIREGUARD",

    language:
      "fa",

    currency:
      "IRR",

    cardNumber:
      "",

    cardName:
      "",

    telegramBot:
      "@sami91928bot",

    telegramSupport:
      "@saman_s87",

    telegramChannel:
      "@SamiWireGuard",

    telegramEnabled:
      false,

    telegramOwnerId:
      ""
  },

  categories: [],

  flashSale: {
    active:
      false,

    title:
      "فروش ویژه",

    description:
      "",

    discount:
      0,

    startsAt:
      null,

    endsAt:
      null,

    productIds:
      []
  },

  wheel: {
    active:
      false,

    title:
      "گردونه شانس",

    description:
      "",

    dailyLimit:
      1,

    prizes:
      []
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
function makeId(
  prefix = "id"
) {
  return (
    prefix +
    "_" +
    crypto
      .randomBytes(8)
      .toString("hex")
  );
}

function now() {
  return new Date()
    .toISOString();
}

function normalizePhone(
  phone
) {
  let value =
    String(
      phone || ""
    )
      .trim()
      .replace(
        /[\s()-]/g,
        ""
      );

  if (
    value.startsWith("00")
  ) {
    value =
      "+" +
      value.slice(2);
  }

  if (
    value.startsWith("09") &&
    value.length === 11
  ) {
    value =
      "+98" +
      value.slice(1);
  }

  if (
    value.startsWith("9") &&
    value.length === 10
  ) {
    value =
      "+98" +
      value;
  }

  return value;
}

function validPhone(
  phone
) {
  return /^\+?[1-9]\d{7,14}$/.test(
    phone
  );
}

function safeNumber(
  value,
  fallback = 0
) {
  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : fallback;
}

function audit(
  db,
  action,
  actor,
  details = {}
) {
  db.audit.unshift({
    id: makeId("audit"),
    action,
    actor,
    details,
    createdAt: now()
  });

  if (
    db.audit.length >
    1000
  ) {
    db.audit =
      db.audit.slice(
        0,
        1000
      );
  }
}

function publicUser(
  user
) {
  if (!user) {
    return null;
  }

  return {
    id:
      user.id,

    phone:
      user.phone,

    name:
      user.name ||
      "",

    balance:
      safeNumber(
        user.balance
      ),

    createdAt:
      user.createdAt
  };
}

function signUserToken(
  user
) {
  return jwt.sign(
    {
      type:
        "user",

      sub:
        user.id,

      phone:
        user.phone
    },

    JWT_SECRET ||
      "development-only-secret",

    {
      expiresIn:
        "30d"
    }
  );
}

function signAdminToken(
  admin
) {
  return jwt.sign(
    {
      type:
        "admin",

      sub:
        admin.id ||
        "admin",

      username:
        admin.username
    },

    JWT_SECRET ||
      "development-only-secret",

    {
      expiresIn:
        "12h"
    }
  );
}
function getBearerToken(
  req
) {
  const header =
    req.headers.authorization ||
    "";

  if (
    !header.startsWith(
      "Bearer "
    )
  ) {
    return null;
  }

  return header.slice(7)
    .trim();
}

function authenticate(
  req,
  res,
  next
) {
  const token =
    getBearerToken(req);

  if (!token) {
    return res
      .status(401)
      .json({
        error:
          "احراز هویت لازم است."
      });
  }

  try {
    const payload =
      jwt.verify(
        token,
        JWT_SECRET ||
          "development-only-secret"
      );

    req.auth =
      payload;

    next();

  } catch {
    return res
      .status(401)
      .json({
        error:
          "توکن نامعتبر یا منقضی شده است."
      });
  }
}

function requireUser(
  req,
  res,
  next
) {
  authenticate(
    req,
    res,
    () => {

      if (
        req.auth.type !==
        "user"
      ) {
        return res
          .status(403)
          .json({
            error:
              "دسترسی کاربر لازم است."
          });
      }

      next();
    }
  );
}

function requireAdmin(
  req,
  res,
  next
) {
  authenticate(
    req,
    res,
    () => {

      if (
        req.auth.type !==
        "admin"
      ) {
        return res
          .status(403)
          .json({
            error:
              "دسترسی مدیر لازم است."
          });
      }

      next();
    }
  );
}

function requireOwner(
  req,
  res,
  next
) {
  authenticate(
    req,
    res,
    () => {

      if (
        req.auth.type !==
        "admin"
      ) {
        return res
          .status(403)
          .json({
            error:
              "دسترسی مدیر لازم است."
          });
      }

      const db =
        readDB();

      const ownerId =
        db.settings
          ?.telegramOwnerId ||
        process.env.OWNER_ADMIN_ID ||
        "";

      if (
        ownerId &&
        String(
          req.auth.telegramOwnerId ||
          req.auth.sub
        ) !==
          String(ownerId)
      ) {
        return res
          .status(403)
          .json({
            error:
              "دسترسی Owner لازم است."
          });
      }

      next();
    }
  );
}
function publicSettings(
  settings = {}
) {
  return {
    siteName:
      settings.siteName ||
      "Sami WireGuard",

    brandName:
      settings.brandName ||
      "SAMI / WIREGUARD",

    language:
      settings.language ||
      "fa",

    currency:
      settings.currency ||
      "IRR",

    cardNumber:
      settings.cardNumber ||
      "",

    cardName:
      settings.cardName ||
      "",

    telegramBot:
      settings.telegramBot ||
      "",

    telegramSupport:
      settings.telegramSupport ||
      "",

    telegramChannel:
      settings.telegramChannel ||
      "",

    telegramEnabled:
      Boolean(
        settings.telegramEnabled
      )
  };
}

app.get(
  "/api/settings",
  requireAdmin,
  (req, res) => {
    const db =
      readDB();

    res.json({
      settings:
        publicSettings(
          db.settings
        )
    });
  }
);

app.put(
  "/api/settings",
  requireAdmin,
  (req, res) => {

    const db =
      readDB();

    const body =
      req.body || {};

    const settings =
      db.settings || {};

    if (
      body.siteName !==
      undefined
    ) {
      settings.siteName =
        String(
          body.siteName
        ).trim();
    }

    if (
      body.brandName !==
      undefined
    ) {
      settings.brandName =
        String(
          body.brandName
        ).trim();
    }

    if (
      body.language ===
        "fa" ||
      body.language ===
        "en"
    ) {
      settings.language =
        body.language;
    }

    if (
      body.currency !==
      undefined
    ) {
      settings.currency =
        String(
          body.currency
        );
    }

    if (
      body.cardNumber !==
      undefined
    ) {
      settings.cardNumber =
        String(
          body.cardNumber
        ).trim();
    }

    if (
      body.cardName !==
      undefined
    ) {
      settings.cardName =
        String(
          body.cardName
        ).trim();
    }

    if (
      body.telegramBot !==
      undefined
    ) {
      settings.telegramBot =
        String(
          body.telegramBot
        ).trim();
    }

    if (
      body.telegramSupport !==
      undefined
    ) {
      settings.telegramSupport =
        String(
          body.telegramSupport
        ).trim();
    }

    if (
      body.telegramChannel !==
      undefined
    ) {
      settings.telegramChannel =
        String(
          body.telegramChannel
        ).trim();
    }

    if (
      body.telegramOwnerId !==
      undefined
    ) {
      settings.telegramOwnerId =
        String(
          body.telegramOwnerId
        ).trim();
    }

    if (
      body.telegramEnabled !==
      undefined
    ) {
      settings.telegramEnabled =
        Boolean(
          body.telegramEnabled
        );
    }

    /*
     * مهم:
     * توکن قبلی را از پاسخ عمومی خارج می‌کنیم.
     * اگر توکن جدید از پنل ارسال شد، فقط در DB ذخیره می‌شود.
     */
    if (
      body.telegramToken
    ) {
      settings.telegramToken =
        String(
          body.telegramToken
        ).trim();
    }

    db.settings =
      settings;

    audit(
      db,
      "settings.updated",
      req.auth.username ||
        req.auth.sub ||
        "admin"
    );

    saveDB(db);

    res.json({
      ok:
        true,

      settings:
        publicSettings(
          settings
        )
    });
  }
);
app.get(
  "/api/store",
  (req, res) => {

    const db =
      readDB();

    const categories =
      db.categories
        .filter(
          (category) =>
            category.active !==
            false
        )
        .sort(
          (a, b) =>
            safeNumber(
              a.sort
            ) -
            safeNumber(
              b.sort
            )
        );

    const products =
      db.products
        .filter(
          (product) =>
            product.active !==
            false
        )
        .sort(
          (a, b) => {

            if (
              Boolean(
                a.featured
              ) !==
              Boolean(
                b.featured
              )
            ) {
              return a.featured
                ? -1
                : 1;
            }

            return (
              safeNumber(
                a.sort
              ) -
              safeNumber(
                b.sort
              )
            );
          }
        );

    res.json({
      settings:
        publicSettings(
          db.settings
        ),

      categories,

      products,

      flashSale:
        db.flashSale || {
          active:
            false
        },

      wheel:
        db.wheel || {
          active:
            false
        }
    });
  }
);
app.get(
  "/api/products",
  requireAdmin,
  (req, res) => {

    const db =
      readDB();

    res.json({
      products:
        db.products
    });
  }
);

app.post(
  "/api/products",
  requireAdmin,
  (req, res) => {

    const db =
      readDB();

    const body =
      req.body || {};

    const id =
      String(
        body.id || ""
      ).trim();

    const product = {
      id:
        id ||
        makeId("product"),

      name:
        String(
          body.name ||
          ""
        ).trim(),

      category:
        String(
          body.category ||
          "wireguard"
        ).trim(),

      protocol:
        String(
          body.protocol ||
          "WireGuard"
        ).trim(),

      price:
        Math.max(
          0,
          safeNumber(
            body.price
          )
        ),

      duration:
        String(
          body.duration ||
          "30 روز"
        ).trim(),

      volume:
        String(
          body.volume ||
          "نامحدود"
        ).trim(),

      server:
        String(
          body.server ||
          "Auto"
        ).trim(),

      ping:
        String(
          body.ping ||
          "کم"
        ).trim(),

      stock:
        Math.max(
          0,
          safeNumber(
            body.stock
          )
        ),

      description:
        String(
          body.description ||
          ""
        ),

      features:
        Array.isArray(
          body.features
        )
          ? body.features
              .map(
                (item) =>
                  String(
                    item
                  ).trim()
              )
              .filter(Boolean)
          : [],

      image:
        String(
          body.image ||
          ""
        ).trim(),

      featured:
        Boolean(
          body.featured
        ),

      active:
        body.active !==
        false,

      updatedAt:
        now()
    };

    const existingIndex =
      db.products.findIndex(
        (item) =>
          item.id ===
          product.id
      );

    if (
      existingIndex >=
      0
    ) {

      product.createdAt =
        db.products[
          existingIndex
        ].createdAt ||
        now();

      db.products[
        existingIndex
      ] =
        {
          ...db.products[
            existingIndex
          ],
          ...product
        };

      audit(
        db,
        "product.updated",
        req.auth.username ||
          "admin",
        {
          productId:
            product.id
        }
      );

    } else {

      product.createdAt =
        now();

      db.products.push(
        product
      );

      audit(
        db,
        "product.created",
        req.auth.username ||
          "admin",
        {
          productId:
            product.id
        }
      );
    }

    saveDB(db);

    res.json({
      ok:
        true,

      product
    });
  }
);

app.delete(
  "/api/products/:id",
  requireAdmin,
  (req, res) => {

    const db =
      readDB();

    const index =
      db.products.findIndex(
        (product) =>
          product.id ===
          req.params.id
      );

    if (
      index === -1
    ) {
      return res
        .status(404)
        .json({
          error:
            "محصول پیدا نشد."
        });
    }

    const [
      removed
    ] =
      db.products.splice(
        index,
        1
      );

    audit(
      db,
      "product.deleted",
      req.auth.username ||
        "admin",
      {
        productId:
          removed.id
      }
    );

    saveDB(db);

    res.json({
      ok:
        true
    });
  }
);
app.get(
  "/api/flash-sale",
  requireAdmin,
  (req, res) => {

    const db =
      readDB();

    res.json({
      flashSale:
        db.flashSale
    });
  }
);

app.put(
  "/api/flash-sale",
  requireAdmin,
  (req, res) => {

    const db =
      readDB();

    const body =
      req.body || {};

    db.flashSale = {
      active:
        Boolean(
          body.active
        ),

      title:
        String(
          body.title ||
          "فروش ویژه"
        ).trim(),

      description:
        String(
          body.description ||
          ""
        ),

      discount:
        Math.min(
          100,
          Math.max(
            0,
            safeNumber(
              body.discount
            )
          )
        ),

      startsAt:
        body.startsAt ||
        null,

      endsAt:
        body.endsAt ||
        null,

      productIds:
        Array.isArray(
          body.productIds
        )
          ? body.productIds
          : []
    };

    audit(
      db,
      "flash_sale.updated",
      req.auth.username ||
        "admin"
    );

    saveDB(db);

    res.json({
      ok:
        true,

      flashSale:
        db.flashSale
    });
  }
);
app.get(
  "/api/wheel",
  requireAdmin,
  (req, res) => {

    const db =
      readDB();

    res.json({
      wheel:
        db.wheel
    });
  }
);

app.put(
  "/api/wheel",
  requireAdmin,
  (req, res) => {

    const db =
      readDB();

    const body =
      req.body || {};

    db.wheel = {
      active:
        Boolean(
          body.active
        ),

      title:
        String(
          body.title ||
          "گردونه شانس"
        ).trim(),

      description:
        String(
          body.description ||
          ""
        ),

      dailyLimit:
        Math.max(
          0,
          safeNumber(
            body.dailyLimit,
            1
          )
        ),

      prizes:
        Array.isArray(
          body.prizes
        )
          ? body.prizes
          : []
    };

    audit(
      db,
      "wheel.updated",
      req.auth.username ||
        "admin"
    );

    saveDB(db);

    res.json({
      ok:
        true,

      wheel:
        db.wheel
    });
  }
);
app.get(
  "/api/servers",
  requireAdmin,
  (req, res) => {

    const db =
      readDB();

    res.json({
      servers:
        db.servers
    });
  }
);

app.post(
  "/api/servers",
  requireAdmin,
  (req, res) => {

    const db =
      readDB();

    const body =
      req.body || {};

    const id =
      String(
        body.id || ""
      ).trim();

    const server = {
      id:
        id ||
        makeId("server"),

      name:
        String(
          body.name ||
          ""
        ).trim(),

      country:
        String(
          body.country ||
          ""
        ).trim(),

      host:
        String(
          body.host ||
          ""
        ).trim(),

      port:
        safeNumber(
          body.port,
          51820
        ),

      capacity:
        Math.max(
          0,
          safeNumber(
            body.capacity
          )
        ),

      description:
        String(
          body.description ||
          ""
        ),

      active:
        body.active !==
        false,

      updatedAt:
        now()
    };

    const index =
      db.servers.findIndex(
        (item) =>
          item.id ===
          server.id
      );

    if (
      index >= 0
    ) {

      server.createdAt =
        db.servers[
          index
        ].createdAt ||
        now();

      db.servers[
        index
      ] =
        {
          ...db.servers[
            index
          ],
          ...server
        };

    } else {

      server.createdAt =
        now();

      db.servers.push(
        server
      );
    }

    audit(
      db,
      "server.saved",
      req.auth.username ||
        "admin",
      {
        serverId:
          server.id
      }
    );

    saveDB(db);

    res.json({
      ok:
        true,

      server
    });
  }
);

app.delete(
  "/api/servers/:id",
  requireAdmin,
  (req, res) => {

    const db =
      readDB();

    const index =
      db.servers.findIndex(
        (server) =>
          server.id ===
          req.params.id
      );

    if (
      index === -1
    ) {
      return res
        .status(404)
        .json({
          error:
            "سرور پیدا نشد."
        });
    }

    db.servers.splice(
      index,
      1
    );

    saveDB(db);

    res.json({
      ok:
        true
    });
  }
);
