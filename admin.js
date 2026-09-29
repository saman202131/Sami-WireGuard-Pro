const ADMIN_TOKEN_KEY = "sami_admin_token";

const state = {
  token: localStorage.getItem(ADMIN_TOKEN_KEY),

  currentPage: "dashboard",

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

const pageTitles = {
  dashboard: ["داشبورد", "مرکز مدیریت سامی وایرگارد"],
  categories: ["دسته‌بندی‌ها", "مدیریت دسته‌بندی محصولات"],
  products: ["محصولات", "مدیریت پلن‌ها و سرویس‌ها"],
  orders: ["سفارش‌ها", "بررسی پرداخت و تحویل سرویس"],
  customers: ["مشتریان", "مدیریت کاربران سایت"],
  services: ["سرویس‌ها", "سرویس‌های فعال مشتریان"],
  tickets: ["تیکت‌ها", "پشتیبانی مشتریان"],
  coupons: ["کدهای تخفیف", "مدیریت کوپن‌ها"],
  "flash-sale": ["فروش ویژه", "مدیریت تخفیف و کمپین فروش"],
  wheel: ["گردونه شانس", "مدیریت جوایز و شانس کاربران"],
  servers: ["سرورها", "مدیریت سرورهای سرویس"],
  telegram: ["تلگرام", "تنظیمات ربات و کانال"],
  notifications: ["اعلان‌ها", "ارسال و مدیریت اعلان‌ها"],
  analytics: ["آمار و تحلیل", "گزارش عملکرد فروشگاه"],
  audit: ["گزارش فعالیت", "سوابق عملیات مدیریتی"],
  settings: ["تنظیمات", "تنظیمات اصلی فروشگاه"],
  backup: ["پشتیبان‌گیری", "مدیریت نسخه پشتیبان"]
};

document.addEventListener("DOMContentLoaded", initAdmin);

/* =========================================================
   INIT
   ========================================================= */

async function initAdmin() {
  bindAdminEvents();

  if (!state.token) {
    showLogin();
    return;
  }

  try {
    await apiFetch("/api/admin/me");

    showAdminApp();

    await loadAllData();

    navigate("dashboard");
  } catch {
    logoutAdmin(false);
  }
}

function bindAdminEvents() {
  const loginForm =
    document.getElementById("loginForm");

  if (loginForm) {
    loginForm.addEventListener(
      "submit",
      handleAdminLogin
    );
  }

  const refreshButton =
    document.getElementById("refreshButton");

  if (refreshButton) {
    refreshButton.addEventListener(
      "click",
      async () => {
        await loadAllData();
        navigate(state.currentPage);
        showToast("اطلاعات بروزرسانی شد.", "success");
      }
    );
  }

  const mobileButton =
    document.getElementById(
      "mobileMenuButton"
    );

  if (mobileButton) {
    mobileButton.addEventListener(
      "click",
      toggleMobileSidebar
    );
  }

  const modalClose =
    document.getElementById("modalClose");

  if (modalClose) {
    modalClose.addEventListener(
      "click",
      closeAdminModal
    );
  }

  const modal =
    document.getElementById("adminModal");

  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeAdminModal();
      }
    });
  }
}

/* =========================================================
   LOGIN
   ========================================================= */

async function handleAdminLogin(event) {
  event.preventDefault();

  const username =
    document.getElementById(
      "loginUsername"
    )?.value.trim();

  const password =
    document.getElementById(
      "loginPassword"
    )?.value;

  const button =
    document.getElementById(
      "loginButton"
    );

  const message =
    document.getElementById(
      "loginMessage"
    );

  if (!username || !password) {
    setLoginMessage(
      "نام کاربری و رمز عبور را وارد کنید."
    );
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "در حال ورود...";
  }

  try {
    const response = await fetch(
      "/api/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username,
          password
        })
      }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.message ||
          "ورود ناموفق بود."
      );
    }

    state.token = data.token;

    localStorage.setItem(
      ADMIN_TOKEN_KEY,
      data.token
    );

    showAdminApp();

    await loadAllData();

    navigate("dashboard");

    showToast(
      "با موفقیت وارد پنل مدیریت شدید.",
      "success"
    );
  } catch (error) {
    setLoginMessage(
      error.message ||
        "خطا در ورود."
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "ورود به پنل";
    }
  }
}

function setLoginMessage(message) {
  const element =
    document.getElementById(
      "loginMessage"
    );

  if (element) {
    element.textContent = message;
  }
}

function showLogin() {
  const login =
    document.getElementById(
      "loginScreen"
    );

  const app =
    document.getElementById(
      "adminApp"
    );

  if (login) {
    login.style.display = "flex";
  }

  if (app) {
    app.style.display = "none";
  }
}

function showAdminApp() {
  const login =
    document.getElementById(
      "loginScreen"
    );

  const app =
    document.getElementById(
      "adminApp"
    );

  if (login) {
    login.style.display = "none";
  }

  if (app) {
    app.style.display = "grid";
  }
}

function logoutAdmin(showMessage = true) {
  state.token = null;

  localStorage.removeItem(
    ADMIN_TOKEN_KEY
  );

  if (showMessage) {
    showLogin();
    setLoginMessage(
      "از پنل خارج شدید."
    );
  } else {
    showLogin();
  }
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

  if (state.token) {
    headers.Authorization =
      `Bearer ${state.token}`;
  }

  const response = await fetch(
    url,
    {
      ...options,
      headers
    }
  );

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (response.status === 401) {
    logoutAdmin(false);

    throw new Error(
      "نشست مدیریت منقضی شده است."
    );
  }

  if (!response.ok || data.ok === false) {
    throw new Error(
      data.message ||
        "خطا در ارتباط با سرور."
    );
  }

  return data;
}

/* =========================================================
   LOAD DATA
   ========================================================= */

async function loadAllData() {
  const requests = await Promise.allSettled([
    loadProducts(),
    loadOrders(),
    loadCustomers(),
    loadServices(),
    loadCategories(),
    loadTickets(),
    loadCoupons(),
    loadServers(),
    loadNotifications(),
    loadSettings(),
    loadDashboard(),
    loadFeatures()
  ]);

  const failed = requests.filter(
    (item) =>
      item.status === "rejected"
  );

  if (failed.length) {
    console.warn(
      "Some admin data failed to load:",
      failed
    );
  }
}

async function loadProducts() {
  const data =
    await apiFetch(
      "/api/products"
    );

  state.products =
    data.products || [];
}

async function loadOrders() {
  const data =
    await apiFetch(
      "/api/orders"
    );

  state.orders =
    data.orders || [];
}

async function loadCustomers() {
  const data =
    await apiFetch(
      "/api/customers"
    );

  state.customers =
    data.customers || [];
}

async function loadServices() {
  const data =
    await apiFetch(
      "/api/services"
    );

  state.services =
    data.services || [];
}

async function loadCategories() {
  const data =
    await apiFetch(
      "/api/categories"
    );

  state.categories =
    data.categories || [];
}

async function loadTickets() {
  const data =
    await apiFetch(
      "/api/tickets"
    );

  state.tickets =
    data.tickets || [];
}

async function loadCoupons() {
  const data =
    await apiFetch(
      "/api/coupons"
    );

  state.coupons =
    data.coupons || [];
}

async function loadServers() {
  const data =
    await apiFetch(
      "/api/servers"
    );

  state.servers =
    data.servers || [];
}

async function loadNotifications() {
  const data =
    await apiFetch(
      "/api/notifications"
    );

  state.notifications =
    data.notifications || [];
}

async function loadSettings() {
  const data =
    await apiFetch(
      "/api/settings"
    );

  state.settings =
    data.settings || {};
}

async function loadDashboard() {
  const data =
    await apiFetch(
      "/api/dashboard"
    );

  state.dashboard = data;
}

async function loadFeatures() {
  try {
    const data =
      await apiFetch(
        "/api/features"
      );

    state.flashSale =
      data.flashSale || null;

    state.wheel =
      data.wheel || null;

    state.wheelPrizes =
      data.wheelPrizes || [];
  } catch {
    state.flashSale = null;
    state.wheel = null;
    state.wheelPrizes = [];
  }
}

/* =========================================================
   NAVIGATION
   ========================================================= */

function navigate(page) {
  if (!pageTitles[page]) {
    page = "dashboard";
  }

  state.currentPage = page;

  updatePageHeader(page);

  document
    .querySelectorAll(
      ".admin-menu-item"
    )
    .forEach((item) => {
      item.classList.toggle(
        "active",
        item.dataset.page === page
      );
    });

  closeMobileSidebar();

  const content =
    document.getElementById(
      "content"
    );

  if (!content) return;

  content.innerHTML =
    `<div class="admin-loading">در حال بارگذاری...</div>`;

  switch (page) {
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
      renderFlashSalePage();
      break;

    case "wheel":
      renderWheelPage();
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
      renderAnalyticsPage();
      break;

    case "audit":
      renderAuditPage();
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

function updatePageHeader(page) {
  const data =
    pageTitles[page];

  const kicker =
    document.getElementById(
      "pageKicker"
    );

  const title =
    document.getElementById(
      "pageTitle"
    );

  if (kicker) {
    kicker.textContent =
      "SAMI WIREGUARD";
  }

  if (title) {
    title.textContent =
      data?.[0] || "پنل مدیریت";
  }
}

/* =========================================================
   DASHBOARD
   ========================================================= */

function renderDashboard() {
  const content =
    document.getElementById(
      "content"
    );

  const stats =
    state.dashboard?.stats || {};

  const recentOrders =
    state.dashboard?.recentOrders || [];

  content.innerHTML = `
    <div class="admin-page-head">
      <div>
        <h2>نمای کلی فروشگاه</h2>
        <p>
          وضعیت سفارش‌ها، مشتری‌ها و سرویس‌های سامی وایرگارد
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
      ${statCard(
        "مشتریان",
        formatNumber(stats.users || 0)
      )}

      ${statCard(
        "محصولات",
        formatNumber(
          stats.activeProducts ??
          stats.products ??
          0
        )
      )}

      ${statCard(
        "سفارش‌ها",
        formatNumber(stats.orders || 0)
      )}

      ${statCard(
        "در انتظار بررسی",
        formatNumber(
          stats.pendingOrders || 0
        )
      )}
    </div>

    <div class="admin-dashboard-grid">
      <div class="admin-panel-card">
        <div class="admin-panel-card-head">
          <div>
            <h3>آخرین سفارش‌ها</h3>
            <span>
              جدیدترین تراکنش‌های فروشگاه
            </span>
          </div>

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
                    </tr>
                  </thead>

                  <tbody>
                    ${recentOrders
                      .map(
                        renderDashboardOrder
                      )
                      .join("")}
                  </tbody>
                </table>
              </div>
            `
            : emptyState(
                "هنوز سفارشی ثبت نشده است."
              )
        }
      </div>

      <div class="admin-panel-card">
        <div class="admin-panel-card-head">
          <div>
            <h3>دسترسی سریع</h3>
            <span>
              عملیات پرکاربرد
            </span>
          </div>
        </div>

        <div class="admin-quick-actions">
          <button onclick="navigate('products')">
            مدیریت محصولات
          </button>

          <button onclick="navigate('orders')">
            بررسی سفارش‌ها
          </button>

          <button onclick="navigate('customers')">
            مشتریان
          </button>

          <button onclick="navigate('tickets')">
            تیکت‌های پشتیبانی
          </button>

          <button onclick="navigate('flash-sale')">
            فروش ویژه
          </button>

          <button onclick="navigate('wheel')">
            گردونه شانس
          </button>

          <button onclick="navigate('telegram')">
            تنظیمات تلگرام
          </button>

          <button onclick="navigate('settings')">
            تنظیمات سایت
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderDashboardOrder(order) {
  return `
    <tr>
      <td>
        <strong>
          #${escapeHtml(
            shortId(order.id)
          )}
        </strong>
      </td>

      <td>
        ${
          escapeHtml(
            order.customerName ||
              order.phone ||
              "مشتری"
          )
        }
      </td>

      <td>
        ${formatPrice(
          order.amount ??
            order.price ??
            0
        )}
      </td>

      <td>
        ${statusBadge(
          order.status
        )}
      </td>
    </tr>
  `;
}

function statCard(label, value) {
  return `
    <div class="admin-stat-card">
      <span class="admin-card-label">
        ${label}
      </span>

      <strong>
        ${value}
      </strong>
    </div>
  `;
}

/* =========================================================
   CATEGORIES
   ========================================================= */

function renderCategoriesPage() {
  const content =
    document.getElementById(
      "content"
    );

  content.innerHTML = `
    <div class="admin-page-head">
      <div>
        <h2>دسته‌بندی محصولات</h2>
        <p>
          ترتیب و وضعیت دسته‌بندی‌ها را کنترل کنید.
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
            state.categories.length
              ? state.categories
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
                    دسته‌بندی‌ای ثبت نشده است.
                  </td>
                </tr>
              `
          }
        </tbody>
      </table>
    </div>
  `;
}

function renderCategoryRow(category) {
  return `
    <tr>
      <td>
        <strong>
          ${escapeHtml(
            category.name
          )}
        </strong>
      </td>

      <td>
        ${escapeHtml(
          category.slug || "-"
        )}
      </td>

      <td>
        ${formatNumber(
          category.sort || 0
        )}
      </td>

      <td>
        ${
          category.active !== false
            ? statusBadge(
                "active"
              )
            : statusBadge(
                "inactive"
              )
        }
      </td>

      <td>
        <div class="admin-actions">
          <button
            class="admin-small-button"
            onclick="openCategoryModal('${escapeAttr(
              category.id
            )}')"
          >
            ویرایش
          </button>

          <button
            class="admin-small-button danger"
            onclick="deleteCategory('${escapeAttr(
              category.id
            )}')"
          >
            حذف
          </button>
        </div>
      </td>
    </tr>
  `;
}

function openCategoryModal(id = "") {
  const category =
    state.categories.find(
      (item) => item.id === id
    );

  openAdminModal(
    category
      ? "ویرایش دسته‌بندی"
      : "دسته‌بندی جدید",
    `
      <form
        class="admin-form"
        onsubmit="saveCategory(event, '${escapeAttr(
          id
        )}')"
      >
        <div class="admin-form-grid">
          <label>
            نام دسته
            <input
              name="name"
              required
              value="${escapeAttr(
                category?.name || ""
              )}"
              placeholder="مثلاً WireGuard"
            />
          </label>

          <label>
            Slug
            <input
              name="slug"
              value="${escapeAttr(
                category?.slug || ""
              )}"
              placeholder="wireguard"
            />
          </label>

          <label>
            ترتیب
            <input
              name="sort"
              type="number"
              value="${escapeAttr(
                category?.sort || 1
              )}"
            />
          </label>

          <label class="admin-checkbox">
            <input
              name="active"
              type="checkbox"
              ${
                category?.active !== false
                  ? "checked"
                  : ""
              }
            />
            فعال باشد
          </label>
        </div>

        <div class="admin-form-actions">
          <button
            type="button"
            class="admin-secondary-button"
            onclick="closeAdminModal()"
          >
            انصراف
          </button>

          <button
            type="submit"
            class="admin-primary-button"
          >
            ذخیره
          </button>
        </div>
      </form>
    `
  );
}

async function saveCategory(event, id) {
  event.preventDefault();

  const form = event.target;
  const formData =
    new FormData(form);

  const category = {
