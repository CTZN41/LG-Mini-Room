const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const withServer=require('./member-server.cjs');

withServer(async base=>{
  const browser=await chromium.launch({channel:'chrome'});
  try{
    for(const [width,height] of [[320,568],[390,844]]){
      const page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true});
      page.setDefaultTimeout(6000);
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      const key='catalog:tv:55LX1QKNA';
      let bedroomName='침실 TV';
      await page.route('**/api/my-appliances',r=>r.fulfill({json:{mode:'thinq',devices:[
        {id:'living',name:'거실 TV',category:'TV',modelCode:'55LX1QKNA'},
        {id:'study',name:'서재 TV',category:'TV',modelCode:'55LX1QKNA'},
        {id:'bed',name:bedroomName,category:'TV',modelCode:'55LX1QKNA'},
        {id:'bed',name:bedroomName,category:'TV',modelCode:'55LX1QKNA'}]}}));
      const tap=name=>page.getByRole('button',{name,exact:true}).tap();
      const state=key=>page.evaluate(k=>localStorage.getItem(k),key);
      const myKey='lg-miniroom.dot.my.thinq';
      const bag=page.locator('#routineBag'),units=bag.locator('.bag-unit');
      async function openBag(){
        await tap('인벤토리');await bag.getByRole('button',{name:'가전',exact:true}).tap();
        await bag.locator('[data-family="TV"]').tap();
      }
      await page.goto(base+'/editor?space=my');await openBag();
      const original=await state(myKey);
      const bedroom=units.filter({hasText:'침실 TV'});
      await bag.getByRole('button',{name:'침실 TV 제품 정보'}).tap();
      assert.match(await bag.locator('.bag-product-detail:visible').innerText(),/55LX1QKNA/);
      assert.equal(await state(myKey),original);
      await bedroom.tap();
      assert.ok(await bag.isHidden());
      assert.equal(await page.locator('#bagPlacementName').innerText(),'침실 TV');
      await page.locator('#view').press('ArrowRight');await tap('취소');assert.equal(await state(myKey),original);
      await openBag();
      await page.evaluate(()=>{
        const paint=DotScene.paint;
        DotScene.paint=function(ctx,room,tone,items,focus,...rest){
          if(focus&&document.body.classList.contains('placing-from-bag')){
            const at=DotScene.place(room,tone,focus);
            for(let y=at.y;y<at.y+at.s.h;y+=2)for(let x=at.x;x<at.x+at.s.w;x+=2){
              if(DotScene.hits(room,tone,items,x,y)[0]?.id!==focus.id)continue;
              window.pointerStart={x:x+.5,y:y+.5,ox:focus.x};
              return paint.call(this,ctx,room,tone,items,focus,...rest);
            }
          }
          return paint.call(this,ctx,room,tone,items,focus,...rest);
        };
      });
      await bedroom.tap();
      const p=await page.evaluate(async()=>{
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        const {x,y,ox}=window.pointerStart,canvas=document.querySelector('#scene');
        const rect=canvas.getBoundingClientRect(),scale=rect.width/canvas.width;
        return {x:rect.left+x*scale,y:rect.top+y*scale,scale,ox};
      });
      const touch=await page.context().newCDPSession(page);
      for(const [type,dx] of [['touchStart',0],['touchMove',16],['touchEnd',16]]){
        await touch.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x:p.x+dx*p.scale,y:p.y+dx*p.scale/2}]});
      }
      assert.equal(await state(myKey),original);await tap('여기에 놓기');
      await page.locator('#bagPlacement').waitFor({state:'hidden'});
      const placed=JSON.parse(await state(myKey)).layouts.B.filter(o=>o.k===key);
      assert.equal(placed.length,1);assert.equal(placed[0].deviceId,'bed');assert.notEqual(placed[0].x,p.ox);
      await page.reload();await openBag();await units.filter({hasText:'침실 TV'}).tap();
      assert.ok(await bag.isHidden());assert.match(await page.locator('#name').innerText(),/침실 TV/);await openBag();
      await units.filter({hasText:'거실 TV'}).tap();assert.equal(await page.locator('#bagPlacementName').innerText(),'거실 TV');await tap('취소');
      const scanned={id:'test-tv',modelCode:'55LX1QKNA',displayName:'포제 TV',category:'TV'};
      await page.goto(base+'/editor?'+new URLSearchParams({space:'dream',camera:'collect',lgcam:'registered',lgcam_item:JSON.stringify(scanned)}));
      await tap('인벤토리에 보관');await tap('인벤토리 닫기');
      const before=await state('dotroom');await openBag();await units.tap();
      assert.equal(await state('dotroom'),before);await page.reload();assert.equal(await state('dotroom'),before);
      await openBag();await units.tap();await tap('여기에 놓기');
      await page.locator('#bagPlacement').waitFor({state:'hidden'});
      await page.reload();await openBag();assert.match(await units.innerText(),/이 방에 1개 배치/);
      await bag.locator('.bag-info').tap();await tap('하나 더 놓기');await tap('여기에 놓기');
      await page.locator('#bagPlacement').waitFor({state:'hidden'});
      const dreamTVs=JSON.parse(await state('dotroom')).layouts.B.filter(o=>o.k===key);
      assert.equal(dreamTVs.length,2);
      assert.notEqual(dreamTVs[0].id,dreamTVs[1].id);
      const collection=await state('lg-miniroom.state');
      await openBag();await units.tap();await tap('B룸에서 보기 2');
      assert.ok(await bag.isHidden());
      const failNextLayoutWrite=()=>page.evaluate(()=>{
        const original=Storage.prototype.setItem;
        Storage.prototype.setItem=function(k,value){
          if(k==='dotroom'){Storage.prototype.setItem=original;throw Error('테스트 저장 공간 부족')}
          return original.call(this,k,value);
        };
      });
      const savedTVs=async()=>JSON.parse(await state('dotroom')).layouts.B.filter(o=>o.k===key);
      await failNextLayoutWrite();await tap('수납');
      assert.deepEqual(await savedTVs(),dreamTVs);
      assert.equal(await page.locator('#notice').innerText(),'저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
      await tap('수납');assert.deepEqual(await savedTVs(),[dreamTVs[0]]);
      await failNextLayoutWrite();await page.locator('#undo').tap();
      assert.deepEqual(await savedTVs(),[dreamTVs[0]]);
      await page.locator('#undo').tap();assert.deepEqual(await savedTVs(),dreamTVs);
      await page.reload();assert.deepEqual(await savedTVs(),dreamTVs);
      assert.equal(await state('lg-miniroom.state'),collection);
      const beforeBed=await state('dotroom');
      await tap('인벤토리');assert.ok(await bag.locator('[data-bag=furniture]').isHidden());
      await tap('인벤토리 닫기');assert.equal(await state('dotroom'),beforeBed);
      await tap('배치 편집');await tap('가구');await page.locator('#products [data-key=bed]').tap();
      await tap('배치 완료');await page.reload();
      assert.equal(JSON.parse(await state('dotroom')).layouts.B.filter(o=>o.k==='bed').length,1);
      await page.goto(base+'/editor?space=my');await tap('등록 가전');
      bedroomName='안방 TV';await tap('목록 새로고침');await openBag();
      const summary=n=>'등록 3대 · 배치 '+n+'대 · 배치 가능 '+(3-n)+'대';
      assert.equal(await units.count(),3);
      assert.equal(await bag.locator('.unit-summary').innerText(),summary(1));
      assert.equal(await units.filter({hasText:bedroomName}).locator('small').last().innerText(),'B룸에 배치됨');
      await tap('인벤토리 닫기');await tap('배치 편집');
      const undoButton=page.locator('#undo'),drawer=page.locator('#drawer');
      const undoPosition=await undoButton.boundingBox(),donePosition=await page.locator('#editMode').boundingBox();
      await tap('거실 TV');assert.equal(await page.locator('#count').innerText(),summary(2));
      assert.ok(await drawer.isHidden());
      assert.deepEqual(await undoButton.boundingBox(),undoPosition);
      assert.deepEqual(await page.locator('#editMode').boundingBox(),donePosition);
      assert.ok(await page.locator('#remove').isVisible());
      await tap('다른 제품 놓기');assert.ok(await drawer.isVisible());
      assert.equal(await page.locator('#products .card').first().getAttribute('data-unit'),'study');
      await page.locator('[data-room="A"]').tap();
      assert.equal(await page.locator('#products .card').first().getAttribute('data-unit'),'study');
      assert.equal(await page.locator('#drawerTitle').innerText(),'가전 · 배치 가능 1대');
      const located=page.locator('#products [data-unit="living"]');
      assert.match(await located.innerText(),/B룸에서 보기/);
      await located.tap();
      assert.equal(await page.locator('#rooms [aria-pressed=true]').getAttribute('data-room'),'B');
      assert.match(await page.locator('#name').innerText(),/거실 TV/);
      await page.locator('[data-room="A"]').tap();await openBag();
      const living=units.filter({hasText:'거실 TV'});
      assert.match(await living.innerText(),/B룸 찾기/);await living.tap();
      assert.ok(await bag.isHidden());
      assert.equal(await page.locator('#rooms [aria-pressed=true]').getAttribute('data-room'),'B');
      assert.match(await page.locator('#name').innerText(),/거실 TV/);
      await page.locator('[data-room="A"]').tap();await openBag();
      assert.equal(await bag.locator('.unit-summary').innerText(),summary(2));
      await units.filter({hasText:'서재 TV'}).tap();await tap('여기에 놓기');
      await page.locator('#bagPlacement').waitFor({state:'hidden'});
      const roomUnits=async()=>Object.values(JSON.parse(await state(myKey)).layouts).flat().filter(o=>o.deviceId).map(o=>o.deviceId).sort();
      assert.deepEqual(await roomUnits(),['bed','living','study']);
      assert.equal(await page.locator('#count').innerText(),summary(3));
      await tap('수납');assert.equal(await page.locator('#count').innerText(),summary(2));
      assert.deepEqual(await roomUnits(),['bed','living']);
      await page.locator('[data-room="B"]').tap();await tap('서재 TV');
      await page.locator('[data-room="A"]').tap();await page.locator('#undo').tap();
      assert.deepEqual(await roomUnits(),['bed','living','study']);
      const afterUndo=JSON.parse(await state(myKey)).layouts;
      assert.ok(afterUndo.B.some(o=>o.deviceId==='study'));
      assert.ok(!afterUndo.A.some(o=>o.deviceId==='study'));
      await page.reload();await openBag();assert.equal(await bag.locator('.unit-summary').innerText(),summary(3));
      // Older editors allowed the same ID to be saved in two layouts.
      const legacy=await page.evaluate(k=>{
        const raw=JSON.parse(localStorage.getItem(k));
        const duplicate={...raw.layouts.B.find(o=>o.deviceId==='bed'),id:900};
        raw.layouts.A.push(duplicate);raw.room='A';
        const value=JSON.stringify(raw);localStorage.setItem(k,value);return value;
      },myKey);
      await page.reload();await openBag();assert.equal(await bag.locator('.unit-summary').innerText(),summary(3));
      const migrated=JSON.parse(await state(myKey));
      assert.equal(migrated.layouts.A.find(o=>o.deviceId==='bed').id,900);
      assert.ok(!migrated.layouts.B.some(o=>o.deviceId==='bed'));
      assert.equal(await state(myKey+'.before-unit-limit'),legacy);
      assert.deepEqual(await roomUnits(),['bed','living','study']);
      assert.deepEqual(errors,[]);await page.context().close();
      console.log('PASS '+width+'x'+height+' three TVs, duplicates, cross-room limit, stow, undo, rename, refresh, legacy layout, dream isolation and touch drag');
    }
  }finally{await browser.close()}
}).catch(e=>{console.error(e);process.exitCode=1});
