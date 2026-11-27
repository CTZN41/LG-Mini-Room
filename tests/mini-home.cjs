const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const path=require('node:path');
const {tmpdir}=require('node:os');
const withServer=require('./member-server.cjs');
const key='catalog:tv:55LX1QKNA';
withServer(async base=>{
  const browser=await chromium.launch({channel:'chrome'});
  try{
    for(const [width,height] of [[320,568],[360,780],[390,844]]){
      const ctx=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});
      const p=await ctx.newPage();p.setDefaultTimeout(10000);
      const errors=[],posts=[];
      p.on('pageerror',err=>errors.push(err.message));p.on('request',r=>{if(r.method()==='POST')posts.push(r.url())});
      const api=(part,data)=>ctx.request.post(base+'/api/members/'+part,{headers:{'X-Miniroom':'1'},data});
      const {id:owner}=await (await api('join',{name:'검수',username:'home-'+width,password:'123456',nickname:'구름'})).json();
      const inactive=[{id:8,k:key,x:12,y:12,f:0,e:0,deviceId:'my-tv-1'}];
      const couch={id:1,k:'sofa',x:46,y:26,turn:1,f:1,e:0};
      const layout={layoutVersion:1,room:'C',theme:'pink',woodRooms:['A','B','C'],layouts:{A:[couch],C:inactive}};
      const data={'dotroom':{...layout,layouts:{...layout.layouts,A:[couch,{id:2,k:key,x:10,y:12,f:0,e:0}]}},
        'lg-miniroom.dot.my':layout,'lg-miniroom.state':{schemaVersion:1,revision:1,collection:[key],dreamLayout:{},myLayout:{},savedRoutines:[{templateId:'movie-night',anchorId:'sofa',bindings:{'tv-on':'my-tv-1'},exclusions:{}}],myFixtureId:'sample-home-v1'}};
      for(const [key,value] of Object.entries(data))assert.equal((await api('save',{owner,key,before:null,value:JSON.stringify(value)})).status(),200);
      assert.equal((await api('note',{owner,source:owner,space:'dream',message:'드림룸 방명록 시험'})).status(),201);
      await p.goto(base+'/miniroom/home?space=dream');
      async function checkMusicBar(){
        const bars=await p.locator('#bgm .music-meter i').evaluateAll(items=>items.map(item=>{
          const {x,bottom,width,height}=item.getBoundingClientRect();
          return {x,bottom,width,height,color:getComputedStyle(item).backgroundColor};
        }));
        assert.deepEqual(bars.map(b=>b.height),[8,13,10,15]);
        for(const [i,b] of bars.entries()){
          assert.equal(b.width,3);assert.equal(b.bottom,bars[0].bottom);
          if(i)assert.equal(b.x-bars[i-1].x,5);
        }
        assert.notEqual(bars[0].color,bars[1].color);
      }
      const shot=p.locator('#roomImage');
      await shot.waitFor();assert.match(await shot.getAttribute('alt'),/드림룸 A/);
      await p.getByText('구름의 방',{exact:true}).waitFor();
      await p.locator('#notes').getByText('드림룸 방명록 시험',{exact:false}).waitFor();
      assert.equal(await p.locator('.unit small').innerText(),'배치됨');
      await p.evaluate(()=>document.fonts.ready);
      assert.ok(await p.evaluate(()=>document.fonts.check('18px Jua')&&document.fonts.check('9px Silkscreen')));
      await checkMusicBar();
      if(width===360){
        const box=await p.locator('.room').boundingBox(),bgm=await p.locator('#bgm').boundingBox();
        assert.ok(Math.abs(box.y-176)<=2&&Math.abs(box.width-286)<=2);
        assert.equal(bgm.y,660);assert.equal(bgm.height,40);
      }
      const dream=await shot.getAttribute('src');
      if(width===360)await p.screenshot({path:path.join(tmpdir(),'miniroom-H03.png')});
      await p.locator('#bgm').tap();await p.locator('#music[open]').waitFor();assert.equal(await p.locator('.track').count(),4);
      await p.locator('.track').nth(2).tap();assert.equal(await p.locator('.apply').isDisabled(),true);
      if(width===360)await p.screenshot({path:path.join(tmpdir(),'miniroom-H02.png')});
      await p.goBack();await p.locator('#music').waitFor({state:'hidden'});
      await p.getByRole('button',{name:'⌂ 마이룸'}).tap();await shot.waitFor();
      assert.match(await shot.getAttribute('alt'),/마이룸 A/);assert.notEqual(await shot.getAttribute('src'),dream);
      assert.ok((await p.locator('.unit small').allTextContents()).every(t=>t==='가동 미확인'));
      await p.getByText('아직 남겨진 글이 없어요.').waitFor();
      if(width===360)await p.screenshot({path:path.join(tmpdir(),'miniroom-H01.png')});
      assert.deepEqual(posts,[],'home preview must not save or control anything');
      const size=await p.locator('.thinq-footer').boundingBox();
      assert.ok(size.y+size.height<=height+1);
      await p.locator('#full').tap();await p.locator('body.room-overview').waitFor();
      assert.equal(await p.locator('#rooms [data-room]').count(),3);
      await p.goBack();
      await p.locator('#roomTab').tap();
      await p.locator('body.personal-browse #bgm').waitFor();await checkMusicBar();
      const roomButton=r=>p.locator('#rooms button[data-room='+r+']');
      const current=r=>p.locator('#rooms button[data-room='+r+'][aria-pressed=true]').waitFor();
      for(const r of ['C','A','B']){
        await roomButton(r).tap();await current(r);
        assert.equal(await p.locator('#roomCardsTitle').innerText(),'가구를 눌러 루틴 시작');
        if(r==='C')assert.equal(await p.locator('#roomCardList button').count(),0);
        if(r==='A'){
          const movie=p.locator('#roomCardList button').filter({hasText:'영화 보기'});
          if(width===360)await p.screenshot({path:path.join(tmpdir(),'miniroom-B01.png')});
          await movie.tap();await p.locator('#lifeActions').getByRole('button',{name:'영화 보기',exact:true}).waitFor();
        }
      }
      await p.evaluate(()=>roomStorage.whenSynced());
      await p.reload();await current('B');
      assert.deepEqual(await p.evaluate(()=>JSON.parse(roomStorage.getItem('lg-miniroom.dot.my')).layouts.C),inactive);
      await p.goto(base+'/miniroom/home?space=my');await shot.waitFor();
      assert.match(await shot.getAttribute('alt'),/마이룸 A/);
      await p.locator('#all').tap();await p.locator('#library[open]').waitFor();await p.goBack();
      await p.locator('#noteTab[href]').tap();await p.locator('#guestbook').waitFor();await p.goBack();
      await p.locator('#bookTab').tap();await p.locator('#routineBag[open]').waitFor();await p.goBack();
      await p.locator('#roomTab').tap();await current('B');await p.goBack();
      await p.getByRole('button',{name:'✦ 드림룸'}).tap();await shot.waitFor();await p.locator('#roomTab').tap();await current('C');
      for(const r of ['A','B','C']){await roomButton(r).tap();await current(r)}
      if(width===360)await p.screenshot({path:path.join(tmpdir(),'miniroom-B02.png')});
      await p.locator('#roomCardList button').filter({hasText:'TV'}).tap();
      await p.locator('#routineBag[open] .bag-unit').first().waitFor();
      await p.goto(base+'/miniroom/home?space=dream');await shot.waitFor();
      assert.equal(await shot.getAttribute('src'),dream);
      await p.locator('.unit').first().tap();
      await p.locator('#routineBag[open] .bag-unit').first().waitFor();await p.goBack();
      await p.route('https://lg-camera-lab.pages.dev/scan?**',r=>r.fulfill({body:'camera'}));
      await p.locator('#shoot').tap();await p.waitForURL('https://lg-camera-lab.pages.dev/scan?**');
      assert.equal(new URL(new URL(p.url()).searchParams.get('returnTo')).searchParams.get('space'),'dream');
      if(width===360){
        const roomKey='lg-miniroom.dot.my';
        async function accountEntries(){
          const html=await (await ctx.request.get(base+'/editor?space=my')).text();
          return JSON.parse(html.match(/id="account-data">([^<]+)</)[1]).entries;
        }
        const before=(await accountEntries())[roomKey],legacy=JSON.parse(before);
        legacy.room='A';legacy.layouts.A.push({...inactive[0],id:91});
        const original=JSON.stringify(legacy);
        assert.equal((await api('save',{owner,key:roomKey,before,value:original})).status(),200);
        await p.goto(base+'/editor?space=my&room=C');await current('C');
        await p.evaluate(()=>roomStorage.whenSynced());
        const entries=await accountEntries(),restored=JSON.parse(entries[roomKey]);
        assert.equal(entries[roomKey+'.before-unit-limit'],original);
        assert.equal(restored.layouts.A.filter(o=>o.deviceId==='my-tv-1').length,1);
        assert.ok(!restored.layouts.C.some(o=>o.deviceId==='my-tv-1'));
      }
      assert.deepEqual(errors,[]);await ctx.close();console.log('PASS H01/H03 studio preview, B01/B02 three layouts, cards and navigation',width,height);
    }
  }finally{await browser.close()}
}).catch(e=>{console.error(e);process.exitCode=1});
