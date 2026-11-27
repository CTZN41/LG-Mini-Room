const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const withServer=require('./member-server.cjs');
const join=require('./support/join.cjs');

async function check(base,browser, width, height) {
  const page = await browser.newPage({viewport:{width,height}, isMobile:true, hasTouch:true});
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror',error => errors.push(error.message));
  page.on('response',response => { if (response.status() >= 400) errors.push(response.url()); });
  const nav = page.getByRole('navigation',{name:'ThinQ 하단 메뉴'});
  const tab = name => nav.getByRole('link',{name,exact:true});
  async function checkNav(name) {
    await nav.waitFor();
    assert.deepEqual(await nav.getByRole('link').allTextContents(),['홈','디바이스','마이룸','케어','메뉴']);
    assert.equal(await tab(name).getAttribute('aria-current'),'page');
    for (const link of await nav.getByRole('link').all()) {
      const r = await link.boundingBox();
      assert.ok(r.width >= 44 && r.height >= 44 && r.x >= 0 && r.y+r.height <= height+1);
    }
  }
  const myState = () => page.evaluate(() => roomStorage.getItem('lg-miniroom.dot.my'));
  try {
    await join(page,base,'nav-'+width);await page.goto(base);
    await checkNav('홈');
    assert.ok(await page.locator('.home-art').evaluate(img => img.complete && img.naturalWidth > 0));
    for (const name of ['디바이스','케어','메뉴']) { await tab(name).tap(); await checkNav(name); }
    await page.getByRole('link',{name:'LG 미니룸'}).tap();
    await page.waitForURL('**/editor?space=dream&app=thinq');
    await checkNav('마이룸');
    await tab('홈').tap();await tab('마이룸').tap();
    await page.waitForURL('**/editor?space=dream&app=thinq');await page.locator('#myLink').tap();
    await page.waitForURL('**/editor?space=my&app=thinq');
    await page.getByRole('button',{name:'체험용 기기 사용',exact:true}).tap();
    const button = name => page.getByRole('button',{name,exact:true});
    await button('＋ 추가').waitFor();
    assert.equal(await page.getByLabel('재생할 TV').count(),0);
    await button('배치 편집').tap();
    await button('배치 완료').tap();
    await button('＋ 추가').tap();await button('영화 보기 연결').tap();
    await page.getByLabel('재생할 TV').selectOption('my-tv-1');
    await page.getByRole('button',{name:'미리보기',exact:true}).tap();
    await page.getByRole('button',{name:'내 루틴에 저장',exact:true}).tap();
    await page.getByRole('button',{name:'＋ 추가',exact:true}).waitFor();
    const before = JSON.parse(await myState()).layouts.B.length;
    await page.getByRole('button',{name:'배치 편집',exact:true}).tap();
    await page.locator('#products .card').first().tap();
    await page.getByRole('button',{name:'배치 완료',exact:true}).tap();
    assert.equal(JSON.parse(await myState()).layouts.B.length,before+1);
    await page.locator('[data-tone=lime]').tap();
    await page.evaluate(()=>roomStorage.whenSynced());const layout = await myState();
    assert.equal(JSON.parse(layout).theme,'lime');
    await checkNav('마이룸');
    const scene = await page.locator('#view').boundingBox();
    const bar = await nav.boundingBox();
    assert.ok(scene.height > 80 && scene.y+scene.height <= bar.y);
    await tab('홈').tap();
    await checkNav('홈');
    await page.goBack();
    await checkNav('마이룸');
    await page.reload();
    await page.getByRole('button',{name:'＋ 추가',exact:true}).waitFor();
    assert.equal(await myState(), layout);
    await tab('메뉴').tap(); await checkNav('메뉴'); await tab('마이룸').tap();
    await checkNav('마이룸');await page.locator('#myLink').tap();await page.waitForURL('**/editor?space=my&app=thinq');await button('＋ 추가').waitFor();
    assert.equal(await myState(),layout);
    assert.deepEqual(errors,[]);
    console.log(width+'×'+height+' passed menus, room entry, movie save and restore');
  } finally { await page.context().close(); }
}
async function checkImportedEntry(base,browser,width,height){
  const p=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const button=name=>p.getByRole('button',{name,exact:true});
  const tap=name=>button(name).tap();
  p.setDefaultTimeout(8000);
  try{
    await join(p,base,'import-'+width);await p.goto(base+'/editor?space=dream&app=thinq');
    await tap('가전 수집');
    await p.locator('#libraryItems [data-product="catalog:robot:R560BL1"] button').tap();
    await tap('방에 놓기');await tap('배치 완료');
    const point=await p.evaluate(()=>{
      const s=JSON.parse(roomStorage.getItem('dotroom')),items=DotScene.sorted(s.room,s.layouts[s.room]);
      const robot=items.find(o=>o.k==='catalog:robot:R560BL1');
      const q=DotScene.place(s.room,s.theme,robot),canvas=document.querySelector('#scene');
      const r=canvas.getBoundingClientRect(),scale=r.width/canvas.width;
      for(let y=2;y<q.s.h-2;y++)for(let x=2;x<q.s.w-2;x++){
        const px=q.x+x,py=q.y+y;
        if([[0,0],[-2,0],[2,0],[0,2],[0,-2]].every(([dx,dy])=>DotScene.hits(s.room,s.theme,items,px+dx,py+dy)[0]===robot))
          return [r.x+(px+.5)*scale,r.y+(py+.5)*scale];
      }
      throw Error('로봇청소기 터치 지점을 찾지 못했습니다.');
    });
    await p.touchscreen.tap(...point);await tap('청소 시간');await tap('미리보기');await tap('내 방에 맞추기');
    await button('방 둘러보기').waitFor();
    assert.equal(await p.locator('#lifeTitle').innerText(),'청소 시간 연결');
    const entry=p.url();
    await tap('방 둘러보기');await p.reload();await button('체험용 기기 사용').waitFor();
    assert.equal(await p.locator('#lifeTitle').innerText(),'마이룸');
    assert.ok(!new URL(p.url()).searchParams.has('connect'));
    await p.goto(entry);await button('방 둘러보기').waitFor();await p.reload();await tap('체험용 기기 사용');
    await button('체험용 로봇청소기 배치').waitFor();
    assert.equal(await p.locator('#lifeTitle').innerText(),'청소 시간');
    assert.equal(await p.getByLabel('재생할 TV').count(),0);
    await p.reload();await button('＋ 추가').waitFor();
    await p.goto(entry);await button('체험용 로봇청소기 배치').waitFor();
    assert.equal(await button('체험용 기기 사용').count(),0);
    await p.goto(base+'/editor?space=my&connect=1&template=unknown-template');
    await button('＋ 추가').waitFor();
    assert.equal(await p.getByLabel('재생할 TV').count(),0);
    let devices=[];
    await p.route('**/api/my-appliances',route=>route.fulfill({json:{mode:'thinq',devices}}));
    await p.goto(base+'/editor?space=my&app=thinq');await button('＋ 추가').waitFor();
    await button('등록 가전 열기').waitFor();
    assert.equal(await button('체험용 기기 사용').count(),0);
    devices=[{id:'registered-tv',name:'내 TV',category:'TV',modelCode:'55LX1QKNA'}];
    await p.reload();await button('＋ 추가').waitFor();
    assert.match(await p.locator('#lifeDetail').innerText(),/첫 루틴을 만들어/);
    await p.goto(base+'/editor?space=my&app=thinq&connect=1');await p.getByLabel('재생할 TV').waitFor();
    await p.getByLabel('재생할 TV').selectOption('registered-tv');await tap('방 둘러보기');
    await p.reload();await button('＋ 추가').waitFor();
    assert.equal(await p.getByLabel('재생할 TV').count(),0);
    console.log(width+'×'+height+' passed Dream Room import, cancel, refresh, existing and empty account entry');
  }finally{await p.context().close()}
}
withServer(async base => {
  const browser = await chromium.launch({channel:'chrome'});
  try { for (const size of [[320,568],[390,844]]) {await check(base,browser,...size);await checkImportedEntry(base,browser,...size);} }
  finally { await browser.close(); }
}).catch(error => { console.error(error); process.exitCode=1; });
