let store={products:[],categories:[]};

const $=s=>document.querySelector(s);

const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({
  '&':'&amp;',
  '<':'&lt;',
  '>':'&gt;',
  '"':'&quot;',
  "'":'&#039;'
}[m]));

async function load(){
  try{
    const r=await fetch('/api/store?x='+Date.now(),{cache:'no-store'});
    if(!r.ok) throw new Error('store error');

    store=await r.json();

    document.title=store.settings?.siteName||'Sami WireGuard';

    if($('#support')){
      $('#support').textContent='@'+(store.settings?.supportUsername||'');
    }

    if($('#supportLink')){
      $('#supportLink').href='https://t.me/'+(store.settings?.supportUsername||'');
    }

    if($('#supportBtn')){
      $('#supportBtn').href='https://t.me/'+(store.settings?.supportUsername||'');
    }

    if($('#botLink')){
      $('#botLink').href='https://t.me/'+(store.settings?.botUsername||'');
    }

    if($('#channelLink')){
      $('#channelLink').href='https://t.me/'+(store.settings?.channelUsername||'');
    }

    renderCats();
    renderProducts();

  }catch(e){
    console.error(e);
    $('#products').innerHTML='<div class="glass">خطا در بارگذاری محصولات</div>';
  }
}

function renderCats(){
  const cats=Array.isArray(store.categories)
    ? store.categories
    : Object.values(store.categories||{});

  const el=$('#categories');
  if(!el) return;

  el.innerHTML=
    `<button class="active" onclick="filterProducts('all',this)">🔥 همه</button>`+
    cats.map(c=>`
      <button onclick="filterProducts('${esc(c.id)}',this)">
        ${esc(c.name)}
      </button>
    `).join('');
}

function filterProducts(cat,btn){
  document.querySelectorAll('#categories button')
    .forEach(x=>x.classList.remove('active'));

  if(btn) btn.classList.add('active');

  if(cat==='all'){
    renderProducts(store.products||[]);
  }else{
    renderProducts(
      (store.products||[]).filter(p=>
        String(p.category||'').toLowerCase()===String(cat).toLowerCase()
      )
    );
  }
}

window.filterProducts=filterProducts;

function renderProducts(products){
  const el=$('#products');
  if(!el) return;

  if(!products.length){
    el.innerHTML='<div class="empty">محصولی موجود نیست.</div>';
    return;
  }

  el.innerHTML=products.map(p=>`
    <article class="card">
      <small>◈ ${esc(p.category||'WireGuard')}</small>

      <h3>${esc(p.name||'محصول بدون نام')}</h3>

      <div class="meta">
        ${esc(p.duration||'')}
        ${p.duration&&p.volume?' · ':''}
        ${esc(p.volume||'')}
      </div>

      <div class="price">
        ${Number(p.price||0).toLocaleString('fa-IR')}
        <small>تومان</small>
      </div>

      <div class="stock">
        📦 موجودی: ${Number(p.stock||0).toLocaleString('fa-IR')}
      </div>

      <button
        ${Number(p.stock||0)<=0?'disabled':''}
        onclick="openOrder('${p.id}')"
      >
        ${Number(p.stock||0)>0?'🛒 خرید و پرداخت':'ناموجود'}
      </button>
    </article>
  `).join('');
}

window.openOrder=function(id){
  const p=(store.products||[]).find(x=>x.id===id);

  if(!p) return;

  window.selectedProduct=p;

  if($('#pid')) $('#pid').value=p.id;

  if($('#selectedProduct')){
    $('#selectedProduct').innerHTML=`
      <div class="field">
        <b>${esc(p.name)}</b><br>
        ${Number(p.price||0).toLocaleString('fa-IR')} تومان
        ${p.duration?' · '+esc(p.duration):''}
        ${p.volume?' · '+esc(p.volume):''}
      </div>
    `;
  }

  if($('#pay')){
    $('#pay').innerHTML=`
      💳 مبلغ قابل پرداخت:
      <b>${Number(p.price||0).toLocaleString('fa-IR')} تومان</b>
      <br>
      شماره کارت:
      <b>${esc(store.settings?.cardNumber||'در تنظیمات وارد نشده')}</b>
      <br>
      به نام:
      ${esc(store.settings?.cardName||'')}
    `;
  }

  if($('#msg')) $('#msg').textContent='';

  if($('#modal')) $('#modal').classList.remove('hidden');
};

window.closeModal=function(){
  if($('#modal')) $('#modal').classList.add('hidden');
};

const form=$('#orderForm');

if(form){
  form.addEventListener('submit',async e=>{
    e.preventDefault();

    const file=$('#receipt')?.files?.[0];

    if(!file){
      if($('#msg')) $('#msg').textContent='❌ لطفاً رسید پرداخت را انتخاب کنید.';
      return;
    }

    const f=new FormData();

    f.append('productId',$('#pid').value);
    f.append('customerName',$('#name').value);
    f.append('customerContact',$('#contact').value);
    f.append('receipt',file);

    try{
      const r=await fetch('/api/orders',{
        method:'POST',
        body:f
      });

      const j=await r.json();

      if(!r.ok){
        if($('#msg')) $('#msg').textContent='❌ '+(j.error||'خطا در ثبت سفارش');
        return;
      }

      if($('#msg')){
        $('#msg').textContent=
          '✅ سفارش ثبت شد. بعد از بررسی رسید، تحویل انجام می‌شود.';
      }

      e.target.reset();

      await load();

    }catch(err){
      console.error(err);

      if($('#msg')){
        $('#msg').textContent='❌ خطا در ارتباط با سرور';
      }
    }
  });
}

load();
