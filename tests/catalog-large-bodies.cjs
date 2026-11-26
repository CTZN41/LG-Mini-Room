const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:4174';
const sample='F24KDAP';

async function check(browser,width,height){
  const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
  const tap=id=>page.locator('#'+id).tap();
  const ready=()=>page.waitForFunction(()=>document.querySelectorAll('[data-room]').length===3);
  try{
    await page.goto(base+'/editor?space=dream&room=C');await ready();
    const url=(path,params)=>base+path+'?'+new URLSearchParams(params);
    const all=await (await page.request.get(base+'/api/catalog/bodies')).json();
    for(const [category,count] of [['냉장고',986],['세탁기',561],['건조기',144]])
      assert.equal(all.filter(row=>row[0]===category).length,count);
    const byModel=new Map(all.map(row=>[row[1],row]));
    assert.deepEqual(byModel.get('WA2525EGP6R').slice(2,5),['tower','green','beige']);
    assert.deepEqual(byModel.get('M876GBC472').slice(2,6),['four','beige','brown','window']);
    assert.equal(byModel.get('B315DS11')[2],'freezerTop');assert.equal(byModel.get('S836MDS002')[2],'side');
    assert.equal(byModel.get('RD20WNR')[2],'dryer');
    assert.equal(byModel.get(sample)[2],'drum');assert.ok(!byModel.has('KAX-G52-20W'));
    for(const m of ['FC4SC','FX4KCQ','FX4VCQ','FC4TC','FX4KC','FX4VC','FX4WC','FX4GC','FX4EC']){
      assert.ok(!byModel.has(m));
      const result=await (await page.request.get(url('/api/catalog',{category:'세탁기',q:m}))).json();
      assert.ok(!result.rows.some(r=>r.model===m));
    }
    assert.equal((await page.request.get(url('/api/catalog/photo',{category:'세탁기',model:'FC4SC'}))).status(),404);
    // Cover every distinct body recipe without generating an asset for every SKU.
    assert.ok(await page.evaluate(data=>{
      const slug={'냉장고':'fridge','세탁기':'washer','건조기':'dryer'},seen=new Set();
      for(const [family,m] of data){
        if(!slug[family])continue;
        const k='catalog:'+slug[family]+':'+encodeURIComponent(m),item=ProductCatalog.restore(DotScene.products,k);
        if(!item){if(DOT_ASSETS.items.some(p=>p.modelCode===m))continue;throw Error(m)}
        if(!item.body)throw Error('missing body '+m);
        if(seen.has(item.spriteKey))continue;seen.add(item.spriteKey);
        const a=[0,2].map(turn=>DotScene.place('C','pink',{k,x:12,y:5,e:0,f:0,turn}).s);
        if(a[0].im===a[1].im||!a.every(s=>s.pixels.some((v,i)=>i%4===3&&v)))throw Error('missing pose '+m);
      }return seen.size>100;
    },all));
    const initial=await page.evaluate(()=>JSON.parse(localStorage.dotroom).layouts.C);
    assert.ok(initial.some(o=>o.exhibit&&o.k==='catalog:dryer:RD20WNR'));
    await tap('libraryButton');assert.equal(await page.locator('[data-product=washer_fc4sc]').count(),0);
    await tap('openCatalog');await page.locator('#catalogFamilies button').filter({hasText:'FG19WNR'}).tap();
    await page.locator('#catalogSearch').fill(sample);
    const row=page.locator('#catalogRows article').filter({has:page.getByRole('button',{name:sample+' 수집',exact:true})});
    await row.locator('summary').tap();await row.locator('img').first().waitFor();
    await row.locator('button').tap();await tap('placeCollected');await tap('flip');await tap('editMode');
    await page.reload();await ready();
    const stored=await page.evaluate(()=>JSON.parse(localStorage.dotroom).layouts.C);
    const placed=stored.filter(o=>!initial.some(prev=>prev.id===o.id));
    assert.equal(placed.length,1);assert.equal(placed[0].k,'catalog:washer:'+sample);assert.equal(placed[0].turn,1);
    // Older standalone keys are readable but cannot be used or obscure their neighbours.
    await page.evaluate(()=>{
      const l=JSON.parse(localStorage.dotroom);l.layouts.C.push({id:965,k:'catalog:washer:FX4KCQ',x:10,y:5,f:0,e:0});
      localStorage.dotroom=JSON.stringify(l);
    });await page.reload();await ready();await tap('editMode');
    assert.equal(await page.locator('[data-key="catalog:washer:FX4KCQ"]').count(),0);
    assert.ok(await page.evaluate(async()=>{
      const api=await import('/state.js'),l=JSON.parse(localStorage.dotroom);
      const rejected=['washer_fc4sc','catalog:washer:FX4KCQ'].every(k=>{try{api.collect(k,'catalog');return false}catch{return true}});
      return rejected&&!DotScene.sorted('C',l.layouts.C).some(o=>o.id===965);
    }));assert.deepEqual(errors,[]);
    console.log('PASS',width,height,'1691 model records, body recipes, single-unit placement, mini exclusions and legacy keys');
  }finally{await page.context().close()}
}
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
  for(const size of [[320,568],[390,844]])await check(browser,...size);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
