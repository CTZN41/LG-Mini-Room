const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:4174';

async function check(browser,width,height,account){
  const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true,
    reducedMotion:width===320?'reduce':'no-preference'});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.setDefaultTimeout(8000);
  const unit=account?'account-light-1':'my-light-1';
  const suffix=account?'.thinq':'';
  const layoutKey='lg-miniroom.dot.my'+suffix,stateKey='lg-miniroom.state'+suffix;
  const btn=name=>page.getByRole('button',{name,exact:true});
  const tap=name=>btn(name).tap();
  const name='잘 때 조명 끄기';
  const read=key=>page.evaluate(k=>JSON.parse(localStorage[k]),key);
  await page.route('**/api/my-appliances',route=>route.fulfill({json:account?
    {mode:'thinq',devices:[{id:unit,name:'침실 조명',category:'조명'}]}:{mode:'demo',devices:[]}}));
  await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{
    if(typeof DotScene==='undefined')return;
    const paint=DotScene.paint;
    DotScene.paint=function(...args){const result=paint(...args);window.lastDraw=args[5];return result;};
  }));
  async function touchItem(k){
    const point=await page.evaluate(({k,layoutKey})=>{
      const s=JSON.parse(localStorage[layoutKey]),items=DotScene.sorted(s.room,s.layouts[s.room]);
      const item=items.find(o=>o.k===k),q=DotScene.place(s.room,s.theme,item);
      const cv=document.querySelector('#scene'),r=cv.getBoundingClientRect();
      for(let y=2;y<q.s.h-2;y++)for(let x=2;x<q.s.w-2;x++){
        if(![[0,0],[2,0],[-2,0],[0,2],[0,-2]].every(([dx,dy])=>
          DotScene.hits(s.room,s.theme,items,q.x+x+dx,q.y+y+dy)[0]===item))continue;
        return [r.left+(q.x+x+.5)*r.width/cv.width,r.top+(q.y+y+.5)*r.height/cv.height];
      }
      throw Error('터치 가능한 픽셀 없음: '+k);
    },{k,layoutKey});
    await page.touchscreen.tap(...point);
  }
  async function baseline(){
    return page.evaluate(key=>{
      const s=JSON.parse(localStorage[key]),lamp=s.layouts[s.room].find(o=>o.k==='floor_lamp');
      const q=DotScene.place(s.room,s.theme,lamp),ctx=document.querySelector('#scene').getContext('2d');
      return {cat:[lastDraw.cat.x,lastDraw.cat.y],light:[...ctx.getImageData(q.x+4,q.y+3,12,3).data],
        bed:lastDraw.sleepBed,dim:!!lastDraw.dim};
    },layoutKey);
  }
  async function tucked(bed,lamp,before){
    await page.waitForFunction(({bed,lamp})=>lastDraw.sleepBed===bed&&lastDraw.tucked===1&&lastDraw.appliances[lamp]==='light-off',{bed,lamp});
    const frame=await baseline();
    assert.ok(frame.dim);assert.notDeepEqual(frame.light,before.light);
    assert.match(await page.locator('#lifeDetail').innerText(),/침실 조명.*조명 끄기.*실제 가전은 작동하지 않아요/);
  }
  try{
    await page.goto(base);
    await page.getByRole('link',{name:'마이룸',exact:true}).tap();
    if(!account)await tap('조명 한 대로 체험');
    await tap('등록 가전');
    assert.deepEqual(await page.locator('#libraryItems [data-product]').allTextContents(),['침실 조명']);
    await tap('가전 목록 닫기');
    assert.match(await page.locator('#lifeDetail').innerText(),/조명과 가구의 침대/);
    await tap('배치 편집');await tap('가전');await tap('침실 조명');
    await tap('가구');await page.locator('#products [data-key=bed]').tap();await tap('배치 완료');
    assert.match(await page.locator('#lifeDetail').innerText(),/침대를 눌러/);
    const layout=await read(layoutKey),items=layout.layouts[layout.room];
    const lamp=items.find(o=>o.deviceId===unit).id,bed=items.find(o=>o.k==='bed').id;
    await touchItem('floor_lamp');await tap('조명 켜기');await tap('닫기');
    await touchItem('bed');await tap('취침 모드 만들기');
    assert.deepEqual(await page.locator('#customDevices select').allTextContents(),['사용 안 함밝기 30%조명 끄기']);
    assert.equal(await page.locator('#customDevices select').inputValue(),'light-off');
    await page.getByLabel('루틴 이름').fill(name);
    const original=await baseline();
    await tap('미리보기');await tucked(bed,lamp,original);await tap('내 루틴에 저장');
    assert.deepEqual(await baseline(),original);
    const state=await read(stateKey),record=state.savedRoutines.find(r=>r.name===name);
    assert.deepEqual(Object.values(record.bindings),[unit]);assert.equal(record.scene,'bedtime');
    await page.reload();await btn(name).waitFor();
    await touchItem('floor_lamp');await tap('조명 켜기');await tap('닫기');
    for(const via of ['shelf','bed']){
      if(via==='bed')await touchItem('bed');
      const before=await baseline();
      await tap(name);await tucked(bed,lamp,before);await tap('재생 종료');
      assert.deepEqual(await baseline(),before);
      assert.equal(await page.locator('#lifeTitle').innerText(),via==='bed'?'침대':'내 루틴');
    }
    assert.deepEqual(await read(stateKey),state);assert.deepEqual(errors,[]);
    console.log(width+'×'+height+' '+(account?'single-light account':'light demo')+' PASS: place, preview, save, reload, play from shelf and bed, restore cat and light pixels');
  } finally {await page.context().close();}
}
(async()=>{
  const browser=await chromium.launch({channel:'chrome'});
  try{for(const [w,h] of [[320,568],[390,844]])for(const account of [false,true])await check(browser,w,h,account);}
  finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
