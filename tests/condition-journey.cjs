const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const withServer=require('./member-server.cjs');
withServer(async base=>{
  const browser=await chromium.launch({channel:'chrome'});
  try{
    for(const [width,height] of [[320,568],[390,844]]){
      const page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
      page.setDefaultTimeout(14000);
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      const tap=name=>page.getByRole('button',{name,exact:true}).tap();
      const record=()=>page.evaluate(()=>JSON.parse(localStorage['lg-miniroom.state']).savedRoutines);
      try{
        await page.goto(base+'/editor?space=my');await tap('조명 한 대로 체험');
        await tap('＋ 추가');await tap('직접 만들기');await page.getByLabel('루틴 이름').fill('침실 조명 루틴');
        await page.getByRole('combobox',{name:'침실 조명',exact:true}).selectOption('light-off');
        await tap('미리보기');await tap('내 루틴에 저장');await tap('조건 설정');
        const original=await record();
        await page.getByLabel('요일과 시각').check();await page.getByLabel('한국 시각').fill('18:00');
        await page.getByLabel('바깥 기온이 설정값 이상').check();
        await tap('조건 저장');assert.match(await page.locator('#conditionStatus').innerText(),/지역/);
        await page.locator('#conditionArea').selectOption('seoul-jongno');await tap('조건 저장');
        await page.locator('#conditionDialog').waitFor({state:'hidden'});
        const configured=await record();
        assert.deepEqual(configured,[{...original[0],condition:{time:'18:00',days:'weekday',minTemp:28}}]);
        await page.reload();await tap('조건 설정');assert.equal(await page.locator('#conditionArea').inputValue(),'seoul-jongno');
        await tap('조건 닫기');
        await tap('동작 수정');await tap('미리보기');await tap('내 루틴에 저장');await tap('조건 설정');
        assert.deepEqual((await record())[0].condition,configured[0].condition);
        const rule=configured[0].condition;
        const {evaluateRule}=await import('../public/routine-conditions.mjs');
        let now='2026-11-27T09:00:00Z',weather={temperature:28,raining:true,observedAt:now};
        await page.route('**/api/routine-context?**',route=>{
          const params=new URL(route.request().url()).searchParams;
          assert.equal(params.get('place'),'seoul-jongno');assert.deepEqual(JSON.parse(params.get('rule')),rule);
          const context={now,weather,placeId:'seoul-jongno',source:'kma'};
          return route.fulfill({json:{...context,check:evaluateRule(rule,context)}});
        });
        const check=()=>tap('지금 조건 확인');
        const message=page.locator('#conditionStatus');
        await check();await message.getByText(/조건 맞음/).waitFor();
        assert.match(await message.innerText(),/서울 종로구 · 기상청 관측/);
        assert.equal(await page.getByRole('button',{name:'재생 종료',exact:true}).count(),0);
        weather.temperature=27.9;await tap('방에서 가상 실행');
        await message.getByText(/아직 안 맞음/).waitFor();assert.ok(await page.locator('#conditionRun').isHidden());
        weather.observedAt='2026-11-27T07:00:00Z';await check();
        await message.getByText(/날씨 확인 대기/).waitFor();
        weather={observedAt:now,temperature:28,raining:true};await check();await tap('방에서 가상 실행');
        await tap('재생 종료');await tap('조건 설정');assert.deepEqual(await record(),configured);
        await page.unroute('**/api/routine-context?**');
        await tap('조건 해제');await page.locator('#conditionDialog').waitFor({state:'hidden'});
        assert.deepEqual(await record(),original);
        await tap('침실 조명 루틴');await tap('재생 종료');
        assert.deepEqual(errors,[]);console.log('PASS',width,height,'save/edit/reload, match/miss/stale, recheck on play, virtual run, remove condition and manual replay');
      }catch(e){console.error(errors,page.url());throw e}finally{await page.context().close()}
    }
  }finally{await browser.close()}
}).catch(e=>{console.error(e);process.exitCode=1});
