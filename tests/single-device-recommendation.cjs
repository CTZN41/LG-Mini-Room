const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:4174';

async function check(browser,width,height,unit,name,operation){
  const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  page.setDefaultTimeout(8000);
  const errors=[],writes=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(!['GET','HEAD'].includes(request.method()))writes.push(request.method());});
  await page.route('**/api/my-appliances',r=>r.fulfill({json:{mode:'thinq',devices:[unit]}}));
  const btn=name=>page.getByRole('button',{name,exact:true});
  const tap=name=>btn(name).tap();
  const records=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('lg-miniroom.state.thinq')||'{}').savedRoutines||[]);
  const pixels=()=>page.locator('#scene').evaluate(canvas=>canvas.toDataURL());
  const offer=name+' 미리보기';
  try{
    await page.goto(base+'/editor?space=my');
    await tap('내 가전으로 가능한 루틴 1개 보기');await tap(offer);
    assert.match(await page.locator('#lifeDetail').innerText(),/미배치.*실제 가전은 작동하지 않아요/);
    await tap('저장하지 않고 닫기');await btn('내 가전으로 가능한 루틴 1개 보기').waitFor();
    assert.deepEqual(await records(),[]);
    await tap('배치 편집');await tap('가전');await tap(unit.name);await tap('배치 완료');
    const before=await pixels();
    await tap('내 가전으로 가능한 루틴 1개 보기');await tap(offer);assert.notEqual(await pixels(),before);
    await page.goBack();await btn('내 가전으로 가능한 루틴 1개 보기').waitFor();
    assert.equal(await pixels(),before);assert.deepEqual(await records(),[]);
    await tap('내 가전으로 가능한 루틴 1개 보기');await tap(offer);await tap('내 루틴에 저장');await btn(name).waitFor();
    assert.equal(await pixels(),before);assert.equal(await btn(offer).count(),0);
    const saved=await records();assert.equal(saved.length,1);
    assert.deepEqual(Object.values(saved[0].bindings),[unit.id]);assert.equal(saved[0].actions[0].operation,operation);
    await page.reload();await tap(name);await btn('재생 종료').waitFor();assert.notEqual(await pixels(),before);
    await tap('재생 종료');await btn(name).waitFor();assert.equal(await pixels(),before);
    assert.deepEqual(await records(),saved);assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
    console.log('PASS '+width+'×'+height+' '+name+' 추천, 미배치 안내, 배치 미리보기, 거절·뒤로, 저장·복원·재실행');
  }finally{await page.context().close();}
}

async function checkDream(browser,width,height){
  const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  page.setDefaultTimeout(8000);
  const btn=name=>page.getByRole('button',{name,exact:true});
  const tap=name=>btn(name).tap();
  const name='공기청정기 자동 청정',offer=name+' 미리보기';
  const catalogKey='catalog:purifier:AS235DWSA';
  let devices=[];
  await page.route('**/api/my-appliances',r=>r.fulfill({json:{mode:'thinq',devices}}));
  const dream=base+'/editor?space=dream',my=base+'/editor?space=my';
  const pixels=()=>page.locator('#scene').evaluate(c=>c.toDataURL());
  try{
    await page.goto(dream);await btn('가전 수집').waitFor();assert.equal(await btn(offer).count(),0);
    await tap('가전 수집');await page.locator('#libraryItems [data-product="'+catalogKey+'"] button').tap();
    await tap('가전 목록 닫기');await btn('방에 놓기').waitFor();
    assert.match(await page.locator('#lifeDetail').innerText(),/먼저 이 방에 놓아/);
    await tap('방에 놓기');await tap('배치 완료');
    const original=await pixels();
    await tap(offer);await btn('재생 종료').waitFor();assert.notEqual(await pixels(),original);
    await tap('재생 종료');await btn(offer).waitFor();assert.equal(await pixels(),original);
    await tap(offer);await tap('내 방에 맞추기');await btn('마이룸 둘러보기').waitFor();
    assert.match(await page.locator('#lifeDetail').innerText(),/연결할 등록 가전이 없어요/);
    devices=['거실 공청기','침실 공청기'].map((name,i)=>({id:'registered-'+i,name,category:'공기청정기',modelCode:'AS235DWSA'}));
    await page.goto(dream);await tap(offer);await tap('내 방에 맞추기');await tap('침실 공청기');
    await tap('내 루틴에 저장');await btn(name).waitFor();await page.reload();await btn(name).waitFor();
    const stored=await page.evaluate(()=>JSON.parse(localStorage['lg-miniroom.state.thinq']));
    assert.deepEqual(Object.values(stored.savedRoutines[0].bindings),['registered-1']);
    devices=[{...devices[0],capability:'read-only'}];
    await page.goto(my);await btn('＋ 추가').waitFor();
    assert.equal(await btn(offer).count(),0);
    await page.goto(dream);await tap(offer);await tap('내 방에 맞추기');await btn('마이룸 둘러보기').waitFor();
    assert.match(await page.locator('#lifeDetail').innerText(),/연결할 등록 가전이 없어요/);
    console.log('PASS '+width+'×'+height+' 빈 방, 수집 후 배치, 드림룸 미리보기·복원, 등록 기기 선택·저장, 미지원 동작 제외');
  }finally{await page.context().close();}
}

(async()=>{
  const browser=await chromium.launch({channel:'chrome'});
  try{
    for(const [width,height] of [[320,568],[390,844]]){
      await check(browser,width,height,{id:'purifier-1',name:'거실 공청기',category:'공기청정기',modelCode:'AS235DWSA'},'공기청정기 자동 청정','air-clean');
      await check(browser,width,height,{id:'light-1',name:'침실 조명',category:'조명'},'잘 때 조명 끄기','light-off');
      await checkDream(browser,width,height);
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
