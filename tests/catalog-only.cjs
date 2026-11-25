const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:4174';
const tv='catalog:tv:55LX1QKNA',retired=['tvset','floor_lamp','demo-tv-01','styler','catalog:tv:NO_SUCH_MODEL'];
async function run(browser,width,height){
  const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const ready=()=>page.waitForFunction(()=>document.querySelectorAll('#rooms button').length===3);
  const visit=async space=>{await page.goto(base+'/editor?space='+space);await ready()};
  const tap=id=>page.locator('#'+id).tap();
  try{
    await visit('dream&room=C');
    const layout=await page.evaluate(()=>JSON.parse(localStorage.dotroom));
    assert.equal(layout.layouts.C.length,10);
    assert.ok(await page.evaluate(()=>JSON.parse(localStorage.dotroom).layouts.C.every(o=>ProductCatalog.hasModel(o.k))));
    await tap('libraryButton');
    assert.ok(await page.locator('#libraryItems [data-product]').evaluateAll(nodes=>nodes.length===9&&nodes.every(n=>ProductCatalog.hasModel(n.dataset.product))));
    await page.locator('[data-product="'+tv+'"] button').tap();await tap('placeCollected');
    await page.evaluate(({tv,retired})=>{
      const s=JSON.parse(localStorage['lg-miniroom.state']);
      s.collection.push(...retired);s.collectionSources.styler='catalog';s.photoSelections={styler:{},[tv]:{source:'test'}};
      localStorage['lg-miniroom.state']=JSON.stringify(s);
      const l=JSON.parse(localStorage.dotroom);
      l.layouts.C.push({id:450,k:'styler',f:0,e:0,x:4,y:2},{id:451,k:'catalog:tv:NO_SUCH_MODEL',f:0,e:0,x:8,y:2});
      localStorage.dotroom=JSON.stringify(l);
    },{tv,retired});
    await page.reload();await ready();
    assert.ok(await page.evaluate(async tv=>{
      const api=await import('/state.js'),s=api.state,objects=JSON.parse(localStorage.dotroom).layouts.C;
      return s.collection.length===1&&s.collection[0]===tv&&!s.collectionSources.styler&&!s.photoSelections.styler&&s.photoSelections[tv]
        &&objects.every(o=>ProductCatalog.hasModel(o.k))&&objects.some(o=>o.k===tv)
        &&!api.isCollectibleProduct('catalog:tv:NO_SUCH_MODEL');
    },tv));
    await visit('my');await page.getByRole('button',{name:'체험용 기기 사용',exact:true}).tap();
    await tap('libraryButton');
    assert.ok(await page.locator('#libraryItems [data-product]').evaluateAll(nodes=>nodes.length>1&&nodes.every(n=>ProductCatalog.hasModel(n.dataset.product))));
    await page.evaluate(()=>{
      const l=JSON.parse(localStorage['lg-miniroom.dot.my']);l.layouts.B.find(o=>o.deviceId==='my-tv-1').k='tvset';
      localStorage['lg-miniroom.dot.my']=JSON.stringify(l);
    });
    await page.reload();await ready();
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage['lg-miniroom.dot.my']).layouts.B.find(o=>o.deviceId==='my-tv-1').k),tv);
    await page.route('**/api/my-appliances',r=>r.fulfill({json:{mode:'thinq',devices:[
      {id:'exact',category:'TV',modelCode:'55LX1QKNA',name:'우리집 TV'},
      {id:'unknown',category:'TV',modelCode:'no-such-model',name:'확인 전 TV'},
      {id:'wrong-category',category:'냉장고',modelCode:'55LX1QKNA',name:'불일치'}]}}));
    await visit('my');await tap('libraryButton');
    assert.deepEqual(await page.locator('#libraryItems [data-product]').evaluateAll(nodes=>nodes.map(n=>n.dataset.product)),[tv]);
    const before=await page.evaluate(()=>localStorage.dotroom);
    await page.route('**/api/catalog/models',r=>r.fulfill({status:503,body:'offline'}));
    await page.goto(base+'/editor?space=dream');await page.getByText(/제품 DB를 열 수 없어요/).waitFor();
    assert.equal(await page.evaluate(()=>localStorage.dotroom),before);assert.deepEqual(errors,[]);
    console.log('PASS',width,height,'DB-only display, collection, migration, demo inventory, exact ThinQ fixture and offline storage safety');
  }finally{await page.context().close()}
}
(async()=>{const b=await chromium.launch({channel:'chrome'});try{
  for(const size of [[320,568],[390,844]])await run(b,...size);
}finally{await b.close()}})().catch(error=>{console.error(error);process.exitCode=1});
