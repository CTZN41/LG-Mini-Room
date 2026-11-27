const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const withServer=require('./member-server.cjs');

withServer(async base=>{
  const browser=await chromium.launch({channel:'chrome'});
  try{
    for(const [width,height] of [[320,568],[390,844]]){
      const page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true});
      try{
        const errors=[];
        page.on('pageerror',err=>errors.push(err.message));
        let now='2026-11-27T03:00:00.000Z',rain=false,age=0,offline=false,requested='';
        await page.clock.install({time:new Date(now)});
        await page.route('**/api/routine-context?**',route=>{
          requested=new URL(route.request().url()).searchParams.get('place');
          return offline?route.abort():route.fulfill({json:{now:"2020-01-01T00:00:00Z",placeId:requested,
            weather:{temperature:15.2,raining:rain,observedAt:new Date(Date.parse(now)-age).toISOString()}}});
        });
        await page.goto(base+'/editor?space=dream');
        const view=page.locator('#view'),button=page.locator('#overview');
        const ready=async(period,weather)=>page.locator('#view[data-period='+period+'][data-weather='+weather+']').waitFor();
        await ready('day','dry');assert.equal(requested,'seoul-jongno');
        await page.locator('#view[data-zoom]').waitFor();
        const previousTime=await page.locator('#environmentLabel').innerText();
        await page.clock.fastForward(2000);
        assert.notEqual(await page.locator('#environmentLabel').innerText(),previousTime);
        assert.match(await page.locator('#environmentLabel').innerText(),/^12:00:\d{2}/);
        assert.equal(await view.getAttribute('data-zoom'),'1.12');
        assert.equal(await page.locator('[data-tone],#wallView,#scale').count(),0);
        assert.equal(await page.locator('.camera button:visible').count(),1);
        assert.ok((await page.locator('#scanDream').boundingBox()).width>=width-24);
        assert.ok(await page.locator('#libraryButton').isHidden());
        await button.tap();assert.equal(await view.getAttribute('data-zoom'),'1');
        const rect=await view.boundingBox();assert.equal(rect.height,height);
        assert.ok(await page.locator('#scanDream').isHidden());
        await page.getByRole('button',{name:'확대',exact:true}).tap();
        assert.ok(Number(await view.getAttribute('data-zoom'))>1);
        await page.getByRole('button',{name:'축소',exact:true}).tap();
        const cdp=await page.context().newCDPSession(page);
        for(const [type,dist] of [['touchStart',26],['touchMove',45],['touchMove',65],['touchEnd',0]]){
          await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:
            [-1,1].map((side,i)=>({x:width/2+dist*side,y:height/2,id:i+1}))});
        }
        assert.ok(Number(await view.getAttribute('data-zoom'))>1.5);
        await button.tap();assert.equal(await view.getAttribute('data-zoom'),'1.12');
        await page.evaluate(async()=>{const model=await import('/state.js');model.update(s=>{s.weatherPlace='jeju-si'})});
        now='2026-11-27T13:00:00.000Z';rain=true;await page.clock.setSystemTime(new Date(now));await page.reload();await ready('night','rain');
        assert.equal(requested,'jeju-si');assert.match(await page.locator('#environmentLabel').innerText(),/22:00:\d{2} · 비/);
        age=96*60*1000;await page.reload();await ready('night','unknown');
        assert.doesNotMatch(await page.locator('#environmentLabel').innerText(),/비|°/);
        offline=true;await page.reload();await page.locator('#view[data-weather=unknown]').waitFor();
        assert.match(await page.locator('#environmentLabel').getAttribute('title'),/날씨 확인 대기/);
        assert.deepEqual(errors,[]);console.log('PASS',width,height,'preview, full-room fit, zoom buttons, pinch, camera action, local weather, stale and unavailable readings');
      }finally{await page.close()}
    }
  }finally{await browser.close()}
}).catch(err=>{console.error(err);process.exitCode=1});
