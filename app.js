const state = {
  products: [],
  settings: {},
  categories: [],
  currentCategory: "all",
  selectedProduct: null,
  authStep: "phone",
  currentUser: null
};

document.addEventListener("DOMContentLoaded", init);

/* =========================================================
   INIT
   ========================================================= */

async function init() {
  bindEvents();
  await restoreSession();
  await loadStore();
  setupMobileMenu();
}

/* =========================================================
   EVENTS
   ========================================================= */

function bindEvents() {
  const orderForm = document.getElementById("orderForm");

  if (orderForm) {
    orderForm.addEventListener("submit", submitOrder);
  }

  const mobileButton = document.getElementById("mobileMenuButton");

  if (mobileButton) {
    mobileButton.addEventListener("click", toggleMobileMenu);
  }
}

/* =========================================================
   STORE
   ========================================================= */

async function loadStore() {
  try {
    const response = await fetch("/api/store");

    if (!response.ok) {
      throw new Error("STORE_REQUEST_FAILED");
    }

    const data = await response.json();

    state.products = Array.isArray(data.products)
      ? data.products
      : [];

    state.settings = data.settings || {};

    state.categories = Array.isArray(data.categories)
      ? data.categories
      : [];

    applySettings();
    renderCategories();
    renderProducts();

  } catch (error) {
    console.error("Store loading error:", error);

    state.products = [];

    renderCategories();
    renderProducts();
  }
}

/* =========================================================
   SETTINGS
   ========================================================= */

function applySettings() {
  const settings = state.settings || {};

  const brandName = document.getElementById("brandName");

  if (brandName && settings.siteName) {
    brandName.textContent = settings.siteName
      .replace(/WIREGUARD/gi, "")
      .trim()
      .split(" ")[0] || "SAMI";
  }

  if (settings.siteName) {
    document.title =
      `${settings.siteName} | خرید VPN وایرگارد`;
  }

  const supportUsername =
    cleanTelegramUsername(
      settings.supportUsername || "saman_s87"
    );

  const botUsername =
    cleanTelegramUsername(
      settings.botUsername || "sami91928bot"
    );

  updateTelegramLinks(
    "https://t.me/" + supportUsername
  );

  const botLink =
    document.getElementById("botLink");

  if (botLink && botUsername) {
    botLink.href =
      "https://t.me/" + botUsername;
  }
}

function cleanTelegramUsername(username) {
  return String(username || "")
    .replace(/^https?:\/\/t\.me\//i, "")
    .replace(/^@/, "")
    .trim();
}

function updateTelegramLinks(url) {
  document
    .querySelectorAll(
      'a[href*="t.me/saman_s87"], #supportLink'
    )
    .forEach((link) => {
      link.href = url;
    });
}

/* =========================================================
   CATEGORIES
   ========================================================= */

function renderCategories() {
  const container =
    document.getElementById("categoryFilters");

  if (!container) return;

  const categories = Array.isArray(state.categories)
    ? state.categories
    : [];

  const buttons = [];

  buttons.push(`
    <button
      type="button"
      class="category-filter ${
        state.currentCategory === "all"
          ? "active"
          : ""
      }"
      data-category="all"
    >
      همه پلن‌ها
    </button>
  `);

  const labels = {
    wg: "WireGuard",
    wireguard: "WireGuard",
    dns: "DNS",
    v2ray: "V2Ray"
  };

  const used = new Set();

  categories.forEach((category) => {
    if (!category || category.active === false) {
      return;
    }

    const id = String(category.id || "");

    if (!id || used.has(id)) {
      return;
    }

    used.add(id);

    buttons.push(`
      <button
        type="button"
        class="category-filter ${
          state.currentCategory === id
            ? "active"
            : ""
        }"
        data-category="${escapeHtml(id)}"
      >
        ${escapeHtml(
          category.name ||
          labels[id] ||
          id
        )}
      </button>
    `);
  });

  /*
    اگر دیتابیس هنوز categoryها را برنگرداند،
    این سه دسته همچنان قابل استفاده هستند.
  */

  if (categories.length === 0) {
    [
      ["wg", "WireGuard"],
      ["dns", "DNS"],
      ["v2ray", "V2Ray"]
    ].forEach(([id, label]) => {
      buttons.push(`
        <button
          type="button"
          class="category-filter ${
            state.currentCategory === id
              ? "active"
              : ""
          }"
          data-category="${id}"
        >
          ${label}
        </button>
      `);
    });
  }

  container.innerHTML = buttons.join("");

  container
    .querySelectorAll(".category-filter")
    .forEach((button) => {
      button.addEventListener("click", () => {
        state.currentCategory =
          button.dataset.category || "all";

        renderCategories();
        renderProducts();

        document
          .getElementById("plans")
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
      });
    });
}

/* =========================================================
   PRODUCTS
   ========================================================= */

function renderProducts() {
  const container =
    document.getElementById("products");

  const empty =
    document.getElementById("productsEmpty");

  if (!container) return;

  let products = Array.isArray(state.products)
    ? state.products
    : [];

  products = products.filter(
    (product) =>
      product &&
      product.active !== false
  );

  if (state.currentCategory !== "all") {
    products = products.filter((product) => {
      const category =
        String(product.category || "")
          .toLowerCase();

      const current =
        String(state.currentCategory || "")
          .toLowerCase();

      return (
        category === current ||
        (
          current === "wg" &&
          category === "wireguard"
        ) ||
        (
          current === "wireguard" &&
          category === "wg"
        )
      );
    });
  }

  if (!products.length) {
    container.innerHTML = "";

    if (empty) {
      empty.style.display = "block";
    }

    return;
  }

  if (empty) {
    empty.style.display = "none";
  }

  container.innerHTML =
    products
      .map(renderProductCard)
      .join("");

  container
    .querySelectorAll("[data-buy-product]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        openCheckout(button.dataset.buyProduct);
      });
    });
}

/* =========================================================
   PRODUCT CARD
   ========================================================= */

function renderProductCard(product) {
  const id =
    String(product.id || "");

  const name =
    product.name || "پلن WireGuard";

  const category =
    getCategoryLabel(product.category);

  const rarity =
    product.rarity || "";

  const price =
    formatPrice(product.price);

  const duration =
    formatDuration(product.duration);

  const volume =
    product.volume ||
    "نامحدود";

  const server =
    product.server ||
    "پایدار";

  const ping =
    product.ping ||
    "-";

  const stock =
    Number.isFinite(Number(product.stock))
      ? Number(product.stock)
      : null;

  const featured =
    product.featured === true;

  const stockText =
    stock === null
      ? "موجود"
      : stock > 0
        ? `${stock} عدد موجود`
        : "ناموجود";

  const disabled =
    stock !== null && stock <= 0;

  return `
    <article
      class="product-card ${
        featured ? "featured" : ""
      }"
    >

      ${
        featured
          ? `
            <span class="product-badge">
              پیشنهاد ویژه
            </span>
          `
          : ""
      }

      <div class="product-category">
        ${escapeHtml(category)}
      </div>

      <h3>
        ${escapeHtml(name)}
      </h3>

      ${
        rarity
          ? `
            <p class="product-rarity">
              ${escapeHtml(rarity)}
            </p>
          `
          : ""
      }

      <div class="product-price">
        ${price}
        <small>تومان</small>
      </div>

      <div class="product-meta">

        <div>
          <span>حجم</span>
          <strong>
            ${escapeHtml(String(volume))}
          </strong>
        </div>

        <div>
          <span>مدت</span>
          <strong>
            ${escapeHtml(duration)}
          </strong>
        </div>

        <div>
          <span>سرور</span>
          <strong>
            ${escapeHtml(String(server))}
          </strong>
        </div>

        <div>
          <span>پینگ</span>
          <strong>
            ${escapeHtml(String(ping))}
          </strong>
        </div>

      </div>

      <ul class="product-features">

        <li>
          تحویل کانفیگ
        </li>

        <li>
          QR Code
        </li>

        <li>
          پشتیبانی تلگرام
        </li>

        <li>
          وضعیت سفارش در پنل
        </li>

      </ul>

      <div class="product-stock">
        ${escapeHtml(stockText)}
      </div>

      <button
        type="button"
        class="buy-button"
        data-buy-product="${escapeHtml(id)}"
        ${disabled ? "disabled" : ""}
      >
        ${
          disabled
            ? "ناموجود"
            : "خرید پلن"
        }
      </button>

    </article>
  `;
}

/* =========================================================
   PRODUCT HELPERS
   ========================================================= */

function getCategoryLabel(category) {
  const id =
    String(category || "")
      .toLowerCase();

  const labels = {
    wg: "WireGuard",
    wireguard: "WireGuard",
    dns: "DNS",
    v2ray: "V2Ray"
  };

  return (
    labels[id] ||
    category ||
    "سرویس"
  );
}

function formatPrice(value) {
  const number =
    Number(value || 0);

  return new Intl.NumberFormat("fa-IR")
    .format(number);
}

function formatDuration(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "-";
  }

  const text =
    String(value).trim();

  if (/^\d+$/.test(text)) {
    return `${text} روز`;
  }

  return text;
}

/* =========================================================
   AUTH / SESSION
   ========================================================= */

async function restoreSession() {
  const token =
    localStorage.getItem("sami_token");

  if (!token) {
    updatePlayerUI(null);
    return;
  }

  try {
    const response = await fetch(
      "/api/me",
      {
        headers: {
          Authorization:
            `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error("SESSION_EXPIRED");
    }

    const data =
      await response.json();

    state.currentUser =
      data.user || null;

    updatePlayerUI(
      state.currentUser
    );

  } catch {
    localStorage.removeItem("sami_token");
    localStorage.removeItem("sami_user");

    state.currentUser = null;

    updatePlayerUI(null);
  }
}

/* =========================================================
   AUTH MODAL
   ========================================================= */

function openAuth() {
  const modal =
    document.getElementById("authModal");

  if (!modal) return;

  modal.setAttribute(
    "aria-hidden",
    "false"
  );

  modal.classList.add("active");

  resetAuthForm();

  setTimeout(() => {
    document
      .getElementById("phoneInput")
      ?.focus();
  }, 50);
}

function closeAuth() {
  const modal =
    document.getElementById("authModal");

  if (!modal) return;

  modal.setAttribute(
    "aria-hidden",
    "true"
  );

  modal.classList.remove("active");
}

function resetAuthForm() {
  state.authStep = "phone";

  const phoneStep =
    document.getElementById("authStepPhone");

  const otpStep =
    document.getElementById("authStepOtp");

  const phoneInput =
    document.getElementById("phoneInput");

  const otpInput =
    document.getElementById("otpInput");

  const message =
    document.getElementById("authMessage");

  if (phoneStep) {
    phoneStep.style.display = "block";
  }

  if (otpStep) {
    otpStep.style.display = "none";
  }

  if (phoneInput) {
    phoneInput.value = "";
  }

  if (otpInput) {
    otpInput.value = "";
  }

  if (message) {
    message.textContent = "";
  }
}

/* =========================================================
   OTP
   ========================================================= */

async function requestOTP() {
  const input =
    document.getElementById("phoneInput");

  const message =
    document.getElementById("authMessage");

  if (!input) return;

  const phone =
    normalizePhone(input.value);

  if (!isValidPhone(phone)) {
    setFormMessage(
      message,
      "شماره موبایل معتبر وارد کنید."
    );

    return;
  }

  setFormMessage(
    message,
    "در حال ارسال کد تأیید..."
  );

  try {
    const response =
      await fetch(
        "/api/auth/request-otp",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            phone
          })
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.message ||
        "ارسال کد انجام نشد."
      );
    }

    state.authStep = "otp";

    const phoneStep =
      document.getElementById(
        "authStepPhone"
      );

    const otpStep =
      document.getElementById(
        "authStepOtp"
      );

    if (phoneStep) {
      phoneStep.style.display = "none";
    }

    if (otpStep) {
      otpStep.style.display = "block";
    }

    /*
      فقط در محیط development
      سرور ممکن است developmentCode بدهد.
    */

    if (data.developmentCode) {
      setFormMessage(
        message,
        `کد تست: ${data.developmentCode}`
      );
    } else {
      setFormMessage(
        message,
        "کد تأیید برای شما ارسال شد."
      );
    }

    setTimeout(() => {
      document
        .getElementById("otpInput")
        ?.focus();
    }, 50);

  } catch (error) {
    setFormMessage(
      message,
      error.message ||
      "خطایی رخ داد."
    );
  }
}

async function verifyOTP() {
  const phoneInput =
    document.getElementById("phoneInput");

  const otpInput =
    document.getElementById("otpInput");

  const message =
    document.getElementById("authMessage");

  if (!phoneInput || !otpInput) {
    return;
  }

  const phone =
    normalizePhone(phoneInput.value);

  const code =
    String(otpInput.value || "")
      .trim();

  if (!/^\d{6}$/.test(code)) {
    setFormMessage(
      message,
      "کد ۶ رقمی را وارد کنید."
    );

    return;
  }

  setFormMessage(
    message,
    "در حال تأیید..."
  );

  try {
    const response =
      await fetch(
        "/api/auth/verify-otp",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            phone,
            code
          })
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.message ||
        "کد تأیید صحیح نیست."
      );
    }

    if (!data.token) {
      throw new Error(
        "توکن ورود دریافت نشد."
      );
    }

    localStorage.setItem(
      "sami_token",
      data.token
    );

    localStorage.setItem(
      "sami_user",
      JSON.stringify(
        data.user || {}
      )
    );

    state.currentUser =
      data.user || null;

    updatePlayerUI(
      state.currentUser
    );

    closeAuth();

    if (state.selectedProduct) {
      openCheckout(
        state.selectedProduct.id
      );
    }

  } catch (error) {
    setFormMessage(
      message,
      error.message ||
      "خطایی رخ داد."
    );
  }
}

function backToPhone() {
  state.authStep = "phone";

  const phoneStep =
    document.getElementById(
      "authStepPhone"
    );

  const otpStep =
    document.getElementById(
      "authStepOtp"
    );

  const message =
    document.getElementById(
      "authMessage"
    );

  if (phoneStep) {
    phoneStep.style.display = "block";
  }

  if (otpStep) {
    otpStep.style.display = "none";
  }

  if (message) {
    message.textContent = "";
  }
}

/* =========================================================
   PLAYER UI
   ========================================================= */

function updatePlayerUI(user) {
  const loginButtons =
    document.querySelectorAll(
      ".header-login"
    );

  loginButtons.forEach((button) => {
    if (user) {
      button.textContent =
        "پنل کاربری";
    } else {
      button.textContent =
        "ورود / ثبت‌نام";
    }
  });
}

function logout() {
  localStorage.removeItem(
    "sami_token"
  );

  localStorage.removeItem(
    "sami_user"
  );

  state.currentUser = null;

  updatePlayerUI(null);

  location.reload();
}

/* =========================================================
   CHECKOUT
   ========================================================= */

async function openCheckout(productId) {
  const product =
    state.products.find(
      (item) =>
        String(item.id) ===
        String(productId)
    );

  if (!product) {
    alert("محصول پیدا نشد.");
    return;
  }

  state.selectedProduct = product;

  const token =
    localStorage.getItem(
      "sami_token"
    );

  if (!token) {
    openAuth();
    return;
  }

  populateCheckout(product);

  const modal =
    document.getElementById(
      "checkoutModal"
    );

  if (!modal) return;

  modal.setAttribute(
    "aria-hidden",
    "false"
  );

  modal.classList.add("active");
}

function closeCheckout() {
  const modal =
    document.getElementById(
      "checkoutModal"
    );

  if (!modal) return;

  modal.setAttribute(
    "aria-hidden",
    "true"
  );

  modal.classList.remove("active");
}

function populateCheckout(product) {
  const selected =
    document.getElementById(
      "selectedProduct"
    );

  const productId =
    document.getElementById(
      "productId"
    );

  const paymentCard =
    document.getElementById(
      "paymentCard"
    );

  const paymentName =
    document.getElementById(
      "paymentName"
    );

  const orderPhone =
    document.getElementById(
      "orderPhone"
    );

  if (productId) {
    productId.value =
      product.id || "";
  }

  if (selected) {
    selected.innerHTML = `
      <strong>
        ${escapeHtml(
          product.name ||
          "پلن WireGuard"
        )}
      </strong>

      <div style="margin-top:7px;color:#8f9aaa;font-size:11px;">
        ${escapeHtml(
          String(product.volume || "نامحدود")
        )}
        •
        ${escapeHtml(
          formatDuration(product.duration)
        )}
        •
        ${formatPrice(product.price)}
        تومان
      </div>
    `;
  }

  if (paymentCard) {
    paymentCard.textContent =
      state.settings.cardNumber ||
      "-";
  }

  if (paymentName) {
    paymentName.textContent =
      state.settings.cardName ||
      "-";
  }

  if (orderPhone) {
    orderPhone.value =
      state.currentUser?.phone ||
      "";
  }

  const message =
    document.getElementById(
      "orderMessage"
    );

  if (message) {
    message.textContent = "";
  }

  const receipt =
    document.getElementById(
      "receipt"
    );

  if (receipt) {
    receipt.value = "";
  }
}

/* =========================================================
   SUBMIT ORDER
   ========================================================= */

async function submitOrder(event) {
  event.preventDefault();

  const token =
    localStorag
