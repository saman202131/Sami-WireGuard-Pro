const ADMIN_TOKEN_KEY = "sami_admin_token";

const adminState = {
  token: localStorage.getItem(ADMIN_TOKEN_KEY) || "",
  currentPage: "dashboard",

  products: [],
  orders: [],
  customers: [],
  services: [],
  tickets: [],
  coupons: [],
  servers: [],
  notifications: [],

  settings: {},
  categories: [],

  currentProduct: null
};

document.addEventListener("DOMContentLoaded", initAdmin);

/* =========================================================
   INIT
   ========================================================= */

async function initAdmin() {
  bindAdminEvents();

  if (!adminState.token) {
    showLogin();
    return;
  }

  try {
    await apiFetch("/api/admin/me");

    showAdminApp();
    await loadInitialData();
    await navigateAdmin("dashboard");
  } catch (error) {
    console.error(error);

    adminLogout(false);
    showLogin();
  }
}

/* =========================================================
   EVENTS
   ========================================================= */

function bindAdminEvents() {
  const loginForm =
    document.getElementById("loginForm");

  if (loginForm) {
    loginForm.addEventListener(
      "submit",
      handleAdminLogin
    );
  }

  document
    .querySelectorAll("[data-page]")
    .forEach((item) => {
      item.addEventListener("click", () => {
        navigateAdmin(
          item.dataset.page
        );
      });
    });

  document
    .getElementById("refreshButton")
    ?.addEventListener(
      "click",
      async () => {
        await loadInitialData();
        await navigateAdmin(
          adminState.currentPage
        );

        showToast("اطلاعات بروزرسانی شد.");
      }
    );

  document
    .getElementById("mobileMenuButton")
    ?.addEventListener(
      "click",
      () => {
        document
          .getElementById("adminMenu")
          ?.classList.toggle(
            "mobile-open"
          );
      }
    );

  document
    .getElementById("modalClose")
    ?.addEventListener(
      "click",
      closeAdminModal
    );

  document
    .getElementById("adminModal")
    ?.addEventListener(
      "click",
      (event) => {
        if (
          event.target.id ===
          "adminModal"
        ) {
          closeAdminModal();
        }
      }
    );
}

/* =========================================================
   AUTH
   ========================================================= */

async function handleAdminLogin(event) {
  event.preventDefault();

  const username =
    document.getElementById(
      "loginUsername"
    )?.value
      ?.trim();

  const password =
    document.getElementById(
      "loginPassword"
    )?.value || "";

  const message =
    document.getElementById(
      "loginMessage"
    );

  if (!username || !password) {
    setMessage(
      message,
      "نام کاربری و رمز عبور را وارد کنید."
    );

    return;
  }

  setMessage(
    message,
    "در حال ورود..."
  );

  try {
    /*
      سرور فعلی /api/login دارد.
      اینجا عمداً همان endpoint استفاده شده.
    */

    const response =
      await fetch(
        "/api/login",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            username,
            password
          })
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.message ||
        "ورود ناموفق بود."
      );
    }

    if (!data.token) {
      throw new Error(
        "توکن مدیریت دریافت نشد."
      );
    }

    adminState.token =
      data.token;

    localStorage.setItem(
      ADMIN_TOKEN_KEY,
      data.token
    );

    setMessage(
      message,
      "ورود موفق بود."
    );

    showAdminApp();

    await loadInitialData();

    await navigateAdmin(
      "dashboard"
    );

  } catch (error) {
    console.error(error);

    setMessage(
      message,
      error.message ||
      "خطا در ورود."
    );
  }
}

function adminLogout(reload = true) {
  localStorage.removeItem(
    ADMIN_TOKEN_KEY
  );

  adminState.token = "";

  if (reload) {
    location.reload();
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
    adminState.token &&
    !headers.Authorization
  ) {
    headers.Authorization =
      `Bearer ${adminState.token}`;
  }

  const response =
    await fetch(
      url,
      {
        ...options,
        headers
      }
    );

  let data = {};

  try {
    data =
      await response.json();
  } catch {
    data = {};
  }

  if (response.status === 401) {
    adminLogout(false);
    showLogin();

    throw new Error(
      "نشست مدیریت منقضی شده است."
    );
  }

  if (!response.ok) {
    throw new Error(
      data.message ||
      data.error ||
      "خطا در درخواست."
    );
  }

  return data;
}

/* =========================================================
   SCREENS
   ========================================================= */

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

/* =========================================================
   INITIAL DATA
   ========================================================= */

async function loadInitialData() {
  const results =
    await Promise.allSettled([
      loadProducts(),
      loadOrders(),
      loadCustomers(),
      loadServices(),
      loadSettings(),
      loadCategories(),
      loadTickets(),
      loadCoupons(),
      loadServers(),
      loadNotifications()
    ]);

  results.forEach((result) => {
    if (
      result.status === "rejected"
    ) {
      console.warn(
        "Admin data load warning:",
        result.reason
      );
    }
  });
}

/* =========================================================
   NAVIGATION
   ========================================================= */

async function navigateAdmin(page) {
  adminState.currentPage =
    page || "dashboard";

  updateActiveMenu(
    adminState.currentPage
  );

  const content =
    document.getElementById(
      "content"
    );

  const title =
    document.getElementById(
      "pageTitle"
    );

  const kicker =
    document.getElementById(
      "pageKicker"
    );

  const pageInfo =
    getPageInfo(
      adminState.currentPage
    );

  if (title) {
    title.textContent =
      pageInfo.title;
  }

  if (kicker) {
    kicker.textContent =
      pageInfo.kicker;
  }

  if (!content) return;

  content.innerHTML =
    adminLoadingHTML();

  try {
    switch (
      adminState.currentPage
    ) {
      case "dashboard":
        await renderDashboard(content);
        break;

      case "categories":
        await renderCategoriesPage(content);
        break;

      case "products":
        await renderProductsPage(content);
        break;

      case "orders":
        await renderOrdersPage(content);
        break;

      case "customers":
        await renderCustomersPage(content);
        break;

      case "services":
        await renderServicesPage(content);
        break;

      case "tickets":
        await renderTicketsPage(content);
        break;

      case "coupons":
        await renderCouponsPage(content);
        break;

      case "servers":
        await renderServersPage(content);
        break;

      case "telegram":
        await renderTelegramPage(content);
        break;

      case "notifications":
        await renderNotificationsPage(content);
        break;

      case "analytics":
        await renderAnalyticsPage(content);
        break;

      case "audit":
        await renderAuditPage(content);
        break;

      case "backup":
        await renderBackupPage(content);
        break;

      case "settings":
        await renderSettingsPage(content);
        break;

      default:
        await renderDashboard(content);
    }

    closeMobileMenu();

  } catch (error) {
    console.error(error);

    content.innerHTML =
      emptyStateHTML(
        "خطا",
        error.message ||
        "خطایی رخ داد."
      );
  }
}

function getPageInfo(page) {
  const pages = {
    dashboard: {
      kicker: "CONTROL CENTER",
      title: "داشبورد"
    },

    categories: {
      kicker: "STORE",
      title: "دسته‌بندی‌ها"
    },

    products: {
      kicker: "STORE",
      title: "محصولات"
    },

    orders: {
      kicker: "SALES",
      title: "سفارش‌ها"
    },

    customers: {
      kicker: "USERS",
      title: "مشتریان"
    },

    services: {
      kicker: "SERVICES",
      title: "سرویس‌ها"
    },

    tickets: {
      kicker: "SUPPORT",
      title: "تیکت‌ها"
    },

    coupons: {
      kicker: "MARKETING",
      title: "کدهای تخفیف"
    },

    servers: {
      kicker: "INFRASTRUCTURE",
      title: "سرورها"
    },

    telegram: {
      kicker: "TELEGRAM",
      title: "تلگرام"
    },

    notifications: {
      kicker: "SYSTEM",
      title: "اعلان‌ها"
    },

    analytics: {
      kicker: "ANALYTICS",
      title: "آمار"
    },

    audit: {
      kicker: "SECURITY",
      title: "گزارش فعالیت"
    },

    backup: {
      kicker: "DATABASE",
      title: "پشتیبان‌گیری"
    },

    settings: {
      kicker: "CONFIGURATION",
      title: "تنظیمات"
    }
  };

  return (
    pages[page] ||
    pages.dashboard
  );
}

function updateActiveMenu(page) {
  document
    .querySelectorAll(
      "[data-page]"
    )
    .forEach((item) => {
      item.classList.toggle(
        "active",
        item.dataset.page === page
      );
    });
}

function closeMobileMenu() {
  document
    .getElementById("adminMenu")
    ?.classList.remove(
      "mobile-open"
    );
}

/* =========================================================
   PRODUCTS
   ========================================================= */

async function loadProducts() {
  const data =
    await apiFetch(
      "/api/products"
    );

  adminState.products =
    Array.isArray(data.products)
      ? data.products
      : Array.isArray(data)
        ? data
        : [];
}

async function renderProductsPage(
  content
) {
  await loadProducts();

  content.innerHTML = `
    <div class="admin-page-head">
      <div>
        <h2>مدیریت پلن‌ها</h2>
        <p>
          پلن‌هایی که اینجا اضافه می‌کنی
          مستقیماً در فروشگاه نمایش داده می‌شوند.
        </p>
      </div>

      <button
        class="admin-primary-button"
        onclick="openProductModal()"
      >
        + افزودن پلن
      </button>
    </div>

    <div class="admin-table-wrap">

      <table class="admin-table">

        <thead>
          <tr>
            <th>محصول</th>
            <th>دسته</th>
            <th>قیمت</th>
            <th>مدت</th>
            <th>حجم</th>
            <th>موجودی</th>
            <th>وضعیت</th>
            <th>عملیات</th>
          </tr>
        </thead>

        <tbody>

          ${
            adminState.products.length
              ? adminState.products
                  .map(
                    renderProductRow
                  )
                  .join("")
              : `
                <tr>
                  <td
                    colspan="8"
                    class="admin-empty-cell"
                  >
                    هنوز محصولی ثبت نشده است.
                  </td>
                </tr>
              `
          }

        </tbody>

      </table>

    </div>
  `;
}

function renderProductRow(product) {
  return `
    <tr>

      <td>
        <strong>
          ${escapeHtml(
            product.name ||
            "-"
          )}
        </strong>
      </td>

      <td>
        ${escapeHtml(
          categoryLabel(
            product.category
          )
        )}
      </td>

      <td>
        ${formatPrice(
          product.price
        )}
        تومان
      </td>

      <td>
        ${escapeHtml(
          formatDuration(
            product.duration
          )
        )}
      </td>

      <td>
        ${escapeHtml(
          String(
            product.volume ||
            "نامحدود"
          )
        )}
      </td>

      <td>
        ${escapeHtml(
          String(
            product.stock ??
            "-"
          )
        )}
      </td>

      <td>
        <span class="admin-status ${
          product.active === false
            ? "danger"
            : "success"
        }">
          ${
            product.active === false
              ? "غیرفعال"
              : "فعال"
          }
        </span>
      </td>

      <td>

        <div class="admin-actions">

          <button
            class="admin-small-button"
            onclick="editProduct('${escapeJs(
              product.id
            )}')"
          >
            ویرایش
          </button>

          <button
            class="admin-small-button danger"
            onclick="deleteProduct('${escapeJs(
              product.id
            )}')"
          >
            حذف
          </button>

        </div>

      </td>

    </tr>
  `;
}

function openProductModal(
  product = null
) {
  adminState.currentProduct =
    product;

  const title =
    product
      ? "ویرایش پلن"
      : "افزودن پلن";

  const categories =
    adminState.categories.length
      ? adminState.categories
      : [
          {
            id: "wg",
            name: "WireGuard"
          },
          {
            id: "dns",
            name: "DNS"
          },
          {
            id: "v2ray",
            name: "V2Ray"
          }
        ];

  openAdminModal(
    title,
    `
      <form
        id="productForm"
        class="admin-form"
      >

        <div class="admin-form-grid">

          <label>
            نام پلن
            <input
              name="name"
              required
              value="${escapeHtml(
                product?.name || ""
              )}"
              placeholder="مثلاً WireGuard 20GB"
            />
          </label>

          <label>
            دسته‌بندی

            <select name="category">

              ${categories
                .map(
                  (category) => `
                    <option
                      value="${escapeHtml(
                        category.id
                      )}"
                      ${
                        String(
                          product?.category ||
                          "wg"
                        ) ===
                        String(
                          category.id
                        )
                          ? "selected"
                          : ""
                      }
                    >
                      ${escapeHtml(
                        category.name ||
                        category.id
                      )}
                    </option>
                  `
                )
                .join("")}

            </select>

          </label>

          <label>
            قیمت
            <input
              name="price"
              type="number"
              min="0"
              required
              value="${product?.price ?? ""}"
            />
          </label>

          <label>
            مدت
            <input
              name="duration"
              value="${escapeHtml(
                product?.duration || ""
              )}"
              placeholder="30 روز"
            />
          </label>

          <label>
            حجم
            <input
              name="volume"
              value="${escapeHtml(
                product?.volume || ""
              )}"
              placeholder="20GB"
            />
          </label>

          <label>
            سرور
            <input
              name="server"
              value="${escapeHtml(
                product?.server || ""
              )}"
              placeholder="Germany 01"
            />
          </label>

          <label>
            پینگ
            <input
              name="ping"
              value="${escapeHtml(
                product?.ping || ""
              )}"
              placeholder="30ms"
            />
          </label>

          <label>
            موجودی
            <input
              name="stock"
              type="number"
              min="0"
              value="${
                product?.stock ??
                0
              }"
            />
          </label>

          <label>
            Badge
            <select name="rarity">

              ${[
                "COMMON",
                "RARE",
                "EPIC",
                "LEGENDARY"
              ]
                .map(
                  (rarity) => `
                    <option
                      value="${rarity}"
                      ${
                        (
                          product?.rarity ||
                          "RARE"
                        ) === rarity
                          ? "selected"
                          : ""
                      }
                    >
                      ${rarity}
                    </option>
                  `
                )
                .join("")}

            </select>
          </label>

        </div>

        <label class="admin-checkbox">
          <input
            type="checkbox"
            name="active"
            ${
              product?.active !== false
                ? "checked"
                : ""
            }
          />
          محصول فعال باشد
        </label>

        <label class="admin-checkbox">
          <input
            type="checkbox"
            name="featured"
            ${
              product?.featured
                ? "checked"
                : ""
            }
          />
          پیشنهاد ویژه باشد
        </label>

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

  document
    .getElementById(
      "productForm"
    )
    ?.addEventListener(
      "submit",
      saveProduct
    );
}

async function saveProduct(event) {
  event.preventDefault();

  const form =
    event.currentTarget;

  const formData =
    new FormData(form);

  const payload = {
    name:
      formData.get("name"),

    category:
      formData.get("category"),

    rarity:
      formData.get("rarity"),

    price:
      Number(
        formData.get("price") || 0
      ),

    duration:
      formData.get("duration"),

    volume:
      formData.get("volume"),

    server:
      formData.get("server"),

    ping:
      formData.get("ping"),

    stock:
      Number(
        formData.get("stock") || 0
      ),

    active:
      formData.get("active") ===
      "on",

    featured:
      formData.get("featured") ===
      "on"
  };

  try {
    if (
      adminState.currentProduct
    ) {
      await apiFetch(
        `/api/products/${encodeURIComponent(
          adminState.currentProduct.id
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

      showToast(
        "پلن ویرایش شد."
      );

    } else {
      await apiF
