const {expectedTitle}=require('./catalog-room-title.cjs');
const assert=require('node:assert/strict');
const {tapPlacement}=require('./catalog-phase-five.cjs');

async function verifyPhone(browser,base,width,height,examples,category,slug,phase,captures=[]){
  const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.setDefaultTimeout(8000);
  const tap=id=>page.locator('#'+id).tap();
  const ready=()=>page.waitForSelector('#rooms button');
  const layout=()=>page.evaluate(()=>JSON.parse(localStorage.dotroom).layouts.C);
  try{
    await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{
      const paint=DotScene.paint;
      DotScene.paint=function(...args){window.renderedFrame=args[5];return paint(...args)};
    }));
    await page.goto(base+'/editor?space=dream&room=C');await ready();
    const original=await layout();
    for(const {model,reviewHold=false,reaction} of examples){
      await tap('libraryButton');await tap('openCatalog');
      await page.locator('#catalogFamilies button').filter({hasText:category}).tap();
      await page.locator('#catalogSearch').fill(model);
      await page.getByRole('button',{name:model+' 수집',exact:true}).tap();
      await tap('placeCollected');
      const target=(await layout()).find(o=>!original.some(old=>old.id===o.id));
      const code=model;
      assert.equal(await page.evaluate(k=>DotScene.products[k].modelCode,target.k),code);
      assert.equal(target.bundleId,undefined);
      const card=page.locator('[data-key="'+target.k+'"] canvas');
      assert.ok(await card.count(),model+' 서랍');
      if(process.env.ROOM_CAPTURE_DIR&&width===390&&captures.includes(model)){
        await card.scrollIntoViewIfNeeded();
        await page.screenshot({path:require('node:path').join(process.env.ROOM_CAPTURE_DIR,phase+'-'+model+'.png')});
      }
      for(const turn of (slug==='dryer'?[1,2,3,0,1,2,3]:[1,2,3,0,1])){
        await tap('flip');assert.equal((await layout()).find(o=>o.id===target.id).turn,turn);
      }
      const rotated=(await layout()).find(o=>o.id===target.id);
      await tap('editMode');await page.reload();await ready();
      assert.deepEqual((await layout()).find(o=>o.id===target.id),rotated);
      await tapPlacement(page,target.id);
      await page.waitForFunction(code=>document.querySelector('#lifeTitle').textContent===code&&document.querySelector('#lifeDetail').textContent==='',await expectedTitle(page,category,code));
      const kind=target.k.startsWith('catalog:purifier:')?'purifier':(slug==='washer'||target.k.startsWith('catalog:dryer:'))?'washer':null;
      if(reaction){
        await page.waitForFunction(({id,reaction})=>renderedFrame?.reaction?.kind===reaction&&renderedFrame.reaction.itemId===id,{id:target.id,reaction});
      }
      if(kind&&!reviewHold){
        await page.waitForFunction(({id,kind})=>renderedFrame?.reaction?.kind===kind&&renderedFrame.reaction.itemId===id&&!renderedFrame.walking,{id:target.id,kind});
        const looking=await page.evaluate(target=>{
          const {cat,facingLeft}=renderedFrame,{x,s}=DotScene.place('C','pink',target);
          return facingLeft===(x+s.w/2<cat.x);
        },rotated);
        assert.ok(looking,'고양이 시선 '+code);
      }
      await page.locator('#lifeActions').getByRole('button',{name:'닫기'}).tap();
      await tap('editMode');await tapPlacement(page,target.id);await tap('remove');await tap('editMode');
      assert.deepEqual(await layout(),original);
    }
    assert.deepEqual(errors,[]);
    console.log('PASS',width,height,examples.length,'단품');
  }finally{await page.context().close();}
}

module.exports={verifyPhone};
