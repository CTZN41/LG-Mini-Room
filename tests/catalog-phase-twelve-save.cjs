const {expectedTitle}=require('./catalog-room-title.cjs');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {chromium}=require('playwright');
const {tapPlacement}=require('./catalog-phase-five.cjs');
const base=process.argv[2]||'http://127.0.0.1:4174';
const revision='f18b769';
const old=file=>execFileSync('git',['show',revision+':'+file],{cwd:path.join(__dirname,'..'),maxBuffer:2**21});
const dream=base+'/editor?space=dream&room=C',my=base+'/editor?space=my';
const keys=['dotroom','lg-miniroom.dot.my','lg-miniroom.state'];
const read=p=>p.evaluate(keys=>keys.map(k=>JSON.parse(localStorage.getItem(k))),keys);
const ready=p=>p.waitForSelector('#rooms button');
const files=new Map(['dot-room.html','dot-assets.js','dot-scene.js','dot-editor.js','catalog-art.js','product-catalog.js','state.js','dot-editor.css'].map(file=>[file,old('public/'+file)]));
async function run(browser,width,height,bodies){
  const opts={isMobile:true,hasTouch:true,viewport:{width,height},reducedMotion:'reduce'};
  const prior=await browser.newContext(opts);
  // Generate the save using the previous version's UI, art and body index, against today's test DB.
  await prior.route('**/*',async route=>{
    const pathname=new URL(route.request().url()).pathname;
    if(pathname==='/api/catalog/bodies')return route.fulfill({json:bodies});
    if(pathname==='/api/my-appliances')return route.fulfill({json:{mode:'demo'}});
    const file=pathname==='/editor'?'dot-room.html':pathname.slice(1);
    if(!files.has(file))return route.continue();
    return route.fulfill({body:files.get(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html; charset=utf-8'});
  });
  const oldPage=await prior.newPage();oldPage.setDefaultTimeout(7000);
  await oldPage.goto(dream);await ready(oldPage);
  const tap=id=>oldPage.locator('#'+id).tap();
  const models=['B052S15','B057W'];
  for(const model of models){
    await tap('libraryButton');await tap('openCatalog');
    await oldPage.locator('#catalogFamilies button').filter({hasText:'냉장고'}).tap();
    await oldPage.locator('#catalogSearch').fill(model);
    await oldPage.getByRole('button',{name:model+' 수집',exact:true}).tap();
    await tap('placeCollected');
    if(model===models[0])await tap('flip');
    await tap('up');await tap('editMode');
  }
  await oldPage.goto(my);await ready(oldPage);
  const button=name=>oldPage.getByRole('button',{name,exact:true});
  await button('체험용 기기 사용').tap();await oldPage.getByLabel('재생할 TV').selectOption({label:'침실 TV'});
  await button('＋ 조명 30%').tap();await button('미리보기').tap();await button('내 루틴에 저장').tap();
  const original=await read(oldPage),storageState=await prior.storageState();
  await prior.close();
  const current=await browser.newContext({...opts,storageState});
  try{
    await current.route('**/api/my-appliances',r=>r.fulfill({json:{mode:'demo'}}));
    const p=await current.newPage();p.setDefaultTimeout(8000);
    await p.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{
      const paint=DotScene.paint;DotScene.paint=function(...args){window.phaseFrame=args[5];return paint(...args)};
    }));
    await p.goto(my);await ready(p);
    await p.getByRole('button',{name:'영화 보기',exact:true}).tap();
    const tv=original[1].layouts[original[1].room].find(o=>o.deviceId==='my-tv-2');
    await p.waitForFunction(id=>phaseFrame?.playing&&phaseFrame.tv===id,tv.id);
    await p.getByRole('button',{name:'재생 종료'}).tap();
    await p.goto(dream);await ready(p);
    const actual=await read(p);
    assert.deepEqual(actual[0],original[0]);assert.deepEqual(actual[1],original[1]);
    for(const field of ['collection','collectionSources','savedRoutines','registeredTvIds'])assert.deepEqual(actual[2][field],original[2][field],field);
    const pair=models.map(model=>actual[0].layouts.C.find(o=>o.k==='catalog:fridge:'+model));
    assert.equal(pair[0].turn,1);assert.equal(pair[1].turn??0,0);
    assert.ok(pair.every(o=>o.e===1));
    assert.ok(Math.hypot(pair[0].x-pair[1].x,pair[0].y-pair[1].y)<18,'인접 배치');
    for(const [i,o] of pair.entries()){
      await tapPlacement(p,o.id);
      await p.waitForFunction(({model,id})=>document.querySelector('#lifeTitle').textContent===model&&
        document.querySelector('#lifeDetail').textContent===''&&phaseFrame?.reaction?.itemId===id,{model:await expectedTitle(p,'냉장고',models[i]),id:o.id});
      await p.locator('#lifeActions').getByRole('button',{name:'닫기'}).tap();
    }
    await p.reload();await ready(p);assert.deepEqual((await read(p))[0],original[0]);
    console.log('PASS',width,height,revision,'save, both room layouts, raised/rotated fridge selection, TV2 routine replay',pair.map(o=>[o.x,o.y]));
  }finally{await current.close();}
}
(async()=>{
  const mod=await import('data:text/javascript;base64,'+old('catalog-bodies.mjs').toString('base64'));
  const db=new DatabaseSync(process.env.MINIROOM_CATALOG_DB||path.join(__dirname,'../data/lg_appliances.db'),{readOnly:true});
  const bodies=mod.catalogBodies(db);db.close();
  const browser=await chromium.launch({channel:'chrome'});
  try{for(const [w,h] of [[320,568],[390,844]])await run(browser,w,h,bodies);}
  finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
