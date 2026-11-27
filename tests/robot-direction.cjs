const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:4173';
const steps=[[0,1],[-1,0],[0,-1],[1,0]];
const robot=(x,y,turn)=>({id:1,k:'catalog:robot:R560BL1',x,y,f:turn%2,turn,e:0,deviceId:'robot'});

async function check(browser,space,viewport){
  const p=await browser.newPage({viewport,hasTouch:true,isMobile:viewport.width<500});
  p.setDefaultTimeout(6000);
  const key=space==='my'?'lg-miniroom.dot.my.thinq':'dotroom';
  await p.route('**/api/my-appliances',r=>r.fulfill({json:{mode:'thinq',devices:[{id:'robot',category:'로봇청소기',modelCode:'R560BL1',name:'로봇청소기'}]}}));
  const btn=name=>p.getByRole('button',{name,exact:true});
  await p.goto(base+'/editor?space='+space);await btn('배치 편집').waitFor();
  async function load(items,room='B'){
    await p.evaluate(({items,key,room})=>{
      localStorage[key]=JSON.stringify({layoutVersion:1,room,theme:'pink',layouts:{[room]:items}});
      if(key==='dotroom')localStorage['lg-miniroom.state']=JSON.stringify({schemaVersion:1,revision:0,
        collection:['catalog:robot:R560BL1'],dreamLayout:{},myLayout:{},savedRoutines:[]});
    },{items,key,room});
    await p.reload();await btn('배치 편집').waitFor();
    await p.evaluate(()=>{
      const paint=DotScene.paint;
      window.travel=[];window.watcher=[];
      DotScene.paint=function(...args){
        const frame=args[5];
        if(frame?.reaction?.itemId===1){
          const o=frame.movingRobot||args[3].find(o=>o.id===1);
          window.travel.push([o.x,o.y]);window.phase=frame.reaction.progress;
          if(frame.reaction.watchingCleaner){
            const q=DotScene.place(args[1],args[2],o),cat=frame.cat;
            window.watcher.push({x:cat.x,y:cat.y,left:frame.facingLeft,gaze:frame.reaction.gazeX,
              gap:frame.facingLeft?cat.x-11-(q.x+q.s.w):q.x-(cat.x+13)});
          }
        }
        return paint(...args);
      };
    });
  }
  const saved=()=>p.evaluate(key=>JSON.parse(localStorage[key]).layouts.B[0],key);
  async function tapRobot(){
    const point=await p.evaluate(key=>{
      const s=JSON.parse(localStorage[key]),items=DotScene.sorted(s.room,s.layouts[s.room]);
      const robot=items.find(item=>item.id===1),q=DotScene.place(s.room,s.theme,robot);
      const canvas=document.querySelector('#scene'),rect=canvas.getBoundingClientRect();
      for(let y=2;y<q.s.h-2;y++)for(let x=2;x<q.s.w-2;x++){
        const px=q.x+x,py=q.y+y;
        if(![[0,0],[-1,-1],[1,1]].every(([dx,dy])=>DotScene.hits(s.room,s.theme,items,px+dx,py+dy)[0]===robot))continue;
        const screen=[rect.left+(px+.5)*rect.width/canvas.width,rect.top+(py+.5)*rect.height/canvas.height];
        if(document.querySelector('#view').contains(document.elementFromPoint(...screen)))return screen;
      }
      throw Error('로봇청소기 터치 위치를 찾지 못했습니다.');
    },key);
    await p.touchscreen.tap(...point);
  }
  async function openRobot(){await tapRobot();await btn('청소 시간').waitFor()}
  async function checkTrack(o,dx,dy,max){
    await p.waitForFunction(({x,y})=>travel.some(([a,b])=>a===x&&b===y),
      {x:o.x+dx*max,y:o.y+dy*max});
    await p.waitForFunction(()=>window.phase>.92);
    const path=await p.evaluate(()=>travel);
    assert.ok(path.every(([x,y])=>{const n=(x-o.x)*dx+(y-o.y)*dy;
      return n>=0&&n<=max&&x===o.x+dx*n&&y===o.y+dy*n}),JSON.stringify(path));
  }
  for(const turn of [0,1,2,3]){
    const [dx,dy]=steps[turn],o=robot(28,22,turn);
    // Three clear tiles ahead. Every side lane is longer than the forward one.
    const chair={id:2,k:'stool',x:o.x+(dx>0?11:dx<0?-8:0),y:o.y+(dy>0?11:dy<0?-8:0),f:0,e:0};
    await load([o,chair]);await openRobot();await checkTrack(o,dx,dy,3);
    const frames=await p.evaluate(()=>watcher);
    assert.ok(frames.length>3&&frames.every(f=>f.x===frames[0].x&&f.y===frames[0].y&&f.left===frames[0].left&&f.gap>=2),
      JSON.stringify({space,turn,first:frames[0],last:frames.at(-1),minGap:Math.min(...frames.map(f=>f.gap))}));
    assert.ok(new Set(frames.map(f=>f.gaze)).size>2);
    if(turn===3){
      await btn('청소 시간').click();await btn('미리보기').click();
      await p.evaluate(()=>{window.travel=[];window.phase=0});
      await checkTrack(o,dx,dy,3);await btn('재생 종료').click();
    }
    assert.deepEqual(await saved(),o);
  }
  // The old bedroom edge is level in both directions, including the full robot footprint.
  for(const [x,turn] of [[46,3],[54,1]]){
    const o=robot(x,17,turn);
    await load([o]);await openRobot();await checkTrack(o,...steps[turn],8);
    assert.deepEqual(await saved(),o);
  }
  const checks=await p.evaluate(()=>{
    const crosses=(room,x,y,turn)=>DotScene.robotCrossesStep(room,{k:'catalog:robot:R560BL1',x,y,f:turn%2,turn});
    return [crosses('B',38,15,3),crosses('B',39,15,3),crosses('B',55,20,1),
      crosses('A',5,38,0),crosses('A',5,46,2),crosses('A',5,46,3),
      crosses('C',5,46,0),crosses('C',5,54,2),crosses('C',5,54,3)];
  });
  assert.deepEqual(checks,Array(9).fill(false));
  // The current wood rooms are level. Exercise an actual raised zone in this test tab.
  await load([robot(28,22,3)]);
  await p.evaluate(()=>DotScene.roomData('B').zones.push([39,0,100,48,4]));
  await openRobot();await checkTrack(robot(28,22,3),1,0,3);
  await load([robot(28,22,0)]);
  await p.evaluate(()=>DotScene.roomData('B').zones.push([39,0,100,48,4]));
  await btn('배치 편집').tap();await tapRobot();const initial=await saved();
  await p.locator('#ccw').tap();assert.match(await p.locator('#notice').innerText(),/단차/);
  assert.deepEqual(await saved(),initial);
  for(const [room,y] of [['A',38],['C',46]]){
    const o=robot(5,y,0);
    await load([o],room);await openRobot();await checkTrack(o,0,1,8);
    const heights=await p.evaluate(({room,o})=>[0,8].map(dy=>DotScene.elevation(room,{...o,y:o.y+dy})),{room,o});
    assert.equal(heights[0],heights[1]);
  }
  await p.context().close();console.log('PASS',space,viewport,'four forward lanes, obstacles, cleaning preview, flat former entrance and bedroom crossings, saved layout and A/B/C terrain');
}
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
  await check(browser,'dream',{width:390,height:844});await check(browser,'my',{width:1150,height:750});
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
