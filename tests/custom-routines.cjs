const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:4173';

(async()=>{
  const browser=await chromium.launch({channel:'chrome'});
  try{
    for(const [width,height] of [[320,568],[390,844],[1150,750]]){
      const page=await browser.newPage({viewport:{width,height},hasTouch:width<500,
        isMobile:width<500,reducedMotion:'reduce'});
      page.setDefaultTimeout(5000);
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      const lamp={id:'bedroom-light',name:'침실 조명',k:'floor_lamp'};
      const tv={id:'bedroom-tv',name:'침실 TV',k:'tvset'};
      let devices=[lamp];
      await page.route('**/api/my-appliances',route=>route.fulfill({json:{mode:'thinq',devices}}));
      const button=name=>page.getByRole('button',{name,exact:true});
      const click=name=>button(name).click();
      const records=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('lg-miniroom.state.thinq')||'{}').savedRoutines||[]);
      const scene=()=>page.locator('#scene').evaluate(c=>c.toDataURL());
      const choose=(device,op)=>page.getByRole('combobox',{name:device,exact:true}).selectOption(op);
      const detail=()=>page.locator('#lifeDetail').innerText();
      await page.goto(base+'/editor?space=my');
      await click('배치 편집');await click('소품');await page.locator('#products [data-key="floor_lamp"]').click();await click('배치 완료');
      await click('루틴 만들기');assert.equal(await page.locator('#customDevices select').count(),1);
      await page.getByLabel('루틴 이름').fill('잘 때 불 끄기');assert.ok(await button('미리보기').isDisabled());
      await choose('침실 조명','light-off');
      const original=await scene();await click('미리보기');
      assert.match(await detail(),/침실 조명.*조명 끄기.*실제 가전은 작동하지 않아요/);
      assert.notEqual(await scene(),original);assert.deepEqual(await records(),[]);
      await page.goBack();await page.locator('#composer[open]').waitFor();
      assert.equal(await scene(),original);assert.equal(await page.getByLabel('루틴 이름').inputValue(),'잘 때 불 끄기');
      await click('미리보기');await click('내 루틴에 저장');await button('잘 때 불 끄기').waitFor();
      assert.equal(await scene(),original);
      const [first]=await records();assert.deepEqual(Object.values(first.bindings),[lamp.id]);
      await page.reload();await click('잘 때 불 끄기');assert.match(await detail(),/조명 끄기/);await click('재생 종료');
      devices=[lamp,tv];await page.reload();await click('루틴 만들기');
      await page.getByLabel('루틴 이름').fill('읽다가 TV 보기');await choose('침실 조명','light-dim');await choose('침실 TV','tv-on');
      await click('미리보기');assert.match(await detail(),/침실 TV.*미배치/);
      await click('내 루틴에 저장');await button('읽다가 TV 보기').waitFor();
      const [unchanged,second]=await records();assert.deepEqual(unchanged,first);
      assert.notEqual(second.templateId,first.templateId);assert.deepEqual(Object.values(second.bindings),[lamp.id,tv.id]);
      devices=[lamp];await page.reload();await click('읽다가 TV 보기');
      assert.match(await page.locator('#customStatus').innerText(),/다시 골라/);
      await click('루틴 편집 닫기');assert.deepEqual((await records())[1],second);
      await click('읽다가 TV 보기');await click('미리보기');await click('내 루틴에 저장');
      await page.reload();await click('읽다가 TV 보기');assert.match(await detail(),/밝기 30%/);
      assert.doesNotMatch(await detail(),/침실 TV/);assert.equal((await records()).length,2);
      await page.goto(base+'/editor?space=dream');await button('가전 수집').waitFor();
      assert.equal(await button('루틴 만들기').count(),0);assert.deepEqual(errors,[]);
      console.log('PASS custom routines',width,height,'single light, preview restoration, multi-device save, replay and repair');
      await page.context().close();
    }
    const demo=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
    demo.setDefaultTimeout(5000);
    const click=name=>demo.getByRole('button',{name,exact:true}).click();
    await demo.goto(base+'/editor?space=my');await click('체험용 기기 사용');
    await demo.getByLabel('재생할 TV').selectOption('my-tv-2');await click('미리보기');
    await click('내 루틴에 저장');await click('루틴 만들기');
    await demo.getByLabel('루틴 이름').fill('잘 때 불 끄기');
    await demo.getByRole('combobox',{name:'거실 조명'}).selectOption('light-off');
    await click('미리보기');
    const saved=()=>demo.evaluate(()=>JSON.parse(localStorage['lg-miniroom.state']).savedRoutines);
    const before=await saved();
    await demo.evaluate(()=>{
      const set=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){
        if(key==='lg-miniroom.state'){Storage.prototype.setItem=set;throw Error('테스트 저장 실패')}
        return set.call(this,key,value);
      };
    });
    await click('내 루틴에 저장');assert.deepEqual(await saved(),before);
    await click('내 루틴에 저장');await demo.getByRole('button',{name:'잘 때 불 끄기'}).waitFor();
    await demo.reload();await click('잘 때 불 끄기');await click('재생 종료');await click('영화 보기');
    assert.match(await demo.locator('#lifeDetail').innerText(),/침실 TV/);
    const after=await saved();assert.equal(after.length,2);assert.deepEqual(after[0],before[0]);
    console.log('PASS sample account, existing movie preserved, custom write failure and retry');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
