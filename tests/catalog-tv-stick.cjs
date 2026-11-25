const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:4174';
const sale='OLED55B5NNA + 27LX6TPGA';
async function verify(browser,width,height){
  const page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  page.setDefaultTimeout(8000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const tap=id=>page.locator('#'+id).tap();
  const ready=()=>page.waitForFunction(()=>document.querySelectorAll('[data-room]').length===3);
  const layout=()=>page.evaluate(()=>JSON.parse(localStorage.dotroom).layouts.C);
  try{
    await page.goto(base+'/editor?space=dream&room=C');await ready();
    const initial=await layout();
    for(const key of ['catalog:tv:27LX6TPGA','catalog:stick:A727TA'])assert.ok(initial.some(o=>o.exhibit&&o.k===key));
    const result=await page.evaluate(async()=>{
      const rows=await (await fetch('/api/catalog/bodies')).json(),counts={},recipes=new Set(),shapes=new Set();
      for(const [family,model] of rows){
        if(!['TV','무선청소기'].includes(family))continue;
        counts[family]=(counts[family]||0)+1;
        const k='catalog:'+(family==='TV'?'tv':'stick')+':'+encodeURIComponent(model);
        const item=ProductCatalog.restore(DotScene.products,k);shapes.add(item.body.shape);
        if(recipes.has(item.spriteKey))continue;
        recipes.add(item.spriteKey);
        const pose={k,f:0,turn:0,x:5,y:4,e:0};
        const front=DotScene.place('C','pink',pose).s,back=DotScene.place('C','pink',{...pose,turn:2}).s;
        if(front.im.toDataURL()===back.im.toDataURL())throw Error('identical views '+model);
        if(family==='TV'){
          const [x,y,w,h]=front.screen;
          for(const dx of [0,w-1])for(const dy of [0,h-1]){
            if(!front.pixels[4*(Math.floor(y+dx/2+dy)*front.w+x+dx)+3])throw Error('film outside screen '+model);
          }
        }
      }
      return {counts,shapes:[...shapes]};
    });
    assert.deepEqual(result.counts,{TV:818,'무선청소기':137});assert.equal(result.shapes.length,11);
    const bundles=await(await page.request.get(base+'/api/catalog/bundles')).json();
    assert.ok(bundles.find(s=>s.model==='A727TA + MO972WA').parts.some(([c,m])=>c==='로봇청소기'&&m==='MO972WA'));
    assert.ok(bundles.every(s=>s.parts.every(([c,m])=>c!=='미니워시'&&!m.startsWith('T-ST'))));
    await tap('libraryButton');await tap('openCatalog');
    await page.locator('#catalogFamilies button').filter({hasText:'55LX1QKNA'}).tap();
    await page.locator('#catalogSearch').fill(sale);
    await page.getByRole('button',{name:sale+' 수집',exact:true}).tap();await tap('placeCollected');
    const parts=page.locator('#bundleParts button');
    assert.equal(await parts.count(),2);
    await parts.filter({hasText:'27LX6TPGA'}).tap();
    const first=(await layout()).find(o=>o.bundleId===211);
    assert.equal(first.k,'catalog:tv:27LX6TPGA');
    await page.reload();await ready();
    assert.deepEqual((await layout()).find(o=>o.id===first.id),first);
    await tap('editMode');
    const bundleKey='catalog:tv:'+encodeURIComponent(sale);
    const card=page.locator('[data-key="'+bundleKey+'"]');
    await card.tap();await page.getByRole('button',{name:'구성 선택 닫기'}).tap();
    assert.equal((await layout()).length,initial.length+1);
    await card.tap();await parts.filter({hasText:'OLED55B5NNA'}).tap();
    const matching=(await layout()).filter(o=>o.bundleId===211);
    assert.deepEqual(matching.map(o=>o.k),['catalog:tv:27LX6TPGA','catalog:tv:OLED55B5NNA']);
    assert.ok(await page.evaluate(async bundleKey=>{
      const model=await import('/state.js');
      return model.collected(bundleKey)&&!model.collected('catalog:tv:27LX6TPGA')&&!model.collected('catalog:tv:OLED55B5NNA');
    },bundleKey));
    await page.goto(base+'/editor?space=my');await ready();await tap('editMode');
    assert.equal(await page.locator('[data-key="'+bundleKey+'"],[data-key="catalog:tv:27LX6TPGA"]').count(),0);
    assert.deepEqual(errors,[]);console.log('PASS',width,height,'TV/stick recipes, Dream C, bundle selection, cancellation, persistence and My Room isolation');
  }finally{await page.context().close()}
}
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
  for(const size of [[320,568],[390,844]])await verify(browser,...size);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
