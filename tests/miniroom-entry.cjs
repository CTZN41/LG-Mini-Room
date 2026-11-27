const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const withServer=require('./member-server.cjs');

withServer(async base=>{
  const browser=await chromium.launch({channel:'chrome'});
  try{
    const context=await browser.newContext({viewport:{width:360,height:780},isMobile:true,hasTouch:true});
    const page=await context.newPage();page.setDefaultTimeout(10000);
    const joined=await context.request.post(base+'/api/members/join',{headers:{'X-Miniroom':'1'},
      data:{name:'검수',username:'entry-check',password:'123456',nickname:'구름'}});
    assert.equal(joined.status(),201);
    for(const query of ['space=menu','space=menu&app=thinq']){
      const response=await context.request.get(base+'/editor?'+query,{maxRedirects:0});
      assert.equal(response.status(),302);assert.equal(response.headers().location,'/miniroom/home?space=dream');
    }
    for(const [space,link] of [['dream','#roomTab'],['my','#enter']]){
      await page.goto(base+'/miniroom/home?space='+space);
      await page.locator('#roomImage').waitFor();
      let release;
      const response=new Promise(resolve=>{release=resolve});
      const match='**/api/catalog/models*';
      await page.route(match,async route=>{await response;await route.continue()});
      try{
        await page.locator(link).tap();
        await page.waitForURL('**/editor?**');
        const legacy=await page.locator('.top h1, #drawer, .selection').evaluateAll(nodes=>
          nodes.filter(node=>node.checkVisibility()&&node.getClientRects().length).map(node=>node.id||node.className||node.tagName));
        assert.deepEqual(legacy,[],'old controls visible while catalog is loading');
        await page.getByRole('status',{name:'미니룸 열기'}).waitFor();
      }finally{release()}
      await page.locator('body.personal-browse #roomCards').waitFor();
      assert.equal(await page.locator('#roomEntry').isVisible(),false);
      await page.locator('#roomHud').waitFor();
      await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'miniroom-room-'+space+'.png')});
      assert.equal(await page.locator('#roomSide [aria-current=page]').innerText(),'미니룸');
      await page.locator('#sideInventory').tap();await page.locator('#routineBag[open] .close').tap();
      await page.locator('#bgm').tap();await page.locator('#music[open]').waitFor();
      assert.equal(await page.locator('#music .track').count(),4);
      await page.getByRole('button',{name:'BGM 닫기'}).tap();await page.locator('#music').waitFor({state:'hidden'});
      assert.equal(new URL(page.url()).searchParams.get('space'),space);
      await page.locator('#rooms button[data-room=B]').tap();await page.evaluate(()=>roomStorage.whenSynced());
      await page.locator('#editMode').tap();await page.getByRole('button',{name:'배치 완료'}).tap();
      await page.locator('#more').tap();await page.locator('#mini').tap();
      await page.waitForURL(base+'/miniroom/home?space='+space);
      await page.unroute(match);
      await page.locator('#roomImage').waitFor();await page.locator(link).tap();
      await page.locator('#rooms [data-room=B][aria-pressed=true]').waitFor();
      console.log('PASS slow entry, menu return and saved room:',space);
    }
    await page.route('**/api/catalog/models*',route=>route.fulfill({status:503,body:'unavailable'}));
    await page.reload();await page.getByRole('button',{name:'다시 시도'}).waitFor();
    assert.equal(await page.locator('#drawer').isVisible(),false);
    await page.unroute('**/api/catalog/models*');await page.getByRole('button',{name:'다시 시도'}).tap();
    await page.locator('#rooms [data-room=B][aria-pressed=true]').waitFor();
    console.log('PASS catalog error and retry');
    await page.goto(base+'/editor?space=dream&app=thinq&observe=1');
    await page.locator('#more').tap();await page.locator('#mini').tap();
    await page.getByRole('button',{name:'드림룸 들어가기'}).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('observe'),'1');
  }finally{await browser.close()}
}).catch(e=>{console.error(e);process.exitCode=1});
