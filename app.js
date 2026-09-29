const state = {
    products: [],
    settings: {},
    categories: [],
    currentCategory: "all",
    selectedProduct: null,
    authStep: "phone",
    currentUser: null
};

const $ = (selector) => document.querySelector(selector);

document.addEventListener("DOMContentLoaded", () => {
    init();
});

async function init() {
    bindEvents();
    restoreSession();
    await loadStore();
}

/* =========================================================
   EVENTS
========================================================= */

function bindEvents() {
    const orderForm = $("#orderForm");

    if (orderForm) {
        orderForm.addEventListener("submit", submitOrder);
    }

    const phoneInput = $("#phoneInput");

    if (phoneInput) {
        phoneInput.addEventListener("input", (event) => {
            event.target.value = event.target.value.replace(/[^\d+]/g, "");
        });
    }

    const otpInput = $("#otpInput");

    if (otpInput) {
        otpInput.addEventListener("input", (event) => {
            event.target.value = event.target.value.replace(/\D/g, "");

            if (event.target.value.length > 6) {
                event.target.value = event.target.value.slice(0, 6);
            }
        });
    }

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeAuth();
            closeCheckout();
        }
    });
}

/* =========================================================
   STORE
========================================================= */

async function loadStore() {
    const container = $("#products");

    if (container) {
        container.innerHTML = `
            <div class="loading">
                <div>CONNECTING TO NETWORK...</div>
            </div>
        `;
    }

    try {
        const response = await fetch("/api/store", {
            method: "GET",
            headers: {
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error("Store request failed");
        }

        const data = await response.json();

        state.products = Array.isArray(data.products)
            ? data.products
            : [];

        state.categories = Array.isArray(data.categories)
            ? data.categories
            : [];

        state.settings = data.settings || {};

        applySettings();
        renderCategories();
        renderProducts();

    } catch (error) {
        console.error("Store error:", error);

        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⚠</div>
                    <h3>NETWORK ERROR</h3>
                    <p>ارتباط با سرور فروشگاه برقرار نشد.</p>
                    <button class="btn btn-primary" onclick="loadStore()">
                        RETRY CONNECTION
                    </button>
                </div>
            `;
        }
    }
}

/* =========================================================
   SETTINGS
========================================================= */

function applySettings() {
    const settings = state.settings || {};

    const supportLink = $("#supportLink");
    const botLink = $("#botLink");
    const channelLink = $("#channelLink");

    const supportUsername =
        settings.supportUsername || "saman_s87";

    const botUsername =
        settings.botUsername || "sami91928bot";

    const channelUsername =
        settings.channelUsername || "SamiWireGuard";

    if (supportLink) {
        supportLink.textContent = `@${supportUsername}`;
        supportLink.href = `https://t.me/${removeAt(supportUsername)}`;
    }

    if (botLink) {
        botLink.textContent = `@${botUsername}`;
        botLink.href = `https://t.me/${removeAt(botUsername)}`;
    }

    if (channelLink) {
        channelLink.textContent = `@${channelUsername}`;
        channelLink.href = `https://t.me/${removeAt(channelUsername)}`;
    }

    document.title =
        settings.siteName || "SAMI // WIREGUARD";
}

function removeAt(value) {
    return String(value || "").replace(/^@/, "");
}

/* =========================================================
   CATEGORIES
========================================================= */

function renderCategories() {
    const filterContainer =
        document.querySelector(".category-filter");

    if (!filterContainer) {
        return;
    }

    const categories = [
        {
            id: "all",
            title: "ALL SYSTEMS"
        },
        {
            id: "wireguard",
            title: "WIREGUARD"
        },
        {
            id: "dns",
            title: "DNS"
        },
        {
            id: "v2ray",
            title: "V2RAY"
        }
    ];

    filterContainer.innerHTML = categories
        .map((category) => {
            const active =
                state.currentCategory === category.id
                    ? "active"
                    : "";

            return `
                <button
                    type="button"
                    class="filter-btn ${active}"
                    onclick="filterProducts('${category.id}')"
                >
                    ${category.title}
                </button>
            `;
        })
        .join("");
}

function filterProducts(category) {
    state.currentCategory = category;
    renderCategories();
    renderProducts();
}

/* =========================================================
   PRODUCTS
========================================================= */

function renderProducts() {
    const container = $("#products");

    if (!container) {
        return;
    }

    let products = [...state.products];

    if (state.currentCategory !== "all") {
        products = products.filter((product) => {
            const category =
                String(
                    product.category ||
                    product.type ||
                    ""
                ).toLowerCase();

            return category === state.currentCategory;
        });
    }

    if (!products.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">◈</div>
                <h3>NO LOADOUT FOUND</h3>
                <p>در این دسته محصول فعالی وجود ندارد.</p>
            </div>
        `;

        return;
    }

    container.innerHTML = products
        .map(renderProductCard)
        .join("");
}

function renderProductCard(product) {
    const id = escapeHtml(product.id || "");
    const name = escapeHtml(
        product.name || "Unnamed Service"
    );

    const description = escapeHtml(
        product.description ||
        "Premium secure network service."
    );

    const category =
        String(
            product.category ||
            product.type ||
            "wireguard"
        ).toLowerCase();

    const price = formatPrice(product.price);

    const badge =
        product.badge ||
        getBadgeByPrice(product.price);

    const badgeClass =
        getBadgeClass(badge);

    const icon =
        getProductIcon(category);

    const features = Array.isArray(product.features)
        ? product.features
        : [];

    const featureHtml = features
        .slice(0, 5)
        .map(
            (feature) => `
                <span class="feature-tag">
                    ${escapeHtml(feature)}
                </span>
            `
        )
        .join("");

    const stockText =
        product.stock === undefined ||
        product.stock === null
            ? "READY"
            : product.stock > 0
                ? `${product.stock} AVAILABLE`
                : "OUT OF STOCK";

    const disabled =
        product.stock !== undefined &&
        product.stock !== null &&
        Number(product.stock) <= 0;

    return `
        <article class="product-card">

            <div class="product-top">
                <span class="product-badge ${badgeClass}">
                    ${escapeHtml(badge)}
                </span>

                <span class="product-category">
                    ${escapeHtml(
                        category.toUpperCase()
                    )}
                </span>
            </div>

            <div class="product-icon">
                ${icon}
            </div>

            <h3>${name}</h3>

            <p class="product-description">
                ${description}
            </p>

            ${
                featureHtml
                    ? `
                        <div class="product-features">
                            ${featureHtml}
                        </div>
                    `
                    : ""
            }

            <div class="product-bottom">

                <div>
                    <div class="price-label">
                        ${escapeHtml(stockText)}
                    </div>

                    <div class="price">
                        ${price}
                        <span>تومان</span>
                    </div>
                </div>

                <button
                    type="button"
                    class="buy-btn"
                    ${disabled ? "disabled" : ""}
                    onclick="openCheckout('${id}')"
                >
                    ${disabled ? "SOLD OUT" : "BUY NOW"}
                </button>

            </div>

        </article>
    `;
}

/* =========================================================
   PRODUCT HELPERS
========================================================= */

function getProductIcon(category) {
    if (category === "dns") {
        return "⚡";
    }

    if (category === "v2ray") {
        return "◈";
    }

    return "⌁";
}

function getBadgeByPrice(price) {
    const value = Number(price) || 0;

    if (value >= 1000000) {
        return "LEGENDARY";
    }

    if (value >= 500000) {
        return "EPIC";
    }

    if (value >= 250000) {
        return "RARE";
    }

    return "COMMON";
}

function getBadgeClass(badge) {
    const value =
        String(badge || "")
            .toLowerCase();

    if (value.includes("legend")) {
        return "badge-legendary";
    }

    if (value.includes("epic")) {
        return "badge-epic";
    }

    if (value.includes("rare")) {
        return "badge-rare";
    }

    return "badge-common";
}

function formatPrice(value) {
    const number = Number(value) || 0;

    return new Intl.NumberFormat("fa-IR")
        .format(number);
}

/* =========================================================
   AUTH / SESSION
========================================================= */

function restoreSession() {
    const token =
        localStorage.getItem("sami_token");

    const savedUser =
        localStorage.getItem("sami_user");

    if (!token) {
        return;
    }

    if (savedUser) {
        try {
            state.currentUser =
                JSON.parse(savedUser);

            updatePlayerUI();
        } catch {
            localStorage.removeItem("sami_user");
        }
    }

    validateSession();
}

async function validateSession() {
    const token =
        localStorage.getItem("sami_token");

    if (!token) {
        return;
    }

    try {
        const response = await fetch("/api/me", {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error("Session expired");
        }

        const data = await response.json();

        state.currentUser =
            data.user || data;

        localStorage.setItem(
            "sami_user",
            JSON.stringify(state.currentUser)
        );

        updatePlayerUI();

    } catch {
        logout(false);
    }
}

function openAuth() {
    const modal = $("#authModal");

    if (!modal) {
        return;
    }

    state.authStep = "phone";

    resetAuthForm();

    modal.classList.add("active");

    setTimeout(() => {
        $("#phoneInput")?.focus();
    }, 100);
}

function closeAuth() {
    $("#authModal")?.classList.remove("active");
}

function resetAuthForm() {
    const phoneSection =
        $("#authPhone");

    const otpSection =
        $("#authOtp");

    const successSection =
        $("#authSuccess");

    if (phoneSection) {
        phoneSection.style.display = "block";
    }

    if (otpSection) {
        otpSection.style.display = "none";
    }

    if (successSection) {
        successSection.style.display = "none";
    }

    if ($("#phoneInput")) {
        $("#phoneInput").value = "";
    }

    if ($("#otpInput")) {
        $("#otpInput").value = "";
    }

    showAuthMessage("");
}

async function requestOTP() {
    const phoneInput = $("#phoneInput");

    if (!phoneInput) {
        return;
    }

    const phone =
        normalizePhone(phoneInput.value);

    if (!phone) {
        showAuthMessage(
            "شماره موبایل معتبر وارد کنید.",
            "error"
        );

        return;
    }

    const button =
        event?.currentTarget ||
        document.querySelector(
            "#authPhone button"
        );

    setButtonLoading(button, true);

    try {
        const response = await fetch(
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

        if ($("#authPhone")) {
            $("#authPhone").style.display =
                "none";
        }

        if ($("#authOtp")) {
            $("#authOtp").style.display =
                "block";
        }

        const maskedPhone =
            maskPhone(phone);

        const otpHint =
            $("#otpHint");

        if (otpHint) {
            otpHint.textContent =
                `کد تأیید برای ${maskedPhone} ارسال شد.`;
        }

        /*
         * فقط محیط توسعه:
         * server.js فعلاً developmentCode
         * را برای تست برمی‌گرداند.
         */
        if (data.developmentCode) {
            showAuthMessage(
                `کد تست: ${data.developmentCode}`,
                "success"
            );
        } else {
            showAuthMessage(
                "کد تأیید ارسال شد.",
                "success"
            );
        }

        setTimeout(() => {
            $("#otpInput")?.focus();
        }, 100);

    } catch (error) {
        showAuthMessage(
            error.message ||
            "خطا در ارسال کد.",
            "error"
        );
    } finally {
        setButtonLoading(button, false);
    }
}

async function verifyOTP() {
    const phone =
        normalizePhone(
            $("#phoneInput")?.value
        );

    const code =
        $("#otpInput")?.value
            ?.trim();

    if (!phone) {
        showAuthMessage(
            "شماره موبایل معتبر نیست.",
            "error"
        );

        return;
    }

    if (!code || code.length !== 6) {
        showAuthMessage(
            "کد ۶ رقمی را وارد کنید.",
            "error"
        );

        return;
    }

    const button =
        event?.currentTarget ||
        document.querySelector(
            "#authOtp button"
        );

    setButtonLoading(button, true);

    try {
        const response = await fetch(
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
                "کد تأیید اشتباه است."
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

        state.currentUser =
            data.user || null;

        localStorage.setItem(
            "sami_user",
            JSON.stringify(
                state.currentUser
            )
        );

        updatePlayerUI();

        if ($("#authOtp")) {
            $("#authOtp").style.display =
                "none";
        }

        if ($("#authSuccess")) {
            $("#authSuccess").style.display =
                "block";
        }

        showAuthMessage(
            "ورود با موفقیت انجام شد.",
            "success"
        );

        setTimeout(() => {
            closeAuth();

            if (state.selectedProduct) {
                openCheckout(
                    state.selectedProduct.id
                );
            }
        }, 700);

    } catch (error) {
        showAuthMessage(
            error.message ||
            "خطا در تأیید کد.",
            "error"
        );
    } finally {
        setButtonLoading(button, false);
    }
}

function backToPhone() {
    state.authStep = "phone";

    if ($("#authPhone")) {
        $("#authPhone").style.display =
            "block";
    }

    if ($("#authOtp")) {
        $("#authOtp").style.display =
            "none";
    }

    showAuthMessage("");

    setTimeout(() => {
        $("#phoneInput")?.focus();
    }, 100);
}

/* =========================================================
   PLAYER UI
========================================================= */

function updatePlayerUI() {
    const button =
        $(".player-btn");

    const info =
        $("#playerInfo");

    if (!state.currentUser) {
        if (button) {
            button.textContent =
                "PLAYER";
        }

        if (info) {
            info.classList.remove("active");
        }

        return;
    }

    if (button) {
        button.textContent =
            "PLAYER ONLINE";
    }

    if (info) {
        info.classList.add("active");

        const name =
            info.querySelector(
                ".player-name"
            );

        if (name) {
            name.textContent =
                state.currentUser.phone ||
                "PLAYER";
        }
    }
}

function logout(closeModal = true) {
    localStorage.removeItem("sami_token");
    localStorage.removeItem("sami_user");

    state.currentUser = null;

    updatePlayerUI();

    if (closeModal) {
        closeAuth();
    }
}

/* =========================================================
   CHECKOUT
========================================================= */

function openCheckout(productId) {
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

    /*
     * خرید فقط بعد از ورود/ثبت‌نام
     */
    if (!getToken()) {
        openAuth();
        return;
    }

    populateCheckout(product);

    const modal =
        $("#checkoutModal");

    if (modal) {
        modal.classList.add("active");
    }
}

function populateCheckout(product) {
    const selected =
        $("#selectedProduct");

    const productId =
        $("#productId");

    const phone =
        $("#orderPhone");

    const card =
        $("#paymentCard");

    const cardName =
        $("#paymentName");

    if (selected) {
        selected.innerHTML = `
            <strong>
                ${escapeHtml(
                    product.name ||
                    "Service"
                )}
            </strong>
            <span>
          
