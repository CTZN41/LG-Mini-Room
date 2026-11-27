const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const join=require('./support/join.cjs');
const withServer=require('./member-server.cjs');
const tvKey = 'catalog:tv:55LX1QKNA';

async function check(base,browser,width,height) {
  const reducedMotion=width===320?'reduce':'no-preference';
  const page = await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion});
  page.setDefaultTimeout(9000);
  const button = name => page.getByRole('button',{name,exact:true});
  const tab = name => page.getByRole('navigation',{name:'ThinQ 하단 메뉴'}).getByRole('link',{name,exact:true});
  const tap = name => button(name).tap();
  const errors = [];
  page.on('pageerror',error=>errors.push(error.message));
  // Observe the frame actually drawn. All room and routine changes go through the UI.
  await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{
    if(typeof DotScene==='undefined')return;
    const paint=DotScene.paint;
    DotScene.paint=function(...args){const result=paint(...args);window.lastRoomFrame=args[5];if(args[5]?.walking)window.sawWalk=true;return result;};
  }));
  const read = key => page.evaluate(key=>JSON.parse(roomStorage.getItem(key)),key);
  async function myPixels() {
    return page.evaluate(()=>{
      const s=JSON.parse(roomStorage.getItem('lg-miniroom.dot.my'));
      const ctx=document.querySelector('#scene').getContext('2d');
      const result={};
      for(const obj of s.layouts[s.room].filter(o=>['my-tv-1','my-tv-2','my-light-1'].includes(o.deviceId))){
        const q=DotScene.place(s.room,s.theme,obj);
        const [x,y,w,h]=obj.k==='floor_lamp'?[4,3,12,3]:q.s.screen;
        const bytes=[];
        for(let column=2;column<w-2;column++){
          const dx=obj.f?q.s.w-1-x-column:x+column;
          const dy=y+(obj.k==='floor_lamp'?0:Math.round(column/2)+2);
          bytes.push(...ctx.getImageData(q.x+dx,q.y+dy,1,Math.max(1,h-4)).data);
        }
        result[obj.deviceId]=bytes.join(',');
      }
      return result;
    });
  }
  try {
    await join(page,base,'movie-'+width);await page.goto(base);
    await tab('메뉴').tap();
    await page.getByRole('link',{name:'LG 미니룸'}).tap();
    await tap('가전 수집');
    await page.locator('#libraryItems [data-product="'+tvKey+'"] button').tap();
    await tap('방에 놓기');
    assert.match(await page.locator('#comboHint').innerText(),/영화 보기/);
    await tap('배치 완료');
    const dream=await read('dotroom'),state=await read('lg-miniroom.state');
    assert.ok(state.collection.includes(tvKey));
    assert.equal(state.myFixtureId,null);
    const screen=dream.layouts[dream.room].find(o=>o.k===tvKey);
    assert.ok(screen&&!screen.exhibit&&!screen.deviceId);
    const tapPoint=await page.evaluate(id=>{
      const s=JSON.parse(roomStorage.getItem('dotroom')),items=DotScene.sorted(s.room,s.layouts[s.room]);
      const item=items.find(o=>o.id===id),q=DotScene.place(s.room,s.theme,item);
      const cv=document.querySelector('#scene'),r=cv.getBoundingClientRect(),scale=r.width/cv.width;
      for(let y=3;y<q.s.h-3;y++)for(let x=3;x<q.s.w-3;x++){
        if([[0,0],[-2,0],[2,0],[0,-2],[0,2]].every(([dx,dy])=>
          DotScene.hits(s.room,s.theme,items,q.x+x+dx,q.y+y+dy)[0]===item)){
          return [r.left+(q.x+x+.5)*scale,r.top+(q.y+y+.5)*scale];
        }
      }
      throw Error('배치한 TV에 터치할 수 있는 지점이 없습니다.');
    },screen.id);
    const beforeCat=await page.evaluate(()=>lastRoomFrame.cat);
    await page.touchscreen.tap(...tapPoint);
    await button('영화 보기').waitFor();
    await page.waitForFunction(id=>lastRoomFrame.focusedProduct===id&&lastRoomFrame.tv===id,screen.id);
    await page.waitForFunction(()=>!lastRoomFrame.walking);
    if(reducedMotion==='no-preference')assert.ok(await page.evaluate(()=>window.sawWalk));
    const cat=await page.evaluate(()=>lastRoomFrame.cat);
    assert.ok(Math.hypot(cat.x-beforeCat.x,cat.y-beforeCat.y)>1);
    assert.ok(!await page.evaluate(()=>lastRoomFrame.curtain||lastRoomFrame.dim));
    assert.equal(await button('재생 종료').count(),0);
    await tap('영화 보기');await button('재생 종료').waitFor();
    assert.ok(await page.evaluate(()=>lastRoomFrame.curtain));
    await tap('내 방에 맞추기');await tap('체험용 기기 사용');
    const picker=page.getByLabel('재생할 TV');
    assert.equal(await picker.inputValue(),'');
    assert.ok(await button('미리보기').isDisabled());
    await picker.selectOption({label:'침실 TV'});await tap('＋ 조명 30%');
    const before=await myPixels();
    assert.equal(Object.keys(before).length,3);
    await tap('미리보기');await button('내 루틴에 저장').waitFor();
    assert.match(await page.locator('#lifeDetail').innerText(),/침실 TV.*조명 30%.*커튼 제외/);
    const preview=await myPixels();
    assert.equal(preview['my-tv-1'],before['my-tv-1']);
    for(const id of ['my-tv-2','my-light-1'])assert.notEqual(preview[id],before[id]);
    await tap('내 루틴에 저장');await button('＋ 추가').waitFor();
    assert.deepEqual(await myPixels(),before);
    const stored=await read('lg-miniroom.state'),movie=stored.savedRoutines.find(r=>r.templateId==='movie-night');
    assert.deepEqual(movie.bindings,{'tv-on':'my-tv-2','light-dim':'my-light-1'});
    assert.equal(movie.exclusions['curtain-close'],'no_device');
    assert.deepEqual(stored.collection,state.collection);
    assert.deepEqual(await read('dotroom'),dream);
    await page.evaluate(()=>roomStorage.whenSynced());await tab('홈').tap();await page.locator('#home:visible').waitFor();await page.reload();
    await tab('마이룸').tap();await page.locator('#myLink').tap();await button('영화 보기').waitFor();
    assert.equal(await page.locator('#lifeTitle').innerText(),'내 루틴 1');
    assert.deepEqual(await myPixels(),before);
    await tap('영화 보기');await button('재생 종료').waitFor();
    assert.match(await page.locator('#lifeDetail').innerText(),/침실 TV.*조명 30%/);
    const replay=await myPixels();
    assert.equal(replay['my-tv-1'],before['my-tv-1']);
    assert.equal(replay['my-light-1'],preview['my-light-1']);
    assert.notEqual(replay['my-tv-2'],before['my-tv-2']);
    if(reducedMotion==='reduce')assert.deepEqual(replay,preview);
    await tap('재생 종료');await button('＋ 추가').waitFor();
    assert.deepEqual(await myPixels(),before);
    assert.deepEqual(errors,[]);
    console.log(width+'×'+height+' PASS home → collect and place TV → cat → movie → choose bedroom TV and light → save → reload and replay. TV and lamp pixels restored.');
  } finally {await page.context().close();}
}
withServer(async base=>{
  const browser=await chromium.launch({channel:'chrome'});
  try{for(const [width,height] of [[320,568],[390,844]])await check(base,browser,width,height);}
  finally{await browser.close();}
}).catch(error=>{console.error(error);process.exitCode=1;});
