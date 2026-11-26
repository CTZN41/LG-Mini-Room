const assert=require('node:assert/strict');
const {readFile}=require('node:fs/promises');
const {chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:4173';

async function exercise(browser,viewport){
  const page=await browser.newPage({viewport,isMobile:viewport.width<700,hasTouch:true});
  page.setDefaultTimeout(6000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const button=name=>page.getByRole('button',{name,exact:true});
  const layout=()=>page.evaluate(()=>JSON.parse(localStorage.dotroom));
  const events=()=>page.evaluate(()=>JSON.parse(sessionStorage['lg-miniroom.events']));
  const ac=data=>data.layouts[data.room].find(o=>o.k==='tower_ac');
  await page.goto(base+'/editor?space=dream&observe=1');
  await button('가전 수집').tap();
  const last=page.locator('#libraryItems button').last();
  await last.scrollIntoViewIfNeeded();
  const scroll=await page.locator('#library').evaluate(el=>el.scrollTop);
  await last.tap();await button('계속 수집').tap();
  assert.ok(Math.abs((await page.locator('#library').evaluate(el=>el.scrollTop))-scroll)<=2);
  await button('타워 에어컨 수집').tap();
  assert.ok(!ac(await layout()));
  await button('방에 놓기').tap();
  assert.ok(await button('배치 완료').isVisible());
  assert.match(await page.locator('#name').innerText(),/타워 에어컨/);
  assert.ok(ac(await layout()));
  assert.equal((await events()).some(e=>e.event.startsWith('routine_')),false);
  const added=(await events()).filter(e=>e.event==='collection_added');
  assert.equal(added.length,2);
  assert.equal(added[1].productKey,'tower_ac');assert.equal('templateId' in added[1],false);

  await page.locator('#up').tap();assert.equal(ac(await layout()).e,1);
  await page.locator('#down').tap();await page.locator('#flip').tap();
  assert.equal(ac(await layout()).turn,1);
  await page.locator('#duplicate').tap();await page.locator('#remove').tap();
  await page.locator('#undo').tap();assert.equal((await layout()).layouts.B.filter(o=>o.k==='tower_ac').length,2);
  await page.locator('#undo').tap();assert.equal((await layout()).layouts.B.filter(o=>o.k==='tower_ac').length,1);
  const saved=await layout();
  const scenes=new Set();
  for(const r of ['A','B','C']){
    await page.locator('[data-room='+r+']').tap();
    for(const tone of ['pink','lime']){
      await page.locator('[data-tone='+tone+']').tap();
      scenes.add(await page.locator('#scene').evaluate(c=>c.toDataURL()));
    }
  }
  assert.equal(scenes.size,6);await page.locator('[data-room=B]').tap();
  await page.locator('#in').tap();assert.notEqual(await page.locator('#scale').innerText(),'100%');
  await page.locator('#overview').tap();
  await page.reload();assert.deepEqual(ac(await layout()),ac(saved));
  await button('배치 편집').waitFor();

  // Use the public canvas keyboard navigation so the product interaction opens through the UI.
  await page.locator('#view').focus();
  for(let i=0;i<8;i++){
    await page.keyboard.press('ArrowRight');
    if((await page.locator('#keyboardTarget').textContent()).includes('타워 에어컨'))break;
  }
  assert.match(await page.locator('#keyboardTarget').textContent(),/타워 에어컨/);
  await page.keyboard.press('Enter');assert.equal(await page.locator('#lifeTitle').innerText(),'타워 에어컨');
  assert.equal(await page.locator('#lifeDetail').innerText(),'');
  assert.equal((await events()).some(e=>e.event==='routine_opened'),false);
  await button('쾌적한 방').tap();assert.equal(await page.locator('#lifeTitle').innerText(),'쾌적한 방');
  await button('미리보기').tap();assert.match(await page.locator('#lifeDetail').textContent(),/냉방/);
  await button('재생 종료').tap();
  assert.ok((await events()).some(e=>e.event==='routine_opened'&&e.templateId==='room-comfort'));
  await page.locator('#more').tap();
  const dl=page.waitForEvent('download');await page.locator('#observationFile').tap();
  const exported=JSON.parse(await readFile(await (await dl).path(),'utf8')).events;
  assert.deepEqual(exported,await events());
  const json=page.waitForEvent('download');await page.locator('#saveFile').tap();
  const backup=JSON.parse(await readFile(await (await json).path(),'utf8'));assert.deepEqual(backup,await layout());
  await page.locator('#shot').tap();
  const png=page.waitForEvent('download');await page.locator('#download').tap();
  assert.deepEqual([...(await readFile(await (await png).path())).subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.deepEqual(errors,[]);await page.context().close();
  console.log('PASS '+viewport.width+'x'+viewport.height+' collect, continue, place, edit, six themes, reload, comfort routine and exported JSON/PNG');
}
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
  for(const viewport of [{width:320,height:568},{width:390,height:844},{width:1150,height:750}])await exercise(browser,viewport);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
