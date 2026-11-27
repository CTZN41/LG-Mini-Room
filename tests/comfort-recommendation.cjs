const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:4174';

const cases=[
  {category:'에어컨', model:'FQ16ET4HSN', key:'catalog:ac:FQ16ET4HSN', routine:'쾌적한 방', action:'air-cool', operation:'냉방'},
  {category:'로봇청소기', model:'R560BL1', key:'catalog:robot:R560BL1', routine:'청소 시간', action:'robot-clean', operation:'바닥 청소'}
];

async function check(browser, width, height, spec) {
  const page = await browser.newPage({viewport:{width,height}, isMobile:true, hasTouch:true, reducedMotion:'reduce'});
  const primary = {category:spec.category, modelCode:spec.model, id:'my-primary', name:'거실 '+spec.category};
  const purifier = {category:'공기청정기', modelCode:'AS235DWSA', id:'my-pure', name:'거실 공청기'};
  // Same model, separate device ID, and no supported command on the first unit.
  const readOnly = {...primary,id:'read-only',name:'조회 전용 '+spec.category,capability:'read-only'};
  let registered = [readOnly,purifier];
  const writes=[], errors=[];
  page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.method())});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/my-appliances',r=>r.fulfill({json:{mode:'thinq',devices:registered}}));
  page.setDefaultTimeout(8000);
  const button=name=>page.getByRole('button',{name,exact:true});
  const tap=name=>button(name).tap();
  const pixels=()=>page.locator('#scene').evaluate(c=>c.toDataURL());
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('lg-miniroom.state.thinq')||'{}').savedRoutines||[]);
  try {
    await page.goto(base+'/editor?space=my');await button('＋ 추가').waitFor();
    assert.equal(await button(spec.routine+' 추천').count(),0);
    registered=[readOnly,primary,purifier];await page.reload();
    await tap('내 가전으로 가능한 루틴 1개 보기');await tap(spec.routine+' 추천');assert.ok(await button('미리보기').isDisabled());
    assert.equal(await button(readOnly.name+' 배치').count(),0);
    await tap('닫기');assert.deepEqual(await saved(),[]);

    await page.goto(base+'/editor?space=dream');
    async function collect(key){
      await tap('가전 수집');
      await page.locator('#libraryItems [data-product="'+key+'"] button').tap();
      await tap('가전 목록 닫기');
    }
    await collect(spec.key);assert.equal(await button(spec.routine+' 미리보기').count(),0);
    await collect('catalog:purifier:AS235DWSA');
    await tap(spec.category+' 배치');await tap('배치 완료');
    await tap('공기청정기 배치');await tap('배치 완료');
    const dream=await pixels();
    await tap(spec.routine+' 미리보기');await button('재생 종료').waitFor();
    assert.match(await page.locator('#lifeDetail').innerText(),new RegExp(spec.operation+'.*자동 청정.*실제 가전은 작동하지 않아요'));
    assert.notEqual(await pixels(),dream);
    await page.goBack();await button(spec.routine+' 미리보기').waitFor();assert.equal(await pixels(),dream);
    await tap(spec.routine+' 미리보기');await tap('내 방에 맞추기');
    await tap('등록 '+spec.category+' 배치');await tap('등록 공기청정기 배치');
    assert.equal(await page.getByLabel(spec.category+' · 필수').inputValue(),primary.id);
    assert.equal(await page.getByLabel('공기청정기 · 선택').inputValue(),purifier.id);
    const before=await pixels();
    await tap('미리보기');await button('내 루틴에 저장').waitFor();
    assert.notEqual(await pixels(),before);
    await tap('재생 종료');await button('미리보기').waitFor();
    assert.deepEqual(await saved(),[]);assert.equal(await pixels(),before);
    await tap('미리보기');await tap('내 루틴에 저장');await button(spec.routine).waitFor();
    assert.equal(await button(spec.routine+' 추천').count(),0);
    assert.equal(await pixels(),before);
    await page.reload();await tap(spec.routine);await button('재생 종료').waitFor();
    const records=await saved();assert.equal(records.length,1);
    assert.deepEqual(records[0].bindings,{[spec.action]:primary.id,'air-clean':purifier.id});
    await tap('재생 종료');await button(spec.routine).waitFor();
    assert.deepEqual(await saved(),records);assert.equal(await pixels(),before);
    registered=[primary];await page.reload();await tap(spec.routine);
    assert.match(await page.locator('#lifeDetail').innerText(),/공기청정기 제외/);
    await tap('재생 종료');assert.deepEqual(await saved(),records);
    const replacement={...primary,id:'replacement',name:'침실 '+spec.category};
    registered=[readOnly,replacement];await page.reload();await tap(spec.routine);
    const picker=page.getByLabel('대체 '+spec.category);
    assert.deepEqual(await picker.locator('option').allTextContents(),['기기 선택',replacement.name]);
    await picker.selectOption(replacement.id);await tap('취소');assert.deepEqual(await saved(),records);
    await tap(spec.routine);await picker.selectOption(replacement.id);await tap('연결 변경');
    const updated={...records[0],bindings:{...records[0].bindings,[spec.action]:replacement.id}};
    assert.deepEqual(await saved(),[updated]);
    assert.match(await button(spec.routine).innerText(),/다시 놓기/);
    await tap(spec.routine);assert.equal(await page.locator('#bagPlacementName').innerText(),replacement.name);
    await tap('여기에 놓기');await tap(spec.routine);
    assert.match(await page.locator('#lifeDetail').innerText(),new RegExp(replacement.name+'.*공기청정기 제외'));
    await tap('재생 종료');assert.deepEqual(await saved(),[updated]);
    assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
    console.log('PASS',width,height,spec.routine,'recommendation, capability filter, collect/place, preview/back, match own units, save/reload/replay');
  } finally {await page.context().close()}
}

(async()=>{
  const browser=await chromium.launch({channel:'chrome'});
  try {for(const [w,h] of [[320,568],[390,844]])for(const spec of cases)await check(browser,w,h,spec)}
  finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
