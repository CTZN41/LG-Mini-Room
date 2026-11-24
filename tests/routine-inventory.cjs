const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:4173';

async function check(browser,viewport){
  const p=await browser.newPage({viewport,isMobile:viewport.width<700,hasTouch:true});
  p.setDefaultTimeout(5500);
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/api/my-appliances',r=>r.fulfill({json:{mode:'demo'}}));
  const btn=n=>p.getByRole('button',{name:n,exact:true});
  const tap=n=>btn(n).tap();
  const bag=p.locator('#routineBag');
  const row=name=>bag.locator('article').filter({has:p.getByText(name,{exact:true})});
  const press=(name,action)=>row(name).getByRole('button',{name:action,exact:true}).tap();
  const open=async()=>{await tap('인벤토리');await row('영화 보기').waitFor()};
  const close=()=>tap('인벤토리 닫기');
  const state=()=>p.evaluate(()=>JSON.parse(localStorage['lg-miniroom.state']||'{}'));
  const discoveries=()=>p.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('lg-miniroom.discovered.')).sort());
  await p.goto(base+'/editor?space=dream');
  await open();assert.equal(await bag.locator('article').count(),4);assert.match(await row('영화 보기').innerText(),/미발견/);await close();
  for(const [name,key,routine] of [['TV+거실장','tvset','영화 보기'],['타워 에어컨','tower_ac','쾌적한 방'],['워시타워 민트','wash_m','의류 관리'],['로봇청소기','robot_vacuum','청소 시간']]){
    await tap('가전 수집');const product=p.locator('[data-product="'+key+'"]');
    assert.match(await product.innerText(),new RegExp(routine));
    await tap(name+' 수집');assert.match(await p.locator('#collectedUse').innerText(),new RegExp(routine));
    await tap('방에 놓기');
    const card=p.locator('#products [data-key="'+key+'"]');
    assert.match(await card.innerText(),/이 방에 1개 배치/);
    await card.tap();assert.match(await card.innerText(),/이 방에 2개 배치/);
    await p.locator('#undo').tap();assert.match(await card.innerText(),/이 방에 1개 배치/);
    await tap('배치 완료');await open();assert.match(await row(routine).innerText(),/체험 가능/);
    await press(routine,'미리보기');await btn('재생 종료').waitFor();await tap('재생 종료');await btn('재생 종료').waitFor({state:'hidden'});await close();
  }
  assert.equal((await discoveries()).length,4);
  await p.locator('#myLink').tap();await btn('체험용 기기 사용').waitFor();await p.reload();await open();
  for(const name of ['영화 보기','쾌적한 방','의류 관리','청소 시간']){
    assert.match(await row(name).innerText(),/발견함/);
    await press(name,'다시 미리보기');await btn('인벤토리로 돌아가기').waitFor();
    assert.match(await p.locator('#lifeTitle').innerText(),new RegExp(name));
    if(name==='쾌적한 방')await p.goBack();else await tap('인벤토리로 돌아가기');
    await row(name).waitFor();
    assert.equal(new URL(p.url()).searchParams.get('space'),'my');
  }
  assert.equal((await state()).myFixtureId,null);assert.deepEqual((await state()).savedRoutines,[]);
  await press('영화 보기','내 방에 맞추기');await tap('체험용 기기 사용');
  await p.getByLabel('재생할 TV').selectOption('my-tv-2');await tap('미리보기');await tap('내 루틴에 저장');await btn('영화 보기').waitFor();
  // Old saved homes without any new discovery marker must show their saved routine immediately.
  await p.evaluate(()=>localStorage.removeItem('lg-miniroom.discovered.movie-night'));await p.reload();await open();
  assert.match(await row('영화 보기').innerText(),/내 루틴에 저장됨/);await press('영화 보기','저장한 연결 보기');
  assert.equal(await p.getByLabel('재생할 TV').inputValue(),'my-tv-2');
  await p.locator('#more').tap();await p.locator('#manageTVs').tap();await tap('침실 TV 등록 해제');await tap('완료');
  await p.locator('#dreamLink').tap();await open();assert.match(await row('영화 보기').innerText(),/재연결 필요/);
  await press('영화 보기','다시 연결');await p.getByLabel('대체 TV').selectOption('my-tv-1');await tap('연결하고 재생');
  assert.match(await p.locator('#lifeDetail').innerText(),/거실 TV/);await tap('재생 종료');
  await tap('배치 편집');const tv=p.locator('#products [data-unit=my-tv-1]');
  assert.match(await tv.innerText(),/거실 TV[\s\S]*배치됨/);assert.ok(await tv.isDisabled());
  const air=p.locator('#products [data-key=tower_ac]');assert.match(await air.innerText(),/놓을 수 있음/);
  await air.tap();assert.match(await air.innerText(),/배치됨/);
  assert.deepEqual(errors,[]);await p.context().close();
  console.log('PASS',viewport.width+'x'+viewport.height,'all four discoveries, no-device replay, placement counts, legacy save, reconnection and registered-device status');
}
async function checkSharedDiscovery(browser){
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const btn=name=>page.getByRole('button',{name,exact:true});
  const keys=()=>page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('lg-miniroom.discovered.')));
  await page.goto(base+'/editor?space=example');await page.getByText('소파에 영화 보기 루틴이 있어요.',{exact:true}).waitFor();await page.locator('#view').focus();
  for(let i=0;i<24;i++){
    await page.keyboard.press('ArrowRight');
    if((await page.locator('#keyboardTarget').innerText()).includes('소파'))break;
  }
  await page.keyboard.press('Enter');await btn('미리보기').tap();await btn('재생 종료').waitFor();
  assert.deepEqual(await keys(),['lg-miniroom.discovered.movie-night']);
  await page.goto(base+'/editor?space=dream');await btn('가전 수집').tap();await btn('TV+거실장 수집').tap();
  await btn('방에 놓기').tap();await btn('배치 완료').tap();await btn('인벤토리').tap();
  await btn('다시 미리보기').tap();await btn('재생 종료').waitFor();await page.goBack();
  await btn('인벤토리 닫기').waitFor();
  assert.deepEqual(await keys(),['lg-miniroom.discovered.movie-night']);
  assert.equal(await page.evaluate(()=>localStorage.getItem('lg-miniroom.discovered.movie-night')),'example_room');
  // Two fixture units of one model: the state label belongs to the exact registered unit.
  await page.route('**/api/my-appliances',r=>r.fulfill({json:{mode:'thinq',devices:[
    {id:'unit-one',name:'거실 TV',k:'tvset'},{id:'unit-two',name:'침실 TV',k:'tvset'}]}}));
  await page.goto(base+'/editor?space=my');await btn('배치 편집').tap();await btn('침실 TV').tap();
  assert.match(await btn('거실 TV').innerText(),/놓을 수 있음/);assert.match(await btn('침실 TV').innerText(),/배치됨/);
  assert.equal(await btn('거실 TV').getAttribute('aria-pressed'),'false');
  await page.reload();await btn('인벤토리').tap();await btn('다시 미리보기').waitFor();
  assert.equal(await page.locator('#bagRows article').count(),4);
  await page.context().close();console.log('PASS friend and dream deduplication, Back to inventory, shared discovery and independent same-model device labels');
}
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
 for(const viewport of [{width:320,height:568},{width:390,height:844},{width:1150,height:750}])await check(browser,viewport);
 await checkSharedDiscovery(browser);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
