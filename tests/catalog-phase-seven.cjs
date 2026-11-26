const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {reviewCatalog}=require('../scripts/review-catalog.cjs');
const {verifyPhone}=require('./catalog-room-check.cjs');
const {models}=require('../public/purifier-profiles.js');
const base=process.argv[2]||'http://127.0.0.1:4174';


(async()=>{
  const rows=await reviewCatalog('공기청정기',base);
  assert.equal(rows.length,147);
  assert.deepEqual(new Set(rows.map(row=>row.model)),new Set(models.keys()));
  const examples=new Map();
  for(const row of rows){
    const profile=models.get(row.model);
    assert.equal(row.spriteKey,profile.spriteKey,row.model);
    assert.equal(row.decision,profile.decision);
    assert.ok(row.reason);
    if(!row.model.includes(' + ')&&profile.shape!=='hold'&&!examples.has(profile.shape)){
      examples.set(profile.shape,{model:row.model});
    }
  }
  examples.set('paleDisplay',{model:'AS322DSFA'});
  assert.notEqual(models.get('AS322DSFA').spriteKey,models.get('AS353NB4A').spriteKey);
  const browser=await chromium.launch({channel:'chrome'});
  try{
    const page=await browser.newPage();
    await page.goto(base+'/editor?space=dream&room=C');await page.waitForSelector('#rooms button');
    assert.deepEqual(await (await page.request.get(base+'/api/catalog/bundles')).json(),[]);
    const issues=await page.evaluate(rows=>{
      const issues=[];
      for(const row of rows){
        if(row.decision==='사진 보류')continue;
        ProductCatalog.restore(DotScene.products,row.key);
        for(const turn of [0,1,2,3]){
          const {s}=DotScene.place('C','pink',{k:row.key,x:20,y:20,e:0,turn,f:turn%2});
          const [x,y]=s.outlet||s.mistOutlet||[-1,-1];
          if(!s.pixels[(y*s.w+x)*4+3])issues.push([row.model,turn,x,y]);
        }
      }
      return issues;
    },rows);
    assert.deepEqual(issues,[]);
    await page.close();
    await Promise.all([[320,568],[390,844]].map(size=>verifyPhone(browser,base,...size,[...examples.values()],'공기청정기','purifier','phase7',['AS180DWFC','AS235DWSA','AS309DWA','AS065CWHA'])));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
