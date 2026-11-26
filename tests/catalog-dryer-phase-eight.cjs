const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {verifyPhone}=require('./catalog-room-check.cjs');
const {reviewCatalog}=require('../scripts/review-catalog.cjs');
const {models}=require('../dryer-profiles.cjs');
const base=process.argv[2]||'http://127.0.0.1:4174';

(async()=>{
  const rows=await reviewCatalog('건조기',base);
  assert.equal(rows.length,144);
  assert.deepEqual(new Set(rows.map(row=>row.model)),new Set([...models.keys()].filter(code=>code!=='RV1029C4T/C7T')));
  const selections=new Map();
  for(const row of rows){
    const profile=models.get(row.model);
    assert.equal(row.spriteKey,profile.key,row.model);
    assert.equal(row.decision,profile.decision);
    assert.ok(row.reason);
    if(!selections.has(profile.detail))selections.set(profile.detail,{model:row.model,reviewHold:profile.detail==='hold'});
  }
  const browser=await chromium.launch({channel:'chrome'});
  try{
    const page=await browser.newPage();
    await page.goto(base+'/editor?space=dream&room=C');await page.waitForSelector('#rooms button');
    assert.deepEqual(await (await page.request.get(base+'/api/catalog/bundles')).json(),[]);
    const issues=await page.evaluate(rows=>{
      const invalid=[],tested=new Set();
      function reactionFrame(o,loc,progress){
        const canvas=document.createElement('canvas');canvas.width=loc.s.w;canvas.height=loc.s.h;
        const ctx=canvas.getContext('2d');ctx.translate(-loc.x,-loc.y);
        const fx={sleepBed:-1,time:0,reaction:{kind:'washer',itemId:o.id,progress}};
        DotScene.paint(ctx,'C','pink',[o],null,fx);
        return ctx.getImageData(0,0,canvas.width,canvas.height).data;
      }
      for(const row of rows){
        if(row.decision==='사진 보류')continue;
        ProductCatalog.restore(DotScene.products,row.key);
        for(const turn of [0,1,2,3]){
          const obj={id:1,k:row.key,x:12,y:20,e:0,turn,f:turn%2},loc=DotScene.place('C','pink',obj),s=loc.s;
          const back=turn===1||turn===2;
          const signature=row.spriteKey+'|'+turn;
          if(!tested.has(signature)){
            tested.add(signature);
            const first=reactionFrame(obj,loc,.1),second=reactionFrame(obj,loc,.6);
            let changed=0;
            for(let i=0;i<first.length;i+=4){
              if(first[i]===second[i]&&first[i+1]===second[i+1]&&first[i+2]===second[i+2])continue;
              changed++;
              const [cx,cy]=s.drumCenter||[-100,-100];
              if(back||Math.abs((i/4)%s.w-(obj.f?s.w-cx:cx))>7||Math.abs(Math.floor(i/4/s.w)-cy)>9){
                invalid.push([row.model,turn,'animation outside door']);break;
              }
            }
            if(!back&&!changed)invalid.push([row.model,turn,'static door']);
          }
          if(back){if(s.drumCenter)invalid.push([row.model,turn,'rear']);continue;}
          const [x,y]=s.drumCenter||[-99,-99];
          // The visible sock's animated extents must fit within the projected door.
          if(![[-5,-5],[5,5],[0,0]].every(([dx,dy])=>s.pixels[((y+dy)*s.w+x+dx)*4+3]>0)){
            invalid.push([row.model,turn,'door']);
          }
        }
      }
      return invalid;
    },rows);
    assert.deepEqual(issues,[]);await page.close();
    const shots=['RD19ENC','RD20ENEF','RH10VTA','RN12SBD'];
    console.log('PASS',rows.length,'건조기 단품');
    await Promise.all([[320,568],[390,844]].map(size=>verifyPhone(browser,base,...size,[...selections.values()],'건조기','dryer','phase8',shots)));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
