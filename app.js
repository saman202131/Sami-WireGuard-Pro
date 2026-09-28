function render(ps){
  $('#products').innerHTML=ps.map(p=>`
    <article class="card product-card">

      <div class="product-top">
        <small>◈ ${esc(p.category||'WireGuard')}</small>
        ${p.featured?'<span class="product-badge">پیشنهاد ویژه</span>':''}
      </div>

      <h3>${esc(p.name)}</h3>

      <div class="product-specs">
        <div class="product-spec">
          <span>💾 حجم</span>
          <b>${esc(p.volume||'نامشخص')}</b>
        </div>

        <div class="product-spec">
          <span>⏱ مدت</span>
          <b>${esc(p.duration||'نامشخص')}</b>
        </div>
      </div>

      <div class="price-box">
        <span>قیمت سرویس</span>
        <strong>${Number(p.price||0).toLocaleString('fa-IR')}</strong>
        <small>تومان</small>
      </div>

      <div class="stock">
        ${p.stock>0?'🟢 موجودی فعال':'🔴 ناموجود'}
        ${p.stock>0?` · ${p.stock} عدد`:''}
      </div>

      <button
        class="buy-btn"
        ${p.stock<=0?'disabled':''}
        onclick="openOrder('${p.id}')">
        ${p.stock>0?'🛒 خرید امن سرویس':'ناموجود'}
      </button>

    </article>
  `).join('') || '<div class="empty">محصولی در این دسته موجود نیست.</div>';
}


function openOrder(id){
  selected=store.products.find(x=>x.id===id);

  if(!selected)return;

  $('#pid').value=id;

  const price=Number(selected.price||0);
  const volume=selected.volume||'نامشخص';
  const duration=selected.duration||'نامشخص';

  let cardNumber=String(store.settings.cardNumber||'در تنظیمات وارد نشده')
    .replace(/\s+/g,'')
    .replace(/(.{4})/g,'$1 ')
    .trim();

  $('#selectedProduct').innerHTML=`
    <div class="order-product">

      <div class="order-product-icon">⚡</div>

      <div class="order-product-info">
        <small>سرویس انتخاب‌شده</small>
        <h3>${esc(selected.name)}</h3>

        <div class="order-product-meta">
          <span>💾 ${esc(volume)}</span>
          <span>⏱ ${esc(duration)}</span>
        </div>
      </div>

    </div>

    <div class="order-price-row">
      <span>مبلغ سفارش</span>
      <strong>${price.toLocaleString('fa-IR')} تومان</strong>
    </div>
  `;

  $('#pay').innerHTML=`
    <div class="payment-header">
      <div>
        <small>پرداخت دستی</small>
        <h3>💳 اطلاعات کارت</h3>
      </div>

      <span class="secure-badge">🔒 امن</span>
    </div>

    <div class="card-payment">

      <div class="card-label">شماره کارت</div>

      <div class="card-number-row">
        <strong dir="ltr">${esc(cardNumber)}</strong>

        <button
          type="button"
          onclick="copyCardNumber()"
          class="copy-card">
          📋 کپی
        </button>
      </div>

      <div class="card-owner">
        <span>به نام</span>
        <b>${esc(store.settings.cardName||'نام صاحب کارت وارد نشده')}</b>
      </div>

    </div>

    <div class="payment-total">
      <span>مبلغ قابل پرداخت</span>
      <strong>${price.toLocaleString('fa-IR')} تومان</strong>
    </div>

    <div class="payment-note">
      ⚠️ بعد از انتقال وجه، تصویر رسید پرداخت را در پایین فرم ارسال کنید.
    </div>
  `;

  $('#msg').textContent='';
  $('#modal').classList.remove('hidden');
}


function closeModal(){
  $('#modal').classList.add('hidden');
}


function copyCardNumber(){
  const card=String(store?.settings?.cardNumber||'').replace(/\s+/g,'');

  if(!card)return;

  navigator.clipboard.writeText(card).then(()=>{
    const btn=document.querySelector('.copy-card');

    if(btn){
      btn.innerHTML='✅ کپی شد';

      setTimeout(()=>{
        btn.innerHTML='📋 کپی';
      },1800);
    }
  });
}


$('#orderForm').addEventListener('submit',async e=>{
  e.preventDefault();

  let file=$('#receipt').files[0];

  if(!file){
    $('#msg').textContent='⚠️ لطفاً رسید پرداخت را انتخاب کنید.';
    return;
  }

  let f=new FormData();

  f.append('productId',$('#pid').value);
  f.append('customerName',$('#name').value);
  f.append('customerContact',$('#contact').value);
  f.append('receipt',file);

  let r=await fetch('/api/orders',{
    method:'POST',
    body:f
  });

  let j=await r.json();

  if(r.ok){
    $('#msg').textContent='✅ سفارش با موفقیت ثبت شد. بعد از بررسی رسید، سرویس تحویل داده می‌شود.';
    e.target.reset();
    await load();
  }else{
    $('#msg').textContent='❌ '+(j.error||'خطا در ثبت سفارش');
  }
});


load();
