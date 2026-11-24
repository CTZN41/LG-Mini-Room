const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:4173';

(async()=>{
  const browser=await chromium.launch({channel:'chrome'});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    page.setDefaultTimeout(5000);
    const button=name=>page.getByRole('button',{name,exact:true});
    await page.goto(base+'/editor?space=dream&observe=1');
    await button('가전 수집').click();
    await button('TV+거실장 수집').click();await button('계속 수집').click();
    await button('스탠드 조명 수집').click();await button('계속 수집').click();
    assert.ok(await button('TV+거실장 수집').isDisabled());
    await button('가전 목록 닫기').click();

    const result=await page.evaluate(async()=>{
      const api=await import('/state.js');
      const snapshot=()=>[localStorage.getItem('lg-miniroom.state'),sessionStorage.getItem('lg-miniroom.events')];
      const before=snapshot();
      const rejected=[];
      for(const key of ['unknown-fridge','sofa','my-tv-1','__proto__',null,{}]){
        try{api.collect(key,'photo')}catch(e){rejected.push(e.message)}
      }
      api.collect('demo-tv-01','photo');api.collect('tvset','photo');
      return {before,after:snapshot(),rejected};
    });
    assert.equal(result.rejected.length,6);
    assert.ok(result.rejected.every(message=>message.includes('수집 카탈로그')));
    assert.deepEqual(result.after,result.before);
    assert.deepEqual(JSON.parse(result.before[0]).collection,['tvset','floor_lamp']);

    // Install an old save in this test browser only. Reading it must not rewrite it.
    const legacy=await page.evaluate(()=>{
      const state=JSON.parse(localStorage['lg-miniroom.state']);
      state.collection=['demo-tv-01','floor_lamp','unrecognized-old-key'];
      return localStorage['lg-miniroom.state']=JSON.stringify(state);
    });
    await page.reload();await button('가전 수집').click();
    assert.ok(await button('TV+거실장 수집').isDisabled());
    await button('가전 목록 닫기').click();await button('배치 편집').click();
    await page.locator('[data-key="tvset"]').click();
    const restored=await page.evaluate(async()=>{
      const api=await import('/state.js');
      api.collect('tvset','photo');
      const layout=JSON.parse(localStorage.dotroom);
      return {raw:localStorage['lg-miniroom.state'],unknown:api.collected('unrecognized-old-key'),
        placed:layout.layouts[layout.room].some(o=>o.k==='tvset')};
    });
    assert.deepEqual(restored,{raw:legacy,unknown:false,placed:true});
    console.log('PASS canonical keys, lamp, invalid and duplicate writes, observation events, old TV restore and placement');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
