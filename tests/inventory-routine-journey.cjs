const tapItem=require('./support/tap-room-item.cjs');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const withServer=require('./member-server.cjs');

withServer(async base=>{
  const browser=await chromium.launch({channel:'chrome'});
  try{
    for(const [width,height] of [[320,568],[390,844]]){
      const page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
      page.setDefaultTimeout(6500);
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      let devices=['거실 TV','침실 TV','서재 TV'].map((name,i)=>({id:'tv'+i,name,category:'TV',modelCode:'55LX1QKNA'}));
      devices.push({id:'lamp',name:'거실 조명',category:'조명'});
      await page.route('**/api/my-appliances',r=>r.fulfill({json:{mode:'thinq',devices}}));
      const tap=name=>page.getByRole('button',{name,exact:true}).tap();
      const bindings=()=>page.evaluate(()=>JSON.parse(localStorage['lg-miniroom.state.thinq']).savedRoutines);
      await page.goto(base+'/editor?space=my');await tap('인벤토리');
      await tap('TV 골라 놓기');
      const picker=page.getByLabel('재생할 TV');
      await picker.selectOption('tv1');await tap('거실 조명 방에 놓기');await tap('여기에 놓기');
      assert.equal(await picker.inputValue(),'tv1');
      await tap('침실 TV 방에 놓기');await tap('취소');
      assert.ok(await page.getByRole('button',{name:'미리보기',exact:true}).isDisabled());
      await tap('침실 TV 방에 놓기');await tap('여기에 놓기');
      assert.equal(await picker.inputValue(),'tv1');
      await tap('미리보기');await tap('내 루틴에 저장');
      await page.getByRole('button',{name:'＋ 추가',exact:true}).waitFor();
      const [record]=await bindings();
      assert.deepEqual(record.bindings,{'tv-on':'tv1','light-dim':'lamp'});
      assert.equal(record.exclusions['curtain-close'],'no_device');
      // All three entry points read the same saved binding, including after TV replacement.
      async function checkEntrypoints(id,name){
        await tap('인벤토리');await tap('저장한 연결 보기');
        assert.equal(await picker.inputValue(),id);await tap('방 둘러보기');
        await tap('영화 보기');assert.match(await page.locator('#lifeDetail').innerText(),new RegExp(name));await tap('재생 종료');
        await tap('인벤토리');const bag=page.locator('#routineBag');
        assert.ok(await bag.locator('[data-bag=furniture]').isHidden());await tap('인벤토리 닫기');
        const layoutKey='lg-miniroom.dot.my.thinq';
        const sofaId=await page.evaluate(key=>{
          const r=JSON.parse(localStorage.getItem(key));return r.layouts[r.room].find(o=>o.k==='sofa').id;
        },layoutKey);
        await tapItem(page,sofaId,layoutKey);
        assert.match(await page.locator('#lifeDetail').innerText(),new RegExp(name+'.*커튼 제외'));
        await tap('영화 보기');await tap('재생 종료');await tap('닫기');
      }
      await page.reload();await checkEntrypoints('tv1','침실 TV');
      await tap('인벤토리');const bag=page.locator('#routineBag');
      await bag.getByRole('button',{name:'가전',exact:true}).tap();
      await bag.locator('[data-family="TV"]').tap();
      await bag.locator('.bag-unit').filter({hasText:'침실 TV'}).tap();
      await tap('수납');await tap('배치 완료');await tap('침실 TV 다시 놓기');
      assert.equal(await page.locator('#bagPlacementName').innerText(),'침실 TV');
      await tap('취소');await tap('침실 TV 다시 놓기');
      assert.deepEqual((await bindings())[0],record);
      await tap('여기에 놓기');await tap('영화 보기');
      assert.match(await page.locator('#lifeDetail').innerText(),/침실 TV.*조명 30%/);
      await tap('재생 종료');assert.deepEqual((await bindings())[0],record);
      await tap('배치 편집');await page.locator('[data-room="A"]').tap();await tap('배치 완료');
      await tap('B룸에서 침실 TV 보기');await tap('영화 보기');
      assert.match(await page.locator('#lifeDetail').innerText(),/침실 TV.*조명 30%/);
      await tap('재생 종료');assert.deepEqual((await bindings())[0],record);
      devices=devices.filter(d=>d.id!=='tv1');
      await page.reload();await tap('TV 다시 연결');await page.getByLabel('대체 TV').selectOption('tv0');
      await tap('거실 TV 방에 놓기');await tap('여기에 놓기');await tap('연결하고 재생');
      await tap('재생 종료');await page.reload();await checkEntrypoints('tv0','거실 TV');
      const records=await bindings();
      assert.equal(records.length,1);assert.deepEqual(records[0].bindings,{'tv-on':'tv0','light-dim':'lamp'});
      assert.equal(records[0].exclusions['curtain-close'],'no_device');
      await page.route('**/api/my-appliances',r=>r.fulfill({status:503,body:'unavailable'}));
      await page.reload();await tap('인벤토리');
      await bag.getByText('영화 보기 · 이 방의 배치',{exact:true}).waitFor();
      assert.match(await bag.locator('article').first().innerText(),/확인 필요/);
      assert.deepEqual(await bindings(),records);
      await bag.getByRole('button',{name:'닫기',exact:false}).first().tap();
      assert.equal(await page.getByRole('button',{name:'TV 다시 연결',exact:true}).count(),0);
      await page.unroute('**/api/my-appliances');
      await page.route('**/api/my-appliances',r=>r.fulfill({json:{mode:'thinq',devices}}));
      await tap('목록 다시 불러오기');await tap('영화 보기');
      assert.match(await page.locator('#lifeDetail').innerText(),/거실 TV.*조명 30%/);
      assert.deepEqual(await bindings(),records);
      assert.deepEqual(errors,[]);
      console.log('PASS',width,height,'movie placement, stow, inventory/shelf/sofa replay, TV replacement, refresh and unavailable home');
      await page.context().close();
    }
  }finally{await browser.close()}
}).catch(e=>{console.error(e);process.exitCode=1});
