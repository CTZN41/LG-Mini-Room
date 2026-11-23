const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
 for(const [width,height] of [[320,568],[390,844],[667,375],[1150,750]]){
  const p=await browser.newPage({viewport:{width,height},isMobile:width<1000,hasTouch:width<1000});p.setDefaultTimeout(5000);
  const errors=[];p.on('pageerror',e=>errors.push(e.message));const go=n=>p.getByRole('button',{name:n,exact:true}).click();
  const checkbox=n=>p.getByRole('checkbox',{name:n,exact:true}), sel=n=>p.locator('#batch').getByRole('combobox',{name:n,exact:true});
  const state=()=>p.evaluate(()=>JSON.parse(localStorage['lg-miniroom.state']));
  await p.goto((process.argv[2]||'http://127.0.0.1:4173')+'/editor?space=my&observe=1');
  await go('체험용 기기 사용');await go('여러 루틴 설정');assert.ok(await p.locator('#batchSave').isDisabled());
  for(const n of ['영화 보기','쾌적한 방','의류 관리'])await checkbox(n).check();
  await sel('TV 켜기 · 필수').selectOption('my-tv-2');await sel('조명 30% · 선택').selectOption('my-light-1');
  await go('체험용 에어컨 배치');await go('체험용 공기청정기 배치');assert.ok(await p.locator('#batchSave').isDisabled());await go('체험용 워시타워 배치');
  await checkbox('영화 보기').uncheck();await checkbox('영화 보기').check();assert.equal(await sel('TV 켜기 · 필수').inputValue(),'my-tv-2');
  const rect=await p.locator('#batchSave').boundingBox();assert.ok(rect.x>=0&&rect.y>=0&&rect.y+rect.height<=height);
  const before=await state();assert.equal(before.savedRoutines.length,0);
  await p.evaluate(()=>{window.rawSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='lg-miniroom.state')throw Error('test write failure');return window.rawSet.call(this,k,v)}});
  await go('3개 루틴 저장');assert.deepEqual(await state(),before);assert.match(await p.locator('#batchStatus').innerText(),/저장하지 못/);
  await p.evaluate(()=>Storage.prototype.setItem=window.rawSet);await go('3개 루틴 저장');await go('루틴 추가');let s=await state();
  assert.equal(s.revision,before.revision+1);assert.equal(s.savedRoutines.length,3);
  const original=s.savedRoutines,record=id=>original.find(r=>r.templateId===id);
  assert.equal(record('movie-night').bindings['tv-on'],'my-tv-2');assert.equal(record('movie-night').exclusions['curtain-close'],'no_device');assert.equal(record('clothes-care').exclusions['style-refresh'],'no_device');
  await checkbox('영화 보기').check();await checkbox('쾌적한 방').check();assert.equal(await sel('TV 켜기 · 필수').inputValue(),'my-tv-2');assert.equal(await sel('공기청정기 자동 청정 · 선택').inputValue(),record('room-comfort').bindings['air-clean']);
  await sel('TV 켜기 · 필수').selectOption('my-tv-1');await sel('공기청정기 자동 청정 · 선택').selectOption('');p.once('dialog',d=>d.dismiss());await go('2개 루틴 저장');assert.deepEqual((await state()).savedRoutines,original);
  await go('설정 닫기');assert.deepEqual((await state()).savedRoutines,original);await go('루틴 추가');
  await checkbox('영화 보기').check();await checkbox('쾌적한 방').check();await sel('TV 켜기 · 필수').selectOption('my-tv-1');await sel('공기청정기 자동 청정 · 선택').selectOption('');p.once('dialog',d=>d.accept());await go('2개 루틴 저장');
  s=await state();assert.equal(s.revision,before.revision+2);assert.equal(s.savedRoutines.length,3);assert.deepEqual(s.savedRoutines.find(r=>r.templateId==='clothes-care'),record('clothes-care'));
  await p.reload();for(const n of ['영화 보기','쾌적한 방','의류 관리']){await go(n);const detail=await p.locator('#lifeDetail').innerText();if(n==='영화 보기')assert.match(detail,/거실 TV/);if(n==='쾌적한 방')assert.match(detail,/공기청정기 제외/);await go('재생 종료')}
  assert.deepEqual(errors,[]);console.log('PASS',width,height,'3 selected, required check, atomic retry, 2 updated, unselected preserved, cancel, reload and replay all');await p.context().close();
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1})
