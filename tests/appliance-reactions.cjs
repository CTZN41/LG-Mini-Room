const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:4173';

async function exercise(browser,space,width,height,reduced){
  const page=await browser.newPage({viewport:{width,height},isMobile:width<500,hasTouch:width<500,
    reducedMotion:reduced?'reduce':'no-preference'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const btn=name=>page.getByRole('button',{name,exact:true});
  const key=space==='my'?'lg-miniroom.dot.my':'dotroom';
  const codes={tower_ac:['에어컨','FQ16ET4HSN','catalog:ac:FQ16ET4HSN'],wall_ac:['에어컨','SQ06ACJCAJ.AKORG','catalog:ac:SQ06ACJCAJ.AKORG'],
    wash_m:['세탁기','WL2521WDUR','washer_wl2521wdur'],puri_m:['공기청정기','AS206NGHA','catalog:purifier:AS206NGHA'],
    styler:['스타일러','TEST-STYLER','camera:TEST-STYLER'],floor_lamp:['조명','','floor_lamp'],
    fridge_bm:['냉장고','M876GBC472','catalog:fridge:M876GBC472'],fridge_pb:['냉장고','B315DS11','catalog:fridge:B315DS11'],
    fridge_sg:['냉장고','S836MDS002','catalog:fridge:S836MDS002'],vacuum:['무선청소기','A727TA','catalog:stick:A727TA'],
    robot_vacuum:['로봇청소기','R560BL1','catalog:robot:R560BL1']};
  const device=o=>({...o,category:codes[o.k][0],modelCode:codes[o.k][1],kind:o.k,k:codes[o.k][2],f:0,e:0});
  const stateKey=space==='my'?'lg-miniroom.state.thinq':'lg-miniroom.state';
  const devices=[
    {id:1,k:'tower_ac',x:7,y:18},
    {id:2,k:'wash_m',x:65,y:8},
    {id:3,k:'wall_ac',x:34,y:0},
    {id:4,k:'tower_ac',x:30,y:50},
    {id:5,k:'puri_m',x:10,y:53},
    {id:6,k:'styler',x:69,y:31},
    {id:7,k:'floor_lamp',x:40,y:39}
  ].filter(o=>o.k!=='styler'||space==='my').map(o=>device({...o,deviceId:o.k==='styler'?'camera-unit:TEST-STYLER':'unit-'+o.id}));
  await page.route('**/api/my-appliances',route=>route.fulfill({json:{mode:'thinq',
    devices:devices.filter(o=>o.kind!=='styler').map(o=>({id:o.deviceId,category:o.category,modelCode:o.modelCode,name:o.category+o.id}))}}));
  const layoutKey=space==='my'?key+'.thinq':key;
  await page.goto(base+'/editor?space='+space+'&observe=1');await btn('배치 편집').waitFor();
  await page.evaluate(({layoutKey,devices,stateKey})=>{
    localStorage.setItem(layoutKey,JSON.stringify({layoutVersion:1,room:'B',theme:'pink',layouts:{B:devices}}));
    localStorage.setItem(stateKey,JSON.stringify({schemaVersion:1,revision:1,
      cameraAppliances:devices.filter(o=>o.kind==='styler').map(o=>({id:'test-styler',modelCode:o.modelCode,category:o.category,displayName:'스타일러'})),collection:devices.map(o=>o.k),dreamLayout:{},myLayout:{},savedRoutines:[]}));
  },{layoutKey,devices,stateKey});
  await page.reload();await btn('배치 편집').waitFor();
  // Isolate the cat from furniture and wind streaks. Its top row is a broad
  // horizontal ear when folded, and a narrow tip when upright.
  const earWidths=await page.evaluate(()=>{
    const ctx=document.createElement('canvas').getContext('2d',{willReadFrequently:true});
    ctx.canvas.width=64;ctx.canvas.height=64;
    const pixels=()=>new Uint32Array(ctx.getImageData(0,0,64,64).data.buffer);
    DotScene.paint(ctx,'B','pink',[],null,null);
    const background=pixels(),widths=[];
    for(const wall of [false,true])for(const facingLeft of [false,true]){
      for(const progress of [0,.1,.25,.5,.7,.9,.999,0]){
        DotScene.paint(ctx,'B','pink',[],null,{cat:{x:32,y:40},facingLeft,
          reaction:{kind:'air',wall,progress}});
        const frame=pixels(),top=frame.findIndex((v,i)=>v!==background[i]);
        const row=top-top%64;
        widths.push(frame.subarray(row,row+64).filter((v,i)=>v!==background[row+i]).length);
      }
    }
    return widths;
  });
  assert.ok(earWidths.every(width=>width>=6),'Airflow should keep both ear poses folded across loop boundaries');
  await page.evaluate(()=>{
    const paint=DotScene.paint;
    window.reactionLoops={};
    window.washerPauseFrames=new Set();
    DotScene.paint=function(ctx,room,tone,items,selected,fx){
      const prev=window.pose?.reaction,next=fx?.reaction;
      if(next&&prev?.itemId===next.itemId&&next.progress<prev.progress){
        reactionLoops[next.itemId]=(reactionLoops[next.itemId]||0)+1;
      }
      window.pose=fx||null;
      paint(ctx,room,tone,items,selected,fx);
      if(next?.kind==='washer'&&next.progress>.56&&next.progress<.81){
        // The sock and head have stopped; a stray paw animation would change these pixels.
        washerPauseFrames.add(ctx.canvas.toDataURL());
      }
    };
  });
  async function tap(id){
    await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    const point=await page.evaluate(({layoutKey,id})=>{
      const {room,theme,layouts}=JSON.parse(localStorage[layoutKey]);
      const items=DotScene.sorted(room,layouts[room]),o=items.find(obj=>obj.id===id);
      const q=DotScene.place(room,theme,o),c=document.querySelector('#scene'),r=c.getBoundingClientRect();
      for(let y=4;y<q.s.h-4;y+=2)for(let x=4;x<q.s.w-4;x+=2){
        const X=r.x+(q.x+x+.5)*r.width/c.width,Y=r.y+(q.y+y+.5)*r.height/c.height;
        if(!document.querySelector('#view').contains(document.elementFromPoint(X,Y)))continue;
        if([[0,0],[3,3],[-3,-3],[3,-3],[-3,3]].every(([dx,dy])=>DotScene.hits(room,theme,items,q.x+x+dx,q.y+y+dy)[0]===o))
          return [X,Y];
      }
      throw Error('No visible tap point for '+o.k);
    },{layoutKey,id});
    if(width<500)await page.touchscreen.tap(...point);else await page.mouse.click(...point);
  }
  async function checkProductTitle(id){
    const d=devices.find(d=>d.id===id);
    const expected=d.kind==='styler'?'스타일러':await require('./catalog-room-title.cjs').expectedTitle(page,d.category,d.modelCode);
    await page.waitForFunction(title=>document.querySelector('#lifeTitle').textContent===title,expected);
  }
  const arrived=id=>page.waitForFunction(id=>window.pose?.reaction?.itemId===id,id);
  await tap(7);await arrived(7);
  assert.equal(await page.locator('#lifeTitle').innerText(),'스탠드 조명');
  assert.equal(await page.locator('#lifeDetail').innerText(),'');
  await btn('조명 켜기').click();assert.equal(await page.locator('#lifeDetail').innerText(),'');
  await btn('조명 끄기').click();await btn('닫기').click();
  await tap(1);await arrived(1);
  await checkProductTitle(1);
  assert.equal(await page.locator('#lifeDetail').innerText(),'');
  assert.equal(await btn('미리보기').count(),0);
  assert.equal(await page.evaluate(()=>pose.reaction.kind),'air');
  const first=await page.evaluate(()=>pose.cat);
  if(!reduced){
    await page.waitForFunction(()=>reactionLoops[1]>=2);
    assert.deepEqual(await page.evaluate(()=>pose.cat),first);
  }
  await tap(4);await arrived(4);
  assert.notDeepEqual(await page.evaluate(()=>pose.cat),first);
  await tap(1);await tap(2);await arrived(2);
  await checkProductTitle(2);
  assert.equal(await page.locator('#lifeDetail').innerText(),'');
  assert.equal(await page.evaluate(()=>pose.reaction.kind),'washer');
  assert.notDeepEqual(await page.evaluate(()=>pose.cat),first);
  if(!reduced){
    await page.waitForFunction(()=>reactionLoops[2]>=2);
    assert.equal(await page.evaluate(()=>washerPauseFrames.size),1);
  }
  else {
    const frame=await page.locator('#scene').evaluate(c=>c.toDataURL());
    await page.waitForTimeout(2300);
    assert.equal(await page.locator('#scene').evaluate(c=>c.toDataURL()),frame);
  }
  for(const [id,kind,title] of [[5,'purifier','공기청정기 민트'],[6,'styler','스타일러']]){
    if(id===6&&space==='dream')continue;
    await tap(id);await arrived(id);
    assert.equal(await page.evaluate(()=>pose.reaction.kind),kind);
    await checkProductTitle(id);
    assert.equal(await page.locator('#lifeDetail').innerText(),'');
    assert.equal(await btn('미리보기').count(),0);
    assert.deepEqual(await page.evaluate(()=>pose.appliances),{});
    const stillFrame=await page.locator('#scene').evaluate(c=>c.toDataURL());
    if(reduced){
      await page.waitForTimeout(200);
      assert.equal(await page.locator('#scene').evaluate(c=>c.toDataURL()),stillFrame);
    }else{
      await page.waitForFunction(frame=>document.querySelector('#scene').toDataURL()!==frame,stillFrame);
      await page.waitForFunction(id=>reactionLoops[id]>=1,id);
    }
  }
  assert.ok(await page.evaluate(()=>!localStorage.getItem('lg-miniroom.discovered.clothes-care')));
  await tap(space==='my'?6:2);await btn('의류 관리').click();
  await btn('미리보기').click();
  assert.equal(await page.evaluate(()=>pose.reaction),null);
  assert.equal(await page.evaluate(id=>pose.appliances[id],space==='my'?6:2),space==='my'?'styler':'washer');
  await btn('재생 종료').click();await btn('미리보기').waitFor();
  await tap(3);await arrived(3);
  assert.ok(await page.evaluate(()=>pose.reaction.wall));
  assert.deepEqual(await page.evaluate(()=>pose.appliances),{});
  assert.ok(await page.evaluate(()=>!localStorage.getItem('lg-miniroom.discovered.room-comfort')));
  await checkProductTitle(3);
  await btn('쾌적한 방').click();
  await btn('미리보기').click();
  assert.equal(await page.evaluate(()=>pose.reaction),null);
  assert.equal(await page.evaluate(()=>pose.appliances[3]),'air');
  await btn('재생 종료').click();await btn('미리보기').waitFor();
  await tap(2);await btn('배치 편집').click();await tap(2);
  assert.equal(await page.evaluate(()=>window.pose),null);
  await btn('배치 완료').click();
  assert.equal(await page.evaluate(()=>pose.reaction),null);
  // Isolate the low cleaner from the tall refrigerator sprites during touch checks.
  const pets=['fridge_bm','fridge_pb','fridge_sg','vacuum','robot_vacuum'];
  const locations=[[2,0],[23,0],[44,0],[25,48],[38,30]];
  devices.splice(0,devices.length,...pets.map((k,i)=>device({
    k,id:10+i,deviceId:'pet-'+i,x:locations[i][0],y:locations[i][1],f:0,e:0
  })));
  await page.evaluate(({layoutKey,devices,stateKey})=>{
    localStorage[layoutKey]=JSON.stringify({layoutVersion:1,room:'B',theme:'pink',layouts:{B:devices}});
    const state=JSON.parse(localStorage[stateKey]);state.collection=devices.map(d=>d.k);
    localStorage[stateKey]=JSON.stringify(state);
  },{layoutKey,devices,stateKey});
  await page.reload();await btn('배치 편집').waitFor();
  await page.evaluate(()=>{
    const paint=DotScene.paint;
    DotScene.paint=function(...args){window.pose=args[5];window.shown=args[3];return paint(...args)};
  });
  const savedLayout=await page.evaluate(key=>localStorage[key],layoutKey);
  for(const device of devices){
    await tap(device.id);await arrived(device.id);
    await checkProductTitle(device.id);
    assert.equal(await page.evaluate(()=>pose.reaction.kind),device.kind.startsWith('fridge_')?'fridge':device.kind);
    assert.deepEqual(await page.evaluate(()=>pose.appliances),{});
    assert.equal(await btn('미리보기').count(),0);
    const frame=await page.locator('#scene').evaluate(c=>c.toDataURL());
    if(reduced){
      await page.waitForTimeout(180);
      assert.equal(await page.locator('#scene').evaluate(c=>c.toDataURL()),frame);
    }else{
      await page.waitForFunction(frame=>document.querySelector('#scene').toDataURL()!==frame,frame);
    }
  }
  if(!reduced){
    await page.waitForFunction(()=>pose.movingRobot&&pose.movingRobot.id===14);
    assert.ok(await page.evaluate(()=>shown.some(o=>o===pose.movingRobot)));
  }
  await btn('닫기').click();
  assert.equal(await page.evaluate(()=>pose.reaction),null);
  assert.equal(await page.evaluate(key=>localStorage[key],layoutKey),savedLayout);
  assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage[key]).savedRoutines,stateKey),[]);
  if(space==='dream'){
    // The corner has walls on two sides, furniture flush against the other two.
    await page.evaluate(key=>{
      const s=JSON.parse(localStorage[key]),items=s.layouts.B;
      Object.assign(items.find(o=>o.id===14),{x:0,y:0});
      items.push({id:51,k:'wardrobe',x:8,y:0,f:0,e:0},{id:52,k:'wardrobe',x:0,y:8,f:0,e:0});
      localStorage[key]=JSON.stringify(s);
    },layoutKey);
    await page.reload();await btn('배치 편집').waitFor();
    // Keyboard navigation also visits a device hidden behind taller furniture.
    await page.locator('#view').focus();
    for(let i=0;i<devices.length;i++){
      await page.keyboard.press('ArrowRight');
      if((await page.locator('#keyboardTarget').innerText()).includes('로봇청소기'))break;
    }
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#lifeDetail').innerText(),'');
  }
  assert.deepEqual(errors,[]);await page.context().close();
  console.log('PASS',space,width,height,reduced?'reduced motion':'animated','tap, retarget, preview and edit');
}
(async()=>{
  const browser=await chromium.launch({channel:'chrome'});
  try{
    await exercise(browser,'dream',390,844,false);
    await exercise(browser,'my',320,568,true);
    await exercise(browser,'my',1150,750,false);
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
