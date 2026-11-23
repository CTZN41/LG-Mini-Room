// Pixel artwork is drawn once at its native resolution. The room, thumbnails and hit
// tests share these same transparent sprites.
const unit=20;
const ink='#574351',cream='#fff3dc';
function raster(w,h,draw){
 const surface=document.createElement('canvas');surface.width=w;surface.height=h;
 const brush=surface.getContext('2d');brush.imageSmoothingEnabled=false;draw(brush);
 return surface;
}
function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h);}
function framed(c,x,y,w,h,color,line=ink){
 rect(c,x,y,w,h,line);rect(c,x+1,y+1,w-2,h-2,color);
}
function steps(c,x,y,w,h,r,color){
 rect(c,x+r,y,w-2*r,h,color);rect(c,x,y+r,w,h-2*r,color);
 if(r>1)rect(c,x+1,y+1,w-2,h-2,color);
}
function cushion(c,x,y,w,h,fill,highlight){
 steps(c,x,y,w,h,2,ink);steps(c,x+1,y+1,w-2,h-2,1,fill);rect(c,x+3,y+2,w-6,1,highlight);
}
function plant(c,x,y){
 rect(c,x+4,y+4,1,9,'#536f60');rect(c,x+1,y+3,4,3,'#76a78a');rect(c,x,y+1,3,3,'#a0c690');
 rect(c,x+5,y+2,4,3,'#699b74');rect(c,x+8,y,2,3,'#92b97e');rect(c,x+3,y+7,4,2,'#83b47c');
 framed(c,x+1,y+10,8,6,'#e39c87');rect(c,x,y+10,10,2,'#ba7d75');
}
function roomArt(green,rows){
 const height=52+14*rows;
 return raster(248,height,c=>{
  const wallpaper=green?'#deebbf':'#f9ced8',mid=green?'#a4c58a':'#dd9caf',light=green?'#edf3d6':'#ffe6e7';
  framed(c,2,2,244,height-4,'#ab8679');rect(c,4,4,240,42,wallpaper);
  for(let x=5;x<244;x+=8){rect(c,x,5,1,38,light);rect(c,x+2,5,1,38,light);}
  rect(c,4,4,240,2,cream);rect(c,4,42,240,5,mid);rect(c,4,43,240,2,light);
  const tones=['#edcda8','#f3d7b2','#e8c39e','#f5dabb','#efcdab'];
  for(let j=0;j<rows;j++){
   const y=47+j*14;rect(c,4,y,240,14,'#c9a185');
   for(let k=-1;k<5;k++){
    const x=4+k*60+j%3*20,l=Math.max(4,x),r=Math.min(244,x+59);
    if(r<=l)continue;
    rect(c,l,y+1,r-l,13,tones[(j+k+6)%5]);rect(c,l,y+1,r-l,1,'#f7dfc2');
    if(r-l>26){rect(c,l+8,y+7,14,1,'#dfba99');rect(c,l+22,y+6,3,1,'#dfba99');}
   }
  }
  // A door, a glazed window and a built-in shelf sit above the playable floor.
  framed(c,13,8,28,38,'#b88882');framed(c,16,10,22,35,mid);
  framed(c,18,13,18,19,wallpaper,'#b68d89');rect(c,32,34,3,2,'#ffe098');
  rect(c,13,45,28,2,cream);
  framed(c,86,8,70,29,cream);framed(c,89,10,64,23,'#aadddf','#a48e90');
  rect(c,90,24,62,8,'#c8e7e3');
  for(const x of [97,129])for(let n=0;n<7;n++)rect(c,x+n,12+n,2,1,'#ecf9ed');
  rect(c,119,10,2,23,cream);rect(c,90,21,62,1,cream);
  for(const x of [83,151]){
   framed(c,x,8,7,28,mid);rect(c,x+2,9,2,24,wallpaper);rect(c,x,23,7,2,cream);
  }
  framed(c,82,36,77,4,'#d1aa8e');
  framed(c,172,26,53,4,'#d9af91');plant(c,208,10);
  for(let i=0;i<5;i++)framed(c,175+i*5,13+i%3,5,13-i%3,['#a2c4a4','#e5b296','#acd1cf','#c7afcb','#ebc48c'][i]);
  framed(c,51,13,15,18,'#dbb191');rect(c,53,15,11,14,cream);rect(c,56,20,3,6,'#7d9c80');rect(c,59,18,3,3,'#a8be86');rect(c,55,25,7,2,'#c68779');
  rect(c,4,height-5,240,2,'#a77d68');
  // Woven floor inlays anchor the entry and the seating area in a flat floor plan.
  framed(c,13,48,29,9,green?'#a8ba95':'#d4ab9f','#b89983');
  rect(c,16,51,23,1,'#f3ddbe');rect(c,16,54,23,1,'#f3ddbe');
  const rugY=47+Math.round(rows*8),rugH=Math.round(rows*3.2);
  const edge=green?'#9ea88b':'#c6a297',weave=green?'#d1d9b5':'#ead1b7';
  for(let x=67;x<182;x+=5){rect(c,x,rugY-2,2,2,edge);rect(c,x,rugY+rugH,2,2,edge);}
  steps(c,64,rugY,120,rugH,2,edge);steps(c,66,rugY+2,116,rugH-4,2,weave);
  for(const x of [68,177])rect(c,x,rugY+3,2,rugH-6,edge);
  for(const y of [rugY+4,rugY+rugH-6])for(let x=73;x<174;x+=6)rect(c,x,y,3,1,edge);
 });
}
function television(c){
 framed(c,1,23,68,16,'#d4b297');framed(c,1,21,68,7,'#f4e5d4');
 for(const x of [3,25,47]){framed(c,x,28,20,8,'#fff1df','#ac8d86');rect(c,x+7,30,6,1,'#ab9386');}
 rect(c,6,39,4,2,ink);rect(c,60,39,4,2,ink);
 rect(c,32,20,6,4,ink);rect(c,24,24,22,2,'#494451');
 framed(c,7,1,56,22,'#383446');rect(c,9,3,52,17,'#363443');
 rect(c,11,4,19,1,'#4a4655');rect(c,58,21,2,1,'#d29a9e');
}
function sofa(c){
 for(const x of [4,55])rect(c,x,32,5,3,ink);
 cushion(c,1,5,63,28,'#78ac97','#b7dfc2');cushion(c,3,1,59,12,'#99c9ad','#cfe7c4');
 for(const x of [8,33])cushion(c,x,12,25,16,'#b8dfbc','#d9edcb');
 for(const x of [1,57])cushion(c,x,9,7,20,'#91c3a7','#bde1bd');
 cushion(c,10,7,9,8,'#ebbaaa','#f9dbbc');cushion(c,46,7,9,8,'#e9d09f','#fff0c5');
}
function bedArt(c){
 framed(c,1,2,35,46,'#c99d83');framed(c,1,0,35,6,'#dbb291');framed(c,3,5,31,40,'#fff1dd');
 cushion(c,7,6,23,9,'#fff3de','#fffaf0');framed(c,2,17,33,29,'#e8a5b6','#9c7682');
 rect(c,3,18,31,4,'#ffdae1');rect(c,5,22,2,22,'#f9c5d3');rect(c,30,22,2,22,'#d795aa');
 for(const x of [12,21])for(const y of [26,36]){rect(c,x,y,3,1,'#f9d4da');rect(c,x+1,y-1,1,3,'#f9d4da');}
}
function lampArt(c){
 steps(c,2,23,17,7,2,ink);steps(c,3,24,15,4,1,'#c6ae9c');rect(c,9,11,3,15,'#8c7978');
 rect(c,10,11,1,14,cream);steps(c,2,2,17,13,3,ink);steps(c,3,3,15,11,2,'#eed9ad');
 rect(c,5,3,3,9,'#fff0d1');rect(c,4,13,13,1,'#c49d83');rect(c,8,1,5,2,'#ab8d74');
}
function tableArt(c){
 for(const x of [4,20])rect(c,x,15,3,8,'#99745f');
 steps(c,1,4,26,15,3,ink);steps(c,2,5,24,12,2,'#e6bd92');rect(c,5,5,18,1,'#fff1c7');
 framed(c,5,8,9,5,'#83b7a4','#6e8b79');rect(c,6,12,7,1,'#f2e1bc');
 framed(c,17,7,5,5,'#fff1d6','#b39379');rect(c,22,8,2,2,'#ad8d73');
}
const definitions={
 tv:{w:70,h:41,base:31,draw:television},sofa:{w:65,h:35,base:19,draw:sofa},
 bed:{w:37,h:49,base:25,draw:bedArt},lamp:{w:21,h:31,base:26,draw:lampArt},
 table:{w:28,h:24,base:14,draw:tableArt}
};
const sprites={};
for(const [id,def] of Object.entries(definitions)){
 const image=raster(def.w,def.h,def.draw);
 sprites[id]={...def,image,alpha:image.getContext('2d').getImageData(0,0,def.w,def.h).data,thumbnail:image.toDataURL()};
}
export function furnitureThumbnail(id){return sprites[id].thumbnail;}
const roomImages=new Map();
function backdrop(theme,rows){
 const key=theme+rows;
 if(!roomImages.has(key))roomImages.set(key,roomArt(theme==='sage',rows));
 return roomImages.get(key);
}
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
const stage=document.querySelector('.stage'),canvas=stage.querySelector('canvas');
const ctx=canvas.getContext('2d'),note=document.querySelector('#context');
const ids=Object.keys(sprites),spots=Object.fromEntries(ids.map(id=>[id,stage.querySelector('.spot.'+id)]));
const defaults={tv:[-2.72,-1.42,.16],sofa:[2.05,1.02,-1.02],lamp:[3.36,-1.48,0],bed:[4.79,-2.27,0],table:[-.23,.47,0]};
const footprints={tv:[3.64,1.07],sofa:[3.38,1.56],lamp:[.88,.88],bed:[1.82,2.30],table:[1.32,1.32]};
const radians=degrees=>degrees*Math.PI/180;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function furniturePose(layout,id){
 const [x,z,base]=defaults[id],p=layout?.[id],angle=base*180/Math.PI;
 if(!Number.isFinite(p?.x)||!Number.isFinite(p?.z))return {x,z,angle:(angle+360)%360};
 const degrees=Number.isFinite(p.angle)?p.angle:angle+(Number.isInteger(p.turn)?90*p.turn:0);
 return {x:p.x,z:p.z,angle:((degrees%360)+360)%360};
}
function footprint(id,pose){
 const [w,d]=footprints[id];return {...pose,w,d,angle:radians(pose.angle)};
}

function axes(rect){
 return [[Math.cos(rect.angle),-Math.sin(rect.angle)],[Math.sin(rect.angle),Math.cos(rect.angle)]];
}
function extent(rect,dx,dz){
 const [a,b]=axes(rect);
 return .5*(rect.w*Math.abs(a[0]*dx+a[1]*dz)+rect.d*Math.abs(b[0]*dx+b[1]*dz));
}
function overlaps(a,b){
 return [...axes(a),...axes(b)].every(([dx,dz])=>
  Math.abs((a.x-b.x)*dx+(a.z-b.z)*dz)<extent(a,dx,dz)+extent(b,dx,dz)+.025);
}
export function placementIssue(layout,id,pose,items){
 const rect=footprint(id,pose);
 if(Math.abs(rect.x)+extent(rect,1,0)>5.93||Math.abs(rect.z)+extent(rect,0,1)>3.48)return '방 안쪽 칸을 선택하세요';
 const others=ids.filter(key=>key!==id&&items[key])
  .map(key=>footprint(key,furniturePose(layout,key)));
 if(others.some(other=>overlaps(rect,other)))return '다른 가구와 겹쳐요';
 return '';
}

let scene,editingItem,allowFurnitureDrag,anchor='tv',dragPose;
let zoom=1,turn=0,panX=0,panY=0,timer=0,start=0;
let floorRows=10,depthScale=1;
let camera={x:0,y:0,s:1},order=[],bounds={},lastShelfHeight=0;
let path=[],catAt={x:-1.05,z:1.86},reaction='',walkStart=0;
const limits={near:1.6,far:.8},reduced=matchMedia('(prefers-reduced-motion: reduce)');
function rotate(x,y,a){return {x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a)};}
function screenPoint(x,z){
 const p=rotate(x*unit,z*unit*depthScale,turn);
 return {x:camera.x+p.x*camera.s,y:camera.y+p.y*camera.s};
}
function worldPoint(e){
 const r=canvas.getBoundingClientRect();
 const p=rotate((e.clientX-r.left-camera.x)/camera.s,(e.clientY-r.top-camera.y)/camera.s,-turn);
 return {x:p.x/unit,z:p.y/(unit*depthScale)};
}
function pose(id){return dragPose?.id===id?dragPose.pose:scene.draft?.id===id?scene.draft.pose:furniturePose(scene.layout,id);}
function frameRoom(){
 const w=stage.clientWidth,h=stage.clientHeight,portrait=h>w;
 const top=portrait?103:52,dock=stage.hasAttribute('data-docked')?312:0;
 const shelf=document.querySelector('#inventory');
 if(!shelf.hidden&&portrait)lastShelfHeight=shelf.offsetHeight;
 const tray=portrait&&(!shelf.hidden||stage.hasAttribute('data-dragging'))?lastShelfHeight+18:0;
 stage.style.setProperty('--tray-height',tray+'px');
 const bottom=portrait?Math.max(78,tray+60):44;
 // The portrait map extends downward on a phone. Stored points are normalized to the
 // same floor, so a resize neither rewrites a layout nor stretches individual sprites.
 floorRows=portrait?clamp(Math.round(((h-292)*248/(w-22)-52)/14),17,22):10;
 depthScale=floorRows/10;
 const nativeH=52+14*floorRows;
 const roomW=turn%Math.PI===0?248:nativeH,roomH=turn%Math.PI===0?nativeH:248;
 const s=Math.max(.30,Math.min((w-dock-22)/roomW,(h-top-bottom-10)/roomH))*zoom;
 const center=rotate(0,21,turn);
 camera={s,x:(w-dock)/2+center.x*s+panX,y:top+(h-top-bottom)/2+center.y*s+panY};
}
function cameraAction(action){
 if(action==='reset'){zoom=1;turn=0;panX=panY=0;}
 if(action==='left'||action==='right')turn=((Math.round(turn/(Math.PI/2))+(action==='left'?-1:1)+4)%4)*Math.PI/2;
 if(action==='in'||action==='out')zoom=clamp(zoom+(action==='in'?.15:-.15),limits.far,limits.near);
 draw();
}
document.querySelector('.camera').addEventListener('click',e=>{const b=e.target.closest('[data-camera]');if(b)cameraAction(b.dataset.camera);});
function objectBounds(id){
 const p=pose(id),sp=sprites[id],c=screenPoint(p.x,p.z);
 const corners=[];
 for(const x of [-sp.w/2,sp.w/2])for(const y of [-sp.base,sp.h-sp.base]){
  const v=rotate(x,y,turn-radians(p.angle));corners.push([c.x+v.x*camera.s,c.y+v.y*camera.s]);
 }
 const xs=corners.map(v=>v[0]),ys=corners.map(v=>v[1]);
 return {left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys)};
}
function syncSpots(){
 for(const id of ids){
  const b=bounds[id]=objectBounds(id);
  Object.assign(spots[id].style,{left:b.left+'px',top:b.top+'px',width:(b.right-b.left)+'px',height:(b.bottom-b.top)+'px'});
 }
 locateNote();
}
function locateNote(){
 if(note.hidden||!bounds[anchor]||note.classList.contains('playback'))return;
 const b=bounds[anchor],w=note.offsetWidth,h=note.offsetHeight;
 stage.style.setProperty('--x',((b.left+b.right-w)/2)+'px');
 stage.style.setProperty('--y',(b.bottom+h+65<stage.clientHeight?b.bottom+5:b.top-h-5)+'px');
 stage.style.setProperty('--ch',h+'px');
}
export function focusObject(id){anchor=id;locateNote();}
export function captureRoom(){draw();return canvas.toDataURL('image/png');}
function pick(e,visible=order){
 const point=worldPoint(e);
 for(const id of [...order].reverse()){
  if(!visible.includes(id))continue;
  const p=pose(id),sp=sprites[id],v=rotate((point.x-p.x)*unit,(point.z-p.z)*unit*depthScale,radians(p.angle));
  const x=Math.floor(v.x+sp.w/2),y=Math.floor(v.y+sp.base);
  if(x>=0&&y>=0&&x<sp.w&&y<sp.h&&sp.alpha[4*(y*sp.w+x)+3]>10)return id;
 }
 return null;
}
function film(c,t){
 for(let y=0;y<17;y++)rect(c,9,3+y,52,1,['#59537f','#8a6894','#c9809d','#edac9e'][Math.min(3,y>>2)]);
 steps(c,44,5,6,6,1,'#ffe8aa');
 for(let x=0;x<52;x++){
  const y=Math.round(12+2*Math.sin(x*.22+t*.9)+Math.sin(x*.53+t));
  rect(c,9+x,y,1,20-y,'#8a7093');
  const z=Math.round(16+1.4*Math.sin(x*.31+t*1.4));rect(c,9+x,z,1,20-z,'#514666');
 }
}
const movieScreen=raster(70,41,()=>{});
const movieBrush=movieScreen.getContext('2d');
function showItem(id,t){
 const sp=sprites[id],p=pose(id);
 ctx.save();ctx.translate(p.x*unit,p.z*unit*depthScale);ctx.rotate(-radians(p.angle));
 ctx.translate(-sp.w/2,-sp.base);ctx.drawImage(sp.image,0,0);
 if(id==='tv'&&scene.on){
  if(scene.movie){film(movieBrush,t);ctx.drawImage(movieScreen,0,0);}
  else{rect(ctx,9,3,52,17,'#8bc4d4');rect(ctx,9,13,52,7,'#bbdbd3');steps(ctx,47,5,5,5,1,'#ffe4ac');}
 }
 if(id==='lamp'&&scene.lampLevel){
  steps(ctx,3,3,15,11,2,scene.dim?'#ffcf8a':'#ffeeb8');rect(ctx,5,4,3,8,'#fff8da');
 }
 ctx.restore();
}
function outline(){
 if(!editingItem)return;
 const p=pose(editingItem),[w,d]=footprints[editingItem].map(n=>n*unit);
 const point=(x,z)=>{const v=rotate(x,z,-radians(p.angle));return [p.x*unit+v.x,(p.z*unit+v.y)*depthScale];};
 ctx.save();ctx.strokeStyle=(dragPose?dragPose.issue:scene.issue)?'#db3756':'#fff4ae';
 const corners=[point(-w/2,-d/2),point(w/2,-d/2),point(w/2,d/2),point(-w/2,d/2)];
 ctx.lineWidth=1.5;ctx.setLineDash([4,2]);ctx.beginPath();ctx.moveTo(...corners[0]);
 for(const corner of corners.slice(1))ctx.lineTo(...corner);
 ctx.closePath();ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=ctx.strokeStyle;
 ctx.beginPath();ctx.moveTo(...point(-3,d/2+1));ctx.lineTo(...point(3,d/2+1));ctx.lineTo(...point(0,d/2+4));ctx.fill();ctx.restore();
}
function glow(){
 if(!order.includes('lamp')||!scene.lampLevel)return;
 const p=pose('lamp'),x=p.x*unit,y=p.z*unit*depthScale,r=scene.dim?17:26;
 const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'#ffe2a6');g.addColorStop(1,'rgba(255,208,120,0)');
 ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
}
function draw(now=performance.now()){
 clearTimeout(timer);if(!scene)return;
 const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 frameRoom();ctx.setTransform(1,0,0,1,0,0);ctx.imageSmoothingEnabled=false;
 rect(ctx,0,0,w,h,scene.theme==='sage'?'#30483a':'#573d59');
 for(let y=25;y<h;y+=74)for(let x=(y%31)*3;x<w;x+=109)rect(ctx,x,y,2,2,scene.theme==='sage'?'#47614f':'#745775');
 ctx.save();ctx.translate(camera.x,camera.y);ctx.scale(camera.s,camera.s);ctx.rotate(turn);
 const wallTop=-47-7*floorRows;
 ctx.drawImage(backdrop(scene.theme,floorRows),-124,wallTop);
 const t=reduced.matches?0:(now-start)/1000;
 if(scene.curtains){
  const width=32*(reduced.matches?1:clamp(t/.55,0,1));
  for(const x of [-34,30-width]){
   rect(ctx,x,wallTop+10,width,23,'#b18ba2');for(let i=1;i<width;i+=4)rect(ctx,x+i,wallTop+10,1,23,'#d7aec0');
  }
 }
 if(scene.dim)rect(ctx,-122,wallTop+2,244,48+14*floorRows,'rgba(39,29,57,.42)');
 if(scene.editing){
  ctx.strokeStyle='#80667c55';ctx.lineWidth=.65;ctx.beginPath();
  for(let x=-120;x<=120;x+=10){ctx.moveTo(x,-70*depthScale);ctx.lineTo(x,70*depthScale);}
  for(let y=-70;y<=70;y+=10){ctx.moveTo(-120,y*depthScale);ctx.lineTo(120,y*depthScale);}ctx.stroke();
 }
 order=ids.filter(id=>scene.items[id]||id===editingItem).sort((a,b)=>pose(a).z-pose(b).z);glow();
 for(const id of order)showItem(id,t);
 const elapsed=now-walkStart,moving=path.length>1&&!reduced.matches&&elapsed<650;
 if(path.length)catAt=alongPath(path,moving?clamp(elapsed/650,0,1):1);
 if(!scene.editing&&(order.includes('tv')||order.includes('lamp'))){
  ctx.save();ctx.translate(catAt.x*unit,catAt.z*unit*depthScale);
  const facing=pose(scene.visitLamp?'lamp':'tv');
  const reacting=scene.watch||scene.visitLamp;
  if(reacting&&facing.x<catAt.x)ctx.scale(-1,1);
  const facingAway=reacting&&facing.z<catAt.z-.2;
  ctx.drawImage(facingAway?catBack:catImage,-11,-22+(moving?Math.floor(elapsed/100)%2:0));ctx.restore();
 }
 outline();ctx.restore();syncSpots();
 document.querySelector('[data-camera=in]').disabled=zoom>=limits.near;
 document.querySelector('[data-camera=out]').disabled=zoom<=limits.far;
 if(!document.hidden&&(moving||scene.movie&&!reduced.matches))timer=setTimeout(draw,moving?33:100);
}
function alongPath(points,t){
 const lengths=points.slice(1).map((b,i)=>Math.hypot(b.x-points[i].x,b.z-points[i].z));
 let left=t*lengths.reduce((a,b)=>a+b,0);
 for(let i=0;i<lengths.length;i++){
  if(left<=lengths[i]&&lengths[i]){const a=points[i],b=points[i+1],f=left/lengths[i];return {x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f};}
  left-=lengths[i];
 }
 return points.at(-1);
}
function catRoute(){
 const obstacles=orderForScene().map(id=>footprint(id,pose(id)));
 const free=p=>Math.abs(p.x)<5.8&&Math.abs(p.z)<3.35&&!obstacles.some(o=>overlaps(o,{...p,w:.34,d:.34,angle:0}));
 let idle={x:-1.05,z:1.86};
 if(!free(idle)){for(let z=3;z>=-3&&!free(idle);z-=.5)for(let x=-5.5;x<5.6;x+=.5){if(free({x,z})){idle={x,z};break;}}}
 if(!scene.watch&&!scene.visitLamp)return [idle];
 const seat=scene.watch&&scene.items.sofa,id=seat?'sofa':scene.visitLamp?'lamp':'tv',p=pose(id);
 const [w,d]=footprints[id],options=[[0,d/2+.45],[w/2+.45,0],[-w/2-.45,0],[0,-d/2-.45]];
 const targets=options.map(([x,z])=>{const r=rotate(x,z,-radians(p.angle));return {x:p.x+r.x,z:p.z+r.y};}).filter(free);
 const queue=[{p:idle,parent:null}],visited=new Set();
 for(let i=0;i<queue.length;i++){
  const n=queue[i],end=targets.find(v=>Math.hypot(n.p.x-v.x,n.p.z-v.z)<.43&&free({x:(n.p.x+v.x)/2,z:(n.p.z+v.z)/2}));
  if(end){const result=[end];for(let v=n;v;v=v.parent)result.unshift(v.p);if(seat)result.push({x:p.x,z:p.z});return result;}
  for(const [dx,dz] of [[.35,0],[-.35,0],[0,.35],[0,-.35]]){
   const v={x:n.p.x+dx,z:n.p.z+dz},key=Math.round(v.x*100)+','+Math.round(v.z*100);
   if(!visited.has(key)&&free(v)){visited.add(key);queue.push({p:v,parent:n});}
  }
 }
 return [idle];
}
function orderForScene(){return ids.filter(id=>scene.items[id]);}
export function paint(next){
 const previous=scene;scene=next;dragPose=null;editingItem=next.draft?.id;allowFurnitureDrag=next.allowDrag;
 if(next.movie&&!previous?.movie)start=performance.now();
 const key=JSON.stringify([next.watch,next.visitLamp,next.items,next.layout]);
 if(key!==reaction){path=catRoute();walkStart=next.animate?performance.now():-1000;reaction=key;}
 draw();
}
export function previewDrag(id,pose,issue){dragPose={id,pose,issue};draw();}
new ResizeObserver(()=>draw()).observe(stage);
new ResizeObserver(locateNote).observe(note);

canvas.addEventListener('keydown',e=>{
 if(editingItem && e.key.startsWith('Arrow')){
  e.preventDefault();
  const offset={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
  if(offset){
   const quadrant=-turn,[dx,dz]=offset,obj=pose(editingItem);
   stage.dispatchEvent(new CustomEvent('place-cell',{detail:{
    x:Math.round(obj.x*2+dx*Math.cos(quadrant)+dz*Math.sin(quadrant))/2,
    z:Math.round(obj.z*2-dx*Math.sin(quadrant)+dz*Math.cos(quadrant))/2}}));
  }
  return;
 }
 const action={Home:'reset',ArrowLeft:'left',ArrowRight:'right','+':'in','=':'in','-':'out'}[e.key];
 if(action){e.preventDefault();cameraAction(action);}
});
const pointers=new Map();
let touchButton=null;
let gesture=null,moved=false,pinchStart=0,pinchZoom=1,blockClickUntil=0,dragHandlers;
export function setDragHandlers(handlers){dragHandlers=handlers;}
function separation(){
 const [a,b]=pointers.values();return Math.hypot(a.x-b.x,a.y-b.y);
}
function cancelDrag(){
 if(gesture?.active)dragHandlers.cancel();
 gesture=null;
}
stage.addEventListener('pointerdown',e=>{
 if(!pointers.size)blockClickUntil=0;
 const button=e.target.closest('button:not(.spot)');
 touchButton=e.pointerType==='touch'&&button&&!button.disabled?{button,id:e.pointerId,x:e.clientX,y:e.clientY}:null;
 const card=e.target.closest('[data-pick]');
 if(e.button!==0||(!card&&!e.target.closest('canvas,.spot')))return;
 if(!pointers.size)moved=false;
 pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,originX:e.clientX,originY:e.clientY});
 if(pointers.size>1){
  cancelDrag();moved=true;pinchStart=Math.max(1,separation());pinchZoom=zoom;return;
 }
 const label=e.target.closest('.spot span')?.parentElement;
 const labeled=label&&Object.keys(spots).find(k=>spots[k]===label);
 const id=card?.dataset.pick||(allowFurnitureDrag&&(labeled||pick(e)));
 if(!id||(editingItem&&editingItem!==id))return;
 const floorPoint=worldPoint(e),pos=pose(id);
 gesture={id,pointerId:e.pointerId,catalog:!!card,active:false,
  dx:card?0:pos.x-floorPoint.x,dz:card?0:pos.z-floorPoint.z};
});
function positionFromPointer(e){
 const floorPoint=worldPoint(e);
 return {x:floorPoint.x+gesture.dx,z:floorPoint.z+gesture.dz};
}
stage.addEventListener('pointermove',e=>{
 if(touchButton?.id===e.pointerId&&Math.hypot(e.clientX-touchButton.x,e.clientY-touchButton.y)>=5)touchButton=null;
 const p=pointers.get(e.pointerId);if(!p)return;
 const threshold=e.pointerType==='touch'&&!gesture?.catalog?10:5;
 if(!moved&&Math.hypot(e.clientX-p.originX,e.clientY-p.originY)<threshold)return;
 const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
 const first=!moved;moved=true;
 if(first)stage.setPointerCapture(e.pointerId);
 if(gesture?.pointerId===e.pointerId){
  if(first)gesture.active=dragHandlers.begin(gesture.id,gesture.catalog);
  if(gesture.active)dragHandlers.move(positionFromPointer(e),e);
  return;
 }
 if(pointers.size===2)zoom=clamp(pinchZoom*separation()/pinchStart,limits.far,limits.near);
 else if(pointers.size===1){panX=clamp(panX+dx,-stage.clientWidth*.28,stage.clientWidth*.28);panY=clamp(panY+dy,-stage.clientHeight*.20,stage.clientHeight*.20);}
 draw();
});
function release(e){
 if(touchButton?.id===e.pointerId){
  const {button}=touchButton;touchButton=null;
  if(e.type==='pointerup'&&button.contains(document.elementFromPoint(e.clientX,e.clientY))){
   blockClickUntil=performance.now()+450;button.click();
  }
 }
 if(!pointers.has(e.pointerId))return;
 pointers.delete(e.pointerId);
 if(gesture?.pointerId===e.pointerId){
  if(gesture.active){
   if(e.type==='pointerup')dragHandlers.drop(positionFromPointer(e),e);
   else dragHandlers.cancel();
  }else if(!moved&&e.type==='pointerup'&&!gesture.catalog&&!editingItem&&!spots[gesture.id].hidden){
   blockClickUntil=performance.now()+450;spots[gesture.id].click();
  }
  gesture=null;
 }
 if(moved)blockClickUntil=performance.now()+450;
}
stage.addEventListener('pointerup',release);
stage.addEventListener('pointercancel',release);
stage.addEventListener('lostpointercapture',e=>{if(e.target===stage)release(e);});
window.addEventListener('blur',()=>{cancelDrag();pointers.clear();});
stage.addEventListener('click',e=>{
 if(e.detail&&performance.now()<blockClickUntil){e.preventDefault();e.stopImmediatePropagation();blockClickUntil=0;return;}
 if(e.detail===0||e.target.closest('.spot span'))return;
 const button=e.target.closest('.spot');
 if(!button&&e.target!==canvas)return;
 if(editingItem){e.stopImmediatePropagation();return;}
 const visible=Object.keys(spots).filter(id=>!spots[id].hidden);
 const id=pick(e,visible);
 const picked=id?spots[id]:null;
 if(button!==picked){e.stopImmediatePropagation();picked?.click();}
},true);
stage.addEventListener('wheel',e=>{
 if(gesture?.active||!e.target.closest('canvas,.spot'))return;
 e.preventDefault();zoom=clamp(zoom*Math.exp(-e.deltaY*.0015),limits.far,limits.near);draw();
},{passive:false});
