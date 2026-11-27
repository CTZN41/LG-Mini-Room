const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const withServer=require('./member-server.cjs');
withServer(async base=>{
  const browser=await chromium.launch({channel:'chrome'});
  try{
    for(const width of [320,390]){
      const page=await browser.newPage({viewport:{width,height:width===320?568:844},isMobile:true,hasTouch:true});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(7000);
      const tap=id=>page.locator('#'+id).tap();
      const btn=name=>page.getByRole('button',{name,exact:true});
      await page.route('**/api/my-appliances',r=>r.fulfill({json:{mode:'thinq',devices:[
        {id:'living',name:'거실 TV',category:'TV',modelCode:'55LX1QKNA'},
        {id:'bed',name:'침실 TV',category:'TV',modelCode:'55LX1QKNA'}]}}));
      await page.goto(base+'/editor?space=my');await tap('libraryButton');
      const audit=await page.evaluate(async()=>{
        const rows=await (await fetch('/api/catalog/models?labels=1')).json();
        const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
        const style=getComputedStyle(document.querySelector('#libraryItems .list-title'));
        ctx.font=style.fontWeight+' '+style.fontSize+' '+style.fontFamily;
        const issues=[],families=new Set(),examples={};
        for(const [category,code] of rows){
          const key=ProductCatalog.matchModel(category,code);
          if(!key)continue;
          const title=ProductCatalog.listTitle(key,'');
          if(!title||ctx.measureText(title).width>190)issues.push({category,code,title});
          families.add(category);
          if(['FQ16ET4HSN','AS206NGHA','A727TA'].includes(code))examples[code]=title;
        }
        return {issues:issues.slice(0,5),families:[...families].sort(),expected:[...new Set(rows.map(([category])=>category))].sort(),examples};
      });
      assert.deepEqual(audit.families,audit.expected);assert.deepEqual(audit.issues,[]);
      assert.equal(audit.examples.FQ16ET4HSN,'휘센 타워Ⅱ 에어컨');
      assert.equal(audit.examples.AS206NGHA,'360° M5 공기청정기');
      assert.equal(audit.examples.A727TA,'A7 Core 무선청소기');
      const units=await page.locator('#libraryItems [data-product]').allInnerTexts();
      assert.equal(units.length,2);assert.match(units[0],/거실 TV\n포제/);assert.match(units[1],/침실 TV\n포제/);
      await btn('가전 목록 닫기').tap();
      await btn('＋ 추가').tap();await btn('직접 만들기').tap();
      const choices=page.locator('#customDevices');
      await choices.getByLabel('거실 TV',{exact:true}).selectOption('tv-on');
      assert.equal(await choices.getByLabel('침실 TV',{exact:true}).inputValue(),'');
      await page.goto(base+'/editor?space=dream');await tap('libraryButton');await tap('openCatalog');
      await page.locator('#catalogFamilies button').filter({hasText:'냉장고'}).tap();
      const codes=['B315DS11','B315W11','H875GGA011','H875GGA031'];
      for(const code of codes){
        await page.locator('#catalogSearch').fill(code);
        const row=page.locator('#catalogRows [data-model="'+code+'"]');
        await row.waitFor();
        assert.doesNotMatch(await row.locator('strong').innerText(),/트레이|접이식|H875|B315/);
        if(code.startsWith('H875')){
          await row.locator('summary').tap();
          const feature=code.endsWith('011')?'신선플러스 트레이':'1단 접이식 선반';
          await row.getByText('냉장실 수납 · '+feature,{exact:true}).waitFor();
        }
        await row.getByRole('button',{name:code+' 수집'}).tap();await tap('continueCollecting');
      }
      await btn('가전 목록 닫기').tap();await page.reload();await btn('인벤토리').tap();await btn('가전').tap();
      await page.locator('#bagItems [data-family="냉장고"]').tap();
      const rowFor=code=>page.locator('#bagItems [data-item="catalog:fridge:'+code+'"]');
      assert.match(await rowFor(codes[0]).innerText(),/일반냉장고\n다크 그라파이트/);
      assert.match(await rowFor(codes[1]).innerText(),/일반냉장고\n화이트/);
      for(const code of codes.slice(2)){
        const text=await rowFor(code).innerText();assert.match(text,new RegExp('디오스 냉장고\\n'+code));
        assert.doesNotMatch(text,/트레이|선반/);
      }
      assert.deepEqual(errors,[]);await page.context().close();console.log('PASS '+width+'px: registered aliases, catalog detail, real collection, collision labels after reload');
    }
  }finally{await browser.close()}
}).catch(error=>{console.error(error);process.exitCode=1});
