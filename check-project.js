const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const root = path.resolve(__dirname, '..');
const required = ['package.json','server.js','README.md','.env.example','public/index.html','public/app.js','public/style.css','public/admin.html','FEATURE_MATRIX_FA.md'];
let bad = false;
for (const f of required) { if (!fs.existsSync(path.join(root,f))) { console.error('MISSING', f); bad=true; } else console.log('OK file:',f); }
for (const f of ['server.js','public/app.js']) { try { cp.execFileSync(process.execPath,['--check',path.join(root,f)],{stdio:'pipe'}); console.log('OK syntax:',f); } catch(e) { console.error('SYNTAX ERROR:',f,e.stderr?.toString()||e.message); bad=true; } }
const html=fs.readFileSync(path.join(root,'public/admin.html'),'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
for(let i=0;i<scripts.length;i++){const f=path.join(root,`.inline-admin-${i}.js`);fs.writeFileSync(f,scripts[i][1]);try{cp.execFileSync(process.execPath,['--check',f],{stdio:'pipe'});console.log('OK syntax: public/admin.html inline script',i+1);}catch(e){console.error('SYNTAX ERROR: admin inline script',i+1,e.stderr?.toString()||e.message);bad=true;}finally{fs.rmSync(f,{force:true});}}
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const routes=['/api/profile/:userId','/api/user/orders/:userId','/api/referrals/code','/api/referrals/claim','/api/admin/customers','/api/admin/notifications','/api/admin/export/orders.csv','/api/admin/export/customers.csv','/api/admin/roles','/api/admin/system','/api/admin/providers/:id/check','/api/admin/catalog','/api/admin/roulette/history','/api/admin/queue','/api/admin/health','/api/integration/orders'];
for(const r of routes){if(!server.includes(r)){console.error('MISSING ROUTE:',r);bad=true}else console.log('OK route:',r)}
if(!fs.readFileSync(path.join(root,'package.json'),'utf8').includes('"express"')){console.error('MISSING express dependency');bad=true;}
if(bad)process.exit(1);console.log('Static project checks passed. Runtime/Render/Telegram/payment/provider connectivity require live environment testing.');
