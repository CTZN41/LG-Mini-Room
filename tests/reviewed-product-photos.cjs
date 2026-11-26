const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {chromium} = require('playwright');
const {models, secondaryRows} = require('../data/reviewed-product-photos.json');

const base = process.argv[2] || 'http://127.0.0.1:4183';

async function verifyCatalog() {
  const index = await (await fetch(base + '/api/catalog/models')).json();
  const active = new Set(index.map(row => JSON.stringify(row)));
  for (const item of models) {
    const key = {category: item.category, model: item.model};
    const keep = item.decision === 'keep';
    assert.equal(active.has(JSON.stringify([key.category, key.model])), keep, key.model);
    const list = await (await fetch(base + '/api/catalog?' + new URLSearchParams({category: key.category, q: key.model}))).json();
    assert.equal(list.rows.some(row => row.model === key.model), keep, key.model);
    for (const query of [key, ...item.before.map(row => ({id: row.id}))]) {
      const response = await fetch(base + '/api/catalog/photo?' + new URLSearchParams(query));
      assert.equal(response.status, keep ? 200 : 404, key.model);
      if (keep) {
        const data = Buffer.from(await response.arrayBuffer());
        assert.equal(createHash('sha256').update(data).digest('hex'), item.sha256, key.model);
      }
    }
  }
  for (const item of secondaryRows) {
    assert.ok(active.has(JSON.stringify([item.category,item.model])), item.model);
    for (const {id} of item.before) {
      const response = await fetch(base + '/api/catalog/photo?id=' + id);
      assert.equal(response.status, item.decision === 'keep' ? 200 : 404);
      if (response.ok) {
        assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'), item.sha256);
      }
    }
  }
  console.log('PASS', models.length, 'review decisions, search, original IDs and image hashes');
}

async function verifyStorage(browser, width, height) {
  const page = await browser.newPage({viewport: {width,height}, isMobile: true, hasTouch: true});
  try {
    await page.goto(base + '/editor?space=dream&room=C');
    const ready = () => page.waitForSelector('#rooms button');
    await ready();
    const kept = 'catalog:tv:42LS75C', removed = ['catalog:dryer:RV1029C4T%2FC7T','catalog:purifier:LZ-H154GB','catalog:purifier:Z-E0250U2SC','catalog:tv:65EP5G','catalog:tv:55CT5WN'];
    await page.evaluate(async ({kept,removed}) => {
      const {update} = await import('/state.js');
      update(s => {s.collection = [kept,...removed];});
      const raw = JSON.parse(localStorage.dotroom);
      raw.layouts.A = [kept,...removed,'sofa'].map((k,i) => ({
        id: 8000+i, k, x: 8+i*12, y: 16, turn: 0, f: 0, e: 0,
        ...(k === 'sofa' ? {routineIds:['movie-night']} : {})
      }));
      localStorage.dotroom = JSON.stringify(raw);
    }, {kept,removed});
    for (let i=0; i<2; i++) {
      await page.reload();
      await ready();
      const result = await page.evaluate(async () => ({
        collection: (await import('/state.js')).state.collection,
        layout: JSON.parse(localStorage.dotroom).layouts.A,
      }));
      assert.ok(result.collection.includes(kept));
      for (const key of removed) assert.ok(!result.collection.includes(key),key);
      assert.deepEqual(result.layout.map(o => o.k), [kept,'sofa']);
      assert.deepEqual(result.layout[1].routineIds, ['movie-night']);
    }
    console.log('PASS Chrome touch',width,height,'saved room, sofa routine and two reloads');
  } finally { await page.close(); }
}

(async () => {
  await verifyCatalog();
  const browser = await chromium.launch({channel:'chrome'});
  try {
    for (const [w,h] of [[320,568],[390,844]]) await verifyStorage(browser,w,h);
  } finally { await browser.close(); }
})().catch(e => {console.error(e); process.exitCode=1;});
