const assert = require('node:assert/strict');
const withServer = require('./member-server.cjs');

withServer(async base => {
  const camera = 'https://lg-camera-lab.pages.dev';
  const res = await fetch(base + '/api/catalog/camera-products', {headers: {Origin: camera}});
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), camera);
  const products = await res.json();
  assert.ok(Array.isArray(products) && products.length > 1000, 'camera list from the Mini Room DB');

  // Same shape as the camera's products.json, one entry per model code.
  const codes = new Set();
  for (const p of products) {
    for (const field of ['id', 'brand', 'displayName', 'modelCode', 'category', 'source'])
      assert.ok(typeof p[field] === 'string' && p[field].trim(), `${p.modelCode} ${field}`);
    assert.ok(!/\s/.test(p.modelCode));
    assert.ok(!codes.has(p.modelCode.toUpperCase()), 'duplicate ' + p.modelCode);
    codes.add(p.modelCode.toUpperCase());
    for (const label of p.labelCodes ?? []) assert.equal(label.split('.')[0], p.modelCode.toUpperCase());
  }
  const dryer = products.find(p => p.modelCode === 'RD21GSGR');
  assert.ok(dryer?.labelCodes.includes('RD21GSGR.AKOR'), 'verified label code resolves to the unit');
  assert.ok((await fetch(base + dryer.imageUrl)).ok, 'product photo from the Mini Room');
  for (const code of ['RG19WNX', 'FX4EC', 'KX23GNRENER', 'LZ-H154GB', '27U411A'])
    assert.ok(!codes.has(code), code + ' is not offered to the camera');

  // Every listed model is one the scan lookup accepts as the same unit.
  for (const p of products.filter((_, i) => i % 25 === 0).concat(dryer)) {
    const hit = await (await fetch(base + '/api/catalog/scan?' + new URLSearchParams({code: p.modelCode}))).json();
    assert.deepEqual([hit.status, hit.model, hit.category], ['collectible', p.modelCode, p.category], p.modelCode);
  }

  // CORS only for the camera: public site, preview deployments and local test servers.
  const allow = async origin => (await fetch(base + '/api/catalog/scan?code=RD21GSGR', {headers: {Origin: origin}})).headers.get('access-control-allow-origin');
  assert.equal(await allow('https://fix-fast-scan.lg-camera-lab.pages.dev'), 'https://fix-fast-scan.lg-camera-lab.pages.dev');
  assert.equal(await allow('http://localhost:5173'), 'http://localhost:5173');
  assert.equal(await allow('https://evil.example'), null);
  assert.equal(await allow('https://lg-camera-lab.pages.dev.evil.example'), null);
  assert.equal((await fetch(base + '/api/catalog/models', {headers: {Origin: camera}})).headers.get('access-control-allow-origin'), null);
  console.log('PASS camera product list from the Mini Room DB, scan-consistent entries, label codes, photos and camera-only CORS');
}).catch(error => { console.error(error); process.exitCode = 1; });
