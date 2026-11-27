const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const withServer=require('./member-server.cjs');
const camera='https://lg-camera-lab.pages.dev/scan';
const tv={id:'fixture-tv',category:'TV',modelCode:'55LX1QKNA',displayName:'침실 TV'};
const tvKey='catalog:tv:55LX1QKNA';
const liveCamera=process.env.MINIROOM_LIVE_CAMERA==='1';

async function scanTestLabel(page,code){
  const data=await page.evaluate(code=>{
    const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=450;
    const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1000,450);
    ctx.fillStyle='black';ctx.font='48px sans-serif';ctx.fillText('LG Electronics',80,150);
    ctx.fillText('MODEL: '+code,80,245);ctx.fillText(code+'.AKOR',80,338);return canvas.toDataURL().split(',')[1];
  },code);
  const picker=page.waitForEvent('filechooser');
  await page.getByRole('button',{name:'앨범에서 선택'}).tap();
  await (await picker).setFiles({name:'test-model.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});
  await page.getByRole('button',{name:'확인',exact:true}).tap();
  await page.getByText(code,{exact:true}).waitFor({timeout:45000});
  const register=page.getByRole('button',{name:/등록/});
  console.log('카메라 인식',code,await register.innerText());await register.tap();
}

withServer(async base=>{
  const browser=await chromium.launch({channel:'chrome'});
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});
    const p=await context.newPage();p.setDefaultTimeout(6500);
    const errors=[];p.on('pageerror',e=>errors.push(e.message));
    const tap=name=>p.getByRole('button',{name,exact:true}).tap();
    const miniroom=()=>p.getByRole('navigation',{name:'ThinQ 하단 메뉴'}).getByRole('link',{name:'마이룸',exact:true}).tap();
    const read=key=>p.evaluate(key=>JSON.parse(roomStorage.getItem(key)||'null'),key);
    async function scan(space,item,live=false){
      let handle;
      if(!live){
        // A click at the scanner origin exercises cross-site cookie rules on return.
        handle=route=>route.fulfill({contentType:'text/html; charset=utf-8',body:'<button>돌아가기</button>'});
        await p.route(camera+'?**',handle);
      }
      await tap(space==='my'?'＋ 추가하기':'＋ 가전 촬영');await p.waitForURL(camera+'?**');
      const back=new URL(new URL(p.url()).searchParams.get('returnTo'));
      assert.equal(back.origin,base);assert.equal(back.searchParams.get('space'),space);
      if(live&&item){
        await scanTestLabel(p,item.modelCode);
      }else if(live){
        await p.getByRole('button').filter({hasText:'✕'}).tap();
      }else{
        back.searchParams.set('lgcam',item?'registered':'cancelled');
        if(item)back.searchParams.set('lgcam_item',JSON.stringify(item));
        await p.evaluate(href=>document.querySelector('button').onclick=()=>location.assign(href),back.href);
        await tap('돌아가기');await p.unroute(camera+'?**',handle);
      }
      await p.waitForURL(url=>url.origin===base&&url.searchParams.get('camera')!=='resume');
      assert.equal(new URL(p.url()).pathname,'/editor','camera return should retain the signed-in editor: '+p.url());
      if(space==='my'||item)await p.locator('#library[open]').waitFor();
      await p.waitForURL(url=>url.pathname==='/editor'&&!url.searchParams.has('camera'));
    }
    await p.goto(base+'/editor?camera=resume&ticket=unused&lgcam=registered');
    await p.getByRole('link',{name:'ThinQ 홈 열기'}).waitFor();
    assert.equal((await (await p.request.get(base+'/api/members/me')).json()).user,null);
    await p.goto(base+'/experience/qr');await p.locator('#entry').tap();await tap('회원가입');
    const join=p.locator('#join');
    for(const [label,value] of [['이름','신규 테스트'],['아이디','new-member'],['비밀번호','123456'],['닉네임','첫 방문']]){
      await join.getByLabel(label,{exact:true}).fill(value);
    }
    await tap('가입하고 시작하기');await p.locator('#home').waitFor();
    const nav=p.getByRole('navigation',{name:'ThinQ 하단 메뉴'});
    for(const name of ['디바이스','케어','메뉴','홈']){
      const tab=nav.getByRole('link',{name,exact:true});await tab.tap();assert.equal(await tab.getAttribute('aria-current'),'page');
    }
    await miniroom();
    await p.getByRole('button',{name:'＋ 가전 촬영'}).waitFor();
    const initial=await read('dotroom');
    await scan('dream',null,liveCamera);
    assert.match(await p.locator('#notice').innerText(),/취소/);assert.ok(await p.locator('#library').isHidden());
    await scan('dream',tv);await tap('인벤토리에 보관');
    assert.deepEqual((await read('lg-miniroom.state')).collection,[tvKey]);assert.deepEqual(await read('dotroom'),initial);
    await p.locator('#bagItems .bag-unit').tap();await tap('여기에 놓기');await tap('배치 완료');
    // Tap an opaque, visible pixel on the TV that this new member actually placed.
    const tvPoint=await p.evaluate(key=>{
      const layout=JSON.parse(roomStorage.getItem('dotroom'));
      const items=DotScene.sorted(layout.room,layout.layouts[layout.room]);
      const tv=items.find(item=>item.k===key),pos=DotScene.place(layout.room,layout.theme,tv);
      const canvas=document.querySelector('#scene'),rect=canvas.getBoundingClientRect();
      for(let y=2;y<pos.s.h-2;y++)for(let x=2;x<pos.s.w-2;x++){
        if(DotScene.hits(layout.room,layout.theme,items,pos.x+x,pos.y+y)[0]!==tv)continue;
        const point=[rect.left+(pos.x+x+.5)*rect.width/canvas.width,rect.top+(pos.y+y+.5)*rect.height/canvas.height];
        if(document.querySelector('#view').contains(document.elementFromPoint(...point)))return point;
      }
      throw Error('배치한 TV를 터치할 수 없습니다.');
    },tvKey);
    await p.touchscreen.tap(...tvPoint);
    assert.equal(await p.getByRole('button',{name:'재생 종료',exact:true}).count(),0);
    await tap('영화 보기');await tap('재생 종료');
    await p.locator('#myLink').tap();await tap('등록 가전');
    assert.equal(await p.locator('#libraryItems [data-product]').count(),0);
    const myLayout=await read('lg-miniroom.dot.my');
    await scan('my',tv);assert.match(await p.locator('#libraryStatus').innerText(),/등록 완료/);
    assert.deepEqual(await read('lg-miniroom.dot.my'),myLayout);
    await scan('my',tv);assert.match(await p.locator('#libraryStatus').innerText(),/이미 등록/);
    await tap('가전 목록 닫기');await tap('인벤토리');const bag=p.locator('#routineBag');
    await bag.locator('[data-bag=appliance]').tap();await bag.locator('[data-family=TV]').tap();await bag.locator('.bag-unit').tap();
    await tap('여기에 놓기');await tap('배치 완료');
    await tap('＋ 추가');await tap('직접 만들기');await p.getByLabel('루틴 이름').fill('영화 준비');
    const [registeredTV]=(await read('lg-miniroom.state')).cameraAppliances;
    assert.equal(registeredTV.modelCode,tv.modelCode);
    assert.ok(registeredTV.displayName && registeredTV.displayName!==tv.displayName,'카메라에서 보낸 별칭 대신 DB 제품명을 사용해야 합니다.');
    await p.getByRole('combobox',{name:registeredTV.displayName,exact:true}).selectOption('tv-on');
    await tap('미리보기');await tap('내 루틴에 저장');await tap('영화 준비');await tap('재생 종료');
    await p.evaluate(()=>roomStorage.whenSynced());const state=await read('lg-miniroom.state');
    assert.equal(state.cameraAppliances.length,1);assert.equal(state.savedRoutines.length,1);
    assert.deepEqual(Object.values(state.savedRoutines[0].bindings),['camera-unit:55LX1QKNA']);
    await tap('＋ 추가');await tap('영화 보기 연결');
    await p.getByLabel('재생할 TV').selectOption('camera-unit:55LX1QKNA');
    await tap('미리보기');await tap('내 루틴에 저장');await tap('영화 보기');await tap('재생 종료');
    await p.evaluate(()=>roomStorage.whenSynced());
    const movie=(await read('lg-miniroom.state')).savedRoutines.find(record=>record.templateId==='movie-night');
    assert.equal(movie.bindings['tv-on'],'camera-unit:55LX1QKNA');assert.equal(movie.exclusions['curtain-close'],'no_device');
    // A full session store must leave the signed-in account and the editor in agreement.
    const layoutKey='lg-miniroom.dot.my',beforeStow=await read(layoutKey);
    await tap('인벤토리');await bag.locator('[data-bag=appliance]').tap();
    await bag.locator('[data-family=TV]').tap();await bag.locator('.bag-unit').tap();
    await p.evaluate(()=>{
      const original=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){
        if(this===sessionStorage&&key.startsWith('miniroom.account.draft.')){
          Storage.prototype.setItem=original;throw Error('테스트 계정 임시 저장 실패');
        }
        return original.call(this,key,value);
      };
    });
    await tap('수납');assert.deepEqual(await read(layoutKey),beforeStow,'계정 저장 실패 뒤 배치를 유지해야 합니다.');
    await tap('수납');await p.evaluate(()=>roomStorage.whenSynced());
    assert.ok(!(await read(layoutKey)).layouts.B.some(o=>o.deviceId===movie.bindings['tv-on']));
    await p.locator('#undo').tap();await p.evaluate(()=>roomStorage.whenSynced());
    assert.deepEqual(await read(layoutKey),beforeStow);
    await tap('배치 완료');
    if(liveCamera){
      const fridge={modelCode:'M876GBC472'};
      await tap('등록 가전');const placed=await read('lg-miniroom.dot.my');
      await scan('my',fridge,true);assert.match(await p.locator('#libraryStatus').innerText(),/등록 완료/);
      assert.ok((await read('lg-miniroom.state')).cameraAppliances.some(d=>d.modelCode===fridge.modelCode));
      assert.deepEqual(await read('lg-miniroom.dot.my'),placed);await tap('가전 목록 닫기');
      await p.locator('#dreamLink').tap();await scan('dream',fridge,true);await tap('인벤토리에 보관');
      assert.ok((await read('lg-miniroom.state')).collection.includes('catalog:fridge:M876GBC472'));
      await p.evaluate(()=>roomStorage.whenSynced());
    }
    await context.close();
    const again=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
    const next=await again.newPage();await next.goto(base);await next.locator('#login').getByLabel('아이디').fill('new-member');
    await next.locator('#login').getByLabel('비밀번호').fill('123456');await next.getByRole('button',{name:'로그인',exact:true}).tap();
    await next.getByRole('navigation',{name:'ThinQ 하단 메뉴'}).getByRole('link',{name:'마이룸',exact:true}).tap();
    await next.locator('#myLink').tap();await next.getByRole('button',{name:'영화 준비',exact:true}).tap();
    assert.ok((await next.locator('#lifeDetail').innerText()).includes(registeredTV.displayName));assert.deepEqual(errors,[]);
    if(liveCamera){
      // Replay a real scan in a normal browser context, with service workers enabled.
      await next.getByRole('button',{name:'재생 종료',exact:true}).tap();
      await next.getByRole('button',{name:'등록 가전',exact:true}).tap();
      await next.getByRole('button',{name:'＋ 추가하기',exact:true}).tap();
      await next.waitForURL(camera+'?**');await scanTestLabel(next,'M876GBC472');
      await next.locator('#library[open]').waitFor({timeout:20000});
      assert.match(await next.locator('#libraryStatus').innerText(),/이미 등록/);
    }
    console.log('PASS fresh signup, camera cancellation and both callbacks, placement, duplicate registration, custom routine and separate-browser replay');
  }finally{await browser.close()}
}).catch(e=>{console.error(e);process.exitCode=1});
