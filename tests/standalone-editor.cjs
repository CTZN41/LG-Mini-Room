const {chromium}=require('playwright');
const assert=require('node:assert/strict'), path=require('node:path');
// The file entry point keeps the original editor and does not load a ThinQ account.
const {pathToFileURL}=require('node:url');
const url=pathToFileURL(path.join(__dirname,'../public/dot-room.html')).href;
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 for(const [width,height] of [[320,568],[390,844],[360,740],[1280,800]]){
  const phone=width<500,context=await browser.newContext({viewport:{width,height},isMobile:phone,hasTouch:phone});
  const page=await context.newPage(),cdp=await context.newCDPSession(page),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(6000);
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.dotroom));
  async function click(selector){const b=page.locator(selector);if(phone){await b.tap();await wait(80)}else await b.click()}
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  async function touch(type,points){await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y],i)=>({x,y,id:i+1}))})}
  async function drag(x,y,dx,dy){
    if(phone){await touch('touchStart',[[x,y]]);for(let i=1;i<=6;i++){await touch('touchMove',[[x+dx*i/6,y+dy*i/6]]);await wait(12)}await touch('touchEnd',[]);await wait(250)}
    else{await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:6});await page.mouse.up()}
  }
  // Choose a genuine opaque point, optionally in a stack or through a transparent sprite corner.
  async function point(options){
   return page.evaluate(({id,key,mode})=>{
    const s=JSON.parse(localStorage.dotroom),m=DotScene,ord=m.sorted(s.room,s.layouts[s.room]);
    const cv=document.querySelector('#scene'),bb=cv.getBoundingClientRect(),v=document.querySelector('#view').getBoundingClientRect(),k=bb.width/cv.width;
    const target=ord.find(o=>o.id===id||o.k===key),loc=target&&m.place(s.room,s.theme,target);
    const objects=ord.map(o=>({o,...m.place(s.room,s.theme,o)}));
    for(let yy=loc?loc.y:0;yy<(loc?loc.y+loc.s.h:cv.height);yy+=2)for(let xx=loc?loc.x:0;xx<(loc?loc.x+loc.s.w:cv.width);xx+=2){
      const X=bb.left+(xx+.5)*k,Y=bb.top+(yy+.5)*k;
      if(X<v.left+5||Y<v.top+5||X>v.right-5||Y>v.bottom-5)continue;
      const hits=m.hits(s.room,s.theme,ord,xx+.5,yy+.5);
      if(!hits.length||(target&&hits[0]!==target))continue;
      if(mode==='stack'&&hits.length<2)continue;
      if(mode==='transparent'){
        const index=ord.indexOf(hits[0]);
        if(!objects.slice(index+1).some(q=>xx>=q.x&&yy>=q.y&&xx<q.x+q.s.w&&yy<q.y+q.s.h))continue;
      }
      return {x:X,y:Y,k,ids:hits.map(o=>o.id),names:hits.map(o=>m.products[o.k].n)};
    }
    throw Error('No on-screen opaque point: '+JSON.stringify({id,key,mode}));
   },options);
  }
  const tapPoint=p=>phone?page.touchscreen.tap(p.x,p.y):page.mouse.click(p.x,p.y);
  await page.goto(url);await page.waitForSelector('.card');
  let s=await state();assert.equal(s.room,'B');
  const counts=[16,16,6,3,4,1];
  for(const [i,b] of (await page.locator('[data-cat]').all()).entries()){await b.click();assert.equal(await page.locator('.card').count(),counts[i])}
  await click('[data-cat="가전"]');
  for(const r of ['A','B','C']){
   await click('[data-room='+r+']');const layout=(await state()).layouts[r];
   for(const tone of ['lime','pink']){
    await click('[data-tone='+tone+']');s=await state();assert.deepEqual(s.layouts[r],layout);
    assert.equal(s.theme,tone);assert.equal(s.room,r);
    const geom=await page.evaluate(()=>{
     const a=document.querySelector('.top').getBoundingClientRect(),b=document.querySelector('#view').getBoundingClientRect(),d=document.querySelector('#drawer').getBoundingClientRect();
     return {noPageScroll:document.documentElement.scrollHeight===innerHeight,top:a.bottom,view:b.top,canvasB:b.bottom,tray:d.top,side:d.width,stageWidth:b.width};
    });
    assert.ok(geom.noPageScroll);assert.ok(geom.top<=geom.view+1);
    if(phone)assert.ok(geom.canvasB<geom.tray);else assert.equal(geom.side,340);
   }
  }
  let p=await point({mode:'transparent'});await tapPoint(p);assert.ok((await page.locator('#name').innerText()).startsWith(p.names[0]));
  p=await point({mode:'stack'});await tapPoint(p);assert.ok((await page.locator('#name').innerText()).startsWith(p.names[0]));await click('#overlap');
  assert.ok((await page.locator('#name').innerText()).startsWith(p.names[1]));
  await click('[data-room=A]');await click('#wallView');assert.equal(await page.locator('#scale').innerText(),'220%');
  const vv=await page.locator('#view').boundingBox(),beforePan=await page.locator('#scene').boundingBox();
  await drag(vv.x+vv.width*.51,vv.y+vv.height-6,65,0);
  const afterPan=await page.locator('#scene').boundingBox();assert.notEqual(beforePan.x,afterPan.x);
  await click('#overview');assert.equal(await page.locator('#scale').innerText(),'100%');
  if(phone){
   const x=vv.x+vv.width/2,y=vv.y+vv.height/2;
   await touch('touchStart',[[x-20,y],[x+20,y]]);await touch('touchMove',[[x-44,y],[x+44,y]]);await touch('touchEnd',[]);
   assert.ok(parseInt(await page.locator('#scale').innerText())>180);await click('#overview');
  }
  await click('[data-room=B]');await click('[data-cat="가구"]');
  if(phone){
    await click('#expand');const g=await page.locator('#products').boundingBox();
    await drag(g.x+g.width/2,g.y+g.height-14,0,-g.height+36);await wait(240);
    if(width<=360)assert.ok(await page.locator('#products').evaluate(e=>e.scrollTop>0));
  }
  await click('[data-key=shower]');assert.equal(await page.locator('#name').innerText(),'샤워부스 · 0°');
  assert.equal(await page.locator('#expand').getAttribute('aria-expanded'),'false');
  assert.equal(await page.evaluate(()=>scrollY),0);assert.equal(await page.locator('#actions').isVisible(),true);
  let obj=(await state()).layouts.B.at(-1);
  p=await point({id:obj.id});await drag(p.x,p.y,10*p.k,6*p.k);
  let changed=(await state()).layouts.B.at(-1);assert.ok(changed.x!==obj.x||changed.y!==obj.y);
  await click('#undo');assert.deepEqual((await state()).layouts.B.at(-1),obj);
  await click('[data-cat="소품"]');await click('[data-key=plant_small]');
  obj=(await state()).layouts.B.at(-1);const original={...obj};
  p=await point({id:obj.id});
  let dx=64-obj.x,dy=21-obj.y;
  await drag(p.x,p.y,2*(dx-dy)*p.k,(dx+dy)*p.k);
  obj=(await state()).layouts.B.at(-1);
  assert.equal(await page.evaluate(o=>DotScene.zone('B',o),obj),4);
  assert.deepEqual([obj.x,obj.y],[64,21]);
  await click('#undo');assert.deepEqual((await state()).layouts.B.at(-1),original);
  await click('[data-cat="벽"]');await click('[data-key=frame2]');await click('#in');
  obj=(await state()).layouts.B.at(-1);p=await point({id:obj.id});
  await drag(p.x,p.y,14*p.k,5*p.k);changed=(await state()).layouts.B.at(-1);
  assert.ok(changed.x>obj.x);assert.equal(changed.y,0);
  await click('#flip');obj=(await state()).layouts.B.at(-1);assert.equal(obj.f,1);assert.equal(obj.x,0);
  if(!phone){
    await page.keyboard.press('ArrowDown');await page.keyboard.press(']');await page.keyboard.press('d');
    let copy=(await state()).layouts.B.at(-1);assert.notEqual(copy.id,obj.id);assert.equal(copy.e,obj.e+1);
    await page.keyboard.press('[');await page.keyboard.press('r');await page.keyboard.press('Delete');
    await page.keyboard.press('Control+z');assert.equal((await state()).layouts.B.at(-1).id,copy.id);
  }else{await click('#up');await click('#down');await click('#duplicate');await click('#remove');await click('#undo')}
  await click('[data-tone=lime]');await click('[data-room=C]');await click('[data-room=B]');
  const saved=await state();await page.reload();await page.waitForSelector('.card');assert.deepEqual(await state(),saved);
  await click('#more');await click('#shot');assert.ok(await page.locator('#picture').isVisible());
  const match=await page.evaluate(async()=>{
   const im=document.querySelector('#exportImage');await im.decode();
   const s=JSON.parse(localStorage.dotroom),c=document.createElement('canvas');c.width=im.width?im.naturalWidth:0;c.height=im.naturalHeight;
   const x=c.getContext('2d');x.scale(4,4);DotScene.paint(x,s.room,s.theme,DotScene.sorted(s.room,s.layouts[s.room]),null);return c.toDataURL()===im.src;
  });assert.ok(match);await click('#picture .close');await click('#more');await click('#clear');assert.equal((await state()).layouts.B.length,0);
  await click('#undo');assert.deepEqual((await state()).layouts.B,saved.layouts.B);
  await click('#more');await click('#reset');assert.equal((await state()).layouts.B.length,23);
  await click('[data-cat="가구"]');await click('[data-key=sofa]');
  const sofaId=(await state()).layouts.B.at(-1).id;
  const headings=new Set(),previews=new Set();
  for(let turn=0;turn<4;turn++){
    const sofa=(await state()).layouts.B.find(o=>o.id===sofaId);
    headings.add(sofa.turn??0);
    previews.add(await page.locator('#sample').evaluate(c=>c.toDataURL()));
    await click('#flip');
  }
  assert.equal(headings.size,4);assert.equal(previews.size,4);
  assert.equal((await state()).layouts.B.find(o=>o.id===sofaId).turn,0);
  assert.deepEqual(errors,[]);console.log(width+'x'+height+' | six palettes, inventory, passes through alpha, occlusion, zoom/pan, place, grid drag, raised floor, wall, undo, export and restore OK');
  await context.close();
 }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
