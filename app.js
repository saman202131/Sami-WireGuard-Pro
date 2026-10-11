const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); try { tg.setHeaderColor("#080b14"); tg.setBackgroundColor("#080b14"); } catch (_) {} }
let config = null;
const $ = id => document.getElementById(id);
const money = n => new Intl.NumberFormat("fa-IR").format(Number(n)||0) + " تومان";
const user = tg?.initDataUnsafe?.user || {};
function toast(message){ const t=$("toast");t.textContent=message;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2800); }
function openModal(html){ $("modalContent").innerHTML=html; $("modalBackdrop").classList.add("show"); }
function closeModal(){ $("modalBackdrop").classList.remove("show"); }
$("closeModal").onclick=closeModal;
$("modalBackdrop").addEventListener("click",e=>{if(e.target===$("modalBackdrop"))closeModal();});
$("profileBtn").onclick=()=>openModal(`<h2>حساب کاربری</h2><p class="sub">اطلاعات حساب تلگرام شما</p><div class="notice">نام: ${escapeHtml(user.first_name||"کاربر مهمان")}<br>شناسه تلگرام: ${escapeHtml(user.id||"در دسترس نیست")}<br><br>برای مشاهده اطلاعات کامل سرویس‌ها، سفارش را با همین حساب ثبت کنید.</div>`);
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function render(){
 $("announcement").textContent=config.announcement||"سرویس دلخواهت را انتخاب کن و در چند مرحله سفارش بده.";
 const host=$("services");
 const enabled=config.services.filter(s=>s.enabled);
 const disabled=config.services.filter(s=>!s.enabled);
 host.innerHTML=[...enabled,...disabled].map(s=>{
   const price=s.plans.length?Math.min(...s.plans.map(p=>p.price)):0;
   const accent={blue:"#69aaff",purple:"#b49aff",cyan:"#5de9e3"}[s.accent]||"#69aaff";
   return `<article class="service-card" style="--accent:${accent}">
    <div class="service-head"><div class="service-icon">${escapeHtml(s.icon)}</div><div class="service-title"><h3>${escapeHtml(s.name)}</h3><p>${escapeHtml(s.subtitle)}</p></div><span class="badge">${s.enabled?"آماده سفارش":"غیرفعال"}</span></div>
    <div class="service-bottom"><div>${s.enabled?`<small>شروع قیمت از</small><b>${money(price)}</b>`:`<span class="disabled-note">فعلاً غیرفعال است</span>`}</div><button class="primary-btn" ${s.enabled?"":"disabled"} data-service="${s.id}">${s.enabled?"مشاهده بسته‌ها":"غیرفعال"}</button></div>
   </article>`;
 }).join("")||'<div class="loading">هنوز سرویسی ثبت نشده است.</div>';
 host.querySelectorAll("[data-service]").forEach(btn=>btn.onclick=()=>showPlans(btn.dataset.service));
}
function showPlans(id){
 const s=config.services.find(x=>x.id===id);if(!s||!s.enabled)return;
 openModal(`<h2>${escapeHtml(s.name)}</h2><p class="sub">${escapeHtml(s.subtitle)} · بسته موردنظرت را انتخاب کن</p>
 ${s.plans.map(p=>`<div class="plan"><div class="plan-info"><b>${escapeHtml(p.title)}</b><small>${escapeHtml(p.volume)} · ${p.days} روز اعتبار</small></div><span class="price">${money(p.price)}</span><button class="primary-btn" data-plan="${escapeHtml(p.id)}">انتخاب</button></div>`).join("")}
 <div class="notice">با انتخاب بسته، درخواست سفارش ثبت می‌شود. پرداخت آنلاین و صدور خودکار سرویس تا زمان اتصال درگاه پرداخت و API پنل شما فعال نیست.</div>`);
 $("modalContent").querySelectorAll("[data-plan]").forEach(btn=>btn.onclick=()=>createOrder(id,btn.dataset.plan));
}
async function createOrder(serviceId,planId){
 try{
  const r=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({serviceId,planId,telegramUserId:user.id||"",username:user.username||""})});
  const d=await r.json();if(!r.ok)throw Error(d.error||"ثبت سفارش انجام نشد");
  openModal(`<h2>درخواست ثبت شد ✓</h2><p class="sub">شماره سفارش شما</p><div class="notice" style="text-align:center;font-size:18px;color:#a9d0ff">${escapeHtml(d.order.id)}</div><div class="notice">وضعیت: در انتظار بررسی مدیر<br>این نسخه سفارش را ثبت می‌کند اما پرداخت و صدور خودکار هنوز به پنل و درگاه شما متصل نشده است.</div><button class="primary-btn wide" id="doneBtn">متوجه شدم</button>`);
  $("doneBtn").onclick=closeModal;
 }catch(e){toast(e.message||"خطا در ثبت سفارش");}
}
$("ordersBtn").onclick=()=>openModal(`<h2>سفارش‌های من</h2><p class="sub">برای پیگیری وضعیت سفارش با پشتیبانی در ارتباط باش.</p><div class="notice">این نسخه اولیه هنوز ورود امن تلگرام و نمایش سفارش‌های شخصی را کامل نکرده است. سفارش ثبت‌شده با شماره سفارش قابل پیگیری است.</div><a class="primary-btn wide" style="display:block;text-align:center;text-decoration:none" href="https://t.me/saman_s87" target="_blank">پیگیری از پشتیبانی</a>`);
async function load(){
 try{const r=await fetch("/api/config");config=await r.json();render();}
 catch{ $("services").innerHTML='<div class="loading">بارگذاری ناموفق بود؛ صفحه را دوباره باز کن.</div>'; }
}
load();
