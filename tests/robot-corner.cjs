const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:4174';
const dock='catalog:robot:B95AWBH';

async function check(browser,width,height){
  const p=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true});
  p.setDefaultTimeout(6500);
  const btn=name=>p.getByRole('button',{name,exact:true});
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'/editor?space=dream');await btn('배치 편집').waitFor();
  for(const turn of [0,1,2,3]){
    const room=width===390?'A':'B';
    await p.evaluate(({turn,room,dock})=>{
      const {W,D}=DotScene.roomData(room),x=W-8,y=room==='B'?40:D-8;
      const items=[
        {id:1,k:dock,x,y,turn,f:turn%2,e:0},
        {id:2,k:'catalog:robot:R585WKA',x:x-13,y,turn:0,f:0,e:0},
        {id:3,k:'catalog:humid:HY705RWUA',x:x-8,y:y-19,turn:0,f:0,e:0}
      ];
      localStorage.dotroom=JSON.stringify({layoutVersion:1,room,theme:'pink',woodRooms:[room],layouts:{[room]:items}});
      localStorage['lg-miniroom.state']=JSON.stringify({schemaVersion:1,revision:1,collection:items.map(o=>o.k),dreamLayout:{},myLayout:{},savedRoutines:[]});
    },{turn,room,dock});
    await p.reload();await btn('배치 편집').waitFor();
    const saved=await p.evaluate(()=>localStorage.dotroom);
    const spot=await p.evaluate(dock=>{
      const {room,theme,layouts}=JSON.parse(localStorage.dotroom),items=layouts[room];
      const target=items.find(o=>o.k===dock),q=DotScene.place(room,theme,target);
      const canvas=document.querySelector('#scene'),rect=canvas.getBoundingClientRect();
      const draw=DotScene.paint;
      const buffers=Array.from({length:3},()=>{
        const c=document.createElement('canvas');c.width=c.height=40;return c.getContext('2d',{willReadFrequently:true});
      });
      window.measures=[];
      DotScene.paint=function(ctx,r,t,objects,selected,fx,...rest){
        if(fx&&(fx.reaction?.itemId===1||fx.walking)){
          const samples=buffers.map((buf,i)=>{
            buf.setTransform(1,0,0,1,20-Math.round(fx.cat.x),28-Math.round(fx.cat.y));
            draw(buf,r,t,i===1?objects:[],null,i===2?fx:null,...rest);
            return new Uint32Array(buf.getImageData(0,0,40,40).data.buffer);
          });
          const [bg,furniture,cat]=samples;
          const overlap=cat.reduce((n,v,i)=>n+Number(v!==bg[i]&&furniture[i]!==bg[i]),0);
          measures.push({overlap,walk:fx.walking,progress:fx.reaction?.progress});
        }
        return draw.apply(this,arguments);
      };
      for(let y=3;y<q.s.h-3;y++)for(let x=3;x<q.s.w-3;x++){
        const X=x+q.x,Y=y+q.y;
        if([[0,0],[2,2],[-2,-2]].every(([dx,dy])=>DotScene.hits(room,theme,DotScene.sorted(room,items),X+dx,Y+dy)[0]===target))
          return [rect.x+(X+.5)*rect.width/canvas.width,rect.y+(Y+.5)*rect.height/canvas.height];
      }
      throw Error('Corner robot has no touch target');
    },dock);
    await p.touchscreen.tap(...spot);await btn('청소 시간').waitFor();
    for(const mode of ['tap','routine']){
      if(mode==='routine'){
        await btn('청소 시간').tap();await p.evaluate(()=>{measures.length=0});await btn('미리보기').tap();
      }
      await p.waitForFunction(()=>measures.some(f=>f.progress>.94));
      const frames=await p.evaluate(()=>measures.filter(f=>!f.walk));
      assert.equal(Math.max(...frames.map(f=>f.overlap)),0,room+' '+turn+' '+mode+' settled silhouette');
      const walking=await p.evaluate(()=>measures.filter(f=>f.walk));
      assert.equal(Math.max(0,...walking.map(f=>f.overlap)),0,room+' '+turn+' '+mode+' approach');
    }
    await btn('재생 종료').tap();
    assert.equal(await p.evaluate(()=>localStorage.dotroom),saved);
  }
  // A dock on the default spawn must also leave the idle cat visible after editing.
  await p.evaluate(dock=>{
    const layout=JSON.parse(localStorage.dotroom);
    layout.layouts[layout.room]=[{id:1,k:dock,x:24,y:39,turn:0,f:0,e:0}];
    localStorage.dotroom=JSON.stringify(layout);
  },dock);
  await p.reload();await btn('배치 편집').tap();
  await p.evaluate(()=>{
    const draw=DotScene.paint;
    DotScene.paint=function(...args){
      if(args[5]?.cat)window.idleCat=args[5].cat;
      return draw(...args);
    };
  });
  await btn('배치 완료').tap();
  assert.ok(await p.evaluate(()=>{
    const {room,theme,layouts}=JSON.parse(localStorage.dotroom),o=layouts[room][0];
    const q=DotScene.place(room,theme,o),cat=window.idleCat;
    for(let y=0;y<q.s.h;y++)for(let x=0;x<q.s.w;x++){
      if(q.s.pixels[(y*q.s.w+x)*4+3]&&Math.abs(q.x+x-cat.x)<=15&&q.y+y>=cat.y-25&&q.y+y<=cat.y+2)return false;
    }
    return true;
  }),'idle cat overlaps dock after placement');
  assert.deepEqual(errors,[]);await p.context().close();console.log('PASS corner robot',width,height,'four headings, fixed dock, neighbours, tap and cleaning');
}
(async()=>{const b=await chromium.launch({channel:'chrome'});try{
  await check(b,390,844);await check(b,320,568);
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
