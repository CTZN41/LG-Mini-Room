// Original MY DOT ROOM atlas, sprite anchors, 2:1 projection and footprint ordering.
const DotScene = (() => {
  const data = DOT_ASSETS;
  const products = Object.fromEntries(data.items.map(item => [item.k, item]));
  const names = {A:'롱 스튜디오', B:'L자 거실', C:'현관 투존'};
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
  // Match the supplied Retro AA sprites at their native pixel pitch. Work inside
  // the existing silhouette so slender handles, vents and touch masks stay intact.
  function finishAppliance(brush,w,h){
    const image=brush.getImageData(0,0,w,h), pixels=image.data;
    let left=w,right=0,top=h,bottom=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      if(!pixels[(y*w+x)*4+3])continue;
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
    }
    const width=Math.max(1,right-left),height=Math.max(1,bottom-top);
    const ink=[30,20,36],paper=[251,245,226],shade=[.9,.875,.96];
    for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
      const i=(y*w+x)*4;
      if(!pixels[i+3])continue;
      const edge=x===left||x===right||y===top||y===bottom||
        !pixels[i-4+3]||!pixels[i+4+3]||!pixels[i-4*w+3]||!pixels[i+4*w+3];
      if(edge){pixels.set(ink,i);continue}
      const r=pixels[i],g=pixels[i+1],b=pixels[i+2],luma=.299*r+.587*g+.114*b;
      const light=(x-left)/width*.42+(y-top)/height*.58+((x+y)%2 ? .045 : -.045);
      // Three stepped tones, with a one-pixel checker transition on the diagonal.
      const highlight=light<.32,shadow=light>.64;
      for(let channel=0;channel<3;channel++){
        let color=(luma-128)*1.16+131+(pixels[i+channel]-luma)*1.3;
        if(shadow)color=color*shade[channel]+(channel===2?4:0);
        if(highlight)color=color*.77+paper[channel]*.23;
        pixels[i+channel]=Math.max(ink[channel],color);
      }
    }
    brush.putImageData(image,0,0);
  }
  function prepareSprite(im,sp,finish){
    const w=im.width,h=im.height;
    const copy=canvas(w,h).getContext('2d');
    copy.drawImage(im,0,0);
    if(finish&&!sp.retroAA)finishAppliance(copy,w,h);
    const art=copy.canvas, flipped=canvas(w,h), fx=flipped.getContext('2d');
    fx.translate(w,0); fx.scale(-1,1); fx.drawImage(art,0,0);
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
    return {im:art,flipped,ring,pixels,w,h,ax:sp.ax,ay:sp.ay,mistOutlet:sp.mistOutlet,outlet:sp.outlet,drumCenter:sp.drumCenter,doorEdge:sp.doorEdge,lid:sp.lid,screen:sp.screen};
  }
  async function load() {
    const jobs=[];
    for (const [group,entries] of Object.entries(data.sprites)) {
      for (const [key,sp] of Object.entries(entries)) jobs.push((async()=>{
        const im=await loadPNG(sp.src);
        const appliance=group==='appl'||products[key.replace(/_rear$/,'')]?.c==='가전';
        images.set(group+':'+key,prepareSprite(im,sp,appliance));
      })());
    }
    for (const [room,tones] of Object.entries(data.rooms)){
      const overlay=loadPNG(tones.pink.woodOverlay);
      for (const [tone,entry] of Object.entries(tones)) jobs.push((async()=>{
        const im=await loadPNG(entry.src);
        images.set(room+':'+tone,im);
        const wood=canvas(im.width,im.height),wc=wood.getContext('2d');
        wc.drawImage(im,0,0);wc.drawImage(await overlay,0,0);images.set('wood:'+room+':'+tone,wood);
        const shade=canvas(im.width,im.height),sc=shade.getContext('2d');
        sc.drawImage(im,0,0);const pixels=sc.getImageData(0,0,im.width,im.height),a=pixels.data;
        const base=[a[0],a[1],a[2]];
        for(let i=0;i<a.length;i+=4){
          const isRoom=Math.abs(a[i]-base[0])+Math.abs(a[i+1]-base[1])+Math.abs(a[i+2]-base[2])>45;
          a[i]=35;a[i+1]=28;a[i+2]=65;a[i+3]=isRoom?95:0;
        }
        sc.putImageData(pixels,0,0);images.set('shade:'+room+':'+tone,shade);
      })());
    }
    await Promise.all(jobs);
  }
  const sprite=(k,t)=>images.get(t+':'+k)||images.get('appl:'+k);
  const bg=(r,t)=>images.get(r+':'+t);
  const roomData=r=>data.rooms[r].pink;
  // Fronts point along +Y, -X, -Y and +X, clockwise on the floor.
  const heading=o=>o.turn??(o.f?3:0);
  const floorDirections=[[0,1],[-1,0],[0,-1],[1,0]];
  const frontStep=turn=>floorDirections[turn];
  const robotTravel=8;
  const directionGuideProducts=new Set(['vacuum','robot_vacuum','puri_p','puri_m','puri_b','tower_ac']);
  const rear=o=>heading(o)===1||heading(o)===2;
  function orientedSprite(o,t){
    const item=products[o.k],part=item.hasDock&&(o.robotPart==='station'||o.robotPart==='mobile')?'_'+o.robotPart:'';
    const key=(item.spriteKey||o.k)+part;
    if(item.body&&!item.nativeWasher){
      const back=rear(o),cacheKey=key+(back?'_rear':'');
      if(!images.has(cacheKey)){
        const raw=CatalogArt.renderBody(item,back);
        images.set(cacheKey,prepareSprite(raw.canvas,raw,false));
      }
      return images.get(cacheKey);
    }
    return (rear(o)&&sprite(key+'_rear',t))||sprite(key,t);
  }
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
      if(!['tvset','standbyme'].includes(products[tv.k].behaviorKey||tv.k))continue;
      const q=center(tv),dx=q.x-p.x,dy=q.y-p.y,dist=dx*dx+dy*dy;
      if(dist<best){best=dist;delta={dx,dy}}
    }
    if(!delta)return null;
    const {dx,dy}=delta;
    return Math.abs(dx)>Math.abs(dy)?(dx<0?1:3):(dy<0?2:0);
  }
  function dims(o) {
    const item=products[o.k];
    const {w,d}=item.previousFootprint&&o.id!=null&&!o.artVersion?item.previousFootprint:item;
    return o.f ? {w:d,d:w} : {w,d};
  }
  function placementBlocker(o,items){
    const product=products[o.k],{w,d}=dims(o);
    return items.find(p=>{
      if(ProductCatalog.componentOnly(p.k))return false;
      if(p.id===o.id)return false;
      const other=products[p.k];
      // Flat decorations can go under furniture. Each wall has its own mounting strip.
      if(product.layer!==other.layer||product.wall!==other.wall)return false;
      if(product.wall&&Boolean(o.f)!==Boolean(p.f))return false;
      const size=dims(p);
      return o.x<p.x+size.w&&o.x+w>p.x&&o.y<p.y+size.d&&o.y+d>p.y;
    });
  }
  // A straight sweep of a rectangular base is itself a rectangle. Touching an
  // edge is safe; occupying floor on both sides of a change in height is not.
  function robotCrossesStep(room,o,travel=robotTravel){
    const {w,d}=dims(o),[dx,dy]=frontStep(heading(o));
    const {W,D,zones}=roomData(room);
    const left=Math.max(0,o.x+Math.min(0,dx*travel)),right=Math.min(W,o.x+w+Math.max(0,dx*travel));
    const top=Math.max(0,o.y+Math.min(0,dy*travel)),bottom=Math.min(D,o.y+d+Math.max(0,dy*travel));
    return zones.some(([x1,y1,x2,y2])=>left<x2&&right>x1&&top<y2&&bottom>y1&&
      (left<x1||right>x2||top<y1||bottom>y2));
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
    const s=orientedSprite(o,tone), item=products[o.k], footprint=dims(o);
    // Centre the current model on the same floor point in pre-catalog saves.
    const x=o.x+(footprint.w-(o.f?item.d:item.w))/2;
    const y=o.y+(footprint.d-(o.f?item.w:item.d))/2;
    const [px,py]=project(room,x,y,elevation(room,o));
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
    list=list.filter(o=>!ProductCatalog.componentOnly(o.k));
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
  // Only visible pixels count toward a near miss, even when two appliances overlap.
  function nearbyTarget(room,tone,ordered,x,y,radius,interactive){
    let best=radius*radius, target=null;
    for(let i=ordered.length-1;i>=0;i--){
      const item=ordered[i];
      if(!interactive(item))continue;
      const loc=place(room,tone,item),{s}=loc;
      const left=Math.max(0,Math.ceil(x-radius-loc.x-.5)),right=Math.min(s.w-1,Math.floor(x+radius-loc.x-.5));
      const top=Math.max(0,Math.ceil(y-radius-loc.y-.5)),bottom=Math.min(s.h-1,Math.floor(y+radius-loc.y-.5));
      for(let py=top;py<=bottom;py++)for(let px=left;px<=right;px++){
        const sx=item.f?s.w-1-px:px;
        if(s.pixels[(py*s.w+sx)*4+3]<=10)continue;
        const xx=loc.x+px+.5,yy=loc.y+py+.5;
        const dist=(xx-x)**2+(yy-y)**2;
        if(dist>=best||hits(room,tone,ordered,xx,yy)[0]!==item)continue;
        best=dist;target=item;
      }
    }
    return target;
  }
  function mark(ctx,room,tone,o,blocked) {
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
    ctx.closePath();
    if(blocked){ctx.fillStyle='rgba(255,68,94,.42)';ctx.fill()}
    ctx.strokeStyle='#40243d';ctx.lineWidth=3;ctx.stroke();
    ctx.strokeStyle=blocked?'#ff667b':'#fff4ac';ctx.lineWidth=1;ctx.setLineDash([3,2]);ctx.stroke();ctx.setLineDash([]);
  }
function raster(w,h,draw){
 const surface=document.createElement('canvas');surface.width=w;surface.height=h;
 const brush=surface.getContext('2d');brush.imageSmoothingEnabled=false;draw(brush);
 return surface;
}
function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h);}
// Pixel arrow pointing down-right in screen space. The tip is the floor anchor.
const frontArrow=raster(21,14,c=>{
  const rows=[
    ' ##','#####','#######',' #######     ##','   #######   ###',
    '     ####### ####','       ###########','         ##########',
    '           ########','          ##########','        #############',
    '          ###########','              #######','                  ###'
  ];
  const filled=(x,y)=>rows[y]?.[x]==='#';
  for(let y=0;y<rows.length;y++)for(let x=0;x<rows[y].length;x++){
    if(!filled(x,y))continue;
    const inside=filled(x-1,y)&&filled(x+1,y)&&filled(x,y-1)&&filled(x,y+1);
    rect(c,x,y,1,1,inside?'#83f6e4':'#243a44');
  }
});
function markFront(ctx,room,o){
  const {w,d}=dims(o),[dx,dy]=frontStep(heading(o)),{W,D}=roomData(room);
  const cx=o.x+w/2,cy=o.y+d/2;
  // Pull the tip inside the room if the appliance faces a wall or the L-shaped cutout.
  let gx=cx,gy=cy;
  for(let reach=(dx?w:d)/2+9;reach>0;reach--){
    const x=cx+dx*reach,y=cy+dy*reach;
    if(x>=1&&x<=W-1&&y>=1&&y<=D-1&&!(room==='B'&&x>51&&y>47)){gx=x;gy=y;break}
  }
  const [x,y]=project(room,gx,gy,zone(room,o));
  ctx.save();ctx.translate(x,y);ctx.scale(dx-dy,dx+dy);
  ctx.drawImage(frontArrow,1-frontArrow.width,1-frontArrow.height);ctx.restore();
}
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

  // A low haunch, planted front paws and a visible muzzle give the seated watcher a profile.
  const seatedWatcher=raster(26,27,c=>{
    steps(c,3,16,13,9,3,ink);steps(c,4,17,12,7,3,'#edc195');
    steps(c,11,14,8,11,2,ink);steps(c,12,15,6,9,1,'#ffdaad');
    rect(c,13,23,4,2,'#bd8b70');rect(c,18,23,3,2,ink);
    rect(c,1,20,3,3,'#bd8b70');rect(c,2,22,7,2,'#d5a481');
    c.drawImage(catWatching,4,0,19,18,5,1,19,18);
    rect(c,17,9,2,2,ink);rect(c,17,11,3,1,'#ffdaad');
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

  function drawRobotLight(ctx,o,s,lit){
    const back=rear(o),item=products[o.k];
    let x=back?20:13,y=back?16:19;
    if(item.catalogFamily==='로봇청소기'){
      if(item.hasDock&&back&&!o.robotPart)return;
      const depth=item.hasDock?(back?2:6):4;
      x=s.ax+2*(4-depth)+(back?2:-2);
      y=s.ay+4+depth-(item.spriteKey.includes('nozzle')?12:8);
    }
    rect(ctx,o.f?s.w-x-2:x,y,2,1,lit?'#a8e4d1':'#478882');
  }
  function topOpeningWasher(item){return item.washerStyle==='top'||item.washerStyle==='drawer'}
  function drawLidIndicator(ctx,o,s,lit){
    if(s.lid){rect(ctx,...s.lid,2,1,lit?'#a5dad4':'#626d77');return}
    // Rear drawings turn the top panel with the cabinet. The caller handles mirroring.
    const pad=products[o.k].washerStyle==='drawer'?4:0;
    rect(ctx,rear(o)?7:36,pad+(rear(o)?11:10),2,1,lit?'#a5dad4':'#626d77');
  }
  function drawAppliance(ctx,o,s,kind,time){
    if(kind==='robot_vacuum'){
      drawRobotLight(ctx,o,s,Math.floor(time/480)%2===0);return;
    }
    ctx.save();
    if(o.f){ctx.translate(s.w,0);ctx.scale(-1,1)}
    const phase=Math.floor(time/160)%6;
    if(kind==='air'){
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
        const [cx,cy]=s.outlet||s.mistOutlet||[Math.round(s.w/2),3];
        const x=cx+(i-1)*5;
        rect(ctx,x,cy-rise*2,2,3,color);
        rect(ctx,x+1,cy-1-rise*2,2,1,color);
      }
    }else if(kind==='washer'){
      const item=products[o.k], [drumX,drumY]=s.drumCenter||[item.modelCode?12:10,item.drumY??96];
      if(topOpeningWasher(item)||(!rear(o)&&s.lid&&item.body?.detail==='opaqueDoor')){
        drawLidIndicator(ctx,o,s,phase<3);
      }else if(!rear(o)){
        const angle=phase*Math.PI/3;
        for(let i=0;i<3;i++){
          const a=angle+i*2*Math.PI/3;
          rect(ctx,Math.round(drumX+4*Math.cos(a)),Math.round(drumY+6*Math.sin(a)+2*Math.cos(a)),2,2,'#a7d6e6');
        }
      }
      const shakeY=item.modelCode?s.h-21:86;
      rect(ctx,-3-(phase%2),shakeY,1,6,'#a5c2cd');rect(ctx,s.w+1+(phase%2),shakeY+2,1,6,'#a5c2cd');
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
    if(kind==='washer'&&products[o.k].catalogFamily==='건조기'&&rear(o))return;
    if(kind==='lamp'||kind==='humidifier')return; // These effects also apply during the approach.
    const localX=x=>o.f?s.w-x:x;
    if(kind==='dehumidifier'){
      const [x,y]=s.outlet||[s.ax,s.ay-29];
      rect(ctx,localX(x)-(o.f?2:0),y,2,1,progress<.5?'#c1f2cd':'#8ccba9');
      return;
    }
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
        const [cx,cy]=s.outlet||s.mistOutlet||[10,1];
        const x=localX(cx-3+i*6+Math.round(2*Math.sin(2*Math.PI*rise)));
        const y=cy-Math.round(17*rise);
        rect(ctx,x,y,2,4,'#acf0d1');rect(ctx,x+1,y-2,2,2,'#e0fff0');
      }
      ctx.restore();
    }else if(kind==='styler'){
      drawSteam(ctx,s.w,progress);
    }else if(kind==='fridge'){
      if(!rear(o)){
        ctx.save();
        ctx.globalAlpha=pulse(progress,.19,.78)*.85;
        const [x,y]=s.doorEdge||[9,39];
        rect(ctx,localX(x),y,1,5,'#fff4cc');rect(ctx,localX(x),y+3,2,1,'#fff4cc');
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
      drawRobotLight(ctx,o,s,Math.floor(progress*4)%2===1);
    }else if(topOpeningWasher(products[o.k])||(!rear(o)&&s.lid&&products[o.k].body?.detail==='opaqueDoor')){
      ctx.save();
      if(o.f){ctx.translate(s.w,0);ctx.scale(-1,1)}
      drawLidIndicator(ctx,o,s,progress<.5);
      ctx.restore();
    }else if(!rear(o)){
      const angle=washerAngle(progress);
      const item=products[o.k];
      const [cx,cy]=s.drumCenter||[item.modelCode?12:10,item.drumY??96];
      const x=Math.round(localX(cx+4*Math.cos(angle))),y=Math.round(cy-5*Math.sin(angle));
      rect(ctx,x-1,y-2,3,5,'#f7c8ad');rect(ctx,x-2,y+1,3,2,'#eea0a5');
      rect(ctx,x-1,y-2,3,1,'#fff3cf');
    }else{
      // The lower door is out of view. A brief movement at the edge reads from behind.
      const x=localX(1),y=s.h-25-Math.round(2*Math.sin(progress*Math.PI*2));
      rect(ctx,x-2,y,2,5,'#bbd5dc');
    }
  }
  function drawEffects(ctx,o,s,fx,originX,originY) {
    if(o.robotPart==='station')return;
    if(fx.mist?.itemId===o.id){
      const [x,y]=s.mistOutlet,vent=o.f?s.w-1-x:x;
      ctx.save();
      const sway=Math.sin(2*Math.PI*fx.mist.phase);
      ctx.globalAlpha=.62;
      rect(ctx,vent-1,y-3,2,3,'#e2f3f4');rect(ctx,vent-1+Math.round(sway),y-5,2,2,'#daeff1');
      for(const offset of [0,1/3,2/3]){
        const rise=(fx.mist.phase+offset)%1;
        const px=vent+Math.round(2*Math.sin(rise*Math.PI*2));
        const py=y-1-Math.round(rise*19);
        ctx.globalAlpha=.85*Math.sin(rise*Math.PI);
        rect(ctx,px-1,py,2,4,'#c1d9df');rect(ctx,px,py-2,2,4,'#f4ffff');
        if(rise>.35)rect(ctx,px+1,py-3,3,2,'#e4f4f7');
      }
      ctx.restore();
    }
    if(fx.reaction?.itemId===o.id)drawTapEffect(ctx,o,s,fx,originX,originY);
    const kind=fx.appliances?.[o.id];
    const robotAlreadyLit=kind==='robot_vacuum'&&fx.reaction?.itemId===o.id;
    if(kind&&!robotAlreadyLit&&!['light-off','light-dim','tv-on'].includes(kind))drawAppliance(ctx,o,s,kind,fx.time);
    if((kind==='tv-on'||(o.id===fx.tv&&fx.playing))&&!rear(o)){
      const tv=o.k==='tvset',[x,y,w,h]=s.screen||products[o.k].screen||(tv?[17,3,39,27]:[2,3,25,20]);
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

  function drawReactingCat(ctx,{kind,progress,wall,settle=1,gazeX=0,gazeY=0,watchingCleaner=false}){
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
    if(kind==='humidifier'||kind==='dehumidifier'){
      ctx.drawImage(seatedWatcher,-11,-24);
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
    }else if(kind==='lamp'){
      lift=2;lean=1;
    }else if(kind==='vacuum'){
      // The whole cat steps back quickly, then eases forward and peers at the nozzle.
      const recoil=Math.min(1,Math.max(0,(progress-.15)/.12),Math.max(0,(.71-progress)/.32));
      ctx.translate(-Math.round(6*recoil*ease),-Math.round(2*pulse(progress,.15,.32)*ease));
      lean=2*pulse(progress,.63,.99)-recoil;lift=recoil;
    }else if(kind==='robot_vacuum'){
      if(watchingCleaner)sprite=seatedWatcher;
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

  function bedPoint(room,tone,o){
    const loc=place(room,tone,o),back=rear(o),x=back?63:80;
    return {x:loc.x+(o.f?loc.s.w-x:x),y:loc.y+(back?71:37),depth:o.x+o.y};
  }
  function drawBedSleeper(ctx,p,o,tone,tucked){
    ctx.save();ctx.translate(p.x,p.y);if(o.f)ctx.scale(-1,1);
    ctx.drawImage(sleepingCoat,-13,-6);ctx.drawImage(sleepingHead,-8,-17);
    const y=2-Math.round(5*tucked),lime=tone==='lime';
    steps(ctx,-14,y,27,8,3,lime?'#89946b':'#bd8396');
    steps(ctx,-13,y,25,6,2,lime?'#d4dfa7':'#f3b5c9');
    rect(ctx,-10,y,19,1,lime?'#edf2d0':'#ffe5ed');
    ctx.restore();
  }
  function paint(ctx,room,tone,ordered,selected,fx,blocked=false,wood=false) {
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(wood?images.get('wood:'+room+':'+tone):bg(room,tone),0,0);
    if(fx?.dim) ctx.drawImage(images.get('shade:'+room+':'+tone),0,0);
    let catPainted=fx?.sleepBed!=null;
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
      const glow=fx?.focusedProduct===o.id&&fx.tapGlow>0;
      if(glow){ctx.save();ctx.filter='brightness('+(1+0.25*fx.tapGlow)+')'}
      ctx.drawImage(o.f?s.flipped:s.im,x,y);
      if(glow)ctx.restore();
      if(fx){
        ctx.save();ctx.translate(x,y);drawEffects(ctx,o,s,fx,x,y);ctx.restore();
        if(o.id===fx.sleepBed)drawBedSleeper(ctx,bedPoint(room,tone,o),o,tone,fx.tucked);
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
    if(selected&&(!fx||fx.focusedProduct!==selected.id)){
      mark(ctx,room,tone,selected,blocked);
      if(!fx&&directionGuideProducts.has(products[selected.k].behaviorKey||selected.k))markFront(ctx,room,selected);
    }
  }
  function thumbnail(c,k,tone,pose={f:0}) {
    const x=c.getContext('2d'),s=orientedSprite({...pose,k},tone),flipped=pose.f;
    x.clearRect(0,0,c.width,c.height);
    const scale=Math.min((c.width-4)/s.w,(c.height-4)/s.h,2);
    const w=Math.round(s.w*scale),h=Math.round(s.h*scale);
    x.imageSmoothingEnabled=false;x.drawImage(flipped?s.flipped:s.im,Math.round((c.width-w)/2),Math.round((c.height-h)/2),w,h);
  }
  return {heading,frontStep,robotTravel,robotCrossesStep,turnTo,facingScreen,products,names,defaults,load,bg,roomData,dims,placementBlocker,zone,elevation,project,place,bedPoint,clamp,sorted,hits,nearbyTarget,paint,thumbnail};
})();
