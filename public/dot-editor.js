(() => {
  'use strict';
  const M=DotScene, $=id=>document.getElementById(id);
  const cv=$('scene'), view=$('view'), drawer=$('drawer'), ctx=cv.getContext('2d');
  const cats=['가전','가구','소품','바닥','벽','구조'];
  const myDrawerOrder=new Map(['fridge_bm','robot_vacuum','vacuum','fridge_pb','fridge_sg'].map((key,i)=>[key,i]));
  const hist={A:[],B:[],C:[]};
  let room='B', tone='pink', layouts={}, next=1, cat='가전', selected=null, overlap=[];
  let life=null;
  const online=location.protocol!=="file:";
  const requestedSpace=new URLSearchParams(location.search).get('space');
  const space=online&&['menu','example','my'].includes(requestedSpace)?requestedSpace:'dream';
  const readOnly=space==='menu'||space==='example';
  let storeKey=online&&space==="my"?"lg-miniroom.dot.my":"dotroom";
  let ordered=[],displayed=[], storageOK=true, noticeTimer, ready=false;
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
    if(life && space!=='example')return layout.filter(o=>!life.isAppliance(o.k));
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
    const moving=frame?.movingRobot;
    const movingUnits=frame?.movingUnits;
    displayed=movingUnits?.size?M.sorted(room,ordered.map(o=>movingUnits.get(o.id)||o)):ordered;
    M.paint(ctx,room,tone,displayed,moving&&selected?.id===moving.id?moving:selected,frame);
  }
  function placementStatus(k,unitId){
    if(unitId)return life.canAdd(k,unitId)?'놓을 수 있음':'배치됨';
    return '이 방에 '+list().filter(o=>o.k===k).length+'개 배치';
  }
  function updateTools(){
    $('sample').hidden=!selected;$('actions').hidden=!selected;
    $('name').textContent=selected?M.products[selected.k].n+((M.products[selected.k].wall)?' · 벽걸이':''):browseHint();
    if(selected)M.thumbnail($('sample'),selected.k,tone,selected);
    const wall=selected&&M.products[selected.k].wall;
    $('flip').textContent=wall?'벽 전환':'↻ 90°';
    $('flip').setAttribute('aria-label',wall?'부착 벽 전환':'오른쪽 90도 회전');
    $('ccw').hidden=!!wall;
    $('aim').hidden=selected?.k!=='sofa'||M.facingScreen(selected,ordered)==null;
    if(selected&&!wall)$('name').textContent+=' · '+(M.heading(selected)*90)+'°';
    $('overlap').hidden=overlap.length<2;
    $('undo').disabled=!hist[room].length;
    $('duplicate').disabled=!!(selected&&life&&!life.canAdd(selected.k));
    $('products').querySelectorAll('[data-key]').forEach(b=>{
      b.setAttribute('aria-pressed',String(b.dataset.key===selected?.k&&(!b.dataset.unit||b.dataset.unit===selected?.deviceId)));
      b.disabled=!!life&&!life.canAdd(b.dataset.key,b.dataset.unit);
      const status=b.querySelector('small');
      if(status)status.textContent=placementStatus(b.dataset.key,b.dataset.unit);
    });
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
    const items=Object.values(M.products).filter(i=>i.c===cat&&(!life||life.allowed(i.k)));
    if(space==='my'&&cat==='가전'){
      items.sort((a,b)=>(myDrawerOrder.get(a.k)??myDrawerOrder.size)-(myDrawerOrder.get(b.k)??myDrawerOrder.size));
    }
    const cards=items.flatMap(item=>life&&space==='my'&&life.isAppliance(item.k)?
      life.owned(item.k).map(unit=>({item,unit})):[{item}]);
    $('count').textContent=items.length+'종';
    $('products').replaceChildren(...cards.map(({item,unit},index)=>{
      const b=document.createElement('button'),pic=document.createElement('canvas'),name=document.createElement('span');
      b.className='card';b.dataset.key=item.k;b.setAttribute('aria-pressed',String(selected?.k===item.k&&(!unit||unit.id===selected?.deviceId)));
      if(unit)b.dataset.unit=unit.id;
      b.disabled=!!life&&!life.canAdd(item.k,unit?.id);
      pic.width=64;pic.height=54;pic.setAttribute('aria-hidden','true');M.thumbnail(pic,item.k,tone);
      name.textContent=unit?.name||item.n;b.append(pic,name);
      if(life?.isAppliance(item.k)){
        const status=document.createElement('small');status.id='placement-'+index;
        b.setAttribute('aria-label',name.textContent);b.setAttribute('aria-describedby',status.id);
        status.textContent=placementStatus(item.k,unit?.id);
        b.append(status);
      }
      b.onclick=()=>add(item.k,unit?.id);return b;
    }));
    if(!items.length)$('products').textContent=space==='my'?'ThinQ 등록 가전이 없어요.':'가전 수집에서 제품을 골라 보세요.';
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
  function add(k,unitId){
    if(life && !life.canAdd(k,unitId))return;
    const it=M.products[k],{W,D}=M.roomData(room);
    const o={id:id(),k,f:0,e:0,x:Math.round((W-it.w)/2),y:it.wall?0:Math.round((D-it.d)/2)};
    findSpace(o);
    checkpoint();life?.bindUnit(o,unitId);list().push(o);select(o);drawerOpen(false);save();refresh();fit();reveal();
  }
  function placeCollected(k){
    cat=M.products[k].c;sync();inventory();add(k);
    view.focus({preventScroll:true});
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
          if(life&&!life.visible(p))return false;
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
  $('aim').onclick=()=>edit(o=>{const next=M.facingScreen(o,ordered);if(next!=null)M.turnTo(room,o,next)});
  const height=n=>edit(o=>o.e=Math.max(-M.products[o.k].elev,o.e+n));
  function duplicate(){
    if(!selected||(life&&!life.canAdd(selected.k)))return;
    checkpoint();const o={...selected,id:id(),x:selected.x+3,y:selected.y+3};M.clamp(room,o);
    delete o.deviceId;life?.bindUnit(o);list().push(o);select(o);save();refresh();reveal();
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
    const n=native(p), stack=M.hits(room,tone,displayed,n.x,n.y);
    if(displayed!==ordered)for(let i=0;i<stack.length;i++)stack[i]=ordered.find(o=>o.id===stack[i].id);
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
      if(space==='my'){
        await model.loadHome();
        if(model.homeSource!=='demo')storeKey+='.'+model.homeSource;
        if(model.homeSource==='unavailable')storageOK=false;
      }
      life=createLivingRoom({model,space,M,$,list,id,room:()=>room,tone:()=>tone,notice,
        draw:paintFrame,refresh,inventory,placeCollected,save,home,findSpace,select,drawerOpen,gestureActive:()=>!!gesture});
    }
    try{const old=space==='example'?null:localStorage.getItem(storeKey);if(old!==null){raw=JSON.parse(old);if(!valid(raw))throw Error()}}
    catch{raw=null;storageOK=false;notice('기존 저장본을 열 수 없어 자동 저장을 멈췄어요.')}
    life?.restoreDeviceIds(raw);
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

function createLivingRoom({model,space,M,$,list,id,room,tone,notice,draw,refresh,inventory,placeCollected,save,home,findSpace,select,drawerOpen,gestureActive}){
  const my=space==='my',params=new URLSearchParams(location.search);
  const friend=space==='example',menu=space==='menu',readOnly=friend||menu;
  const samplePreview=friend&&params.has('previewTemplate');
  const source=(friend&&!samplePreview)||params.get('source')==='example_room'?'example_room':'collection';
  const isTV=o=>o && ['tvset','standbyme'].includes(o.k);
  const saved=()=>model.state.savedRoutines.find(r=>r.anchorId==='sofa'&&r.templateId==='movie-night');
  let editMode=false, panel='idle',target=null,seat=null,start=null,started=0,walking=false;
  let playback=null,previousPanel='idle',bindings={},raf=0,lastFrame=-100,offer=null;
  let lampOn=false,poweredTV=null,sceneBeforeMovie=null;
  let reaction=null;
  let cleaningRuns=[];
  const approachMs=740,reactionCycleMs=2100;
  const sample=model.homeSource==='demo';
  const hasHome=()=>model.homeSource==='thinq'||(sample&&model.state.myFixtureId==='sample-home-v1');
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
  const tvCatalog=()=>(sample?model.devices:model.registeredAppliances()).filter(d=>d.kind==='tv');
  const nameOf=id=>tvCatalog().find(d=>d.id===id)?.name||'이전 TV';
  const liveTVs=()=>model.candidates(tvAction);
  const screenFor=id=>list().find(o=>isTV(o)&&o.deviceId===id&&visible(o));
  const availableTVs=()=>liveTVs().filter(d=>screenFor(d.id));
  const available=id=>!!id&&availableTVs().some(d=>d.id===id);
  const needsRepair=()=>!!saved()&&!available(saved().bindings['tv-on']);
  const isAppliance=model.isCollectibleProduct;
  const owned=k=>model.registeredAppliances().filter(d=>d.k===k);
  function allowed(k){
    if(friend||!isAppliance(k))return true;
    return my?owned(k).length>0:model.collected(k);
  }
  function visible(o){
    if(!my||!isAppliance(o.k))return allowed(o.k);
    return owned(o.k).some(d=>d.id===o.deviceId)&&
      list().find(other=>other.k===o.k&&other.deviceId===o.deviceId)===o;
  }
  function freeUnit(k,unitId){
    return owned(k).find(d=>(!unitId||d.id===unitId)&&!list().some(o=>o.k===k&&o.deviceId===d.id));
  }
  function canAdd(k,unitId){
    return allowed(k)&&(!my||!isAppliance(k)||!!freeUnit(k,unitId));
  }
  function bindUnit(o,unitId){
    if(!my||!isAppliance(o.k))return;
    const d=freeUnit(o.k,unitId);
    if(!d)throw Error('이 방에 놓을 수 있는 등록 기기가 없어요.');
    o.deviceId=d.id;
  }
  const hasLamp=()=>list().some(o=>o.k==='floor_lamp'&&visible(o));
  const templates=model.applianceTemplates,groups=model.applianceGroups;
  const groupFor=k=>Object.keys(groups).find(kind=>groups[kind].keys.includes(k));
  const recipeFor=k=>templates.find(t=>t.actions.some(a=>a.kind===groupFor(k)));
  const tapKind=k=>k?.startsWith('fridge_')?'fridge':k==='vacuum'||k==='robot_vacuum'?k:null;
  const tapDescriptions={
    fridge:'고양이가 냉장고 문을 올려다보며 간식을 기다려요.',
    vacuum:'청소기가 떨리면 고양이가 한 발 물러났다가 다시 들여다봐요.',
    robot_vacuum:'고양이가 움직이는 로봇청소기를 눈으로 따라가요.'
  };
  let recipe=null,recipeBindings={},recipeEffects={};
  function remember(t){
    try{model.rememberPreview(t.id,source)}catch{notice('발견 기록을 저장할 수 없어요. 저장 공간을 확인해 주세요.')}
  }
  function productUse(k){
    if(k==='robot_vacuum')return tapDescriptions[k]+' 청소 시간 루틴을 시작할 수 있어요.';
    if(tapKind(k))return tapDescriptions[tapKind(k)];
    if(isTV({k}))return '영화 보기에서 화면을 켜요.';
    if(k==='floor_lamp')return '영화 보기에서 조명을 30%로 낮춰요.';
    const t=recipeFor(k),a=t?.actions.find(a=>a.kind===groupFor(k));
    return a?t.name+'에서 '+a.label+' 동작을 체험해요.':'방을 꾸미는 수집품이에요. 연결된 루틴은 아직 없어요.';
  }
  const savedRecipe=t=>model.state.savedRoutines.find(r=>r.templateId===t.id);
  function restoreDeviceIds(raw){
    // Old sample homes assigned random IDs on placement. Reuse them only for
    // the models already present in the sample account, never grant a model from a layout.
    if(!my||!sample||!hasHome()||!raw||model.state.sampleDeviceIds)return;
    const items=Object.values(raw.layouts).filter(Array.isArray).flat();
    const linked=new Set(model.state.savedRoutines.flatMap(r=>Object.values(r.bindings)));
    const ids={};
    for(const {k} of model.registeredAppliances()){
      const group=groupFor(k);if(!group)continue;
      const candidates=items.filter(o=>o.k===k&&typeof o.deviceId==='string'&&
        new RegExp('^my-'+group+'-[a-f0-9]+-[a-f0-9]+-[a-f0-9]+$').test(o.deviceId));
      const existing=candidates.find(o=>linked.has(o.deviceId))||candidates[0];
      if(existing)ids[k]=existing.deviceId;
    }
    if(Object.keys(ids).length)try{model.update(s=>s.sampleDeviceIds=ids)}catch(e){notice(e.message)}
  }
  function identifyDevices(items){
    if(!my||!sample||!hasHome())return;
    for(const o of items){
      if(!isAppliance(o.k)||o.deviceId)continue;
      const unit=owned(o.k).find(d=>!items.some(other=>other.k===o.k&&other.deviceId===d.id));
      if(unit)o.deviceId=unit.id;
    }
  }
  function planTV(d){
    const key=d.k||(d.id==='my-tv-1'?'tvset':'standbyme');
    const existing=screenFor(d.id)||list().find(o=>o.k===key&&!o.deviceId);
    if(existing)return existing;
    const primary=key==='tvset';
    const o={id:id(),deviceId:d.id,k:key,x:primary?1:65,y:primary?49:8,f:primary?1:0,e:0};
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
    if(!hasHome())return [];
    if(!sample)return [{id:next(),k:'sofa',x:34,y:48,f:1,e:0,turn:1}];
    const entries=[['sofa',34,48,1],['tvset',1,49,1],['floor_lamp',21,49,0]];
    const oldIds={tvset:'tv',floor_lamp:'lamp',sofa:'sofa'};
    if(model.registeredTVs().includes('my-tv-2'))entries.push(['standbyme',65,8,0]);
    return entries.filter(([k])=>allowed(k)&&model.state.roomItems?.my?.[oldIds[k]]!==false).map(([k,x,y,f])=>{
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
    const t=Math.min(1,(now-started)/approachMs);
    if(!walking||t>=1){walking=false;return end}
    const eased=t*t*(3-2*t);
    return {x:start.x+(end.x-start.x)*eased,y:start.y+(end.y-start.y)*eased-3*Math.sin(Math.PI*t),depth:start.depth+(end.depth-start.depth)*eased};
  }
  function animate(){
    if(!raf)raf=requestAnimationFrame(function tick(now){
      raf=0;
      if(now-lastFrame>=60){lastFrame=now;draw()}
      if(walking||((playback||reaction||poweredTV)&&!still()))animate();
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
  function standingPoint(item,kind){
    const {w,d}=M.dims(item),{W,D}=M.roomData(room());
    const [nx,ny]=[[0,1],[-1,0],[0,-1],[1,0]][M.heading(item)];
    const cx=item.x+w/2,cy=item.y+d/2,gap=kind==='washer'?4:kind==='cleaning'?15:8;
    const frontX=cx+nx*(w/2+gap),frontY=cy+ny*(d/2+gap);
    const obstacles=list().filter(o=>visible(o)&&M.products[o.k].layer&&!M.products[o.k].wall)
      .map(o=>({x:o.x,y:o.y,...M.dims(o),loc:kind&&M.place(room(),tone(),o),flipped:o.f}));
    let best=Infinity,point=null;
    for(let x=2;x<=W-2;x+=2)for(let y=2;y<=D-2;y+=2){
      if(room()==='B'&&x+2>52&&y+2>48)continue;
      if(x>=item.x-1&&x<=item.x+w+1&&y>=item.y-1&&y<=item.y+d+1)continue;
      let score=(x-frontX)**2+(y-frontY)**2;
      if(score>=best)continue;
      if(obstacles.some(o=>x>o.x-2&&x<o.x+o.w+2&&y>o.y-2&&y<o.y+o.d+2))continue;
      if((x-cx)*nx+(y-cy)*ny<0)score+=100;
      if(score>=best)continue;
      const floor=floorPoint(x,y);
      // Check the cat's silhouette as well as its floor tile in a crowded room.
      if(kind&&obstacles.some(o=>{
        if(o.x+o.y<=floor.depth)return false;
        const {s}=o.loc;
        return [-10,0,10].some(dx=>[-21,-13,-4].some(dy=>{
          const px=floor.x+dx-o.loc.x,py=floor.y+dy-o.loc.y;
          return px>=0&&px<s.w&&py>=0&&py<s.h&&s.pixels[(py*s.w+(o.flipped?s.w-1-px:px))*4+3]>10;
        }));
      }))score+=1600;
      if(score<best){best=score;point=floor}
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
  function approachAppliance(item,kind){
    const now=performance.now();
    start=position(now);seat=null;target=item;
    standing=standingPoint(item,kind);started=now;
    walking=!still()&&Math.hypot(standing.x-start.x,standing.y-start.y)>1;
    reaction={itemId:item.id,kind,wall:item.k==='wall_ac',arrives:now+(walking?approachMs:0)};
    if(kind==='robot_vacuum')reaction.path=robotPath(item);
    if(!still())animate();
  }
  function robotPath(item,resting=standing,reserved=[]){
    const {w,d}=M.dims(item),level=M.zone(room(),item);
    const {zones}=M.roomData(room());
    const blocks=list().filter(o=>o!==item&&visible(o)&&M.products[o.k].layer&&!M.products[o.k].wall);
    let best={dx:0,dy:0,length:0};
    const directions=[[0,1],[-1,0],[0,-1],[1,0]];
    for(let i=0;i<4;i++){
      const [dx,dy]=directions[(M.heading(item)+i)%4];
      for(let n=1;n<=8;n++){
        const x=item.x+dx*n,y=item.y+dy*n,probe={...item,x,y};
        M.clamp(room(),probe);
        if(probe.x!==x||probe.y!==y||M.zone(room(),probe)!==level)break;
        const onStep=zones.some(([l,t,r,b])=>x<r&&x+w>l&&y<b&&y+d>t&&
          (x<l||x+w>r||y<t||y+d>b));
        if(onStep)break;
        if(blocks.some(o=>{
          const size=M.dims(o);
          return x<o.x+size.w&&x+w>o.x&&y<o.y+size.d&&y+d>o.y;
        }))break;
        if(reserved.some(b=>x<b.x+b.w&&x+w>b.x&&y<b.y+b.d&&y+d>b.y))break;
        const [cx,cy]=M.project(room(),x+w/2,y+d/2,level);
        if(resting&&Math.hypot(cx-resting.x,cy-resting.y)<13)break;
        if(n>best.length)best={dx,dy,length:n};
      }
      if(best.length===8)break;
    }
    return best;
  }
  function stopReaction(){
    if(!reaction)return;
    standing=position(performance.now());walking=false;reaction=null;
  }
  function frame(){
    if(editMode)return;
    const now=performance.now(),cat=position(now);
    let pose=null;
    const active=cleaningRuns[0]||reaction;
    if(active&&!walking){
      const elapsed=Math.max(0,now-active.arrives);
      const progress=still() ? 0.7 : (elapsed%reactionCycleMs)/reactionCycleMs;
      const settle=still()?1:Math.min(1,elapsed/450);
      pose={kind:active.kind,itemId:active.itemId,wall:active.wall,progress,settle};
    }
    const movie=playback&&(!playback.templateId||playback.templateId==='movie-night');
    const tv=movie?target:poweredTV;
    const movingUnits=new Map();
    if(pose?.kind==='robot_vacuum'&&!still()){
      for(const {item,path} of cleaningRuns.length?cleaningRuns:[{item:target,path:reaction.path}]){
        const step=Math.round(path.length*(1-Math.cos(2*Math.PI*pose.progress))/2);
        if(step)movingUnits.set(item.id,{...item,x:item.x+path.dx*step,y:item.y+path.dy*step});
      }
    }
    const movingRobot=movingUnits.get(target?.id)||null;
    const tvLoc=target&&M.place(room(),tone(),movingRobot||target);
    const destination=walking&&(seat?sofaPoint(seat):standing);
    const dx=destination?destination.x-start.x:tvLoc?tvLoc.x+tvLoc.s.w/2-cat.x:0;
    const dy=destination?destination.y-start.y:tvLoc?tvLoc.y+tvLoc.s.h/3-cat.y:0;
    if(pose?.kind==='robot_vacuum'){
      const gx=movingRobot?movingRobot.x-target.x:0,gy=movingRobot?movingRobot.y-target.y:0;
      pose.gazeX=Math.max(-2,Math.min(2,(gx-gy)*(dx<0?-1:1)/3));
      pose.gazeY=Math.max(-1,Math.min(1,-(gx+gy)/5));
    }
    return {cat,reaction:pose,movingRobot,movingUnits,depth:cat.depth,seat:!walking&&seat?seat.id:null,
      time:still()?0:now,walking,facingAway:dy<0,facingLeft:dx<0,
      facingSide:walking?Math.abs(dx)>Math.abs(dy)*.65:Math.abs(dx)>12,tv:tv?.id,
      appliances:recipeEffects,playing:!!movie||!!poweredTV,
      dim:!!playback?.bindings['light-dim']||(playback?.custom&&Object.values(recipeEffects).some(op=>op==='light-off'||op==='light-dim')),
      lampLit:lampOn||!!playback?.bindings['light-dim'],
      curtain:!!movie&&!my};
  }
  function clearScene(){
    cleaningRuns=[];
    if(raf)cancelAnimationFrame(raf);raf=0;walking=false;standing=start=seat=target=playback=reaction=null;
    poweredTV=null;
    offer?.disconnect();offer=null;offeredTarget=null;skipped=false;sceneBeforeMovie=null;
  }
  function reset(){
    clearScene();recipe=null;recipeBindings={};recipeEffects={};lampOn=false;panel='idle';bindings={};render();
  }
  function action(text,fn,primary=false,container=$('lifeActions')){
    const b=document.createElement('button');b.type='button';b.textContent=text;
    if(primary)b.className='primary';
    b.onclick=()=>{try{fn()}catch(e){if($('batch').open)$('batchStatus').textContent=e.message;else notice(e.message)}};
    container.append(b);return b;
  }
  function show(title,detail=''){$('lifeTitle').textContent=title;$('lifeDetail').textContent=detail}
  function setPanel(next){
    if(next!=='applianceConfig'&&next!=='petVisit')stopReaction();
    panel=next;render();draw();
    if(poweredTV&&!still())animate();
  }
  function toggleEdit(){
    if(readOnly||gestureActive())return;
    clearScene();panel='idle';editMode=!editMode;select();drawerOpen(false);
    render();refresh();home();
  }
  function prepare(){
    if(!sample)return;
    if(!hasHome())model.update(s=>{
      s.registeredTvIds=tvCatalog().map(d=>d.id);
      s.myFixtureId='sample-home-v1';s.myLayout['tv-slot']='my-tv-1';s.myLayout['light-slot']='my-light-1';
    });
    const starter=[['tvset',1,49,1],['floor_lamp',21,49,0],['sofa',34,48,1]];
    for(const [k,x,y,f] of starter){
      if(list().some(o=>k==='tvset'?isTV(o):o.k===k))continue;
      const o={id:id(),k,x,y,f,e:0};if(k==='sofa')o.turn=1;M.clamp(room(),o);list().push(o);
    }
    identifyDevices(list());for(const d of liveTVs())ensureTV(d);
    save();inventory();refresh();clearConnectLink();if(recipe)openRecipe(recipe);else connect();
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
      (isTV(target)&&visible(target)?target:list().find(o=>isTV(o)&&visible(o)));
    if(!tv){notice('배치 편집에서 TV를 놓아 주세요.');return}
    // Preserve the saved optional actions during TV repair, even in a room without a lamp.
    const repaired=from==='repair'?{...saved(),bindings:{...saved().bindings,'tv-on':chosen['tv-on']}}:null;
    if(!hasLamp())delete chosen['light-dim'];
    const result=my?model.routine(chosen):{bindings:{'tv-on':true,'light-dim':hasLamp(),'curtain-close':true}};
    if(repaired){
      persistRoutine(repaired);from='idle';log('routine_reconnected',savedSource());
    }
    if(newPlacement){placeTV(tv,device.id);save();refresh()}
    previousPanel=from;
    if(!samplePreview)history.pushState({...history.state,dotMovie:true},'');
    const replay=my&&['idle','saved'].includes(from);
    const origin=replay?savedSource():source;
    if(!my&&from==='product')log('routine_opened');
    stopReaction();
    sceneBeforeMovie={target,seat,standing,start,walking,elapsed:performance.now()-started};
    watch(tv);playback=result;panel='playing';render();draw();if(!still())animate();
    remember(model.movieTemplate);
    if(replay){if(from==='idle')log('routine_reopened',origin);log('routine_replayed',origin)}
    log('preview_opened',origin);
  }
  function leaveMovie(destination=previousPanel){
    const draft=destination==='composer'&&playback?.custom?playback:null;
    if(destination==='connect'&&playback)bindings={...playback.bindings};
    playback=null;skipped=false;recipeEffects={};cleaningRuns=[];
    if(sceneBeforeMovie){
      ({target,seat,standing,start,walking}=sceneBeforeMovie);
      if(sceneBeforeMovie.reaction&&destination===previousPanel&&!returnToBag){
        reaction={...sceneBeforeMovie.reaction,arrives:performance.now()+sceneBeforeMovie.arrivalOffset};
      }
      started=performance.now()-sceneBeforeMovie.elapsed;sceneBeforeMovie=null;
      if(still())walking=false;
      if(walking)animate();
    }
    const backToBag=returnToBag&&destination===previousPanel;
    returnToBag=false;
    panel=backToBag||draft?'idle':destination;render();draw();
    if((poweredTV||reaction)&&!still())animate();
    if(backToBag)openBag();
    if(draft)openComposer(draft);
  }
  let afterBack=null;
  function closeMovie(destination=previousPanel){
    if(samplePreview){
      const from=params.get('returnSpace')==='my'?'my':'dream';
      const ref=document.referrer&&new URL(document.referrer);
      if(ref&&ref.origin===location.origin&&ref.searchParams.get('inventory')==='1')history.back();
      else location.replace(inventoryUrl(from,{inventory:'1'}));
      return;
    }
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
    if(reaction&&reaction.itemId===o?.id)return;
    stopReaction();
    poweredTV=isTV(o)?o:null;
    const kind=tapKind(o?.k);
    if(kind){
      approachAppliance(o,kind);
      setPanel('petVisit');return;
    }
    const found=o&&recipeFor(o.k);
    if(found){
      approachAppliance(o,groupFor(o.k));
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
      if(my&&!hasHome()){setPanel('setup');return}
      watch(o);setPanel('product');
    }else if(o?.k==='sofa'&&my&&saved()){
      seat=o;walking=false;target=screenFor(saved().bindings['tv-on']);log('routine_reopened',savedSource());setPanel('saved');
    }else if(o?.k==='floor_lamp'){setPanel('lamp')}
    else{standing=position(performance.now());seat=target=null;walking=false;setPanel('idle')}
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
    if(my&&!hasHome())return [];
    return list().filter(o=>groupFor(o.k)===a.kind&&visible(o)).map(o=>({
      item:o,id:my?o.deviceId:String(o.id),name:(my&&owned(o.k).find(d=>d.id===o.deviceId)?.name)||M.products[o.k].n
    })).filter(d=>d.id);
  }
  function openRecipe(t,item=null){
    recipe=t;
    if(my&&!hasHome()){setPanel('setup');return}
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
    const k=groups[a.kind].keys.find(k=>canAdd(k));
    if(!my||!k)throw Error('연결할 등록 기기가 없어요.');
    const o={id:id(),k,x:Math.round(M.roomData(room()).W/2),y:18,f:0,e:0};
    findSpace(o);bindUnit(o);list().push(o);
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
      if(groups[a.kind].keys.some(k=>canAdd(k)))action((sample?'체험용 ':'등록 ')+label+' 배치',()=>placeAppliance(a));
      else $('lifeDetail').textContent+=' · '+label+' 연결할 기기 없음';
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
  function beginCleaningScene(effects){
    const robots=list().filter(o=>effects[o.id]==='robot_vacuum');
    if(!robots.length)return;
    const now=performance.now(),current=position(now);
    sceneBeforeMovie={target,seat,standing,start,walking,elapsed:now-started,reaction,
      arrivalOffset:reaction?reaction.arrives-now:0};
    reaction=null;
    target=robots[0];start=current;started=now;seat=nearbySofa(target);
    standing=seat?null:standingPoint(target,'cleaning');
    const end=seat?sofaPoint(seat):standing;
    walking=!still()&&Math.hypot(end.x-current.x,end.y-current.y)>1;
    const reserved=[];
    cleaningRuns=robots.map(item=>{
      const path=robotPath(item,standing,reserved),{w,d}=M.dims(item);
      const dx=path.length*path.dx,dy=path.length*path.dy;
      reserved.push({x:item.x+Math.min(0,dx),y:item.y+Math.min(0,dy),w:w+Math.abs(dx),d:d+Math.abs(dy)});
      return {item,itemId:item.id,path,kind:'robot_vacuum',arrives:now+(walking?approachMs:0)};
    });
  }
  function playRecipe(from){
    const record=model.routine(recipeBindings,recipe,applianceOptions);
    const effects={};
    for(const a of recipe.actions){
      const d=applianceOptions(a).find(d=>d.id===record.bindings[a.actionId]);
      if(d)effects[d.item.id]=a.kind;
    }
    if(!samplePreview)history.pushState({...history.state,dotMovie:true},'');
    beginCleaningScene(effects);
    previousPanel=from;playback=record;recipeEffects=effects;setPanel('appliancePlaying');
    if(!still())animate();
    remember(recipe);
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
  function renderRoutineShelf(movie,recipes,custom){
    const tools=$('routineTools');
    const broken=movie&&needsRepair();
    const empty=!movie&&!recipes.length&&!custom.length;
    show('내 루틴',movie?nameOf(movie.bindings['tv-on'])+(broken?' 재연결 필요':' 연결됨'):empty?'등록 기기의 동작을 골라 첫 루틴을 만들어 보세요.':'');
    if(!broken)action(movie?'연결 설정':'루틴 연결',connect,false,tools);
    action('루틴 추가',openBatch,false,tools);
    action('루틴 만들기',()=>openComposer(),false,tools);
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
    for(const record of custom){
      const detail=document.createElement('small');detail.id='devices-'+record.templateId;
      const steps=customSteps(record),devices=model.registeredAppliances();
      const ready=steps.every(s=>devices.some(d=>d.id===s.deviceId&&model.customOptions(d).some(a=>a.actionId===s.operation)));
      detail.textContent=ready?record.actions.map(a=>a.label).join(' · '):'기기 재연결 필요';
      shortcut(record.name,detail,()=>ready?playCustom(record,'idle'):openComposer(record));
    }
  }
  function customSteps(record){
    return record.actions.map(a=>({deviceId:record.bindings[a.actionId],operation:a.operation}));
  }
  function openComposer(record=null){
    const dialog=$('composer'),rows=$('customDevices'),name=$('customName'),submit=$('customPreview');
    const steps=record?customSteps(record):[],fields=[];
    $('composerTitle').textContent=record?'루틴 수정':'루틴 만들기';
    name.value=record?.name||'';rows.replaceChildren();
    const selected=()=>fields.filter(f=>f.select.value).map(f=>({deviceId:f.deviceId,operation:f.select.value}));
    const update=()=>{
      const count=selected().length;
      submit.disabled=!name.value.trim()||!count;
      $('customStatus').textContent=!fields.length?'지원하는 등록 기기가 없어요.':count?count+'개 동작 선택':'사용할 기기의 동작을 골라 주세요.';
    };
    for(const d of model.registeredAppliances()){
      const options=model.customOptions(d);if(!options.length)continue;
      const label=document.createElement('label'),select=document.createElement('select');
      label.append(d.name||M.products[d.k].n,select);
      select.add(new Option('사용 안 함',''));
      for(const a of options)select.add(new Option(a.label,a.actionId));
      select.value=steps.find(s=>s.deviceId===d.id)?.operation||'';
      select.onchange=update;rows.append(label);fields.push({deviceId:d.id,select});
    }
    name.oninput=update;update();
    if(steps.length>selected().length)$('customStatus').textContent='사용할 수 없는 기기가 있어요. 연결할 동작을 다시 골라 주세요.';
    submit.onclick=()=>{
      try{
        const draft=model.customRoutine(name.value,selected(),record?.templateId);
        dialog.close();playCustom(draft,'composer');
      }catch(e){$('customStatus').textContent=e.message}
    };
    dialog.showModal();
  }
  function playCustom(record,from){
    const verified=model.customRoutine(record.name,customSteps(record),record.templateId);
    recipeEffects={};
    for(const a of verified.actions){
      const item=list().find(o=>o.deviceId===verified.bindings[a.actionId]&&visible(o));
      if(item)recipeEffects[item.id]=groups[a.kind]?a.kind:a.operation;
    }
    history.pushState({...history.state,dotMovie:true},'');
    beginCleaningScene(recipeEffects);
    previousPanel=from;playback=verified;setPanel('customPlaying');if(!still())animate();
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
    if(a.kind==='light'&&!hasLamp())return [];
    return model.candidates(a);
  }
  function batchCompatible(a,id){
    return batchOptions(a).some(d=>d.id===id)&&(a.kind!=='tv'||available(id));
  }
  function inventoryUrl(which,options={}){
    const url=new URL(route(which));
    for(const [k,v] of Object.entries(options))url.searchParams.set(k,v);
    return url;
  }
  function connectFromInventory(t){
    recipe=t===model.movieTemplate?null:t;
    if(model.homeSource==='unavailable'){setPanel('idle');return}
    if(!hasHome()){setPanel('setup');return}
    if(t===model.movieTemplate){
      if(saved()&&needsRepair())beginRepair();else connect();
    }else openRecipe(t);
  }
  let returnToBag=false;
  function previewFromInventory(t){
    const device=list().find(o=>visible(o)&&(t===model.movieTemplate?isTV(o):groupFor(o.k)===t.actions[0].kind));
    if(!my&&device){
      if(t===model.movieTemplate)startMovie('product');
      else{openRecipe(t,device);playRecipe('applianceConfig')}
      returnToBag=!!playback;return;
    }
    const opener=new URL(location.href);opener.searchParams.set('inventory','1');history.replaceState(history.state,'',opener);
    location.assign(inventoryUrl('example',{previewTemplate:t.id,returnSpace:space,source:model.discovery(t.id)||source}));
  }
  function startSamplePreview(){
    const t=batchTemplates.find(t=>t.id===params.get('previewTemplate'));
    if(!t)return;
    if(t===model.movieTemplate){startMovie('friendMovie');return}
    // This is the read-only sample layout. Fill only the devices needed for this demonstration.
    for(const a of t.actions){
      if(applianceOptions(a).length)continue;
      const o={id:id(),k:groups[a.kind].keys[0],x:a.required?15:45,y:30,f:0,e:0};
      findSpace(o);list().push(o);
    }
    refresh();openRecipe(t);playRecipe('applianceConfig');
  }
  function openBag(){
    const dialog=$('routineBag'),rows=$('bagRows');
    rows.replaceChildren();
    const loading=document.createElement('p');loading.textContent='루틴을 불러오는 중이에요.';rows.append(loading);
    if(!dialog.open)dialog.showModal();
    const request=Symbol();bagRequest=request;
    async function drawRows(){
      let records,placed,unknown=false;
      try{
        if(my){
          records=model.homeSource==='unavailable'?[]:model.state.savedRoutines;
          unknown=model.homeSource==='unavailable';
          placed=list().filter(visible);
        }else{
          const snapshot=await model.inventoryHome();
          records=snapshot.records;placed=snapshot.placed;
        }
      }catch{records=[];placed=[];unknown=true}
      if(request!==bagRequest||!dialog.open)return;
      rows.replaceChildren();
      for(const t of batchTemplates){
        const record=records.find(r=>r.templateId===t.id),movie=t===model.movieTemplate;
        const required=t.actions.find(a=>a.required);
        const broken=record&&placed!==null&&!placed.some(o=>o.deviceId===record.bindings[required.actionId]&&
          (movie?isTV(o):groupFor(o.k)===required.kind));
        const known=!!model.discovery(t.id)||!!record;
        const ready=list().some(o=>visible(o)&&(movie?isTV(o):groupFor(o.k)===required.kind));
        const section=document.createElement('article'),name=document.createElement('strong'),detail=document.createElement('p');
        name.textContent=t.name;
        const need=movie?'TV':groups[required.kind].label;
        const status=record?(broken?'저장됨 · 재연결 필요':'내 루틴에 저장됨'):(known?'발견함':ready?'체험 가능':'미발견');
        detail.textContent=status+(unknown?' · 저장 상태 확인 불가':'')+' · '+need+' 필수';
        section.append(name,detail);rows.append(section);
        if(known||ready){
          action(known?'다시 미리보기':'미리보기',()=>{
            dialog.close();if(editMode)toggleEdit();previewFromInventory(t);
          },true,section);
        }
        if(known){
          action(record?(broken?'다시 연결':'저장한 연결 보기'):'내 방에 맞추기',()=>{
            dialog.close();if(editMode)toggleEdit();
            if(my)connectFromInventory(t);
            else location.assign(inventoryUrl('my',{inventoryConnect:t.id,source:model.discovery(t.id)||source}));
          },false,section);
        }
      }
    }
    drawRows().catch(()=>{if(request===bagRequest)rows.textContent='인벤토리를 읽지 못했어요. 다시 열어 주세요.'});
  }
  let bagRequest=null;
  function openBatch(){
    if(!my||!hasHome())return;
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
          info.textContent=labelText+(a.kind==='tv'&&sample?' · 방 메뉴에서 체험용 TV를 등록하세요.':' · 연결할 기기 없음');fields.append(info);
        }
        if(groups[a.kind]&&!options.length&&groups[a.kind].keys.some(k=>canAdd(k))){
          action((sample?'체험용 ':'등록 ')+groups[a.kind].label+' 배치',()=>{
            d.bindings[key]=addDemoAppliance(a);
            for(const other of drafts.filter(row=>row.selected))fieldsFor(other,$('batch-'+other.template.id));
            updateStatus();
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
      if(hasHome())action('여러 루틴 설정',openBatch,true);
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
    if(cleaningRuns.length){
      summary.push(seat?'고양이는 소파에서 청소기를 지켜봐요':'고양이는 옆에서 청소기를 지켜봐요');
      if(!cleaningRuns[0].path.length)summary.push('빈 통로가 없어 표시등만 깜박여요');
    }
    show(recipe.name+' 실행 중',summary.join(' · ')+' · 실제 가전은 작동하지 않아요');
    if(!still())action('연출 건너뛰기',()=>{skipped=true;walking=false;render();draw()});
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
      save();select();inventory();refresh();setPanel('devices');
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
  const photoPicker=space==='dream'?createPhotoPicker({$,showProducts,isCollectible:isAppliance,
    recognizePhoto:model.recognizePhoto,provider:model.photoProvider}):null;
  function openLibrary(){
    photoPicker?.reset();
    $('collectionResult').hidden=true;$('libraryBrowse').hidden=false;
    $('libraryTitle').textContent=my?'ThinQ 등록 가전':'가전 수집';
    $('libraryNote').textContent=my?(sample?(hasHome()?'체험용 ThinQ 계정에 등록된 가전이에요.':'연결된 계정이 없어요. 체험용 기기로 등록 목록을 확인할 수 있어요.'):
      model.homeSource==='thinq'?'ThinQ에서 읽은 목록이에요. 방에서는 제품군의 대표 이미지로 보여요.':'ThinQ 등록 목록을 읽지 못했어요.'):'사진은 기기 안에서만 사용해요. 후보 체험에는 예시 제품이 표시돼요.';
    $('collectionPhoto').hidden=my;
    $('libraryStatus').textContent='';showProducts();$('library').showModal();
  }
  function showCollectionResult(product,row){
    const dialog=$('library'),offset=row.getBoundingClientRect().top-dialog.getBoundingClientRect().top;
    photoPicker.reset();
    $('libraryBrowse').hidden=true;$('collectionResult').hidden=false;
    $('libraryTitle').textContent='수집 완료';$('collectedName').textContent=product.n;
    $('collectedUse').textContent=productUse(product.k);
    M.thumbnail($('collectedPic'),product.k,tone());
    $('placeCollected').onclick=()=>{
      dialog.close();
      if(!editMode)toggleEdit();
      placeCollected(product.k);
    };
    $('continueCollecting').onclick=()=>{
      $('collectionResult').hidden=true;$('libraryBrowse').hidden=false;
      $('libraryTitle').textContent='가전 수집';$('libraryStatus').textContent='';
      showProducts();
      const anchor=$('libraryItems').querySelector('[data-product="'+product.k+'"]');
      dialog.scrollTop+=anchor.getBoundingClientRect().top-dialog.getBoundingClientRect().top-offset;
      anchor.tabIndex=-1;anchor.focus({preventScroll:true});
    };
    $('placeCollected').focus();
  }
  function showProducts(keys){
    const host=$('libraryItems');host.replaceChildren();
    const entries=my?model.registeredAppliances():keys?keys.map(k=>M.products[k]):
      Object.values(M.products).filter(p=>isAppliance(p.k));
    for(const d of entries){
      const row=document.createElement('div'),pic=document.createElement('canvas'),label=document.createElement('span');
      pic.width=40;pic.height=36;pic.setAttribute('aria-hidden','true');
      if(M.products[d.k])M.thumbnail(pic,d.k,tone());
      label.textContent=d.name||M.products[d.k].n;
      row.dataset.product=d.k||'';row.append(pic,label);host.append(row);
      if(!M.products[d.k])label.append(' · 배치 미지원');
      if(!my){
        const name=label.textContent,role=document.createElement('small');
        role.textContent=productUse(d.k);label.append(role);
        const button=action(model.collected(d.k)?'수집 완료':'수집',()=>{
          const selection=photoPicker.selection(d.k);
          try{model.collect(d.k,selection?'photo':'catalog',selection)}
          catch(e){$('libraryStatus').textContent=e.message;return}
          inventory();refresh();render();showCollectionResult(d,row);
        },false,row);
        button.disabled=model.collected(d.k);button.setAttribute('aria-label',name+' 수집');
      }
    }
    if(my&&!sample)action('목록 새로고침',()=>location.reload(),false,host);
  }
  function render(){
    offer?.disconnect();offer=null;
    if(!((friend&&panel==='idle')||(!readOnly&&!my&&!editMode&&panel==='product')))offeredTarget=null;
    for(const b of $('rooms').children)b.disabled=readOnly||!!playback;
    for(const b of document.querySelectorAll('[data-tone]'))b.disabled=readOnly;
    $('routineBagButton').hidden=readOnly;$('routineBagButton').disabled=!!playback;
    $('editMode').hidden=readOnly;$('saveFile').hidden=readOnly;
    $('libraryButton').hidden=readOnly;$('libraryButton').disabled=!!playback;
    $('libraryButton').textContent=my?'등록 가전':'가전 수집';
    $('friendRoom').href=route('example');$('mini').href=route('menu');
    $('manageTVs').hidden=!my||!sample||!hasHome()||!!playback||editMode;
    $('spaces').hidden=false;$('friendRoom').hidden=friend;$('mini').hidden=menu;
    $('dreamLink').href=route('dream');$('myLink').href=route('my');
    if(!readOnly)$(my?'myLink':'dreamLink').setAttribute('aria-current','page');
    $('editMode').textContent=editMode?'배치 완료':'배치 편집';$('editMode').disabled=!!playback||(my&&model.homeSource==='unavailable');
    document.body.classList.toggle('visiting',!editMode);$('living').hidden=editMode;
    for(const el of [$('reset'),$('clear'),$('openFile')])el.hidden=!editMode;
    const detail=$('lifeDetail'),actions=$('lifeActions'),tools=$('routineTools');
    if(detail.parentElement!==$('living'))actions.before(detail);
    actions.replaceChildren();tools.replaceChildren();
    const movie=saved(),recipes=templates.filter(savedRecipe);
    const custom=model.state.savedRoutines.filter(r=>r.custom===true);
    const shelf=my&&hasHome()&&!editMode&&panel==='idle';
    const quick=my&&panel==='playing'&&previousPanel==='idle';
    tools.hidden=!shelf;
    $('living').classList.toggle('routine-shelf',shelf);
    $('living').classList.toggle('routine-footer',quick);
    $('living').classList.toggle('appliance-panel',panel.startsWith('appliance')||panel==='recipeList'||
      (my&&panel==='idle'&&templates.some(savedRecipe)));
    if(shelf){renderRoutineShelf(movie,recipes,custom);return}
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
    if(samplePreview&&playback){
      show('예시 방 · '+(recipe?.name||model.movieTemplate.name),'가상 미리보기 · 실제 가전은 작동하지 않아요');
      action('인벤토리로 돌아가기',()=>closeMovie(),true);
      action('내 방에 맞추기',()=>location.assign(inventoryUrl('my',{inventoryConnect:recipe?.id||model.movieTemplate.id,source})));
      return;
    }
    if(panel==='customPlaying'){
      const record=playback,devices=model.registeredAppliances();
      const results=record.actions.map(a=>{
        const d=devices.find(d=>d.id===record.bindings[a.actionId]);
        const placed=list().some(o=>o.deviceId===d.id&&visible(o));
        return (d.name||M.products[d.k].n)+' '+a.label+(placed?'':' (이 방에 미배치)');
      });
      show(record.name,results.join(' · ')+' · 실제 가전은 작동하지 않아요');
      if(previousPanel==='composer')action('내 루틴에 저장',()=>{
        persistRoutine(record);closeMovie('idle');notice(record.name+' 루틴을 저장했어요.');
      },true);
      action('동작 수정',()=>closeMovie('composer'));
      action('재생 종료',()=>closeMovie('idle'));return;
    }
    if(renderRecipes())return;
    if(quick){
      show('내 루틴',nameOf(playback.bindings['tv-on'])+' 재생 중 · 실제 가전은 작동하지 않아요');
      action('재생 종료',()=>closeMovie(),true).classList.add('stop');return;
    }
    if(panel==='repair'){
      const any=liveTVs().length>0;
      show('영화 보기 · TV 다시 연결',any?'대체 TV를 선택하면 기존 조명 설정으로 바로 재생해요.':sample?'연결할 TV가 없어요. 체험용 TV를 등록해 주세요.':'ThinQ 등록 목록에서 연결할 TV를 찾지 못했어요.');
      if(any){
        tvPicker('대체 TV');
        action('연결하고 재생',()=>startMovie('repair'),true).disabled=!liveTVs().some(d=>d.id===bindings['tv-on']);
      }else if(sample)action('체험용 TV 관리',manageTVs,true);
      action('취소',()=>setPanel('idle'));return;
    }
    if(panel==='devices'){
      show('체험용 TV 관리','등록을 해제하면 해당 TV는 루틴의 연결 목록에서 빠집니다.');
      for(const d of tvCatalog())deviceAction(d);
      action('완료',()=>setPanel('idle'),true);return;
    }
    if(my&&model.homeSource==='unavailable'){
      show('마이룸','ThinQ 등록 목록을 불러오지 못했어요. 연결 설정을 확인해 주세요.');
      action('다시 불러오기',()=>location.reload());return;
    }
    if(panel==='setup'||(panel==='idle'&&my&&!hasHome())){
      show('마이룸','ThinQ 앱에 등록된 가전만 놓을 수 있어요. 체험용 기기에는 냉장고, 무선청소기, 로봇청소기도 있어요.');
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
      if(sample&&!liveTVs().length)action('체험용 TV 관리',manageTVs);
      for(const a of model.actions.filter(a=>a.kind==='light')){
        const device=model.candidates(a)[0];if(!device)continue;
        const on=bindings[a.actionId]===device.id;
        const b=action((on?'✓ ':'＋ ')+(a.kind==='tv'?'TV 켜기':'조명 30%'),()=>{
          if(on)delete bindings[a.actionId];else bindings[a.actionId]=device.id;render();
        });b.setAttribute('aria-pressed',String(on));
        if(a.kind==='light'&&!hasLamp())b.disabled=true;
      }
      action('미리보기',()=>startMovie(),true).disabled=!liveTVs().some(d=>d.id===bindings['tv-on']);
      action('다른 가전 루틴',()=>setPanel('recipeList'));action('여러 루틴 설정',openBatch);
      action('루틴 만들기',()=>openComposer());return;
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
    if(panel==='petVisit'){
      const blocked=reaction?.path?.length===0;
      show(M.products[target.k].n,blocked?'빈 통로가 없어 로봇청소기가 제자리에서 깜박여요.':tapDescriptions[tapKind(target.k)]);
      if(target.k==='robot_vacuum')action('청소 시간',()=>openRecipe(recipeFor(target.k),target),true);
      action('닫기',()=>tap(null));return;
    }
    if(panel==='lamp'){show('스탠드 조명',lampOn?'켜짐':'꺼짐');action(lampOn?'조명 끄기':'조명 켜기',()=>{lampOn=!lampOn;setPanel('lamp')});return}
    show(my?'마이룸':'드림룸',list().some(o=>isTV(o)&&visible(o))?'방 안의 TV를 눌러 보세요.':
      list().some(o=>visible(o)&&recipeFor(o.k))?'방 안의 가전을 눌러 루틴을 확인해 보세요.':
      my?'배치 편집에서 등록 가전을 놓아 보세요.':'가전 수집에서 제품을 골라 방에 놓아 보세요.');
  }
  function enter(){
    if(menu){$('view').tabIndex=-1;$('view').setAttribute('aria-label','드림룸 미리보기')}
    if(friend)$('view').setAttribute('aria-label','예시 친구 방. 소파를 누르거나 방향키로 선택한 뒤 Enter로 루틴을 열 수 있어요.');
    if(samplePreview)$('view').setAttribute('aria-label','루틴 체험용 예시 방');
    if(model.observing){
      if(menu)$('dreamLink').addEventListener('click',()=>log('miniroom_open'));
      $('observationFile').hidden=false;
      $('observationFile').onclick=()=>{try{model.exportObservation()}catch{notice('관찰 기록을 내려받을 수 없어요.')}};
      document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!offeredTarget&&(panel==='product'||(friend&&panel==='idle')))render()});
    }
    reducedMotion.addEventListener('change',()=>{
      if(reducedMotion.matches)walking=false;
      if(playback||reaction||poweredTV){render();draw();if(!still())animate()}
    });
    $('routineBagButton').onclick=openBag;
    $('editMode').onclick=toggleEdit;$('manageTVs').onclick=manageTVs;$('libraryButton').onclick=openLibrary;
    window.addEventListener('storage',e=>{
      if($('routineBag').open&&e.key?.startsWith(model.discoveryPrefix)){openBag();return}
      const suffix=sample?'':'.'+model.homeSource;
      if(!friend&&(e.key==='lg-miniroom.state'+suffix||e.key===(my?'lg-miniroom.dot.my'+suffix:'dotroom')||e.key===null))location.reload();
    });
    if(my&&params.has('connect')){
      recipe=templates.find(t=>t.id===params.get('template'))||null;
      if(!hasHome())setPanel('setup');else if(recipe)openRecipe(recipe);else connect();
      if(hasHome()||!recipe)clearConnectLink();
    }
    if(history.state?.dotMovie)history.replaceState(null,'');
    if(my&&params.has('inventoryConnect')){
      const t=batchTemplates.find(t=>t.id===params.get('inventoryConnect'));
      const url=new URL(location.href);url.searchParams.delete('inventoryConnect');history.replaceState(history.state,'',url);
      if(t)connectFromInventory(t);
    }
    if(!readOnly&&params.get('inventory')==='1'){
      const url=new URL(location.href);url.searchParams.delete('inventory');history.replaceState(history.state,'',url);
      openBag();
    }
    if(samplePreview)startSamplePreview();
    if(model.storageMessage)notice(model.storageMessage);
    window.addEventListener('pageshow',e=>{if(e.persisted)location.reload()});
  }
  const interactive=o=>!menu&&(!!tapKind(o.k)||!!recipeFor(o.k)||isTV(o)||o.k==='sofa'||(!friend&&o.k==='floor_lamp'));
  return {enter,visible,allowed,owned,isAppliance,bindUnit,interactive,restoreDeviceIds,identifyDevices,editing:()=>editMode,frame,tap,canAdd,reset,initialMy};
}

function createPhotoPicker({$,showProducts,isCollectible,recognizePhoto,provider}){
  const dialog=$('library'),input=$('photoInput'),preview=$('photoPreview');
  const mode=$('photoMode'),manual=$('photoManual'),retry=$('photoRetry'),status=$('libraryStatus');
  let file=null,url=null,decoded=false,request=null,outcome='not_requested',candidates=[];

  function stop(){
    if(request){
      clearTimeout(request.timer);
      request.controller.abort();
      request=null;
    }
  }
  function reset(clearInput=true){
    stop();
    if(url)URL.revokeObjectURL(url);
    file=url=null;decoded=false;outcome='not_requested';candidates=[];
    if(clearInput)input.value='';
    preview.removeAttribute('src');preview.hidden=true;
    mode.value='manual';manual.hidden=true;retry.hidden=true;
  }
  function useCatalog(){
    stop();mode.value='manual';manual.hidden=true;retry.hidden=true;
    showProducts();status.textContent='카탈로그에서 사진 속 제품을 직접 선택하세요.';
  }
  function fallback(reason){
    outcome=reason;candidates=[];manual.hidden=true;retry.hidden=false;
    showProducts();
    status.textContent={
      no_match:'일치하는 제품이 없어요.',
      error:'후보를 불러오지 못했어요.',
      timeout:'후보 응답이 늦어지고 있어요.'
    }[reason]+' 다시 시도하거나 아래 목록에서 직접 선택하세요.';
  }
  async function run(){
    stop();
    if(!file||!decoded||!dialog.open)return;
    if(mode.value==='manual'){useCatalog();return}
    const current={controller:new AbortController()};
    request=current;outcome='pending';candidates=[];
    current.timer=setTimeout(()=>{
      if(request!==current||!dialog.open)return;
      stop();fallback('timeout');
    },8000);
    manual.hidden=false;retry.hidden=true;showProducts([]);
    status.textContent='예시 후보를 불러오는 중이에요.';
    try{
      const keys=await recognizePhoto(file,{example:mode.value,signal:current.controller.signal});
      if(request!==current||!dialog.open)return;
      if(!Array.isArray(keys))throw Error('후보 목록 형식 오류');
      candidates=[...new Set(keys.filter(isCollectible))];
      if(!candidates.length){fallback('no_match');return}
      outcome=candidates.length===1?'single':'multiple';
      showProducts(candidates);
      status.textContent=candidates.length===1?'예시 후보 1개예요. 사진 속 제품과 맞으면 수집하세요.':
        '예시 후보 '+candidates.length+'개 중 사진과 일치하는 제품을 선택하세요.';
      $('libraryItems').firstElementChild?.scrollIntoView({block:'nearest'});
    }catch{
      if(request===current&&dialog.open)fallback('error');
    }finally{
      clearTimeout(current.timer);
      if(request===current)request=null;
    }
  }

  input.onchange=async()=>{
    const selected=input.files[0];
    if(!selected)return;
    const example=mode.value;
    reset(false);mode.value=example;showProducts();status.textContent='';
    if(selected.type&&!selected.type.startsWith('image/')){
      status.textContent='이미지 파일을 선택하거나 카탈로그에서 수집하세요.';return;
    }
    file=selected;url=URL.createObjectURL(file);
    const currentURL=url;
    preview.src=url;preview.hidden=false;
    try{await preview.decode()}catch{
      if(url===currentURL&&dialog.open){
        reset();status.textContent='이 사진을 열 수 없어요. 다른 사진이나 카탈로그를 선택하세요.';
      }
      return;
    }
    if(url!==currentURL||!dialog.open)return;
    decoded=true;run();
  };
  mode.onchange=run;manual.onclick=useCatalog;retry.onclick=run;
  dialog.addEventListener('close',()=>{if(!dialog.open)reset()});

  function selection(key){
    if(!file)return null;
    if(outcome==='not_requested')return {decision:'manual'};
    const decision=candidates.length?(candidates.includes(key)?'confirmed':'corrected'):'manual';
    return {provider,outcome,decision};
  }
  return {reset,selection};
}
