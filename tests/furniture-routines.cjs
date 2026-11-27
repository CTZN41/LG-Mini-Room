const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const withServer=require('./member-server.cjs');
async function enterMyRoom(page,base,username){
  const joined=await page.request.post(base+'/api/members/join',{headers:{'X-Miniroom':'1'},
    data:{name:'테스트',nickname:'가구 검증',username,password:'123456'}});
  assert.equal(joined.status(),201);
  await page.goto(base+'/');
  await page.getByRole('navigation',{name:'ThinQ 하단 메뉴'}).getByRole('link',{name:'마이룸',exact:true}).tap();
  await page.locator('#myLink').tap();
}

const tapItem=require('./support/tap-room-item.cjs');

async function check(browser,width,height,base){
  const page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  page.setDefaultTimeout(5000);
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const button=name=>page.getByRole('button',{name,exact:true});
  const tap=name=>button(name).tap();
  const savedItems=()=>page.evaluate(()=>JSON.parse(localStorage['lg-miniroom.dot.my']).layouts.B);
  try{
    await page.goto(base+'/editor?space=my');
    await tap('체험용 기기 사용');
    await button('＋ 추가').waitFor();
    assert.equal(await page.getByLabel('재생할 TV').count(),0);
    const tv=(await savedItems()).find(o=>o.deviceId==='my-tv-1');
    await tapItem(page,tv.id);await button('영화 보기').waitFor();
    assert.equal(await button('재생 종료').count(),0);
    await tap('닫기');
    const sofa=(await savedItems()).find(o=>o.k==='sofa');
    await tapItem(page,sofa.id);await tap('영화 보기 설정');
    await page.locator('#lifeActions select').selectOption('my-tv-1');
    await tap('미리보기');await tap('저장하고 이 소파에 연결');await tap('닫기');
    await button('＋ 추가').waitFor();
    await tapItem(page,sofa.id);await tap('영화 보기');await tap('재생 종료');await tap('닫기');
    await tap('배치 편집');await tap('가구');await page.locator('[data-key=bed]').tap();await tap('배치 완료');
    const bed=(await savedItems()).find(o=>o.k==='bed');
    await tapItem(page,bed.id);await tap('취침 모드 만들기');
    assert.equal(await page.locator('#customName').inputValue(),'취침 모드');
    assert.equal(await page.locator('#customDevices select').evaluateAll(es=>es.filter(e=>e.value==='light-off').length),1);
    await tap('미리보기');
    const records=()=>page.evaluate(()=>JSON.parse(localStorage['lg-miniroom.state']).savedRoutines);
    const before=await records();
    await page.evaluate(()=>{
      const write=Storage.prototype.setItem;
      const fail={'lg-miniroom.state':1,'lg-miniroom.dot.my':2};
      Storage.prototype.setItem=function(key,value){
        if(fail[key]>0){fail[key]--;throw new DOMException('Test storage full','QuotaExceededError')}
        return write.call(this,key,value);
      };
    });
    await tap('저장하고 이 침대에 연결');
    assert.deepEqual(await records(),before);
    await tap('저장하고 이 침대에 연결');
    await button('가구 연결 재시도').waitFor();
    const committed=await records();
    assert.equal(committed.length,before.length+1);
    assert.deepEqual((await savedItems()).find(o=>o.id===bed.id).routineIds||[],[]);
    await tap('가구 연결 재시도');
    await button('가구 연결 재시도').waitFor();
    await tap('가구 연결 재시도');await button('취침 모드').waitFor();
    assert.deepEqual(await records(),committed);
    await tap('루틴 연결 설정');await page.getByLabel('영화 보기',{exact:true}).check();
    await tap('연결 저장');await page.reload();await button('＋ 추가').waitFor();
    await tapItem(page,bed.id);await button('영화 보기').waitFor();await tap('취침 모드');
    assert.match(await page.locator('#lifeDetail').innerText(),/조명 끄기.*실제 가전은 작동하지 않아요/);
    await page.goBack();await tap('루틴 연결 설정');await page.getByLabel('영화 보기',{exact:true}).uncheck();
    await tap('연결 저장');assert.equal(await button('영화 보기').count(),0);
    await tapItem(page,sofa.id);await button('영화 보기').waitFor();assert.equal(await button('취침 모드').count(),0);
    await tap('배치 편집');await tapItem(page,bed.id);assert.equal(await button('복제').count(),0);
    await tap('다른 제품 놓기');await page.locator('[data-cat="가구"]').tap();await page.locator('[data-key=bed]').tap();
    const copy=(await savedItems()).find(o=>o.k==='bed'&&o.id!==bed.id);
    assert.deepEqual(copy.routineIds||[],[]);
    await tapItem(page,bed.id);await tap('수납');await tap('배치 완료');
    await tap('취침 모드');await tap('재생 종료');
    await tapItem(page,copy.id);assert.equal(await button('취침 모드').count(),0);
    assert.deepEqual(errors,[]);
    console.log('PASS',width,height,'sofa movie, bed sleep, multiple links, reload, unlink, new bed and shelf after deletion');
  }catch(error){
    console.error('Panel:',await page.locator('#living').innerText());throw error;
  }finally{await page.context().close()}
}
async function movieWithoutSofa(browser,width,height,base){
  const page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  const layoutKey='lg-miniroom.dot.my.thinq',stateKey='lg-miniroom.state.thinq';
  const tap=name=>page.getByRole('button',{name,exact:true}).tap();
  const devices=['거실 TV','침실 TV'].map((name,i)=>({category:'TV',modelCode:'55LX1QKNA',id:'tv-'+i,name}));
  await page.route('**/api/my-appliances',r=>r.fulfill({json:{mode:'thinq',devices}}));
  await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{
    if(typeof DotScene==='undefined')return;
    const paint=DotScene.paint;DotScene.paint=(...args)=>{window.roomFrame=args[5];return paint(...args)};
  }));
  try{
    await enterMyRoom(page,base,'movie-'+width);await tap('배치 편집');
    await page.locator('#more').tap();await tap('이 방 전부 비우기');
    await tap('가전');await tap('침실 TV');await tap('배치 완료');
    const objects=await page.evaluate(key=>{const l=JSON.parse(roomStorage.getItem(key));return l.layouts[l.room]},layoutKey);
    assert.equal(objects.length,1);assert.equal(objects[0].deviceId,'tv-1');
    await tapItem(page,objects[0].id,layoutKey);
    assert.equal(await page.getByRole('button',{name:'재생 종료'}).count(),0);
    await tap('영화 보기');await tap('내 루틴에 저장');
    await page.getByText('내 루틴 1',{exact:true}).waitFor();
    await page.reload();await tap('영화 보기');
    const frame=await page.evaluate(()=>({seat:roomFrame.seat,tv:roomFrame.tv,cat:roomFrame.cat}));
    assert.equal(frame.seat,null);assert.equal(frame.tv,objects[0].id);assert.ok(frame.cat);
    const [record]=await page.evaluate(key=>JSON.parse(roomStorage.getItem(key)).savedRoutines,stateKey);
    assert.deepEqual(record.bindings,{'tv-on':'tv-1'});assert.equal(record.exclusions['curtain-close'],'no_device');
    await tap('재생 종료');console.log('PASS',width,height,'no sofa, tapped TV discovery, virtual playback and saved TV after reload');
  }finally{await page.context().close()}
}

async function lightThenBed(browser,width,height,base){
  const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  page.setDefaultTimeout(6500);
  const layoutKey='lg-miniroom.dot.my.thinq',name='잘 때 불 끄기 · 외출한 가족을 위해 침실 조명만 끄기';
  const button=n=>page.getByRole('button',{name:n,exact:true});
  const tap=n=>button(n).tap();
  const records=()=>page.evaluate(()=>JSON.parse(roomStorage.getItem('lg-miniroom.state.thinq')).savedRoutines);
  const bed=()=>page.evaluate(key=>{const l=JSON.parse(roomStorage.getItem(key));return l.layouts[l.room].find(o=>o.k==='bed')},layoutKey);
  await page.route('**/api/my-appliances',route=>route.fulfill({json:{mode:'thinq',devices:[{id:'lamp',name:'침실 조명',category:'조명'}]}}));
  async function replay(){
    await tap(name);
    assert.match(await page.locator('#lifeDetail').innerText(),/침실 조명.*조명 끄기.*미배치/);
    await tap('재생 종료');
  }
  try{
    await enterMyRoom(page,base,'light-'+width);
    await tap('배치 편집');await page.locator('#more').tap();await tap('이 방 전부 비우기');await tap('배치 완료');
    await tap('＋ 추가');await tap('직접 만들기');await page.getByLabel('루틴 이름').fill(name);
    await page.getByRole('combobox',{name:'침실 조명',exact:true}).selectOption('light-off');
    await tap('미리보기');await tap('내 루틴에 저장');await button(name).waitFor();
    const original=await records();assert.equal(original.length,1);
    const nav=page.getByRole('navigation',{name:'ThinQ 하단 메뉴'});
    await nav.getByRole('link',{name:'홈',exact:true}).tap();
    await page.waitForURL(url=>url.pathname!=='/editor');
    await nav.getByRole('link',{name:'마이룸',exact:true}).tap();
    await page.locator('#myLink').tap();
    await button(name).waitFor();await page.reload();await button(name).waitFor();
    const card=await button(name).boundingBox(),bar=await nav.boundingBox(),room=await page.locator('#view').boundingBox();
    assert.ok(card.x>=0&&card.x+card.width<=width+1&&card.y<bar.y&&bar.y+bar.height<=height+1&&room.height>40);
    await replay();await tap('배치 편집');
    await tap('가구');await page.locator('#products [data-key=bed]').tap();await tap('배치 완료');
    const id=(await bed()).id;
    async function link(enabled){
      await tapItem(page,id,layoutKey);await tap('루틴 연결 설정');
      await page.getByLabel(name,{exact:true}).setChecked(enabled);await tap('연결 저장');
    }
    await link(true);assert.deepEqual((await bed()).routineIds,[original[0].templateId]);
    await replay();await tap('닫기');await replay();await button(name).waitFor();
    await link(false);assert.deepEqual((await bed()).routineIds,[]);await tap('닫기');
    await page.reload();await replay();await button(name).waitFor();
    await link(true);const linkedBed=await bed();
    await tap('인벤토리');const bag=page.locator('#routineBag');
    assert.ok(await bag.locator('[data-bag=furniture]').isHidden());await tap('인벤토리 닫기');
    await tap('배치 편집');await tapItem(page,id,layoutKey);
    assert.ok(await bag.isHidden());await tap('수납');assert.equal(await bed(),undefined);
    await page.locator('#undo').tap();assert.deepEqual(await bed(),linkedBed);
    await page.reload();await tapItem(page,id,layoutKey);await tap(name);
    await tap('재생 종료');await tap('배치 편집');await tapItem(page,id,layoutKey);
    await tap('수납');await tap('배치 완료');assert.equal(await bed(),undefined);
    await page.reload();await replay();assert.deepEqual(await records(),original);
    console.log('PASS',width,height,'one unplaced light, save in empty room, link later, bed and shelf playback, unlink, remove bed and reload one unchanged original');
  }finally{await page.context().close()}
}

withServer(async base=>{
  const browser=await chromium.launch({channel:'chrome'});
  try{for(const [w,h] of [[320,568],[390,844]]){await movieWithoutSofa(browser,w,h,base);await check(browser,w,h,base);await lightThenBed(browser,w,h,base)}}finally{await browser.close()}
}).catch(e=>{console.error(e);process.exitCode=1});
