import {observing,logObservation,exportObservation,movieTemplate} from './state.js';

const $=id=>document.getElementById(id);
const canvas=$('scene'),ctx=canvas.getContext('2d'),room='B',tone='pink';
const tvKey='catalog:tv:55LX1QKNA';
const sofa={id:1,k:'sofa',x:34,y:48,turn:1,f:1,e:0};
const items=[sofa];
const products=[
  {button:$('tvCard'),key:tvKey,x:6,y:48,turn:3},
  {button:$('lampCard'),key:'floor_lamp',x:15,y:32,turn:0}
];
const tv=()=>items.find(o=>o.k===tvKey);
const lamp=()=>items.find(o=>o.k==='floor_lamp');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let panel='room',watchStart=null,drag=null,ready=false,animation=0,offerObserver;
const record=(event,template=null,key)=>logObservation(event,'guest','qr',template,key);
const movie=movieTemplate.id;
function platformLink(){
  if (/android/i.test(navigator.userAgent))return 'https://play.google.com/store/apps/details?id=com.lgeha.nuts';
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1))
    return 'https://apps.apple.com/kr/app/lg-thinq/id993504342';
  return 'https://www.lge.co.kr/support/solutions-20153039356614';
}
function thinq(link){
  link.href=platformLink();link.target='_blank';link.rel='noopener';
  link.onclick=()=>record('thinq_clicked');
}
function action(label,fn,primary=false){
  const b=document.createElement('button');b.textContent=label;b.onclick=fn;
  if(primary)b.className='primary';
  $('controls').append(b);return b;
}
function select(item){
  if(panel==='preview'||panel==='end')return;
  if(item===tv()&&item){if(watchStart===null)watchStart=performance.now();panel='tv'}
  else if(item===lamp()&&item)panel='lamp';
  else panel='room';
  render();draw();
}
function add(product){
  const previous=items.find(o=>o.k===product.key);
  if(previous){select(previous);return}
  const item={id:product===products[0]?2:3,k:product.key,x:product.x,y:product.y,turn:product.turn,f:product.turn%2,e:0};
  // The other product may have been dragged onto this starting tile.
  if(DotScene.placementBlocker(item,items)){
    const {W,D}=DotScene.roomData(room);
    let best=Infinity,spot;
    for(let y=0;y<D;y+=2)for(let x=0;x<W;x+=2){
      const o={...item,x,y};DotScene.clamp(room,o);
      const d=(o.x-item.x)**2+(o.y-item.y)**2;
      if(d<best&&!DotScene.placementBlocker(o,items)){best=d;spot=o}
    }
    if(!spot)return;
    Object.assign(item,spot);
  }
  items.push(item);panel='room';record('product_placed',null,product.key);render();draw();
}
function preview(){
  if(!tv()||panel!=='tv')return;
  history.pushState({guestMovie:true},'');panel='preview';
  record('routine_opened',movie);record('preview_started',movie);render();draw();
}
function closePreview(){if(history.state?.guestMovie)history.back();else restorePreview()}
function restorePreview(){if(panel==='preview'){panel='tv';record('preview_ended',movie);render();draw()}}
window.addEventListener('popstate',restorePreview);
function finish(){
  panel='end';watchStart=null;drag=null;items.splice(1);
  record('guest_finished');render();draw();
}
function render(){
  offerObserver?.disconnect();$('controls').replaceChildren();
  const idle=panel==='room',ended=panel==='end';
  $('finish').hidden=ended||panel==='preview';
  $('shelf').hidden=!idle;
  for(const p of products)p.button.querySelector('small').textContent=items.some(o=>o.k===p.key)?'살펴보기':'방에 놓기';
  let title,hint;
  if(idle){
    title='가전 놓기';
    hint=tv()?(lamp()?'준비됐어요. 방 안의 TV를 눌러 보세요.':'TV에서 영화 보기를 발견할 수 있어요. 조명을 놓으면 밝기도 함께 바뀌어요.'):'제품을 골라 놓고, 방 안에서 끌어 위치를 바꿔 보세요.';
  }else if(panel==='tv'){
    title='포제 TV';hint=lamp()?'이 TV와 조명으로 영화 보기를 체험해 보세요.':'이 TV로 영화 보기를 체험할 수 있어요.';
    const b=action(movieTemplate.name,preview,true);
    if(observing){
      offerObserver=new IntersectionObserver(entries=>{
        if(panel==='tv'&&!document.hidden&&entries.some(e=>e.isIntersecting)){record('routine_offered',movie);offerObserver.disconnect()}
      });offerObserver.observe(b);
    }
    action('제품 상세',()=>{record('product_detail_opened',null,tvKey);$('detail').showModal()});
    action('가전 놓기',()=>select(null));
  }else if(panel==='lamp'){
    title='스탠드 조명';hint=tv()?'TV의 영화 보기를 선택하면 조명 밝기가 30%로 바뀌어요.':'TV를 함께 놓으면 영화 보기에서 밝기를 조절해요.';
    action('가전 놓기',()=>select(null),true);
  }else if(panel==='preview'){
    title='영화 보기';hint=(lamp()?'TV 켜기 · 조명 밝기 30%':'TV 켜기')+' · 실제 가전은 작동하지 않아요.';
    action('미리보기 닫기',closePreview,true);
    const link=document.createElement('a');link.className='thinq';link.textContent='LG ThinQ에서 계속하기';thinq(link);$('controls').append(link);
  }else{
    title='체험을 마쳤어요';hint='LG ThinQ에서 내 가전에 맞는 루틴을 설정해 보세요.';
    const link=document.createElement('a');link.className='thinq';link.textContent='LG ThinQ에서 계속하기';thinq(link);$('controls').append(link);
    action('처음부터 체험',()=>location.replace(location.href));
  }
  $('title').textContent=title;$('hint').textContent=hint;
  $('export').hidden=!observing||!ended;
}
function point(x,y,z=0){const [px,py]=DotScene.project(room,x,y,z);return {x:px,y:py,depth:x+y}}
function catFrame(now){
  const home=point(28,43),screen=tv();
  if(!screen||watchStart===null)return {cat:home,depth:home.depth};
  const a=DotScene.dims(screen),b=DotScene.dims(sofa);
  const gap=(start,len,other,otherLen)=>Math.max(0,start-other-otherLen,other-start-len);
  const near=Math.hypot(gap(screen.x,a.w,sofa.x,b.w),gap(screen.y,a.d,sofa.y,b.d))<=27;
  const target=near?point(sofa.x+b.w/2,sofa.y+b.d/2,DotScene.elevation(room,sofa)+6.7):
    point(screen.x+a.w/2+5,screen.y+a.d/2+4,DotScene.zone(room,screen));
  const t=reduced.matches?1:Math.min(1,(now-watchStart)/740),smooth=t*t*(3-2*t);
  const cat={x:home.x+(target.x-home.x)*smooth,y:home.y+(target.y-home.y)*smooth};
  const loc=DotScene.place(room,tone,screen);
  return {cat,depth:home.depth+(target.depth-home.depth)*smooth,seat:t===1&&near?sofa.id:null,walking:t<1,
    facingLeft:(t<1?target.x:loc.x+loc.s.w/2)<cat.x,facingAway:t===1,facingSide:near};
}
function draw(){
  cancelAnimationFrame(animation);if(!ready)return;
  const now=performance.now(),playing=panel==='preview',fx=catFrame(now);
  ctx.setTransform(1,0,0,1,-12,-8);
  DotScene.paint(ctx,room,tone,DotScene.sorted(room,items),drag?.moved?drag.item:null,
    {...fx,time:reduced.matches?0:now,playing,tv:tv()?.id,dim:playing&&!!lamp(),lampLit:!!lamp(),
    appliances:playing&&lamp()?{[lamp().id]:'light-dim'}:{}},false,true);
  if(!document.hidden&&(fx.walking||playing&&!reduced.matches))animation=requestAnimationFrame(draw);
}
function coords(event){
  const r=canvas.getBoundingClientRect(),scale=Math.min(r.width/canvas.width,r.height/canvas.height);
  return {x:12+(event.clientX-r.left-(r.width-canvas.width*scale)/2)/scale,
          y:8+(event.clientY-r.top-(r.height-canvas.height*scale)/2)/scale};
}
canvas.onpointerdown=e=>{
  if(!ready||drag||!e.isPrimary||!['tv','lamp','room'].includes(panel))return;
  const p=coords(e),ordered=DotScene.sorted(room,items);
  const hit=DotScene.hits(room,tone,ordered,p.x,p.y)[0]||
    DotScene.nearbyTarget(room,tone,ordered,p.x,p.y,5,o=>o!==sofa);
  if(!hit||hit===sofa)return;
  drag={id:e.pointerId,item:hit,p,x:hit.x,y:hit.y,moved:false};canvas.setPointerCapture(e.pointerId);
};
canvas.onpointermove=e=>{
  if(!drag||drag.id!==e.pointerId)return;
  const p=coords(e),dx=p.x-drag.p.x,dy=p.y-drag.p.y;
  if(!drag.moved&&Math.hypot(dx,dy)<5)return;
  drag.moved=true;
  const o={...drag.item,x:drag.x+dy/2+dx/4,y:drag.y+dy/2-dx/4};DotScene.clamp(room,o);
  if(!DotScene.placementBlocker(o,items)){drag.item.x=o.x;drag.item.y=o.y}draw();
};
canvas.onpointerup=e=>{
  if(!drag||drag.id!==e.pointerId)return;
  const {item,moved}=drag;drag=null;
  if(!moved)select(item);else{watchStart=null;select(null)}
};
canvas.onpointercancel=()=>{if(drag){Object.assign(drag.item,{x:drag.x,y:drag.y});drag=null;draw()}};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)draw()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel==='preview')closePreview()});
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload()});
$('finish').onclick=finish;$('export').onclick=exportObservation;thinq(document.querySelector('#detail .thinq'));
async function init(){
  await DotScene.load();
  const tile=ProductCatalog.restore(DotScene.products,tvKey);
  // Pack this reviewed catalog model with the guest page so a store demo can run without the DB.
  ProductCatalog.applyBody(tile,{shape:'tvEasel',upper:'white',lower:'white',detail:'easel',inches:55,description:'패브릭 하단과 긴 다리'});
  for(const p of products){DotScene.thumbnail(p.button.querySelector('canvas'),p.key,tone);p.button.onclick=()=>add(p)}
  ready=true;record('guest_entered');render();draw();
}
init().catch(e=>{console.error(e);$('title').textContent='방을 불러오지 못했어요';action('다시 열기',()=>location.reload())});
