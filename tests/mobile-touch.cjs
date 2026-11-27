const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:4173';

async function check(browser,width,height){
  const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true});
  const button=name=>page.getByRole('button',{name,exact:true});
  const view=page.locator('#view');
  const session=await page.context().newCDPSession(page);
  async function stroke(x,y,dx){
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    if(dx)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx,y}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  await page.route('**/api/my-appliances',r=>r.fulfill({json:{mode:'demo'}}));
  for(const [space,key] of [['my','lg-miniroom.dot.my'],['dream','dotroom']]){
    await page.goto(base+'/editor?space='+space);
    await page.waitForFunction(key=>localStorage.getItem(key),key);
    const starter=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.deepEqual(starter.woodRooms,['A','B','C']);
    for(const [room,items] of Object.entries(starter.layouts)){
      if(space==='dream'&&room==='C')assert.ok(items.length&&items.every(o=>o.exhibit));
      else assert.deepEqual(items.map(o=>o.k),['sofa']);
    }
  }
  await button('가전 수집').tap();
  await page.locator('#libraryItems [data-product="catalog:robot:R560BL1"]').getByRole('button',{name:/수집$/}).tap();
  await button('방에 놓기').tap();
  const collapsed=(await view.boundingBox()).height;
  await page.locator('#expand').tap();
  const expanded=(await view.boundingBox()).height;
  assert.ok(expanded>=height*.29&&expanded<collapsed,`Canvas height with closed/open drawer: ${collapsed}/${expanded}`);
  assert.ok(await page.locator('#spaces').evaluate(nav=>nav.scrollWidth<=nav.clientWidth+1),'All navigation fits');
  await button('배치 완료').tap();
  const before=await view.boundingBox();
  const points=await page.evaluate(()=>{
    const layout=JSON.parse(localStorage.dotroom),scene=document.querySelector('#scene');
    const box=scene.getBoundingClientRect(),scale=box.width/scene.width;
    const order=DotScene.sorted(layout.room,layout.layouts[layout.room]);
    const robot=order.find(o=>o.k==='catalog:robot:R560BL1');
    const loc=DotScene.place(layout.room,layout.theme,robot);
    const hit=(x,y)=>DotScene.hits(layout.room,layout.theme,order,x,y)[0];
    // Follow the centre column down to the edge of the visible robot.
    const x=loc.x+Math.floor(loc.s.w/2)+.5;
    for(let y=loc.y+loc.s.h-.5;y>=loc.y;y--){
      if(hit(x,y)!==robot)continue;
      const near=y+6/scale;
      const under=hit(x,near);
      if(under&&DotScene.products[under.k].layer)throw Error('Occupied test point');
      return {x:box.left+x*scale,inside:box.top+(y-2)*scale,near:box.top+near*scale};
    }
    throw Error('No visible robot');
  });
  await stroke(points.x,points.inside,6);
  await button('청소 시간').waitFor();
  await page.waitForFunction(()=>document.querySelector('#lifeTitle').textContent==='LG전자 코드제로 R5');
  assert.deepEqual(await view.boundingBox(),before,'Room stays still on product tap');
  await button('닫기').tap();
  await stroke(points.x,points.near,0);
  await button('청소 시간').waitFor();
  await page.waitForFunction(()=>document.querySelector('#lifeTitle').textContent==='LG전자 코드제로 R5');
  await button('닫기').tap();
  await stroke(points.x,points.inside,24);
  assert.equal(await page.locator('#lifeTitle').innerText(),'드림룸');
  await stroke(before.x+5,before.y+5,0);
  assert.equal(await page.locator('#lifeTitle').innerText(),'드림룸');
  await page.reload();await button('배치 편집').waitFor();
  assert.ok(await page.evaluate(()=>JSON.parse(localStorage.dotroom).layouts.B.some(o=>o.k==='catalog:robot:R560BL1')));
  console.log(width+'×'+height+' edit canvas '+collapsed+'px / expanded '+expanded+'px; edge tap, finger drift, pan, stable room, reload passed');
  await page.context().close();
}
(async()=>{
  const browser=await chromium.launch({channel:'chrome'});
  try{for(const [w,h] of [[320,568],[390,844]])await check(browser,w,h)}
  finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
