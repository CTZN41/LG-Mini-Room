const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:4173';
const steps=[[0,1],[-1,0],[0,-1],[1,0]];
const robot=(x,y,turn)=>({id:1,k:'robot_vacuum',x,y,f:turn%2,turn,e:0,deviceId:'robot'});

async function check(browser,space,viewport){
  const p=await browser.newPage({viewport,hasTouch:true,isMobile:viewport.width<500});
  p.setDefaultTimeout(6000);
  const key=space==='my'?'lg-miniroom.dot.my.thinq':'dotroom';
  await p.route('**/api/my-appliances',r=>r.fulfill({json:{mode:'thinq',devices:[{id:'robot',k:'robot_vacuum',name:'로봇청소기'}]}}));
  const btn=name=>p.getByRole('button',{name,exact:true});
  await p.goto(base+'/editor?space='+space);await btn('배치 편집').waitFor();
  async function load(items,room='B'){
    await p.evaluate(({items,key,room})=>{
      localStorage[key]=JSON.stringify({layoutVersion:1,room,theme:'pink',layouts:{[room]:items}});
      if(key==='dotroom')localStorage['lg-miniroom.state']=JSON.stringify({schemaVersion:1,revision:0,
        collection:['robot_vacuum'],dreamLayout:{},myLayout:{},savedRoutines:[]});
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
  async function openRobot(){
    await p.locator('#view').focus();
    for(let i=0;i<2;i++){
      await p.keyboard.press('ArrowRight');
      if((await p.locator('#keyboardTarget').textContent()).includes('로봇청소기'))break;
    }
    await p.keyboard.press('Enter');await btn('청소 시간').waitFor();
  }
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
    const crosses=(room,x,y,turn)=>DotScene.robotCrossesStep(room,{k:'robot_vacuum',x,y,f:turn%2,turn});
    return [crosses('B',38,15,3),crosses('B',39,15,3),crosses('B',55,20,1),
      crosses('A',5,38,0),crosses('A',5,46,2),crosses('A',5,46,3),
      crosses('C',5,46,0),crosses('C',5,54,2),crosses('C',5,54,3)];
  });
  assert.deepEqual(checks,Array(9).fill(false));
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
