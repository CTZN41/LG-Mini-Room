const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const url=process.argv[2]||'http://127.0.0.1:4173';
(async()=>{const browser=await chromium.launch({channel:'chrome'});
try{for(const [width,height] of [[390,844],[844,390],[1150,750]]){
 const ctx=await browser.newContext({viewport:{width,height},hasTouch:width<1000,isMobile:width<1000,reducedMotion:'reduce'}),p=await ctx.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(5000);
 const btn=t=>p.getByRole('button',{name:t,exact:true});
 const ready=()=>p.waitForFunction(()=>document.querySelector('#scale')?.textContent==='100%'&&document.querySelector('#scene')?.width>300&&!document.querySelector('#living')?.hidden);
 const scene=()=>p.locator('#scene').evaluate(c=>c.toDataURL());
 const store=()=>p.evaluate(()=>['dotroom','lg-miniroom.dot.my','lg-miniroom.state'].map(k=>localStorage.getItem(k)));
 const check=async(space)=>{await ready();assert.equal(new URL(p.url()).searchParams.get('space'),space);assert.ok(await p.locator('#view').isVisible())};
 await p.goto(url+'/?observe=1#menu');await check('menu');const menuFrame=await scene();assert.deepEqual(await store(),[null,null,null]);
 await btn('드림룸 들어가기').click();await check('dream');assert.equal(await scene(),menuFrame);
 await p.getByRole('button',{name:/C현관|C 현관/}).count().then(async()=>{await p.locator('#rooms [data-room=C]').click()});await p.locator('[data-tone=lime]').click();
 const customized=await scene(),original=await store();
 await p.locator('#more').click();await p.locator('#mini').click();await check('menu');assert.equal(await scene(),customized);
 await btn('예시 친구 방').click();await check('example');const friendFrame=await scene();assert.equal(friendFrame,menuFrame);
 assert.ok(await btn('배치 편집').isHidden());assert.ok(await p.locator('#drawer').isHidden());assert.deepEqual(await store(),original);

 await p.locator('#in').click();await p.locator('#overview').click();
 const point=await p.evaluate(()=>{const o={id:1,k:'sofa',x:34,y:48,f:1,turn:1,e:0},items=[o];
 const ord=DotScene.sorted('B',items),q=DotScene.place('B','pink',o),cv=document.querySelector('#scene'),rect=cv.getBoundingClientRect(),scale=rect.width/cv.width;
 for(let y=3;y<q.s.h-3;y++)for(let x=3;x<q.s.w-3;x++)if([[0,0],[2,2],[-2,-2]].every(([dx,dy])=>DotScene.hits('B','pink',ord,q.x+x+dx,q.y+y+dy)[0]===o))return [rect.x+(x+q.x)*scale,rect.y+(y+q.y)*scale];throw Error('No hit on sofa')});
 if(width<1000)await p.touchscreen.tap(...point);else await p.mouse.click(...point);
 await btn('미리보기').click();assert.match(await p.locator('#lifeDetail').textContent(),/커튼 닫힘/);assert.notEqual(await scene(),friendFrame);
 await btn('재생 종료').click();await btn('미리보기').waitFor();assert.equal(await scene(),friendFrame);
 assert.deepEqual(await store(),original);await btn('내 방에 맞추기').click();await check('my');await btn('체험용 기기 사용').click();
 await p.getByLabel('재생할 TV').selectOption('my-tv-2');await btn('미리보기').click();await btn('내 루틴에 저장').click();await btn('영화 보기').waitFor();
 await p.reload();await btn('영화 보기').click();assert.match(await p.locator('#lifeDetail').innerText(),/침실 TV 재생/);
 const rows=await p.evaluate(()=>JSON.parse(sessionStorage['lg-miniroom.events']));for(const event of ['routine_offered','routine_opened','routine_saved','routine_replayed'])assert.ok(rows.some(r=>r.source==='example_room'&&r.event===event),event);
 await p.goto(url+'/#example');await check('example');assert.equal(await scene(),friendFrame);
 await p.locator('#dreamLink').click();assert.equal((await store())[0],original[0]);assert.deepEqual(errors,[]);await ctx.close();
 console.log(width+'x'+height+' PASS same baseline room pixels, custom menu continuity, legacy friend link, read-only sofa hit, preview/restore, save/replay and event path');
}}finally{await browser.close()}
})().catch(e=>{console.error(String(e).slice(0,1000));process.exitCode=1})
