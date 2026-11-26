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
    assert.deepEqual(result.counts,{TV:769,'무선청소기':116});assert.equal(result.shapes.length,11);
    const bundles=await(await page.request.get(base+'/api/catalog/bundles')).json();
    assert.deepEqual(bundles,[]);
    await tap('libraryButton');await tap('openCatalog');
    await page.locator('#catalogFamilies button').filter({hasText:'55LX1QKNA'}).tap();
    await page.locator('#catalogSearch').fill(sale);
    await page.getByText('검색 결과가 없어요.',{exact:true}).waitFor();
    await page.locator('#catalogSearch').fill('OLED55B5NNA');
    await page.getByRole('button',{name:'OLED55B5NNA 수집',exact:true}).tap();await tap('placeCollected');
    const placed=(await layout()).find(o=>!initial.some(i=>i.id===o.id));
    assert.equal(placed.k,'catalog:tv:OLED55B5NNA');assert.equal(placed.bundleId,undefined);
    await page.reload();await ready();assert.deepEqual((await layout()).find(o=>o.id===placed.id),placed);
    assert.deepEqual(errors,[]);console.log('PASS',width,height,'TV/stick recipes, Dream C, retired sale search and standalone persistence');
  }finally{await page.context().close()}
}
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
  for(const size of [[320,568],[390,844]])await verify(browser,...size);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
