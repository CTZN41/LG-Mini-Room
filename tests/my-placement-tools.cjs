const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const withServer = require('./member-server.cjs');

const storeKey = 'lg-miniroom.dot.my.thinq';
const label = '햇살이 들어오는 가족 거실에서 함께 보는 대형 TV';
const devices = Array.from({ length: 23 }, (_, i) => ({
  id: 'display-' + i,
  name: i === 22 ? label : '테스트 TV ' + (i + 1),
  category: 'TV',
  modelCode: '55LX1QKNA'
}));

// Pick an opaque pixel inside the visible part of the TV. The drag destination
// must have room for the TV and its rotated footprint.
async function touchPoint(page, drag = false) {
  return page.evaluate(({ storeKey, drag }) => {
    const layout = JSON.parse(localStorage.getItem(storeKey));
    const {room, theme} = layout, items = layout.layouts[room], tv = items.find(o => o.deviceId === 'display-22');
    const scene = document.querySelector('#scene');
    const rect = scene.getBoundingClientRect(), scale = rect.width / scene.width;
    const area = document.querySelector('#view').getBoundingClientRect();
    const spot = DotScene.place(room, theme, tv), order = DotScene.sorted(room, items);
    const inside = (x, y) => x >= area.left+3 && x < area.right-3 && y >= area.top+3 && y < area.bottom-3;
    for (const distance of drag ? [8,-8,12,-12] : [0]) {
      const destination = {...tv, x:tv.x+distance};
      DotScene.clamp(room, destination);
      if (destination.x !== tv.x+distance || DotScene.placementBlocker(destination, items, room)) continue;
      const rotated = {...destination};
      DotScene.turnTo(room, rotated, 1);
      if (drag && DotScene.placementBlocker(rotated, items, room)) continue;
      for (let row = 2; row < spot.s.h; row += 2) {
        for (let col = 2; col < spot.s.w; col += 2) {
          const px = spot.x+col+.5, py = spot.y+row+.5;
          if (DotScene.hits(room, theme, order, px, py)[0]?.id !== tv.id) continue;
          const x = rect.left+px*scale, y = rect.top+py*scale;
          if (inside(x,y) && inside(x+2*distance*scale,y+distance*scale) &&
              document.elementFromPoint(x,y)?.closest('#view')) {
            return {x,y,dx:2*distance*scale,dy:distance*scale};
          }
        }
      }
    }
    throw Error('터치 가능한 TV 위치를 찾지 못했습니다.');
  }, {storeKey, drag});
}

async function check(browser, base, width, height) {
  const page = await browser.newPage({ viewport:{width,height}, isMobile:true, hasTouch:true, reducedMotion:'reduce' });
  try {
    page.setDefaultTimeout(6000);
    await page.route('**/api/my-appliances', route => route.fulfill({json:{mode:'thinq',devices}}));
    const tap = name => page.getByRole('button',{name,exact:true}).tap();
    const items = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)).layouts.A.filter(o=>o.deviceId),storeKey);
    const drawer = page.locator('#drawer'), work = page.locator('#view');
    await page.goto(base+'/editor?space=my');
    await tap('배치 편집');
    await page.locator('[data-room=A]').tap();
    assert.ok(await page.locator('#undo').isDisabled());
    await page.locator('#expand').tap();
    assert.equal(await drawer.locator('[data-cat]').count(),6);
    const last = drawer.locator('[data-unit="display-22"]');
    await last.scrollIntoViewIfNeeded();
    assert.ok(await page.locator('#products').evaluate(el=>el.scrollTop>0));
    await last.tap();
    assert.ok(await drawer.isHidden());
    assert.ok((await page.locator('#name').innerText()).includes(label));
    const view = await work.boundingBox();
    for(const selector of ['#name','#ccw','#flip','#remove','#pickAnother']){
      const box = await page.locator(selector).boundingBox();
      assert.ok(box && box.y >= view.y+view.height-1 && box.x >= 0 && box.x+box.width <= width+1 && box.y+box.height <= height+1, selector+' visible below room');
    }
    assert.ok(await page.locator('#up').isHidden());
    await tap('확대');
    const original = (await items())[0];
    const p = await touchPoint(page,true);
    const session = await page.context().newCDPSession(page);
    for(const [type,points] of [
      ['touchStart',[{x:p.x,y:p.y}]], ['touchMove',[{x:p.x+p.dx,y:p.y+p.dy}]], ['touchEnd',[]]
    ]) await session.send('Input.dispatchTouchEvent',{type,touchPoints:points});
    const moved = (await items())[0];
    assert.notEqual(moved.x,original.x);
    await tap('오른쪽 90도 회전');assert.equal((await items())[0].turn,1);
    await tap('왼쪽 90도 회전');assert.equal((await items())[0].turn,0);
    await tap('오른쪽 90도 회전');
    const placed = await items();
    await tap('수납');assert.deepEqual(await items(),[]);
    assert.equal(await page.locator('#drawerTitle').innerText(),'가전 · 배치 가능 23대');
    await page.locator('#undo').tap();assert.deepEqual(await items(),placed);
    await page.reload();await tap('배치 편집');
    assert.deepEqual(await items(),placed);
    assert.equal(await page.locator('#drawerTitle').innerText(),'가전 · 배치 가능 22대');
    await last.tap();assert.deepEqual(await items(),placed);
    await tap('다른 제품 놓기');
    let hit=await touchPoint(page);
    await page.touchscreen.tap(hit.x,hit.y);
    assert.ok(await drawer.isHidden());assert.ok(await page.locator('#living').isHidden());
    await tap('배치 완료');
    hit=await touchPoint(page);await page.touchscreen.tap(hit.x,hit.y);
    await page.locator('#lifeActions').getByRole('button',{name:/영화 보기/}).waitFor();
    await page.goto(base+'/editor?space=example');await page.locator('#living').waitFor();
    assert.ok(await page.locator('#editMode').isHidden());assert.ok(await drawer.isHidden());
    assert.deepEqual(await items(),placed);
    console.log('PASS '+width+'x'+height+' last card, long title, zoomed touch drag, both rotations, stow, undo, reload, room selection, TV interaction and read-only friend');
  } finally { await page.close(); }
}

withServer(async base=>{
  const browser=await chromium.launch({channel:'chrome'});
  try { for(const [width,height] of [[320,568],[390,844]]) await check(browser,base,width,height); }
  finally { await browser.close(); }
}).catch(error=>{console.error(error);process.exitCode=1});
