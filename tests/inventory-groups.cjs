const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const withServer=require('./member-server.cjs');

withServer(async base=>{
  const browser=await chromium.launch({channel:'chrome'});
  try{
    for(const [width,height] of [[320,568],[390,844]]){
      const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true});
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base+'/editor?space=dream');
      await page.locator('#routineBagButton').waitFor();
      // Give the isolated guest one of each family and enough refrigerators to scroll.
      const expected=await page.evaluate(async()=>{
        const families=new Map();
        for(const [family,code] of await (await fetch('/api/catalog/models')).json()){
          const key=ProductCatalog.matchModel(family,code);
          if(!key)continue;
          if(!families.has(family))families.set(family,[]);
          const group=families.get(family);
          if(group.length<(family==='냉장고'?18:family==='조명 스위치'?2:1))group.push(key);
        }
        localStorage.setItem('lg-miniroom.state',JSON.stringify({schemaVersion:1,revision:1,
          collection:[...families.values()].flat(),dreamLayout:{},myFixtureId:null,myLayout:{},savedRoutines:[]}));
        return [...families.keys()].sort();
      });
      await page.reload();
      const bag=page.locator('#routineBag'),items=bag.locator('#bagItems');
      const family=name=>items.locator('[data-family="'+name+'"]');
      const tab=name=>bag.locator('[data-bag="'+name+'"]').tap();
      const snapshot=()=>page.evaluate(()=>[localStorage.dotroom,localStorage.getItem('lg-miniroom.state')]);
      await page.locator('#routineBagButton').tap();const before=await snapshot();
      await tab('appliance');
      assert.deepEqual(await items.locator('[data-family]').evaluateAll(bs=>bs.map(b=>b.dataset.family).sort()),expected);
      await family('조명 스위치').scrollIntoViewIfNeeded();
      const parentScroll=await items.evaluate(e=>e.scrollTop);
      await family('조명 스위치').tap();
      assert.match(await items.innerText(),/조명 스위치 2구/);assert.match(await items.innerText(),/조명 스위치 3구/);
      await bag.locator('#bagGroupBack').tap();
      assert.equal(await items.evaluate(e=>e.scrollTop),parentScroll);
      await family('냉장고').tap();
      const scroll=await items.evaluate(e=>{e.scrollTop=200;return e.scrollTop});
      assert.ok(scroll>0);
      assert.deepEqual(await bag.locator('#bagFilters button:visible').allTextContents(),['루틴','가전']);
      await tab('routine');
      await tab('appliance');assert.equal(await bag.locator('#bagGroupTitle').innerText(),'냉장고');
      assert.equal(await items.evaluate(e=>e.scrollTop),scroll);
      await page.evaluate(()=>window.dispatchEvent(new StorageEvent('storage',{key:'lg-miniroom.discovered.movie-night'})));
      assert.equal(await bag.locator('#bagGroupTitle').innerText(),'냉장고');
      assert.equal(await items.evaluate(e=>e.scrollTop),scroll);
      await page.keyboard.press('Escape');assert.ok(await family('냉장고').isVisible());
      assert.deepEqual(await snapshot(),before);assert.deepEqual(errors,[]);
      await page.context().close();
      console.log('PASS',width,height,'available families, two switch models, hidden furniture tab, navigation and scroll restoration, browse without saving');
    }
  }finally{await browser.close()}
}).catch(e=>{console.error(e);process.exitCode=1});
