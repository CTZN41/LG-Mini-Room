const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:4173',url=base+'/editor?space=my';
(async()=>{const b=await chromium.launch({channel:'chrome'});try{
for(const [width,height] of [[390,844],[320,568],[1150,750]]){
const ctx=await b.newContext({viewport:{width,height},hasTouch:width<500,isMobile:width<500});
const p=await ctx.newPage();p.setDefaultTimeout(4500);const errors=[];p.on('pageerror',e=>errors.push(e.message));
const button=n=>p.getByRole('button',{name:n,exact:true});
const tap=async n=>width<500?button(n).tap():button(n).click();
const rows=()=>p.evaluate(()=>JSON.parse(localStorage['lg-miniroom.state']).savedRoutines);
async function manage(){await p.locator('#more').click();await tap('체험용 TV 관리')}
async function screenHash(device){
return p.evaluate(dev=>{
 const s=JSON.parse(localStorage['lg-miniroom.dot.my']),o=s.layouts[s.room].find(o=>o.deviceId===dev);
 const {x,y,s:sp}=DotScene.place(s.room,s.theme,o);
 const [sx,sy,w,h]=sp.screen;
 const ctx=document.querySelector('#scene').getContext('2d');
 let hash=0;
 for(let u=2;u<w-2;u++){
   const px=o.f?sp.w-1-sx-u:sx+u;
   const column=ctx.getImageData(x+px,y+sy+Math.round(u/2)+2,1,h-4).data;
   for(const value of column)hash=(31*hash+value)|0;
 }
 return hash;
},device);
}
await p.goto(url);await tap('체험용 기기 사용'); await tap('＋ 추가');await tap('영화 보기 연결');
const picker=p.getByLabel('재생할 TV');assert.deepEqual(await picker.locator('option').allTextContents(),['TV 선택','거실 TV','침실 TV']);
assert.ok(await button('미리보기').isDisabled());
await picker.selectOption({label:'침실 TV'});await tap('＋ 조명 30%');
const before=[await screenHash('my-tv-1'),await screenHash('my-tv-2')];await tap('미리보기');
await p.waitForTimeout(820);
assert.ok((await p.locator('#lifeDetail').innerText()).includes('침실 TV 재생'));assert.equal(await screenHash('my-tv-1'),before[0]);assert.notEqual(await screenHash('my-tv-2'),before[1]);
await tap('내 루틴에 저장');await button('영화 보기').waitFor();const [original]=await rows();
assert.equal(original.bindings['tv-on'],'my-tv-2');assert.equal(original.bindings['light-dim'],'my-light-1');
await p.reload();await tap('영화 보기');assert.match(await p.locator('#lifeDetail').innerText(),/침실 TV 재생/);await tap('재생 종료');await button('영화 보기').waitFor();
await manage();await tap('침실 TV 등록 해제');await tap('완료');assert.match(await button('TV 다시 연결').innerText(),/TV 다시 연결/);
await p.reload();await tap('TV 다시 연결');
const rep=p.getByLabel('대체 TV');assert.deepEqual(await rep.locator('option').allTextContents(),['TV 선택','거실 TV']);assert.equal(await button('연결하고 재생').isEnabled(),false);
await rep.selectOption({label:'거실 TV'});await tap('취소');assert.deepEqual(await rows(),[original]);await tap('TV 다시 연결');
await rep.selectOption({label:'거실 TV'});

await p.evaluate(()=>{window.realWrite=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='lg-miniroom.state')throw Error('쓰기 실패');return realWrite.call(this,k,v)}});
await tap('연결하고 재생');assert.deepEqual(await rows(),[original]);assert.ok(await button('연결하고 재생').isVisible());await p.evaluate(()=>Storage.prototype.setItem=window.realWrite);
const idle=await screenHash('my-tv-1');await tap('연결하고 재생');await button('재생 종료').waitFor();assert.match(await p.locator('#lifeDetail').innerText(),/거실 TV 재생/);await p.waitForTimeout(650);assert.notEqual(await screenHash('my-tv-1'),idle);
const updated=structuredClone(original);updated.bindings['tv-on']='my-tv-1';assert.deepEqual(await rows(),[updated]);await p.reload();await tap('영화 보기');assert.match(await p.locator('#lifeDetail').innerText(),/거실 TV 재생/);await tap('재생 종료');await button('영화 보기').waitFor();
await manage();await tap('거실 TV 등록 해제');await tap('완료');await tap('TV 다시 연결');assert.equal(await rep.count(),0);assert.match(await p.locator('#lifeDetail').innerText(),/연결할 TV가 없어요/);
await tap('체험용 TV 관리');await tap('침실 TV 등록');await tap('완료');await tap('TV 다시 연결');await rep.selectOption({label:'침실 TV'});await tap('연결하고 재생');assert.match(await p.locator('#lifeDetail').innerText(),/침실 TV 재생/);assert.deepEqual(errors,[]);await ctx.close();
console.log(width+'x'+height+' PASS TV2 selected/saved/replayed; only chosen TV pixels changed; deregistered TV detected; cancel, failed write, retry, instant TV1 playback, reload and zero candidates verified.');
}
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
