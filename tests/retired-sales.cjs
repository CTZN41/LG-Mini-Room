const assert=require('node:assert/strict');
const {registeredModels}=require('./support/catalog.cjs');
const {chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:4174';

(async()=>{
  const browser=await chromium.launch({channel:'chrome'});
  try{
    for(const [width,height] of [[320,568],[390,844]]){
      const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base+'/editor?space=dream&room=C');
      const ready=()=>page.waitForSelector('#rooms button');
      await ready();
      const fixtures=await page.evaluate(async()=>{
        const legacy=await(await fetch('/api/catalog/retired-sales')).json();
        const ids=new Map(legacy.map(r=>[r[2],r[0]]));
        const set='catalog:washer:2EG-M8H-27H',packageKey='catalog:washer:KAX-G52-20W';
        const source=await import('/state.js');
        source.update(s=>{
          s.collection=[set,packageKey];s.collectionSources={[set]:'catalog',[packageKey]:'photo'};
          s.photoSelections={[packageKey]:{provider:'example',decision:'confirmed'}};
        });
        const before=JSON.parse(localStorage.dotroom);
        before.layouts.A=[
          {id:9101,k:'catalog:stick:AX927BHE',bundleId:ids.get('2EG-M8H-27H'),x:16,y:14,e:0,turn:2,f:0},
          {id:9102,k:packageKey,x:36,y:14,e:1,turn:3,f:1},
          {id:9103,k:'sofa',x:12,y:34,e:0,turn:0,f:0,routineIds:['movie-night']}
        ];
        localStorage.dotroom=JSON.stringify(before);
        return before.layouts.A;
      });
      await page.reload();await ready();
      const result=await page.evaluate(async()=>{
        const {state}=await import('/state.js');
        return {objects:JSON.parse(localStorage.dotroom).layouts.A,collection:state.collection,meta:state.photoSelections,revision:state.revision};
      });
      delete fixtures[0].bundleId;fixtures[1].k='catalog:washer:FH25KA';
      assert.deepEqual(result.objects,fixtures);
      assert.ok(result.collection.includes('catalog:washer:W20EGZ'));
      assert.ok(result.collection.includes('catalog:stick:AX927BHE'));
      assert.ok(result.collection.includes('catalog:washer:FH25KA'));
      assert.ok(!result.collection.some(k=>k.includes('2EG-M8H')||k.includes('KAX-G52')));
      assert.equal(result.meta['catalog:washer:FH25KA'].decision,'confirmed');
      await page.reload();await ready();
      assert.equal(await page.evaluate(async()=>(await import('/state.js')).state.revision),result.revision);
      const checks=await page.evaluate(async()=>{
        const all=await(await fetch('/api/catalog/models')).json(),legacy=await(await fetch('/api/catalog/retired-sales')).json();
        const active=new Set(all.map(([c,m])=>c+'|'+m));
        for(const [,c,m,pc,pm] of legacy){
          if(active.has(c+'|'+m)||!active.has(pc+'|'+pm)||ProductCatalog.matchModel(c,m))throw Error('legacy '+m);
        }
        const photos=['F19VDU','F24VDAP','F24KDAP','FX25GSGR','RH18VTAN','AS064PBBAR','RG18WN','RG19WN'];
        for(const code of photos){
          const matches=all.filter(([c,m])=>m===code);
          if(matches.length!==1)throw Error(code);
          const category=matches[0][0];
          if(code.startsWith('RG')&&category!=='건조기')throw Error(category);
          const im=new Image();im.src='/api/catalog/photo?'+new URLSearchParams({category,model:code});await im.decode();
          if(im.naturalWidth<50)throw Error('photo '+code);
        }
        for(const code of ['LZ-H154GB','Z-E0250U2SC','65EP5G','55CT5WN','A948BWE','RD22WSQ','K83IGY','K83WGY'])assertAbsent(code);
        function assertAbsent(code){if(all.some(([,model])=>model===code))throw Error('제외 제품 노출 '+code)}
        return all;
      });
      assert.deepEqual(checks,registeredModels());assert.deepEqual(errors,[]);
      await page.context().close();console.log('PASS',width,height,'migration, idempotence, standalone photos and keys');
    }
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
