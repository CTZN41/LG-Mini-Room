const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {chromium} = require('playwright');
const withServer = require('./member-server.cjs');

const layoutsKey = 'lg-miniroom.dot.my.thinq';
const cases = [
  {category:'TV', modelCode:'55LX1QKNA', turns:1},
  {category:'냉장고', modelCode:'M876GBC472', turns:2},
  {category:'공기청정기', modelCode:'AS235DWSA', turns:-1},
  {category:'로봇청소기', modelCode:'R560BL1', turns:1},
  {category:'무선청소기', modelCode:'A727TA', turns:2},
  {category:'세탁기', modelCode:'WL2521WDUR', turns:-1},
  {category:'에어컨', modelCode:'SQ06ACJCAJ.AKORG', wall:true}
];

async function check(browser, base, viewport, product) {
  const page = await browser.newPage({viewport, isMobile:true, hasTouch:true, reducedMotion:'reduce'});
  const {modelCode, category, turns, wall} = product;
  const id = 'rotation-test-'+modelCode;
  const card = page.locator('#products [data-unit="'+id+'"]');
  const tap = name => page.getByRole('button',{name,exact:true}).tap();
  // Include all rooms so a duplicate or a restoration into another room also fails.
  const state = () => page.evaluate(key=>JSON.parse(localStorage.getItem(key)).layouts, layoutsKey);
  const scene = async () => createHash('sha256').update(
    await page.locator('#scene').evaluate(canvas=>canvas.toDataURL())
  ).digest('hex');
  const allCopies = layouts => Object.values(layouts).flat().filter(o=>o.deviceId===id);
  try {
    page.setDefaultTimeout(6000);
    await page.route('**/api/my-appliances', route=>route.fulfill({json:{
      mode:'thinq', devices:[{id,category,modelCode,name:'검수 '+category}]
    }}));
    await page.goto(base+'/editor?space=my');
    await tap('배치 편집');
    await page.locator('[data-room=A]').tap();
    await card.tap();
    const before = await scene();
    if (wall) {
      await tap('부착 벽 전환');
    } else {
      for (let i=0;i<Math.abs(turns);i++) await tap(turns>0?'오른쪽 90도 회전':'왼쪽 90도 회전');
    }
    const expectedTurn = wall ? 3 : (4+turns)%4;
    const rotated = await state();
    const copies = allCopies(rotated);
    assert.equal(copies.length,1);
    assert.ok(rotated.A.some(o=>o.deviceId===id));
    assert.equal(copies[0].turn,expectedTurn,'saved heading after rotation');
    assert.equal(Number(copies[0].f),expectedTurn%2);
    const heading = page.locator('#name');
    if (!wall) assert.ok((await heading.innerText()).includes(expectedTurn*90+'°'));
    const selectedImage = await scene();
    assert.notEqual(selectedImage,before,'rotation should visibly change the room');
    await tap('수납');
    assert.equal(allCopies(await state()).length,0);
    assert.equal(await page.locator('#drawerTitle').innerText(),'가전 · 배치 가능 1대');
    await page.locator('#undo').tap();
    const checkRestored = async () => {
      assert.deepEqual(await state(),rotated,'all placements including direction, ID and position');
      assert.equal(await page.locator('#drawerTitle').innerText(),'가전 · 배치 가능 0대');
      await card.tap();
      if (!wall) assert.ok((await heading.innerText()).includes(expectedTurn*90+'°'));
      assert.equal(await scene(),selectedImage,'room pixels with restored appliance selected');
    };
    await checkRestored();
    await page.reload();
    await tap('배치 편집');
    await checkRestored();
    console.log('PASS',viewport.width+'x'+viewport.height,category,modelCode,wall?'wall switched':expectedTurn*90+'°');
  } catch (error) {
    console.error('Failed case:',viewport,category,modelCode);
    throw error;
  } finally { await page.close(); }
}

withServer(async base=>{
  const browser = await chromium.launch({channel:'chrome'});
  try {
    for (const viewport of [{width:320,height:568},{width:390,height:844}]) {
      for (const product of cases) await check(browser,base,viewport,product);
    }
  } finally { await browser.close(); }
}).catch(error=>{console.error(error);process.exitCode=1});
