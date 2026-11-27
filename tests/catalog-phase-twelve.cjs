const {registeredModels}=require('./support/catalog.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { chromium } = require('playwright');

const base = process.argv[2] || 'http://127.0.0.1:4174';
(async () => {
  const db = new DatabaseSync(process.env.MINIROOM_CATALOG_DB || path.join(__dirname,'../data/lg_appliances.db'),{readOnly:true});
  const rows = db.prepare(`SELECT p.category,p.model_name model,p.product_id id,i.sha256 photo FROM products p
    JOIN images i USING(image_id) WHERE p.product_id IN (SELECT min(product_id) FROM products GROUP BY category,model_name)
    ORDER BY category,model`).all();
  db.close();
  const allowed=new Set(registeredModels({collectibleOnly:true}).map(pair=>JSON.stringify(pair)));
  for(const row of rows)row.collectible=allowed.has(JSON.stringify([row.category,row.model]));
  const browser = await chromium.launch({channel:'chrome'});
  try {
    const page = await browser.newPage();
    await page.goto(base+'/editor?space=dream&room=C'); await page.waitForSelector('#rooms button');
    for(const category of new Set(rows.map(r=>r.category))){
      const expected=rows.filter(r=>r.category===category&&r.collectible),listed=[];
      for(let offset=0;offset<expected.length;offset+=16){
        const res=await page.request.get(base+'/api/catalog',{params:{category,offset}});
        const data=await res.json();
        assert.equal(data.total,expected.length);
        listed.push(...data.rows.map(row=>[row.id,row.model]));
      }
      assert.deepEqual(listed,expected.map(r=>[r.id,r.model]));
    }
    const results=await page.evaluate(async rows=>{
      const digests=new WeakMap(),decoded=new Set(),normalizedTVs=new Map();
      const hex=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
      async function pixels(canvas){
        if(!digests.has(canvas)){
          const {width:w,height:h}=canvas,bytes=canvas.getContext('2d').getImageData(0,0,w,h).data;
          if(!bytes.some((n,i)=>i%4===3&&n>0))throw Error('빈 도트');
          digests.set(canvas,w+'x'+h+':'+await hex(bytes));
        }
        return digests.get(canvas);
      }
      const result=[],draft={collection:[]};
      const {addToCollection}=await import('/state.js');
      // Bound concurrent photo decoding and release each bitmap after inspection.
      for(let start=0;start<rows.length;start+=4){
        result.push(...await Promise.all(rows.slice(start,start+4).map(async ({category,model,id,photo,collectible})=>{
          const key=ProductCatalog.matchModel(category,model),item=ProductCatalog.restore(DotScene.products,key);
          if(!ProductCatalog.hasModel(key)||item.modelCode!==model)throw Error('제품 키 '+model);
          if(collectible)addToCollection(draft,key,'catalog');
          else{
            if(!ProductCatalog.heldSale(key))throw Error('수집 보류 표시 누락 '+model);
            let rejected=false;
            try{addToCollection(draft,key,'catalog')}catch(error){rejected=error.message.includes('수집할 수 없어요')}
            if(!rejected||draft.collection.includes(key))throw Error('수집 보류 제품 처리 오류 '+model);
          }
          const card=await (await fetch('/api/catalog/product?id='+id)).json();
          if(card.model!==model||card.category!==category)throw Error('제품 카드 '+model);
          const response=await fetch(item.photoUrl);
          if(!response.ok)throw Error('사진 응답 '+model);
          const blob=await response.blob();
          if(await hex(await blob.arrayBuffer())!==photo)throw Error('대표 사진 '+model);
          if(!decoded.has(photo)){
            const bitmap=await createImageBitmap(blob);bitmap.close();decoded.add(photo);
          }
          const views=[];
          for(const turn of [0,1,2,3]){
            const s=DotScene.place('C','pink',{id:1,k:key,x:16,y:20,e:0,turn,f:turn%2}).s;
            views.push(await pixels(turn%2?s.flipped:s.im));
          }
          let normal;
          if(category==='TV'){
            if(!normalizedTVs.has(item.spriteKey)){
              const fixed={...item,displayWidth:14};
              normalizedTVs.set(item.spriteKey,await Promise.all([false,true].map(back=>pixels(CatalogArt.renderBody(fixed,back).canvas))));
            }
            normal=normalizedTVs.get(item.spriteKey).join('/');
          }
          return {category,model,photo,pair:views[0]+'/'+views[2],normal,width:item.displayWidth};
        })));
      }
      if(new Set(draft.collection).size!==rows.filter(r=>r.collectible).length)throw Error('수집 키 중복 또는 누락');
      return result;
    },rows);
    const groups=(items,field)=>Map.groupBy(items,r=>r[field]);
    const splits=[];
    let sizeOnly=0;
    for(const [category,list] of groups(results,'category')){
      const photos=groups(list,'photo'),pairs=groups(list,'pair');
      for(const group of photos.values()){
        if(groups(group,'pair').size===1)continue;
        if(category==='TV'&&groups(group,'normal').size===1&&groups(group,'width').size>1&&
            [...groups(group,'width').values()].every(sameSize=>groups(sameSize,'pair').size===1))sizeOnly++;
        else splits.push([category,group.map(r=>r.model)]);
      }
      console.log(category,list.length,'models,',photos.size,'photos,',pairs.size,'pixel pairs,',
        [...pairs.values()].filter(g=>groups(g,'photo').size>1).length,'pairs shared by different photos');
    }
    console.log('Same-photo groups differing only by TV size:',sizeOnly);
    console.log('Unexplained same-photo differences:',JSON.stringify(splits));
    assert.equal(splits.length,0,'대표 사진이 같지만 도트가 다른 모델이 있습니다.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
