const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {tapPlacement}=require('./catalog-phase-five.cjs');
const base=process.argv[2]||'http://127.0.0.1:4174';

async function check(browser,width,height){
  const page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  const tap=id=>page.locator('#'+id).tap();
  const layout=()=>page.evaluate(()=>JSON.parse(localStorage.dotroom).layouts.C);
  try{
    await page.goto(base+'/editor?space=dream&room=C');await page.waitForSelector('#rooms button');
    const level=await page.evaluate(async()=>{
      const M=DotScene;
      const rows=await (await fetch('/api/catalog/bodies')).json();
      const {collect}=await import('/state.js');
      function tv(detail){
        const row=rows.find(r=>r[0]==='TV'&&r[2]==='tvFlat'&&r[5]===detail);
        const k=ProductCatalog.matchModel('TV',row[1]);ProductCatalog.restore(M.products,k);collect(k,'catalog');
        return k;
      }
      const bare=tv('unseen'),feet=tv('feet');
      const item=(id,k,x,y,e=0)=>({id,k,x,y,e,turn:0,f:0});
      const floor=item(1,'stool',49,28),panel=item(2,bare,49-M.products[bare].w,28);
      const top=Math.ceil(M.place('C','pink',floor).s.heightPx/DOT_ASSETS.zf);
      panel.e=top-1;
      const state=JSON.parse(localStorage.dotroom);
      state.layouts.C=[floor,panel,item(3,feet,54,6)];localStorage.dotroom=JSON.stringify(state);
      const wall=item(4,'wall_ac',10,0),cabinet=item(5,'wardrobe',10,0);
      wall.e=100;
      if(M.placementBlocker(wall,[cabinet],'C'))throw Error('overhead wall unit blocked');
      wall.e=-M.products.wall_ac.elev;
      if(!M.placementBlocker(wall,[cabinet],'C'))throw Error('low wall unit crossed cabinet');
      return top;
    });
    await page.reload();await page.waitForSelector('#rooms button');await tap('editMode');
    assert.equal(await page.locator('#duplicate').count(),0);
    await tapPlacement(page,3);assert.ok(await page.locator('#up').isHidden());
    await page.keyboard.press(']');await page.keyboard.press('d');
    assert.equal((await layout()).length,3);assert.equal((await layout())[2].e,0);
    await tapPlacement(page,2);assert.ok(await page.locator('#up').isVisible());
    const x=(await layout())[1].x;await page.keyboard.press('ArrowRight');
    assert.equal((await layout())[1].x,x,'same footprint and overlapping height blocked');
    await tap('up');await page.keyboard.press('ArrowRight');
    assert.equal((await layout())[1].x,x+1,'TV over stool');
    await tap('down');assert.equal((await layout())[1].e,level,'lowering into stool blocked');
    await tap('undo');assert.equal((await layout())[1].x,x);await page.keyboard.press('ArrowRight');
    const saved=await layout();await page.reload();await page.waitForSelector('#rooms button');
    assert.deepEqual(await layout(),saved);console.log('PASS',width,height,'stand, panel, height collision, undo and reload');
  }finally{await page.context().close();}
}
(async()=>{const browser=await chromium.launch({channel:'chrome'});
  try{await Promise.all([check(browser,390,844),check(browser,320,568)]);}
  finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
