const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const withServer=require('./member-server.cjs');
const headers={'X-Miniroom':'1'};
const empty=()=>({schemaVersion:1,revision:0,collection:[],dreamLayout:{},myLayout:{},savedRoutines:[]});
withServer(async base=>{
  const browser=await chromium.launch({channel:'chrome'});
  try{
    const ctx=()=>browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const host=await ctx(),guest=await ctx(),blocked=await ctx();
    const post=(context,path,data)=>context.request.post(base+'/api/members/'+path,{headers,data});
    const join=async(context,nickname,state)=>{
      const r=await post(context,'join',{name:nickname,username:nickname.replaceAll(' ','-'),password:'012345',nickname});
      assert.equal(r.status(),201);const {id}=await r.json();
      assert.ok((await post(context,'save',{owner:id,key:'lg-miniroom.state',value:JSON.stringify(state),before:null})).ok());
      return id;
    };
    const home=empty();home.savedRoutines.push({custom:true,templateId:'private-555',name:'저녁 휴식',anchorId:'my-room',
      actions:[{operation:'tv-on',actionId:'a',required:true},{operation:'light-dim',actionId:'b',required:false}],
      bindings:{a:'owner-private-tv',b:'owner-private-light'},exclusions:{}});
    const source=await join(host,'주인',home);
    const mine={...empty(),myFixtureId:'sample-home-v1',registeredTvIds:['my-tv-1','my-tv-2']};
    const owner=await join(guest,'손님',mine),emptyId=await join(blocked,'빈 방',empty());
    await post(host,'profile',{owner:source,nickname:'주인',myPublic:true});
    const page=await guest.newPage();page.setDefaultTimeout(7000);
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    const url=base+'/members?visit='+source+'&space=my';
    await page.goto(url);
    await page.locator('#visitTitle').waitFor();assert.match(await page.locator('#visitTitle').innerText(),/주인 · 마이룸/);
    await page.getByLabel('방명록').fill('방 잘 봤어요.');await page.getByRole('button',{name:'글 남기기'}).click();
    await page.getByText('손님 · 방 잘 봤어요.',{exact:true}).waitFor();
    const projection=await (await guest.request.get(base+'/api/members/room?id='+source+'&space=my')).json();
    assert.doesNotMatch(JSON.stringify(projection),/owner-private|private-555/);
    const share=projection.recipes[0].share;
    const kept=await post(blocked,'import',{owner:emptyId,source,share});
    assert.equal(kept.status(),200);
    const bp=await blocked.newPage();await bp.goto(base+'/editor?space=my&friendImport='+(await kept.json()).id);
    await bp.getByText('필수 기기를 연결하면 실행할 수 있어요. 루틴은 계정에 보관돼요.',{exact:true}).waitFor();
    assert.ok(await bp.getByRole('button',{name:'미리보기',exact:true}).isDisabled());
    await page.getByRole('button',{name:'저녁 휴식 가져오기'}).click();
    await page.locator('#shared a').click();
    const select=page.getByLabel('TV 켜기 · 필수');
    await select.waitFor();assert.equal(await select.inputValue(),'');
    await select.selectOption('my-tv-2');
    const optional=page.getByLabel('조명 30% · 선택');assert.ok(await optional.isDisabled());
    await page.getByRole('button',{name:'미리보기',exact:true}).click();await page.getByText(/제외된 동작 조명 30%/).waitFor();
    await page.getByRole('button',{name:'내 루틴에 저장'}).click();
    await page.getByRole('button',{name:'저녁 휴식',exact:true}).waitFor();
    await page.waitForFunction(()=>document.getElementById('accountSaveStatus').textContent==='계정에 저장됨');
    await page.reload();await page.getByRole('button',{name:'저녁 휴식',exact:true}).click();
    await page.getByRole('button',{name:'재생 종료'}).waitFor();
    const state=await page.evaluate(()=>JSON.parse(roomStorage.getItem('lg-miniroom.state')));
    assert.deepEqual(Object.values(state.savedRoutines[0].bindings),['my-tv-2']);
    await post(host,'profile',{owner:source,nickname:'주인',myPublic:false});
    assert.equal((await post(guest,'note',{owner,source,space:'my',message:'접근'})).status(),404);
    assert.equal((await post(guest,'import',{owner,source,share})).status(),404);
    assert.equal((await guest.request.get(base+'/api/members/room?id='+source+'&space=my')).status(),404);
    assert.equal((await (await guest.request.get(base+'/api/members/imports')).json()).imports.length,1);
    assert.deepEqual(errors,[]);console.log('PASS Phase 4 public room, notes, redacted copy, missing/optional/multiple matches, personal save/replay and revoked access');
  }finally{await browser.close()}
}).catch(e=>{console.error(e);process.exitCode=1});
