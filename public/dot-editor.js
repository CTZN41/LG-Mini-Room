(() => {
  'use strict';
  const M=DotScene, $=id=>document.getElementById(id);
  const cv=$('scene'), view=$('view'), drawer=$('drawer'), ctx=cv.getContext('2d');
  const cats=['가전','가구','소품','바닥','벽','구조'];
  const hist={A:[],B:[],C:[]};
  let room='B', tone='pink', layouts={}, next=1, cat='가전', selected=null, overlap=[];
  let life=null;
  const online=location.protocol!=="file:";
  const requestedSpace=new URLSearchParams(location.search).get('space');
  const space=online&&['menu','example','my'].includes(requestedSpace)?requestedSpace:'dream';
  const readOnly=space==='menu'||space==='example';
  const storeKey=online&&space==="my"?"lg-miniroom.dot.my":"dotroom";
  let ordered=[], storageOK=true, noticeTimer, ready=false;
  const list=()=>layouts[room], id=()=>next++;
  const camera={zoom:1,k:1,x:0,y:0,left:0,top:0};
  const bounds={A:[12,8,410,346],B:[12,8,404,313],C:[12,8,400,327]};
  function notice(text){
    clearTimeout(noticeTimer);$('notice').textContent=text;
    noticeTimer=setTimeout(()=>$('notice').textContent='',3600);
  }
  function valid(raw){
    if(!raw||!raw.layouts||typeof raw.layouts!=='object'||Array.isArray(raw.layouts))return false;
    if(raw.room!=null&&!Object.hasOwn(M.names,raw.room))return false;
    if(raw.theme!=null&&!['pink','lime'].includes(raw.theme))return false;
    return Object.keys(M.names).every(r=>raw.layouts[r]==null||
      (Array.isArray(raw.layouts[r])&&raw.layouts[r].every(o=>o&&Number.isSafeInteger(o.id)&&
      Object.hasOwn(M.products,o.k)&&Number.isFinite(o.x)&&Number.isFinite(o.y)&&
      [0,1,false,true].includes(o.f)&&(o.turn==null||([0,1,2,3].includes(o.turn)&&o.turn%2===Number(o.f)))&&(o.e==null||Number.isFinite(o.e)))));
  }
  function restore(raw){
    room=raw?.room||'B';tone=raw?.theme||'pink';layouts=raw?.layouts||{};
    next=1;
    for(const r of Object.keys(M.names))for(const o of layouts[r]||[]){next=Math.max(next,o.id+1);o.e??=0}
    for(const r of Object.keys(M.names))layouts[r]??=defaultLayout(r);
    // Older starter arrangements only had a mirror bit. Preserve custom placements.
    for(const [r,items] of Object.entries(layouts)){
      if(!Array.isArray(items))continue;
      const my=space==='my',sy=my?55:56,ty=my?49:56;
      if(!my&&r!=='B')continue;
      const couch=items.find(o=>o.k==='sofa'&&o.x===34&&o.y===sy&&o.f===1&&o.e===0&&o.turn==null);
      const tv=items.some(o=>o.k==='tvset'&&o.x===(my?1:0)&&o.y===ty&&o.f===1);
      if(couch&&tv)couch.turn=1;
    }
  }
  function defaultLayout(r){
    if(life && space==='my')return life.initialMy(r,id);
    const layout=M.defaults(r,id);
    if(life && r==='B') layout.push({id:id(),k:'floor_lamp',x:24,y:51,f:0,e:0});
    return layout;
  }
  const record=()=>JSON.stringify({room,theme:tone,layouts});
  function save(){
    if(readOnly||!storageOK)return;
    try{localStorage.setItem(storeKey,record());return true}catch{storageOK=false;notice('자동 저장을 사용할 수 없어요. 방 메뉴에서 배치 파일을 저장해 주세요.')}
  }
  function checkpoint(before=JSON.stringify(list())){
    const stack=hist[room];stack.push(before);if(stack.length>80)stack.shift();
  }
  function select(o=null,stack=[]){selected=o;overlap=stack}
  function clearBrowseSelection(){
    if(!ready||!life||life.editing())return;
    select();$('keyboardTarget').hidden=true;paintFrame();
  }
  view.addEventListener('blur',clearBrowseSelection);
  view.addEventListener('keydown',e=>{
    if(!ready||!life||life.editing()||$('editMode').disabled)return;
    const items=ordered.filter(life.interactive);
    if(!items.length)return;
    if(['ArrowLeft','ArrowRight'].includes(e.key)){
      e.preventDefault();
      const i=items.indexOf(selected),forward=e.key==='ArrowRight';
      select(items[i<0?(forward?0:items.length-1):(i+(forward?1:-1)+items.length)%items.length]);
      $('keyboardTarget').textContent=M.products[selected.k].n+' · Enter로 열기';
      $('keyboardTarget').hidden=false;reveal();paintFrame();
    }else if(e.key==='Enter'&&selected){
      e.preventDefault();life.tap(selected);
      $('lifeActions').querySelector('button,select')?.focus({preventScroll:true});
    }
  });
  function redraw(){ordered=M.sorted(room,life?list().filter(life.visible):list());paintFrame()}
  function paintFrame(){
    const frame=life?.frame();
    M.paint(ctx,room,tone,ordered,selected,frame);
  }
  function updateTools(){
    $('sample').hidden=!selected;$('actions').hidden=!selected;
    $('name').textContent=selected?M.products[selected.k].n+((M.products[selected.k].wall)?' · 벽걸이':''):browseHint();
    if(selected)M.thumbnail($('sample'),selected.k,tone,selected);
    const wall=selected&&M.products[selected.k].wall;
    $('flip').textContent=wall?'벽 전환':'↻ 90°';
    $('flip').setAttribute('aria-label',wall?'부착 벽 전환':'오른쪽 90도 회전');
    $('ccw').hidden=!!wall;
    $('aim').hidden=selected?.k!=='sofa'||M.facingScreen(selected,list())==null;
    if(selected&&!wall)$('name').textContent+=' · '+(M.heading(selected)*90)+'°';
    $('overlap').hidden=overlap.length<2;
    $('undo').disabled=!hist[room].length;
    $('products').querySelectorAll('[data-key]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.key===selected?.k)));
  }
  function refresh(){redraw();updateTools()}
  function browseHint(){return camera.zoom>1?'빈 곳을 끌어 둘러보기':'제품을 눌러 선택'}
  function sync(){
    document.body.classList.toggle('lime',tone==='lime');
    document.querySelector('meta[name=theme-color]').content=tone==='pink'?'#3d2740':'#1f3328';
    for(const [attr,value] of [['room',room],['tone',tone],['cat',cat]])
      document.querySelectorAll('[data-'+attr+']').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset[attr]===value)));
    $('wallView').hidden=room!=='A';
  }
  function inventory(){
    const items=Object.values(M.products).filter(i=>i.c===cat);
    $('count').textContent=items.length+'종';
    $('products').replaceChildren(...items.map(item=>{
      const b=document.createElement('button'),pic=document.createElement('canvas'),name=document.createElement('span');
      b.className='card';b.dataset.key=item.k;b.setAttribute('aria-pressed',String(selected?.k===item.k));
      pic.width=64;pic.height=54;pic.setAttribute('aria-hidden','true');M.thumbnail(pic,item.k,tone);
      name.textContent=item.n;b.append(pic,name);b.onclick=()=>add(item.k);return b;
    }));
    $('products').scrollTo(0,0);
  }
  function drawerOpen(open){
    drawer.classList.toggle('expanded',open);$('expand').setAttribute('aria-expanded',String(open));
    $('expand').textContent=open?'접기 ⌄':'펼치기 ⌃';
  }
  // Camera centre is stored in original PNG pixels. Pointer and pinch use the inverse transform.
  function fit(){
    if(!ready)return;
    const [l,t,r,b]=bounds[room], w=view.clientWidth,h=view.clientHeight;
    if(!w||!h)return;
    const k=Math.min((w-6)/(r-l),(h-6)/(b-t))*camera.zoom;
    const limit=(v,a,z)=>a>z?(a+z)/2:Math.min(z,Math.max(a,v));
    camera.x=limit(camera.x,l+w/(2*k)-5,r-w/(2*k)+5);
    camera.y=limit(camera.y,t+h/(2*k)-5,b-h/(2*k)+5);
    camera.k=k;camera.left=Math.round(w/2-camera.x*k);camera.top=Math.round(h/2-camera.y*k);
    Object.assign(cv.style,{left:camera.left+'px',top:camera.top+'px',width:cv.width*k+'px',height:cv.height*k+'px'});
    $('scale').textContent=Math.round(camera.zoom*100)+'%';
    if(!selected)$('name').textContent=browseHint();
    $('out').disabled=camera.zoom<=1.001;$('in').disabled=camera.zoom>=3.599;
  }
  function home(){
    const [l,t,r,b]=bounds[room];
    camera.zoom=1;camera.x=(l+r)/2;camera.y=(t+b)/2;fit();
  }
  function local(x,y){const rect=view.getBoundingClientRect();return {x:x-rect.left,y:y-rect.top}}
  function native(p){return {x:(p.x-camera.left)/camera.k,y:(p.y-camera.top)/camera.k}}
  function zoomAt(z,p={x:view.clientWidth/2,y:view.clientHeight/2},anchor=native(p)){
    camera.zoom=Math.max(1,Math.min(3.6,z));
    fit();camera.x=anchor.x+(view.clientWidth/2-p.x)/camera.k;
    camera.y=anchor.y+(view.clientHeight/2-p.y)/camera.k;fit();
  }
  function reveal(){
    if(!selected||camera.zoom===1)return;
    const {x,y,s}=M.place(room,tone,selected),k=camera.k;
    if(x*k+camera.left<4||(x+s.w)*k+camera.left>view.clientWidth-4||
      y*k+camera.top<4||(y+s.h)*k+camera.top>view.clientHeight-4){
      camera.x=x+s.w/2;camera.y=y+s.h/2;fit();
    }
  }
  function renderRoom(){
    $('keyboardTarget').hidden=true;
    life?.identifyDevices(list());life?.reset();
    const bg=M.bg(room,tone);cv.width=bg.width;cv.height=bg.height;
    select();drawerOpen(false);sync();inventory();refresh();home();
  }
  function add(k){
    if(life && !life.canAdd(k))return;
    const it=M.products[k],{W,D}=M.roomData(room);
    const o={id:id(),k,f:0,e:0,x:Math.round((W-it.w)/2),y:it.wall?0:Math.round((D-it.d)/2)};
    findSpace(o);
    checkpoint();list().push(o);life?.identifyDevices(list());select(o);drawerOpen(false);save();refresh();fit();reveal();
  }
  function findSpace(o){
    const it=M.products[o.k],{W,D}=M.roomData(room);
    const footprint=M.dims(o);
    // Prefer the nearest open footprint so adding a second item doesn't bury the first.
    const preferred={...o};let found=false;
    for(let radius=0;radius<=Math.max(W,D)&&!found;radius+=4){
      for(let dy=-radius;dy<=radius&&!found;dy+=4)for(let dx=-radius;dx<=radius&&!found;dx+=4){
        if(Math.max(Math.abs(dx),Math.abs(dy))!==radius)continue;
        o.x=preferred.x+dx;o.y=preferred.y+dy;M.clamp(room,o);
        found=!list().some(p=>{
          if(Boolean(M.products[p.k].wall)!==Boolean(it.wall)||M.products[p.k].layer!==it.layer)return false;
          const {w,d}=M.dims(p);return o.x<p.x+w&&o.x+footprint.w>p.x&&o.y<p.y+d&&o.y+footprint.d>p.y;
        });
      }
    }
    if(!found){Object.assign(o,preferred);M.clamp(room,o)}

  }
  function edit(change){
    if(!selected)return;
    const before=JSON.stringify(list());change(selected);M.clamp(room,selected);
    if(before!==JSON.stringify(list()))checkpoint(before);
    overlap=[];save();refresh();reveal();
  }
  const rotate=step=>edit(o=>M.turnTo(room,o,M.products[o.k].wall?(o.f?0:3):M.heading(o)+step));
  const flip=()=>rotate(1);
  $('ccw').onclick=()=>rotate(-1);
  $('aim').onclick=()=>edit(o=>{const next=M.facingScreen(o,list());if(next!=null)M.turnTo(room,o,next)});
  const height=n=>edit(o=>o.e=Math.max(-M.products[o.k].elev,o.e+n));
  function duplicate(){
    if(!selected)return;
    checkpoint();const o={...selected,id:id(),x:selected.x+3,y:selected.y+3};M.clamp(room,o);
    delete o.deviceId;list().push(o);life?.identifyDevices(list());select(o);save();refresh();reveal();
  }
  function remove(){if(!selected)return;checkpoint();layouts[room]=list().filter(o=>o!==selected);select();save();refresh()}
  function undo(){if(!hist[room].length)return;layouts[room]=JSON.parse(hist[room].pop());select();save();refresh()}
  const pointers=new Map();let gesture=null;
  function pinchData(){
    const [a,b]=[...pointers.values()];
    return {mid:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},dist:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};
  }
  function cancelMove(){
    if(gesture?.type==='move'&&gesture.moved){gesture.o.x=gesture.ox;gesture.o.y=gesture.oy;redraw()}
  }
  view.onpointerdown=e=>{
    if(!ready||e.button!==0)return;
    if(!$('keyboardTarget').hidden)clearBrowseSelection();
    const p=local(e.clientX,e.clientY);
    view.setPointerCapture(e.pointerId);pointers.set(e.pointerId,p);view.classList.add('busy');
    if(pointers.size===2){
      cancelMove();const {mid,dist}=pinchData();
      gesture={type:'pinch',dist,anchor:native(mid),zoom:camera.zoom};return;
    }
    if(pointers.size!==1)return;
    const n=native(p), stack=M.hits(room,tone,ordered,n.x,n.y);
    // After explicitly picking a covered object, dragging that same overlap moves it.
    const o=overlap.length>1&&stack.includes(selected)?selected:stack[0];
    gesture=life&&!life.editing()?{type:'visit',p,o,x:camera.x,y:camera.y,k:camera.k}:o?{type:'move',o,stack,p,ox:o.x,oy:o.y,k:camera.k,before:JSON.stringify(list())}:
      {type:'pan',p,x:camera.x,y:camera.y,k:camera.k};
  };
  view.onpointermove=e=>{
    if(!pointers.has(e.pointerId)||!gesture)return;
    const p=local(e.clientX,e.clientY);pointers.set(e.pointerId,p);
    if(gesture.type==='pinch'){
      if(pointers.size<2)return;
      const {mid,dist}=pinchData();zoomAt(gesture.zoom*dist/gesture.dist,mid,gesture.anchor);return;
    }
    const g=gesture,dx=p.x-g.p.x,dy=p.y-g.p.y;
    if(!g.moved&&Math.hypot(dx,dy)<4)return;
    g.moved=true;
    if(g.type==='pan'||g.type==='visit'){camera.x=g.x-dx/g.k;camera.y=g.y-dy/g.k;fit();return}
    const o=g.o,mx=dx/g.k,my=dy/g.k;
    let wx=(mx/2+my)/2,wy=(my-mx/2)/2;
    if(M.products[o.k].wall){
      if(o.f){wy=(-2*mx+my)/5;wx=0}else{wx=(2*mx+my)/5;wy=0}
    }
    o.x=g.ox+Math.round(wx);o.y=g.oy+Math.round(wy);M.clamp(room,o);
    select(o);redraw();
  };
  function finish(e,cancelled){
    if(!pointers.has(e.pointerId))return;
    pointers.delete(e.pointerId);
    if(gesture?.type==='pinch'){if(pointers.size>=2)return;gesture=null}
    const g=gesture;gesture=null;
    if(g?.type==='visit'&&!cancelled&&!g.moved){life.tap(g.o)}
    else if(g?.type==='move'){
      if(cancelled){g.o.x=g.ox;g.o.y=g.oy}
      else if(g.moved){if(g.o.x!==g.ox||g.o.y!==g.oy){checkpoint(g.before);save()}select(g.o)}
      else select(g.stack[0],g.stack);
    }else if(g?.type==='pan'&&!g.moved&&!cancelled)select();
    if(!pointers.size)view.classList.remove('busy');
    refresh();
  }
  view.onpointerup=e=>finish(e,false);view.onpointercancel=e=>finish(e,true);
  view.onlostpointercapture=e=>{if(pointers.has(e.pointerId))finish(e,true)};
  view.addEventListener('wheel',e=>{
    e.preventDefault();
    if(e.shiftKey&&camera.zoom>1){camera.x+=e.deltaY/camera.k;fit()}
    else zoomAt(camera.zoom*Math.exp(-e.deltaY*.002),local(e.clientX,e.clientY));
  },{passive:false});
  $('in').onclick=()=>zoomAt(camera.zoom*1.45);$('out').onclick=()=>zoomAt(camera.zoom/1.45);
  $('overview').onclick=home;
  $('wallView').onclick=()=>{camera.zoom=2.2;const [x,y]=M.project('A',59,6,0);camera.x=x;camera.y=y-15;fit()};
  $('expand').onclick=()=>drawerOpen(!drawer.classList.contains('expanded'));
  let handleY;
  const handle=document.querySelector('.drawerHead');
  handle.addEventListener('touchstart',e=>handleY=e.touches[0].clientY,{passive:true});
  handle.addEventListener('touchend',e=>{const dy=e.changedTouches[0].clientY-handleY;if(Math.abs(dy)>22)drawerOpen(dy<0)},{passive:true});
  $('flip').onclick=flip;$('up').onclick=()=>height(1);$('down').onclick=()=>height(-1);
  $('duplicate').onclick=duplicate;$('remove').onclick=remove;$('undo').onclick=undo;
  $('overlap').onclick=()=>{select(overlap[(overlap.indexOf(selected)+1)%overlap.length],overlap);refresh()};
  $('more').onclick=()=>$('menu').showModal();
  document.querySelectorAll('dialog .close').forEach(b=>b.onclick=()=>b.closest('dialog').close());
  $('clear').onclick=()=>{checkpoint();layouts[room]=[];select();save();refresh();$('menu').close()};
  $('reset').onclick=()=>{checkpoint();layouts[room]=defaultLayout(room);$('menu').close();renderRoom();save()};
  $('shot').onclick=()=>{
    const c=document.createElement('canvas');c.width=cv.width*4;c.height=cv.height*4;
    const x=c.getContext('2d');x.scale(4,4);M.paint(x,room,tone,ordered,null);
    const url=c.toDataURL('image/png');$('exportImage').src=url;
    $('download').href=url;$('download').download='MY DOT ROOM '+room+' '+tone+'.png';
    $('menu').close();$('picture').showModal();
  };
  $('saveFile').onclick=()=>{
    const a=document.createElement('a'),url=URL.createObjectURL(new Blob([record()],{type:'application/json'}));
    a.href=url;a.download='dotroom.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  $('openFile').onclick=()=>$('layoutFile').click();
  $('layoutFile').onchange=async e=>{
    const file=e.target.files[0];e.target.value='';if(!file)return;
    try{
      const raw=JSON.parse(await file.text());
      if(!valid(raw))throw Error();
      if(!confirm('이 파일의 방과 배치로 바꿀까요? 현재 배치는 방 메뉴에서 파일로 저장할 수 있어요.'))return;
      restore(raw);Object.values(hist).forEach(h=>h.length=0);storageOK=true;save();$('menu').close();renderRoom();
    }catch{alert('MY DOT ROOM 배치 JSON 파일을 확인해 주세요.')}
  };
  addEventListener('keydown',e=>{
    if((life&&!life.editing())||!ready||gesture||document.querySelector('dialog[open]')||e.target.tagName==='INPUT')return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo();return}
    if(!selected)return;
    const mv={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
    if(mv){e.preventDefault();edit(o=>{
      if(M.products[o.k].wall){if(o.f)o.y+=mv[0]+mv[1];else o.x+=mv[0]+mv[1]}
      else{o.x+=mv[0];o.y+=mv[1]}
    });return}
    switch(e.key.toLowerCase()){
      case 'r':rotate(e.shiftKey?-1:1);break;case 'd':duplicate();break;case ']':height(1);break;case '[':height(-1);break;
      case 'delete':case 'backspace':e.preventDefault();remove();break;case 'escape':select();refresh();break;
    }
  });
  function logo(){
    const glyphs={M:['10001','11011','10101','10001','10001'],Y:['10001','01010','00100','00100','00100'],
    D:['11110','10001','10001','10001','11110'],O:['01110','10001','10001','10001','01110'],
    T:['11111','00100','00100','00100','00100'],R:['11110','10001','11110','10100','10010']};
    const c=$('logo');c.width=76;c.height=10;const x=c.getContext('2d');
    x.fillStyle='#ffc99e';[[5,0,2,1],[3,1,6,1],[2,2,8,1],[1,3,10,1],[2,4,8,5]].forEach(a=>x.fillRect(...a));
    x.clearRect(5,6,2,3);x.fillStyle='#fff1de';
    let left=15;for(const ch of 'MY DOT ROOM'){if(ch===' '){left+=3;continue}
      glyphs[ch].forEach((row,y)=>[...row].forEach((dot,i)=>{if(dot==='1')x.fillRect(left+i,2+y,1,1)}));left+=6}
    c.style.aspectRatio='76 / 10';
  }
  async function init(){
    logo();let raw=null;
    await M.load();
    if(online){
      const model=await import('./state.js');
      life=createLivingRoom({model,space,M,$,list,id,room:()=>room,tone:()=>tone,notice,
        draw:paintFrame,refresh,save,home,findSpace,select,drawerOpen,gestureActive:()=>!!gesture});
    }
    try{const old=space==='example'?null:localStorage.getItem(storeKey);if(old!==null){raw=JSON.parse(old);if(!valid(raw))throw Error()}}
    catch{raw=null;storageOK=false;notice('기존 저장본을 열 수 없어 자동 저장을 멈췄어요.')}
    restore(raw);
    for(const [r,name] of Object.entries(M.names)){
      const b=document.createElement('button');b.dataset.room=r;b.innerHTML='<b>'+r+'</b>'+name;
      b.onclick=()=>{if(room===r)return;room=r;renderRoom();save()};$('rooms').append(b);
    }
    document.querySelectorAll('[data-tone]').forEach(b=>b.onclick=()=>{
      tone=b.dataset.tone;sync();inventory();refresh();save();
    });
    for(const c of cats){const b=document.createElement('button');b.dataset.cat=c;b.textContent=c;
      b.onclick=()=>{cat=c;sync();inventory()};$('categories').append(b)}
    if(location.protocol==='file:')$('mini').hidden=true;
    ready=true;renderRoom();life?.enter();save();new ResizeObserver(fit).observe(view);
  }
  init().catch(e=>{console.error(e);$('name').textContent='방 이미지를 열 수 없어요. 페이지를 새로고침해 주세요.'});
})();

function createLivingRoom({model,space,M,$,list,id,room,tone,notice,draw,refresh,save,home,findSpace,select,drawerOpen,gestureActive}){
  const my=space==='my',params=new URLSearchParams(location.search);
  const friend=space==='example',menu=space==='menu',readOnly=friend||menu;
  const source=friend||params.get('source')==='example_room'?'example_room':'collection';
  const isTV=o=>o && ['tvset','standbyme'].includes(o.k);
  const saved=()=>model.state.savedRoutines.find(r=>r.anchorId==='sofa'&&r.templateId==='movie-night');
  let editMode=false, panel='idle',target=null,seat=null,start=null,started=0,walking=false;
  let playback=null,previousPanel='idle',bindings={},raf=0,lastFrame=-100,offer=null;
  let lampOn=false,poweredTV=null,sceneBeforeMovie=null;
  const fixture=()=>model.state.myFixtureId==='sample-home-v1';
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  let skipped=false,offeredTarget=null;
  const still=()=>skipped||reducedMotion.matches;
  const log=(event,origin=source)=>model.logObservation(event,space,origin);
  const savedSource=()=>model.savedObservationSource(source);
  function observeOffer(button,item){
    if(!model.observing||offeredTarget===item)return;
    const watcher=new IntersectionObserver(entries=>{
      if(offer===watcher && button.isConnected && document.visibilityState==='visible' && entries.some(e=>e.isIntersecting)){
        offeredTarget=item;log('routine_offered');watcher.disconnect();
      }
    });
    offer=watcher;watcher.observe(button);
  }
  const tvAction=model.actions.find(a=>a.kind==='tv');
  const tvCatalog=()=>model.devices.filter(d=>d.kind==='tv');
  const nameOf=id=>tvCatalog().find(d=>d.id===id)?.name||'이전 TV';
  const liveTVs=()=>model.candidates(tvAction);
  const screenFor=id=>list().find(o=>isTV(o)&&o.deviceId===id);
  const availableTVs=()=>liveTVs().filter(d=>screenFor(d.id));
  const available=id=>!!id&&availableTVs().some(d=>d.id===id);
  const needsRepair=()=>!!saved()&&!available(saved().bindings['tv-on']);
  const visible=o=>!my||!isTV(o)||!o.deviceId||model.registeredTVs().includes(o.deviceId);
  const templates=model.applianceTemplates,groups=model.applianceGroups;
  const groupFor=k=>Object.keys(groups).find(kind=>groups[kind].keys.includes(k));
  const recipeFor=k=>templates.find(t=>t.actions.some(a=>a.kind===groupFor(k)));
  let recipe=null,recipeBindings={},recipeEffects={};
  const savedRecipe=t=>model.state.savedRoutines.find(r=>r.templateId===t.id);
  function identifyDevices(items){
    if(!my||!fixture())return;
    const assigned=new Set();
    for(const o of items){
      if(!groupFor(o.k))continue;
      if(!o.deviceId||assigned.has(o.deviceId)){
        const nonce=Array.from(crypto.getRandomValues(new Uint32Array(3)),v=>v.toString(16)).join('-');
        o.deviceId='my-'+groupFor(o.k)+'-'+nonce;
      }
      assigned.add(o.deviceId);
    }
    const used=new Set(items.filter(isTV).map(o=>o.deviceId));
    for(const o of items.filter(isTV)){
      if(Object.hasOwn(o,'deviceId'))continue;
      const next=liveTVs().find(d=>!used.has(d.id));
      o.deviceId=next?.id??null;if(next)used.add(next.id);
    }
  }
  function planTV(d){
    const existing=screenFor(d.id)||list().find(o=>isTV(o)&&!o.deviceId);
    if(existing)return existing;
    const primary=d.id==='my-tv-1';
    const o={id:id(),deviceId:d.id,k:primary?'tvset':'standbyme',x:primary?1:65,y:primary?49:8,f:primary?1:0,e:0};
    findSpace(o);return o;
  }
  function placeTV(o,deviceId){
    o.deviceId=deviceId;
    if(!list().includes(o))list().push(o);
  }
  function ensureTV(d){
    placeTV(planTV(d),d.id);
  }
  function initialMy(r,next){
    if(!fixture())return [];
    const entries=[['sofa',34,48,1],['tvset',1,49,1],['floor_lamp',21,49,0]];
    const oldIds={tvset:'tv',floor_lamp:'lamp',sofa:'sofa'};
    if(model.registeredTVs().includes('my-tv-2'))entries.push(['standbyme',65,8,0]);
    return entries.filter(([k])=>model.state.roomItems?.my?.[oldIds[k]]!==false).map(([k,x,y,f])=>{
      const o={id:next(),k,x,y,f,e:0},old=model.state.placements?.my?.[oldIds[k]];
      if(old && Number.isFinite(old.x)&&Number.isFinite(old.z)){
        const {W,D}=M.roomData(r),{w,d}=M.dims(o);
        o.x=(old.x/12+.5)*(W-w);o.y=(old.z/7+.5)*(D-d);
      }
      if(isTV(o))o.deviceId=k==='tvset'?'my-tv-1':'my-tv-2';
      if(k==='sofa')o.turn=1;
      M.clamp(r,o);return o;
    });
  }
  function canAdd(k){
    if(my&&!fixture()&&(isTV({k})||k==='floor_lamp'||groupFor(k))){
      notice('마이룸에서 체험용 기기 사용을 먼저 선택해 주세요.');return false;
    }
    if(!my&&isTV({k})&&!model.state.collection.includes(model.model)){
      try{model.update(s=>s.collection.push(model.model));log('collection_added')}
      catch(e){notice(e.message);return false}
    }
    return true;
  }
  function floorPoint(gx,gy){
    const {zones}=M.roomData(room());
    const level=zones.find(([x1,y1,x2,y2])=>gx>=x1&&gx<x2&&gy>=y1&&gy<y2)?.[4]||0;
    const [x,y]=M.project(room(),gx,gy,level);
    return {x,y,depth:gx+gy};
  }
  function spawn(){
    return floorPoint(28,43);
  }
  function sofaPoint(o){
    const h=M.heading(o),z=M.elevation(room(),o)+6.6;
    const options=[7.5,19.5].map(u=>{
      const v=7.5;
      const [dx,dy]=[[u,v],[12-v,u],[27-u,12-v],[v,27-u]][h];
      const [x,y]=M.project(room(),o.x+dx,o.y+dy,z);
      return {x,y,depth:o.x+dx+o.y+dy};
    });
    const pillows=list().filter(item=>item.k==='cushion'||item.k==='cushion2').map(item=>M.place(room(),tone(),item));
    const clearance=pt=>Math.min(Infinity,...pillows.map(q=>Math.hypot(pt.x-q.x-q.s.w/2,pt.y-q.y-q.s.h/2)));
    return clearance(options[1])>clearance(options[0])?options[1]:options[0];
  }
  let standing=null;
  function position(now){
    const end=seat?sofaPoint(seat):standing||spawn();
    const t=Math.min(1,(now-started)/740);
    if(!walking||t>=1){walking=false;return end}
    const eased=t*t*(3-2*t);
    return {x:start.x+(end.x-start.x)*eased,y:start.y+(end.y-start.y)*eased-3*Math.sin(Math.PI*t),depth:start.depth+(end.depth-start.depth)*eased};
  }
  function animate(){
    if(!raf)raf=requestAnimationFrame(function tick(now){
      raf=0;
      if(now-lastFrame>=60){lastFrame=now;draw()}
      if(walking||(playback&&!still()))animate();
    });
  }
  function nearbySofa(tv){
    const {w,d}=M.dims(tv);
    let nearest=null,best=M.products.sofa.w;
    // Measure the gap between occupied floor areas, in room units.
    for(const sofa of list().filter(o=>o.k==='sofa')){
      const size=M.dims(sofa);
      const dx=Math.max(0,sofa.x-tv.x-w,tv.x-sofa.x-size.w);
      const dy=Math.max(0,sofa.y-tv.y-d,tv.y-sofa.y-size.d);
      const distance=Math.hypot(dx,dy);
      if(distance<=best){nearest=sofa;best=distance}
    }
    return nearest;
  }
  function standingPoint(tv){
    const {w,d}=M.dims(tv),{W,D}=M.roomData(room());
    const [nx,ny]=[[0,1],[-1,0],[0,-1],[1,0]][M.heading(tv)];
    const cx=tv.x+w/2,cy=tv.y+d/2;
    const frontX=cx+nx*(w/2+8),frontY=cy+ny*(d/2+8);
    const obstacles=list().filter(o=>visible(o)&&M.products[o.k].layer&&!M.products[o.k].wall)
      .map(o=>({x:o.x,y:o.y,...M.dims(o)}));
    let best=Infinity,point=null;
    for(let x=2;x<=W-2;x+=2)for(let y=2;y<=D-2;y+=2){
      if(room()==='B'&&x+2>52&&y+2>48)continue;
      if(x>=tv.x-1&&x<=tv.x+w+1&&y>=tv.y-1&&y<=tv.y+d+1)continue;
      let score=(x-frontX)**2+(y-frontY)**2;
      if(score>=best)continue;
      if(obstacles.some(o=>x>o.x-2&&x<o.x+o.w+2&&y>o.y-2&&y<o.y+o.d+2))continue;
      if((x-cx)*nx+(y-cy)*ny<0)score+=100;
      if(score<best){best=score;point=floorPoint(x,y)}
    }
    return point||spawn();
  }
  function watch(tv){
    const current=position(performance.now()),sofa=nearbySofa(tv);
    if(target===tv&&seat===sofa&&(sofa||standing))return;
    target=tv;seat=sofa;standing=sofa?null:standingPoint(tv);
    const end=sofa?sofaPoint(sofa):standing;
    start=current;started=performance.now();walking=!still()&&Math.hypot(end.x-current.x,end.y-current.y)>1;
    if(walking)animate();
  }
  function frame(){
    if(editMode)return;
    const now=performance.now(),cat=position(now);
    const movie=playback&&(!playback.templateId||playback.templateId==='movie-night');
    const tv=movie?target:poweredTV;
    const tvLoc=target&&M.place(room(),tone(),target);
    return {cat,depth:cat.depth,seat:!walking&&seat?seat.id:null,
      time:still()?0:now,walking,facingAway:!!tvLoc&&tvLoc.y+tvLoc.s.h/3<cat.y,
      facingLeft:!!tvLoc&&tvLoc.x+tvLoc.s.w/2<cat.x,
      facingSide:!!tvLoc&&Math.abs(tvLoc.x+tvLoc.s.w/2-cat.x)>12,tv:tv?.id,
      appliances:recipeEffects,playing:!!movie||!!poweredTV,dim:!!playback?.bindings['light-dim'],
      lampLit:lampOn||!!playback?.bindings['light-dim'],
      curtain:!!movie&&!my};
  }
  function clearScene(){
    if(raf)cancelAnimationFrame(raf);raf=0;walking=false;standing=start=seat=target=playback=null;
    offer?.disconnect();offer=null;offeredTarget=null;skipped=false;sceneBeforeMovie=null;
  }
  function reset(){
    clearScene();recipe=null;recipeBindings={};recipeEffects={};poweredTV=null;lampOn=false;panel='idle';bindings={};render();
  }
  function action(text,fn,primary=false,container=$('lifeActions')){
    const b=document.createElement('button');b.type='button';b.textContent=text;
    if(primary)b.className='primary';
    b.onclick=()=>{try{fn()}catch(e){if($('batch').open)$('batchStatus').textContent=e.message;else notice(e.message)}};
    container.append(b);return b;
  }
  function show(title,detail=''){$('lifeTitle').textContent=title;$('lifeDetail').textContent=detail}
  function setPanel(next){panel=next;render();draw()}
  function toggleEdit(){
    if(readOnly||gestureActive())return;
    clearScene();panel='idle';editMode=!editMode;select();drawerOpen(false);
    render();refresh();home();
  }
  function prepare(){
    if(!fixture())model.update(s=>{
      s.registeredTvIds=tvCatalog().map(d=>d.id);
      s.myFixtureId='sample-home-v1';s.myLayout['tv-slot']='my-tv-1';s.myLayout['light-slot']='my-light-1';
    });
    const starter=[['tvset',1,49,1],['floor_lamp',21,49,0],['sofa',34,48,1]];
    for(const [k,x,y,f] of starter){
      if(list().some(o=>k==='tvset'?isTV(o):o.k===k))continue;
      const o={id:id(),k,x,y,f,e:0};if(k==='sofa')o.turn=1;M.clamp(room(),o);list().push(o);
    }
    identifyDevices(list());for(const d of liveTVs())ensureTV(d);
    save();refresh();clearConnectLink();if(recipe)openRecipe(recipe);else connect();
  }
  function connect(){
    bindings={...(saved()?.bindings||{})};setPanel('connect');
  }
  function clearConnectLink(){
    const entry=new URL(location.href);
    if(!entry.searchParams.has('connect'))return;
    entry.searchParams.delete('connect');entry.searchParams.delete('template');
    history.replaceState(history.state,'',entry);
  }
  function startMovie(from=panel){
    const editing=from==='connect'||from==='repair';
    if(my&&!editing&&from!=='product'&&needsRepair()){beginRepair();return}
    const chosen={...(editing?bindings:saved()?.bindings||{})};
    if(my&&!editing&&(from==='product'||!saved())){
      const options=availableTVs();
      const choice=from==='product'?target?.deviceId:(options.length===1?options[0].id:null);
      if(!available(choice)){connect();return}
      chosen['tv-on']=choice;if(!saved())chosen['light-dim']=model.state.myLayout['light-slot'];
    }
    const device=my&&liveTVs().find(d=>d.id===chosen['tv-on']);
    const newPlacement=my&&editing&&device&&!screenFor(device.id);
    const tv=my?(newPlacement?planTV(device):screenFor(chosen['tv-on'])):
      (target&&list().includes(target)?target:list().find(isTV));
    if(!tv){notice('배치 편집에서 TV를 놓아 주세요.');return}
    // Preserve the saved optional actions during TV repair, even in a room without a lamp.
    const repaired=from==='repair'?{...saved(),bindings:{...saved().bindings,'tv-on':chosen['tv-on']}}:null;
    if(!list().some(o=>o.k==='floor_lamp'))delete chosen['light-dim'];
    const result=my?model.routine(chosen):{bindings:{'tv-on':true,'light-dim':true,'curtain-close':true}};
    if(repaired){
      persistRoutine(repaired);from='idle';log('routine_reconnected',savedSource());
    }
    if(newPlacement){placeTV(tv,device.id);save();refresh()}
    previousPanel=from;
    history.pushState({...history.state,dotMovie:true},'');
    const replay=my&&['idle','saved'].includes(from);
    const origin=replay?savedSource():source;
    if(!my&&from==='product')log('routine_opened');
    sceneBeforeMovie={target,seat,standing,start,walking,elapsed:performance.now()-started};
    watch(tv);playback=result;panel='playing';render();draw();if(!still())animate();
    if(replay){if(from==='idle')log('routine_reopened',origin);log('routine_replayed',origin)}
    log('preview_opened',origin);
  }
  function leaveMovie(destination=previousPanel){
    if(destination==='connect'&&playback)bindings={...playback.bindings};
    playback=null;skipped=false;recipeEffects={};
    if(sceneBeforeMovie){
      ({target,seat,standing,start,walking}=sceneBeforeMovie);
      started=performance.now()-sceneBeforeMovie.elapsed;sceneBeforeMovie=null;
      if(still())walking=false;
      if(walking)animate();
    }
    panel=destination;render();draw();
  }
  let afterBack=null;
  function closeMovie(destination=previousPanel){
    if(history.state?.dotMovie){afterBack=destination;history.back()}
    else leaveMovie(destination);
  }
  window.addEventListener('popstate',()=>{
    if(playback){leaveMovie(afterBack||previousPanel);afterBack=null}
  });
  function persistRoutine(record){model.saveRoutines([record])}
  function storeRoutine(){
    if(!playback)return;
    const verified=model.routine(playback.bindings);
    if(saved()&&!confirm('내 루틴의 영화 보기 연결을 바꿀까요?'))return;
    persistRoutine(verified);
    log('routine_saved');closeMovie('idle');notice('내 루틴에 영화 보기를 저장했어요.');
  }
  function tap(o){
    if(playback||menu)return;
    const found=o&&recipeFor(o.k);
    if(found){
      openRecipe(found,o);
      return;
    }
    if(friend){
      if(o?.k==='sofa'){
        if(panel!=='friendMovie')log('routine_opened');
        setPanel('friendMovie');
      }else{if(isTV(o))watch(o);setPanel('idle')}
      return;
    }
    if(isTV(o)){
      if(my&&!fixture()){setPanel('setup');return}
      watch(o);setPanel('product');
    }else if(o?.k==='sofa'&&my&&saved()){
      seat=o;walking=false;target=list().find(isTV);log('routine_reopened',savedSource());setPanel('saved');
    }else if(o?.k==='floor_lamp'){setPanel('lamp')}
    else{standing=seat=target=null;walking=false;setPanel('idle')}
  }
  function beginRepair(){
    bindings={...saved().bindings};delete bindings['tv-on'];setPanel('repair');
  }
  function tvPicker(label){
    const field=document.createElement('label'),picker=document.createElement('select');
    field.className='tv-picker';field.append(label,picker);
    picker.add(new Option('TV 선택',''));
    for(const d of liveTVs()){
      picker.add(new Option(d.name+(screenFor(d.id)?'':' · 방에 놓기'),d.id));
    }
    picker.value=bindings['tv-on']||'';
    picker.onchange=()=>{
      bindings['tv-on']=picker.value;render();$('lifeActions').querySelector('select')?.focus({preventScroll:true});
    };
    $('lifeActions').append(field);
  }
  function applianceOptions(a){
    if(my&&!fixture())return [];
    return list().filter(o=>groupFor(o.k)===a.kind).map(o=>({
      item:o,id:my?o.deviceId:String(o.id),name:M.products[o.k].n
    })).filter(d=>d.id);
  }
  function openRecipe(t,item=null){
    recipe=t;
    if(my&&!fixture()){setPanel('setup');return}
    recipeBindings={...(my?savedRecipe(t)?.bindings:{})};
    for(const a of t.actions){
      const options=applianceOptions(a);
      const tapped=options.find(d=>d.item===item);
      if(tapped)recipeBindings[a.actionId]=tapped.id;
      else if(!my&&options.length)recipeBindings[a.actionId]=options[0].id;
      else if(!options.some(d=>d.id===recipeBindings[a.actionId])){
        delete recipeBindings[a.actionId];
        if(a.required&&options.length===1)recipeBindings[a.actionId]=options[0].id;
      }
    }
    if(item&&!my)model.logObservation('routine_opened',space,source,t.id);
    setPanel('applianceConfig');
  }
  function addDemoAppliance(a){
    const k=groups[a.kind].keys[0];
    const o={id:id(),k,x:Math.round(M.roomData(room()).W/2),y:18,f:0,e:0};
    findSpace(o);list().push(o);identifyDevices(list());
    if(!save()){list().pop();throw Error('가전 배치를 저장할 수 없어요. 저장 공간을 확인해 주세요.')}
    refresh();
    return o.deviceId;
  }
  function placeAppliance(a){
    recipeBindings[a.actionId]=addDemoAppliance(a);setPanel('applianceConfig');
  }
  function pickAppliance(a){
    const options=applianceOptions(a);
    const label=groups[a.kind].label;
    if(!options.length){
      action('체험용 '+label+' 배치',()=>placeAppliance(a));
      return;
    }
    const field=document.createElement('label'),picker=document.createElement('select');
    field.className='tv-picker';field.append(label+(a.required?' · 필수':' · 선택'),picker);
    picker.add(new Option(a.required?'기기 선택':'제외',''));
    for(const [index,d] of options.entries()){
      picker.add(new Option(d.name+(options.length>1?' · '+(index+1):''),d.id));
    }
    picker.value=recipeBindings[a.actionId]||'';
    picker.onchange=()=>{
      if(picker.value)recipeBindings[a.actionId]=picker.value;
      else delete recipeBindings[a.actionId];
      $('recipePreview').disabled=!recipeReady();
    };
    $('lifeActions').append(field);
  }
  function recipeReady(){
    return recipe.actions.every(a=>!a.required||applianceOptions(a).some(d=>d.id===recipeBindings[a.actionId]));
  }
  function playRecipe(from){
    const record=model.routine(recipeBindings,recipe,applianceOptions);
    const effects={};
    for(const a of recipe.actions){
      const d=applianceOptions(a).find(d=>d.id===record.bindings[a.actionId]);
      if(d)effects[d.item.id]=a.kind;
    }
    history.pushState({...history.state,dotMovie:true},'');
    previousPanel=from;playback=record;recipeEffects=effects;setPanel('appliancePlaying');
    if(!still())animate();
    const origin=from==='idle'?model.savedObservationSource(source,recipe.id):source;
    if(from==='idle')model.logObservation('routine_replayed',space,origin,recipe.id);
    model.logObservation('preview_opened',space,origin,recipe.id);
  }
  function runSavedRecipe(t){
    recipe=t;recipeBindings={...savedRecipe(t).bindings};
    if(!recipeReady()){openRecipe(t);notice('필수 기기를 다시 연결해 주세요.');return}
    playRecipe('idle');
  }
  function shortcut(label,detail,run){
    const b=action(label,run);
    b.className='routine-card';
    b.setAttribute('aria-label',label);
    b.setAttribute('aria-describedby',detail.id);
    b.append(detail);
  }
  function renderRoutineShelf(movie,recipes){
    const tools=$('routineTools');
    const broken=movie&&needsRepair();
    show('내 루틴',movie?nameOf(movie.bindings['tv-on'])+(broken?' 재연결 필요':' 연결됨'):'');
    if(!broken)action(movie?'연결 설정':'루틴 연결',connect,false,tools);
    action('루틴 추가',openBatch,false,tools);
    if(movie){
      shortcut(broken?'TV 다시 연결':'영화 보기',$('lifeDetail'),broken?beginRepair:()=>startMovie('idle'));
    }
    for(const t of recipes){
      const record=savedRecipe(t);
      const connected=t.actions.filter(a=>applianceOptions(a).some(d=>d.id===record.bindings[a.actionId]));
      const detail=document.createElement('small');detail.id='devices-'+t.id;
      detail.textContent=t.actions.some(a=>a.required&&!connected.includes(a))
        ?'기기 재연결 필요':connected.map(a=>groups[a.kind].label).join(' · ');
      shortcut(t.name,detail,()=>runSavedRecipe(t));
    }
  }
  // Each selected template owns a draft. Only the final save writes routine records.
  const batchTemplates=[model.movieTemplate,...templates];
  const movieActions={
    tv:'TV 켜기',light:'조명 30%',curtain:'커튼 닫기'
  };
  function batchLabel(a){
    return movieActions[a.kind]||groups[a.kind].label+' '+a.label;
  }
  function batchOptions(a){
    if(groups[a.kind])return applianceOptions(a);
    if(a.kind==='light'&&!list().some(o=>o.k==='floor_lamp'))return [];
    return model.candidates(a);
  }
  function batchCompatible(a,id){
    return batchOptions(a).some(d=>d.id===id)&&(a.kind!=='tv'||available(id));
  }
  function openBatch(){
    if(!my||!fixture())return;
    const dialog=$('batch'),rows=$('batchList'),status=$('batchStatus'),submit=$('batchSave');
    rows.replaceChildren();status.textContent='';
    const drafts=batchTemplates.map(template=>{
      const original=savedRecipe(template);
      const bindings={...original?.bindings};
      if(!original)for(const a of template.actions.filter(a=>a.required)){
        const options=batchOptions(a);
        if(options.length===1&&batchCompatible(a,options[0].id))bindings[a.actionId]=options[0].id;
      }
      return {template,original,bindings,selected:false};
    });
    function updateStatus(){
      const chosen=drafts.filter(d=>d.selected);
      const missing=chosen.some(d=>d.template.actions.some(a=>a.required&&!batchCompatible(a,d.bindings[a.actionId])));
      submit.disabled=!chosen.length||missing;
      submit.textContent=chosen.length?chosen.length+'개 루틴 저장':'선택한 루틴 저장';
      status.textContent=missing?'필수 기기를 연결해 주세요.':chosen.length?chosen.length+'개 선택됨':'설정할 루틴을 선택하세요.';
    }
    function fieldsFor(d,fields){
      fields.replaceChildren();
      for(const a of d.template.actions){
        const options=batchOptions(a),key=a.actionId,selected=d.bindings[key];
        const labelText=batchLabel(a)+(a.required?' · 필수':' · 선택');
        if(options.length){
          const label=document.createElement('label'),picker=document.createElement('select');
          label.append(labelText,picker);
          picker.add(new Option(a.required?'기기 선택':'제외',''));
          for(const [i,device] of options.entries()){
            const suffix=options.filter(o=>o.name===device.name).length>1?' · '+(i+1):'';
            picker.add(new Option(device.name+suffix,device.id));
          }
          picker.value=options.some(o=>o.id===selected)?selected:'';
          picker.onchange=()=>{
            d.bindings[key]=picker.value;
            if(a.kind==='tv'){fieldsFor(d,fields);fields.querySelector('select')?.focus()}
            updateStatus();
          };
          fields.append(label);
        }else{
          const info=document.createElement('small');
          info.textContent=labelText+(a.kind==='tv'?' · 방 메뉴에서 체험용 TV를 등록하세요.':' · 연결할 기기 없음');fields.append(info);
        }
        if(groups[a.kind]&&!options.length){
          action('체험용 '+groups[a.kind].label+' 배치',()=>{
            d.bindings[key]=addDemoAppliance(a);fieldsFor(d,fields);updateStatus();
          },false,fields);
        }
        if(a.kind==='tv'&&options.some(o=>o.id===selected)&&!screenFor(selected)){
          action(nameOf(selected)+' 방에 놓기',()=>{
            const tv=planTV(liveTVs().find(o=>o.id===selected));
            const inserted=!list().includes(tv),oldId=tv.deviceId;
            placeTV(tv,selected);
            if(!save()){
              if(inserted)list().splice(list().indexOf(tv),1);else tv.deviceId=oldId;
              throw Error('TV 배치를 저장할 수 없어요.');
            }
            refresh();fieldsFor(d,fields);updateStatus();
          },false,fields);
        }
      }
    }
    for(const d of drafts){
      const row=document.createElement('section'),label=document.createElement('label');
      const check=document.createElement('input'),fields=document.createElement('div');
      row.className='batch-row';label.className='batch-choice';fields.className='batch-fields';
      check.type='checkbox';check.setAttribute('aria-label',d.template.name);
      fields.id='batch-'+d.template.id;check.setAttribute('aria-controls',fields.id);
      fields.hidden=true;
      label.append(check,d.template.name);
      if(d.original){const badge=document.createElement('small');badge.textContent='저장됨';label.append(badge)}
      row.append(label,fields);rows.append(row);
      check.onchange=()=>{
        d.selected=check.checked;fields.hidden=!d.selected;
        if(d.selected)fieldsFor(d,fields);
        updateStatus();
      };
    }
    submit.onclick=()=>{
      try{
        const chosen=drafts.filter(d=>d.selected);
        if(!chosen.length)return;
        const records=chosen.map(d=>model.routine(d.bindings,d.template,a=>batchOptions(a).filter(o=>batchCompatible(a,o.id))));
        const replace=chosen.filter(d=>d.original);
        if(replace.length&&!confirm(replace.map(d=>d.template.name).join(', ')+'의 저장된 연결을 갱신할까요?'))return;
        model.saveRoutines(records);
        for(const record of records)model.logObservation('routine_saved',space,source,record.templateId);
        dialog.close();setPanel('idle');notice(records.length+'개 루틴을 저장했어요.');
      }catch(error){status.textContent='저장하지 못했어요. '+error.message}
    };
    updateStatus();dialog.showModal();
  }
  function renderRecipes(){
    if(panel==='recipeList'){
      show('루틴 추가','사용할 가전을 골라 내 방에 맞춰 보세요.');
      if(fixture())action('여러 루틴 설정',openBatch,true);
      for(const t of templates)action(t.name,()=>openRecipe(t));
      action('닫기',()=>setPanel('idle'));return true;
    }
    if(panel==='applianceConfig'){
      show(recipe.name,recipe.actions.map(a=>groups[a.kind].label+' '+a.label+(a.required?' (필수)':' (선택)')).join(' · '));
      if(my)for(const a of recipe.actions)pickAppliance(a);
      const button=action('미리보기',()=>playRecipe('applianceConfig'),true);
      button.id='recipePreview';button.disabled=!recipeReady();
      if(!my&&!recipeReady())$('lifeDetail').textContent+=' · '+groups[recipe.actions[0].kind].label+' 배치 필요';
      action('닫기',()=>setPanel('idle'));return true;
    }
    if(panel!=='appliancePlaying')return false;
    const summary=recipe.actions.map(a=>{
      const d=applianceOptions(a).find(d=>d.id===playback.bindings[a.actionId]);
      return d?d.name+' '+a.label:groups[a.kind].label+' 제외';
    });
    show(recipe.name+' 실행 중',summary.join(' · ')+' · 실제 가전은 작동하지 않아요');
    if(!still())action('연출 건너뛰기',()=>{skipped=true;render();draw()});
    action('재생 종료',()=>closeMovie());
    if(my&&previousPanel!=='idle')action('내 루틴에 저장',()=>{
      const record=model.routine(playback.bindings,recipe,applianceOptions);
      if(savedRecipe(recipe)&&!confirm(recipe.name+' 연결을 바꿀까요?'))return;
      persistRoutine(record);model.logObservation('routine_saved',space,source,recipe.id);
      closeMovie('idle');notice(recipe.name+' 루틴을 저장했어요.');
    },true);
    if(!my)action('내 방에 맞추기',()=>location.assign(route('my',true)),true);
    return true;
  }
  function manageTVs(){
    $('menu').close();setPanel('devices');
  }
  function deviceAction(d){
    const registered=model.registeredTVs().includes(d.id);
    action(d.name+(registered?' 등록 해제':' 등록'),()=>{
      const active=model.registeredTVs();
      model.update(s=>s.registeredTvIds=registered?active.filter(id=>id!==d.id):[...active,d.id]);
      if(!registered)ensureTV(d);
      save();select();refresh();setPanel('devices');
    });
    if(registered&&!screenFor(d.id))action(d.name+' 방에 놓기',()=>{
      ensureTV(d);save();refresh();setPanel('devices');
    });
  }
  function route(which,adapt=false){
    const url=new URL('/editor',location.href);url.searchParams.set('space',which);
    if(params.get('observe')==='1')url.searchParams.set('observe','1');
    if(adapt){url.searchParams.set('connect','1');url.searchParams.set('source',source);
      if(panel==='appliancePlaying'&&recipe)url.searchParams.set('template',recipe.id);
    }
    return url.href;
  }
  function render(){
    offer?.disconnect();offer=null;
    if(!((friend&&panel==='idle')||(!readOnly&&!my&&!editMode&&panel==='product')))offeredTarget=null;
    for(const b of $('rooms').children)b.disabled=readOnly||!!playback;
    for(const b of document.querySelectorAll('[data-tone]'))b.disabled=readOnly;
    $('editMode').hidden=readOnly;$('saveFile').hidden=readOnly;
    $('friendRoom').href=route('example');$('mini').href=route('menu');
    $('manageTVs').hidden=!my||!fixture()||!!playback||editMode;
    $('spaces').hidden=false;$('friendRoom').hidden=friend;$('mini').hidden=menu;
    $('dreamLink').href=route('dream');$('myLink').href=route('my');
    if(!readOnly)$(my?'myLink':'dreamLink').setAttribute('aria-current','page');
    $('editMode').textContent=editMode?'배치 완료':'배치 편집';$('editMode').disabled=!!playback;
    document.body.classList.toggle('visiting',!editMode);$('living').hidden=editMode;
    for(const el of [$('reset'),$('clear'),$('openFile')])el.hidden=!editMode;
    const detail=$('lifeDetail'),actions=$('lifeActions'),tools=$('routineTools');
    if(detail.parentElement!==$('living'))actions.before(detail);
    actions.replaceChildren();tools.replaceChildren();
    const movie=saved(),recipes=templates.filter(savedRecipe);
    const shelf=my&&fixture()&&!editMode&&panel==='idle'&&!!(movie||recipes.length);
    const quick=my&&panel==='playing'&&previousPanel==='idle';
    tools.hidden=!shelf;
    $('living').classList.toggle('routine-shelf',shelf);
    $('living').classList.toggle('routine-footer',quick);
    $('living').classList.toggle('appliance-panel',panel.startsWith('appliance')||panel==='recipeList'||
      (my&&panel==='idle'&&templates.some(savedRecipe)));
    if(shelf){renderRoutineShelf(movie,recipes);return}
    if(editMode)return;
    if(menu){
      show('LG 미니룸');
      action('드림룸 들어가기',()=>{log('miniroom_open');location.assign(route('dream'))},true).id='enter';
      action('예시 친구 방',()=>location.assign(route('example')));
      return;
    }
    if(friend&&panel==='idle'){
      show('예시 친구 방','소파에 영화 보기 루틴이 있어요.');
      observeOffer($('lifeDetail'),'example-sofa');
      return;
    }
    if(panel==='friendMovie'){
      show('영화 보기','TV 켜기 · 조명 30% · 커튼 닫기');
      action('미리보기',()=>startMovie());
      action('내 방에 맞추기',()=>location.assign(route('my',true)),true);
      action('닫기',()=>setPanel('idle'));return;
    }
    if(renderRecipes())return;
    if(quick){
      show('내 루틴',nameOf(playback.bindings['tv-on'])+' 재생 중 · 실제 가전은 작동하지 않아요');
      action('재생 종료',()=>closeMovie(),true).classList.add('stop');return;
    }
    if(panel==='repair'){
      const any=liveTVs().length>0;
      show('영화 보기 · TV 다시 연결',any?'대체 TV를 선택하면 기존 조명 설정으로 바로 재생해요.':'연결할 TV가 없어요. 체험용 TV를 등록해 주세요.');
      if(any){
        tvPicker('대체 TV');
        action('연결하고 재생',()=>startMovie('repair'),true).disabled=!liveTVs().some(d=>d.id===bindings['tv-on']);
      }else action('체험용 TV 관리',manageTVs,true);
      action('취소',()=>setPanel('idle'));return;
    }
    if(panel==='devices'){
      show('체험용 TV 관리','등록을 해제하면 해당 TV는 루틴의 연결 목록에서 빠집니다.');
      for(const d of tvCatalog())deviceAction(d);
      action('완료',()=>setPanel('idle'),true);return;
    }
    if(panel==='setup'||(panel==='idle'&&my&&!fixture())){
      show('마이룸',recipe?recipe.name+'에 쓸 가상 기기를 연결해 보세요.':'거실 TV와 침실 TV, 조명과 소파를 놓고 시작하세요.');
      action('체험용 기기 사용',prepare,true);
      if(!recipe)action('다른 가전 루틴',()=>setPanel('recipeList'));return;
    }
    if(panel==='playing'){
      const light=!!playback.bindings['light-dim'];
      show('영화 보기 재생 중',(my?nameOf(playback.bindings['tv-on']):'TV')+' 재생 · '+(light?'조명 30%':'조명 제외')+(my?' · 커튼 제외':' · 커튼 닫힘')+' · 실제 가전은 작동하지 않아요');
      if(!still())action('연출 건너뛰기',()=>{skipped=true;walking=false;render();draw()});
      action('재생 종료',()=>closeMovie());
      if(my){action('내 루틴에 저장',storeRoutine,true);action('연결 설정',()=>closeMovie('connect'))}
      else action('내 방에 맞추기',()=>location.assign(route('my',true)),true);
      return;
    }
    if(panel==='connect'){
      const missing=model.registeredTVs().length?'등록된 TV가 전원 켜기를 지원하지 않아요.':'연결할 TV가 없어요.';
      show('영화 보기 연결',(liveTVs().length?'TV 필수':'TV 필수 · '+missing)+' · 조명 선택 · 커튼은 연결할 기기 없음');
      tvPicker('재생할 TV');
      if(!liveTVs().length)action('체험용 TV 관리',manageTVs);
      for(const a of model.actions.filter(a=>a.kind==='light')){
        const device=model.candidates(a)[0];if(!device)continue;
        const on=bindings[a.actionId]===device.id;
        const b=action((on?'✓ ':'＋ ')+(a.kind==='tv'?'TV 켜기':'조명 30%'),()=>{
          if(on)delete bindings[a.actionId];else bindings[a.actionId]=device.id;render();
        });b.setAttribute('aria-pressed',String(on));
        if(a.kind==='light'&&!list().some(o=>o.k==='floor_lamp'))b.disabled=true;
      }
      action('미리보기',()=>startMovie(),true).disabled=!liveTVs().some(d=>d.id===bindings['tv-on']);
      action('다른 가전 루틴',()=>setPanel('recipeList'));action('여러 루틴 설정',openBatch);return;
    }
    if(panel==='product'||panel==='saved'){
      const screenName=my&&target?.deviceId?nameOf(target.deviceId):M.products[target?.k]?.n||'TV';
      show(panel==='saved'?'영화 보기 · 연결 기기':screenName+' · 영화 보기',panel==='saved'?
        nameOf(saved()?.bindings['tv-on'])+' · '+(saved()?.bindings['light-dim']?'거실 조명 30%':'조명 제외')+' · 커튼 제외':(seat?'고양이가 가까운 소파에서 TV를 봐요.':'고양이가 TV 앞에 서서 봐요.'));
      const button=action('영화 보기',()=>startMovie(),true);
      if(panel==='product'&&!my)observeOffer(button,target);
      if(panel==='product')action(poweredTV===target?'TV 끄기':'TV 켜기',()=>{
        poweredTV=poweredTV===target?null:target;setPanel('product');
      });
      if(my)action('연결 설정',connect);
      action('닫기',()=>tap(null));return;
    }
    if(panel==='lamp'){show('스탠드 조명',lampOn?'켜짐':'꺼짐');action(lampOn?'조명 끄기':'조명 켜기',()=>{lampOn=!lampOn;setPanel('lamp')});return}
    show(my?'마이룸':'드림룸',list().some(isTV)?'방 안의 TV를 눌러 보세요.':'배치 편집에서 TV와 소파를 놓아 보세요.');
    if(my&&fixture()){
      action('루틴 연결',connect);action('루틴 추가',openBatch);
    }
  }
  function enter(){
    if(menu){$('view').tabIndex=-1;$('view').setAttribute('aria-label','드림룸 미리보기')}
    if(friend)$('view').setAttribute('aria-label','예시 친구 방. 소파를 누르거나 방향키로 선택한 뒤 Enter로 루틴을 열 수 있어요.');
    if(model.observing){
      if(menu)$('dreamLink').addEventListener('click',()=>log('miniroom_open'));
      $('observationFile').hidden=false;
      $('observationFile').onclick=()=>{try{model.exportObservation()}catch{notice('관찰 기록을 내려받을 수 없어요.')}};
      document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!offeredTarget&&(panel==='product'||(friend&&panel==='idle')))render()});
    }
    reducedMotion.addEventListener('change',()=>{
      if(reducedMotion.matches)walking=false;
      if(playback){render();draw();if(!still())animate()}
    });
    $('editMode').onclick=toggleEdit;$('manageTVs').onclick=manageTVs;
    window.addEventListener('storage',e=>{
      if(my && (e.key==='lg-miniroom.state'||e.key==='lg-miniroom.dot.my'||e.key===null))location.reload();
    });
    if(my&&params.has('connect')){
      recipe=templates.find(t=>t.id===params.get('template'))||null;
      if(!fixture())setPanel('setup');else if(recipe)openRecipe(recipe);else connect();
      if(fixture()||!recipe)clearConnectLink();
    }
    if(history.state?.dotMovie)history.replaceState(null,'');
    if(model.storageMessage)notice(model.storageMessage);
    window.addEventListener('pageshow',e=>{if(e.persisted)location.reload()});
  }
  const interactive=o=>!menu&&(!!recipeFor(o.k)||isTV(o)||o.k==='sofa'||(!friend&&o.k==='floor_lamp'));
  return {enter,visible,interactive,identifyDevices,editing:()=>editMode,frame,tap,canAdd,reset,initialMy};
}
