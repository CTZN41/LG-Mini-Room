const assert = require('node:assert/strict');
const withServer = require('./member-server.cjs');

withServer(async base => {
  async function lookup(code, expectedStatus) {
    const res = await fetch(base + '/api/catalog/scan?' + new URLSearchParams({code}));
    assert.equal(res.status, 200, code);
    const result = await res.json();
    assert.equal(result.status, expectedStatus, code);
    return result;
  }
  assert.equal((await lookup(' rd21gsg ', 'collectible')).model, 'RD21GSG');
  assert.equal((await lookup('55LX1QKNA', 'collectible')).model, '55LX1QKNA');
  assert.equal((await lookup('RD21GSGR', 'collectible')).model, 'RD21GSGR');
  assert.equal((await lookup('rd21gsgr.akor', 'collectible')).model, 'RD21GSGR');
  for(const code of ['RD21GSGR-KG','RD21GSGR-KG.AKOR','RD21GSGR.BAD','27U411A-BD.CKRRMV'])
    await lookup(code, 'not_found');
  assert.equal((await lookup('27LX6TPGAF', 'collectible')).model, '27LX6TPGAF');
  assert.ok((await lookup('RG19WNX', 'review_required')).reasons.includes('sale_package'));
  const browse=await (await fetch(base+'/api/catalog?'+new URLSearchParams({category:'건조기',q:'RG19WN'}))).json();
  assert.ok(browse.rows.some(row=>row.model==='RG19WN'));
  assert.ok(!browse.rows.some(row=>row.model==='RG19WNX'));
  assert.ok((await lookup('FX4EC', 'review_required')).reasons.includes('mini_wash'));
  assert.ok((await lookup('KX23GNRENER', 'review_required')).reasons.includes('retired_sale'));
  assert.ok((await lookup('LZ-H154GB', 'review_required')).reasons.includes('excluded'));
  await lookup('ZZTEST9999', 'not_found');
  assert.equal((await fetch(base+'/api/catalog/scan?code=')).status, 400);
  const models = await (await fetch(base+'/api/catalog/models')).json();
  assert.ok(models.some(([,model]) => model === 'RD21GSG'));
  assert.ok(!models.some(([,model]) => model === '27U411A'));
  const origin='https://lg-camera-lab.pages.dev';
  const feedResponse=await fetch(base+'/api/catalog/camera-products',{headers:{Origin:origin}});
  assert.equal(feedResponse.headers.get('access-control-allow-origin'),origin);
  const feed=await feedResponse.json();
  const inventory=await (await fetch(base+'/api/catalog/models?labels=1')).json();
  const supported=inventory.filter(row=>!row[6]);
  assert.deepEqual(new Set(feed.map(p=>p.modelCode)),new Set(supported.map(row=>row[1])));
  const labels=new Set();
  for(const p of feed){
    for(const key of ['id','brand','displayName','modelCode','category','source'])assert.ok(p[key]?.trim());
    for(const code of [p.modelCode,...p.labelCodes]){
      assert.ok(!labels.has(code),code); labels.add(code);
    }
  }
  const dryer=feed.find(p=>p.modelCode==='RD21GSGR');
  assert.ok(dryer.labelCodes.includes('RD21GSGR.AKOR'));
  const registered=await lookup('RD21GSGR.AKOR','collectible');
  assert.equal(String(registered.id),dryer.id);
  assert.equal(registered.displayName,dryer.displayName);
  assert.ok(!feed.some(p=>p.modelCode==='RG19WNX'));
  const denied=await fetch(base+'/api/catalog/scan?code=RD21GSGR',{headers:{Origin:'https://other.example'}});
  assert.equal(denied.headers.get('access-control-allow-origin'),null);
  console.log('Shared catalog:',feed.length,'models and',labels.size-feed.length,'verified label aliases');
  console.log('PASS unified camera lookup, verified unit aliases, package rejection, exclusions and inventory isolation');
}).catch(error => { console.error(error); process.exitCode = 1; });
