// Original MY DOT ROOM atlas, sprite anchors, 2:1 projection and footprint ordering.
const DotScene = (() => {
  const data = DOT_ASSETS;
  const products = Object.fromEntries(data.items.map(item => [item.k, item]));
  const names = {A:'롱 스튜디오', B:'L자 + 단차', C:'현관 투존'};
  const images = new Map();
  const wallDisplay = [
    ['standbyme',2,24], ['styler',14,1], ['wash_b',26,1], ['wash_m',40,1],
    ['wash_s',54,1], ['fridge_bm',69,1], ['fridge_pb',85,1], ['fridge_sg',101,1]
  ];
  function defaults(room, nextId) {
    const entries = room==='A' ? wallDisplay : data.layouts[room];
    const result = entries.map(([k,x,y,f=0,e=0]) => ({id:nextId(),k,x,y,f,e}));
    if (room==='C') result.push({id:nextId(), k:'standbyme', x:14, y:38, f:1, e:0});
    if(room==='B')result.find(o=>o.k==='sofa').turn=1;
    return result;
  }
  function canvas(w,h) {
    const c=document.createElement('canvas');
    c.width=w; c.height=h;
    return c;
  }
  async function loadPNG(src) {
    const im=new Image();
    im.src='data:image/png;base64,'+src;
    await im.decode();
    return im;
  }
  async function load() {
    const jobs=[];
    for (const [group,entries] of Object.entries(data.sprites)) {
      for (const [key,sp] of Object.entries(entries)) jobs.push((async()=>{
        const im=await loadPNG(sp.src), w=im.width, h=im.height;
        const flipped=canvas(w,h), fx=flipped.getContext('2d');
        fx.translate(w,0); fx.scale(-1,1); fx.drawImage(im,0,0);
        const copy=canvas(w,h).getContext('2d');
        copy.drawImage(im,0,0);
        const pixels=copy.getImageData(0,0,w,h).data;
        // A hollow two-colour outline remains visible through foreground furniture.
        const ring=canvas(w+6,h+6), rc=ring.getContext('2d');
        const outline=rc.createImageData(ring.width,ring.height);
        const opaque=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&pixels[(y*w+x)*4+3]>10;
        for(let y=-3;y<h+3;y++) for(let x=-3;x<w+3;x++){
          if(opaque(x,y)) continue;
          let distance=4;
          for(let j=-3;j<=3;j++) for(let i=-3;i<=3;i++)
            if(opaque(x+i,y+j)) distance=Math.min(distance,Math.max(Math.abs(i),Math.abs(j)));
          if(distance<4) outline.data.set(distance<3?[255,234,148,255]:[62,32,53,255],((y+3)*ring.width+x+3)*4);
        }
        rc.putImageData(outline,0,0);
        images.set(group+':'+key,{im,flipped,ring,pixels,w,h,ax:sp.ax,ay:sp.ay});
      })());
    }
    for (const [room,tones] of Object.entries(data.rooms))
      for (const [tone,entry] of Object.entries(tones)) jobs.push((async()=>{
        const im=await loadPNG(entry.src);
        images.set(room+':'+tone,im);
        const shade=canvas(im.width,im.height),sc=shade.getContext('2d');
        sc.drawImage(im,0,0);const pixels=sc.getImageData(0,0,im.width,im.height),a=pixels.data;
        const base=[a[0],a[1],a[2]];
        for(let i=0;i<a.length;i+=4){
          const isRoom=Math.abs(a[i]-base[0])+Math.abs(a[i+1]-base[1])+Math.abs(a[i+2]-base[2])>45;
          a[i]=35;a[i+1]=28;a[i+2]=65;a[i+3]=isRoom?95:0;
        }
        sc.putImageData(pixels,0,0);images.set('shade:'+room+':'+tone,shade);
      })());
    await Promise.all(jobs);
  }
  const sprite=(k,t)=>images.get(t+':'+k)||images.get('appl:'+k);
  const bg=(r,t)=>images.get(r+':'+t);
  const roomData=r=>data.rooms[r].pink;
  // Fronts point along +Y, -X, -Y and +X, clockwise on the floor.
  const heading=o=>o.turn??(o.f?3:0);
  const rear=o=>heading(o)===1||heading(o)===2;
  const orientedSprite=(o,t)=>rear(o)?sprite(o.k+'_rear',t)||sprite(o.k,t):sprite(o.k,t);
  function turnTo(room,o,turn){
    const old=dims(o);
    const origin=o.rotationOrigin;
    const useOrigin=origin && origin.atX===o.x && origin.atY===o.y &&
      Number.isFinite(origin.x) && Number.isFinite(origin.y);
    const cx=useOrigin?origin.x:o.x+Math.floor(old.w/2);
    const cy=useOrigin?origin.y:o.y+Math.floor(old.d/2);
    delete o.rotationOrigin;
    o.turn=(turn+4)%4;o.f=o.turn%2;
    const next=dims(o);
    if(!products[o.k].wall){
      o.x=cx-Math.floor(next.w/2);o.y=cy-Math.floor(next.d/2);
      const wantedX=o.x,wantedY=o.y;
      clamp(room,o);
      if(o.x!==wantedX||o.y!==wantedY)o.rotationOrigin={x:cx,y:cy,atX:o.x,atY:o.y};
    }
  }
  function center(o){
    const {w,d}=dims(o);return {x:o.x+w/2,y:o.y+d/2};
  }
  function facingScreen(o,items){
    const p=center(o);
    let delta=null,best=Infinity;
    for(const tv of items){
      if(!['tvset','standbyme'].includes(tv.k))continue;
      const q=center(tv),dx=q.x-p.x,dy=q.y-p.y,dist=dx*dx+dy*dy;
      if(dist<best){best=dist;delta={dx,dy}}
    }
    if(!delta)return null;
    const {dx,dy}=delta;
    return Math.abs(dx)>Math.abs(dy)?(dx<0?1:3):(dy<0?2:0);
  }
  function dims(o) {
    const {w,d}=products[o.k];
    return o.f ? {w:d,d:w} : {w,d};
  }
  function zone(room,o) {
    const {w,d}=dims(o), cx=o.x+w/2, cy=o.y+d/2;
    for(const [x1,y1,x2,y2,z] of roomData(room).zones)
      if(cx>=x1&&cx<x2&&cy>=y1&&cy<y2) return z;
    return 0;
  }
  const elevation=(r,o)=>products[o.k].elev+o.e+(products[o.k].wall?0:zone(r,o));
  function project(room,x,y,z) {
    const {ox,oy}=roomData(room);
    return [Math.round(ox+2*(x-y)),Math.round(oy+x+y-z*data.zf)];
  }
  function place(room,tone,o) {
    const s=orientedSprite(o,tone), [px,py]=project(room,o.x,o.y,elevation(room,o));
    return {s,x:px-(o.f?s.w-s.ax:s.ax),y:py-s.ay};
  }
  function clamp(room,o) {
    const {W,D}=roomData(room), {w,d}=dims(o);
    o.x=Math.max(0,Math.min(W-w,Math.round(o.x)));
    o.y=Math.max(0,Math.min(D-d,Math.round(o.y)));
    if(products[o.k].wall){if(o.f)o.x=0;else o.y=0}
    // B's foreground cut-out starts at grid (52, 48).
    if(room==='B'&&o.x+w>52&&o.y+d>48){
      if(o.x+w-52<o.y+d-48) o.x=52-w; else o.y=48-d;
    }
  }
  function sorted(room,list) {
    const floors=list.filter(o=>!products[o.k].layer).sort((a,b)=>a.x+a.y-b.x-b.y);
    const walls=list.filter(o=>products[o.k].layer&&products[o.k].wall);
    const rest=list.filter(o=>products[o.k].layer&&!products[o.k].wall)
      .sort((a,b)=>a.x+a.y-b.x-b.y||elevation(room,a)-elevation(room,b));
    const behind=(a,b)=>{const {w,d}=dims(a);return a.x+w<=b.x||a.y+d<=b.y};
    const seen=new Set(), result=[];
    function visit(n) {
      if(seen.has(n)) return;
      seen.add(n);
      for(const m of rest) if(m!==n&&behind(m,n)&&!behind(n,m)) visit(m);
      result.push(n);
    }
    rest.forEach(visit);
    return floors.concat(walls,result);
  }
  function hits(room,tone,ordered,x,y) {
    return ordered.filter(o=>{
      const loc=place(room,tone,o), {s}=loc;
      let px=Math.floor(x-loc.x);
      const py=Math.floor(y-loc.y);
      if(px<0||py<0||px>=s.w||py>=s.h) return false;
      if(o.f) px=s.w-1-px;
      return s.pixels[(py*s.w+px)*4+3]>10;
    }).reverse();
  }
  function mark(ctx,room,tone,o) {
    const {s,x,y}=place(room,tone,o);
    ctx.save();
    if(o.f){ctx.translate(x+s.w+3,y-3);ctx.scale(-1,1);ctx.drawImage(s.ring,0,0)}
    else ctx.drawImage(s.ring,x-3,y-3);
    ctx.restore();
    const z=products[o.k].wall?elevation(room,o):zone(room,o)+o.e;
    const {w,d}=dims(o);
    const corners=[[0,0],[w,0],[w,d],[0,d]].map(([a,b])=>project(room,o.x+a,o.y+b,z));
    ctx.beginPath();
    corners.forEach(([a,b],i)=>i?ctx.lineTo(a+.5,b+.5):ctx.moveTo(a+.5,b+.5));
    ctx.closePath();ctx.strokeStyle='#40243d';ctx.lineWidth=3;ctx.stroke();
    ctx.strokeStyle='#fff4ac';ctx.lineWidth=1;ctx.setLineDash([3,2]);ctx.stroke();ctx.setLineDash([]);
  }
function raster(w,h,draw){
 const surface=document.createElement('canvas');surface.width=w;surface.height=h;
 const brush=surface.getContext('2d');brush.imageSmoothingEnabled=false;draw(brush);
 return surface;
}
function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h);}
function steps(c,x,y,w,h,r,color){
 rect(c,x+r,y,w-2*r,h,color);rect(c,x,y+r,w,h-2*r,color);
 if(r>1)rect(c,x+1,y+1,w-2,h-2,color);
}
const ink="#574351";
const catImage=raster(23,27,c=>{
 rect(c,1,15,4,2,'#bb8471');rect(c,2,17,5,3,'#e5b58c');
 steps(c,6,13,13,12,2,ink);steps(c,7,14,11,10,1,'#f1c798');rect(c,8,23,3,3,'#c79276');rect(c,15,23,3,3,'#c79276');
 for(const x of [5,16]){rect(c,x,1,3,6,ink);rect(c,x+1,3,4,4,'#c99578');}
 steps(c,4,5,18,13,2,ink);steps(c,5,6,16,11,2,'#ffe1b0');rect(c,6,6,4,3,'#c98d71');
 rect(c,8,10,2,2,ink);rect(c,16,10,2,2,ink);rect(c,12,13,2,1,'#ac796f');
 rect(c,7,17,12,2,'#72a393');rect(c,15,19,3,3,'#82b59a');
});
const catBack=raster(23,27,c=>{
 rect(c,17,15,4,3,'#b97e65');rect(c,15,18,5,4,'#dfad83');
 steps(c,6,13,13,12,2,ink);steps(c,7,14,11,10,1,'#efc396');
 for(const x of [5,16]){rect(c,x,1,3,7,ink);rect(c,x+1,3,3,5,'#c78a6e');}
 steps(c,4,5,18,13,2,ink);steps(c,5,6,16,11,2,'#ffdbad');
 rect(c,6,6,5,4,'#c69070');rect(c,15,8,3,2,'#d6a27f');
 rect(c,7,17,12,2,'#75a496');rect(c,8,24,3,2,'#ab7d67');rect(c,15,24,3,2,'#ab7d67');
});
// A seated three-quarter silhouette points its muzzle toward the screen.
const catWatching=raster(23,27,c=>{
 rect(c,3,18,4,3,'#bc886e');rect(c,4,20,7,2,'#e9ba91');
 steps(c,6,13,13,12,2,ink);steps(c,7,14,11,10,2,'#ecc194');
 rect(c,7,22,4,2,'#d2a582');rect(c,15,22,4,2,'#d2a582');
 rect(c,7,2,2,5,ink);rect(c,9,4,3,4,ink);
 rect(c,17,1,2,6,ink);rect(c,15,3,3,5,'#c79275');
 steps(c,5,5,15,12,2,ink);steps(c,6,6,13,10,2,'#ffdaad');
 rect(c,17,8,4,5,'#ffdaad');rect(c,20,10,2,2,ink);
 rect(c,17,8,1,2,'#634c47');rect(c,7,7,4,3,'#ca9679');
 rect(c,8,16,10,2,'#76a395');
});

  // The curled body uses the original side-view face and scarf.
  const sleepingCoat=raster(17,10,c=>{
    steps(c,0,0,17,10,3,ink);steps(c,1,1,15,8,2,'#ecc194');
    rect(c,3,2,4,2,'#c79275');rect(c,7,1,3,2,'#d2a582');
  });
  const sleepingHead=raster(23,17,c=>{
    c.drawImage(catWatching,0,0,23,17,0,0,23,17);
    rect(c,17,8,1,2,'#ffdaad');
    rect(c,15,10,1,1,ink);rect(c,16,11,3,1,ink);
  });
  const wrappedTail=raster(16,6,c=>{
    rect(c,0,0,3,3,ink);rect(c,1,1,3,3,'#c79275');
    rect(c,2,3,11,3,ink);rect(c,3,3,9,2,'#e9ba91');
    rect(c,10,2,5,2,ink);rect(c,11,2,3,1,'#ffe1b0');
  });
  const windCat=raster(23,27,c=>{
    c.drawImage(catWatching,0,5,23,22,0,5,23,22);
    rect(c,2,4,7,2,ink);rect(c,4,6,5,2,'#c79275');
    rect(c,12,3,7,2,ink);rect(c,14,5,4,2,'#e3ad86');
    rect(c,16,8,3,3,'#ffdaad');rect(c,16,10,4,1,ink);
  });

  function drawAppliance(ctx,o,s,kind,time){
    ctx.save();
    if(o.f){ctx.translate(s.w,0);ctx.scale(-1,1)}
    const phase=Math.floor(time/160)%6;
    if(kind==='robot_vacuum'){
      rect(ctx,rear(o)?16:22,rear(o)?8:6,2,1,phase<3?'#a8e4d1':'#478882');
    }else if(kind==='air'){
      const x=o.k==='wall_ac'?17:8,y=o.k==='wall_ac'?19:15;
      for(let i=0;i<3;i++){
        const offset=(phase+i*2)%6;
        rect(ctx,x-i*3-offset,y+i*4+offset,7,2,'#b9ebfd');
        rect(ctx,x-i*3-offset-3,y+i*4+offset+2,4,1,'#79c7df');
      }
    }else if(kind==='styler'){
      drawSteam(ctx,s.w,(time%2100)/2100);
    }else if(kind==='purifier'){
      const color='#9fe0bd';
      for(let i=0;i<3;i++){
        const rise=(phase+i*2)%6;
        const x=Math.round(s.w/2)+(i-1)*5;
        rect(ctx,x,3-rise*2,2,3,color);
        rect(ctx,x+1,2-rise*2,2,1,color);
      }
    }else if(kind==='washer'){
      if(!rear(o)){
        const angle=phase*Math.PI/3;
        for(let i=0;i<3;i++){
          const a=angle+i*2*Math.PI/3;
          rect(ctx,Math.round(10+4*Math.cos(a)),Math.round(96+6*Math.sin(a)+2*Math.cos(a)),2,2,'#a7d6e6');
        }
      }
      rect(ctx,-3-(phase%2),86,1,6,'#a5c2cd');rect(ctx,s.w+1+(phase%2),88,1,6,'#a5c2cd');
    }
    ctx.restore();
  }
  function washerAngle(progress){
    // The sock and the cat's gaze pause together at the far side of the drum.
    const halfTurns=Math.min(1,progress/.55)+Math.max(0,(progress-.82)/.18);
    return Math.PI*halfTurns;
  }
  function pulse(progress,start,end){
    if(progress<=start||progress>=end)return 0;
    return Math.sin(Math.PI*(progress-start)/(end-start))**2;
  }
  function drawSteam(ctx,width,progress){
    // Stagger the wisps so one is always visible above the closed cabinet.
    ctx.save();
    for(let i=0;i<3;i++){
      const rise=(progress+i/3)%1;
      ctx.globalAlpha=.9*Math.sin(Math.PI*rise);
      const x=Math.round(width/2+(i-1)*6+2*Math.sin(rise*2*Math.PI));
      const y=-3-Math.round(rise*14);
      rect(ctx,x-1,y,3,4,'#c8b4c6');
      rect(ctx,x,y-1,3,4,'#fff2e9');
      rect(ctx,x+2,y-3,2,3,'#fff2e9');
    }
    ctx.restore();
  }
  function drawTapEffect(ctx,o,s,fx,originX,originY){
    const {progress,kind}=fx.reaction;
    const localX=x=>o.f?s.w-x:x;
    if(kind==='air'){
      const ventX=localX(o.k==='wall_ac'?17:8),ventY=o.k==='wall_ac'?20:16;
      const headX=fx.cat.x-originX,headY=fx.cat.y-originY-19;
      for(let i=0;i<3;i++){
        const t=(progress*2+i/3)%1;
        const x=Math.round(ventX+(headX-ventX)*t),y=Math.round(ventY+(headY-ventY)*t-4*Math.sin(t*Math.PI));
        rect(ctx,x,y,5,2,'#caeff6');rect(ctx,x+1,y-1,2,1,'#83bfce');
      }
    }else if(kind==='purifier'){
      // Two little streams lift out of the grille, then fade as the cat lowers its chin.
      ctx.save();ctx.globalAlpha=pulse(progress,.02,.98);
      for(let i=0;i<2;i++){
        const rise=(progress*1.5+i*.5)%1;
        const x=localX(7+i*6+Math.round(2*Math.sin(2*Math.PI*rise)));
        const y=1-Math.round(17*rise);
        rect(ctx,x,y,2,4,'#acf0d1');rect(ctx,x+1,y-2,2,2,'#e0fff0');
      }
      ctx.restore();
    }else if(kind==='styler'){
      drawSteam(ctx,s.w,progress);
    }else if(kind==='fridge'){
      if(!rear(o)){
        ctx.save();
        ctx.globalAlpha=pulse(progress,.19,.78)*.85;
        rect(ctx,localX(9),39,1,5,'#fff4cc');rect(ctx,localX(9),42,2,1,'#fff4cc');
        ctx.restore();
      }
    }else if(kind==='vacuum'){
      // Short vibration strokes at the motor, timed just before the cat recoils.
      if(progress>.1&&progress<.39){
        const shake=Math.floor(progress*30)%2;
        for(const x of [-3-shake,s.w+1+shake]){
          rect(ctx,x,13,1,4,'#655a70');rect(ctx,x+1,12,1,2,'#fff1d8');
        }
      }
    }else if(kind==='robot_vacuum'){
      const blink=Math.floor(progress*4)%2;
      rect(ctx,localX(rear(o)?16:22),rear(o)?8:6,2,1,blink?'#a8e4d1':'#478882');
    }else if(!rear(o)){
      const angle=washerAngle(progress);
      const x=Math.round(localX(10+4*Math.cos(angle))),y=Math.round(96-5*Math.sin(angle));
      rect(ctx,x-1,y-2,3,5,'#f7c8ad');rect(ctx,x-2,y+1,3,2,'#eea0a5');
      rect(ctx,x-1,y-2,3,1,'#fff3cf');
    }else{
      // The lower door is out of view. A brief movement at the edge reads from behind.
      const x=localX(1),y=s.h-25-Math.round(2*Math.sin(progress*Math.PI*2));
      rect(ctx,x-2,y,2,5,'#bbd5dc');
    }
  }
  function drawEffects(ctx,o,s,fx,originX,originY) {
    if(fx.reaction?.itemId===o.id)drawTapEffect(ctx,o,s,fx,originX,originY);
    const kind=fx.appliances?.[o.id];
    const robotAlreadyLit=kind==='robot_vacuum'&&fx.reaction?.itemId===o.id;
    if(kind&&!robotAlreadyLit&&!['light-off','light-dim','tv-on'].includes(kind))drawAppliance(ctx,o,s,kind,fx.time);
    if((kind==='tv-on'||(o.id===fx.tv&&fx.playing))&&!rear(o)){
      const tv=o.k==='tvset',x=tv?17:2,y=tv?3:3,w=tv?39:25,h=tv?27:20;
      ctx.save();if(o.f){ctx.translate(s.w,0);ctx.scale(-1,1)}
      // Paint the film into the sloping glass, inside the bezel.
      ctx.transform(1,.5,0,1,x,y);
      ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();ctx.fillStyle='#27375a';ctx.fillRect(0,0,w,h);
      ctx.fillStyle='#c18aaa';ctx.fillRect(0,h*.54,w,h*.46);
      const t=fx.time/100;
      ctx.fillStyle='#ffe8a7';ctx.fillRect((Math.floor(t)%(w+7))-4,4,6,5);
      const cloud=w-(Math.floor(t*.7)%(w+12));
      rect(ctx,cloud,2,8,2,'#dae6ec');rect(ctx,cloud+3,1,3,1,'#dae6ec');
      for(let i=0;i<w;i++){const j=Math.round(h*.67+Math.sin((i+t)/6)*3);ctx.fillStyle='#648f9f';ctx.fillRect(i,j,1,h-j);ctx.fillStyle='#355971';ctx.fillRect(i,j+5,1,h)}
      ctx.restore();
    }
    if(o.k==='floor_lamp'&&kind!=='light-off'&&(kind==='light-dim'||fx.lampLit)){
      const x=s.w/2,y=12;
      const glow=ctx.createRadialGradient(x,y,2,x,y,24);
      glow.addColorStop(0,fx.dim?'rgba(255,209,108,.65)':'rgba(255,225,166,.95)');glow.addColorStop(1,'rgba(255,210,115,0)');
      ctx.fillStyle=glow;ctx.fillRect(x-24,y-24,48,48);
      ctx.fillStyle='#ffe59e';ctx.fillRect(4,3,12,3);
    }
    if(o.k==='window'&&fx.curtain){
      ctx.save();if(o.f){ctx.translate(s.w,0);ctx.scale(-1,1)}
      ctx.transform(1,.5,0,1,2,2);ctx.fillStyle='#be98ae';ctx.fillRect(0,0,50,52);
      for(let j=3;j<50;j+=7){ctx.fillStyle='#926e8c';ctx.fillRect(j,0,2,52)}
      ctx.restore();
    }
  }
  function drawCat(ctx,p,fx) {
    const cat=fx.seat&&fx.facingSide?catWatching:fx.facingAway?catBack:catImage;
    ctx.save();ctx.translate(Math.round(p.x),Math.round(p.y)-(fx.walking?Math.floor(fx.time/110)%2:0));
    if(fx.facingLeft)ctx.scale(-1,1);
    if(fx.reaction)drawReactingCat(ctx,fx.reaction);
    else ctx.drawImage(cat,-11,-24);
    ctx.restore();
  }

  function drawReactingCat(ctx,{kind,progress,wall,settle=1,gazeX=0,gazeY=0}){
    const ease=settle*settle*(3-2*settle);
    if(kind==='styler'){
      // Tuck the shoulders and lower the chin together, keeping the belly on the floor.
      const tuck=Math.round(7*ease);
      const breathe=Math.round(pulse(progress,.05,.85)*ease);
      const shoulderY=-15+Math.round(tuck/2)-breathe;
      ctx.drawImage(sleepingCoat,-6-tuck,shoulderY,13+tuck,-1-shoulderY);
      const headX=-11+Math.round(2*ease),headY=-24+tuck-breathe;
      const face=ease<.6?catWatching:sleepingHead;
      ctx.drawImage(face,0,0,23,17,headX,headY,23,17);
      ctx.drawImage(wrappedTail,-8-Math.round(5*ease),-6,9+tuck,6);
      return;
    }
    let lean=0,lift=0,sprite=catWatching;
    if(kind==='air'){
      const gust=Math.sin(Math.PI*progress);
      lift=(wall?2:0)+gust;
      lean=-gust;
      sprite=windCat;
    }else if(kind==='purifier'){
      const sniff=pulse(progress,.24,.46)+pulse(progress,.52,.77);
      lift=pulse(progress,.03,.94)+sniff;
      lean=2*sniff;
    }else if(kind==='fridge'){
      const look=Math.min(1,pulse(progress,.04,.94)*2);
      lift=-1+4*look;lean=1+look;
    }else if(kind==='vacuum'){
      // The whole cat steps back quickly, then eases forward and peers at the nozzle.
      const recoil=Math.min(1,Math.max(0,(progress-.15)/.12),Math.max(0,(.71-progress)/.32));
      ctx.translate(-Math.round(6*recoil*ease),-Math.round(2*pulse(progress,.15,.32)*ease));
      lean=2*pulse(progress,.63,.99)-recoil;lift=recoil;
    }else if(kind==='robot_vacuum'){
      lift=-1+gazeY;lean=1+gazeX;
    }else{
      const angle=washerAngle(progress);
      lean=2*Math.cos(angle);lift=2*Math.sin(angle);
    }
    // Move the face as one piece. Between the chin and paws, sample every
    // destination row so leaning never opens a transparent seam at the scarf.
    lift=Math.round(lift*ease);
    const chin=14,feet=23;
    for(let y=-lift;y<sprite.height;y++){
      const weight=Math.min(1,Math.max(0,(feet-y)/(feet-chin+lift)));
      const sourceY=y+Math.round(lift*weight);
      ctx.drawImage(sprite,0,sourceY,sprite.width,1,-11+Math.round(lean*ease*weight),y-24,sprite.width,1);
    }
  }

  function paint(ctx,room,tone,ordered,selected,fx) {
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(bg(room,tone),0,0);
    if(fx?.dim) ctx.drawImage(images.get('shade:'+room+':'+tone),0,0);
    let catPainted=false;
    // Draw the seated cat above loose cushions resting on its own seat.
    const sofa=fx?.seat!=null?ordered.find(o=>o.id===fx.seat):null;
    let catLayer=sofa;
    if(sofa){
      const bounds=dims(sofa);
      for(const obj of ordered.slice(ordered.indexOf(sofa)+1)){
        if(!['cushion','cushion2'].includes(obj.k))continue;
        if(obj.x>=sofa.x&&obj.x<sofa.x+bounds.w&&obj.y>=sofa.y&&obj.y<sofa.y+bounds.d)catLayer=obj;
      }
    }
    for(const o of ordered){
      const {s,x,y}=place(room,tone,o);
      if(fx && !catPainted && !fx.seat && products[o.k].layer && !products[o.k].wall && o.x+o.y>fx.depth){
        drawCat(ctx,fx.cat,fx);catPainted=true;
      }
      ctx.drawImage(o.f?s.flipped:s.im,x,y);
      if(fx){
        ctx.save();ctx.translate(x,y);drawEffects(ctx,o,s,fx,x,y);ctx.restore();
        if(o===catLayer){
          drawCat(ctx,fx.cat,fx);catPainted=true;
          if(rear(sofa)){
            const loc=place(room,tone,sofa),rail=sprite('sofa_rail',tone);
            ctx.drawImage(sofa.f?rail.flipped:rail.im,loc.x,loc.y);
          }
        }
      }
    }
    if(fx&&!catPainted)drawCat(ctx,fx.cat,fx);
    if(selected) mark(ctx,room,tone,selected);
  }
  function thumbnail(c,k,tone,pose={f:0}) {
    const x=c.getContext('2d'),s=orientedSprite({...pose,k},tone),flipped=pose.f;
    x.clearRect(0,0,c.width,c.height);
    const scale=Math.min((c.width-4)/s.w,(c.height-4)/s.h,2);
    const w=Math.round(s.w*scale),h=Math.round(s.h*scale);
    x.imageSmoothingEnabled=false;x.drawImage(flipped?s.flipped:s.im,Math.round((c.width-w)/2),Math.round((c.height-h)/2),w,h);
  }
  return {heading,turnTo,facingScreen,products,names,defaults,load,bg,roomData,dims,zone,elevation,project,place,clamp,sorted,hits,paint,thumbnail};
})();
