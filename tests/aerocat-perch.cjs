const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {tapPlacement}=require('./catalog-phase-five.cjs');

const base=process.argv[2]||'http://127.0.0.1:4174';
const model='AS065CWHA';
async function check(browser,width,height,reduced){
  const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true,
    reducedMotion:reduced?'reduce':'no-preference'});
  const tap=id=>page.locator('#'+id).tap();
  try{
    await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{
      const paint=DotScene.paint;
      window.stages=new Set();
      window.returnFrames=[];
      DotScene.paint=function(...args){
        const frame=args[5];
        window.catFrame=frame;
        const pose=frame?.reaction?.perchPose;
        if(pose){
          stages.add(pose);
          if(pose!==returnFrames.at(-1)?.pose)returnFrames.push({pose,x:frame.cat.x,y:frame.cat.y,id:frame.reaction.itemId});
        }
        return paint(...args);
      };
    }));
    await page.goto(base+'/editor?space=dream&room=C');
    await page.waitForSelector('#rooms button');
    await tap('libraryButton');await tap('openCatalog');
    await page.locator('#catalogFamilies button').filter({hasText:'공기청정기'}).tap();
    await page.locator('#catalogSearch').fill(model);
    await page.getByRole('button',{name:model+' 수집',exact:true}).tap();
    await tap('placeCollected');
    const id=await page.evaluate(()=>JSON.parse(localStorage.dotroom).layouts.C.findLast(o=>DotScene.products[o.k]?.modelCode==='AS065CWHA').id);
    for(let turn=0;turn<4;turn++){
      if(turn)await tap('flip');
      await tap('editMode');
      await page.evaluate(()=>stages.clear());
      await tapPlacement(page,id);
      await page.waitForFunction(id=>catFrame?.reaction?.itemId===id&&catFrame.reaction.perchPose==='seated',id);
      const pose=await page.evaluate(id=>{
        const state=JSON.parse(localStorage.dotroom),o=state.layouts.C.find(o=>o.id===id);
        const {x,y,s}=DotScene.place('C',state.theme,o);
        const [px,py]=s.perch.seat;
        return {p:[catFrame.cat.x,catFrame.cat.y],seat:[x+(o.f?s.w-1-px:px),y+py],stages:[...stages],turn:o.turn||0};
      },id);
      assert.deepEqual(pose.p,pose.seat);assert.equal(pose.turn,turn);
      assert.deepEqual(pose.stages,reduced?['seated']:['jump','step','seated']);
      if(turn===0){
        await page.waitForTimeout(950);
        assert.deepEqual(await page.evaluate(()=>[catFrame.cat.x,catFrame.cat.y]),pose.seat);
        if(process.env.ROOM_CAPTURE_DIR)await page.locator('#view').screenshot({path:require('node:path').join(process.env.ROOM_CAPTURE_DIR,'aerocat-'+width+'.png')});
      }
      const route=await page.evaluate(id=>{
        const state=JSON.parse(localStorage.dotroom),list=state.layouts.C,o=list.find(o=>o.id===id);
        const {x,y,s}=DotScene.place('C',state.theme,o),[px,py]=s.perch.step;
        returnFrames.length=0;
        return {step:[x+(o.f?s.w-1-px:px),y+py],dryer:list.find(o=>o.k.startsWith('catalog:dryer:')).id};
      },id);
      if(turn%2===0){
        await page.getByRole('button',{name:'닫기',exact:true}).tap();
        await page.waitForFunction(()=>catFrame&&!catFrame.reaction&&!catFrame.walking);
      }else{
        await tapPlacement(page,route.dryer);
        await page.waitForFunction(id=>catFrame?.reaction?.itemId===id&&!catFrame.walking,route.dryer);
      }
      const frames=await page.evaluate(()=>returnFrames.filter(f=>f.pose!=='seated'));
      assert.deepEqual(frames.map(f=>f.pose),reduced?[]:['jump','step','jump']);
      if(!reduced){
        assert.deepEqual([frames[1].x,frames[1].y],route.step);
        assert.ok(frames.every(f=>f.id===id));
      }
      const ground=await page.evaluate(()=>catFrame.cat);
      assert.notDeepEqual([ground.x,ground.y],pose.seat);
      if(turn%2)await page.getByRole('button',{name:'닫기',exact:true}).tap();
      await tap('editMode');await tapPlacement(page,id);
    }
    console.log('PASS',width,height,reduced?'reduced':'animated','four turns, step, seat, hold and return');
  }finally{await page.context().close();}
}
(async()=>{
  const browser=await chromium.launch({channel:'chrome'});
  try{await Promise.all([check(browser,390,844,false),check(browser,320,568,false),check(browser,320,568,true)]);}
  finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
