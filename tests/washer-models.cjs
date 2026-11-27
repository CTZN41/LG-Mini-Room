const {expectedTitle}=require('./catalog-room-title.cjs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:4173';
const codes = ['WL2521WDUR', 'FG19WNR', 'TR10MV4', 'W20GEAN', 'W2320GEANR'];
const secondShelf = ['FC2521EQ6C', 'FX25WSQX', 'F21VDSKR', 'TR15WV5'];
const key = code => 'washer_' + code.toLowerCase();

async function tapModel(page, code) {
  const point = await page.evaluate(productKey => {
    const { room, tone, items } = window.lastPaint;
    const item = items.find(o => o.k === productKey);
    const pos = DotScene.place(room, tone, item);
    const scene = document.querySelector('#scene');
    const rect = scene.getBoundingClientRect();
    const scale = rect.width / scene.width;
    for (let dy = Math.floor(pos.s.h / 2); dy < pos.s.h; dy++) {
      for (let dx = Math.floor(pos.s.w / 2); dx < pos.s.w; dx++) {
        const x = pos.x + dx + 0.5, y = pos.y + dy + 0.5;
        if (DotScene.hits(room, tone, items, x, y)[0]?.id === item.id)
          return { x: rect.left + x * scale, y: rect.top + y * scale };
      }
    }
    throw Error('No visible pixel for ' + productKey);
  }, key(code));
  await page.touchscreen.tap(point.x, point.y);
  await page.waitForFunction(({code,title}) =>
    document.querySelector('#lifeTitle').textContent === title &&
    document.querySelector('#lifeDetail').textContent==='' &&
    window.lastPaint.selected === 'washer_' + code.toLowerCase(), {code,title:await expectedTitle(page,'세탁기',code)});
  return page.evaluate(k=>DotScene.products[k].photoUrl||DOT_ASSETS.modelPhotos[DotScene.products[k].spriteKey],key(code));
}

async function observeScene(page) {
  await page.waitForFunction(() => document.querySelectorAll('[data-room]').length === 3);
  await page.evaluate(() => {
    const paint = DotScene.paint;
    DotScene.paint = (ctx, room, tone, items, selected, ...args) => {
      window.lastPaint = {room, tone, items, selected: selected?.k, fx:args[0], wood:args[2]};
      if(args[0]?.tapGlow>0 && args[0].focusedProduct!=null)window.sawProductFlash=true;
      return paint(ctx, room, tone, items, selected, ...args);
    };
  });
  await page.locator('#view').focus();
  await page.keyboard.press('ArrowRight');
  await page.locator('#view').evaluate(el => el.blur());
  await page.waitForFunction(() => window.lastPaint);
}

async function check(browser, width, height) {
  const page = await browser.newPage({viewport: {width, height}, isMobile: true, hasTouch: true});
  page.setDefaultTimeout(7000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/editor?space=dream');
  await page.locator('#more').tap();
  await page.locator('#washerComparison').tap();
  await observeScene(page);
  const roomBounds = await page.locator('#view').boundingBox();
  const storedBefore = await page.evaluate(() => localStorage.dotroom);
  const photos = [];
  for (const code of codes) {
    photos.push(await tapModel(page, code));
    assert.deepEqual(await page.locator('#view').boundingBox(), roomBounds);
  }
  assert.equal(new Set(photos).size, 4);
  assert.equal(photos[3], photos[4]);
  await page.waitForFunction(()=>window.sawProductFlash && window.lastPaint.fx.tapGlow===0);
  assert.ok(await page.evaluate(()=>{
    const scene=document.querySelector('#scene'),{room,tone,items,fx,wood}=window.lastPaint;
    const reference=document.createElement('canvas');reference.width=scene.width;reference.height=scene.height;
    DotScene.paint(reference.getContext('2d'),room,tone,items,null,fx,false,wood);
    return reference.toDataURL()===scene.toDataURL();
  }),'After tap feedback the room and cat have no selection overlay');
  await tapModel(page, codes[3]);
  await page.locator('#washerShelf').tap();
  await observeScene(page);
  for (const code of secondShelf) {
    photos.push(await tapModel(page, code));
    assert.deepEqual(await page.locator('#view').boundingBox(), roomBounds);
  }
  assert.equal(new Set(photos).size, 8);
  await page.locator('#washerShelf').tap();
  await observeScene(page);
  await tapModel(page, codes[0]);
  assert.equal(await page.evaluate(() => localStorage.dotroom), storedBefore);

  await page.goto(base + '/editor?space=dream');
  const collected = [...codes.slice(3), 'FX25WSQX'];
  for (const code of collected) {
    await page.locator('#libraryButton').tap();
    await page.locator('#openCatalog').tap();await page.locator('#catalogFamilies button').filter({hasText:'세탁기'}).tap();
    await page.locator('#catalogSearch').fill(code);await page.getByRole('button',{name:code+' 수집',exact:true}).tap();
    await page.locator('#placeCollected').tap();
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.dotroom).layouts.B.at(-1).k),key(code));
    assert.ok(await page.locator('#editPhoto').isVisible());if(code!==collected.at(-1))await page.locator('#editMode').tap();
  }
  await page.locator('#flip').tap();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.dotroom).layouts.B.find(o => o.k === 'washer_fx25wsqx').turn), 1);
  await page.locator('[data-tone=lime]').tap();
  await page.locator('#editMode').tap();
  await page.reload();
  await observeScene(page);
  for (const code of collected) {
    await tapModel(page, code);
    assert.ok(await page.getByRole('button', {name: '의류 관리', exact: true}).isVisible());
  }
  await page.getByRole('button', {name: '의류 관리', exact: true}).tap();
  assert.equal(await page.locator('#lifeTitle').innerText(), '의류 관리');
  assert.deepEqual(errors, []);
  await page.context().close();
  console.log('PASS ' + width + 'x' + height + ' showroom touch, stable room, shared photo, separate collection, reload and routine');
}

(async () => {
  const browser = await chromium.launch({channel: 'chrome'});
  try {
    for (const [width, height] of [[320, 568], [390, 844]]) await check(browser, width, height);
  } finally { await browser.close(); }
})().catch(e => {console.error(e); process.exitCode = 1;});
