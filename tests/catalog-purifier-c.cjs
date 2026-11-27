const {expectedTitle}=require('./catalog-room-title.cjs');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:4173';
const models=['AS206NGHA','FS064PSJA','AS063PWGCR','AS356LSAA'];
const oldUnit={id:808,k:'catalog:purifier:AS356LSAA',x:15,y:10,f:1,turn:3,e:1};
const legacyKey='lg-miniroom.dot.dream.retro-c';

async function verifyRetroCatalog(page){
  // Fingerprint the 29 supplied PNGs in filename-key order, independent of the Downloads folder.
  const masters=await page.evaluate(()=>Object.entries(DOT_ASSETS.sprites.appl)
    .filter(([key,s])=>!key.startsWith('db_')&&s.retroAA).map(([key,s])=>[key,s.src]).sort());
  const hash=createHash('sha256');
  for(const [key,src] of masters)hash.update(key+'\0').update(Buffer.from(src,'base64'));
  assert.equal(masters.length,29);
  assert.equal(hash.digest('hex'),'bb62ab682d988bdb5f8e6383ccade6d744d83c4cb8551f5fbfdb3bd772bb5bc6');

  const groups=['V0003','V0948-02','V0956','V1287'];
  for(const [i,model] of models.entries()){
    const q=new URLSearchParams({category:'공기청정기',q:model});
    const search=await page.request.get(base+'/api/catalog?'+q);
    assert.equal(search.status(),200);
    const row=(await search.json()).rows.find(row=>row.model===model);
    assert.ok(row,model);
    const details=await page.request.get(base+'/api/catalog/product?id='+row.id);
    const product=await details.json();
    assert.equal(product.appearanceGroup,groups[i]);assert.equal(product.photoStatus,'확인');
    assert.ok(product.components.some(c=>c.model===model));
    const byId=await page.request.get(base+'/api/catalog/photo?id='+row.id);
    const byModel=await page.request.get(base+'/api/catalog/photo?'+new URLSearchParams({category:'공기청정기',model}));
    assert.equal(byId.status(),200);assert.equal(byModel.status(),200);
    assert.deepEqual(await byId.body(),await byModel.body());
  }

  const signatures=await page.evaluate(async models=>{
    const signatures=[];
    for(const model of models){
      const k='catalog:purifier:'+model,item=ProductCatalog.restore(DotScene.products,k);
      for(const turn of [0,2]){
        const raw=DOT_ASSETS.sprites.appl[item.spriteKey+(turn===2?'_rear':'')];
        if(!raw.retroAA)throw Error('Unfinished master '+k);
        const {s}=DotScene.place('C','pink',{k,x:0,y:0,e:0,f:0,turn});
        const im=new Image();im.src='data:image/png;base64,'+raw.src;await im.decode();
        const c=document.createElement('canvas');c.width=im.width;c.height=im.height;
        const ctx=c.getContext('2d');ctx.drawImage(im,0,0);
        const data=ctx.getImageData(0,0,c.width,c.height).data;
        if(data.length!==s.pixels.length||!data.every((v,i)=>v===s.pixels[i]))throw Error('Changed native pixels '+k);
        const [x,y]=s.outlet;if(!data[(y*c.width+x)*4+3])throw Error('Outlet outside appliance '+k);
        signatures.push(raw.src);
      }
    }
    return new Set(signatures).size;
  },models);
  assert.equal(signatures,8,'four independently drawn fronts and backs');
}

async function verify(browser,width,height){
  const p=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  const errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(7000);
  const tap=id=>p.locator('#'+id).tap();
  const saved=()=>p.evaluate(()=>JSON.parse(localStorage.dotroom));
  const ready=()=>p.waitForFunction(()=>document.querySelectorAll('[data-room]').length===3);
  async function target(model){
    const point=await p.evaluate(model=>{
      const a=JSON.parse(localStorage.dotroom).layouts.C,order=DotScene.sorted('C',a);
      const o=a.find(o=>o.k==='catalog:purifier:'+model&&o.artVersion);
      const {s,x,y}=DotScene.place('C','pink',o),c=document.querySelector('#scene'),r=c.getBoundingClientRect();
      for(const fy of [.5,.65,.35,.8])for(const fx of [.5,.6,.4,.7]){
        const xx=x+s.w*fx,yy=y+s.h*fy;
        if(DotScene.hits('C','pink',order,xx,yy)[0]?.id===o.id)return [r.left+xx*r.width/c.width,r.top+yy*r.height/c.height];
      }
    },model);
    assert.ok(point,'visible '+model);await p.touchscreen.tap(...point);
  }
  try{
    await p.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{
      const paint=DotScene.paint;
      DotScene.paint=function(...args){window.roomFrame=args[5];return paint(...args)};
    }));
    await p.goto(base+'/editor?space=dream');await ready();
    if(width===320)await verifyRetroCatalog(p);
    await p.evaluate(({oldUnit,legacyKey})=>{
      const layout=JSON.parse(localStorage.dotroom);
      layout.layouts.B.push(oldUnit);
      layout.layouts.C=[{id:809,k:'sofa',x:44,y:32,f:1,e:0,turn:1}];
      delete layout.cDisplayVersion;
      localStorage.dotroom=JSON.stringify(layout);
      const prior={...layout,room:'C',layouts:{...layout.layouts,C:[
        {id:5,k:'fridge_pb',x:62,y:3,f:1,turn:3,e:2,exhibit:true},
        {id:6,k:'puri_m',x:10,y:40,f:0,e:0,exhibit:true}
      ]}};
      localStorage.setItem(legacyKey,JSON.stringify(prior));
      localStorage['lg-miniroom.state']=JSON.stringify({schemaVersion:1,revision:2,collection:[oldUnit.k],dreamLayout:{},myFixtureId:null,myLayout:{},savedRoutines:[]});
    },{oldUnit,legacyKey});
    await p.goto(base+'/editor?space=dream&display=retro');await ready();
    const migrated=await saved();
    assert.equal(migrated.room,'C');assert.equal(migrated.cDisplayVersion,4);
    assert.equal(await p.evaluate(k=>localStorage.getItem(k),legacyKey),null);
    assert.deepEqual(migrated.layouts.B.find(o=>o.id===oldUnit.id),oldUnit);
    assert.ok(await p.evaluate(o=>{
      const s=DotScene.place('B','pink',o).s,current=DotScene.place('B','pink',{...o,artVersion:1}).s;
      return DotScene.dims(o).w===8&&s===current;
    },oldUnit));
    assert.ok(!migrated.layouts.C.some(o=>o.k==='fridge_pb'));
    assert.equal(migrated.layouts.C.filter(o=>o.k.startsWith('catalog:purifier:')&&o.artVersion===1).length,4);
    assert.ok(!migrated.layouts.C.some(o=>o.k==='puri_m'));
    const art=await p.evaluate(()=>{
      const a=JSON.parse(localStorage.dotroom).layouts.C.filter(o=>o.k.startsWith('catalog:purifier:')&&o.artVersion);
      return a.map(o=>DotScene.place('C','pink',o).s.im.toDataURL());
    });
    assert.equal(new Set(art).size,4);
    for(const model of models){
      await target(model);
      await p.waitForFunction(n=>document.querySelector('#lifeTitle').textContent===n&&document.querySelector('#lifeDetail').textContent==='',await expectedTitle(p,'공기청정기',model));
      await p.waitForFunction(()=>roomFrame?.reaction?.kind==='purifier');
      await p.locator('#lifeActions').getByRole('button',{name:'닫기'}).tap();
      await tap('editMode');await target(model);
      for(const turn of [1,2,3,0,1]){
        await tap('flip');const c=(await saved()).layouts.C;
        assert.equal(c.find(o=>o.k==='catalog:purifier:'+model&&o.artVersion).turn,turn);
      }
      await tap('editMode');
    }
    const edited=await saved();await p.reload();await ready();assert.deepEqual((await saved()).layouts,edited.layouts);
    for(const o of edited.layouts.C.filter(o=>o.k.startsWith('catalog:purifier:')&&o.artVersion))assert.equal(o.turn,1);

    await tap('libraryButton');await tap('openCatalog');
    await p.locator('#catalogFamilies button').filter({hasText:'55LX1QKNA'}).tap();
    await p.locator('#catalogSearch').fill('OLED55B5NNA + 27LX6TPGA');
    await p.getByText('검색 결과가 없어요.',{exact:true}).waitFor();
    assert.equal(await p.locator('#catalogRows article').count(),0);
    for(const model of ['OLED55B5NNA','27LX6TPGA']){
      await p.locator('#catalogSearch').fill(model);
      await p.getByRole('button',{name:model+' 수집',exact:true}).waitFor();
    }
    await tap('catalogBack');await p.locator('#catalogFamilies button').filter({hasText:'AS235DWSA'}).tap();
    await p.locator('#catalogSearch').fill('FS064PSJA');
    const tower=p.locator('#catalogRows article').filter({has:p.getByRole('button',{name:'FS064PSJA 수집',exact:true})});
    await tower.locator('summary').tap();await tower.locator('li').first().waitFor();
    await tower.getByRole('button',{name:'FS064PSJA 수집',exact:true}).tap();
    await tap('placeCollected');await tap('editMode');
    assert.ok((await saved()).layouts.C.some(o=>o.k==='catalog:purifier:FS064PSJA'&&!o.exhibit&&o.artVersion===1));
    await p.locator('[data-room=B]').tap();await p.reload();await ready();assert.equal((await saved()).room,'B');
    // A furnished personal C is upgraded in place, without replacing its furniture.
    const personal={id:551,k:'bed',x:35,y:30,turn:2,f:0,e:1};
    await p.locator('[data-room=C]').tap();
    await p.evaluate(personal=>{
      const layout=JSON.parse(localStorage.dotroom);delete layout.cDisplayVersion;
      layout.layouts.C=[personal];localStorage.dotroom=JSON.stringify(layout);
    },personal);
    await p.reload();await ready();const custom=(await saved()).layouts.C;
    assert.deepEqual(custom.find(o=>o.id===personal.id),personal);
    assert.equal(custom.filter(o=>o.exhibit).length,5);
    assert.deepEqual(errors,[]);
    console.log('PASS',width,height,'same C room, updated art and saved positions, four touch reactions, rotation, photos, retired bundle and individual TVs, collect/place and reload');
  }finally{await p.context().close()}
}
(async()=>{const b=await chromium.launch({channel:'chrome'});try{
  for(const size of [[320,568],[390,844]])await verify(b,...size);
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
