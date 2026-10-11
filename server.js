const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 10000;

const DATA_FILE = path.join(__dirname, "data.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

const adminSessions = new Set();

app.disable("x-powered-by");
app.use(express.json({ limit: "200kb" }));

// --------------------------------------------------
// Frontend files
// Supports both layouts:
// 1. public/index.html
// 2. index.html at project root
// --------------------------------------------------

const hasPublicFolder = fs.existsSync(
  path.join(PUBLIC_DIR, "index.html")
);

if (hasPublicFolder) {
  app.use(express.static(PUBLIC_DIR));
} else {
  // Only expose known frontend assets, not server files.
  const allowedAssets = [
    "style.css",
    "app.js",
    "admin.css",
    "admin.js",
    "dashboard.css",
    "dashboard.js",
    "manifest.json"
  ];

  for (const asset of allowedAssets) {
    app.get("/" + asset, (req, res) => {
      const filePath = path.join(__dirname, asset);

      if (!fs.existsSync(filePath)) {
        return res.status(404).send("File not found");
      }

      res.sendFile(filePath);
    });
  }
}

// --------------------------------------------------
// Default configuration
// --------------------------------------------------

const initial = {
  brand: "Sami WireGuard",

  supportUsername:
    process.env.SUPPORT_USERNAME || "saman_s87",

  channelUrl:
    process.env.CHANNEL_URL || "https://t.me/SamiWireGuard",

  announcement: "اتصال پایدار، مدیریت ساده و خرید سریع",

  services: [
    {
      id: "wireguard",
      name: "WireGuard",
      subtitle: "کانفیگ و اشتراک WireGuard",
      icon: "◈",
      enabled: true,
      accent: "blue",

      plans: [
        {
          id: "wg10",
          title: "۱۰ گیگابایت",
          volume: "10 GB",
          days: 30,
          price: 160000
        },
        {
          id: "wg20",
          title: "۲۰ گیگابایت",
          volume: "20 GB",
          days: 30,
          price: 290000
        },
        {
          id: "wg50",
          title: "۵۰ گیگابایت",
          volume: "50 GB",
          days: 30,
          price: 590000
        }
      ]
    },

    {
      id: "v2ray",
      name: "V2Ray",
      subtitle: "اشتراک و لینک اتصال",
      icon: "✦",
      enabled: true,
      accent: "purple",

      plans: [
        {
          id: "v210",
          title: "۱۰ گیگابایت",
          volume: "10 GB",
          days: 30,
          price: 160000
        },
        {
          id: "v220",
          title: "۲۰ گیگابایت",
          volume: "20 GB",
          days: 30,
          price: 290000
        },
        {
          id: "v250",
          title: "۵۰ گیگابایت",
          volume: "50 GB",
          days: 30,
          price: 590000
        }
      ]
    },

    {
      id: "dns",
      name: "DNS",
      subtitle: "سرویس DNS",
      icon: "⌁",
      enabled: true,
      accent: "cyan",

      plans: [
        {
          id: "dns30",
          title: "۳۰ روزه",
          volume: "DNS",
          days: 30,
          price: 50000
        }
      ]
    }
  ],

  roulette: {
    enabled: true,
    title: "گردونه شانس سامی"
  },

  orders: []
};

// --------------------------------------------------
// Data storage
// --------------------------------------------------

function readData() {
  try {
    const content = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(content);

    if (!Array.isArray(parsed.services)) {
      parsed.services = structuredClone(initial.services);
    }

    if (!Array.isArray(parsed.orders)) {
      parsed.orders = [];
    }

    if (!parsed.roulette) {
      parsed.roulette = structuredClone(initial.roulette);
    }

    return parsed;
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Could not read data.json:", error.message);
    }

    try {
      fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(initial, null, 2),
        "utf8"
      );
    } catch (writeError) {
      console.error(
        "Could not create data.json:",
        writeError.message
      );
    }

    return structuredClone(initial);
  }
}

function saveData(data) {
  const tempFile = DATA_FILE + ".tmp";

  fs.writeFileSync(
    tempFile,
    JSON.stringify(data, null, 2),
    "utf8"
  );

  fs.renameSync(tempFile, DATA_FILE);
}

// --------------------------------------------------
// Public configuration
// --------------------------------------------------

function safePublic(data) {
  return {
    brand: data.brand,

    announcement: data.announcement,

    supportUsername:
      data.supportUsername || "saman_s87",

    channelUrl:
      data.channelUrl || "https://t.me/SamiWireGuard",

    services: (data.services || []).map(service => ({
      ...service,
      plans: Array.isArray(service.plans)
        ? service.plans
        : []
    })),

    roulette: {
      enabled: !!data.roulette?.enabled,

      title:
        data.roulette?.title || "گردونه شانس سامی"
    }
  };
}

// --------------------------------------------------
// Admin authentication
// --------------------------------------------------

function adminOnly(req, res, next) {
  const auth = req.headers.authorization || "";

  const token = auth.startsWith("Bearer ")
    ? auth.slice(7)
    : "";

  if (!token || !adminSessions.has(token)) {
    return res.status(401).json({
      error: "دسترسی مدیر تأیید نشد."
    });
  }

  next();
}

app.post("/api/admin/login", (req, res) => {
  if (!ADMIN_PASSWORD) {
    return res.status(503).json({
      error:
        "ابتدا ADMIN_PASSWORD را در Environment رندر تنظیم کن."
    });
  }

  if (
    !req.body ||
    typeof req.body.password !== "string" ||
    req.body.password !== ADMIN_PASSWORD
  ) {
    return res.status(401).json({
      error: "رمز عبور اشتباه است."
    });
  }

  const token = crypto.randomBytes(32).toString("hex");

  adminSessions.add(token);

  res.json({ token });
});

// --------------------------------------------------
// Public API
// --------------------------------------------------

app.get("/api/config", (req, res) => {
  res.json(safePublic(readData()));
});

// --------------------------------------------------
// Admin configuration API
// --------------------------------------------------

app.get("/api/admin/config", adminOnly, (req, res) => {
  res.json(readData());
});

app.put("/api/admin/config", adminOnly, (req, res) => {
  const current = readData();
  const incoming = req.body || {};

  if (typeof incoming.announcement === "string") {
    current.announcement =
      incoming.announcement.slice(0, 240);
  }

  if (typeof incoming.supportUsername === "string") {
    current.supportUsername = incoming.supportUsername
      .replace(/^@/, "")
      .replace(/[^a-zA-Z0-9_]/g, "")
      .slice(0, 40);
  }

  if (
    typeof incoming.channelUrl === "string" &&
    /^https:\/\/t\.me\/[a-zA-Z0-9_]+$/.test(
      incoming.channelUrl
    )
  ) {
    current.channelUrl =
      incoming.channelUrl.slice(0, 160);
  }

  if (
    incoming.roulette &&
    typeof incoming.roulette.enabled === "boolean"
  ) {
    current.roulette = {
      enabled: incoming.roulette.enabled,

      title: String(
        incoming.roulette.title ||
        "گردونه شانس سامی"
      ).slice(0, 70)
    };
  }

  if (Array.isArray(incoming.services)) {
    const cleaned = [];

    for (const raw of incoming.services.slice(0, 30)) {
      if (!raw || typeof raw !== "object") {
        continue;
      }

      const id = String(raw.id || "")
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "")
        .slice(0, 48);

      if (!id || !raw.name) {
        continue;
      }

      const previous = current.services.find(
        service => service.id === id
      );

      const rawPlans = Array.isArray(raw.plans)
        ? raw.plans
        : (previous?.plans || []);

      cleaned.push({
        id,

        name: String(raw.name).slice(0, 60),

        subtitle: String(
          raw.subtitle ||
          raw.description ||
          "سرویس ویژه سامی"
        ).slice(0, 120),

        icon: String(raw.icon || "✦").slice(0, 5),

        accent: [
          "blue",
          "purple",
          "cyan",
          "green",
          "gold",
          "red"
        ].includes(raw.accent || raw.color)
          ? (raw.accent || raw.color)
          : "blue",

        enabled: raw.enabled !== false,

        plans: rawPlans
          .slice(0, 40)
          .filter(plan => plan && typeof plan === "object")
          .map((plan, index) => ({
            id: String(
              plan.id || `${id}-${index + 1}`
            )
              .toLowerCase()
              .replace(/[^a-z0-9_-]/g, "")
              .slice(0, 50),

            title: String(
              plan.title || plan.name || "بسته"
            ).slice(0, 70),

            volume: String(
              plan.volume || ""
            ).slice(0, 30),

            days: Math.max(
              1,
              Math.min(
                3650,
                Number(plan.days) || 30
              )
            ),

            price: Math.max(
              0,
              Math.round(Number(plan.price) || 0)
            ),

            enabled: plan.enabled !== false
          }))
      });
    }

    current.services = cleaned;
  }

  try {
    saveData(current);

    res.json({
      ok: true,
      config: safePublic(current)
    });
  } catch (error) {
    console.error("Saving config failed:", error.message);

    res.status(500).json({
      error: "ذخیره تنظیمات انجام نشد."
    });
  }
});

// --------------------------------------------------
// Orders API
// This creates pending requests only.
// It does not process payments or create VPN accounts.
// --------------------------------------------------

app.post("/api/orders", (req, res) => {
  const data = readData();

  const {
    serviceId,
    planId,
    telegramUserId,
    username
  } = req.body || {};

  const service = data.services.find(
    item => item.id === serviceId && item.enabled
  );

  const plan = service &&
    service.plans.find(
      item => item.id === planId &&
        item.enabled !== false
    );

  if (!service || !plan) {
    return res.status(400).json({
      error: "این سرویس یا بسته فعلاً در دسترس نیست."
    });
  }

  const order = {
    id:
      "SW-" +
      crypto.randomBytes(4).toString("hex").toUpperCase(),

    serviceId,
    serviceName: service.name,

    planId,
    planTitle: plan.title,

    price: plan.price,

    telegramUserId: String(
      telegramUserId || ""
    ).slice(0, 40),

    username: String(
      username || ""
    ).slice(0, 80),

    status: "pending",

    createdAt: new Date().toISOString()
  };

  data.orders.unshift(order);

  data.orders = data.orders.slice(0, 500);

  try {
    saveData(data);

    res.json({
      ok: true,
      order
    });
  } catch (error) {
    console.error("Saving order failed:", error.message);

    res.status(500).json({
      error: "ثبت سفارش انجام نشد."
    });
  }
});

// --------------------------------------------------
// Admin orders API
// --------------------------------------------------

app.get("/api/admin/orders", adminOnly, (req, res) => {
  res.json(readData().orders);
});

app.patch(
  "/api/admin/orders/:id",
  adminOnly,
  (req, res) => {
    const data = readData();

    const order = data.orders.find(
      item => item.id === req.params.id
    );

    if (!order) {
      return res.status(404).json({
        error: "سفارش پیدا نشد."
      });
    }

    const status = req.body && req.body.status;

    if (
      !["pending", "approved", "rejected"].includes(status)
    ) {
      return res.status(400).json({
        error: "وضعیت نامعتبر است."
      });
    }

    order.status = status;

    try {
      saveData(data);

      res.json({
        ok: true,
        order
      });
    } catch (error) {
      console.error("Updating order failed:", error.message);

      res.status(500).json({
        error: "تغییر وضعیت سفارش ذخیره نشد."
      });
    }
  }
);

// --------------------------------------------------
// Roulette
// Currently a visual/demo feature only.
// No real-money betting or prizes.
// --------------------------------------------------

app.post("/api/roulette/spin", (req, res) => {
  res.status(503).json({
    error:
      "گردونه فعلاً نمایشی است و قابلیت دریافت جایزه واقعی ندارد."
  });
});

// --------------------------------------------------
// Health check
// --------------------------------------------------

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "Sami WireGuard",
    timestamp: new Date().toISOString()
  });
});

// --------------------------------------------------
// Frontend routes
// Supports both public/ and root layouts.
// --------------------------------------------------

app.get("/admin", (req, res) => {
  const publicAdmin = path.join(
    PUBLIC_DIR,
    "admin.html"
  );

  const rootAdmin = path.join(
    __dirname,
    "admin.html"
  );

  const filePath = fs.existsSync(publicAdmin)
    ? publicAdmin
    : rootAdmin;

  if (!fs.existsSync(filePath)) {
    return res.status(404).send(
      "Admin page not found. Check admin.html."
    );
  }

  res.sendFile(filePath);
});

app.get("*", (req, res) => {
  const publicIndex = path.join(
    PUBLIC_DIR,
    "index.html"
  );

  const rootIndex = path.join(
    __dirname,
    "index.html"
  );

  const filePath = fs.existsSync(publicIndex)
    ? publicIndex
    : rootIndex;

  if (!fs.existsSync(filePath)) {
    return res.status(404).send(
      "Website page not found. Check index.html."
    );
  }

  res.sendFile(filePath);
});

// --------------------------------------------------
// Start server
// --------------------------------------------------

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Sami Mini App listening on port ${PORT}`
  );

  console.log(
    `Frontend layout: ${
      hasPublicFolder ? "public/" : "project root"
    }`
  );
});
