const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const {tmpdir} = require('node:os');
const path = require('node:path');
const withServer = require('./member-server.cjs');

withServer(async base => {
  const browser = await chromium.launch({channel:'chrome'});
  try {
    for (const [width,height] of [[320,568],[360,780],[390,844]]) {
      const context = await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => { if (r.status() >= 400 && new URL(r.url()).origin === base) errors.push(r.url()); });
      async function screen(id, control) {
        await control.waitFor();
        const box = await control.boundingBox();
        assert.ok(box.x >= 0 && box.y >= 0 && box.x+box.width <= width+1 && box.y+box.height <= height+1, id+' outside viewport');
        assert.ok(await page.evaluate(()=>[...document.images].every(i=>i.complete && i.naturalWidth)));
        if (width === 360) await page.screenshot({path:path.join(tmpdir(),'miniroom-first-'+id+'.png')});
      }
      const link = name => page.getByRole('link',{name,exact:true});
      const button = name => page.getByRole('button',{name,exact:true});
      await page.goto(base);
      await page.evaluate(()=>localStorage.setItem('miniroom.intro.v1','1')); // Previously completed on the old version.
      await page.reload();
      await screen('devices',page.locator('.room-invite'));
      await page.locator('.room-invite').tap();
      await screen('door',link('문 열고 들어가기'));
      await link('다음에 할게요').tap();
      await link('마이룸').tap();
      await link('문 열고 들어가기').tap();
      await page.locator('#loading').waitFor();
      for (const [name,action] of [['놓아 보기','다음'],['살아 보기','다음'],['가져와 쓰기','내 미니룸 만들기']]) {
        await page.getByRole('heading',{name,exact:true}).waitFor();
        await screen(name,button(action));
        await button(action).tap();
      }
      await screen('login',button('로그인'));
      await page.goto(base+'/miniroom/start');
      await link('문 열고 들어가기').waitFor();
      const target = '/editor?space=my&app=thinq';
      await page.goto(base+target);
      await link('문 열고 들어가기').tap();
      await button('건너뛰기').tap();
      await link('미니룸 소개 다시 보기').tap();
      await link('문 열고 들어가기').tap();
      await button('건너뛰기').tap();
      assert.equal(new URL(page.url()).searchParams.get('next'),target);
      await button('회원가입').tap();
      for (const [name,value] of Object.entries({name:'시험',nickname:'테스트',username:'intro-'+width,password:'012345'})) {
        await page.locator('#join [name='+name+']').fill(value);
      }
      await button('가입하고 시작하기').tap();
      await page.waitForURL(base+target);
      await page.goto(base+'/?tab=devices');
      for (const entry of [page.locator('.room-invite'),link('마이룸')]) {
        await entry.tap();
        await link('문 열고 들어가기').tap();
        await button('건너뛰기').tap();
        await page.waitForURL(base+'/miniroom/home?space=dream');
        await page.goto(base+'/?tab=devices');
      }
      assert.deepEqual(errors,[]);
      await context.close();
      console.log('PASS Devices → onboarding → login, skip/replay, signup, deep link, returning member',width,height);
    }
  } finally {await browser.close();}
}).catch(e=>{console.error(e);process.exitCode=1});
