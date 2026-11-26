const {expectedTitle}=require('./catalog-room-title.cjs');
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require('playwright');
const {tapPlacement}=require('./catalog-phase-five.cjs');
const {reviewCatalog}=require('../scripts/review-catalog.cjs');
const pilots=require('../docs/catalog-art-reviews.json');
const base=process.argv[2]||'http://127.0.0.1:4174';

async function checkRoom(browser,width,height){
  const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  page.setDefaultTimeout(8000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const tap=id=>page.locator('#'+id).tap();
  const ready=()=>page.waitForSelector('#rooms button');
  const layout=()=>page.evaluate(()=>JSON.parse(localStorage.dotroom).layouts.C);
  try{
    await page.goto(base+'/editor?space=dream&room=C');await ready();
    const initial=await layout(),thumbnails=new Set();
    for(const [model,{category,before}] of Object.entries(pilots)){
      await tap('libraryButton');await tap('openCatalog');
      await page.locator('#catalogFamilies button').filter({hasText:category}).tap();
      await page.locator('#catalogSearch').fill(model);
      await page.getByRole('button',{name:model+' 수집',exact:true}).tap();await tap('placeCollected');
      const placed=(await layout()).find(o=>!initial.some(prev=>prev.id===o.id));
      const card=page.locator('[data-key="'+placed.k+'"] canvas');
      await card.scrollIntoViewIfNeeded();
      const thumbnail=await card.evaluate(c=>c.toDataURL());
      assert.ok(!thumbnails.has(thumbnail),model+' 중복 썸네일');thumbnails.add(thumbnail);
      assert.ok(await page.evaluate(({placed,before,category,thumbnail})=>{
        const product=DotScene.products[placed.k],canvas=document.createElement('canvas');
        if(product.spriteKey===before)return false;
        canvas.width=64;canvas.height=54;DotScene.thumbnail(canvas,placed.k,'pink');
        if(canvas.toDataURL()!==thumbnail)return false;
        const {s}=DotScene.place('C','pink',placed);
        const [x,y]=category==='공기청정기'?s.outlet:s.drumCenter;
        return s.pixels[(y*s.w+x)*4+3]>0;
      },{placed,before,category,thumbnail}));
      if(process.env.ROOM_CAPTURE_DIR&&width===390){
        await page.screenshot({path:path.join(process.env.ROOM_CAPTURE_DIR,'phase6-'+model+'.png')});
      }
      for(const expected of [1,2,3,0]){
        await tap('flip');assert.equal((await layout()).find(o=>o.id===placed.id).turn,expected);
      }
      await tap('editMode');await page.reload();await ready();
      assert.equal((await layout()).find(o=>o.id===placed.id).k,placed.k);
      await tapPlacement(page,placed.id);
      await page.waitForFunction(m=>document.querySelector('#lifeTitle').textContent===m&&document.querySelector('#lifeDetail').textContent==='',await expectedTitle(page,category,model));
      await page.locator('#lifeActions').getByRole('button',{name:'닫기'}).tap();
      await tap('editMode');await tapPlacement(page,placed.id);await tap('remove');await tap('editMode');
      assert.deepEqual(await layout(),initial);console.log('PASS',width,height,model);
    }
    assert.deepEqual(errors,[]);
  }finally{await page.context().close();}
}

(async()=>{
  const rows=await reviewCatalog('--all',base);
  assert.equal(new Set(rows.map(row=>row.category)).size,9);
  assert.ok(rows.every(row=>row.key&&row.spriteKey&&row.photo&&Array.isArray(row.components)));
  for(const [model,pilot] of Object.entries(pilots)){
    const row=rows.find(r=>r.category===pilot.category&&r.model===model);
    assert.equal(row.phase6.decision,pilot.decision);assert.notEqual(row.spriteKey,row.phase6.previousSprite);
  }
  console.log('PASS review worklist',rows.length,'models');
  const browser=await chromium.launch({channel:'chrome'});
  try{for(const size of [[320,568],[390,844]])await checkRoom(browser,...size);}
  finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
