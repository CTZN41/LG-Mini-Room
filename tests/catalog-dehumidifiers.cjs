const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:4173';
const featured='DQ203PCCA',pink='DQ202PPBC';
const key=model=>'catalog:dehumid:'+model;

async function check(browser,width,height){
  const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(8000);
  const tap=id=>page.locator('#'+id).tap();
  const layout=()=>page.evaluate(()=>JSON.parse(localStorage.dotroom));
  const ready=()=>page.waitForFunction(()=>document.querySelectorAll('[data-room]').length===3);
  async function select(model){
    const at=await page.evaluate(k=>{
      const items=JSON.parse(localStorage.dotroom).layouts.C,order=DotScene.sorted('C',items),o=items.find(o=>o.k===k);
      const {x,y,s}=DotScene.place('C','pink',o),canvas=document.querySelector('#scene'),r=canvas.getBoundingClientRect();
      for(let ly=Math.floor(s.h/3);ly<s.h;ly+=2)for(let lx=3;lx<s.w-3;lx+=2){
        if(DotScene.hits('C','pink',order,x+lx,y+ly)[0]?.id===o.id)
          return [r.left+(x+lx+.5)*r.width/canvas.width,r.top+(y+ly+.5)*r.height/canvas.height];
      }
    },key(model));
    assert.ok(at,model+' visible');await page.touchscreen.tap(...at);
  }
  try{
    await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{
      const paint=DotScene.paint;DotScene.paint=function(...args){window.frame= args[5];return paint(...args)};
    }));
    await page.goto(base+'/editor?space=dream&room=C');await ready();
    const before=await layout(),display=before.layouts.C.find(o=>o.k===key(featured));assert.ok(display.exhibit);
    await select(featured);
    await page.waitForFunction(m=>document.querySelector('#lifeTitle').textContent===m&&
      document.querySelector('#productPhoto').naturalWidth>0&&window.frame?.reaction?.kind==='dehumidifier',featured);
    assert.ok(await page.evaluate(()=>!window.frame.mist));
    await page.locator('#lifeActions').getByRole('button',{name:'닫기'}).tap();
    await tap('libraryButton');await tap('openCatalog');await page.locator('#catalogFamilies button').filter({hasText:featured}).tap();
    const catalog=new Map();
    for(const first of [1,17,33]){
      await page.waitForFunction(i=>document.querySelector('#catalogStatus').textContent.startsWith(i+'–'),first);
      for(const [model,image,label] of await page.locator('#catalogRows article').evaluateAll(rows=>rows.map(row=>[
        row.querySelector('strong').textContent,row.querySelector('canvas').toDataURL(),row.querySelector('small').textContent]))){
        assert.match(label,/물통|수위창|바퀴/);catalog.set(model,image);
      }
      if(first!==33)await tap('catalogNext');
    }
    assert.equal(catalog.size,40);assert.equal(new Set(catalog.values()).size,14);
    assert.equal(catalog.get('DQ134MWEC'),catalog.get('DQ134MWECS'));
    assert.notEqual(catalog.get(pink),catalog.get('DQ202PBBC'));
    assert.notEqual(catalog.get('DQ200PBBC'),catalog.get('DQ202PBBC'));
    const directions=await page.evaluate(models=>{
      const fronts=new Set(),backs=new Set();
      for(const model of models){
        const k='catalog:dehumid:'+model,item=ProductCatalog.restore(DotScene.products,k);
        const views=[0,2].map(turn=>DotScene.place('C','pink',{k,x:10,y:10,e:0,f:0,turn}).s);
        if(views.some(s=>!s.outlet||!s.pixels[(s.outlet[1]*s.w+s.outlet[0])*4+3]))throw Error('indicator '+model);
        if(views[0].im.toDataURL()===views[1].im.toDataURL())throw Error('rear '+model);
        for(const suffix of ['','_rear'])if(!DOT_ASSETS.sprites.appl[item.spriteKey+suffix].retroAA)throw Error(model);
        fronts.add(views[0].im.toDataURL());backs.add(views[1].im.toDataURL());
      }return [fronts.size,backs.size];
    },[...catalog.keys()]);assert.deepEqual(directions,[14,14]);
    await page.locator('#catalogSearch').fill(pink);await page.getByRole('button',{name:pink+' 수집',exact:true}).tap();
    await tap('placeCollected');await tap('flip');await tap('editMode');
    const placed=(await layout()).layouts.C.find(o=>o.k===key(pink));assert.ok(placed);assert.equal(placed.turn,1);
    await page.reload();await ready();assert.deepEqual((await layout()).layouts.C.find(o=>o.k===key(pink)),placed);
    await select(pink);await page.waitForFunction(m=>document.querySelector('#lifeTitle').textContent===m,pink);
    // Upgrade a previously edited Phase 1 room, then honour removal on the next visit.
    await page.evaluate(k=>{
      const l=JSON.parse(localStorage.dotroom);l.cDisplayVersion=1;l.layouts.C=l.layouts.C.filter(o=>o.k!==k&&!o.k.startsWith('catalog:purifier:'));
      localStorage.dotroom=JSON.stringify(l);
    },key(featured));
    await page.reload();await ready();const upgraded=await layout();assert.equal(upgraded.cDisplayVersion,4);
    assert.equal(upgraded.layouts.C.filter(o=>o.k===key(featured)).length,1);
    assert.ok(!upgraded.layouts.C.some(o=>o.k.startsWith('catalog:purifier:')));
    assert.deepEqual(upgraded.layouts.C.find(o=>o.k===key(pink)),placed);
    await page.evaluate(k=>{const l=JSON.parse(localStorage.dotroom);l.layouts.C=l.layouts.C.filter(o=>o.k!==k);localStorage.dotroom=JSON.stringify(l)},key(featured));
    await page.reload();await ready();assert.ok(!(await layout()).layouts.C.some(o=>o.k===key(featured)));
    assert.deepEqual(errors,[]);console.log('PASS',width,height,'40 models, 14 front/rear pairs, C touch, collect, rotate, restore and migration');
  }finally{await page.context().close()}
}
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
  for(const size of [[320,568],[390,844]])await check(browser,...size);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
