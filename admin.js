const ADMIN_TOKEN_KEY = "sami_admin_token";

const state = {
  token: localStorage.getItem(ADMIN_TOKEN_KEY) || "",
  admin: null,
  page: "dashboard",

  dashboard: null,
  products: [],
  categories: [],
  orders: [],
  customers: [],
  services: [],
  tickets: [],
  coupons: [],
  servers: [],
  notifications: [],
  settings: {},
  flashSale: {},
  wheel: {},
  analytics: {},
  audit: []
};

const $ = (selector) => document.querySelector(selector);

function safeText(value) {
  return String(value ?? "").trim();
}

function escapeHtml(value) {
  return safeText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatMoney(value) {
  return new Intl.NumberFormat("fa-IR").format(
    Number(value || 0)
  );
}

function formatDate(value) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString("fa-IR");
  } catch {
    return "-";
  }
}

function showToast(message, type = "success") {
  const toast = $("#adminToast");

  if (!toast) return;

  toast.textContent = message;
  toast.className = `admin-toast ${type}`;

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.className = "admin-toast";
  }, 3000);
}

function openModal(title, content) {
  const modal = $("#adminModal");

  if (!modal) return;

  $("#modalTitle").textContent = title;
  $("#modalContent").innerHTML = content;

  modal.classList.add("open");
}

function closeModal() {
  $("#adminModal")?.classList.remove("open");
}

async function apiFetch(url, options = {}) {
  const headers = {
    ...(options.headers || {})
  };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 401) {
    logout();
    throw new Error("نشست مدیریت منقضی شده است.");
  }

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
      data.message ||
      "خطا در ارتباط با سرور"
    );
  }

  return data;
}

async function handleAdminLogin(event) {
  event.preventDefault();

  const username = safeText(
    $("#loginUsername")?.value
  );

  const password = safeText(
    $("#loginPassword")?.value
  );

  const message = $("#loginMessage");
  const button = $("#loginButton");

  if (!username || !password) {
    if (message) {
      message.textContent =
        "نام کاربری و رمز عبور را وارد کنید.";
    }

    return;
  }

  button && (button.disabled = true);

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        password
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
        "ورود ناموفق بود."
      );
    }

    state.token = data.token;

    localStorage.setItem(
      ADMIN_TOKEN_KEY,
      state.token
    );

    state.admin = data.admin || data.user || null;

    await showAdminApp();
  } catch (error) {
    if (message) {
      message.textContent =
        error.message || "خطا در ورود";
    }
  } finally {
    button && (button.disabled = false);
  }
}

function logout() {
  state.token = "";
  state.admin = null;

  localStorage.removeItem(
    ADMIN_TOKEN_KEY
  );

  $("#adminApp")?.classList.add("hidden");
  $("#loginScreen")?.classList.remove("hidden");
}

async function checkAdminSession() {
  if (!state.token) {
    $("#adminApp")?.classList.add("hidden");
    $("#loginScreen")?.classList.remove("hidden");
    return false;
  }

  try {
    const data = await apiFetch(
      "/api/admin/me"
    );

    state.admin =
      data.admin ||
      data.user ||
      data;

    return true;
  } catch {
    return false;
  }
}

async function showAdminApp() {
  $("#loginScreen")?.classList.add("hidden");
  $("#adminApp")?.classList.remove("hidden");

  await loadAllData();
  await navigate("dashboard");
}

async function loadAllData() {
  await Promise.allSettled([
    loadDashboard(),
    loadProducts(),
    loadCategories(),
    loadOrders(),
    loadCustomers(),
    loadServices(),
    loadTickets(),
    loadCoupons(),
    loadServers(),
    loadNotifications(),
    loadSettings(),
    loadFlashSale(),
    loadWheel()
  ]);
}

async function loadDashboard() {
  try {
    state.dashboard = await apiFetch(
      "/api/dashboard"
    );
  } catch (error) {
    console.error(error);
  }
}

async function loadProducts() {
  try {
    const data = await apiFetch(
      "/api/products"
    );

    state.products =
      data.products ||
      data.items ||
      [];
  } catch (error) {
    console.error(error);
  }
}

async function loadCategories() {
  try {
    const data = await apiFetch(
      "/api/categories"
    );

    state.categories =
      data.categories ||
      [];
  } catch (error) {
    console.error(error);
  }
}

async function loadOrders() {
  try {
    const data = await apiFetch(
      "/api/orders"
    );

    state.orders =
      data.orders ||
      [];
  } catch (error) {
    console.error(error);
  }
}

async function loadCustomers() {
  try {
    const data = await apiFetch(
      "/api/customers"
    );

    state.customers =
      data.customers ||
      data.users ||
      [];
  } catch (error) {
    console.error(error);
  }
}

async function loadServices() {
  try {
    const data = await apiFetch(
      "/api/services"
    );

    state.services =
      data.services ||
      [];
  } catch (error) {
    console.error(error);
  }
}

async function loadTickets() {
  try {
    const data = await apiFetch(
      "/api/tickets"
    );

    state.tickets =
      data.tickets ||
      [];
  } catch (error) {
    console.error(error);
  }
}

async function loadCoupons() {
  try {
    const data = await apiFetch(
      "/api/coupons"
    );

    state.coupons =
      data.coupons ||
      [];
  } catch (error) {
    console.error(error);
  }
}

async function loadServers() {
  try {
    const data = await apiFetch(
      "/api/servers"
    );

    state.servers =
      data.servers ||
      [];
  } catch (error) {
    console.error(error);
  }
}

async function loadNotifications() {
  try {
    const data = await apiFetch(
      "/api/notifications"
    );

    state.notifications =
      data.notifications ||
      [];
  } catch (error) {
    console.error(error);
  }
}

async function loadSettings() {
  try {
    const data = await apiFetch(
      "/api/settings"
    );

    state.settings =
      data.settings ||
      data ||
      {};
  } catch (error) {
    console.error(error);
  }
}

async function loadFlashSale() {
  try {
    const data = await apiFetch(
      "/api/flash-sale"
    );

    state.flashSale =
      data.flashSale ||
      data ||
      {};
  } catch (error) {
    console.error(error);
  }
}

async function loadWheel() {
  try {
    const data = await apiFetch(
      "/api/wheel"
    );

    state.wheel =
      data.wheel ||
      data ||
      {};
  } catch (error) {
    console.error(error);
  }
}

async function navigate(page) {
  state.page = page;

  closeMobileSidebar();

  const titles = {
    dashboard: [
      "Overview",
      "داشبورد"
    ],

    categories: [
      "Categories",
      "دسته‌بندی‌ها"
    ],

    products: [
      "Products",
      "محصولات"
    ],

    orders: [
      "Orders",
      "سفارش‌ها"
    ],

    customers: [
      "Customers",
      "مشتریان"
    ],

    services: [
      "Services",
      "سرویس‌ها"
    ],

    tickets: [
      "Tickets",
      "تیکت‌ها"
    ],

    coupons: [
      "Coupons",
      "کدهای تخفیف"
    ],

    "flash-sale": [
      "Flash Sale",
      "فروش ویژه"
    ],

    wheel: [
      "Wheel",
      "گردونه شانس"
    ],

    servers: [
      "Servers",
      "سرورها"
    ],

    telegram: [
      "Telegram",
      "تلگرام"
    ],

    notifications: [
      "Notifications",
      "اعلان‌ها"
    ],

    analytics: [
      "Analytics",
      "آمار و تحلیل"
    ],

    audit: [
      "Audit Logs",
      "گزارش فعالیت"
    ],

    settings: [
      "Settings",
      "تنظیمات"
    ],

    backup: [
      "Backup",
      "پشتیبان"
    ]
  };

  const title =
    titles[page] ||
    titles.dashboard;

  if ($("#pageKicker")) {
    $("#pageKicker").textContent =
      title[0];
  }

  if ($("#pageTitle")) {
    $("#pageTitle").textContent =
      title[1];
  }

  document
    .querySelectorAll(
      ".admin-menu button[data-page]"
    )
    .forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.page === page
      );
    });

  switch (page) {
    case "dashboard":
      renderDashboardPage();
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
      renderDashboardPage();
  }
}

function renderDashboardPage() {
  const stats =
    state.dashboard?.stats ||
    state.dashboard ||
    {};

  const users =
    Number(
      stats.users ||
      stats.customers ||
      stats.totalCustomers ||
      state.customers.length ||
      0
    );

  const products =
    Number(
      stats.products ||
      state.products.length ||
      0
    );

  const orders =
    Number(
      stats.orders ||
      state.orders.length ||
      0
    );

  const revenue =
    Number(
      stats.revenue ||
      stats.totalRevenue ||
      0
    );

  const pendingOrders =
    Number(
      stats.pendingOrders ||
      state.orders.filter(
        (order) =>
          order.status === "pending"
      ).length ||
      0
    );

  $("#content").innerHTML = `
    <div class="page-head">
      <div>
        <h2>داشبورد</h2>
        <p>نمای کلی فروشگاه Sami WireGuard</p>
      </div>

      <button
        class="admin-button"
        onclick="refreshAdminData()"
      >
        بروزرسانی
      </button>
    </div>

    <div class="stats-grid">

      <div class="stat-card">
        <span>مشتریان</span>
        <strong>${formatMoney(users)}</strong>
      </div>

      <div class="stat-card">
        <span>محصولات</span>
        <strong>${formatMoney(products)}</strong>
      </div>

      <div class="stat-card">
        <span>سفارش‌ها</span>
        <strong>${formatMoney(orders)}</strong>
      </div>

      <div class="stat-card">
        <span>سفارش در انتظار</span>
        <strong>${formatMoney(pendingOrders)}</strong>
      </div>

      <div class="stat-card">
        <span>درآمد</span>
        <strong>${formatMoney(revenue)}</strong>
      </div>

    </div>

    <div class="admin-card">
      <div class="card-head">
        <h3>آخرین سفارش‌ها</h3>

        <button
          class="admin-button small"
          onclick="navigate('orders')"
        >
          مشاهده همه
        </button>
      </div>

      ${renderRecentOrders()}
    </div>
  `;
}

function renderRecentOrders() {
  const orders =
    state.orders
      .slice()
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0) -
          new Date(a.createdAt || 0)
      )
      .slice(0, 8);

  if (!orders.length) {
    return `
      <div class="empty-state">
        هنوز سفارشی ثبت نشده است.
      </div>
    `;
  }

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>شماره</th>
            <th>محصول</th>
            <th>مبلغ</th>
            <th>وضعیت</th>
            <th>تاریخ</th>
          </tr>
        </thead>

        <tbody>
          ${orders
            .map(
              (order) => `
                <tr>
                  <td>
                    ${escapeHtml(order.id)}
                  </td>

                  <td>
                    ${escapeHtml(
                      order.productName ||
                      order.product?.name ||
                      "-"
                    )}
                  </td>

                  <td>
                    ${formatMoney(
                      order.amount ||
                      order.price ||
                      0
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
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function statusBadge(status) {
  const labels = {
    pending: "در انتظار",
    approved: "تأیید شده",
    rejected: "رد شده",
    delivered: "تحویل شده",
    cancelled: "لغو شده",
    active: "فعال",
    inactive: "غیرفعال"
  };

  return `
    <span class="status-badge ${escapeHtml(
      status || ""
    )}">
      ${escapeHtml(
        labels[status] ||
        status ||
        "-"
      )}
    </span>
  `;
}

function renderCategoriesPage() {
  $("#content").innerHTML = `
    <div class="page-head">
      <div>
        <h2>دسته‌بندی‌ها</h2>
        <p>مدیریت دسته‌بندی محصولات</p>
      </div>

      <button
        class="admin-button"
        onclick="openCategoryModal()"
      >
        + دسته‌بندی جدید
      </button>
    </div>

    <div class="admin-card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>نام</th>
              <th>Slug</th>
              <th>وضعیت</th>
              <th>عملیات</th>
            </tr>
          </thead>

          <tbody>
            ${
              state.categories.length
                ? state.categories
                    .map(
                      (category) => `
                        <tr>
                          <td>
                            ${escapeHtml(
                              category.name
                            )}
                          </td>

                          <td>
                            ${escapeHtml(
                              category.slug ||
                              category.id ||
                              "-"
                            )}
                          </td>

                          <td>
                            ${statusBadge(
                              category.active === false
                                ? "inactive"
                                : "active"
                            )}
                          </td>

                          <td>
                            <button
                              class="admin-button small"
                              onclick='openCategoryModal(${JSON.stringify(
                                category
                              )})'
                            >
                              ویرایش
                            </button>
                          </td>
                        </tr>
                      `
                    )
                    .join("")
                : `
                  <tr>
                    <td colspan="4">
                      دسته‌بندی‌ای وجود ندارد.
                    </td>
                  </tr>
                `
            }
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function openCategoryModal(category = {}) {
  openModal(
    category.id
      ? "ویرایش دسته‌بندی"
      : "دسته‌بندی جدید",

    `
      <form id="categoryForm">

        <input
          type="hidden"
          name="id"
          value="${escapeHtml(
            category.id || ""
          )}"
        >

        <label>
          نام
          <input
            name="name"
            value="${escapeHtml(
              category.name || ""
            )}"
            required
          >
        </label>

        <label>
          Slug
          <input
            name="slug"
            value="${escapeHtml(
              category.slug ||
              category.id ||
              ""
            )}"
            required
          >
        </label>

        <label class="checkbox-row">
          <input
            type="checkbox"
            name="active"
            ${
              category.active !== false
                ? "checked"
                : ""
            }
          >
          فعال
        </label>

        <button
          class="admin-button"
          type="submit"
        >
          ذخیره
        </button>

      </form>
    `
  );

  $("#categoryForm").onsubmit =
    saveCategory;
}

async function saveCategory(event) {
  event.preventDefault();

  const form =
    new FormData(event.target);

  const payload = {
    id: form.get("id"),
    name: form.get("name"),
    slug: form.get("slug"),
    active: form.get("active") === "on"
  };

  try {
    await apiFetch(
      "/api/categories",
      {
        method: "PUT",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    closeModal();

    await loadCategories();
    await navigate("categories");

    showToast(
      "دسته‌بندی ذخیره شد."
    );
  } catch (error) {
    showToast(
      error.message,
      "error"
    );
  }
}

function renderProductsPage() {
  $("#content").innerHTML = `
    <div class="page-head">
      <div>
        <h2>محصولات</h2>
        <p>مدیریت پلن‌ها و سرویس‌های فروشگاه</p>
      </div>

      <button
        class="admin-button"
        onclick="openProductModal()"
      >
        + محصول جدید
      </button>
    </div>

    <div class="admin-card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>محصول</th>
              <th>دسته</th>
              <th>پروتکل</th>
              <th>قیمت</th>
              <th>موجودی</th>
              <th>وضعیت</th>
              <th>عملیات</th>
            </tr>
          </thead>

          <tbody>
            ${
              state.products.length
                ? state.products
                    .map(
                      (product) => `
                        <tr>
                          <td>
                            <strong>
                              ${escapeHtml(
                                product.name
                              )}
                            </strong>
                          </td>

                          <td>
                            ${escapeHtml(
                              product.category ||
                              "-"
                            )}
                          </td>

                          <td>
                            ${escapeHtml(
                              product.protocol ||
                              "WireGuard"
                            )}
                          </td>

                          <td>
                            ${formatMoney(
                              product.price
                            )}
                          </td>

                                                    <td>
                            ${formatMoney(
                              product.stock
                            )}
                          </td>

                          <td>
                            ${statusBadge(
                              product.active === false
                                ? "inactive"
                                : "active"
                            )}
                          </td>

                          <td>
                            <button
                              class="admin-button small"
                              onclick='openProductModal(${JSON.stringify(
                                product
                              )})'
                            >
                              ویرایش
                            </button>
                          </td>
                        </tr>
                      `
                    )
                    .join("")
                : `
                  <tr>
                    <td colspan="7">
                      محصولی وجود ندارد.
                    </td>
                  </tr>
                `
            }
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function openProductModal(product = {}) {
  openModal(
    product.id
      ? "ویرایش محصول"
      : "محصول جدید",

    `
      <form id="productForm">

        <input
          type="hidden"
          name="id"
          value="${escapeHtml(
            product.id || ""
          )}"
        >

        <label>
          نام محصول
          <input
            name="name"
            value="${escapeHtml(
              product.name || ""
            )}"
            required
          >
        </label>

        <label>
          دسته‌بندی
          <input
            name="category"
            value="${escapeHtml(
              product.category ||
              "wireguard"
            )}"
          >
        </label>

        <label>
          پروتکل
          <input
            name="protocol"
            value="${escapeHtml(
              product.protocol ||
              "WireGuard"
            )}"
          >
        </label>

        <label>
          قیمت
          <input
            type="number"
            name="price"
            min="0"
            value="${Number(
              product.price || 0
            )}"
          >
        </label>

        <label>
          مدت
          <input
            name="duration"
            value="${escapeHtml(
              product.duration ||
              "30 روز"
            )}"
          >
        </label>

        <label>
          حجم
          <input
            name="volume"
            value="${escapeHtml(
              product.volume ||
              "نامحدود"
            )}"
          >
        </label>

        <label>
          سرور
          <input
            name="server"
            value="${escapeHtml(
              product.server ||
              "Auto"
            )}"
          >
        </label>

        <label>
          پینگ
          <input
            name="ping"
            value="${escapeHtml(
              product.ping ||
              "کم"
            )}"
          >
        </label>

        <label>
          موجودی
          <input
            type="number"
            name="stock"
            min="0"
            value="${Number(
              product.stock || 0
            )}"
          >
        </label>

        <label>
          توضیحات
          <textarea
            name="description"
            rows="4"
          >${escapeHtml(
            product.description || ""
          )}</textarea>
        </label>

        <label>
          امکانات
          <textarea
            name="features"
            rows="5"
            placeholder="هر امکان در یک خط"
          >${escapeHtml(
            Array.isArray(
              product.features
            )
              ? product.features.join("\n")
              : ""
          )}</textarea>
        </label>

        <label>
          تصویر
          <input
            name="image"
            value="${escapeHtml(
              product.image || ""
            )}"
          >
        </label>

        <label class="checkbox-row">
          <input
            type="checkbox"
            name="featured"
            ${
              product.featured
                ? "checked"
                : ""
            }
          >
          محصول ویژه
        </label>

        <label class="checkbox-row">
          <input
            type="checkbox"
            name="active"
            ${
              product.active !== false
                ? "checked"
                : ""
            }
          >
          فعال
        </label>

        <button
          class="admin-button"
          type="submit"
        >
          ذخیره محصول
        </button>

      </form>
    `
  );

  $("#productForm").onsubmit =
    saveProduct;
}

async function saveProduct(event) {
  event.preventDefault();

  const form =
    new FormData(event.target);

  const payload = {
    id: form.get("id"),
    name: form.get("name"),
    category: form.get("category"),
    protocol: form.get("protocol"),
    price: Number(
      form.get("price") || 0
    ),
    duration: form.get("duration"),
    volume: form.get("volume"),
    server: form.get("server"),
    ping: form.get("ping"),
    stock: Number(
      form.get("stock") || 0
    ),
    description:
      form.get("description") || "",
    features:
      String(
        form.get("features") || ""
      )
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
    image: form.get("image"),
    featured:
      form.get("featured") === "on",
    active:
      form.get("active") === "on"
  };

  try {
    await apiFetch(
      "/api/products",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    closeModal();

    await loadProducts();
    await navigate("products");

    showToast(
      "محصول ذخیره شد."
    );
  } catch (error) {
    showToast(
      error.message,
      "error"
    );
  }
}
async function renderOrdersPage() {
  await loadOrders();

  const orders = Array.isArray(state.orders)
    ? state.orders
    : [];

  $("#content").innerHTML = `
    <section class="admin-page">

      <div class="page-head">
        <div>
          <span class="page-kicker">
            مدیریت سفارش‌ها
          </span>

          <h2>
            سفارش‌ها
          </h2>

          <p>
            بررسی پرداخت، رسید، وضعیت سفارش و تحویل سرویس
          </p>
        </div>

        <div class="page-actions">
          <button
            class="admin-button secondary"
            onclick="loadOrders().then(() => navigate('orders'))"
          >
            بروزرسانی
          </button>
        </div>
      </div>

      <div class="admin-card">

        <div class="table-wrap">

          <table class="admin-table">

            <thead>
              <tr>
                <th>شناسه</th>
                <th>مشتری</th>
                <th>محصول</th>
                <th>مبلغ</th>
                <th>وضعیت</th>
                <th>تاریخ</th>
                <th>عملیات</th>
              </tr>
            </thead>

            <tbody>

              ${
                orders.length
                  ? orders
                      .map(
                        (order) => `
                          <tr>

                            <td>
                              <code>
                                ${escapeHtml(
                                  order.id ||
                                  "-"
                                )}
                              </code>
                            </td>

                            <td>
                              <strong>
                                ${escapeHtml(
                                  order.user?.phone ||
                                  order.phone ||
                                  "-"
                                )}
                              </strong>

                              ${
                                order.user?.name
                                  ? `
                                    <small>
                                      ${escapeHtml(
                                        order.user.name
                                      )}
                                    </small>
                                  `
                                  : ""
                              }
                            </td>

                            <td>
                              ${escapeHtml(
                                order.productName ||
                                order.product?.name ||
                                "-"
                              )}
                            </td>

                            <td>
                              ${formatMoney(
                                order.amount ||
                                order.price ||
                                0
                              )}
                            </td>

                            <td>
                              ${statusBadge(
                                order.status ||
                                "pending"
                              )}
                            </td>

                            <td>
                              ${formatDate(
                                order.createdAt
                              )}
                            </td>

                            <td>

                              <div class="table-actions">

                                <button
                                  class="admin-button small"
                                  onclick='openOrderModal(${JSON.stringify(
                                    order
                                  )})'
                                >
                                  مشاهده
                                </button>

                                ${
                                  order.receipt
                                    ? `
                                      <button
                                        class="admin-button small secondary"
                                        onclick="viewReceipt('${escapeHtml(
                                          order.id
                                        )}')"
                                      >
                                        رسید
                                      </button>
                                    `
                                    : ""
                                }

                              </div>

                            </td>

                          </tr>
                        `
                      )
                      .join("")
                  : `
                    <tr>
                      <td colspan="7">
                        سفارشی وجود ندارد.
                      </td>
                    </tr>
                  `
              }

            </tbody>

          </table>

        </div>

      </div>

    </section>
  `;
}

function openOrderModal(order = {}) {
  const status =
    order.status ||
    "pending";

  openModal(
    "جزئیات سفارش",

    `
      <div class="order-details">

        <div class="detail-grid">

          <div class="detail-item">
            <span>شناسه سفارش</span>
            <strong>
              ${escapeHtml(
                order.id ||
                "-"
              )}
            </strong>
          </div>

          <div class="detail-item">
            <span>وضعیت</span>
            <strong>
              ${statusBadge(
                status
              )}
            </strong>
          </div>

          <div class="detail-item">
            <span>شماره مشتری</span>
            <strong>
              ${escapeHtml(
                order.user?.phone ||
                order.phone ||
                "-"
              )}
            </strong>
          </div>

          <div class="detail-item">
            <span>محصول</span>
            <strong>
              ${escapeHtml(
                order.productName ||
                order.product?.name ||
                "-"
              )}
            </strong>
          </div>

          <div class="detail-item">
            <span>مبلغ</span>
            <strong>
              ${formatMoney(
                order.amount ||
                order.price ||
                0
              )}
            </strong>
          </div>

          <div class="detail-item">
            <span>تاریخ ثبت</span>
            <strong>
              ${formatDate(
                order.createdAt
              )}
            </strong>
          </div>

        </div>

        ${
          order.notes
            ? `
              <div class="detail-box">
                <span>یادداشت مشتری</span>
                <p>
                  ${escapeHtml(
                    order.notes
                  )}
                </p>
              </div>
            `
            : ""
        }

        <hr>

        <form id="orderStatusForm">

          <label>
            وضعیت سفارش

            <select name="status">

              <option
                value="pending"
                ${
                  status === "pending"
                    ? "selected"
                    : ""
                }
              >
                در انتظار بررسی
              </option>

              <option
                value="approved"
                ${
                  status === "approved"
                    ? "selected"
                    : ""
                }
              >
                تایید شده
              </option>

              <option
                value="rejected"
                ${
                  status === "rejected"
                    ? "selected"
                    : ""
                }
              >
                رد شده
              </option>

              <option
                value="delivered"
                ${
                  status === "delivered"
                    ? "selected"
                    : ""
                }
              >
                تحویل شده
              </option>

            </select>

          </label>

          <label>
            توضیح وضعیت

            <textarea
              name="statusNote"
              rows="3"
              placeholder="توضیح اختیاری برای سفارش"
            >${escapeHtml(
              order.statusNote ||
              ""
            )}</textarea>

          </label>

          <button
            type="submit"
            class="admin-button"
          >
            ذخیره وضعیت
          </button>

        </form>

        <hr>

        <form id="deliveryForm">

          <h3>
            تحویل سرویس
          </h3>

          <label>
            لینک اشتراک

            <input
              name="subscriptionUrl"
              value="${escapeHtml(
                order.subscriptionUrl ||
                ""
              )}"
              placeholder="https://..."
            >
          </label>

          <label>
            فایل کانفیگ WireGuard

            <textarea
              name="config"
              rows="8"
              placeholder="[Interface]&#10;PrivateKey = ...&#10;Address = ...&#10;&#10;[Peer]&#10;PublicKey = ..."
            >${escapeHtml(
              order.config ||
              ""
            )}</textarea>

          </label>

          <label>
            QR Code

            <input
              name="qrCode"
              value="${escapeHtml(
                order.qrCode ||
                ""
              )}"
              placeholder="لینک تصویر QR یا data URL"
            >
          </label>

          <label>
            توضیحات تحویل

            <textarea
              name="deliveryNote"
              rows="4"
              placeholder="توضیحات سرویس برای مشتری"
            >${escapeHtml(
              order.deliveryNote ||
              ""
            )}</textarea>

          </label>

          <button
            type="submit"
            class="admin-button"
          >
            ثبت و تحویل سرویس
          </button>

        </form>

      </div>
    `
  );

  $("#orderStatusForm").onsubmit =
    (event) =>
      updateOrderStatus(
        event,
        order.id
      );

  $("#deliveryForm").onsubmit =
    (event) =>
      deliverOrder(
        event,
        order.id
      );
}

async function updateOrderStatus(
  event,
  orderId
) {
  event.preventDefault();

  const form =
    new FormData(
      event.target
    );

  const payload = {
    status:
      form.get("status"),

    statusNote:
      form.get("statusNote") ||
      ""
  };

  try {
    await apiFetch(
      `/api/orders/${encodeURIComponent(
        orderId
      )}/status`,
      {
        method: "PUT",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(
            payload
          )
      }
    );

    closeModal();

    await loadOrders();
    await navigate("orders");

    showToast(
      "وضعیت سفارش ذخیره شد."
    );
  } catch (error) {
    showToast(
      error.message,
      "error"
    );
  }
}

async function deliverOrder(
  event,
  orderId
) {
  event.preventDefault();

  const form =
    new FormData(
      event.target
    );

  const payload = {
    subscriptionUrl:
      form.get(
        "subscriptionUrl"
      ) || "",

    config:
      form.get("config") ||
      "",

    qrCode:
      form.get("qrCode") ||
      "",

    deliveryNote:
      form.get(
        "deliveryNote"
      ) || ""
  };

  try {
    await apiFetch(
      `/api/orders/${encodeURIComponent(
        orderId
      )}/delivery`,
      {
        method: "PUT",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(
            payload
          )
      }
    );

    closeModal();

    await loadOrders();
    await navigate("orders");

    showToast(
      "سرویس با موفقیت تحویل شد."
    );
  } catch (error) {
    showToast(
      error.message,
      "error"
    );
  }
}

async function viewReceipt(
  orderId
) {
  try {
    const response =
      await fetch(
        `/api/orders/${encodeURIComponent(
          orderId
        )}/receipt`,
        {
          headers: {
            Authorization:
              `Bearer ${state.token}`
          }
        }
      );

    if (!response.ok) {
      throw new Error(
        "دریافت رسید انجام نشد."
      );
    }

    const blob =
      await response.blob();

    const url =
      URL.createObjectURL(
        blob
      );

    openModal(
      "رسید پرداخت",

      `
        <div class="receipt-preview">

          <img
            src="${url}"
            alt="رسید پرداخت"
          >

        </div>
      `
    );
  } catch (error) {
    showToast(
      error.message,
      "error"
    );
  }
}
async function renderCustomersPage() {
  await loadCustomers();

  const customers = Array.isArray(
    state.customers
  )
    ? state.customers
    : [];

  $("#content").innerHTML = `
    <section class="admin-page">

      <div class="page-head">
        <div>
          <span class="page-kicker">
            کاربران
          </span>

          <h2>
            مشتریان
          </h2>

          <p>
            مدیریت کاربران ثبت‌نام‌شده و اطلاعات حساب
          </p>
        </div>
      </div>

      <div class="admin-card">

        <div class="table-wrap">

          <table class="admin-table">

            <thead>
              <tr>
                <th>شماره</th>
                <th>نام</th>
                <th>تعداد سفارش</th>
                <th>موجودی</th>
                <th>تاریخ ثبت‌نام</th>
                <th>وضعیت</th>
              </tr>
            </thead>

            <tbody>

              ${
                customers.length
                  ? customers
                      .map(
                        (customer) => `
                          <tr>

                            <td>
                              ${escapeHtml(
                                customer.phone ||
                                "-"
                              )}
                            </td>

                            <td>
                              ${escapeHtml(
                                customer.name ||
                                "بدون نام"
                              )}
                            </td>

                            <td>
                              ${Number(
                                customer.orderCount ||
                                0
                              )}
                            </td>

                            <td>
                              ${formatMoney(
                                customer.balance ||
                                0
                              )}
                            </td>

                            <td>
                              ${formatDate(
                                customer.createdAt
                              )}
                            </td>

                            <td>
                              ${statusBadge(
                                customer.active === false
                                  ? "inactive"
                                  : "active"
                              )}
                            </td>

                          </tr>
                        `
                      )
                      .join("")
                  : `
                    <tr>
                      <td colspan="6">
                        کاربری وجود ندارد.
                      </td>
                    </tr>
                  `
              }

            </tbody>

          </table>

        </div>

      </div>

    </section>
  `;
}

async function renderServicesPage() {
  await loadServices();

  const services =
    Array.isArray(
      state.services
    )
      ? state.services
      : [];

  $("#content").innerHTML = `
    <section class="admin-page">

      <div class="page-head">

        <div>
          <span class="page-kicker">
            سرویس‌ها
          </span>

          <h2>
            سرویس‌های تحویل‌شده
          </h2>

          <p>
            مشاهده سرویس‌هایی که برای مشتریان ارسال شده‌اند
          </p>
        </div>

      </div>

      <div class="admin-card">

        <div class="table-wrap">

          <table class="admin-table">

            <thead>
              <tr>
                <th>مشتری</th>
                <th>محصول</th>
                <th>سرور</th>
                <th>شروع</th>
                <th>انقضا</th>
                <th>وضعیت</th>
              </tr>
            </thead>

            <tbody>

              ${
                services.length
                  ? services
                      .map(
                        (service) => `
                          <tr>

                            <td>
                              ${escapeHtml(
                                service.customerPhone ||
                                service.phone ||
                                service.user?.phone ||
                                "-"
                              )}
                            </td>

                            <td>
                              ${escapeHtml(
                                service.productName ||
                                "-"
                              )}
                            </td>

                            <td>
                              ${escapeHtml(
                                service.server ||
                                "Auto"
                              )}
                            </td>

                            <td>
                              ${formatDate(
                                service.startAt ||
                                service.createdAt
                              )}
                            </td>

                            <td>
                              ${formatDate(
                                service.expiresAt
                              )}
                            </td>

                            <td>
                              ${statusBadge(
                                service.status ||
                                "active"
                              )}
                            </td>

                          </tr>
                        `
                      )
                      .join("")
                  : `
                    <tr>
                      <td colspan="6">
                        سرویسی وجود ندارد.
                      </td>
                    </tr>
                  `
              }

            </tbody>

          </table>

        </div>

      </div>

    </section>
  `;
}

async function renderTicketsPage() {
  await loadTickets();

  const tickets =
    Array.isArray(
      state.tickets
    )
      ? state.tickets
      : [];

  $("#content").innerHTML = `
    <section class="admin-page">

      <div class="page-head">

        <div>
          <span class="page-kicker">
            پشتیبانی
          </span>

          <h2>
            تیکت‌ها
          </h2>

          <p>
            پیام‌ها و درخواست‌های پشتیبانی مشتریان
          </p>
        </div>

        <div class="page-actions">
          <button
            class="admin-button secondary"
            onclick="loadTickets().then(() => navigate('tickets'))"
          >
            بروزرسانی
          </button>
        </div>

      </div>

      <div class="admin-card">

        <div class="table-wrap">

          <table class="admin-table">

            <thead>
              <tr>
                <th>شناسه</th>
                <th>مشتری</th>
                <th>موضوع</th>
                <th>وضعیت</th>
                <th>تاریخ</th>
                <th>عملیات</th>
              </tr>
            </thead>

            <tbody>

              ${
                tickets.length
                  ? tickets
                      .map(
                        (ticket) => `
                          <tr>

                            <td>
                              <code>
                                ${escapeHtml(
                                  ticket.id ||
                                  "-"
                                )}
                              </code>
                            </td>

                            <td>
                              ${escapeHtml(
                                ticket.phone ||
                                ticket.user?.phone ||
                                "-"
                              )}
                            </td>

                            <td>
                              ${escapeHtml(
                                ticket.subject ||
                                "بدون موضوع"
                              )}
                            </td>

                            <td>
                              ${statusBadge(
                                ticket.status ||
                                "open"
                              )}
                            </td>

                            <td>
                              ${formatDate(
                                ticket.createdAt
                              )}
                            </td>

                            <td>

                              <button
                                class="admin-button small"
                                onclick='openTicketModal(${JSON.stringify(
                                  ticket
                                )})'
                              >
                                مشاهده
                              </button>

                            </td>

                          </tr>
                        `
                      )
                      .join("")
                  : `
                    <tr>
                      <td colspan="6">
                        تیکتی وجود ندارد.
                      </td>
                    </tr>
                  `
              }

            </tbody>

          </table>

        </div>

      </div>

    </section>
  `;
}

function openTicketModal(
  ticket = {}
) {
  const messages =
    Array.isArray(
      ticket.messages
    )
      ? ticket.messages
      : [];

  openModal(
    "جزئیات تیکت",

    `
      <div class="ticket-details">

        <div class="detail-grid">

          <div class="detail-item">
            <span>شناسه</span>
            <strong>
              ${escapeHtml(
                ticket.id ||
                "-"
              )}
            </strong>
          </div>

          <div class="detail-item">
            <span>مشتری</span>
            <strong>
              ${escapeHtml(
                ticket.phone ||
                ticket.user?.phone ||
                "-"
              )}
            </strong>
          </div>

          <div class="detail-item">
            <span>موضوع</span>
            <strong>
              ${escapeHtml(
                ticket.subject ||
                "-"
              )}
            </strong>
          </div>

          <div class="detail-item">
            <span>وضعیت</span>
            <strong>
              ${statusBadge(
                ticket.status ||
                "open"
              )}
            </strong>
          </div>

        </div>

        <div class="ticket-messages">

          ${
            messages.length
              ? messages
                  .map(
                    (message) => `
                      <div class="detail-box">

                        <strong>
                          ${escapeHtml(
                            message.sender ||
                            "user"
                          )}
                        </strong>

                        <p>
                          ${escapeHtml(
                            message.text ||
                            message.message ||
                            ""
                          )}
                        </p>

                        <small>
                          ${formatDate(
                            message.createdAt
                          )}
                        </small>

                      </div>
                    `
                  )
                  .join("")
              : `
                <div class="detail-box">
                  <p>
                    پیامی ثبت نشده است.
                  </p>
                </div>
              `
          }

        </div>

        <hr>

        <form id="ticketReplyForm">

          <label>
            پاسخ

            <textarea
              name="message"
              rows="5"
              required
              placeholder="پاسخ خود را بنویسید..."
            ></textarea>

          </label>

          <label>
            وضعیت

            <select name="status">

              <option
                value="open"
                ${
                  ticket.status === "open"
                    ? "selected"
                    : ""
                }
              >
                باز
              </option>

              <option
                value="pending"
                ${
                  ticket.status === "pending"
                    ? "selected"
                    : ""
                }
              >
                در انتظار
              </option>

              <option
                value="closed"
                ${
                  ticket.status === "closed"
                    ? "selected"
                    : ""
                }
              >
                بسته
              </option>

            </select>

          </label>

          <button
            type="submit"
            class="admin-button"
          >
            ارسال پاسخ
          </button>

        </form>

      </div>
    `
  );

  $("#ticketReplyForm").onsubmit =
    (event) =>
      replyToTicket(
        event,
        ticket.id
      );
}

async function replyToTicket(
  event,
  ticketId
) {
  event.preventDefault();

  const form =
    new FormData(
      event.target
    );

  const payload = {
    message:
      form.get("message") ||
      "",

    status:
      form.get("status") ||
      "open"
  };

  try {
    await apiFetch(
      `/api/tickets/${encodeURIComponent(
        ticketId
      )}`,
      {
        method: "PUT",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(
            payload
          )
      }
    );

    closeModal();

    await loadTickets();
    await navigate("tickets");

    showToast(
      "پاسخ تیکت ارسال شد."
    );
  } catch (error) {
    showToast(
      error.message,
      "error"
    );
  }
}
async function renderCouponsPage() {
  await loadCoupons();

  const coupons =
    Array.isArray(state.coupons)
      ? state.coupons
      : [];

  $("#content").innerHTML = `
    <section class="admin-page">

      <div class="page-head">

        <div>
          <span class="page-kicker">
            فروش
          </span>

          <h2>
            کدهای تخفیف
          </h2>

          <p>
            ساخت و مدیریت کدهای تخفیف برای مشتریان
          </p>
        </div>

        <div class="page-actions">

          <button
            class="admin-button"
            onclick="openCouponModal()"
          >
            + کد تخفیف جدید
          </button>

        </div>

      </div>

      <div class="admin-card">

        <div class="table-wrap">

          <table class="admin-table">

            <thead>
              <tr>
                <th>کد</th>
                <th>نوع</th>
                <th>مقدار</th>
                <th>استفاده</th>
                <th>حداکثر</th>
                <th>انقضا</th>
                <th>وضعیت</th>
                <th>عملیات</th>
              </tr>
            </thead>

            <tbody>

              ${
                coupons.length
                  ? coupons
                      .map(
                        (coupon) => `
                          <tr>

                            <td>
                              <strong>
                                ${escapeHtml(
                                  coupon.code ||
                                  "-"
                                )}
                              </strong>
                            </td>

                            <td>
                              ${coupon.type === "percent"
                                ? "درصدی"
                                : "مبلغ ثابت"}
                            </td>

                            <td>
                              ${
                                coupon.type ===
                                "percent"
                                  ? `${Number(
                                      coupon.value ||
                                      0
                                    )}%`
                                  : formatMoney(
                                      coupon.value ||
                                      0
                                    )
                              }
                            </td>

                            <td>
                              ${Number(
                                coupon.usedCount ||
                                0
                              )}
                            </td>

                            <td>
                              ${
                                coupon.maxUses
                                  ? Number(
                                      coupon.maxUses
                                    )
                                  : "نامحدود"
                              }
                            </td>

                            <td>
                              ${
                                coupon.expiresAt
                                  ? formatDate(
                                      coupon.expiresAt
                                    )
                                  : "بدون انقضا"
                              }
                            </td>

                            <td>
                              ${statusBadge(
                                coupon.active === false
                                  ? "inactive"
                                  : "active"
                              )}
                            </td>

                            <td>

                              <div class="table-actions">

                                <button
                                  class="admin-button small"
                                  onclick='openCouponModal(${JSON.stringify(
                                    coupon
                                  )})'
                                >
                                  ویرایش
                                </button>

                                <button
                                  class="admin-button small danger"
                                  onclick="deleteCoupon('${escapeHtml(
                                    coupon.id
                                  )}')"
                                >
                                  حذف
                                </button>

                              </div>

                            </td>

                          </tr>
                        `
                      )
                      .join("")
                  : `
                    <tr>
                      <td colspan="8">
                        کد تخفیفی وجود ندارد.
                      </td>
                    </tr>
                  `
              }

            </tbody>

          </table>

        </div>

      </div>

    </section>
  `;
}

function openCouponModal(
  coupon = {}
) {
  openModal(
    coupon.id
      ? "ویرایش کد تخفیف"
      : "کد تخفیف جدید",

    `
      <form id="couponForm">

        <input
          type="hidden"
          name="id"
          value="${escapeHtml(
            coupon.id ||
            ""
          )}"
        >

        <label>
          کد تخفیف

          <input
            name="code"
            value="${escapeHtml(
              coupon.code ||
              ""
            )}"
            placeholder="WELCOME10"
            required
          >
        </label>

        <label>
          نوع تخفیف

          <select name="type">

            <option
              value="percent"
              ${
                coupon.type !== "fixed"
                  ? "selected"
                  : ""
              }
            >
              درصدی
            </option>

            <option
              value="fixed"
              ${
                coupon.type === "fixed"
                  ? "selected"
                  : ""
              }
            >
              مبلغ ثابت
            </option>

          </select>

        </label>

        <label>
          مقدار تخفیف

          <input
            type="number"
            name="value"
            min="0"
            step="0.01"
            value="${Number(
              coupon.value ||
              0
            )}"
            required
          >
        </label>

        <label>
          حداکثر تعداد استفاده

          <input
            type="number"
            name="maxUses"
            min="0"
            value="${Number(
              coupon.maxUses ||
              0
            )}"
            placeholder="0 = نامحدود"
          >
        </label>

        <label>
          حداقل مبلغ سفارش

          <input
            type="number"
            name="minOrder"
            min="0"
            value="${Number(
              coupon.minOrder ||
              0
            )}"
          >
        </label>

        <label>
          تاریخ انقضا

          <input
            type="datetime-local"
            name="expiresAt"
            value="${toDateTimeLocal(
              coupon.expiresAt
            )}"
          >
        </label>

        <label>
          توضیحات

          <textarea
            name="description"
            rows="3"
          >${escapeHtml(
            coupon.description ||
            ""
          )}</textarea>

        </label>

        <label class="checkbox-row">

          <input
            type="checkbox"
            name="active"
            ${
              coupon.active !== false
                ? "checked"
                : ""
            }
          >

          فعال

        </label>

        <button
          type="submit"
          class="admin-button"
        >
          ذخیره کد تخفیف
        </button>

      </form>
    `
  );

  $("#couponForm").onsubmit =
    saveCoupon;
}

function toDateTimeLocal(
  value
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  const pad =
    (number) =>
      String(number)
        .padStart(2, "0");

  return (
    `${date.getFullYear()}-` +
    `${pad(
      date.getMonth() + 1
    )}-` +
    `${pad(
      date.getDate()
    )}T` +
    `${pad(
      date.getHours()
    )}:` +
    `${pad(
      date.getMinutes()
    )}`
  );
}

async function saveCoupon(
  event
) {
  event.preventDefault();

  const form =
    new FormData(
      event.target
    );

  const code =
    String(
      form.get("code") ||
      ""
    )
      .trim()
      .toUpperCase();

  const type =
    form.get("type") ||
    "percent";

  const value =
    Number(
      form.get("value") ||
      0
    );

  const maxUses =
    Number(
      form.get("maxUses") ||
      0
    );

  const minOrder =
    Number(
      form.get("minOrder") ||
      0
    );

  const expiresAt =
    form.get(
      "expiresAt"
    ) || "";

  const payload = {
    id:
      form.get("id") ||
      "",

    code,

    type,

    value,

    maxUses,

    minOrder,

    expiresAt:
      expiresAt
        ? new Date(
            expiresAt
          ).toISOString()
        : null,

    description:
      form.get(
        "description"
      ) || "",

    active:
      form.get("active") ===
      "on"
  };

  if (!code) {
    showToast(
      "کد تخفیف را وارد کنید.",
      "error"
    );
    return;
  }

  if (value <= 0) {
    showToast(
      "مقدار تخفیف باید بیشتر از صفر باشد.",
      "error"
    );
    return;
  }

  if (
    type === "percent" &&
    value > 100
  ) {
    showToast(
      "تخفیف درصدی نمی‌تواند بیشتر از 100 باشد.",
      "error"
    );
    return;
  }

  try {
    await apiFetch(
      "/api/coupons",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(
            payload
          )
      }
    );

    closeModal();

    await loadCoupons();

    await navigate(
      "coupons"
    );

    showToast(
      "کد تخفیف ذخیره شد."
    );
  } catch (error) {
    showToast(
      error.message,
      "error"
    );
  }
}

async function deleteCoupon(
  couponId
) {
  if (
    !window.confirm(
      "آیا از حذف این کد تخفیف مطمئن هستید؟"
    )
  ) {
    return;
  }

  try {
    await apiFetch(
      `/api/coupons/${encodeURIComponent(
        couponId
      )}`,
      {
        method: "DELETE"
      }
    );

    await loadCoupons();

    await navigate(
      "coupons"
    );

    showToast(
      "کد تخفیف حذف شد."
    );
  } catch (error) {
    showToast(
      error.message,
      "error"
    );
  }
}
async function renderFlashSalePage() {
  await loadFlashSale();

  const sale =
    state.flashSale || {};

  $("#content").innerHTML = `
    <section class="admin-page">

      <div class="page-head">

        <div>
          <span class="page-kicker">
            فروش ویژه
          </span>

          <h2>
            Flash Sale
          </h2>

          <p>
            مدیریت فروش محدود و تخفیف ویژه محصولات
          </p>
        </div>

      </div>

      <div class="admin-card">

        <form id="flashSaleForm">

          <label class="checkbox-row">
            <input
              type="checkbox"
              name="active"
              ${
                sale.active
                  ? "checked"
                  : ""
              }
            >
            فروش ویژه فعال باشد
          </label>

          <label>
            عنوان

            <input
              name="title"
              value="${escapeHtml(
                sale.title ||
                "فروش ویژه"
              )}"
            >
          </label>

          <label>
            توضیحات

            <textarea
              name="description"
              rows="4"
            >${escapeHtml(
              sale.description ||
              ""
            )}</textarea>
          </label>

          <label>
            درصد تخفیف

            <input
              type="number"
              name="discount"
              min="0"
              max="100"
              value="${Number(
                sale.discount ||
                0
              )}"
            >
          </label>

          <label>
            شروع

            <input
              type="datetime-local"
              name="startsAt"
              value="${toDateTimeLocal(
                sale.startsAt
              )}"
            >
          </label>

          <label>
            پایان

            <input
              type="datetime-local"
              name="endsAt"
              value="${toDateTimeLocal(
                sale.endsAt
              )}"
            >
          </label>

          <label>
            محصولات

            <textarea
              name="productIds"
              rows="5"
              placeholder="هر شناسه محصول در یک خط"
            >${escapeHtml(
              Array.isArray(
                sale.productIds
              )
                ? sale.productIds.join(
                    "\n"
                  )
                : ""
            )}</textarea>
          </label>

          <button
            class="admin-button"
            type="submit"
          >
            ذخیره فروش ویژه
          </button>

        </form>

      </div>

    </section>
  `;

  $("#flashSaleForm").onsubmit =
    saveFlashSale;
}

async function saveFlashSale(
  event
) {
  event.preventDefault();

  const form =
    new FormData(
      event.target
    );

  const productIds =
    String(
      form.get(
        "productIds"
      ) || ""
    )
      .split("\n")
      .map(
        (id) => id.trim()
      )
      .filter(Boolean);

  const payload = {
    active:
      form.get("active") ===
      "on",

    title:
      form.get("title") ||
      "فروش ویژه",

    description:
      form.get(
        "description"
      ) || "",

    discount:
      Number(
        form.get(
          "discount"
        ) || 0
      ),

    startsAt:
      form.get(
        "startsAt"
      )
        ? new Date(
            form.get(
              "startsAt"
            )
          ).toISOString()
        : null,

    endsAt:
      form.get(
        "endsAt"
      )
        ? new Date(
            form.get(
              "endsAt"
            )
          ).toISOString()
        : null,

    productIds
  };

  if (
    payload.discount < 0 ||
    payload.discount > 100
  ) {
    showToast(
      "درصد تخفیف باید بین 0 تا 100 باشد.",
      "error"
    );
    return;
  }

  try {
    await apiFetch(
      "/api/flash-sale",
      {
        method: "PUT",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(
            payload
          )
      }
    );

    await loadFlashSale();

    await navigate(
      "flash-sale"
    );

    showToast(
      "فروش ویژه ذخیره شد."
    );
  } catch (error) {
    showToast(
      error.message,
      "error"
    );
  }
}
async function renderWheelPage() {
  await loadWheel();

  const wheel =
    state.wheel || {};

  const prizes =
    Array.isArray(
      wheel.prizes
    )
      ? wheel.prizes
      : [];

  $("#content").innerHTML = `
    <section class="admin-page">

      <div class="page-head">

        <div>
          <span class="page-kicker">
            جایزه
          </span>

          <h2>
            گردونه شانس
          </h2>

          <p>
            مدیریت گردونه، جوایز و شانس دریافت جایزه
          </p>
        </div>

      </div>

      <div class="admin-card">

        <form id="wheelSettingsForm">

          <label class="checkbox-row">

            <input
              type="checkbox"
              name="active"
              ${
                wheel.active
                  ? "checked"
                  : ""
              }
            >

            گردونه فعال باشد

          </label>

          <label>
            عنوان

            <input
              name="title"
              value="${escapeHtml(
                wheel.title ||
                "گردونه شانس"
              )}"
            >
          </label>

          <label>
            توضیحات

            <textarea
              name="description"
              rows="4"
            >${escapeHtml(
              wheel.description ||
              ""
            )}</textarea>

          </label>

          <label>
            تعداد چرخش مجاز روزانه

            <input
              type="number"
              name="dailyLimit"
              min="0"
              value="${Number(
                wheel.dailyLimit ||
                1
              )}"
            >
          </label>

          <button
            class="admin-button"
            type="submit"
          >
            ذخیره تنظیمات گردونه
          </button>

        </form>

      </div>

      <div class="admin-card">

        <div class="page-head compact">

          <div>
            <h3>
              جوایز گردونه
            </h3>

            <p>
              وزن بیشتر یعنی احتمال بیشتر برای انتخاب
            </p>
          </div>

          <button
            class="admin-button"
            onclick="openWheelPrizeModal()"
          >
            + جایزه جدید
          </button>

        </div>

        <div class="table-wrap">

          <table class="admin-table">

            <thead>
              <tr>
                <th>عنوان</th>
                <th>نوع</th>
                <th>مقدار</th>
                <th>وزن</th>
                <th>وضعیت</th>
                <th>عملیات</th>
              </tr>
            </thead>

            <tbody>

              ${
                prizes.length
                  ? prizes
                      .map(
                        (prize) => `
                          <tr>

                            <td>
                              ${escapeHtml(
                                prize.title ||
                                "-"
                              )}
                            </td>

                            <td>
                              ${escapeHtml(
                                prize.type ||
                                "-"
                              )}
                            </td>

                            <td>
                              ${escapeHtml(
                                String(
                                  prize.value ??
                                  "-"
                                )
                              )}
                            </td>

                            <td>
                              ${Number(
                                prize.weight ||
                                0
                              )}
                            </td>

                            <td>
                              ${statusBadge(
                                prize.active === false
                                  ? "inactive"
                                  : "active"
                              )}
                            </td>

                            <td>

                              <button
                                class="admin-button small"
                                onclick='openWheelPrizeModal(${JSON.stringify(
                                  prize
                                )})'
                              >
                                ویرایش
                              </button>

                            </td>

                          </tr>
                        `
                      )
                      .join("")
                  : `
                    <tr>
                      <td colspan="6">
                        جایزه‌ای ثبت نشده است.
                      </td>
                    </tr>
                  `
              }

            </tbody>

          </table>

        </div>

      </div>

    </section>
  `;

  $("#wheelSettingsForm").onsubmit =
    saveWheelSettings;
}

async function saveWheelSettings(
  event
) {
  event.preventDefault();

  const form =
    new FormData(
      event.target
    );

  const payload = {
    active:
      form.get("active") ===
      "on",

    title:
      form.get("title") ||
      "گردونه شانس",

    description:
      form.get(
        "description"
      ) || "",

    dailyLimit:
      Number(
        form.get(
          "dailyLimit"
        ) || 1
      ),

    prizes:
      Array.isArray(
        state.wheel?.prizes
      )
        ? state.wheel.prizes
        : []
  };

  try {
    await apiFetch(
      "/api/wheel",
      {
        method: "PUT",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(
            payload
          )
      }
    );

    await loadWheel();

    await navigate(
      "wheel"
    );

    showToast(
      "تنظیمات گردونه ذخیره شد."
    );
  } catch (error) {
    showToast(
      error.message,
      "error"
    );
  }
}

function openWheelPrizeModal(
  prize = {}
) {
  openModal(
    prize.id
      ? "ویرایش جایزه"
      : "جایزه جدید",

    `
      <form id="wheelPrizeForm">

        <input
          type="hidden"
          name="id"
          value="${escapeHtml(
            prize.id ||
            ""
          )}"
        >

        <label>
          عنوان جایزه

          <input
            name="title"
            value="${escapeHtml(
              prize.title ||
              ""
            )}"
            required
          >
        </label>

        <label>
          نوع

          <select name="type">

            <option
              value="percent"
              ${
                prize.type ===
                "percent"
                  ? "selected"
                  : ""
              }
            >
              درصد تخفیف
            </option>

            <option
              value="fixed"
              ${
                prize.type ===
                "fixed"
                  ? "selected"
                  : ""
              }
            >
              مبلغ ثابت
            </option>

            <option
              value="coupon"
              ${
                prize.type ===
                "coupon"
                  ? "selected"
                  : ""
              }
            >
              کد تخفیف
            </option>

            <option
              value="nothing"
              ${
                prize.type ===
                "nothing"
                  ? "selected"
                  : ""
              }
            >
              بدون جایزه
            </option>

          </select>

        </label>

        <label>
          مقدار

          <input
            name="value"
            value="${escapeHtml(
              String(
                prize.value ??
                ""
              )
            )}"
          >
        </label>

        <label>
          وزن

          <input
            type="number"
            name="weight"
            min="0"
            value="${Number(
              prize.weight ||
              1
            )}"
          >
        </label>

        <label class="checkbox-row">

          <input
            type="checkbox"
            name="active"
            ${
              prize.active !== false
                ? "checked"
                : ""
            }
          >

          فعال

        </label>

        <button
          type="submit"
          class="admin-button"
        >
          ذخیره جایزه
        </button>

      </form>
    `
  );

  $("#wheelPrizeForm").onsubmit =
    saveWheelPrize;
}

async function saveWheelPrize(
  event
) {
  event.preventDefault();

  const form =
    new FormData(
      event.target
    );

  const prize = {
    id:
      form.get("id") ||
      makeClientId(),

    title:
      form.get("title") ||
      "",

    type:
      form.get("type") ||
      "nothing",

    value:
      form.get("value") ||
      "",

    weight:
      Number(
        form.get("weight") ||
        1
      ),

    active:
      form.get("active") ===
      "on"
  };

  const prizes =
    Array.isArray(
      state.wheel?.prizes
    )
      ? [
          ...state.wheel.prizes
        ]
      : [];

  const index =
    prizes.findIndex(
      (item) =>
        item.id ===
        prize.id
    );

  if (index >= 0) {
    prizes[index] =
      prize;
  } else {
    prizes.push(
      prize
    );
  }

  try {
    await apiFetch(
      "/api/wheel",
      {
        method: "PUT",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({
            ...(state.wheel ||
              {}),
            prizes
          })
      }
    );

    closeModal();

    await loadWheel();

    await navigate(
      "wheel"
    );

    showToast(
      "جایزه ذخیره شد."
    );
  } catch (error) {
    showToast(
      error.message,
      "error"
    );
  }
}

function makeClientId() {
  return (
    "id_" +
    Date.now() +
    "_" +
    Math.random()
      .toString(36)
      .slice(2, 8)
  );
}
async function renderServersPage() {
  await loadServers();

  const servers =
    Array.isArray(
      state.servers
    )
      ? state.servers
      : [];

  $("#content").innerHTML = `
    <section class="admin-page">

      <div class="page-head">

        <div>
          <span class="page-kicker">
            زیرساخت
          </span>

          <h2>
            سرورها
          </h2>

          <p>
            مدیریت سرورهای WireGuard و مشخصات اتصال
          </p>
        </div>

        <button
          class="admin-button"
          onclick="openServerModal()"
        >
          + سرور جدید
        </button>

      </div>

      <div class="admin-card">

        <div class="table-wrap">

          <table class="admin-table">

            <thead>
              <tr>
                <th>نام</th>
                <th>کشور</th>
                <th>IP</th>
                <th>پورت</th>
                <th>ظرفیت</th>
                <th>وضعیت</th>
                <th>عملیات</th>
              </tr>
            </thead>

            <tbody>

              ${
                servers.length
                  ? servers
                      .map(
                        (server) => `
                          <tr>

                            <td>
                              ${escapeHtml(
                                server.name ||
                                "-"
                              )}
                            </td>

                            <td>
                              ${escapeHtml(
                                server.country ||
                                "-"
                              )}
                            </td>

                            <td>
                              <code>
                                ${escapeHtml(
                                  server.host ||
                                  server.ip ||
                                  "-"
                                )}
                              </code>
                            </td>

                            <td>
                              ${escapeHtml(
                                String(
                                  server.port ||
                                  "-"
                                )
                              )}
                            </td>

                            <td>
                              ${Number(
                                server.capacity ||
                                0
                              )}
                            </td>

                            <td>
                              ${statusBadge(
                                server.active === false
                                  ? "inactive"
                                  : "active"
                              )}
                            </td>

                            <td>

                              <button
                                class="admin-button small"
                                onclick='openServerModal(${JSON.stringify(
                                  server
                                )})'
                              >
                                ویرایش
                              </button>

                            </td>

                          </tr>
                        `
                      )
                      .join("")
                  : `
                    <tr>
                      <td colspan="7">
                        سروری ثبت نشده است.
                      </td>
                    </tr>
                  `
              }

            </tbody>

          </table>

        </div>

      </div>

    </section>
  `;
}

function openServerModal(
  server = {}
) {
  openModal(
    server.id
      ? "ویرایش سرور"
      : "سرور جدید",

    `
      <form id="serverForm">

        <input
          type="hidden"
          name="id"
          value="${escapeHtml(
            server.id ||
            ""
          )}"
        >

        <label>
          نام سرور

          <input
            name="name"
            value="${escapeHtml(
              server.name ||
              ""
            )}"
            required
          >
        </label>

        <label>
          کشور

          <input
            name="country"
            value="${escapeHtml(
              server.country ||
              ""
            )}"
          >
        </label>

        <label>
          Host / IP

          <input
            name="host"
            value="${escapeHtml(
              server.host ||
              server.ip ||
              ""
            )}"
            required
          >
        </label>

        <label>
          پورت

          <input
            type="number"
            name="port"
            min="1"
            max="65535"
            value="${Number(
              server.port ||
              51820
            )}"
          >
        </label>

        <label>
          ظرفیت

          <input
            type="number"
            name="capacity"
            min="0"
            value="${Number(
              server.capacity ||
              0
            )}"
          >
        </label>

        <label>
          توضیحات

          <textarea
            name="description"
            rows="4"
          >${escapeHtml(
            server.description ||
            ""
          )}</textarea>
        </label>

        <label class="checkbox-row">

          <input
            type="checkbox"
            name="active"
            ${
              server.active !== false
                ? "checked"
                : ""
            }
          >

          فعال

        </label>

        <button
          type="submit"
          class="admin-button"
        >
          ذخیره سرور
        </button>

      </form>
    `
  );

  $("#serverForm").onsubmit =
    saveServer;
}

async function saveServer(
  event
) {
  event.preventDefault();

  const form =
    new FormData(
      event.target
    );

  const payload = {
    id:
      form.get("id") ||
      "",

    name:
      form.get("name") ||
      "",

    country:
      form.get("country") ||
      "",

    host:
      form.get("host") ||
      "",

    port:
      Number(
        form.get("port") ||
        51820
      ),

    capacity:
      Number(
        form.get(
          "capacity"
        ) || 0
      ),

    description:
      form.get(
        "description"
      ) || "",

    active:
      form.get("active") ===
      "on"
  };

  try {
    await apiFetch(
      "/api/servers",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(
            payload
          )
      }
    );

    closeModal();

    await loadServers();

    await navigate(
      "servers"
    );

    showToast(
      "سرور ذخیره شد."
    );
  } catch (error) {
    showToast(
      error.message,
      "error"
    );
  }
}
async function renderTelegramPage() {
  const settings =
    state.settings || {};

  $("#content").innerHTML = `
    <section class="admin-page">

      <div class="page-head">

        <div>
          <span class="page-kicker">
            Telegram
          </span>

          <h2>
            تنظیمات ربات
          </h2>

          <p>
            اتصال ربات تلگرام به سیستم فروش
          </p>

        </div>

      </div>

      <div class="admin-card">

        <form id="telegramForm">

          <label>
            Bot Username

            <input
              name="telegramBot"
              value="${escapeHtml(
                settings.telegramBot ||
                ""
              )}"
              placeholder="@sami91928bot"
            >
          </label>

          <label>
            Support Username

            <input
              name="telegramSupport"
              value="${escapeHtml(
                settings.telegramSupport ||
                ""
              )}"
              placeholder="@saman_s87"
            >
          </label>

          <label>
            Channel Username

            <input
              name="telegramChannel"
              value="${escapeHtml(
                settings.telegramChannel ||
                ""
              )}"
              placeholder="@SamiWireGuard"
            >
          </label>

          <label>
            Bot Token

            <input
              type="password"
              name="telegramToken"
              autocomplete="new-password"
              placeholder="توکن ربات را وارد کنید"
            >

            <small>
              توکن در رابط عمومی سایت نمایش داده نمی‌شود.
            </small>
          </label>

          <label>
            Owner / Admin Numeric ID

            <input
              name="telegramOwnerId"
              value="${escapeHtml(
                settings.telegramOwnerId ||
                ""
              )}"
              inputmode="numeric"
              placeholder="123456789"
            >
          </label>

          <label class="checkbox-row">

            <input
              type="checkbox"
              name="telegramEnabled"
              ${
                settings.telegramEnabled
                  ? "checked"
                  : ""
              }
            >

            ربات فعال باشد

          </label>

          <button
            class="admin-button"
            type="submit"
          >
            ذخیره تنظیمات تلگرام
          </button>

        </form>

      </div>

      <div class="admin-card">

        <h3>
          وضعیت ربات
        </h3>

        <p>
          ${
            settings.telegramEnabled
              ? "ربات فعال است."
              : "ربات هنوز فعال نشده است."
          }
        </p>

      </div>

    </section>
  `;

  $("#telegramForm").onsubmit =
    saveTelegramSettings;
}

async function saveTelegramSettings(
  event
) {
  event.preventDefault();

  const form =
    new FormData(
      event.target
    );

  const payload = {
    telegramBot:
      form.get(
        "telegramBot"
      ) || "",

    telegramSupport:
      form.get(
        "telegramSupport"
      ) || "",

    telegramChannel:
      form.get(
        "telegramChannel"
      ) || "",

    telegramToken:
      form.get(
        "telegramToken"
      ) || "",

    telegramOwnerId:
      form.get(
        "telegramOwnerId"
      ) || "",

    telegramEnabled:
      form.get(
        "telegramEnabled"
      ) === "on"
  };

  try {
    await apiFetch(
      "/api/settings",
      {
        method: "PUT",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(
            payload
          )
      }
    );

    await loadSettings();

    await navigate(
      "telegram"
    );

    showToast(
      "تنظیمات تلگرام ذخیره شد."
    );
  } catch (error) {
    showToast(
      error.message,
      "error"
    );
  }
    }
async function renderNotificationsPage() {
  await loadNotifications();

  const notifications =
    Array.isArray(
      state.notifications
    )
      ? state.notifications
      : [];

  $("#content").innerHTML = `
    <section class="admin-page">

      <div class="page-head">

        <div>
          <span class="page-kicker">
            ارتباط
          </span>

          <h2>
            اعلان‌ها
          </h2>

          <p>
            ارسال اعلان برای کاربران
          </p>

        </div>

        <button
          class="admin-button"
          onclick="openNotificationModal()"
        >
          + اعلان جدید
        </button>

      </div>

      <div class="admin-card">

        <div class="table-wrap">

          <table class="admin-table">

            <thead>
              <tr>
                <th>عنوان</th>
                <th>پیام</th>
                <th>مخاطب</th>
                <th>تاریخ</th>
              </tr>
            </thead>

            <tbody>

              ${
                notifications.length
                  ? notifications
                      .map(
                        (notification) => `
                          <tr>

                            <td>
                              ${escapeHtml(
                                notification.title ||
                                "-"
                              )}
                            </td>

                            <td>
                              ${escapeHtml(
                                notification.message ||
                                ""
                              )}
                            </td>

                            <td>
                              ${escapeHtml(
                                notification.target ||
                                "all"
                              )}
                            </td>

                            <td>
                              ${formatDate(
                                notification.createdAt
                              )}
                            </td>

                          </tr>
                        `
                      )
                      .join("")
                  : `
                    <tr>
                      <td colspan="4">
                        اعلانی ثبت نشده است.
                      </td>
                    </tr>
                  `
              }

            </tbody>

          </table>

        </div>

      </div>

    </section>
  `;
}

function openNotificationModal() {
  openModal(
    "اعلان جدید",

    `
      <form id="notificationForm">

        <label>
          عنوان

          <input
            name="title"
            required
          >
        </label>

        <label>
          پیام

          <textarea
            name="message"
            rows="5"
            required
          ></textarea>
        </label>

        <label>
          مخاطب

          <select name="target">

            <option value="all">
              همه کاربران
            </option>

            <option value="customers">
              مشتریان
            </option>

            <option value="telegram">
              کاربران تلگرام
            </option>

          </select>

        </label>

        <button
          class="admin-button"
          type="submit"
        >
          ارسال اعلان
        </button>

      </form>
    `
  );

  $("#notificationForm").onsubmit =
    saveNotification;
}

async function saveNotification(
  event
) {
  event.preventDefault();

  const form =
    new FormData(
      event.target
    );

  const payload = {
    title:
      form.get("title") ||
      "",

    message:
      form.get(
        "message"
      ) || "",

    target:
      form.get("target") ||
      "all"
  };

  try {
    await apiFetch(
      "/api/notifications",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(
            payload
          )
      }
    );

    closeModal();

    await loadNotifications();

    await navigate(
      "notifications"
    );

    showToast(
      "اعلان ارسال شد."
    );
  } catch (error) {
    showToast(
      error.message,
      "error"
    );
  }
}
async function renderAnalyticsPage() {
  await loadAnalytics();

  const analytics =
    state.analytics || {};

  const revenue =
    Number(
      analytics.revenue ||
      0
    );

  const orders =
    Number(
      analytics.orders ||
      0
    );

  const users =
    Number(
      analytics.users ||
      0
    );

  const services =
    Number(
      analytics.services ||
      0
    );

  $("#content").innerHTML = `
    <section class="admin-page">

      <div class="page-head">

        <div>
          <span class="page-kicker">
            گزارش
          </span>

          <h2>
            آمار فروش
          </h2>

          <p>
            خلاصه عملکرد فروشگاه
          </p>

        </div>

      </div>

      <div class="stats-grid">

        <div class="stat-card">
          <span>
            درآمد
          </span>

          <strong>
            ${formatMoney(
              revenue
            )}
          </strong>
        </div>

        <div class="stat-card">
          <span>
            سفارش‌ها
          </span>

          <strong>
            ${orders}
          </strong>
        </div>

        <div class="stat-card">
          <span>
            کاربران
          </span>

          <strong>
            ${users}
          </strong>
        </div>

        <div class="stat-card">
          <span>
            سرویس‌ها
          </span>

          <strong>
            ${services}
          </strong>
        </div>

      </div>

      <div class="admin-card">

        <h3>
          گزارش خلاصه
        </h3>

        <p>
          اطلاعات این بخش از سفارش‌ها و کاربران سیستم محاسبه می‌شود.
        </p>

      </div>

    </section>
  `;
}
async function renderAuditPage() {
  await loadAudit();

  const audit =
    Array.isArray(
      state.audit
    )
      ? state.audit
      : [];

  $("#content").innerHTML = `
    <section class="admin-page">

      <div class="page-head">

        <div>
          <span class="page-kicker">
            امنیت
          </span>

          <h2>
            گزارش فعالیت‌ها
          </h2>

          <p>
            ثبت عملیات مهم انجام‌شده در پنل
          </p>

        </div>

      </div>

      <div class="admin-card">

        <div class="table-wrap">

          <table class="admin-table">

            <thead>
              <tr>
                <th>زمان</th>
                <th>کاربر</th>
                <th>عملیات</th>
                <th>جزئیات</th>
              </tr>
            </thead>

            <tbody>

              ${
                audit.length
                  ? audit
                      .map(
                        (item) => `
                          <tr>

                            <td>
                              ${formatDate(
                                item.createdAt
                              )}
                            </td>

                            <td>
                              ${escapeHtml(
                                item.actor ||
                                item.admin ||
                                "admin"
                              )}
                            </td>

                            <td>
                              ${escapeHtml(
                                item.action ||
                                "-"
                              )}
                            </td>

                            <td>
                              ${escapeHtml(
                                typeof item.details ===
                                  "string"
                                  ? item.details
                                  : JSON.stringify(
                                      item.details ||
                                      {}
                                    )
                              )}
                            </td>

                          </tr>
                        `
                      )
                      .join("")
                  : `
                    <tr>
                      <td colspan="4">
                        فعالیتی ثبت نشده است.
                      </td>
                    </tr>
                  `
              }

            </tbody>

          </table>

        </div>

      </div>

    </section>
  `;
}
async function renderSettingsPage() {
  await loadSettings();

  const settings =
    state.settings || {};

  $("#content").innerHTML = `
    <section class="admin-page">

      <div class="page-head">

        <div>
          <span class="page-kicker">
            تنظیمات
          </span>

          <h2>
            تنظیمات سایت
          </h2>

          <p>
            اطلاعات اصلی فروشگاه
          </p>

        </div>

      </div>

      <div class="admin-card">

        <form id="settingsForm">

          <label>
            نام سایت

            <input
              name="siteName"
              value="${escapeHtml(
                settings.siteName ||
                "Sami WireGuard"
              )}"
            >
          </label>

          <label>
            نام برند

            <input
              name="brandName"
              value="${escapeHtml(
                settings.brandName ||
                "SAMI / WIREGUARD"
              )}"
            >
          </label>

          <label>
            شماره کارت

            <input
              name="cardNumber"
              value="${escapeHtml(
                settings.cardNumber ||
                ""
              )}"
              inputmode="numeric"
            >
          </label>

          <label>
            نام صاحب کارت

            <input
              name="cardName"
              value="${escapeHtml(
                settings.cardName ||
                ""
              )}"
            >
          </label>

          <label>
            ارز

            <select name="currency">

              <option
                value="IRR"
                ${
                  settings.currency ===
                  "IRR"
                    ? "selected"
                    : ""
                }
              >
                تومان / ریال
              </option>

              <option
                value="USD"
                ${
                  settings.currency ===
                  "USD"
                    ? "selected"
                    : ""
                }
              >
                USD
              </option>

              <option
                value="EUR"
                ${
                  settings.currency ===
                  "EUR"
                    ? "selected"
                    : ""
                }
              >
                EUR
              </option>

            </select>

          </label>

          <label>
            زبان پیش‌فرض

            <select name="language">

              <option
                value="fa"
                ${
                  settings.language !==
                  "en"
                    ? "selected"
                    : ""
                }
              >
                فارسی
              </option>

              <option
                value="en"
                ${
                  settings.language ===
                  "en"
                    ? "selected"
                    : ""
                }
              >
                English
              </option>

            </select>

          </label>

          <button
            class="admin-button"
            type="submit"
          >
            ذخیره تنظیمات
          </button>

        </form>

      </div>

    </section>
  `;

  $("#settingsForm").onsubmit =
    saveSettings;
}

async function saveSettings(
  event
) {
  event.preventDefault();

  const form =
    new FormData(
      event.target
    );

  const payload = {
    siteName:
      form.get(
        "siteName"
      ) || "",

    brandName:
      form.get(
        "brandName"
      ) || "",

    cardNumber:
      form.get(
        "cardNumber"
      ) || "",

    cardName:
      form.get(
        "cardName"
      ) || "",

    currency:
      form.get(
        "currency"
      ) || "IRR",

    language:
      form.get(
        "language"
      ) || "fa"
  };

  try {
    await apiFetch(
      "/api/settings",
      {
        method: "PUT",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(
            payload
          )
      }
    );

    await loadSettings();

    await navigate(
      "settings"
    );

    showToast(
      "تنظیمات ذخیره شد."
    );
  } catch (error) {
    showToast(
      error.message,
      "error"
    );
  }
}
async function renderBackupPage() {
  $("#content").innerHTML = `
    <section class="admin-page">

      <div class="page-head">

        <div>
          <span class="page-kicker">
            امنیت
          </span>

          <h2>
            Backup
          </h2>

          <p>
            دریافت نسخه پشتیبان از اطلاعات فروشگاه
          </p>

        </div>

      </div>

      <div class="admin-card">

        <h3>
          پشتیبان‌گیری
        </h3>

        <p>
          قبل از تغییرات مهم، از اطلاعات سیستم نسخه پشتیبان بگیرید.
        </p>

        <button
          class="admin-button"
          onclick="downloadBackup()"
        >
          دریافت Backup
        </button>

      </div>

    </section>
  `;
}

async function downloadBackup() {
  try {
    const response =
      await fetch(
        "/api/backup",
        {
          headers: {
            Authorization:
              `Bearer ${state.token}`
          }
        }
      );

    if (!response.ok) {
      throw new Error(
        "دریافت Backup انجام نشد."
      );
    }

    const blob =
      await response.blob();

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href =
      url;

    link.download =
      `sami-wireguard-backup-${Date.now()}.json`;

    document.body.appendChild(
      link
    );

    link.click();

    link.remove();

    URL.revokeObjectURL(
      url
    );

    showToast(
      "Backup آماده شد."
    );
  } catch (error) {
    showToast(
      error.message,
      "error"
    );
  }
}
async function navigate(
  page
) {
  state.page =
    page;

  const titles = {
    dashboard:
      "داشبورد",

    categories:
      "دسته‌بندی‌ها",

    products:
      "محصولات",

    orders:
      "سفارش‌ها",

    customers:
      "مشتریان",

    services:
      "سرویس‌ها",

    tickets:
      "تیکت‌ها",

    coupons:
      "کدهای تخفیف",

    "flash-sale":
      "Flash Sale",

    wheel:
      "گردونه شانس",

    servers:
      "سرورها",

    telegram:
      "Telegram Bot",

    notifications:
      "اعلان‌ها",

    analytics:
      "آمار",

    audit:
      "گزارش فعالیت",

    settings:
      "تنظیمات",

    backup:
      "Backup"
  };

  const title =
    titles[page] ||
    "داشبورد";

  $("#pageTitle").textContent =
    title;

  document
    .querySelectorAll(
      "#adminMenu button"
    )
    .forEach(
      (button) => {
        button.classList.toggle(
          "active",
          button.dataset.page ===
            page
        );
      }
    );

  try {
    switch (page) {

      case "dashboard":
        await renderDashboardPage();
        break;

      case "categories":
        await renderCategoriesPage();
        break;

      case "products":
        await renderProductsPage();
        break;

      case "orders":
        await renderOrdersPage();
        break;

      case "customers":
        await renderCustomersPage();
        break;

      case "services":
        await renderServicesPage();
        break;

      case "tickets":
        await renderTicketsPage();
        break;

      case "coupons":
        await renderCouponsPage();
        break;

      case "flash-sale":
        await renderFlashSalePage();
        break;

      case "wheel":
        await renderWheelPage();
        break;

      case "servers":
        await renderServersPage();
        break;

      case "telegram":
        await renderTelegramPage();
        break;

      case "notifications":
        await renderNotificationsPage();
        break;

      case "analytics":
        await renderAnalyticsPage();
        break;

      case "audit":
        await renderAuditPage();
        break;

      case "settings":
        await renderSettingsPage();
        break;

      case "backup":
        await renderBackupPage();
        break;

      default:
        await renderDashboardPage();
        break;
    }

  } catch (error) {

    console.error(
      error
    );

    showToast(
      error.message ||
      "خطا در بارگذاری صفحه",
      "error"
    );
  }
}
async function refreshCurrentPage() {
  await navigate(
    state.page ||
    "dashboard"
  );
}

function setupMobileSidebar() {
  const button =
    $("#mobileMenuButton");

  const sidebar =
    $("#adminSidebar");

  if (
    !button ||
    !sidebar
  ) {
    return;
  }

  button.onclick =
    () => {
      sidebar.classList.toggle(
        "open"
      );
    };

  document.addEventListener(
    "click",
    (event) => {

      if (
        window.innerWidth >
        900
      ) {
        return;
      }

      if (
        !sidebar.contains(
          event.target
        ) &&
        !button.contains(
          event.target
        )
      ) {
        sidebar.classList.remove(
          "open"
        );
      }

    }
  );
}
function setupAdminMenu() {
  document
    .querySelectorAll(
      "#adminMenu button[data-page]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          async () => {

            const page =
              button.dataset.page;

            const sidebar =
              $("#adminSidebar");

            if (
              sidebar &&
              window.innerWidth <=
                900
            ) {
              sidebar.classList.remove(
                "open"
              );
            }

            await navigate(
              page
            );
          }
        );

      }
    );
}
function openModal(
  title,
  content
) {
  const modal =
    $("#adminModal");

  if (!modal) {
    return;
  }

  $("#modalTitle")
    .textContent =
    title || "";

  $("#modalContent")
    .innerHTML =
    content || "";

  modal.classList.add(
    "open"
  );
}

function closeModal() {
  const modal =
    $("#adminModal");

  if (!modal) {
    return;
  }

  modal.classList.remove(
    "open"
  );

  $("#modalContent")
    .innerHTML =
    "";
}

function showToast(
  message,
  type = "success"
) {
  const toast =
    $("#adminToast");

  if (!toast) {
    return;
  }

  toast.textContent =
    message || "";

  toast.className =
    "admin-toast " +
    type;

  toast.classList.add(
    "show"
  );

  clearTimeout(
    showToast.timer
  );

  showToast.timer =
    setTimeout(
      () => {
        toast.classList.remove(
          "show"
        );
      },
      3500
    );
}
function logoutAdmin() {
  localStorage.removeItem(
    ADMIN_TOKEN_KEY
  );

  state.token =
    "";

  state.admin =
    null;

  window.location.href =
    "/admin";
}
function bindAdminEvents() {
  const modalClose =
    $("#modalClose");

  if (modalClose) {
    modalClose.onclick =
      closeModal;
  }

  const refreshButton =
    $("#refreshButton");

  if (refreshButton) {
    refreshButton.onclick =
      refreshCurrentPage;
  }

  const loginForm =
    $("#loginForm");

  if (loginForm) {
    loginForm.onsubmit =
      loginAdmin;
  }

  const modal =
    $("#adminModal");

  if (modal) {
    modal.addEventListener(
      "click",
      (event) => {

        if (
          event.target ===
          modal
        ) {
          closeModal();
        }

      }
    );
  }

  document.addEventListener(
    "keydown",
    (event) => {

      if (
        event.key ===
        "Escape"
      ) {
        closeModal();
      }

    }
  );
}
async function initAdmin() {
  try {

    const token =
      localStorage.getItem(
        ADMIN_TOKEN_KEY
      );

    if (!token) {

      showLoginScreen();

      return;
    }

    state.token =
      token;

    await loadAdminSession();

    showAdminApp();

    setupAdminMenu();

    setupMobileSidebar();

    bindAdminEvents();

    await loadAllData();

    await navigate(
      "dashboard"
    );

  } catch (error) {

    console.error(
      error
    );

    localStorage.removeItem(
      ADMIN_TOKEN_KEY
    );

    state.token =
      "";

    showLoginScreen();

    if (
      error.message
    ) {
      showToast(
        error.message,
        "error"
      );
    }
  }
}

function showLoginScreen() {
  const login =
    $("#loginScreen");

  const app =
    $("#adminApp");

  if (login) {
    login.style.display =
      "flex";
  }

  if (app) {
    app.style.display =
      "none";
  }
}

function showAdminApp() {
  const login =
    $("#loginScreen");

  const app =
    $("#adminApp");

  if (login) {
    login.style.display =
      "none";
  }

  if (app) {
    app.style.display =
      "flex";
  }
}

document.addEventListener(
  "DOMContentLoaded",
  initAdmin
);
window.navigate =
  navigate;

window.openModal =
  openModal;

window.closeModal =
  closeModal;

window.showToast =
  showToast;

window.openProductModal =
  openProductModal;

window.openOrderModal =
  openOrderModal;

window.openTicketModal =
  openTicketModal;

window.openCouponModal =
  openCouponModal;

window.deleteCoupon =
  deleteCoupon;

window.openWheelPrizeModal =
  openWheelPrizeModal;

window.openServerModal =
  openServerModal;

window.openNotificationModal =
  openNotificationModal;

window.viewReceipt =
  viewReceipt;

window.downloadBackup =
  downloadBackup;

window.logoutAdmin =
  logoutAdmin;

window.refreshCurrentPage =
  refreshCurrentPage;
