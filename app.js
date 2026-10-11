'use strict';

const API_BASE = '/api';

const state = {
  services: [],
  selectedPlan: null,
  submitting: false
};

const $ = (selector) => document.querySelector(selector);

const escapeHTML = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);

function showToast(message, type = 'success') {
  let toast = $('#toast');

  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.toggle('error', type === 'error');
  toast.classList.add('show');

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

function formatPrice(value) {
  const price = Number(value);

  if (!Number.isFinite(price) || price < 0) {
    return 'استعلام قیمت';
  }

  return `${new Intl.NumberFormat('fa-IR').format(price)} تومان`;
}

function getPlanName(plan) {
  return plan.name || plan.title || plan.label || 'بسته سرویس';
}

function getPlanPrice(plan) {
  return plan.price ?? plan.amount ?? plan.cost ?? 0;
}

function getPlanVolume(plan) {
  return plan.volume || plan.data || plan.traffic || plan.size || '';
}

function getServiceIcon(service) {
  const text = `${service.name || ''} ${service.type || ''}`.toLowerCase();

  if (text.includes('dns')) return '🌐';
  if (text.includes('v2ray') || text.includes('v2')) return '🚀';
  if (text.includes('wireguard') || text.includes('wire')) return '🛡️';

  return service.icon || '⚡';
}

function normalizeServices(data) {
  const raw = Array.isArray(data)
    ? data
    : Array.isArray(data.services)
      ? data.services
      : Array.isArray(data.products)
        ? data.products
        : Array.isArray(data.items)
          ? data.items
          : [];

  return raw.map((service, index) => {
    const plans = Array.isArray(service.plans)
      ? service.plans
      : Array.isArray(service.packages)
        ? service.packages
        : Array.isArray(service.prices)
          ? service.prices
          : [];

    return {
      ...service,
      id: String(service.id ?? service.slug ?? `service-${index + 1}`),
      name: service.name || service.title || 'سرویس اینترنت',
      description: service.description || service.desc || 'جزئیات این سرویس را بررسی کنید.',
      type: service.type || service.category || '',
      icon: getServiceIcon(service),
      plans
    };
  });
}

function getServiceFeatures(service) {
  if (Array.isArray(service.features)) {
    return service.features.slice(0, 4);
  }

  const features = [];

  if (service.type) features.push(service.type);
  if (service.location || service.country) {
    features.push(service.location || service.country);
  }
  if (service.duration || service.period) {
    features.push(service.duration || service.period);
  }

  return features.length ? features : ['انتخاب بسته', 'ثبت درخواست'];
}

function renderServices() {
  const grid = $('#serviceGrid');

  if (!grid) return;

  if (!state.services.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div style="font-size:30px;margin-bottom:8px">📦</div>
        <strong>فعلاً سرویسی نمایش داده نمی‌شود</strong>
        <p style="margin-top:6px">لطفاً کمی بعد دوباره امتحان کنید.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = state.services.map((service, index) => {
    const plans = service.plans;
    const firstPlan = plans[0];
    const price = firstPlan ? getPlanPrice(firstPlan) : getPlanPrice(service);
    const features = getServiceFeatures(service);

    return `
      <article class="service-card ${index === 0 ? 'featured' : ''}">
        <div class="service-icon">${escapeHTML(service.icon)}</div>

        <h3>${escapeHTML(service.name)}</h3>

        <p class="service-description">
          ${escapeHTML(service.description)}
        </p>

        <div class="service-meta">
          ${features.map(feature => `
            <span class="meta-tag">${escapeHTML(feature)}</span>
          `).join('')}
        </div>

        <div class="service-footer">
          <div class="service-price">
            ${formatPrice(price)}
            <small>${plans.length ? `${plans.length} بسته قابل انتخاب` : 'قیمت سرویس'}</small>
          </div>

          <button
            type="button"
            class="btn btn-primary choose-service"
            data-service-id="${escapeHTML(service.id)}"
          >
            مشاهده و خرید
          </button>
        </div>
      </article>
    `;
  }).join('');

  grid.querySelectorAll('.choose-service').forEach(button => {
    button.addEventListener('click', () => {
      const service = state.services.find(
        item => item.id === button.dataset.serviceId
      );

      if (service) openOrderModal(service);
    });
  });
}

function ensureModalElements() {
  let modal = $('#orderModal');

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'orderModal';
    modal.className = 'modal';

    modal.innerHTML = `
      <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <div class="modal-header">
          <h2 id="modalTitle">ثبت درخواست خرید</h2>
          <button type="button" class="icon-button" id="modalClose" aria-label="بستن">×</button>
        </div>

        <form id="orderForm">
          <div class="form-group">
            <label for="modalPlan">انتخاب بسته</label>
            <select class="form-control" id="modalPlan" required></select>
          </div>

          <div class="form-group">
            <label for="tgUsername">آیدی تلگرام</label>
            <input
              class="form-control"
              id="tgUsername"
              type="text"
              placeholder="@YourUsername"
              autocomplete="off"
              maxlength="64"
              required
            >
            <small class="form-hint">آیدی تلگرام خود را برای پیگیری درخواست وارد کنید.</small>
          </div>

          <div class="order-summary" id="orderSummary"></div>

          <button type="submit" class="btn btn-primary btn-block" id="confirmOrder">
            ثبت درخواست سفارش
          </button>

          <div class="order-result" id="orderResult" aria-live="polite"></div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);
  }

  $('#modalClose')?.addEventListener('click', closeOrderModal);

  modal.addEventListener('click', event => {
    if (event.target === modal) closeOrderModal();
  });

  $('#orderForm')?.addEventListener('submit', submitOrder);
}

function openOrderModal(service) {
  ensureModalElements();

  if (!service.plans.length) {
    showToast('برای این سرویس هنوز بسته‌ای تعریف نشده است.', 'error');
    return;
  }

  state.selectedPlan = {
    service,
    plan: service.plans[0]
  };

  const select = $('#modalPlan');

  select.innerHTML = service.plans.map((plan, index) => {
    const planName = getPlanName(plan);
    const planPrice = getPlanPrice(plan);
    const volume = getPlanVolume(plan);
    const suffix = volume ? ` — ${volume}` : '';

    return `
      <option value="${index}">
        ${escapeHTML(planName + suffix)} | ${escapeHTML(formatPrice(planPrice))}
      </option>
    `;
  }).join('');

  $('#orderResult').textContent = '';
  $('#modalPlan').onchange = updateOrderSummary;

  updateOrderSummary();

  const modal = $('#orderModal');
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  setTimeout(() => $('#tgUsername')?.focus(), 100);
}

function closeOrderModal() {
  const modal = $('#orderModal');

  if (modal) modal.classList.remove('open');

  document.body.style.overflow = '';
}

function updateOrderSummary() {
  if (!state.selectedPlan) return;

  const index = Number($('#modalPlan')?.value || 0);
  const service = state.selectedPlan.service;
  const plan = service.plans[index];

  if (!plan) return;

  state.selectedPlan.plan = plan;

  const volume = getPlanVolume(plan);
  const duration = plan.duration || plan.period || plan.days || '';

  $('#orderSummary').innerHTML = `
    <div class="order-summary-row">
      <span>سرویس</span>
      <strong>${escapeHTML(service.name)}</strong>
    </div>

    <div class="order-summary-row">
      <span>بسته</span>
      <strong>${escapeHTML(getPlanName(plan))}</strong>
    </div>

    ${volume ? `
      <div class="order-summary-row">
        <span>حجم</span>
        <strong>${escapeHTML(volume)}</strong>
      </div>
    ` : ''}

    ${duration ? `
      <div class="order-summary-row">
        <span>مدت اعتبار</span>
        <strong>${escapeHTML(duration)}</strong>
      </div>
    ` : ''}

    <div class="order-summary-row">
      <span>مبلغ</span>
      <strong style="color:var(--primary)">${escapeHTML(formatPrice(getPlanPrice(plan)))}</strong>
    </div>
  `;
}

async function submitOrder(event) {
  event.preventDefault();

  if (state.submitting || !state.selectedPlan) return;

  const usernameInput = $('#tgUsername');
  const username = usernameInput.value.trim().replace(/^@/, '');

  if (!/^[a-zA-Z0-9_]{5,32}$/.test(username)) {
    showToast('آیدی تلگرام معتبر وارد کنید؛ حداقل ۵ حرف یا عدد.', 'error');
    usernameInput.focus();
    return;
  }

  const { service, plan } = state.selectedPlan;
  const button = $('#confirmOrder');
  const result = $('#orderResult');

  state.submitting = true;
  button.disabled = true;
  button.textContent = 'در حال ثبت درخواست...';
  result.textContent = '';

  try {
    const response = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        serviceId: service.id,
        serviceName: service.name,
        planId: String(plan.id ?? plan.name ?? plan.title ?? ''),
        planName: getPlanName(plan),
        price: Number(getPlanPrice(plan)),
        volume: getPlanVolume(plan),
        telegramUsername: username
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || data.error || 'ثبت سفارش انجام نشد.');
    }

    const orderId = data.order?.id ?? data.orderId ?? data.id;

    result.textContent = orderId
      ? `درخواست شما ثبت شد. کد پیگیری: ${orderId} — وضعیت سفارش را از پشتیبانی پیگیری کنید.`
      : 'درخواست شما ثبت شد. برای پیگیری با پشتیبانی تماس بگیرید.';

    showToast('درخواست سفارش ثبت شد.');

    button.textContent = 'درخواست ثبت شد';
  } catch (error) {
    result.textContent = error.message || 'ارتباط با سرور برقرار نشد.';
    showToast(result.textContent, 'error');

    button.disabled = false;
    button.textContent = 'تلاش مجدد';
  } finally {
    state.submitting = false;

    if (button.textContent !== 'تلاش مجدد' &&
        button.textContent !== 'درخواست ثبت شد') {
      button.disabled = false;
      button.textContent = 'ثبت درخواست سفارش';
    }
  }
}

async function loadServices() {
  const grid = $('#serviceGrid');

  if (grid) {
    grid.innerHTML = '<div class="loading">در حال دریافت سرویس‌ها...</div>';
  }

  try {
    const response = await fetch(`${API_BASE}/config`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error('دریافت فهرست سرویس‌ها ناموفق بود.');
    }

    const data = await response.json();
    state.services = normalizeServices(data);

    renderServices();
  } catch (error) {
    console.error('Loading services failed:', error);

    if (grid) {
      grid.innerHTML = `
        <div class="error-state">
          دریافت اطلاعات سرویس‌ها با مشکل مواجه شد.
          <br>
          لطفاً چند لحظه بعد دوباره صفحه را باز کنید.
          <br><br>
          <button type="button" class="btn btn-secondary" id="retryServices">
            تلاش مجدد
          </button>
        </div>
      `;

      $('#retryServices')?.addEventListener('click', loadServices);
    }
  }
}

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeOrderModal();
});

document.addEventListener('DOMContentLoaded', () => {
  ensureModalElements();
  loadServices();
});
