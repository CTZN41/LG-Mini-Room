const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {verifyPhone}=require('./catalog-room-check.cjs');
const {reviewCatalog}=require('../scripts/review-catalog.cjs');
const base=process.argv[2]||'http://127.0.0.1:4174';

(async()=>{
  const rows=await reviewCatalog('세탁기',base);
  assert.equal(rows.length,561);
  assert.ok(rows.every(row=>row.reason&&row.decision!=='미판정'));
  const browser=await chromium.launch({channel:'chrome'});
  try{
    const page=await browser.newPage();
    await page.goto(base+'/editor?space=dream&room=C');await page.waitForSelector('#rooms button');
    // Each row compares two complete, unmirrored PNGs, independent of the sale/storage key.
    const groups=[
      ['F21VDSK','F21VDSKR'],['FG19WN','FG19WNR','FG21WN','FG21WNR'],['FG21KN','FG21KNR'],
      ['T18WX7','T18WX7Y'],['T19MX7A','T19MX7AY'],['WL21WDU','WL2521WDUR']
    ];
    for(const codes of groups){
      assert.equal(new Set(codes.map(code=>rows.find(row=>row.model===code).imageId)).size,1);
      const unique=await page.evaluate(codes=>{
        const pairs=codes.map(code=>{
          const k=ProductCatalog.matchModel('세탁기',code);ProductCatalog.restore(DotScene.products,k);
          return [0,2].map(turn=>DotScene.place('C','pink',{k,x:12,y:20,e:0,turn,f:0}).s.im.toDataURL()).join('|');
        });
        return new Set(pairs).size;
      },codes);
      assert.equal(unique,1,codes.join(', '));
    }
    const differing=await page.evaluate(rows=>{
      const byPhoto=new Map(),encoded=new WeakMap();
      for(const {key,imageId,model} of rows){
        ProductCatalog.restore(DotScene.products,key);
        const pair=[0,2].map(turn=>{
          const {s}=DotScene.place('C','pink',{k:key,x:12,y:20,e:0,turn,f:0});
          if(!encoded.has(s.im))encoded.set(s.im,s.im.toDataURL());
          return encoded.get(s.im);
        }).join('|');
        if(!byPhoto.has(imageId))byPhoto.set(imageId,{pairs:new Set(),models:[]});
        const group=byPhoto.get(imageId);group.pairs.add(pair);group.models.push(model);
      }
      return [...byPhoto.values()].filter(group=>group.pairs.size>1).map(group=>group.models.sort());
    },rows);
    assert.deepEqual(differing,[]);
    const issues=await page.evaluate(rows=>{
      const issues=[];
      for(const {model,key} of rows){
        const p=ProductCatalog.restore(DotScene.products,key);
        if(p.modelCode!==model||ProductCatalog.componentOnly(key))issues.push([model,'identity']);
        for(const turn of [0,1,2,3]){
          const {s}=DotScene.place('C','pink',{k:key,x:12,y:20,e:0,turn,f:turn%2});
          const front=turn===0||turn===3;
          if(!p.body||p.nativeWasher||!front)continue;
          const anchor=p.washerStyle==='top'||p.body.detail==='opaqueDoor'?s.lid:s.drumCenter;
          if(!anchor||!s.pixels[(anchor[1]*s.w+anchor[0])*4+3])issues.push([model,turn,'animation anchor']);
        }
      }
      return issues;
    },rows);
    assert.deepEqual(issues,[]);await page.close();
    const examples=['F12VVA','F13SED','F13SEE','F17CTP','F24WDWPX','F8VV','FC2521IQ6C','FG24ENF',
      'FH24ENE','T15DT','T15WUA','T16DU','T18PZ7','W10BHN','W2520WHM','F19WDBUX','F21VDSK'].map(model=>({model}));
    examples.push({model:'F24KDAP'});
    await Promise.all([[320,568],[390,844]].map(size=>verifyPhone(browser,base,...size,examples,'세탁기','washer','phase8-washer')));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
