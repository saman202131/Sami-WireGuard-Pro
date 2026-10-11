'use strict';

const API = '/api';

const state = {
  services: [],
  selectedService: null,
  selectedPlan: null,
  submitting: false
};

const $ = (selector) => document.querySelector(selector);

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function formatPrice(value) {
  const price = Number(value);

  if (!Number.isFinite(price) || price < 0) {
    return 'استعلام قیمت';
  }

  return `${new Intl.NumberFormat('fa-IR').format(price)} تومان`;
}

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

function serviceIcon(service) {
  if (service.icon) return service.icon;

  const name = `${service.name || ''} ${service.id || ''}`.toLowerCase();

  if (name.includes('dns')) return '🌐';
  if (name.includes('v2ray')) return '🚀';
  if (name.includes('wireguard')) return '🛡️';

  return '⚡';
}

function normalizeServices(data) {
  const services = Array.isArray(data?.services)
    ? data.services
    : [];

  return services
    .filter(service => service && service.enabled !== false)
    .map(service => ({
      ...service,
      id: String(service.id || ''),
      name: service.name || 'سرویس',
      description: service.subtitle || service.description || '',
      icon: serviceIcon(service),
      plans: Array.isArray(service.plans)
        ? service.plans.filter(plan => plan && plan.enabled !== false)
        : []
    }));
}

function renderServices() {
  const grid = $('#serviceGrid');

  if (!grid) return;

  if (!state.services.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div style="font-size:30px">📦</div>
        <strong>فعلاً سرویسی برای نمایش وجود ندارد.</strong>
      </div>
    `;
    return;
  }

  grid.innerHTML = state.services.map((service, index) => {
    const plans = service.plans;
    const lowestPrice = plans.length
      ? Math.min(...plans.map(plan => Number(plan.price) || 0))
      : null;

    const features = [
      service.accent ? service.accent : '',
      plans.length ? `${plans.length} بسته` : '',
      service.enabled ? 'فعال' : ''
    ].filter(Boolean);

    return `
      <article class="service-card ${index === 0 ? 'featured' : ''}">
        <div class="service-icon">${escapeHTML(service.icon)}</div>

        <h3>${escapeHTML(service.name)}</h3>

        <p class="service-description">
          ${escapeHTML(service.description || 'برای مشاهده بسته‌ها و قیمت‌ها انتخاب کنید.')}
        </p>

        <div class="service-meta">
          ${features.map(feature => `
            <span class="meta-tag">${escapeHTML(feature)}</span>
          `).join('')}
        </div>

        <div class="service-footer">
          <div class="service-price">
            ${lowestPrice === null ? 'استعلام قیمت' : formatPrice(lowestPrice)}
            <small>${plans.length ? 'شروع قیمت بسته‌ها' : 'بسته‌ای موجود نیست'}</small>
          </div>

          <button
            type="button"
            class="btn btn-primary"
            data-service-id="${escapeHTML(service.id)}"
            ${plans.length ? '' : 'disabled'}
          >
            مشاهده بسته‌ها
          </button>
        </div>
      </article>
    `;
  }).join('');

  grid.querySelectorAll('[data-service-id]').forEach(button => {
    button.addEventListener('click', () => {
      const service = state.services.find(
        item => item.id === button.dataset.serviceId
      );

      if (service) openOrderModal(service);
    });
  });
}

function ensureModal() {
  let modal = $('#orderModal');

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'orderModal';
    modal.className = 'modal';

    modal.innerHTML = `
      <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="orderTitle">
        <div class="modal-header">
          <h2 id="orderTitle">ثبت درخواست خرید</h2>
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
              maxlength="32"
              placeholder="مثلاً saman_123"
              autocomplete="off"
              required
            >
            <small class="form-hint">
              نام کاربری تلگرام را بدون @ وارد کنید.
            </small>
          </div>

          <div class="order-summary" id="orderSummary"></div>

          <button class="btn btn-primary btn-block" id="confirmOrder" type="submit">
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

  $('#modalPlan')?.addEventListener('change', updateOrderSummary);
}

function openOrderModal(service) {
  ensureModal();

  if (!service.plans.length) {
    showToast('برای این سرویس بسته‌ای موجود نیست.', 'error');
    return;
  }

  state.selectedService = service;

  $('#modalPlan').innerHTML = service.plans.map((plan, index) => `
    <option value="${index}">
      ${escapeHTML(plan.title || plan.name || 'بسته')}
      — ${escapeHTML(formatPrice(plan.price))}
    </option>
  `).join('');

  $('#tgUsername').value = '';
  $('#orderResult').textContent = '';

  const button = $('#confirmOrder');
  button.disabled = false;
  button.textContent = 'ثبت درخواست سفارش';

  updateOrderSummary();

  $('#orderModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeOrderModal() {
  $('#orderModal')?.classList.remove('open');
  document.body.style.overflow = '';
}

function updateOrderSummary() {
  const service = state.selectedService;
  const select = $('#modalPlan');

  if (!service || !select) return;

  const plan = service.plans[Number(select.value)];

  if (!plan) return;

  state.selectedPlan = plan;

  $('#orderSummary').innerHTML = `
    <div class="order-summary-row">
      <span>سرویس</span>
      <strong>${escapeHTML(service.name)}</strong>
    </div>

    <div class="order-summary-row">
      <span>بسته</span>
      <strong>${escapeHTML(plan.title || plan.name || 'بسته')}</strong>
    </div>

    <div class="order-summary-row">
      <span>حجم</span>
      <strong>${escapeHTML(plan.volume || '—')}</strong>
    </div>

    <div class="order-summary-row">
      <span>مدت اعتبار</span>
      <strong>${escapeHTML(plan.days || 30)} روز</strong>
    </div>

    <div class="order-summary-row">
      <span>مبلغ</span>
      <strong style="color:var(--primary)">
        ${escapeHTML(formatPrice(plan.price))}
      </strong>
    </div>
  `;
}

async function submitOrder(event) {
  event.preventDefault();

  if (state.submitting) return;

  const service = state.selectedService;
  const plan = state.selectedPlan;

  if (!service || !plan) {
    showToast('ابتدا سرویس و بسته را انتخاب کنید.', 'error');
    return;
  }

  const input = $('#tgUsername');
  const username = input.value.trim().replace(/^@/, '');

  if (!/^[a-zA-Z0-9_]{5,32}$/.test(username)) {
    showToast('آیدی تلگرام معتبر وارد کنید.', 'error');
    input.focus();
    return;
  }

  const button = $('#confirmOrder');
  const result = $('#orderResult');

  state.submitting = true;
  button.disabled = true;
  button.textContent = 'در حال ثبت...';
  result.textContent = '';

  try {
    const response = await fetch(`${API}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        serviceId: service.id,
        planId: String(plan.id),
        username
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error || 'ثبت درخواست سفارش انجام نشد.'
      );
    }

    const orderId = data.order?.id || 'ثبت شد';

    result.textContent =
      `درخواست شما ثبت شد. کد پیگیری: ${orderId}. برای پیگیری و هماهنگی پرداخت با پشتیبانی تماس بگیرید.`;

    button.textContent = 'درخواست ثبت شد';
    showToast('درخواست شما با موفقیت ثبت شد.');

  } catch (error) {
    result.textContent = error.message || 'خطای ارتباط با سرور.';
    button.disabled = false;
    button.textContent = 'تلاش مجدد';
    showToast(result.textContent, 'error');

  } finally {
    state.submitting = false;

    if (button.textContent !== 'درخواست ثبت شد' &&
        button.textContent !== 'تلاش مجدد') {
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
    const response = await fetch(`${API}/config`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error('سرور پاسخ مناسبی نداد.');
    }

    const data = await response.json();

    state.services = normalizeServices(data);

    renderServices();

  } catch (error) {
    console.error('Failed to load services:', error);

    if (grid) {
      grid.innerHTML = `
        <div class="error-state">
          دریافت سرویس‌ها ناموفق بود.
          <br>
          <button type="button" class="btn btn-secondary" id="retryServices" style="margin-top:12px">
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
  ensureModal();
  loadServices();
});
