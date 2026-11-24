const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:4173';

async function exercise(browser,viewport,controlled=false){
  const page=await browser.newPage({viewport,isMobile:true,hasTouch:true});
  page.setDefaultTimeout(5500);
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  // Deliberately ignore cancellation. Resolve requests in any order like a slow service.
  if(controlled)await page.route('**/state.js',r=>r.fulfill({
    contentType:'text/javascript',body:`
      export * from './state.js?original';
      export function recognizePhoto(file,{signal}){
        window.jobs??=[];
        return new Promise((resolve,reject)=>window.jobs.push({file,signal,resolve,reject}));
      }`
  }));
  await page.goto(base+'/editor?space=dream&observe=1');
  const button=name=>page.getByRole('button',{name,exact:true});
  const library=page.locator('#library'),items=page.locator('#libraryItems');
  const mode=page.locator('#photoMode');
  const choose=s=>mode.selectOption(s);
  const open=()=>button('가전 수집').tap();
  const close=()=>button('가전 목록 닫기').tap();
  async function message(s){await page.waitForFunction(s=>document.querySelector('#libraryStatus').textContent.includes(s),s)}
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('lg-miniroom.state')||'{"collection":[]}'));
  const fixture=Buffer.from(await page.locator('#scene').evaluate(c=>c.toDataURL().split(',')[1]),'base64');
  const upload=name=>page.locator('#photoInput').setInputFiles({name,mimeType:'image/png',buffer:fixture});
  async function start(s,name='demo.png'){await open();await choose(s);await upload(name)}
  async function confirmFirst(){await items.getByRole('button').first().tap()}

  if(!controlled){
    await start('single');await message('예시 후보 1개');assert.equal(await items.getByRole('button').count(),1);
    assert.deepEqual((await state()).collection,[]);
    const confirm=items.getByRole('button').first();await confirm.scrollIntoViewIfNeeded();
    const box=await confirm.boundingBox();
    for(let i=0;i<2;i++)await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
    assert.ok(await button('방에 놓기').isVisible());await close();
    assert.deepEqual((await state()).collection,['tvset']);
    assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage['lg-miniroom.events']).filter(e=>e.event==='collection_added').length),1);
    assert.deepEqual((await state()).photoSelections.tvset,{provider:'example',outcome:'single',decision:'confirmed'});
    await start('multiple');await message('예시 후보 3개');assert.equal(await items.getByRole('button').count(),3);
    await items.getByRole('button').nth(1).tap();
    assert.equal((await state()).photoSelections.fridge_bm.decision,'confirmed');
    await close();await start('single');await message('예시 후보 1개');assert.ok(await button('TV+거실장 수집').isDisabled());
    await button('카탈로그에서 직접 선택').tap();await button('냉장고 핑크/베이지 수집').tap();
    assert.deepEqual((await state()).photoSelections.fridge_pb,{provider:'example',outcome:'single',decision:'corrected'});
    await close();await start('none');await message('일치하는 제품이 없어요');
    await button('스탠드 조명 수집').tap();assert.equal((await state()).photoSelections.floor_lamp.outcome,'no_match');
    await close();await start('failure');await message('후보를 불러오지 못했어요');
    await button('다시 시도').tap();await message('후보를 불러오지 못했어요');
    await button('냉장고 실버/그린 수집').tap();
    assert.deepEqual((await state()).photoSelections.fridge_sg,{provider:'example',outcome:'error',decision:'manual'});
    await close();await page.reload();await button('배치 편집').tap();await page.locator('[data-key=tvset]').tap();
    assert.ok(await page.evaluate(()=>{const l=JSON.parse(localStorage.dotroom);return l.layouts[l.room].some(o=>o.k==='tvset')}));
    await page.goto(base+'/editor?space=my');await button('배치 편집').tap();
    assert.equal(await page.locator('[data-key=tvset]').count(),0);
  }else{
    async function pending(count){await page.waitForFunction(n=>window.jobs?.length===n,count)}
    async function finish(index,keys){await page.evaluate(([i,keys])=>jobs[i].resolve(keys),[index,keys])}
    await start('single','A.png');await pending(1);await upload('B.png');await pending(2);
    assert.deepEqual(await page.evaluate(()=>jobs.map(j=>[j.file.name,j.file.size>0,j.signal.aborted])),
      [['A.png',true,true],['B.png',true,false]]);
    await finish(1,['standbyme','unknown','standbyme']);await message('예시 후보 1개');
    await finish(0,['tvset']);assert.ok(await button('스탠바이미 수집').isVisible());
    await close();await start('single');await pending(3);await close();await open();
    await finish(2,['tvset']);assert.ok(await items.getByRole('button').count()>3);
    await close();await start('multiple');await pending(4);
    await button('카탈로그에서 직접 선택').tap();await button('TV+거실장 수집').tap();
    const manual=await state();await finish(3,['fridge_pb']);assert.deepEqual(await state(),manual);
    assert.deepEqual(manual.photoSelections.tvset,{provider:'example',outcome:'pending',decision:'manual'});
    await close();await start('single');await pending(5);await finish(4,['unmapped']);
    await message('일치하는 제품이 없어요');await button('다시 시도').tap();await pending(6);
    await finish(5,['fridge_pb']);await message('예시 후보 1개');
    await page.evaluate(()=>{window.originalWrite=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw Error('테스트 저장 실패')}});
    await confirmFirst();await message('테스트 저장 실패');assert.ok(await library.isVisible());
    await page.evaluate(()=>Storage.prototype.setItem=window.originalWrite);
    await confirmFirst();assert.equal((await state()).collection.filter(k=>k==='fridge_pb').length,1);
    await close();await start('single');await pending(7);
    await page.waitForFunction(()=>document.querySelector('#libraryStatus').textContent.includes('응답이 늦어'),null,{timeout:11000});
    await finish(6,['tvset']);assert.ok(await items.getByRole('button').count()>3);
    await page.locator('#photoInput').setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('broken')});
    await message('사진을 열 수 없어요');assert.ok(await items.getByRole('button').count()>3);
    assert.equal(await page.evaluate(()=>jobs.length),7);
  }
  assert.deepEqual(errors,[]);await page.close();
  console.log('PASS',viewport.width+'x'+viewport.height,controlled?'late results, close/reopen, manual override, timeout, retry, invalid image':'four examples, explicit confirmation, correction, inventory, reload and room separation');
}
(async()=>{const browser=await chromium.launch({channel:'chrome'});
  try{
    await exercise(browser,{width:320,height:568});
    await exercise(browser,{width:390,height:844});
    await exercise(browser,{width:390,height:844},true);
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
