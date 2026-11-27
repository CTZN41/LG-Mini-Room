const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:4173';

(async()=>{
  const browser=await chromium.launch({channel:'chrome'});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    page.setDefaultTimeout(5000);
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const button=name=>page.getByRole('button',{name,exact:true});
    const card=k=>page.locator('[data-key="'+k+'"]');
    const visit=async space=>{
      await page.goto(base+'/editor?space='+space);
      await button('배치 편집').waitFor();
    };
    const edit=()=>button('배치 편집').click();
    await visit('dream');await edit();assert.equal(await card('catalog:tv:55LX1QKNA').count(),0);
    await button('가전 수집').click();
    const photo=await page.locator('#scene').evaluate(c=>c.toDataURL().split(',')[1]);
    await page.locator('#photoInput').setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from(photo,'base64')});
    assert.ok(await page.locator('#photoPreview').isVisible());
    const fridge='catalog:fridge:M876GBC472',tv='catalog:tv:55LX1QKNA',air='catalog:ac:FQ16ET4HSN';
    const collect=key=>page.locator('#libraryItems [data-product="'+key+'"] button').tap();
    await collect(fridge);await button('계속 수집').click();await collect(tv);
    await button('가전 목록 닫기').click();await card(fridge).click();await card('catalog:tv:55LX1QKNA').click();
    const dream=await page.evaluate(()=>JSON.parse(localStorage.dotroom));
    assert.ok(dream.layouts.B.some(o=>o.k===fridge));
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage['lg-miniroom.state']).collectionSources['catalog:fridge:M876GBC472']),'photo');
    await visit('my');await edit();assert.equal(await page.locator('#products .card').count(),0);
    await button('배치 완료').click();await button('체험용 기기 사용').click();await edit();
    const drawerKeys=[fridge,'catalog:robot:R560BL1','catalog:stick:A727TA','catalog:fridge:B315DS11','catalog:fridge:S836MDS002'];
    assert.deepEqual(await page.locator('#products .card').evaluateAll(cards=>cards.slice(0,5).map(b=>b.dataset.key)),drawerKeys);
    assert.match(await card('catalog:tv:55LX1QKNA').innerText(),/이 방에 배치됨/);
    for(const k of drawerKeys){
      await card(k).click();await button('다른 제품 놓기').tap();
      assert.match(await card(k).innerText(),/이 방에 배치됨/);
    }
    await page.reload();await edit();
    for(const k of drawerKeys){assert.match(await card(k).innerText(),/이 방에 배치됨/)}
    await card(air).click();assert.match(await card(air).innerText(),/이 방에 배치됨/);
    assert.equal(await button('복제').count(),0);await page.keyboard.press('d');
    const sample=await page.evaluate(()=>JSON.parse(localStorage['lg-miniroom.dot.my']));
    assert.equal(sample.layouts.B.filter(o=>o.k===air).length,1);
    await visit('dream');await edit();assert.equal(await card(air).count(),0);
    assert.equal(await card('catalog:tv:27LX6TPGA').count(),0);assert.ok(await card(fridge).isEnabled());

    // Replace the account endpoint only. Exercise the normal page, inventory and save paths.
    let devices=[{id:'thinq-one',category:'공기청정기',modelCode:'AS235DWSA',name:'거실 청정기'},{id:'thinq-two',category:'공기청정기',modelCode:'AS235DWSA',name:'침실 청정기'},
      {id:'wall',category:'에어컨',modelCode:'SQ06ACJCAJ.AKORG',name:'방 에어컨'},
      {id:'thinq-oven',category:'오븐',modelCode:'unknown',name:'오븐'}];
    let status=200;
    await page.route('**/api/my-appliances',r=>r.fulfill({status,json:{mode:'thinq',devices}}));
    await visit('my');await button('등록 가전').click();
    assert.doesNotMatch(await page.locator('#libraryItems').innerText(),/오븐/);
    await button('가전 목록 닫기').click();await edit();
    assert.equal(await page.locator('#products .card').count(),3);
    await page.locator('[data-unit="thinq-two"]').click();assert.match(await page.locator('[data-unit="thinq-two"]').innerText(),/이 방에 배치됨/);
    assert.ok(await page.locator('[data-unit="thinq-one"]').isEnabled());assert.equal(await card('catalog:tv:55LX1QKNA').count(),0);
    const realKey='lg-miniroom.dot.my.thinq';
    const layout=()=>page.evaluate(k=>JSON.parse(localStorage[k]),realKey);
    assert.ok((await layout()).layouts.B.some(o=>o.deviceId==='thinq-two'));
    await button('다른 제품 놓기').tap();
    await page.locator('[data-unit="wall"]').tap();
    const wall=(await layout()).layouts.B.find(o=>o.deviceId==='wall');
    assert.ok(wall);assert.equal(wall.y,0);await button('배치 완료').tap();
    await page.locator('#view').focus();
    for(let i=0;i<(await layout()).layouts.B.length;i++){
      await page.keyboard.press('ArrowRight');
      if((await page.locator('#keyboardTarget').innerText()).includes('방 에어컨'))break;
    }
    await page.keyboard.press('Enter');await button('쾌적한 방').click();
    assert.equal(await page.getByLabel('에어컨 · 필수').inputValue(),'wall');
    await button('미리보기').click();await button('내 루틴에 저장').click();
    await page.reload();await button('쾌적한 방').click();
    assert.match(await page.locator('#lifeDetail').innerText(),/방 에어컨 냉방/);
    await button('재생 종료').click();
    devices=devices.filter(d=>d.id!=='thinq-two');await visit('my');await edit();
    assert.equal(await page.locator('[data-unit="thinq-two"]').count(),0);
    // Check the actual items drawn, including after installing a foreign layout.
    await page.evaluate(()=>{const original=DotScene.paint;DotScene.paint=(...args)=>{
      window.rendered=args[3].map(o=>[o.k,o.deviceId]);return original(...args);
    }});
    await page.locator('#more').click();
    page.once('dialog',d=>d.accept());
    await page.locator('#layoutFile').setInputFiles({name:'foreign.json',mimeType:'application/json',
      buffer:Buffer.from(JSON.stringify(dream))});
    await page.waitForFunction(()=>window.rendered?.length>0);
    assert.equal(await page.evaluate(()=>rendered.some(([k])=>['catalog:fridge:M876GBC472','catalog:tv:55LX1QKNA'].includes(k))),false);
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.dotroom)),dream);
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage['lg-miniroom.dot.my'])),sample);
    status=503;await page.reload();await button('목록 다시 불러오기').waitFor();
    assert.equal(await button('체험용 기기 사용').count(),0);
    status=200;devices=[];await button('목록 다시 불러오기').click();await edit();
    assert.equal(await page.locator('#products .card').count(),0);
    devices=[{id:'thinq-tv-a',category:'TV',modelCode:'55LX1QKNA',name:'등록 TV A'},{id:'thinq-tv-b',category:'TV',modelCode:'55LX1QKNA',name:'등록 TV B'}];
    await visit('my');await button('＋ 추가').click();await button('영화 보기 연결').click();
    await page.getByLabel('재생할 TV').selectOption('thinq-tv-b');await button('등록 TV B 방에 놓기').click();await button('여기에 놓기').click();await button('미리보기').click();
    await button('내 루틴에 저장').click();await button('영화 보기').waitFor();
    devices=devices.slice(0,1);await visit('my');await button('TV 다시 연결').click();
    await page.getByLabel('대체 TV').selectOption('thinq-tv-a');await button('등록 TV A 방에 놓기').click();await button('여기에 놓기').click();await button('연결하고 재생').click();
    assert.match(await page.locator('#lifeDetail').innerText(),/등록 TV A/);
    // A prior TV collection and an old saved routine must still resolve.
    await page.unroute('**/api/my-appliances');await visit('my');
    await page.evaluate(()=>{
      const s=JSON.parse(localStorage['lg-miniroom.state']),r=JSON.parse(localStorage['lg-miniroom.dot.my']);
      const legacy='my-air-aa-bb-cc';
      const unit=r.layouts.B.find(o=>o.k==='catalog:ac:FQ16ET4HSN');unit.k='tower_ac';unit.deviceId=legacy;
      s.savedRoutines=[{templateId:'room-comfort',anchorId:'air',bindings:{'air-cool':legacy},exclusions:{'air-clean':'no_device'}}];
      localStorage['lg-miniroom.state']=JSON.stringify(s);localStorage['lg-miniroom.dot.my']=JSON.stringify(r);
    });
    await page.reload();await button('쾌적한 방').click();await button('재생 종료').waitFor();
    await visit('dream');await edit();assert.ok(await card('catalog:tv:55LX1QKNA').isEnabled());
    assert.deepEqual(errors,[]);console.log('PASS photo and catalog, separate home and collection, physical IDs, removal, import, failure and empty account');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
