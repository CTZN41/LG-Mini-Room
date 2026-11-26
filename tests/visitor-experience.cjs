const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:4185';
const tvKey='catalog:tv:55LX1QKNA';
async function verify(browser,width,height,userAgent){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce',userAgent});
  const page=await context.newPage(), errors=[],calls=[];
  page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>calls.push(r.url()));
  try{
    await page.goto(base+'/experience/qr?observe=1');
    const link=page.locator('#entry');
    assert.equal(await link.getAttribute('href'),base+'/experience?observe=1');
    await page.locator('#qr svg').waitFor();
    await page.locator('#qr svg').screenshot({path:require('node:path').join(require('node:os').tmpdir(),'miniroom-phase2-qr.png')});
    const original={'dotroom':'{"room":"C","layouts":{"C":[{"id":1,"k":"sofa"}]}}','lg-miniroom.dot.my':'old-my-layout','lg-miniroom.state':'old-collection-and-routines','lg-miniroom.discovered.movie-night':'collection'};
    await page.evaluate(data=>Object.entries(data).forEach(([k,v])=>localStorage.setItem(k,v)),original);
    await link.tap();
    const button=name=>page.getByRole('button',{name,exact:true});
    await page.locator('#tvCard').tap();
    const tv={id:2,k:tvKey,x:6,y:48,turn:3,f:1,e:0};
    async function hit(item){
      return page.evaluate(o=>{
        const c=document.querySelector('#scene'),r=c.getBoundingClientRect(),l=DotScene.place('B','pink',o);
        const scale=Math.min(r.width/c.width,r.height/c.height);
        for(let yy=Math.floor(l.s.h*.35);yy<l.s.h;yy++)for(let xx=2;xx<l.s.w-1;xx++){
          let x=l.x+xx+.5,y=l.y+yy+.5;
          if(DotScene.hits('B','pink',[o],x,y).length)return [r.left+(r.width-c.width*scale)/2+(x-12)*scale,r.top+(r.height-c.height*scale)/2+(y-8)*scale];
        }
      },item);
    }
    await page.touchscreen.tap(...await hit(tv));
    await button('영화 보기').waitFor();
    const pixels=()=>page.locator('#scene').evaluate(c=>c.toDataURL());
    let before=await pixels();await button('영화 보기').tap();
    assert.ok(!(await page.locator('#hint').innerText()).includes('30%'));
    assert.notEqual(await pixels(),before);await page.goBack();await button('영화 보기').waitFor();assert.equal(await pixels(),before);
    await button('가전 놓기').tap();await page.locator('#lampCard').tap();
    const cdp=await context.newCDPSession(page);
    const [x,y]=await hit(tv);before=await pixels();
    for(const [type,dx,dy] of [['touchStart',0,0],['touchMove',8,4],['touchMove',16,8],['touchEnd',16,8]]){
      await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x:x+dx,y:y+dy}]});
    }
    assert.notEqual(await pixels(),before,'touch drag changes scene');
    await page.touchscreen.tap(x+16,y+8);await button('제품 상세').tap();
    assert.equal(await page.locator('#detail img').evaluate(im=>im.complete&&im.naturalWidth>0),true);
    assert.match(await page.locator('#detail').innerText(),/55LX1QKNA/);
    const expected=/Android/.test(userAgent)?'https://play.google.com/':'https://apps.apple.com/';
    assert.ok((await page.locator('#detail a').getAttribute('href')).startsWith(expected));
    await button('제품 상세 닫기').tap();before=await pixels();
    await button('영화 보기').tap();assert.match(await page.locator('#hint').innerText(),/조명 밝기 30%/);assert.notEqual(await pixels(),before);
    await button('미리보기 닫기').tap();await button('영화 보기').waitFor();assert.equal(await pixels(),before);
    await button('체험 마치기').tap();
    const destination=page.locator('#controls a');
    const target=await destination.getAttribute('href');assert.ok(target.startsWith(expected));
    // Verify user-initiated navigation without sending test traffic to an app store.
    await context.route(target,r=>r.fulfill({contentType:'text/html',body:'Store'}));
    const opened=context.waitForEvent('page');await destination.tap();
    const store=await opened;await store.waitForURL(target);await store.close();
    const report=page.waitForEvent('download');await page.locator('#export').tap();
    const download=await report;const exported=JSON.parse(require('node:fs').readFileSync(await download.path(),'utf8'));
    assert.equal(new Set(exported.events.map(e=>e.sessionId)).size,1);assert.equal(exported.events.at(-1).event,'thinq_clicked');
    const events=await page.evaluate(()=>JSON.parse(sessionStorage['lg-miniroom.guest.events']));
    for(const name of ['guest_entered','product_placed','routine_offered','routine_opened','product_detail_opened','preview_started','preview_ended','guest_finished','thinq_clicked'])assert.ok(events.some(e=>e.event===name),name);
    await page.goto(base+'/experience');await page.locator('#tvCard').waitFor();
    assert.match(await page.locator('#tvCard').innerText(),/방에 놓기/);assert.match(await page.locator('#lampCard').innerText(),/방에 놓기/);
    assert.deepEqual(await page.evaluate(()=>({...localStorage})),original);
    assert.ok(!calls.some(s=>s.startsWith(base+'/api/')));assert.deepEqual(errors,[]);
    assert.ok(await page.locator('#tvCard').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight));
    console.log('PASS',width,height,'touch placement, model, TV-only and TV+lamp previews, restore, store link, fresh visit, storage isolation');
  }finally{await context.close()}
}
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
  await verify(browser,320,568,'Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36');
  await verify(browser,390,844,'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile Safari/604.1');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
