const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:4173';

async function check(browser,width,height){
  const page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true,
    reducedMotion:width===320?'reduce':'no-preference'});
  page.setDefaultTimeout(7000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const button=name=>page.getByRole('button',{name,exact:true});
  const tap=name=>button(name).tap();
  const bag=page.locator('#bagRows');
  await page.route('**/api/my-appliances',r=>r.fulfill({json:{mode:'demo'}}));
  await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{
    const paint=DotScene.paint;
    DotScene.paint=function(...args){window.renderedRoom=args[5];return paint(...args)};
  }));
  const go=space=>page.goto(base+'/editor?space='+space);
  const pixels=()=>page.locator('#scene').evaluate(c=>c.toDataURL());
  async function collect(name){
    await tap('가전 수집');await page.locator('#libraryItems [data-product="'+name+'"] button').tap();await tap('방에 놓기');
  }
  try{
    await go('dream');await collect('catalog:tv:55LX1QKNA');
    assert.match(await page.locator('#comboHint').innerText(),/영화 보기 가능 · TV 켜기/);
    await tap('소품');await page.locator('#products [data-key=floor_lamp]').tap();
    assert.match(await page.locator('#comboHint').innerText(),/영화 보기에 추가 · 조명 밝기 30%/);
    await page.locator('#remove').tap();await page.reload();await tap('배치 편집');await tap('소품');
    await page.locator('#products [data-key=floor_lamp]').tap();
    assert.equal(await page.locator('#comboHint').innerText(),'');
    await page.evaluate(async()=>{
      const {update}=await import('/state.js');
      update(s=>{s.myFixtureId='sample-home-v1';s.myLayout['light-slot']='my-light-1';s.registeredTvIds=[]});
    });
    await go('my');await tap('배치 편집');await tap('소품');await page.locator('[data-key=floor_lamp]').tap();
    await tap('다른 제품 놓기');await tap('가구');await page.locator('[data-key=bed]').tap();await tap('배치 완료');
    const key='lg-miniroom.dot.my';
    const bed=await page.evaluate(key=>JSON.parse(localStorage[key]).layouts.B.find(o=>o.k==='bed'),key);
    // Open the bed through the room's accessible object selector.
    await page.locator('#view').focus();
    for(let i=0;i<4;i++){
      await page.keyboard.press('ArrowRight');
      if((await page.locator('#keyboardTarget').innerText()).includes('침대'))break;
    }
    await page.keyboard.press('Enter');await tap('취침 모드 만들기');
    await tap('미리보기');
    await page.waitForFunction(id=>renderedRoom?.sleepBed===id&&renderedRoom.tucked===1,bed.id);
    await tap('저장하고 이 침대에 연결');await tap('닫기');
    await tap('＋ 추가');await tap('직접 만들기');await page.getByLabel('루틴 이름').fill('취침 모드');
    await page.getByRole('combobox',{name:'거실 조명',exact:true}).selectOption('light-dim');
    await tap('미리보기');await tap('내 루틴에 저장');await page.reload();await tap('인벤토리');
    const cards=bag.locator('article[data-routine-id]');
    await cards.nth(1).waitFor();
    const ids=await cards.evaluateAll(nodes=>nodes.map(n=>n.dataset.routineId));
    assert.equal(new Set(ids).size,2);
    await cards.nth(0).locator('.routine-card').tap();
    assert.equal(await cards.nth(0).locator('.routine-orb.compatible').count(),1);
    assert.match(await cards.nth(0).innerText(),/전체 적용 가능/);
    assert.match(await cards.nth(0).innerText(),/취침 모드 \(1\).*조명 끄기/s);
    await cards.nth(1).locator('.routine-card').tap();
    assert.match(await cards.nth(1).innerText(),/취침 모드 \(2\).*밝기 30%/s);
    const card=id=>bag.locator('[data-routine-id="'+id+'"]');
    const original=await pixels();
    await card(ids[0]).locator('.routine-card').tap();
    await card(ids[0]).getByRole('button',{name:'실행',exact:true}).tap();
    await page.waitForFunction(id=>renderedRoom?.sleepBed===id&&renderedRoom.tucked===1,bed.id);
    assert.ok((await pixels())!==original,'취침 장면 표시');
    await page.goBack();await card(ids[0]).waitFor();
    assert.ok((await pixels())===original,'미리보기 전 장면 복원');
    await go('dream');await tap('인벤토리');
    await card(ids[1]).locator('.routine-card').tap();
    await card(ids[1]).getByRole('button',{name:'마이룸에서 실행'}).tap();
    await button('재생 종료').waitFor();assert.equal(new URL(page.url()).searchParams.get('space'),'my');
    assert.match(await page.locator('#lifeDetail').innerText(),/30%/);
    assert.equal(await page.evaluate(()=>renderedRoom.sleepBed),null);
    await tap('재생 종료');await card(ids[1]).waitFor();await tap('인벤토리 닫기');
    await tap('취침 모드 (1)');await page.waitForFunction(id=>renderedRoom?.sleepBed===id,bed.id);
    await tap('재생 종료');
    await page.evaluate(async()=>{const {update}=await import('/state.js');update(s=>{delete s.myLayout['light-slot']})});
    await page.reload();await tap('인벤토리');
    await card(ids[0]).locator('.routine-card').tap();
    await card(ids[0]).getByRole('button',{name:'다시 연결'}).tap();
    assert.ok(await button('미리보기').isDisabled());
    assert.deepEqual(errors,[]);
    console.log('PASS',width,height,'placement hints, dedup after reload, same-name IDs, bed blanket, Back restoration, cross-room playback and repair');
  }finally{await page.context().close()}
}
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
  for(const [w,h] of [[320,568],[390,844]])await check(browser,w,h);
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
