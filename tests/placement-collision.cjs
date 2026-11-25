const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:4173';
const item=(id,k,x,y,extra={})=>({id,k,x,y,f:0,e:0,...extra});

async function exercise(browser,space,width,height){
  const touch=width<700;
  const page=await browser.newPage({viewport:{width,height},hasTouch:touch,isMobile:touch});
  const cdp=await page.context().newCDPSession(page);
  const key=space==='dream'?'dotroom':'lg-miniroom.dot.my.thinq';
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/my-appliances',r=>r.fulfill({json:{mode:'thinq',devices:[{id:'tv',k:'tvset',name:'거실 TV'}]}}));
  const layout=()=>page.evaluate(key=>JSON.parse(localStorage[key]).layouts.B,key);
  await page.goto(base+'/editor?space='+space);
  await page.getByRole('button',{name:'배치 편집',exact:true}).waitFor();
  async function load(items){
    await page.evaluate(({key,items})=>{
      localStorage.setItem(key,JSON.stringify({room:'B',theme:'pink',layouts:{B:items}}));
      if(key==='dotroom'){
        localStorage['lg-miniroom.state']=JSON.stringify({schemaVersion:1,revision:1,
          collection:['tvset'],dreamLayout:{},myLayout:{},savedRoutines:[]});
      }
    },{key,items});
    await page.reload();await page.getByRole('button',{name:'배치 편집',exact:true}).click();
  }
  async function point(id){
    return page.evaluate(({key,id})=>{
      const data=JSON.parse(localStorage[key]),items=DotScene.sorted('B',data.layouts.B);
      const o=items.find(o=>o.id===id),q=DotScene.place('B','pink',o);
      const canvas=document.querySelector('#scene'),box=canvas.getBoundingClientRect(),k=box.width/canvas.width;
      for(let y=q.y+2;y<q.y+q.s.h-2;y++)for(let x=q.x+2;x<q.x+q.s.w-2;x++){
        if(![[0,0],[1,1],[-1,-1]].every(([dx,dy])=>DotScene.hits('B','pink',items,x+dx,y+dy)[0]===o))continue;
        const px=box.x+(x+.5)*k,py=box.y+(y+.5)*k;
        if(document.elementFromPoint(px,py)?.id==='view')return {x:px,y:py,k};
      }
      throw Error('No visible point for '+id);
    },{key,id});
  }
  async function pointer(type,x,y){
    if(touch)return cdp.send('Input.dispatchTouchEvent',{type:{down:'touchStart',move:'touchMove',up:'touchEnd',cancel:'touchCancel'}[type],
      touchPoints:['up','cancel'].includes(type)?[]:[{x,y,id:1}]});
    if(type==='down'){await page.mouse.move(x,y);return page.mouse.down()}
    if(type==='move')return page.mouse.move(x,y);
    return page.mouse.up();
  }
  const tv=item(2,'tvset',31,26,{deviceId:'tv'});
  const start=[item(1,'stool',16,26),tv,item(3,'rug',20,23)];
  await load(start);
  const p=await point(1);
  const move=dx=>pointer('move',p.x+2*dx*p.k,p.y+dx*p.k);
  await pointer('down',p.x,p.y);await move(10);await move(14);
  await page.waitForFunction(()=>document.querySelector('#placementHint').textContent.includes('TV'));
  assert.deepEqual(await layout(),start,'preview never writes into saved layout');
  await pointer('up');let placed=await layout();
  assert.equal(placed[0].x,26,'stool touches the TV edge and stands on the rug');assert.equal(placed[0].y,26);
  await page.reload();await page.getByRole('button',{name:'배치 편집',exact:true}).click();
  assert.deepEqual(await layout(),placed);
  if(touch){
    const pos=await point(1);await pointer('down',pos.x,pos.y);
    await pointer('move',pos.x-12*pos.k,pos.y-6*pos.k);await pointer('cancel');
    assert.deepEqual(await layout(),placed);
  }
  const pos=await point(1);await page.mouse.click(pos.x,pos.y);
  await page.keyboard.press('ArrowRight');assert.deepEqual(await layout(),placed);
  await page.locator('#duplicate').click();
  assert.equal((await layout()).length,4);
  assert.ok(await page.evaluate(key=>{const objects=JSON.parse(localStorage[key]).layouts.B;return !DotScene.placementBlocker(objects.at(-1),objects)},key));
  await page.locator('#undo').click();assert.deepEqual(await layout(),placed);

  const turn=[item(1,'sofa',18,16),item(2,'coffee',30,31)];
  await load(turn);const couch=await point(1);await page.mouse.click(couch.x,couch.y);
  await page.locator('#flip').click();assert.deepEqual(await layout(),turn);
  assert.ok(await page.locator('#undo').isDisabled(),'blocked rotation leaves no history');
  await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('겹쳐서'));

  // A legacy layout with two coincident items must load unchanged and permit escape.
  const legacy=[item(1,'stool',16,26),item(2,'stool',16,26)];
  await load(legacy);assert.deepEqual(await layout(),legacy);
  const top=await point(2);await pointer('down',top.x,top.y);
  await pointer('move',top.x+20*top.k,top.y+10*top.k);await pointer('up');
  assert.equal((await layout())[1].x,26);
  await page.locator('#undo').click();assert.deepEqual(await layout(),legacy);
  const packed=[];for(let x=0;x<100;x+=5)for(let y=0;y<84;y+=5){
    if(x>=52&&y>=48)continue;
    packed.push(item(packed.length+1,'stool',Math.min(95,x),Math.min(79,y)));
  }
  await load(packed);
  await page.locator('[data-cat="가전"]').click();await page.locator('[data-key=tvset]').click();
  assert.deepEqual(await layout(),packed);assert.ok(await page.locator('#undo').isDisabled());
  assert.match(await page.locator('#notice').innerText(),/자리가 부족/);
  assert.deepEqual(errors,[]);await page.context().close();
  console.log('PASS',space,width,height,'drag, blocked drop, rug, rotation, keyboard, duplicate, undo, full room and legacy layout');
}
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
  await exercise(browser,'dream',390,844);await exercise(browser,'my',1150,750);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
