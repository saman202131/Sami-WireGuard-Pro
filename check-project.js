const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const root = path.resolve(__dirname, '..');
const required = ['package.json','server.js','README.md','.env.example','public/index.html','public/app.js','public/style.css','public/admin.html','FEATURE_MATRIX_FA.md','FEATURE_BACKLOG_FA.md'];
let bad = false;
for (const f of required) { if (!fs.existsSync(path.join(root,f))) { console.error('MISSING', f); bad=true; } else console.log('OK file:',f); }
for (const f of ['server.js','public/app.js']) { try { cp.execFileSync(process.execPath,['--check',path.join(root,f)],{stdio:'pipe'}); console.log('OK syntax:',f); } catch(e) { console.error('SYNTAX ERROR:',f,e.stderr?.toString()||e.message); bad=true; } }
const html=fs.readFileSync(path.join(root,'public/admin.html'),'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
for(let i=0;i<scripts.length;i++){const f=path.join(root,`.inline-admin-${i}.js`);fs.writeFileSync(f,scripts[i][1]);try{cp.execFileSync(process.execPath,['--check',f],{stdio:'pipe'});console.log('OK syntax: public/admin.html inline script',i+1);}catch(e){console.error('SYNTAX ERROR: admin inline script',i+1,e.stderr?.toString()||e.message);bad=true;}finally{fs.rmSync(f,{force:true});}}
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const routes=['/api/profile/:userId','/api/user/orders/:userId','/api/referrals/code','/api/referrals/claim','/api/admin/customers','/api/admin/customers/:userId/block','/api/admin/notifications','/api/admin/export/orders.csv','/api/admin/export/customers.csv','/api/admin/roles','/api/admin/system','/api/admin/providers/:id/check','/api/admin/catalog','/api/admin/roulette/history','/api/admin/queue','/api/admin/health','/api/gamer/hub','/api/gamer/daily-claim','/api/reviews','/api/admin/reviews','/api/admin/gift-cards','/api/gift-cards/redeem'];
for(const r of routes){if(!server.includes(r)){console.error('MISSING ROUTE:',r);bad=true}else console.log('OK route:',r)}
const backlog=fs.readFileSync(path.join(root,'FEATURE_BACKLOG_FA.md'),'utf8');
for(const marker of ['## 1) اتصال سایت، ربات و Mini App','## 7) هوش مصنوعی و خودکارسازی','## 8) امنیت، حریم خصوصی و ضدتقلب','## 9) پایداری، تست و استقرار','## معیار تکمیل']){if(!backlog.includes(marker)){console.error('MISSING BACKLOG SECTION:',marker);bad=true}else console.log('OK backlog section:',marker)}
if(!fs.readFileSync(path.join(root,'package.json'),'utf8').includes('"express"')){console.error('MISSING express dependency');bad=true;}
const appJs=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const designAdmin=fs.readFileSync(path.join(root,'public/admin.html'),'utf8');
const css=fs.readFileSync(path.join(root,'public/style.css'),'utf8');
for(const marker of ['designTheme','catalogMode']){if(!server.includes(marker)||!appJs.includes(marker)){console.error('MISSING design setting:',marker);bad=true}else console.log('OK design setting:',marker)}
for(const theme of ['gamer','minimal','luxury','cyber','secure']){if(!designAdmin.includes('data-design=\"'+theme+'\"')||!css.includes('body.theme-'+theme)){console.error('MISSING design preset:',theme);bad=true}else console.log('OK design preset:',theme)}
for(const mode of ['all','wireguard','dns','vitory']){if(!designAdmin.includes('data-mode=\"'+mode+'\"')){console.error('MISSING catalog mode:',mode);bad=true}else console.log('OK catalog mode:',mode)}
if(!appJs.includes('confirmPlanPurchase')||!appJs.includes('checkoutCoupon')){console.error('MISSING custom checkout confirmation flow');bad=true}else console.log('OK custom checkout confirmation flow');
const safePublicFn=server.slice(server.indexOf('function safePublic'),server.indexOf('function adminOnly'));
if(!safePublicFn.includes('map(p => ({ label: String(p.label')||safePublicFn.includes('weight: p.weight')){console.error('Roulette odds may leak to public config');bad=true}else console.log('OK roulette odds are hidden from public config');
for(const preset of ['neon','arcade','minimal','gold','cyber']){if(!server.includes('\"'+preset+'\"')||!designAdmin.includes('value=\"'+preset+'\"')){console.error('MISSING roulette design preset:',preset);bad=true}else console.log('OK roulette design preset:',preset)}
for(const preset of ['gamer','minimal','glass','arcade','luxury']){if(!server.includes('\"'+preset+'\"')||!designAdmin.includes('value=\"'+preset+'\"')||!css.includes('.checkout-design-'+preset)){console.error('MISSING checkout design preset:',preset);bad=true}else console.log('OK checkout design preset:',preset)}
if(appJs.includes('\x08')){console.error('INVALID control character in app.js');bad=true}

if(server.includes('/api/integration/')||server.includes('/api/admin/integration')||server.includes('/api/connection/status')||fs.readFileSync(path.join(root,'public/admin.html'),'utf8').includes('connectionPanel')){console.error('Bot/site integration UI or routes still present');bad=true}else console.log('OK bot/site integration removed from website');
const adminHtml=fs.readFileSync(path.join(root,'public/admin.html'),'utf8');
for(const marker of ['customersPanel','refreshCustomers','couponExpiry','data-customer-block']){if(!adminHtml.includes(marker)){console.error('MISSING admin capability:',marker);bad=true}else console.log('OK admin capability:',marker)}
if(!server.includes('/api/admin/customers/:userId/block')||!server.includes('blockedUsers')){console.error('MISSING customer moderation backend');bad=true}else console.log('OK customer moderation backend');
if(bad)process.exit(1);console.log('Static project checks passed. Runtime/Render/Telegram/payment/provider connectivity require live environment testing.');
