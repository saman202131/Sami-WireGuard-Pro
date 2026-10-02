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
