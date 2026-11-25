const assert = require('node:assert/strict');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { chromium } = require('playwright');

const base = process.argv[2] || 'http://127.0.0.1:4174';
const families = ['TV','냉장고','세탁기','건조기','공기청정기','가습기','제습기','로봇청소기','무선청소기'];
const ready = page => page.waitForFunction(() => document.querySelectorAll('#rooms [data-room]').length === 3);

async function auditDatabase(browser) {
  const db = new DatabaseSync(process.env.MINIROOM_CATALOG_DB || path.join(__dirname,'../data/lg_appliances.db'), {readOnly:true});
  let models;
  try {
    models = db.prepare('SELECT DISTINCT category,model_name FROM products ORDER BY category,model_name').all()
      .map(row => [row.category,row.model_name]);
  } finally { db.close(); }
  const page = await browser.newPage();
  try {
    await page.goto(base+'/editor?space=dream&room=C');
    await ready(page);
    const index = await (await page.request.get(base+'/api/catalog/models')).json();
    assert.deepEqual(index,models);
    const result = await page.evaluate(async rows => {
      const families = new Map(), images = new WeakMap(), allPairs = new Set();
      async function hash(canvas) {
        if (images.has(canvas)) return images.get(canvas);
        const {width,height} = canvas;
        const pixels = canvas.getContext('2d').getImageData(0,0,width,height).data;
        if (!pixels.some((v,i)=>i%4===3 && v>10)) throw Error('빈 스프라이트');
        const digest = new Uint8Array(await crypto.subtle.digest('SHA-256',pixels));
        const key = width+'x'+height+':'+Array.from(digest,v=>v.toString(16).padStart(2,'0')).join('');
        images.set(canvas,key);
        return key;
      }
      const failures = [];
      for (const [category,model] of rows) {
        if (!families.has(category)) families.set(category,{total:0,rendered:0,common:0,pairs:new Map(),sameRear:0});
        const family = families.get(category);
        family.total++;
        try {
          const k = ProductCatalog.matchModel(category,model);
          const item = ProductCatalog.restore(DotScene.products,k);
          if (!ProductCatalog.hasModel(k) || item?.modelCode!==model) throw Error('모델 키 불일치');
          const views = [];
          for (const turn of [0,1,2,3]) {
            const {s} = DotScene.place('C','pink',{k,x:25,y:20,e:0,turn,f:turn%2});
            views.push(await hash(turn%2?s.flipped:s.im));
          }
          const pair = views[0]+'|'+views[2];
          family.pairs.set(pair,(family.pairs.get(pair)||0)+1);
          family.rendered++;
          if (views[0]===views[2]) family.sameRear++;
          if (!item.body && !item.washerStyle && !item.appearance) family.common++;
          allPairs.add(pair);
        } catch (error) { failures.push({category,model,error:error.message}); }
      }
      return {families:Object.fromEntries([...families].map(([c,{pairs,...rest}])=>[
        c,{...rest,appearances:pairs.size,uniqueModels:[...pairs.values()].filter(n=>n===1).length}
      ])),distinct:allPairs.size,failures};
    },models);
    console.table(result.families);
    console.log('Distinct pixel pairs across all families:',result.distinct);
    assert.deepEqual(result.failures,[]);
    assert.deepEqual(Object.keys(result.families).sort(),[...families].sort());
  } finally { await page.close(); }
}

// Pick a visible interior pixel through the same camera and depth ordering as the editor.
async function tapPlacement(page,id) {
  const point = await page.evaluate(id => {
    const state = JSON.parse(localStorage.dotroom), objects = state.layouts.C;
    const item = objects.find(o=>o.id===id), order = DotScene.sorted('C',objects);
    const {x,y,s} = DotScene.place('C',state.theme,item);
    const c=document.querySelector('#scene'), bounds=c.getBoundingClientRect();
    let best=null, score=Infinity;
    for(let dy=1;dy<s.h-1;dy+=2) for(let dx=1;dx<s.w-1;dx+=2) {
      const dist=(dx-s.w/2)**2+(dy-s.h/2)**2;
      if(dist>=score)continue;
      if(![[0,0],[-1,-1],[1,1]].every(([a,b])=>DotScene.hits('C',state.theme,order,x+dx+a,y+dy+b)[0]?.id===id))continue;
      const px=bounds.left+(x+dx+.5)*bounds.width/c.width,py=bounds.top+(y+dy+.5)*bounds.height/c.height;
      if(!document.querySelector('#view').contains(document.elementFromPoint(px,py)))continue;
      score=dist;best=[px,py];
    }
    return best;
  },id);
  assert.ok(point,'배치한 제품이 화면에서 선택 가능해야 함: '+id);
  await page.touchscreen.tap(...point);
}

async function exerciseRoom(browser,width,height) {
  const page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  page.setDefaultTimeout(8000);
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const tap=id=>page.locator('#'+id).tap();
  const layout=()=>page.evaluate(()=>JSON.parse(localStorage.dotroom).layouts.C);
  try {
    await page.goto(base+'/editor?space=dream&room=C');await ready(page);
    const initial=await layout();
    for (const family of families) {
      await tap('libraryButton');
      const chosen=await page.locator('#libraryItems [data-product]').evaluateAll((nodes,family)=>{
        const n=nodes.find(node=>{
          const item=DotScene.products[node.dataset.product];
          return ProductCatalog.matchModel(family,item.modelCode)===item.k;
        });
        const k=n.dataset.product;return {k,model:DotScene.products[k].modelCode};
      },family);
      await page.locator('[data-product="'+chosen.k+'"] button').tap();
      await tap('placeCollected');
      const current=await layout();
      const item=current.find(o=>initial.every(old=>old.id!==o.id));
      assert.equal(current.length,initial.length+1);
      assert.equal(item.k,chosen.k);
      for(const expected of [1,2,3,0,1]){
        await tap('flip');
        assert.equal((await layout()).find(o=>o.id===item.id).turn,expected,family+' 회전');
      }
      const edited=await layout();
      await tap('editMode');
      await page.reload();await ready(page);
      assert.deepEqual(await layout(),edited);
      await tapPlacement(page,item.id);
      await page.waitForFunction(model=>document.querySelector('#lifeTitle').textContent===model &&
        document.querySelector('#productPhoto').naturalWidth>0,chosen.model);
      await page.locator('#lifeActions').getByRole('button',{name:'닫기',exact:true}).tap();
      await tap('editMode');await tapPlacement(page,item.id);await tap('remove');
      assert.deepEqual(await layout(),initial);
      await tap('editMode');
      console.log('PASS',width+'x'+height,family,chosen.model,'배치·네 방향 회전·새로고침·터치 선택·회수');
    }
    assert.deepEqual(errors,[]);
  }finally{await page.context().close();}
}

module.exports={tapPlacement};
if(require.main===module)(async()=>{
  const browser=await chromium.launch({channel:'chrome'});
  try{
    await auditDatabase(browser);
    for(const size of [[320,568],[390,844]])await exerciseRoom(browser,...size);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
