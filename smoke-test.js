'use strict';
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const port = 15000 + Math.floor(Math.random() * 20000);
  const dataFile = path.join(os.tmpdir(), `sami-smoke-${process.pid}-${Date.now()}.json`);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), DATA_FILE: dataFile, ADMIN_PASSWORD: 'smoke-test-password' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let logs = '';
  child.stdout.on('data', x => { logs += x.toString(); });
  child.stderr.on('data', x => { logs += x.toString(); });
  const base = `http://127.0.0.1:${port}`;
  const request = async (url, options) => {
    const response = await fetch(base + url, options);
    const text = await response.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    return { response, body };
  };
  try {
    let ready = false;
    for (let i = 0; i < 50; i++) {
      if (child.exitCode !== null) throw new Error(`Server exited early. ${logs}`);
      try { const r = await fetch(base + '/health'); if (r.ok) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    assert.equal(ready, true, `Server did not start. ${logs}`);
    const health = await request('/health'); assert.equal(health.body.ok, true);
    const config = await request('/api/config'); assert.equal(config.response.status, 200); assert.ok(Array.isArray(config.body.services)); assert.ok(config.body.services.length >= 1);
    const page = await request('/'); assert.equal(page.response.status, 200); assert.match(page.body, /Sami WireGuard/);
    const adminPage = await request('/admin'); assert.equal(adminPage.response.status, 200); assert.match(adminPage.body, /پنل مدیریت سامی/);
    const badPing = await request('/api/ping?target=not-a-target'); assert.equal(badPing.response.status, 400);
    const pingResults = await Promise.all(['cloudflare','google','dns'].map(t => request('/api/ping?target='+t)));
    for (const ping of pingResults) { assert.equal(ping.response.status, 200); assert.equal(typeof ping.body.ok, 'boolean'); }
    const login = await request('/api/admin/login', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({password:'smoke-test-password'}) });
    assert.equal(login.response.status, 200); assert.ok(login.body.token);
    const auth = { 'content-type':'application/json', authorization:`Bearer ${login.body.token}` };
    const adminConfig = await request('/api/admin/config', { headers: auth }); assert.equal(adminConfig.response.status, 200);
    const order = await request('/api/orders', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({serviceId:'wireguard',planId:'wg10',username:'smoke'}) });
    assert.equal(order.response.status, 200); assert.equal(order.body.ok, true); assert.match(order.body.order.id, /^SW-/);
    const orders = await request('/api/admin/orders', { headers: auth }); assert.equal(orders.response.status, 200); assert.equal(orders.body.length, 1);
    const update = await request('/api/admin/orders/'+encodeURIComponent(order.body.order.id), { method:'PATCH', headers:auth, body:JSON.stringify({status:'approved'}) }); assert.equal(update.response.status, 200); assert.equal(update.body.order.status, 'approved');
    const css = await request('/style.css'); assert.equal(css.response.status, 200); assert.match(css.body, /bottom/);
    const js = await request('/app.js'); assert.equal(js.response.status, 200); assert.match(js.body, /runPing/);
    console.log('SMOKE TEST PASSED: health, storefront, CSS/JS assets, admin, config, all three ping targets, order creation/listing/status update.');
  } catch (error) {
    console.error('SMOKE TEST FAILED:', error.message);
    process.exitCode = 1;
  } finally {
    child.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 150));
    try { fs.unlinkSync(dataFile); } catch {}
  }
})();
