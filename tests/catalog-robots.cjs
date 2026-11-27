const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:4173';

async function check(browser,width,height){
  const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true});
  const tap=id=>page.locator('#'+id).tap();
  const button=name=>page.getByRole('button',{name,exact:true});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.setDefaultTimeout(9000);
  try{
    await page.goto(base+'/editor?space=dream');
    await tap('libraryButton');await tap('openCatalog');
    await page.locator('#catalogFamilies button').filter({hasText:'R560BL1'}).tap();
    const dots=new Map();
    for(const first of [1,17,33]){
      await page.waitForFunction(first=>document.querySelector('#catalogStatus').textContent.startsWith(first+'–'),first);
      const entries=await page.locator('#catalogRows article').evaluateAll(rows=>rows.map(row=>[
        row.dataset.model,row.querySelector('canvas').toDataURL(),
        row.querySelector('details .appearance')?.textContent||''
      ]));
      for(const [model,art,label] of entries){
        assert.doesNotMatch(label,/제품군 대표 도트/);
        assert.ok(!model.includes(' + '),'단품 카탈로그 '+model);
        dots.set(model,art);
      }
      if(first<33)await tap('catalogNext');
    }
    assert.equal(dots.size,36);assert.equal(new Set(dots.values()).size,20);
    assert.ok(dots.has('RO965GB'));assert.ok(!dots.has('RO965GB + MO971GA'));
    assert.notEqual(dots.get('N95THO'),dots.get('N95THU'));
    assert.notEqual(dots.get('MO971GA'),dots.get('RO971GA'));
    await page.locator('#catalogSearch').fill('B95AWBH');
    await button('B95AWBH 수집').tap();await tap('placeCollected');await tap('editMode');
    await page.reload();await page.locator('#libraryButton').waitFor();
    const saved=()=>page.evaluate(()=>JSON.parse(localStorage.dotroom).layouts.B.find(o=>o.k==='catalog:robot:B95AWBH'));
    const origin=await saved();assert.ok(origin);
    await page.evaluate(()=>{
      const original=DotScene.paint;
      window.samples=[];
      DotScene.paint=function(...args){
        const items=args[3].filter(o=>o.k==='catalog:robot:B95AWBH');
        if(items.length===2)window.samples.push(items.map(o=>[o.robotPart,o.x,o.y,o.id]));
        window.parts=items.map(o=>o.robotPart||'combined');
        return original(...args);
      };
    });
    await page.locator('#view').focus();
    for(let i=0;i<3;i++){
      await page.keyboard.press('ArrowRight');
      if((await page.locator('#keyboardTarget').innerText()).includes('B95AWBH'))break;
    }
    await page.keyboard.press('Enter');await button('청소 시간').waitFor();
    await page.waitForFunction(()=>document.querySelector('#lifeTitle').textContent==='LG전자 오브제컬렉션 코드제로 로보킹 AI 올인원');
    async function verifyTravel(){
      try{await page.waitForFunction(()=>new Set(samples.map(parts=>parts.find(p=>p[0]==='mobile')[2])).size>=2)}
      catch(error){
        console.error(await page.evaluate(()=>({layout:JSON.parse(localStorage.dotroom).layouts.B,parts:window.parts,last:window.samples.at(-1),detail:document.querySelector('#lifeDetail').textContent})),errors);
        throw error;
      }
      for(const pair of await page.evaluate(()=>samples)){
        const station=pair.find(row=>row[0]==='station'),body=pair.find(row=>row[0]==='mobile');
        assert.deepEqual(station,['station',origin.x,origin.y,origin.id]);
        assert.equal(body[1],origin.x);assert.equal(body[3],origin.id);
        assert.ok(body[2]>origin.y&&body[2]<=origin.y+8);
      }
    }
    await verifyTravel();await button('청소 시간').tap();await button('미리보기').tap();
    await page.evaluate(()=>{window.samples=[]});await verifyTravel();
    await button('재생 종료').tap();await page.reload();await page.locator('#libraryButton').waitFor();
    assert.deepEqual(await saved(),origin);
    assert.deepEqual(errors,[]);console.log('PASS',width,height,'36 standalone models, 20 thumbnails, fixed dock during tap and cleaning preview, restored layout');
  }finally{await page.context().close()}
}
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
  for(const [w,h] of [[320,568],[390,844]])await check(browser,w,h);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
