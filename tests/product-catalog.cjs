const {registeredModels}=require('./support/catalog.cjs');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:4173';
const representatives=[
  ['TV','55LX1QKNA'],['냉장고','M876GBC472'],['세탁기','FG19WNR'],
  ['건조기','RD20WNR'],['공기청정기','AS235DWSA'],['가습기','AW141YBW'],
  ['제습기','DQ203PCCA'],['로봇청소기','R560BL1'],['무선청소기','A912PM'],['에어컨','FQ16ET4HSN'],
  ['센서','TMSA2A4W'],['조명 스위치','TMCS2W4W'],['AI 홈 허브','HMAK4W']
];
async function check(browser,width,height){
  const p=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  p.setDefaultTimeout(6500);const errors=[];p.on('pageerror',e=>errors.push(e.message));
  const tap=selector=>p.locator(selector).tap(),rows=p.locator('#catalogRows article');
  async function gallery(){await tap('#libraryButton');await tap('#openCatalog')}
  try{
    await p.goto(base+'/editor?space=dream');await gallery();
    assert.equal(await p.locator('#catalogFamilies button').count(),representatives.length);
    const art=await p.locator('#catalogFamilies canvas').evaluateAll(els=>els.map(c=>c.toDataURL()));
    assert.equal(new Set(art).size,representatives.length);
    const available=registeredModels({collectibleOnly:true});
    for(const [family,code] of representatives){
      const codes=available.filter(([category])=>category===family).map(([,model])=>model);
      const count=codes.length;
      await p.locator('#catalogFamilies button').filter({hasText:code}).tap();
      await rows.first().waitFor();assert.equal(await rows.first().getAttribute('data-model'),code);
      assert.match(await p.locator('#catalogStatus').innerText(),new RegExp('/ '+count+'개'));
      if(family==='가습기'){
        const dots=await rows.evaluateAll(els=>Object.fromEntries(els.map(el=>[
          el.dataset.model,el.querySelector('canvas').toDataURL()
        ])));
        assert.deepEqual(Object.keys(dots).sort(),codes);
        assert.equal(new Set(Object.values(dots)).size,7);
        assert.equal(dots.HY705RWUA,dots.HY706RWUA);
        assert.notEqual(dots.HY505RWLAH,dots.HY703RWAAH);
      }
      const photo=await p.request.get(base+'/api/catalog/photo?'+new URLSearchParams({category:family,model:code}));
      assert.equal(photo.status(),200);assert.match(photo.headers()['content-type'],/^image\//);
      if(family==='냉장고'){
        await tap('#catalogNext');await rows.first().waitFor();assert.match(await p.locator('#catalogStatus').innerText(),/^17/);
        await p.locator('#catalogSearch').fill('no-product-xxxx');
        await p.getByText('검색 결과가 없어요.',{exact:true}).waitFor();
        await p.locator('#catalogSearch').fill('b315ds11');await rows.first().waitFor();
        await rows.first().getByRole('button').tap();await tap('#continueCollecting');
        await p.locator('#catalogSearch').fill(code);await rows.first().waitFor();
      }
      await rows.first().getByRole('button').tap();await tap('#continueCollecting');
      await rows.first().waitFor();assert.ok(await rows.first().getByRole('button').isDisabled());await tap('#catalogBack');
    }
    await p.getByRole('button',{name:'가전 목록 닫기'}).tap();await p.reload();await tap('#editMode');
    const keys=await p.locator('#products [data-key]').evaluateAll(es=>es.map(e=>e.dataset.key));
    assert.equal(keys.length,representatives.length+1);assert.ok(keys.includes('washer_fg19wnr'));
    for(const key of keys)await tap('#products [data-key="'+key+'"]');
    await tap('#flip');await tap('#editMode');await p.reload();
    await p.locator('#libraryButton').waitFor();
    const items=await p.evaluate(()=>JSON.parse(localStorage.dotroom).layouts.B.filter(o=>o.k!=='sofa'));
    assert.equal(items.length,keys.length);assert.deepEqual(new Set(items.map(o=>o.k)),new Set(keys));
    // Switch focus with the real browse controls and open the DB-backed TV.
    await p.locator('#view').focus();
    for(let i=0;i<=items.length;i++){
      await p.keyboard.press('ArrowRight');
      if((await p.locator('#keyboardTarget').innerText()).includes('55LX1QKNA'))break;
    }
    await p.keyboard.press('Enter');await p.waitForFunction(()=>document.querySelector('#lifeTitle').textContent==='LG전자 오브제컬렉션 포제 올레드 evo'&&document.querySelector('#lifeDetail').textContent==='');
    await p.getByRole('button',{name:'영화 보기',exact:true}).tap();await p.getByRole('button',{name:'재생 종료',exact:true}).tap();
    await tap('#myLink');await tap('#editMode');assert.equal(await p.locator('#products [data-key^="catalog:"]').count(),0);
    assert.deepEqual(errors,[]);console.log('PASS',width,height,representatives.length,'families, photos, search, paging, model collection, placement, restoration, TV playback, ownership');
  }finally{await p.context().close()}
}
(async()=>{const b=await chromium.launch({channel:'chrome'});try{
  for(const [w,h] of [[320,568],[390,844]])await check(b,w,h);
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
