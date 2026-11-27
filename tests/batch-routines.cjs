const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const withServer=require('./member-server.cjs');
async function signIn(page,base,username,carryLayout=false){
  const headers={'X-Miniroom':'1'};
  const joined=await page.request.post(base+'/api/members/join',{headers,data:{name:'테스트',nickname:'테스트',username,password:'123456'}});
  assert.equal(joined.status(),201);
  if(carryLayout){
    const owner=(await joined.json()).id;
    for(const key of ['lg-miniroom.state','lg-miniroom.dot.my']){
      const value=await page.evaluate(key=>localStorage.getItem(key),key);
      const saved=await page.request.post(base+'/api/members/save',{headers,data:{owner,key,before:null,value}});
      assert.equal(saved.status(),200);
    }
  }
}
withServer(async base=>{const browser=await chromium.launch({channel:'chrome'});try{
 for(const [width,height] of [[320,568],[390,844],[667,375],[1150,750]]){
  const p=await browser.newPage({viewport:{width,height},isMobile:width<1000,hasTouch:width<1000});p.setDefaultTimeout(5000);
  const errors=[];p.on('pageerror',e=>errors.push(e.message));const go=n=>p.getByRole('button',{name:n,exact:true}).click();
  const checkbox=n=>p.getByRole('checkbox',{name:n,exact:true}), sel=n=>p.locator('#batch').getByRole('combobox',{name:n,exact:true});
  const state=()=>p.evaluate(()=>JSON.parse(roomStorage.getItem('lg-miniroom.state')));
  await p.goto(base+'/editor?space=my&observe=1');
  await go('체험용 기기 사용');
  assert.equal((await state()).savedRoutines.length,0);
  assert.equal(await p.locator('#lifeTitle').innerText(),'내 루틴 0');
  await go('내 가전으로 가능한 루틴 2개 보기');
  await p.getByRole('button',{name:'쾌적한 방 추천',exact:true}).waitFor();
  await p.getByRole('button',{name:'청소 시간 추천',exact:true}).waitFor();
  await go('추천 2개 함께 설정');
  assert.ok(await checkbox('쾌적한 방').isChecked());assert.ok(await checkbox('청소 시간').isChecked());
  assert.equal(await checkbox('영화 보기').isChecked(),false);
  await go('설정 닫기');assert.equal((await state()).savedRoutines.length,0);
  await go('＋ 추가');await go('여러 루틴 설정');assert.ok(await p.locator('#batchSave').isDisabled());
  for(const n of ['영화 보기','쾌적한 방','의류 관리','청소 시간'])await checkbox(n).check();
  await sel('TV 켜기 · 필수').selectOption('my-tv-2');await sel('조명 30% · 선택').selectOption('my-light-1');
  await go('체험용 에어컨 배치');
  const airId=await sel('에어컨 냉방 · 필수').inputValue();
  const layout=await p.evaluate(()=>JSON.parse(localStorage['lg-miniroom.dot.my']));
  const ac=layout.layouts[layout.room].find(o=>o.k==='catalog:ac:FQ16ET4HSN');
  assert.ok(airId && ac,'DB 실내기를 현재 방에 배치');
  assert.equal(ac.deviceId,airId);
  await p.locator('#batch-room-comfort').getByRole('button',{name:'체험용 공기청정기 배치'}).click();
  const cleaningPurifier=p.locator('#batch-cleaning-time').getByLabel('공기청정기 자동 청정 · 선택');
  assert.equal(await cleaningPurifier.inputValue(),'');
  await go('체험용 로봇청소기 배치');assert.ok(await p.locator('#batchSave').isDisabled());await go('체험용 세탁기 배치');
  await checkbox('영화 보기').uncheck();await checkbox('영화 보기').check();assert.equal(await sel('TV 켜기 · 필수').inputValue(),'my-tv-2');
  const rect=await p.locator('#batchSave').boundingBox();assert.ok(rect.x>=0&&rect.y>=0&&rect.y+rect.height<=height);
  const before=await state();assert.equal(before.savedRoutines.length,0);
  await p.evaluate(()=>{window.rawSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='lg-miniroom.state')throw Error('test write failure');return window.rawSet.call(this,k,v)}});
  await go('4개 루틴 저장');assert.deepEqual(await state(),before);assert.match(await p.locator('#batchStatus').innerText(),/저장하지 못/);
  await p.evaluate(()=>Storage.prototype.setItem=window.rawSet);await go('4개 루틴 저장');await go('＋ 추가');await go('여러 루틴 설정');let s=await state();
  assert.equal(s.revision,before.revision+1);assert.equal(s.savedRoutines.length,4);
  const original=s.savedRoutines,record=id=>original.find(r=>r.templateId===id);
  assert.equal(record('room-comfort').bindings['air-cool'],airId);
  assert.ok(record('cleaning-time').bindings['robot-clean']);assert.ok(!record('cleaning-time').bindings['air-clean']);assert.ok(record('room-comfort').bindings['air-clean']);
  assert.equal(record('movie-night').bindings['tv-on'],'my-tv-2');assert.equal(record('movie-night').exclusions['curtain-close'],'no_device');assert.equal(record('clothes-care').exclusions['style-refresh'],'no_device');
  await checkbox('영화 보기').check();await checkbox('쾌적한 방').check();assert.equal(await sel('TV 켜기 · 필수').inputValue(),'my-tv-2');assert.equal(await sel('공기청정기 자동 청정 · 선택').inputValue(),record('room-comfort').bindings['air-clean']);
  await sel('TV 켜기 · 필수').selectOption('my-tv-1');await sel('공기청정기 자동 청정 · 선택').selectOption('');p.once('dialog',d=>d.dismiss());await go('2개 루틴 저장');assert.deepEqual((await state()).savedRoutines,original);
  await go('설정 닫기');assert.deepEqual((await state()).savedRoutines,original);await go('＋ 추가');await go('여러 루틴 설정');
  await checkbox('영화 보기').check();await checkbox('쾌적한 방').check();await sel('TV 켜기 · 필수').selectOption('my-tv-1');await sel('공기청정기 자동 청정 · 선택').selectOption('');p.once('dialog',d=>d.accept());await go('2개 루틴 저장');
  s=await state();assert.equal(s.revision,before.revision+2);assert.equal(s.savedRoutines.length,4);assert.deepEqual(s.savedRoutines.find(r=>r.templateId==='clothes-care'),record('clothes-care'));
  await p.reload();for(const n of ['영화 보기','쾌적한 방','의류 관리','청소 시간']){await go(n);const detail=await p.locator('#lifeDetail').innerText();if(n==='영화 보기')assert.match(detail,/거실 TV/);if(n==='쾌적한 방'||n==='청소 시간')assert.match(detail,/공기청정기 제외/);await go('재생 종료')}
  await signIn(p,base,'batch-'+width,true);
  await p.goto(base+'/editor?space=my&app=thinq');
  await p.getByText('내 루틴 4',{exact:true}).waitFor();
  const list=p.locator('#lifeActions'),rows=list.locator('.shelf-row');
  assert.equal(await rows.count(),4);
  assert.equal(await list.getByRole('button',{name:/추천/}).count(),0);
  await go('연결 기기 변경');assert.equal(await p.getByLabel('재생할 TV').inputValue(),'my-tv-1');
  assert.equal(await p.getByRole('button',{name:'재생 종료',exact:true}).count(),0);
  await go('방 둘러보기');await go('＋ 추가');await go('루틴 추가 닫기');
  const last=rows.last().getByRole('button').first();
  await last.scrollIntoViewIfNeeded();const lastName=await last.getAttribute('aria-label');
  const dims=await list.evaluate(el=>({height:el.clientHeight,content:el.scrollHeight}));
  assert.ok(dims.content>dims.height);
  const nav=p.getByRole('navigation',{name:'ThinQ 하단 메뉴'});
  const navRect=await nav.boundingBox(),viewRect=await p.locator('#view').boundingBox();
  assert.ok(viewRect.height>40&&navRect.y+navRect.height<=height+1);
  await go(lastName);await rows.last().getByRole('button',{name:'재생 종료'}).waitFor();
  await go('재생 종료');await go('배치 편집');assert.ok(await list.isHidden());
  await go('배치 완료');assert.deepEqual((await state()).savedRoutines,s.savedRoutines);
  assert.deepEqual(errors,[]);console.log('PASS',width,height,'4 selected, required check, atomic retry, 2 updated, unselected preserved, cancel, reload and replay all');await p.context().close();
 }
 for(const [width,height] of [[320,568],[390,844]]){
   const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true});
   page.setDefaultTimeout(6500);
   const tap=name=>page.getByRole('button',{name,exact:true}).tap();
   try{
     await signIn(page,base,'reco-'+width);
     await page.goto(base+'/editor?space=my&app=thinq');
     await tap('체험용 기기 사용');await tap('내 가전으로 가능한 루틴 2개 보기');
     await tap('추천 2개 함께 설정');await tap('체험용 에어컨 배치');await tap('체험용 로봇청소기 배치');
     await tap('2개 루틴 저장');await page.getByText('내 루틴 2',{exact:true}).waitFor();
     await page.evaluate(()=>roomStorage.whenSynced());await page.reload();
     for(const name of ['쾌적한 방','청소 시간']){await tap(name);await tap('재생 종료')}
     console.log('PASS',width,height,'saved both recommendations together and replayed after reload');
   }finally{await page.context().close()}
 }
}finally{await browser.close()}}).catch(e=>{console.error(e);process.exitCode=1})
