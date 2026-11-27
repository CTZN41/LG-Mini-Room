const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const withServer=require('./member-server.cjs');

withServer(async base=>{
  const browser=await chromium.launch({channel:'chrome'});
  try{
    const origin=base+'/api/members/';
    const context=()=>browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const host=await context(),guest=await context();
    const post=async(ctx,path,data)=>{
      const res=await ctx.request.post(origin+path,{headers:{'X-Miniroom':'1'},data});
      const body=await res.json();assert.ok(res.ok(),path+' '+JSON.stringify(body));return body;
    };
    const wallet=async ctx=>(await ctx.request.get(origin+'wallet')).json();
    const state={schemaVersion:1,revision:0,collection:[],savedRoutines:[],myLayout:{},dreamLayout:{}};
    const recipe={name:'영화와 공기 관리',custom:true,templateId:'custom-1',anchorId:'my-room',
      actions:['tv-on','air-clean','air-cool'].map(operation=>({actionId:operation,operation,required:true})),
      bindings:{'tv-on':'host-tv','air-clean':'host-purifier','air-cool':'host-ac'}};
    const {id:source}=await post(host,'join',{name:'회원',username:'host',password:'012345',nickname:'공유자'});
    await post(host,'save',{owner:source,key:'lg-miniroom.state',value:JSON.stringify({...state,savedRoutines:[recipe]}),before:null});
    await post(host,'profile',{owner:source,nickname:'공유자',myPublic:true});
    const tv='catalog:tv:55LX1QKNA', purifier='catalog:purifier:AS235DWSA';
    const layout={room:'B',theme:'pink',layoutVersion:1,layouts:{B:[{k:tv,x:20,y:30,exhibit:true}]}};
    const home={...state,collection:[tv,purifier,tv,'catalog:tv:UNKNOWN'],
      cameraAppliances:[{id:'my-own-tv',modelCode:'55LX1QKNA',category:'TV',displayName:'거실 TV'}]};
    const {id:owner}=await post(guest,'join',{name:'회원',username:'guest',password:'012345',nickname:'방문자'});
    await post(guest,'save',{owner,key:'lg-miniroom.state',value:JSON.stringify(home),before:null});
    await post(guest,'save',{owner,key:'dotroom',value:JSON.stringify(layout),before:null});
    const room=await (await guest.request.get(origin+'room?id='+source+'&space=my')).json();
    const imports=await Promise.all(Array.from({length:5},()=>post(guest,'import',{owner,source,share:room.recipes[0].share})));
    assert.equal(new Set(imports.map(r=>r.id)).size,1);
    const first=await wallet(guest);
    assert.equal(first.points,10);assert.equal(first.xp,1);
    assert.deepEqual(first.coupons.map(c=>c.family).sort(),['공기청정기','에어컨'].sort());
    const exhibit=await post(guest,'claim',{owner});
    assert.deepEqual(exhibit.counts,{collection:2,friend:1});assert.equal(exhibit.points,12);assert.equal(exhibit.xp,1.5);
    const page=await guest.newPage();
    const errors=[];page.on('pageerror',err=>errors.push(err.message));
    await page.goto(base+'/members');await page.getByText('레벨 1 · 경험치 1.5 · 12 포인트',{exact:true}).waitFor();
    // Make a pending personal placement and claim from the same tab before its save responds.
    const personal={...layout,layouts:{B:[{k:tv,x:22,y:32}]}};
    await page.evaluate(value=>{miniroomStorage.setItem('dotroom',JSON.stringify(value));document.getElementById('claim').click()},personal);
    await page.getByText('레벨 1 · 경험치 2.5 · 312 포인트',{exact:true}).waitFor();
    const repeated=await Promise.all(Array.from({length:5},()=>post(guest,'claim',{owner})));
    for(const w of repeated){assert.equal(w.points,312);assert.equal(w.counts.tutorial,1);assert.equal(w.coupons.length,2)}
    await page.reload();await page.getByText('레벨 1 · 경험치 2.5 · 312 포인트',{exact:true}).waitFor();
    assert.equal(await page.locator('#coupons li').count(),2);
    assert.equal((await wallet(host)).points,0);
    const {levelFor}=await import('../rewards.mjs');assert.deepEqual([0,9.5,10,980,10000].map(levelFor),[1,1,2,99,99]);
    assert.deepEqual(errors,[]);
    console.log('PASS Phase 5 concurrent import and claims, registered vs collected families, coupon history, exhibit exclusion, level cap, account isolation and wallet reload');
  }finally{await browser.close()}
}).catch(error=>{console.error(error);process.exitCode=1});
