const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.argv[2]||'http://127.0.0.1:4173';
(async()=>{const browser=await chromium.launch({channel:'chrome'});
try{for(const space of ['my','dream']){
 const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await p.goto(base+'/editor?space='+space);
 const btn=n=>p.getByRole('button',{name:n,exact:true}),layoutKey=space==='my'?'lg-miniroom.dot.my':'dotroom';
 if(space==='my')await btn('체험용 기기 사용').tap();
 else {
  for(const code of ['55LX1QKNA','27LX6TPGA']){
    await btn('가전 수집').tap();await p.locator('#openCatalog').tap();await p.locator('#catalogFamilies button').filter({hasText:'TV'}).tap();
    await p.locator('#catalogSearch').fill(code);await btn(code+' 수집').tap();await btn('방에 놓기').tap();await btn('배치 완료').tap();
  }
 }
 // Use the real renderer and hit testing; capture the actual cat pose it was asked to draw.
 async function capture(){await p.evaluate(key=>{
   const paint=DotScene.paint;
   DotScene.paint=function(...args){window.pose=structuredClone(args[5]||null);return paint(...args)};
   window.glassPixels=k=>{
     const layout=JSON.parse(localStorage[key]),o=layout.layouts[layout.room].find(o=>o.k===k);
     const {x,y,s}=DotScene.place(layout.room,layout.theme,o),[left,top,width,height]=s.screen;
     const ctx=document.querySelector('#scene').getContext('2d');
     let hash=0;
     for(let i=1;i<width-1;i++){
       const px=o.f?s.w-1-left-i:left+i;
       for(const value of ctx.getImageData(x+px,y+top+2+Math.round(i/2),1,Math.max(1,height-4)).data)hash=(31*hash+value)|0;
     }
     return hash;
   };
 },layoutKey)}
 async function tap(k){
  await p.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
  const coords=await p.evaluate(([key,k])=>{const data=JSON.parse(localStorage[key]);const ord=DotScene.sorted(data.room,data.layouts[data.room]),o=ord.find(o=>o.k===k),q=DotScene.place(data.room,data.theme,o),cv=document.querySelector('#scene'),r=cv.getBoundingClientRect(),s=r.width/cv.width;
   for(let y=2;y<q.s.h-2;y++)for(let x=2;x<q.s.w-2;x++)if([[0,0],[2,2],[-2,-2]].every(([dx,dy])=>DotScene.hits(data.room,data.theme,ord,q.x+x+dx,q.y+y+dy)[0]===o))return [r.x+(q.x+x)*s,r.y+(q.y+y)*s];throw Error(k+' covered')},[layoutKey,k]);
  await p.touchscreen.tap(...coords);
 }
 {
  // Separate the second screen from the sofa in an isolated test session.
  await p.evaluate(key=>{const d=JSON.parse(localStorage[key]),a=d.layouts[d.room];d.layouts[d.room]=a.filter(x=>['catalog:tv:27LX6TPGA','catalog:tv:55LX1QKNA','sofa','floor_lamp'].includes(x.k));Object.assign(a.find(x=>x.k==='catalog:tv:55LX1QKNA'),{x:4,y:54,f:1,turn:3});Object.assign(a.find(x=>x.k==='sofa'),{x:28,y:53,f:1,turn:1});Object.assign(a.find(x=>x.k==='catalog:tv:27LX6TPGA'),{x:78,y:6,f:0});localStorage[key]=JSON.stringify(d)},layoutKey);await p.reload();
 }
 await btn('배치 편집').waitFor();await capture();await tap('catalog:tv:55LX1QKNA');await p.waitForTimeout(850);
 let near=await p.evaluate(()=>pose);assert.ok(near.seat);assert.equal(await p.locator('#lifeDetail').innerText(),'');
 assert.match(await p.locator('#lifeTitle').innerText(),/TV|올레드/);
 async function expectMoving(k){
   const before=await p.evaluate(k=>glassPixels(k),k);
   await p.waitForFunction(([k,before])=>glassPixels(k)!==before,[k,before],{timeout:2500});
 }
 await expectMoving('catalog:tv:55LX1QKNA');assert.ok(!near.dim&&!near.curtain&&!near.lampLit);
 await btn('TV 끄기').tap();const off=await p.evaluate(()=>glassPixels('catalog:tv:55LX1QKNA'));
 await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>glassPixels('catalog:tv:55LX1QKNA')),off);
 await btn('TV 켜기').tap();await expectMoving('catalog:tv:55LX1QKNA');
 await tap('catalog:tv:27LX6TPGA');let moving=await p.evaluate(()=>pose);assert.ok(moving.walking);
 await p.waitForTimeout(850);let far=await p.evaluate(()=>pose);assert.equal(far.seat,null);assert.equal(far.walking,false);assert.notDeepEqual(far.cat,near.cat);
 await expectMoving('catalog:tv:27LX6TPGA');assert.equal(await p.evaluate(()=>glassPixels('catalog:tv:55LX1QKNA')),off);
 await p.emulateMedia({reducedMotion:'reduce'});
 await p.waitForTimeout(150);
 const frozen=await p.evaluate(()=>glassPixels('catalog:tv:27LX6TPGA'));
 await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>glassPixels('catalog:tv:27LX6TPGA')),frozen);
 await p.emulateMedia({reducedMotion:'no-preference'});await expectMoving('catalog:tv:27LX6TPGA');
 const expected=await p.evaluate(key=>{const s=JSON.parse(localStorage[key]),tv=s.layouts[s.room].find(o=>o.k==='catalog:tv:27LX6TPGA'),{w,d}=DotScene.dims(tv),cx=tv.x+w/2,cy=tv.y+d+8,z=DotScene.roomData(s.room).zones.find(([x1,y1,x2,y2])=>cx>=x1&&cx<x2&&cy>=y1&&cy<y2)?.[4]||0;return DotScene.project(s.room,cx,cy,z)},layoutKey);
 assert.ok(Math.hypot(far.cat.x-expected[0],far.cat.y-expected[1])<10,'far='+JSON.stringify(far.cat)+' expected '+expected);
 assert.equal(await p.locator('#lifeDetail').innerText(),'');
 await btn('영화 보기').tap();await btn('재생 종료').waitFor();
 if(space==='my'){assert.match(await p.locator('#lifeDetail').innerText(),/침실 TV 재생/);await btn('내 루틴에 저장').tap();await btn('영화 보기').waitFor();
  await tap('catalog:tv:55LX1QKNA');await btn('TV 끄기').waitFor();await btn('영화 보기').tap();assert.match(await p.locator('#lifeDetail').innerText(),/거실 TV 재생/);assert.equal(await p.evaluate(()=>JSON.parse(localStorage['lg-miniroom.state']).savedRoutines[0].bindings['tv-on']),'my-tv-2');
 }
 await p.evaluate(key=>{const r=JSON.parse(localStorage[key]);r.layouts[r.room]=r.layouts[r.room].filter(o=>o.k!=='sofa');localStorage[key]=JSON.stringify(r)},layoutKey);await p.reload();await btn('배치 편집').waitFor();await capture();await tap('catalog:tv:55LX1QKNA');await p.waitForTimeout(850);assert.equal(await p.evaluate(()=>pose.seat),null);await btn('영화 보기').tap();await btn('재생 종료').waitFor();
 console.log('PASS',space,'near seated, far walked and stood in front of selected screen, no-sofa playback');await p.context().close();
}}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
