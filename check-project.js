const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const required = ['package.json','server.js','README.md','.env.example','public/index.html','public/app.js','public/style.css','public/admin.html','FEATURE_MATRIX_FA.md'];
let failed = false;
for (const file of required) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) { console.error('MISSING:', file); failed = true; }
  else console.log('OK file:', file);
}
function checkJs(file, source) {
  const tmp = path.join(require('os').tmpdir(), `sami-check-${process.pid}-${Math.random().toString(16).slice(2)}.js`);
  fs.writeFileSync(tmp, source);
  const r = spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
  fs.rmSync(tmp, { force: true });
  if (r.status !== 0) { console.error('JS SYNTAX ERROR:', file, r.stderr || r.stdout); failed = true; }
  else console.log('OK syntax:', file);
}
for (const f of ['server.js','public/app.js']) checkJs(f, fs.readFileSync(path.join(root,f),'utf8'));
const admin = fs.readFileSync(path.join(root,'public/admin.html'),'utf8');
const scripts = [...admin.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
if (!scripts.length) { console.error('MISSING inline admin script'); failed = true; }
for (let i=0;i<scripts.length;i++) checkJs(`public/admin.html inline script ${i+1}`, scripts[i][1]);
try {
 const pkg = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
 if (!pkg.scripts?.start || !pkg.dependencies?.express) throw new Error('package.json needs start script and express dependency');
 console.log('OK package.json');
} catch(e) { console.error('PACKAGE ERROR:', e.message); failed = true; }
if (failed) process.exit(1);
console.log('\nStatic project checks passed. This does not prove live Telegram, payment-gateway, supplier-panel, or Render connectivity.');
