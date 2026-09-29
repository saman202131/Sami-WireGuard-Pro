/* =========================================================
   SAMI WIREGUARD — ADMIN PANEL
========================================================= */

const ADMIN_TOKEN_KEY = "sami_admin_token";

const state = {
  token: localStorage.getItem(ADMIN_TOKEN_KEY) || "",
  currentPage: "dashboard",
  products: [],
  orders: [],
  customers: [],
  services: [],
  settings: {},
  categories: [],
  currentProduct: null
};

/* =========================================================
   DOM
========================================================= */

const $ = (selector) => document.querySelector(selector);

const loginScreen = $("#loginScreen");
const adminApp = $("#adminApp");
const loginForm = $("#loginForm");
const loginUsername = $("#loginUsername");
const loginPassword = $("#loginPassword");
const loginButton = $("#loginButton");
const loginMessage = $("#loginMessage");

const content = $("#content");
const pageKicker = $("#pageKicker");
const pageTitle = $("#pageTitle");
const refreshButton = $("#refreshButton");
const mobileMenuButton = $("#mobileMenuButton");

const adminModal = $("#adminModal");
const modalContent = $("#modalContent");
const modalClose = $("#modalClose");

const adminToast = $("#adminToast");

/* =========================================================
   INIT
========================================================= */

document.addEventListener("DOMContentLoaded", initAdmin);

async function initAdmin() {
  bindEvents();

  if (!state.token) {
    showLogin();
    return;
  }

  const valid = await validateAdminSession();

  if (valid) {
    showAdmin();
    await loadInitialData();
  } else {
    showLogin();
  }
}

/* =========================================================
   EVENTS
========================================================= */

function bindEvents() {
  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
  }

  if (refreshButton) {
    refreshButton.addEventListener("click", () => {
      loadPage(state.currentPage, true);
    });
  }

  if (mobileMenuButton) {
    mobileMenuButton.addEventListener("click", toggleMobileMenu);
  }

  if (modalClose) {
    modalClose.addEventListener("click", closeModal);
  }

  if (adminModal) {
    const overlay = adminModal.querySelector(".admin-modal-overlay");

    if (overlay) {
      overlay.addEventListener("click", closeModal);
    }
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
      closeMobileMenu();
    }
  });

  bindMenu();
}

function bindMenu() {
  const menuItems = document.querySelectorAll("[data-page]");

  menuItems.forEach((item) => {
    item.addEventListener("click", () => {
      const page = item.dataset.page;

      if (!page) return;

      navigate(page);
      closeMobileMenu();
    });
  });
}

/* =========================================================
   AUTH
========================================================= */

async function handleLogin(event) {
  event.preventDefault();

  const username = loginUsername?.value.trim();
  const password = loginPassword?.value;

  if (!username || !password) {
    setLoginMessage("نام کاربری و رمز عبور را وارد کنید.");
    return;
  }

  setLoginLoading(true);

  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        password
      })
    });

    const data = await readJson(response);

    if (!response.ok) {
      throw new Error(data.message || "ورود ناموفق بود.");
    }

    if (!data.token) {
      throw new Error("توکن ورود دریافت نشد.");
    }

    state.token = data.token;
    localStorage.setItem(ADMIN_TOKEN_KEY, data.token);

    setLoginMessage("");

    showAdmin();

    await loadInitialData();

    toast("ورود موفق بود.", "success");
  } catch (error) {
    console.error(error);
    setLoginMessage(error.message || "خطا در ورود.");
  } finally {
    setLoginLoading(false);
  }
}

async function validateAdminSession() {
  try {
    const response = await apiFetch("/api/admin/me");

    if (response.status === 401 || response.status === 403) {
      clearAdminSession();
      return false;
    }

    return response.ok;
  } catch {
    /*
      اگر server فعلی endpoint /api/admin/me نداشت،
      وجود توکن را موقتاً معتبر در نظر می‌گیریم.
    */
    return Boolean(state.token);
  }
}

function logoutAdmin() {
  clearAdminSession();
  showLogin();
  toast("از پنل خارج شدید.");
}

function clearAdminSession() {
  state.token = "";
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

function showLogin() {
  if (loginScreen) {
    loginScreen.hidden = false;
    loginScreen.style.display = "";
  }

  if (adminApp) {
    adminApp.hidden = true;
  }
}

function showAdmin() {
  if (loginScreen) {
    loginScreen.hidden = true;
    loginScreen.style.display = "none";
  }

  if (adminApp) {
    adminApp.hidden = false;
  }
}

function setLoginLoading(loading) {
  if (!loginButton) return;

  loginButton.disabled = loading;

  loginButton.textContent = loading
    ? "در حال اتصال..."
    : "ورود به پنل";
}

function setLoginMessage(message) {
  if (loginMessage) {
    loginMessage.textContent = message || "";
  }
}

/* =========================================================
   API
========================================================= */

async function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});

  if (state.token) {
    headers.set("Authorization", `Bearer ${state.token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 401 || response.status === 403) {
    /*
      فقط در صورت endpointهای واقعی auth،
      session را منقضی می‌کنیم.
    */
    if (
      url.includes("/api/admin/") &&
      url !== "/api/admin/login"
    ) {
      clearAdminSession();
    }
  }

  return response;
}

async function readJson(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      message: text
    };
  }
}

async function apiJson(url, method = "GET", body = null) {
  const options = {
    method,
    headers: {
      "Content-Type": "application/json"
    }
  };

  if (body !== null) {
    options.body = JSON.stringify(body);
  }

  const response = await apiFetch(url, options);
  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(data.message || `خطای سرور: ${response.status}`);
  }

  return data;
}

/* =========================================================
   INITIAL DATA
========================================================= */

async function loadInitialData() {
  await Promise.allSettled([
    loadProducts(),
    loadOrders(),
    loadCustomers(),
    loadServices(),
    loadSettings(),
    loadCategories()
  ]);

  await loadPage("dashboard");
}

/* =========================================================
   NAVIGATION
========================================================= */

async function navigate(page) {
  state.currentPage = page;

  updateMenuState(page);
  updatePageHeader(page);

  await loadPage(page);
}

function updateMenuState(page) {
  document.querySelectorAll("[data-page]").forEach((item) => {
    item.classList.toggle(
      "active",
      item.dataset.page === page
    );
  });
}

function updatePageHeader(page) {
  const titles = {
    dashboard: ["COMMAND CENTER", "داشبورد"],
    categories: ["DATABASE // CATEGORIES", "دسته‌بندی‌ها"],
    products: ["LOADOUT // PRODUCTS", "محصولات"],
    orders: ["TRANSACTIONS // ORDERS", "سفارش‌ها"],
    customers: ["PLAYERS // CUSTOMERS", "مشتری‌ها"],
    services: ["DELIVERY // SERVICES", "سرویس‌ها"],
    tickets: ["SUPPORT // TICKETS", "تیکت‌ها"],
    coupons: ["PROMO // COUPONS", "کدهای تخفیف"],
    servers: ["NETWORK // SERVERS", "سرورها"],
    telegram: ["TELEGRAM // BOT", "تلگرام"],
    notifications: ["SYSTEM // NOTIFICATIONS", "اعلان‌ها"],
    analytics: ["INTEL // ANALYTICS", "آمار و تحلیل"],
    audit: ["SECURITY // AUDIT", "گزارش فعالیت"],
    backup: ["SYSTEM // BACKUP", "پشتیبان‌گیری"],
    settings: ["CORE // SETTINGS", "تنظیمات"]
  };

  const [kicker, title] =
    titles[page] || titles.dashboard;

  if (pageKicker) {
    pageKicker.textContent = kicker;
  }

  if (pageTitle) {
    pageTitle.textContent = title;
  }
}

async function loadPage(page, refreshing = false) {
  if (!content) return;

  if (refreshing) {
    showLoading();
  }

  try {
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
        await renderTicketsPage();
        break;

      case "coupons":
        await renderCouponsPage();
        break;

      case "servers":
        await renderServersPage();
        break;

      case "telegram":
        renderTelegramPage();
        break;

      case "notifications":
        await renderNotificationsPage();
        break;

      case "analytics":
        renderAnalyticsPage();
        break;

      case "audit":
        await renderAuditPage();
        break;

      case "backup":
        renderBackupPage();
        break;

      case "settings":
        renderSettingsPage();
        break;

      default:
        renderDashboard();
    }
  } catch (error) {
    console.error(error);

    content.innerHTML = `
      <div class="admin-panel">
        <div class="admin-empty">
          <div class="admin-empty-icon">!</div>
          <div class="admin-empty-title">
            خطا در بارگذاری
          </div>
          <div class="admin-empty-text">
            ${escapeHtml(error.message || "خطای ناشناخته")}
          </div>
        </div>
      </div>
    `;
  }
}

/* =========================================================
   PRODUCTS
========================================================= */

async function loadProducts() {
  try {
    const response = await apiFetch("/api/products");
    const data = await readJson(response);

    if (!response.ok) {
      throw new Error(data.message || "خطا در دریافت محصولات");
    }

    state.products = Array.isArray(data)
      ? data
      : Array.isArray(data.products)
        ? data.products
        : [];
  } catch (error) {
    console.error("Products:", error);
    state.products = [];
  }
}

function renderProductsPage() {
  content.innerHTML = `
    <div class="admin-page">

      <div class="admin-toolbar">
        <div class="admin-toolbar-left">
          <button
            class="admin-btn admin-btn-primary"
            onclick="openProductModal()"
          >
            + محصول جدید
          </button>
        </div>

        <div class="admin-toolbar-right">
          <button
            class="admin-btn"
            onclick="loadProductsAndRender()"
          >
            ↻ بروزرسانی
          </button>
        </div>
      </div>

      ${
        state.products.length
          ? `
            <div class="admin-product-grid">
              ${state.products.map(renderProductCard).join("")}
            </div>
          `
          : emptyState(
              "محصولی وجود ندارد",
              "اولین محصول فروشگاه را ایجاد کنید."
            )
      }

    </div>
  `;
}

async function loadProductsAndRender() {
  showLoading();

  await loadProducts();

  renderProductsPage();
}

function renderProductCard(product) {
  const active =
    product.active !== false &&
    product.isActive !== false;

  const stock =
    product.stock === undefined ||
    product.stock === null
      ? "نامحدود"
      : product.stock;

  return `
    <div class="admin-product-card">

      <div class="admin-product-top">
        <div>
          <div class="admin-product-name">
            ${escapeHtml(product.name || "بدون نام")}
          </div>

          <div class="admin-product-category">
            ${escapeHtml(
              product.category ||
              product.type ||
              "wireguard"
            )}
          </div>
        </div>

        <span class="status-badge ${
          active ? "green" : "red"
        }">
          ${active ? "فعال" : "غیرفعال"}
        </span>
      </div>

      <div class="admin-product-price">
        ${formatPrice(product.price)}
      </div>

      <div class="admin-product-stock">
        موجودی:
        ${escapeHtml(String(stock))}
      </div>

      <div class="admin-product-actions">
        <button
          class="admin-btn admin-btn-sm"
          onclick="openProductModal('${escapeAttr(product.id)}')"
        >
          ویرایش
        </button>

        <button
          class="admin-btn admin-btn-sm admin-btn-danger"
          onclick="deleteProduct('${escapeAttr(product.id)}')"
        >
          حذف
        </button>
      </div>

    </div>
  `;
}

function openProductModal(productId = null) {
  const product =
    productId
      ? state.products.find(
          (item) => String(item.id) === String(productId)
        )
      : null;

  state.currentProduct = product || null;

  openModal(
    product
      ? "ویرایش محصول"
      : "ایجاد محصول جدید",
    `
      <form id="productForm">

        <div class="admin-form-grid">

          <div class="admin-form-group">
            <label class="admin-form-label">
              نام محصول
            </label>

            <input
              class="admin-input"
              id="productName"
              required
              value="${escapeAttr(product?.name || "")}"
              placeholder="مثلاً WireGuard Gamer"
            >
          </div>

          <div class="admin-form-group">
            <label class="admin-form-label">
              دسته‌بندی
            </label>

            <select
              class="admin-select"
              id="productCategory"
            >
              <option value="wireguard"
                ${product?.category === "wireguard" ? "selected" : ""}>
                WireGuard
              </option>

              <option value="dns"
                ${product?.category === "dns" ? "selected" : ""}>
                DNS
              </option>

              <option value="v2ray"
                ${product?.category === "v2ray" ? "selected" : ""}>
                V2Ray
              </option>
            </select>
          </div>

          <div class="admin-form-group">
            <label class="admin-form-label">
              قیمت
            </label>

            <input
              class="admin-input"
              id="productPrice"
              type="number"
              min="0"
              required
              value="${escapeAttr(product?.price ?? "")}"
              placeholder="250000"
            >
          </div>

          <div class="admin-form-group">
            <label class="admin-form-label">
              موجودی
            </label>

            <input
              class="admin-input"
              id="productStock"
              type="number"
              min="0"
              value="${escapeAttr(product?.stock ?? "")}"
              placeholder="نامحدود = خالی"
            >
          </div>

          <div class="admin-form-group full">
            <label class="admin-form-label">
              توضیحات
            </label>

            <textarea
              class="admin-textarea"
              id="productDescription"
              placeholder="توضیحات محصول..."
            >${escapeHtml(product?.description || "")}</textarea>
          </div>

          <div class="admin-form-group">
            <label class="admin-form-label">
              مدت سرویس
            </label>

            <input
              class="admin-input"
              id="productDuration"
              value="${escapeAttr(product?.duration || "")}"
              placeholder="30 روز"
            >
          </div>

          <div class="admin-form-group">
            <label class="admin-form-label">
              وضعیت
            </label>

            <select
              class="admin-select"
              id="productActive"
            >
              <option value="true"
                ${product?.active !== false ? "selected" : ""}>
                فعال
              </option>

              <option value="false"
                ${product?.active === false ? "selected" : ""}>
                غیرفعال
              </option>
            </select>
          </div>

        </div>

        <div class="admin-form-actions">

          <button
            type="submit"
            class="admin-btn admin-btn-primary"
          >
            ${product ? "ذخیره تغییرات" : "ایجاد محصول"}
          </button>

          <button
            type="button"
            class="admin-btn"
            onclick="closeModal()"
          >
            انصراف
          </button>

        </div>

      </form>
    `
  );

  const form = $("#productForm");

  if (form) {
    form.addEventListener("submit", submitProduct);
  }
}

async function submitProduct(event) {
  event.preventDefault();

  const productId =
    state.currentProduct?.id || null;

  const body = {
    name: $("#productName")?.value.trim(),
    category: $("#productCategory")?.value,
    price: Number($("#productPrice")?.value || 0),
    description: $("#productDescription")?.value.trim(),
    duration: $("#productDuration")?.value.trim(),
    active: $("#productActive")?.value === "true"
  };

  const stockValue = $("#productStock")?.value;

  if (stockValue !== "") {
    body.stock = Number(stockValue);
  }

  if (!body.name) {
    toast("نام محصول الزامی است.", "error");
    return;
  }

  try {
    const url = productId
      ? `/api/products/${encodeURIComponent(productId)}`
      : "/api/products";

    const method = productId ? "PUT" : "POST";

    await apiJson(url, method, body);

    await loadProducts();

    closeModal();

    renderProductsPage();

    toast(
      productId
        ? "محصول بروزرسانی شد."
        : "محصول ایجاد شد.",
      "success"
    );
  } catch (error) {
    toast(error.message, "error");
  }
}

async function deleteProduct(productId) {
  const product = state.products.find(
    (item) => String(item.id) === String(productId)
  );

  const confirmed = confirm(
    `محصول «${product?.name || "بدون نام"}» حذف شود؟`
  );

  if (!confirmed) return;

  try {
    await apiJson(
      `/api/products/${encodeURIComponent(productId)}`,
      "DELETE"
    );

    await loadProducts();

    renderProductsPage();

    toast("محصول حذف شد.", "success");
  } catch (error) {
    toast(error.message, "error");
  }
}

/* =========================================================
   ORDERS
========================================================= */

async function loadOrders() {
  try {
    const response = await apiFetch("/api/orders");
    const data = await readJson(response);

    if (!response.ok) {
      throw new Error(data.message || "خطا در دریافت سفارش‌ها");
    }

    state.orders = Array.isArray(data)
      ? data
      : Array.isArray(data.orders)
        ? data.orders
        : [];
  } catch (error) {
    console.error("Orders:", error);
    state.orders = [];
  }
}

function renderOrdersPage() {
  content.innerHTML = `
    <div class="admin-page">

      <div class="admin-toolbar">
        <div class="admin-toolbar-left">
          <div class="status-badge blue">
            ${state.orders.length} سفارش
          </div>
        </div>

        <div class="admin-toolbar-right">
          <button
            class="admin-btn"
            onclick="loadOrdersAndRender()"
          >
            ↻ بروزرسانی
          </button>
        </div>
      </div>
