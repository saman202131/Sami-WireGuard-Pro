/* =========================================================
   SAMI WIREGUARD — ADMIN PANEL JS
   ========================================================= */

const ADMIN_TOKEN_KEY = "sami_admin_token";

const adminState = {
  token: localStorage.getItem(ADMIN_TOKEN_KEY) || "",
  page: "dashboard",

  products: [],
  orders: [],
  customers: [],
  services: [],
  categories: [],
  tickets: [],
  coupons: [],
  servers: [],
  notifications: [],
  settings: {},

  dashboard: null,
  analytics: null,

  flashSale: null,
  wheel: null,
  wheelPrizes: []
};

/* =========================================================
   HELPERS
   ========================================================= */

const $ = (selector) =>
  document.querySelector(selector);

const escapeHTML = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatPrice = (value) => {
  const number = Number(value || 0);

  return `${number.toLocaleString("fa-IR")} تومان`;
};

const formatDate = (value) => {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString(
      "fa-IR",
      {
        dateStyle: "short",
        timeStyle: "short"
      }
    );
  } catch {
    return "—";
  }
};

const statusLabel = (status) => {
  const map = {
    pending: "در انتظار بررسی",
    approved: "تأیید شده",
    rejected: "رد شده",
    delivered: "تحویل شده",
    paid: "پرداخت شده",
    open: "باز",
    closed: "بسته",
    active: "فعال",
    inactive: "غیرفعال",
    expired: "منقضی"
  };

  return map[status] || status || "—";
};

const statusClass = (status) => {
  if (
    [
      "approved",
      "delivered",
      "paid",
      "active"
    ].includes(status)
  ) {
    return "success";
  }

  if (
    [
      "pending",
      "open"
    ].includes(status)
  ) {
    return "warning";
  }

  if (
    [
      "rejected",
      "expired",
      "closed"
    ].includes(status)
  ) {
    return "danger";
  }

  return "neutral";
};

function statusBadge(status) {
  return `
    <span class="admin-status ${statusClass(status)}">
      ${escapeHTML(statusLabel(status))}
    </span>
  `;
}

/* =========================================================
   API
   ========================================================= */

async function apiFetch(
  url,
  options = {}
) {
  const headers = {
    ...(options.headers || {})
  };

  if (
    options.body &&
    !(options.body instanceof FormData)
  ) {
    headers["Content-Type"] =
      "application/json";
  }

  if (adminState.token) {
    headers.Authorization =
      `Bearer ${adminState.token}`;
  }

  const response = await fetch(
    url,
    {
      ...options,
      headers
    }
  );

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (response.status === 401) {
    logoutAdmin();
    throw new Error(
      data.message ||
      "نشست مدیر منقضی شده است."
    );
  }

  if (!response.ok) {
    throw new Error(
      data.message ||
      "خطا در ارتباط با سرور."
    );
  }

  return data;
}

/* =========================================================
   TOAST
   ========================================================= */

let toastTimer = null;

function showToast(
  message,
  type = "success"
) {
  const toast =
    $("#adminToast");

  if (!toast) return;

  toast.textContent = message;

  toast.className =
    `admin-toast show ${type}`;

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.className =
      "admin-toast";
  }, 3000);
}

/* =========================================================
   LOGIN
   ========================================================= */

function showLoginScreen() {
  const login =
    $("#loginScreen");

  const app =
    $("#adminApp");

  if (login) {
    login.style.display = "flex";
  }

  if (app) {
    app.style.display = "none";
  }
}

function showAdminApp() {
  const login =
    $("#loginScreen");

  const app =
    $("#adminApp");

  if (login) {
    login.style.display = "none";
  }

  if (app) {
    app.style.display = "grid";
  }
}

function logoutAdmin() {
  adminState.token = "";

  localStorage.removeItem(
    ADMIN_TOKEN_KEY
  );

  showLoginScreen();

  const username =
    $("#loginUsername");

  const password =
    $("#loginPassword");

  if (username) username.value = "";
  if (password) password.value = "";
}

async function handleAdminLogin(
  event
) {
  event.preventDefault();

  const username =
    $("#loginUsername")?.value.trim();

  const password =
    $("#loginPassword")?.value;

  const message =
    $("#loginMessage");

  const button =
    $("#loginButton");

  if (!username || !password) {
    if (message) {
      message.textContent =
        "نام کاربری و رمز عبور را وارد کنید.";
    }

    return;
  }

  try {
    if (button) {
      button.disabled = true;
      button.textContent =
        "در حال ورود...";
    }

    const data =
      await apiFetch("/api/login", {
        method: "POST",

        body: JSON.stringify({
          username,
          password
        })
      });

    adminState.token =
      data.token;

    localStorage.setItem(
      ADMIN_TOKEN_KEY,
      data.token
    );

    if (message) {
      message.textContent = "";
    }

    showAdminApp();

    await loadAllData();

    await navigate(
      "dashboard"
    );
  } catch (error) {
    if (message) {
      message.textContent =
        error.message;
    }
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent =
        "ورود به پنل";
    }
  }
}

/* =========================================================
   INIT
   ========================================================= */

async function initAdmin() {
  bindStaticEvents();

  if (!adminState.token) {
    showLoginScreen();
    return;
  }

  try {
    await apiFetch(
      "/api/admin/me"
    );

    showAdminApp();

    await loadAllData();

    await navigate(
      "dashboard"
    );
  } catch {
    logoutAdmin();
  }
}

function bindStaticEvents() {
  $("#loginForm")
    ?.addEventListener(
      "submit",
      handleAdminLogin
    );

  $("#refreshButton")
    ?.addEventListener(
      "click",
      async () => {
        try {
          await loadAllData();

          await renderCurrentPage();

          showToast(
            "اطلاعات به‌روزرسانی شد."
          );
        } catch (error) {
          showToast(
            error.message,
            "error"
          );
        }
      }
    );

  $("#modalClose")
    ?.addEventListener(
      "click",
      closeAdminModal
    );

  $("#adminModal")
    ?.addEventListener(
      "click",
      (event) => {
        if (
          event.target ===
          $("#adminModal")
        ) {
          closeAdminModal();
        }
      }
    );

  $("#mobileMenuButton")
    ?.addEventListener(
      "click",
      toggleMobileSidebar
    );

  $("#adminMenu")
    ?.addEventListener(
      "click",
      handleMenuClick
    );

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape"
      ) {
        closeAdminModal();
        closeMobileSidebar();
      }
    }
  );
}

/* =========================================================
   DATA LOADING
   ========================================================= */

async function loadAllData() {
  const [
    products,
    orders,
    customers,
    services,
    categories,
    tickets,
    coupons,
    servers,
    notifications,
    settings
  ] = await Promise.all([
    apiFetch("/api/products"),
    apiFetch("/api/orders"),
    apiFetch("/api/customers"),
    apiFetch("/api/services"),
    apiFetch("/api/categories"),
    apiFetch("/api/tickets"),
    apiFetch("/api/coupons"),
    apiFetch("/api/servers"),
    apiFetch("/api/notifications"),
    apiFetch("/api/settings")
  ]);

  adminState.products =
    products.products || [];

  adminState.orders =
    orders.orders || [];

  adminState.customers =
    customers.customers || [];

  adminState.services =
    services.services || [];

  adminState.categories =
    categories.categories || [];

  adminState.tickets =
    tickets.tickets || [];

  adminState.coupons =
    coupons.coupons || [];

  adminState.servers =
    servers.servers || [];

  adminState.notifications =
    notifications.notifications || [];

  adminState.settings =
    settings.settings || {};

  try {
    const dashboard =
      await apiFetch(
        "/api/dashboard"
      );

    adminState.dashboard =
      dashboard;
  } catch {}

  try {
    const feature =
      await apiFetch(
        "/api/features"
      );

    adminState.flashSale =
      feature.flashSale || null;

    adminState.wheel =
      feature.wheel || null;

    adminState.wheelPrizes =
      feature.wheelPrizes || [];
  } catch {}
}

/* =========================================================
   NAVIGATION
   ========================================================= */

const pageTitles = {
  dashboard: [
    "داشبورد",
    "نمای کلی فروشگاه"
  ],

  categories: [
    "دسته‌بندی‌ها",
    "مدیریت دسته‌های فروش"
  ],

  products: [
    "محصولات",
    "مدیریت پلن‌ها و سرویس‌ها"
  ],

  orders: [
    "سفارش‌ها",
    "بررسی پرداخت و تحویل"
  ],

  customers: [
    "مشتری‌ها",
    "مدیریت کاربران"
  ],

  services: [
    "سرویس‌ها",
    "سرویس‌های تحویل داده شده"
  ],

  tickets: [
    "تیکت‌ها",
    "پشتیبانی مشتریان"
  ],

  coupons: [
    "کدهای تخفیف",
    "مدیریت کوپن‌ها"
  ],

  "flash-sale": [
    "فروش ویژه",
    "مدیریت تخفیف و کمپین"
  ],

  wheel: [
    "گردونه شانس",
    "مدیریت جوایز و شانس"
  ],

  servers: [
    "سرورها",
    "مدیریت سرورهای سرویس"
  ],

  telegram: [
    "تلگرام",
    "اتصال بات و کانال"
  ],

  notifications: [
    "اعلان‌ها",
    "پیام‌های سیستم"
  ],

  analytics: [
    "آمار و تحلیل",
    "گزارش فروشگاه"
  ],

  audit: [
    "گزارش فعالیت",
    "لاگ عملیات پنل"
  ],

  settings: [
    "تنظیمات",
    "تنظیمات اصلی فروشگاه"
  ],

  backup: [
    "پشتیبان‌گیری",
    "نسخه پشتیبان اطلاعات"
  ]
};

async function navigate(page) {
  adminState.page =
    page || "dashboard";

  closeMobileSidebar();

  document
    .querySelectorAll(
      ".admin-menu-item"
    )
    .forEach((item) => {
      item.classList.toggle(
        "active",
        item.dataset.page ===
          adminState.page
      );
    });

  const title =
    pageTitles[
      adminState.page
    ] ||
    pageTitles.dashboard;

  if ($("#pageKicker")) {
    $("#pageKicker").textContent =
      "SAMI WIREGUARD";
  }

  if ($("#pageTitle")) {
    $("#pageTitle").textContent =
      title[0];
  }

  await renderCurrentPage();
}

async function renderCurrentPage() {
  const content =
    $("#content");

  if (!content) return;

  content.innerHTML = `
    <div class="admin-loading">
      در حال بارگذاری...
    </div>
  `;

  switch (
    adminState.page
  ) {
    case "dashboard":
      renderDashboard();
      break;

    case "categories":
      renderCategoriesPage();
      break;

    case "products":
      renderProductsPage();
      break;

    case "orders":
      renderOrdersPage();
      break;

    case "customers":
      renderCustomersPage();
      break;

    case "services":
      renderServicesPage();
      break;

    case "tickets":
      renderTicketsPage();
      break;

    case "coupons":
      renderCouponsPage();
      break;

    case "flash-sale":
      await renderFlashSalePage();
      break;

    case "wheel":
      await renderWheelPage();
      break;

    case "servers":
      renderServersPage();
      break;

    case "telegram":
      renderTelegramPage();
      break;

    case "notifications":
      renderNotificationsPage();
      break;

    case "analytics":
      await renderAnalyticsPage();
      break;

    case "audit":
      await renderAuditPage();
      break;

    case "settings":
      renderSettingsPage();
      break;

    case "backup":
      renderBackupPage();
      break;

    default:
      renderDashboard();
  }
}

function handleMenuClick(event) {
  const item =
    event.target.closest(
      ".admin-menu-item"
    );

  if (!item) return;

  navigate(
    item.dataset.page
  );
}

function toggleMobileSidebar() {
  const sidebar =
    $("#adminSidebar");

  if (!sidebar) return;

  sidebar.classList.toggle(
    "mobile-open"
  );
}

function closeMobileSidebar() {
  $("#adminSidebar")
    ?.classList.remove(
      "mobile-open"
    );
}

/* =========================================================
   DASHBOARD
   ========================================================= */

function renderDashboard() {
  const content =
    $("#content");

  const stats =
    adminState.dashboard?.stats ||
    {};

  const recentOrders =
    adminState.dashboard?.recentOrders ||
    [];

  content.innerHTML = `
    <div class="admin-page-head">
      <div>
        <h2>داشبورد</h2>
        <p>
          وضعیت کلی فروشگاه و سفارش‌های اخیر
        </p>
      </div>

      <div>
        <button
          class="admin-primary-button"
          onclick="navigate('products')"
        >
          + محصول جدید
        </button>
      </div>
    </div>

    <div class="admin-stats-grid">

      ${dashboardStat(
        "مشتری‌ها",
        stats.users || 0
      )}

      ${dashboardStat(
        "محصولات فعال",
        stats.activeProducts || 0
      )}

      ${dashboardStat(
        "سفارش‌ها",
        stats.orders || 0
      )}

      ${dashboardStat(
        "در انتظار بررسی",
        stats.pendingOrders || 0
      )}

    </div>

    <div class="admin-dashboard-grid">

      <section class="admin-panel-card">

        <div class="admin-panel-card-head">
          <h3>سفارش‌های اخیر</h3>

          <button
            class="admin-small-button"
            onclick="navigate('orders')"
          >
            مشاهده همه
          </button>
        </div>

        ${
          recentOrders.length
            ? `
              <div class="admin-table-wrap">
                <table class="admin-table">
                  <thead>
                    <tr>
                      <th>سفارش</th>
                      <th>مشتری</th>
                      <th>مبلغ</th>
                      <th>وضعیت</th>
                      <th>تاریخ</th>
                    </tr>
                  </thead>

                  <tbody>
                    ${recentOrders
                      .map(
                        renderRecentOrderRow
                      )
                      .join("")}
                  </tbody>
                </table>
              </div>
            `
            : `
              <div class="admin-empty-state">
                هنوز سفارشی ثبت نشده است.
              </div>
            `
        }

      </section>

      <section class="admin-panel-card">

        <div class="admin-panel-card-head">
          <h3>دسترسی سریع</h3>
        </div>

        <div class="admin-quick-actions">

          <button onclick="navigate('products')">
            مدیریت محصولات
          </button>

          <button onclick="navigate('orders')">
            بررسی سفارش‌ها
          </button>

          <button onclick="navigate('customers')">
            مشتری‌ها
          </button>

          <button onclick="navigate('tickets')">
            پشتیبانی
          </button>

          <button onclick="navigate('flash-sale')">
            فروش ویژه
          </button>

          <button onclick="navigate('wheel')">
            گردونه شانس
          </button>

        </div>

      </section>

    </div>
  `;
}

function dashboardStat(
  label,
  value
) {
  return `
    <div class="admin-stat-card">
      <div class="admin-card-label">
        ${escapeHTML(label)}
      </div>

      <strong>
        ${Number(value || 0).toLocaleString("fa-IR")}
      </strong>
    </div>
  `;
}

function renderRecentOrderRow(
  order
) {
  return `
    <tr>

      <td>
        <strong>
          #${escapeHTML(
            order.id?.slice(-8)
          )}
        </strong>
      </td>

      <td>
        ${escapeHTML(
          order.phone || "—"
        )}
      </td>

      <td>
        ${formatPrice(
          order.amount
        )}
      </td>

      <td>
        ${statusBadge(
          order.status
        )}
      </td>

      <td>
        ${formatDate(
          order.createdAt
        )}
      </td>

    </tr>
  `;
}

/* =========================================================
   CATEGORIES
   ========================================================= */

function renderCategoriesPage() {
  const content =
    $("#content");

  content.innerHTML = `
    <div class="admin-page-head">

      <div>
        <h2>دسته‌بندی‌ها</h2>
        <p>
          دسته‌های قابل نمایش در فروشگاه
        </p>
      </div>

      <div>
        <button
          class="admin-primary-button"
          onclick="openCategoryModal()"
        >
          + دسته جدید
        </button>
      </div>

    </div>

    <div class="admin-table-wrap">

      <table class="admin-table">

        <thead>
          <tr>
            <th>نام</th>
            <th>Slug</th>
            <th>ترتیب</th>
            <th>وضعیت</th>
            <th>عملیات</th>
          </tr>
        </thead>

        <tbody>

          ${
            adminState.categories.length
              ? adminState.categories
                  .map(
                    renderCategoryRow
                  )
                  .join("")
              : `
                <tr>
                  <td
                    colspan="5"
                    class="admin-empty-cell"
                  >
                    دسته‌ای وجود ندارد.
                  </td>
                </tr>
              `
          }

        </tbody>

      </table>

    </div>
  `;
}

function renderCategoryRow(
  category
) {
  return `
    <tr>

      <td>
        <strong>
          ${escapeHTML(
            category.name
          )}
        </strong>
      </td>

      <td>
        ${escapeHTML(
          category.slug
        )}
      </td>

      <td>
        ${escapeHTML(
          category.sort
        )}
      </td>

      <td>
        ${statusBadge(
          category.active
            ? "active"
            : "inactive"
        )}
      </td>

      <td>

        <div class="admin-actions">

          <button
            class="admin-small-button"
            onclick="openCategoryModal('${category.id}')"
          >
            ویرایش
          </button>

          <button
            class="admin-small-button"
            onclick="toggleCategory('${category.id}')"
          >
            ${
              category.active
                ? "غیرفعال"
                : "فعال"
            }
          </button>

        </div>

      </td>

    </tr>
  `;
}

function openCategoryModal(
  id = ""
) {
  const category =
    adminState.categories.find(
      (item) =>
        item.id === id
    );

  openAdminModal(
    category
      ? "ویرایش دسته"
      : "دسته جدید",
    `
      <form
        class="admin-form"
        id="categoryForm"
      >

        <input
          type="hidden"
          id="categoryId"
          value="${escapeHTML(
            category?.id || ""
          )}"
        >

        <div class="admin-form-grid">

          <label>
            نام دسته
            <input
              id="categoryName"
              required
              value="${escapeHTML(
                category?.name || ""
              )}"
            >
          </label>

          <label>
            Slug
            <input
              id="categorySlug"
              required
              value="${escapeHTML(
                category?.slug || ""
              )}"
              placeholder="wireguard"
            >
          </label>

          <label>
            ترتیب نمایش
            <input
              id="categorySort"
              type="number"
              value="${Number(
                cat
