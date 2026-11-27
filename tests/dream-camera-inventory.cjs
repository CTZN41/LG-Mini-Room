const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:4174';
const tv={id:'test-tv',modelCode:'55LX1QKNA',displayName:'LG 올레드 포제',category:'TV'};
const key='catalog:tv:55LX1QKNA';

async function exercise(browser,width,height){
  const page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true,reducedMotion:width===320?'reduce':'no-preference'});
  page.setDefaultTimeout(8000);
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  const button=name=>page.getByRole('button',{name,exact:true});
  const tap=name=>button(name).tap();
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('lg-miniroom.state')||'{}'));
  const layout=()=>page.evaluate(()=>JSON.parse(localStorage.dotroom));
  const dream=base+'/editor?space=dream';
  let back;
  async function scan(item,status='registered'){
    await tap('＋ 가전 촬영');await page.waitForURL('https://lg-camera-lab.pages.dev/scan?**');
    back=new URL(new URL(page.url()).searchParams.get('returnTo'));
    assert.equal(back.origin,new URL(base).origin);assert.equal(back.searchParams.get('space'),'dream');
    assert.equal(back.searchParams.get('camera'),'collect');
    back.searchParams.set('lgcam',status);
    if(item)back.searchParams.set('lgcam_item',JSON.stringify(item));
    await page.goto(back.href);
    await page.waitForURL(dream);
  }
  try{
    await page.route('https://lg-camera-lab.pages.dev/scan?**',route=>route.fulfill({body:'Test camera'}));
    await page.route('**/api/my-appliances',route=>route.fulfill({json:{mode:'demo'}}));
    await page.goto(dream);await button('＋ 가전 촬영').waitFor();
    const original=await layout();
    await scan(null,'cancelled');assert.match(await page.locator('#notice').innerText(),/취소/);
    assert.ok(await page.locator('#library').isHidden());
    await scan({...tv,modelCode:'UNKNOWN'});assert.match(await page.locator('#notice').innerText(),/일치하는 수집 모델이 없어요/);
    assert.ok(await page.locator('#library').isHidden());
    await scan(tv);assert.equal((await state()).collection?.length||0,0);
    await tap('인벤토리에 보관');await page.locator('#bagItems li').waitFor();
    assert.equal(await page.locator('#bagItems li').count(),1);assert.match(await page.locator('#bagItems').innerText(),/미배치/);
    assert.deepEqual(await layout(),original);
    await tap('인벤토리 닫기');await scan(tv);
    assert.match(await page.locator('#collectedUse').innerText(),/이미 수집/);
    await tap('드림룸에 놓기');await tap('배치 완료');await page.reload();
    const saved=await state(),room=await layout();
    assert.deepEqual(saved.collection,[key]);assert.equal(saved.collectionSources[key],'photo');
    assert.equal(saved.photoSelections[key].provider,'lg-camera');assert.equal(saved.cameraAppliances,undefined);
    assert.equal(room.layouts[room.room].filter(o=>o.k===key).length,1);
    await tap('인벤토리');const movie=page.locator('[data-card-id="movie-night"]');
    await tap('영화 보기 상세');assert.match(await movie.innerText(),/일부 적용 가능/);
    assert.match(await movie.innerText(),/TV 켜기 · 필수 · 가능/);assert.match(await movie.innerText(),/커튼 닫기 · 선택 · 기기 없음/);
    assert.equal(await movie.locator('.routine-orb.compatible').count(),0);
    await movie.getByRole('button',{name:'미리보기',exact:true}).tap();await tap('재생 종료');
    await page.reload();await tap('인벤토리');await movie.waitFor();
    assert.equal(await movie.locator('.routine-orb small').innerText(),'드림');
    assert.deepEqual(errors,[]);
    console.log(width+'×'+height+' PASS scan handoff, cancel, unknown, store, rescan and place, reload, room isolation and routine details');
  }finally{await page.context().close();}
}
(async()=>{
  const browser=await chromium.launch({channel:'chrome'});
  try{for(const [w,h] of [[320,568],[390,844]])await exercise(browser,w,h);}
  finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
