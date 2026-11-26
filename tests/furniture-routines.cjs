const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:4173';

async function check(browser,width,height){
  const page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  page.setDefaultTimeout(5000);
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const button=name=>page.getByRole('button',{name,exact:true});
  const tap=name=>button(name).tap();
  const savedItems=()=>page.evaluate(()=>JSON.parse(localStorage['lg-miniroom.dot.my']).layouts.B);
  async function tapItem(id){
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const point=await page.evaluate(id=>{
      const layout=JSON.parse(localStorage['lg-miniroom.dot.my']),r=layout.room,t=layout.theme;
      const all=DotScene.sorted(r,layout.layouts[r]),item=all.find(o=>o.id===id),q=DotScene.place(r,t,item);
      const cv=document.querySelector('#scene'),rect=cv.getBoundingClientRect(),scale=rect.width/cv.width;
      let point,best=Infinity;
      for(let y=3;y<q.s.h-3;y++)for(let x=3;x<q.s.w-3;x++){
        const cost=(x-q.s.w/2)**2+(y-q.s.h/2)**2;
        if(cost>=best)continue;
        if([[0,0],[-3,0],[3,0],[0,3],[0,-3]].every(([dx,dy])=>DotScene.hits(r,t,all,q.x+x+dx,q.y+y+dy)[0]===item)){
          best=cost;point=[rect.x+(q.x+x)*scale,rect.y+(q.y+y)*scale];
        }
      }
      if(point)return point;
      throw Error('No exposed pixel for item '+id);
    },id);
    await page.touchscreen.tap(...point);
  }
  try{
    await page.goto(base+'/editor?space=my');
    await tap('체험용 기기 사용');
    await button('루틴 연결').waitFor();
    assert.equal(await page.getByLabel('재생할 TV').count(),0);
    const tv=(await savedItems()).find(o=>o.deviceId==='my-tv-1');
    await tapItem(tv.id);await button('영화 보기').waitFor();
    assert.equal(await button('재생 종료').count(),0);
    await tap('닫기');await tap('루틴 연결');
    await page.locator('#lifeActions select').selectOption('my-tv-1');
    await tap('미리보기');await tap('내 루틴에 저장');
    await button('루틴 추가').waitFor();
    const sofa=(await savedItems()).find(o=>o.k==='sofa');
    await tapItem(sofa.id);await tap('영화 보기');await tap('재생 종료');await tap('닫기');
    await tap('배치 편집');await tap('가구');await page.locator('[data-key=bed]').tap();await tap('배치 완료');
    const bed=(await savedItems()).find(o=>o.k==='bed');
    await tapItem(bed.id);await tap('취침 모드 만들기');
    assert.equal(await page.locator('#customName').inputValue(),'취침 모드');
    assert.equal(await page.locator('#customDevices select').evaluateAll(es=>es.filter(e=>e.value==='light-off').length),1);
    await tap('미리보기');await tap('내 루틴에 저장');await button('취침 모드').waitFor();
    await tap('루틴 연결 설정');await page.getByLabel('영화 보기',{exact:true}).check();
    await tap('연결 저장');await page.reload();await button('루틴 추가').waitFor();
    await tapItem(bed.id);await button('영화 보기').waitFor();await tap('취침 모드');
    assert.match(await page.locator('#lifeDetail').innerText(),/조명 끄기.*실제 가전은 작동하지 않아요/);
    await page.goBack();await tap('루틴 연결 설정');await page.getByLabel('영화 보기',{exact:true}).uncheck();
    await tap('연결 저장');assert.equal(await button('영화 보기').count(),0);
    await tapItem(sofa.id);await button('영화 보기').waitFor();assert.equal(await button('취침 모드').count(),0);
    await tap('배치 편집');await tapItem(bed.id);assert.equal(await button('복제').count(),0);
    await page.locator('[data-cat="가구"]').tap();await page.locator('[data-key=bed]').tap();
    const copy=(await savedItems()).find(o=>o.k==='bed'&&o.id!==bed.id);
    assert.deepEqual(copy.routineIds||[],[]);
    await tapItem(bed.id);await tap('삭제');await tap('배치 완료');
    await tap('취침 모드');await tap('재생 종료');
    await tapItem(copy.id);assert.equal(await button('취침 모드').count(),0);
    assert.deepEqual(errors,[]);
    console.log('PASS',width,height,'sofa movie, bed sleep, multiple links, reload, unlink, new bed and shelf after deletion');
  }catch(error){
    console.error('Panel:',await page.locator('#living').innerText());throw error;
  }finally{await page.context().close()}
}
(async()=>{
  const browser=await chromium.launch({channel:'chrome'});
  try{for(const [w,h] of [[320,568],[390,844]])await check(browser,w,h)}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
