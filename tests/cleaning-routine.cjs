const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:4173';

async function checkDream(browser){
  const p=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
  const tap=name=>p.getByRole('button',{name,exact:true}).tap();
  await p.goto(base+'/editor?space=dream');
  for(const name of ['가전 수집','로봇청소기 수집','방에 놓기','배치 완료'])await tap(name);
  await p.locator('#view').focus();
  for(let i=0;i<20;i++){
    await p.keyboard.press('ArrowRight');
    if((await p.locator('#keyboardTarget').innerText()).includes('로봇청소기'))break;
  }
  await p.keyboard.press('Enter');
  assert.equal(await p.locator('#lifeTitle').innerText(),'로봇청소기');
  await tap('청소 시간');await tap('미리보기');
  assert.match(await p.locator('#lifeDetail').innerText(),/공기청정기 제외/);
  await tap('내 방에 맞추기');await tap('체험용 기기 사용');
  const preview=p.getByRole('button',{name:'미리보기',exact:true});
  assert.ok(await preview.isDisabled());
  await tap('체험용 로봇청소기 배치');assert.ok(await preview.isEnabled());
  await tap('미리보기');await tap('내 루틴에 저장');await tap('청소 시간');
  assert.match(await p.locator('#lifeDetail').innerText(),/공기청정기 제외/);
  await p.context().close();
  console.log('PASS Dream collection, product-only tap, discovery, My Room setup, required robot, optional purifier and shelf');
}

async function checkPlayback(browser,withSofa,reducedMotion){
  const viewport=withSofa?{width:390,height:844}:{width:320,height:568};
  const p=await browser.newPage({viewport,hasTouch:true,isMobile:true,reducedMotion});
  p.setDefaultTimeout(5500);
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  const key='lg-miniroom.dot.my.thinq';
  const items=[
    {id:1,k:'robot_vacuum',x:60,y:8,deviceId:'robot-a'},
    {id:2,k:'robot_vacuum',x:16,y:19,deviceId:'robot-b'},
    {id:3,k:'puri_p',x:5,y:50,deviceId:'purifier'}
  ];
  if(withSofa)items.push({id:4,k:'sofa',x:26,y:32});
  await p.route('**/api/my-appliances',r=>r.fulfill({json:{mode:'thinq',
    devices:items.filter(o=>o.deviceId).map(o=>({id:o.deviceId,k:o.k,name:o.deviceId}))}}));
  await p.goto(base+'/editor?space=my');
  await p.evaluate(({key,items})=>localStorage.setItem(key,JSON.stringify({room:'B',theme:'pink',
    layouts:{B:items.map(o=>({...o,e:0,f:0}))}})),{key,items});
  await p.addInitScript(()=>{
    // Observe the frames sent to the real canvas renderer, including transient positions.
    document.addEventListener('DOMContentLoaded',()=>{
      const paint=DotScene.paint;
      DotScene.paint=function(ctx,room,tone,items,selected,frame){
        if(frame)window.cleaningFrame=frame;
        return paint.apply(this,arguments);
      };
    });
  });
  const tap=name=>p.getByRole('button',{name,exact:true}).tap();
  await p.goto(base+'/editor?space=my&inventoryConnect=cleaning-time');
  await p.getByLabel('로봇청소기 · 필수').selectOption('robot-b');
  await p.getByLabel('공기청정기 · 선택').selectOption('purifier');
  const layout=()=>p.evaluate(key=>localStorage.getItem(key),key);
  const original=await layout();
  await p.waitForFunction(()=>window.cleaningFrame?.cat);
  const cat=()=>p.evaluate(()=>window.cleaningFrame.cat);
  const originalCat=await cat();
  async function assertScene(){
    await p.waitForFunction(()=>window.cleaningFrame?.reaction?.itemId===2);
    assert.equal(await p.evaluate(()=>cleaningFrame.seat),withSofa?4:null);
    assert.notDeepEqual(await cat(),originalCat);
    assert.deepEqual(await p.evaluate(()=>cleaningFrame.appliances),{2:'robot_vacuum',3:'purifier'});
    if(reducedMotion==='reduce'){
      assert.equal(await p.evaluate(()=>cleaningFrame.movingUnits.size),0);
    }else{
      await p.waitForFunction(()=>window.cleaningFrame?.movingUnits.has(2));
      assert.deepEqual(await p.evaluate(()=>Array.from(cleaningFrame.movingUnits.keys())),[2]);
    }
  }
  async function restored(){
    await p.waitForFunction(()=>window.cleaningFrame&&!cleaningFrame.reaction&&!Object.keys(cleaningFrame.appliances).length);
    assert.deepEqual(await cat(),originalCat);
    assert.equal(await layout(),original);
  }
  await tap('미리보기');await assertScene();await p.goBack();await restored();
  await tap('미리보기');await assertScene();await tap('내 루틴에 저장');await restored();
  await p.reload();await tap('청소 시간');await assertScene();await tap('재생 종료');await restored();
  assert.deepEqual(errors,[]);await p.context().close();
  console.log('PASS',viewport,reducedMotion,'selected robot + purifier,',withSofa?'sofa':'floor','Back, save, reload and stop restore the room');
}
(async()=>{
  const browser=await chromium.launch({channel:'chrome'});
  try{
    await checkDream(browser);
    await checkPlayback(browser,true,'no-preference');
    await checkPlayback(browser,false,'no-preference');
    await checkPlayback(browser,false,'reduce');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
