let token = localStorage.getItem('sami_admin_token');
let me = JSON.parse(localStorage.getItem('sami_admin_user') || 'null');

const menu = [
  ['dashboard','📊 داشبورد'],
  ['categories','🧩 دسته‌بندی‌ها'],
  ['products','📦 محصولات'],
  ['orders','🧾 سفارش‌ها'],
  ['customers','👥 مشتری‌ها'],
  ['services','🛰️ سرویس‌ها'],
  ['tickets','🎫 تیکت‌ها'],
  ['coupons','🎟️ کد تخفیف'],
  ['flash','⚡ فلش‌سیل'],
  ['wheel','🎡 گردونه شانس'],
  ['telegram','📲 تلگرام'],
  ['settings','⚙️ تنظیمات'],
  ['servers','🖥️ سرورها'],
  ['wallet','💳 کیف پول'],
  ['vip','👑 VIP'],
  ['loyalty','💎 وفاداری'],
  ['missions','🎯 ماموریت‌ها'],
  ['referral','🎁 معرفی دوستان'],
  ['notifications','🔔 اعلان‌ها'],
  ['analytics','📈 آمار'],
  ['audit','🛡️ لاگ‌ها'],
  ['backup','💾 بکاپ']
];

const $ = s => document.querySelector(s);

const esc = x => String(x ?? '').replace(
  /[&<>"']/g,
  m => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#039;'
  }[m])
);

function toast(message, bad = false) {
  const t = $('#toast');
  if (!t) return;

  t.textContent = message;
  t.style.borderColor = bad ? '#7a2d3d' : '#315a76';
  t.classList.add('show');

  setTimeout(() => t.classList.remove('show'), 2200);
}

async function api(url, options = {}) {
  options.headers = {
    ...(options.headers || {}),
    Authorization: 'Bearer ' + token
  };

  if (
    options.body &&
    !(options.body instanceof FormData)
  ) {
    options.headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, options);

  let data = {};
  try {
    data = await response.json();
  } catch {}

  if (response.status === 401) {
    logout();
    throw new Error('نشست مدیریت منقضی شده است');
  }

  if (!response.ok) {
    throw new Error(data.error || 'خطا در عملیات');
  }

  return data;
}

async function login() {
  const response = await fetch('/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      username: $('#u').value,
      password: $('#p').value
    })
  });

  const data = await response.json();

  if (!response.ok) {
    $('#le').textContent = 'نام کاربری یا رمز اشتباه است';
    return;
  }

  token = data.token;
  me = data.user;

  localStorage.setItem('sami_admin_token', token);
  localStorage.setItem(
    'sami_admin_user',
    JSON.stringify(me)
  );

  boot();
}

function logout() {
  localStorage.removeItem('sami_admin_token');
  localStorage.removeItem('sami_admin_user');
  location.reload();
}

function boot() {
  if (!token) return;

  $('#login')?.classList.add('hidden');
  $('#app')?.classList.remove('hidden');

  if ($('#who')) {
    $('#who').textContent =
      '👤 ' +
      (me?.username || 'admin') +
      ' · ' +
      (me?.role || 'owner');
  }

  if ($('#nav')) {
    $('#nav').innerHTML = menu.map(item => `
      <button
        data-nav="${item[0]}"
        onclick="show('${item[0]}')"
      >
        ${item[1]}
      </button>
    `).join('');
  }

  show('dashboard');
}

function setView(html) {
  const view = $('#view');
  if (view) view.innerHTML = html;
}

function buttons(html) {
  return `<div class="actions">${html}</div>`;
}

async function show(type) {
  document
    .querySelectorAll('[data-nav]')
    .forEach(button => {
      button.classList.toggle(
        'active',
        button.dataset.nav === type
      );
    });

  if ($('#title')) {
    $('#title').textContent =
      menu.find(x => x[0] === type)?.[1] || type;
  }

  const pages = {
    dashboard,
    categories,
    products,
    orders,
    customers,
    services,
    tickets,
    coupons,
    flash,
    wheel,
    telegram,
    settings,
    servers,
    wallet,
    vip,
    loyalty,
    missions,
    referral,
    notifications,
    analytics,
    audit,
    backup
  };

  try {
    if (pages[type]) {
      await pages[type]();
    } else {
      setView(`
        <div class="content">
          <h3>${esc(type)}</h3>
          <p class="muted">این بخش آماده است.</p>
        </div>
      `);
    }
  } catch (error) {
    setView(`
      <div class="content">
        <b>خطا:</b>
        ${esc(error.message)}
      </div>
    `);
  }
}


/* =========================
   DASHBOARD
========================= */

async function dashboard() {
  const d = await api('/api/dashboard');

  setView(`
    <div class="cards">
      ${[
        ['orders','سفارش'],
        ['pending','در انتظار'],
        ['approved','تأییدشده'],
        ['revenue','فروش تومان'],
        ['products','محصول'],
        ['customers','مشتری'],
        ['tickets','تیکت باز'],
        ['services','سرویس']
      ].map(([key, title]) => `
        <div class="stat">
          ${title}
          <b>${Number(d[key] || 0).toLocaleString('fa-IR')}</b>
        </div>
      `).join('')}
    </div>

    <div class="content">
      <div class="section-title">
        <h3>مرکز کنترل Sami WireGuard</h3>
        <span class="pill">● ONLINE</span>
      </div>

      <p class="muted">
        مدیریت محصولات، سفارش‌ها، مشتری‌ها و تنظیمات فروشگاه.
      </p>
    </div>
  `);
}


/* =========================
   CATEGORIES
========================= */

async function categories() {
  const data = await api('/api/categories');

  setView(`
    <div class="content">
      <div class="section-title">
        <h3>🧩 دسته‌بندی‌ها</h3>
      </div>

      ${
        data.map(item => `
          <div class="field" style="margin:9px 0">
            <b>${esc(item.name)}</b>

            <span class="pill" style="margin:0 10px">
              ${item.active ? 'فعال' : 'خاموش'}
            </span>

            <button
              class="${item.active ? 'danger' : 'primary'}"
              onclick="toggleCategory(
                '${item.id}',
                ${!item.active}
              )"
            >
              ${item.active ? 'خاموش کن' : 'فعال کن'}
            </button>
          </div>
        `).join('')
      }
    </div>
  `);
}

async function toggleCategory(id, active) {
  await api('/api/categories/' + id, {
    method: 'PUT',
    body: JSON.stringify({ active })
  });

  toast('دسته‌بندی ذخیره شد');
  categories();
}


/* =========================
   PRODUCTS
========================= */

async function products() {
  const data = await api('/api/products');

  setView(`
    <div class="content">

      <div class="section-title">
        <h3>📦 مدیریت محصولات</h3>

        <button
          class="primary"
          onclick="editProduct()"
        >
          ➕ محصول جدید
        </button>
      </div>

      <div class="tablewrap">
        <table class="table">

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
              data.length
                ? data.map(item => `
                    <tr>

                      <td>
                        <b>${esc(item.name)}</b>
                        ${
                          item.featured
                            ? '<br><span class="pill">⭐ ویژه</span>'
                            : ''
                        }
                      </td>

                      <td>
                        ${esc(item.category)}
                      </td>

                      <td>
                        ${Number(item.price || 0)
                          .toLocaleString('fa-IR')}
                        تومان
                      </td>

                      <td>
                        ${esc(item.duration || '-')}
                      </td>

                      <td>
                        ${esc(item.volume || '-')}
                      </td>

                      <td>
                        ${Number(item.stock || 0)
                          .toLocaleString('fa-IR')}
                      </td>

                      <td>
                        ${
                          item.active !== false
                            ? '<span class="pill">فعال</span>'
                            : '<span class="pill">خاموش</span>'
                        }
                      </td>

                      <td>
                        ${buttons(`
                          <button
                            class="secondary"
                            onclick='editProduct(${JSON.stringify(item)})'
                          >
                            ✏️ ویرایش
                          </button>

                          <button
                            class="danger"
                            onclick="deleteProduct('${item.id}')"
                          >
                            🗑️ حذف
                          </button>
                        `)}
                      </td>

                    </tr>
                  `).join('')
                : `
                  <tr>
                    <td colspan="8">
                      هنوز محصولی ثبت نشده است.
                    </td>
                  </tr>
                `
            }

          </tbody>

        </table>
      </div>

    </div>
  `);
}


function editProduct(product = {}) {
  setView(`
    <div class="content">

      <div class="section-title">
        <h3>
          ${
            product.id
              ? '✏️ ویرایش محصول'
              : '➕ محصول جدید'
          }
        </h3>

        <button
          class="ghost"
          onclick="products()"
        >
          بازگشت
        </button>
      </div>

      <div class="form-grid">

        <div class="field">
          <label>نام محصول</label>
          <input
            id="pn"
            value="${esc(product.name || '')}"
            placeholder="مثلاً WireGuard Premium"
          >
        </div>

        <div class="field">
          <label>دسته</label>

          <select id="pc">

            <option
              value="wg"
              ${product.category === 'wg' ? 'selected' : ''}
            >
              WireGuard
            </option>

            <option
              value="dns"
              ${product.category === 'dns' ? 'selected' : ''}
            >
              DNS
            </option>

            <option
              value="v2ray"
              ${product.category === 'v2ray' ? 'selected' : ''}
            >
              V2Ray
            </option>

          </select>
        </div>

        <div class="field">
          <label>قیمت تومان</label>

          <input
            id="pp"
            type="number"
            min="0"
            value="${Number(product.price || 0)}"
          >
        </div>

        <div class="field">
          <label>موجودی</label>

          <input
            id="ps"
            type="number"
            min="0"
            value="${Number(product.stock ?? 0)}"
          >
        </div>

        <div class="field">
          <label>مدت</label>

          <input
            id="pd"
            value="${esc(product.duration || '')}"
            placeholder="مثلاً 30 روز"
          >
        </div>

        <div class="field">
          <label>حجم</label>

          <input
            id="pv"
            value="${esc(product.volume || '')}"
            placeholder="مثلاً 100GB"
          >
        </div>

        <label class="check">
          <input
            id="pa"
            type="checkbox"
            ${product.active !== false ? 'checked' : ''}
          >
          فعال باشد
        </label>

        <label class="check">
          <input
            id="pf"
            type="checkbox"
            ${product.featured ? 'checked' : ''}
          >
          ⭐ محصول ویژه
        </label>

        <div class="wide">

          <button
            class="primary"
            onclick="saveProduct('${product.id || ''}')"
          >
            💾 ذخیره محصول
          </button>

        </div>

      </div>
    </div>
  `);
}


async function saveProduct(id) {

  const name = $('#pn')?.value.trim();

  if (!name) {
    toast('نام محصول را وارد کنید', true);
    return;
  }

  const data = {
    name,
    category: $('#pc').value,
    price: Number($('#pp').value || 0),
    stock: Number($('#ps').value || 0),
    duration: $('#pd').value.trim(),
    volume: $('#pv').value.trim(),
    active: $('#pa').checked,
    featured: $('#pf').checked
  };

  try {

    await api(
      id
        ? '/api/products/' + id
        : '/api/products',
      {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(data)
      }
    );

    toast('✅ محصول با موفقیت ذخیره شد');

    await products();

  } catch (error) {

    toast(error.message, true);

  }
}


async function deleteProduct(id) {

  if (!confirm('این محصول حذف شود؟')) {
    return;
  }

  await api('/api/products/' + id, {
    method: 'DELETE'
  });

  toast('محصول حذف شد');

  products();
}


/* =========================
   ORDERS
========================= */

async function orders() {

  const data = await api('/api/orders');

  setView(`
    <div class="content">

      <div class="section-title">
        <h3>🧾 سفارش‌ها</h3>
        <span class="muted">
          ${data.length} سفارش
        </span>
      </div>

      <div class="tablewrap">

        <table class="table">

          <thead>
            <tr>
              <th>محصول</th>
              <th>مشتری</th>
              <th>مبلغ</th>
              <th>رسید</th>
              <th>وضعیت</th>
              <th>عملیات</th>
            </tr>
          </thead>

          <tbody>

            ${
              data.map(order => `
                <tr>

                  <td>
                    ${esc(order.productName)}
                  </td>

                  <td>
                    ${esc(order.customerName)}
                    <br>
                    ${esc(order.customerContact)}
                  </td>

                  <td>
                    ${Number(order.amount || 0)
                      .toLocaleString('fa-IR')}
                    تومان
                  </td>

                  <td>
                    ${
                      order.receipt
                        ? `<a
                            href="${esc(order.receipt)}"
                            target="_blank"
                          >
                            🧾 مشاهده
                           </a>`
                        : '—'
                    }
                  </td>

                  <td>
                    <span class="pill">
                      ${esc(order.status)}
                    </span>
                  </td>

                  <td>

                    <select id="st_${order.id}">
                      <option value="pending"
                        ${order.status === 'pending' ? 'selected' : ''}>
                        pending
                      </option>

                      <option value="approved"
                        ${order.status === 'approved' ? 'selected' : ''}>
                        approved
                      </option>

                      <option value="rejected"
                        ${order.status === 'rejected' ? 'selected' : ''}>
                        rejected
                      </option>

                      <option value="delivered"
                        ${order.status === 'delivered' ? 'selected' : ''}>
                        delivered
                      </option>
                    </select>

                    <button
                      class="secondary"
                      onclick="statusOrder('${order.id}')"
                    >
                      💾
                    </button>

                    <button
                      class="primary"
                      onclick='delivery(${JSON.stringify(order)})'
                    >
                      📤 تحویل
                    </button>

                  </td>

                </tr>
              `).join('')
            }

          </tbody>

        </table>

      </div>

    </div>
  `);
}


async function statusOrder(id) {

  await api('/api/orders/' + id + '/status', {
    method: 'PUT',
    body: JSON.stringify({
      status: $('#st_' + id).value
    })
  });

  toast('وضعیت سفارش ذخیره شد');

  orders();
}


function delivery(order) {

  setView(`
    <div class="content">

      <div class="section-title">
        <h3>
          📤 تحویل سفارش
          ${esc(order.id)}
        </h3>

        <button
          class="ghost"
          onclick="orders()"
        >
          بازگشت
        </button>
      </div>

      <div class="form-grid">

        <div class="field wide">
          <label>لینک اشتراک</label>
          <input
            id="dl"
            value="${esc(order.delivery?.link || '')}"
          >
        </div>

        <div class="field wide">
          <label>کانفیگ WireGuard</label>

          <textarea
            id="dc"
            rows="10"
          >${esc(order.delivery?.config || '')}</textarea>
        </div>

        <div class="field wide">
          <label>QR</label>

          <textarea
            id="dq"
            rows="3"
          >${esc(order.delivery?.qr || '')}</textarea>
        </div>

        <div class="field wide">
          <label>یادداشت مشتری</label>

          <textarea
            id="dn"
            rows="4"
          >${esc(order.delivery?.notes || '')}</textarea>
        </div>

        <div class="wide">

          <button
            class="primary"
            onclick="saveDelivery('${order.id}')"
          >
            💾 ثبت تحویل
          </button>

        </div>

      </div>

    </div>
  `);
}


async function saveDelivery(id) {

  await api('/api/orders/' + id + '/delivery', {
    method: 'PUT',
    body: JSON.stringify({
      link: $('#dl').value,
      config: $('#dc').value,
      qr: $('#dq').value,
      notes: $('#dn').value
    })
  });

  toast('تحویل ثبت شد');

  orders();
}


/* =========================
   CUSTOMERS
========================= */

async function customers() {

  const data = await api('/api/customers');

  genericTable(
    '👥 مشتری‌ها',
    data,
    [
      ['name','نام'],
      ['contact','تماس'],
      ['lastOrder','آخرین سفارش'],
      ['createdAt','تاریخ']
    ]
  );
}


/* =========================
   SERVICES
========================= */

async function services() {

  const data = await api('/api/services');

  genericTable(
    '🛰️ سرویس‌ها',
    data,
    [
      ['name','نام'],
      ['status','وضعیت'],
      ['id','ID']
    ]
  );
}


/* =========================
   TICKETS
========================= */

async function tickets() {

  const data = await api('/api/tickets');

  setView(`
    <div class="content">

      <h3>🎫 تیکت‌ها</h3>

      ${
        data.length
          ? data.map(ticket => `
              <div class="field">

                <b>
                  ${esc(ticket.subject)}
                </b>

                · ${esc(ticket.status)}

                <p>
                  ${esc(ticket.message)}
                </p>

                <small>
                  ${esc(ticket.name)}
                  —
                  ${esc(ticket.contact)}
                </small>

                <br>

                <button
                  class="secondary"
                  onclick="closeTicket('${ticket.id}')"
                >
                  بستن تیکت
                </button>

              </div>
            `).join('')
          : '<div class="empty">تیکتی وجود ندارد.</div>'
      }

    </div>
  `);
}


async function closeTicket(id) {

  await api('/api/tickets/' + id, {
    method: 'PUT',
    body: JSON.stringify({
      status: 'closed'
    })
  });

  toast('تیکت بسته شد');

  tickets();
}


/* =========================
   GENERIC TABLE
========================= */

function genericTable(title, data, columns) {

  setView(`
    <div class="content">

      <h3>${esc(title)}
