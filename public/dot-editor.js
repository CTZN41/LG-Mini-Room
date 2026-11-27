(() => {
  'use strict';
  async function resumeCamera(params){
    const message=document.querySelector('#cameraReturn p');
    try{
      const pending=JSON.parse(sessionStorage.getItem('miniroom.camera.return'));
      if(!pending||pending.ticket!==params.get('ticket'))throw Error();
      const destination=new URL(pending.path,location.origin);
      if(destination.origin!==location.origin||!['/editor','/dot-room.html'].includes(destination.pathname))throw Error();
      // A same-origin request receives the Strict cookie after returning from the scanner.
      const response=await fetch('/api/members/me',{cache:'no-store'});
      if(!response.ok||(await response.json()).user?.id!==pending.owner)throw Error();
      for(const field of ['lgcam','lgcam_item','id','modelCode','displayName','category','imageUrl']){
        if(params.has(field))destination.searchParams.set(field,params.get(field));
      }
      sessionStorage.removeItem('miniroom.camera.return');
      location.replace(destination.href);
    }catch{
      message.textContent='촬영을 시작한 계정과 탭을 확인하고 카메라를 다시 열어 주세요.';
      document.querySelector('#cameraReturn a').hidden=false;
    }
  }
  if(document.documentElement.classList.contains('camera-return')){
    document.getElementById('cameraReturn').hidden=false;
    void resumeCamera(new URLSearchParams(location.search));return;
  }
  const M=DotScene, $=id=>document.getElementById(id);
  const cv=$('scene'), view=$('view'), drawer=$('drawer'), ctx=cv.getContext('2d');
  // Keep layout in phone CSS pixels even when Chrome scales down the entire preview.
  let previewScale=1;
  function fitPhone(){
    previewScale=Math.min(1,innerWidth/document.body.offsetWidth,innerHeight/document.body.offsetHeight);
    document.documentElement.style.setProperty('--preview-scale',String(previewScale));
  }
  fitPhone();window.addEventListener('resize',fitPhone);
  const cats=['가전','가구','소품','바닥','벽','구조'];
  const myDrawerOrder=new Map(['catalog:fridge:M876GBC472','catalog:robot:R560BL1','catalog:stick:A727TA','catalog:fridge:B315DS11','catalog:fridge:S836MDS002'].map((key,i)=>[key,i]));
  const hist={A:[],B:[],C:[]};
  let room='B', tone='pink', layouts={}, next=1, cat='가전', selected=null, overlap=[];
  let woodRooms=new Set();
  let life=null,bagDraft=null,afterBagPlacement=null;
  const online=location.protocol!=="file:";
  const requestedSpace=new URLSearchParams(location.search).get('space');
  const space=online&&['menu','example','my'].includes(requestedSpace)?requestedSpace:'dream';
  const readOnly=space==='menu'||space==='example';
  const compareWashers=space==='example'&&new URLSearchParams(location.search).get('compare')==='washers';
  const params=new URLSearchParams(location.search);
  const homePreview=parent!==window && params.get('homePreview')==='1' && $('account-data');
  function entryError(message){
    if(homePreview)parent.postMessage({type:'miniroom-home-preview',space,error:true},location.origin);
    if(personalRoom){
      document.documentElement.dataset.roomEntry=space;
      $('roomEntryMessage').textContent=message;$('retryRoom').hidden=false;
    }else $('name').textContent=message;
  }
  const personalRoom=online&&(space==='dream'||space==='my');
  const activeRooms=Object.keys(M.names);
  let cDisplayVersion=0;
  const washerShelf=new URLSearchParams(location.search).get('shelf')==='2'?2:1;
  let storeKey=online&&space==="my"?"lg-miniroom.dot.my":"dotroom";
  const layoutVersion=1;
  const backupKey=()=>storeKey+'.before-wood';
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
    for(const group of activeRooms.map(r=>raw.layouts[r])){
      if(Array.isArray(group))group.forEach(ProductCatalog.migratePlacement);
    }
    if(raw.room!=null&&!Object.hasOwn(M.names,raw.room))return false;
    if(raw.theme!=null&&!['pink','lime'].includes(raw.theme))return false;
    if(raw.woodRooms!=null&&(!Array.isArray(raw.woodRooms)||!raw.woodRooms.every(r=>Object.hasOwn(M.names,r))))return false;
    return activeRooms.every(r=>raw.layouts[r]==null||
      (Array.isArray(raw.layouts[r])&&raw.layouts[r].every(o=>o&&Number.isSafeInteger(o.id)&&
      !!ProductCatalog.restore(M.products,o.k)&&Number.isFinite(o.x)&&Number.isFinite(o.y)&&
      (o.routineIds==null||(Array.isArray(o.routineIds)&&o.routineIds.every(key=>typeof key==='string')))&&
      [0,1,false,true].includes(o.f)&&(o.turn==null||([0,1,2,3].includes(o.turn)&&o.turn%2===Number(o.f)))&&(o.e==null||Number.isFinite(o.e)))));
  }
  function restore(raw){
    cDisplayVersion=raw?.cDisplayVersion||0;
    room=homePreview?'A':raw?.room||(personalRoom||compareWashers?'A':'B');tone=raw?.theme||'pink';
    const saved=raw?.layouts||{};
    layouts=Object.fromEntries(activeRooms.filter(r=>saved[r]).map(r=>[r,saved[r]]));
    woodRooms=new Set(raw?.woodRooms||[]);
    next=1;
    for(const r of activeRooms)for(const o of layouts[r]||[]){next=Math.max(next,o.id+1);o.e??=0}
    for(const r of activeRooms)layouts[r]??=defaultLayout(r);
    if(space==='my')for(const items of Object.values(layouts)){
      // Existing movie routines were reachable through the sofa before individual links existed.
      const first=items.find(o=>o.k==='sofa');
      for(const o of items)if(o.k==='sofa')o.routineIds??=o===first?['movie-night']:[];
    }
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
  function placedRoom(deviceId){
    if(!deviceId)return;
    return activeRooms.find(r=>layouts[r]?.some(o=>o.deviceId===deviceId&&o.bundleId==null));
  }
  function reconcileMyUnits(){
    if(space!=='my')return;
    const seen=new Set();
    // Prefer the last open room when an older save placed one unit in multiple rooms.
    for(const r of [room,...activeRooms.filter(r=>r!==room)]){
      layouts[r]=layouts[r].filter(o=>{
        if(!o.deviceId||o.bundleId!=null)return true;
        if(seen.has(o.deviceId))return false;
        seen.add(o.deviceId);return true;
      });
    }
  }
  function cleanLayouts(){
    if(!online)return;
    for(const r of activeRooms){
      layouts[r]=layouts[r].filter(o=>{
        if(M.products[o.k]?.c!=='가전'||ProductCatalog.hasModel(o.k))return true;
        const replacement=life?.registeredReplacement(o);
        if(!replacement)return false;
        o.k=replacement;return true;
      });
    }
  }
  function defaultLayout(r){
    woodRooms.add(r);
    if(compareWashers&&r==='A'){
      const start=(washerShelf-1)*5;
      return DOT_ASSETS.items.filter(p=>p.washerStyle&&ProductCatalog.hasModel(p.k)).slice(start,start+5)
        .map((p,i)=>({id:id(),k:p.k,x:12+22*i,y:7,f:0,e:0}));
    }
    const [x,y]=r==='B'?[34,48]:r==='A'?[46,26]:[44,32];
    const sofa={id:id(),k:'sofa',x,y,f:1,e:0,turn:1};
    if(space==='my')sofa.routineIds=['movie-night'];
    return [sofa];
  }
  const record=()=>JSON.stringify({layoutVersion,...(cDisplayVersion?{cDisplayVersion}:{}),room,theme:tone,layouts,...(woodRooms.size?{woodRooms:[...woodRooms]}:{})});
  function save({retryable=false}={}){
    if(readOnly||!storageOK)return false;
    try{roomStorage.setItem(storeKey,record());return true}
    catch{
      if(!retryable){storageOK=false;notice('자동 저장을 사용할 수 없어요. 방 메뉴에서 배치 파일을 저장해 주세요.')}
      return false;
    }
  }
  function checkpoint(before=JSON.stringify(list())){
    const stack=hist[room];stack.push({before,wood:woodRooms.has(room)});if(stack.length>80)stack.shift();
  }
  function select(o=null,stack=[]){selected=o;overlap=stack}
  function clearBrowseSelection(){
    if(!ready||!life||life.editing())return;
    select();$('keyboardTarget').hidden=true;paintFrame();
  }
  view.addEventListener('blur',clearBrowseSelection);
  view.addEventListener('keydown',e=>{
    if(!ready||!life||life.editing()||$('editMode').disabled||document.body.classList.contains('room-overview'))return;
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
  function visibleItems(){
    return life?list().filter(life.visible):list().filter(o=>M.products[o.k]?.c!=='가전');
  }
  function redraw(){
    const items=visibleItems();if(bagDraft)items.push(bagDraft);
    ordered=M.sorted(room,items);paintFrame();
  }
  function paintFrame(){
    const frame=life?.frame();
    if(gesture?.candidate){
      const preview=gesture.candidate;
      displayed=M.sorted(room,ordered.map(item=>item===gesture.o?preview:item));
      M.paint(ctx,room,tone,displayed,preview,frame,!!gesture.blocker,woodRooms.has(room),true);
      return;
    }
    const moving=frame?.movingRobot;
    const movingUnits=frame?.movingUnits;
    displayed=movingUnits?.size?M.sorted(room,ordered.flatMap(o=>{
      const body=movingUnits.get(o.id);
      if(!body)return [o];
      return body.robotPart==='mobile'?[{...o,robotPart:'station'},body]:[body];
    })):ordered;
    const focus=selected||(frame?.focusedProduct!=null?displayed.find(o=>o.id===frame.focusedProduct):null);
    M.paint(ctx,room,tone,displayed,moving&&focus?.id===moving.id?moving:focus,frame,false,woodRooms.has(room),true);
  }
  function placementStatus(k,unitId){
    if(unitId){
      const r=placedRoom(unitId);
      return r?(r===room?'이 방에 배치됨':r+'룸에서 보기'):'놓을 수 있음';
    }
    const count=list().filter(o=>o.k===k).length;
    return count?'이 방에 '+count+'개 배치':'미배치';
  }
  function updateTools(){
    const myEditor=space==='my'&&life?.editing()&&!bagDraft;
    document.body.classList.toggle('my-placement-editor',!!myEditor);
    const showTools=!!(myEditor&&selected);
    const hadTools=document.body.classList.contains('my-item-selected');
    document.body.classList.toggle('my-item-selected',showTools);
    $('pickAnother').hidden=!showTools;
    if(showTools&&drawer.classList.contains('expanded'))drawerOpen(false);
    if(hadTools&&!showTools)$('products').scrollTo(0,0);
    $('sample').hidden=!selected;$('actions').hidden=!selected;
    const selectedName=selected?.deviceId?ProductCatalog.unitTitle(life?.owned(selected.k).find(d=>d.id===selected.deviceId),M.products[selected.k]):selected&&ProductCatalog.listTitle(selected.k,M.products[selected.k].n);
    $('name').textContent=selected?selectedName+((M.products[selected.k].wall)?' · 벽걸이':''):browseHint();
    if(selected)M.thumbnail($('sample'),selected.k,tone,selected);
    const item=selected&&M.products[selected.k];
    const source=item?.modelCode&&(item.photoUrl||DOT_ASSETS.modelPhotos[item.spriteKey]);
    $('editPhoto').hidden=!source;
    if(source){
      $('sample').hidden=true;$('editPhoto').alt=item.modelCode;
      $('editPhoto').onerror=()=>{$('editPhoto').hidden=true;$('sample').hidden=false};
      $('editPhoto').src=source;
    }
    $('unknownEditModel').hidden=!selected||!life?.isAppliance(selected.k)||!!item?.modelCode;
    const wall=selected&&M.products[selected.k].wall;
    $('flip').textContent=wall?'벽 전환':'↻ 90°';
    $('flip').setAttribute('aria-label',wall?'부착 벽 전환':'오른쪽 90도 회전');
    $('ccw').hidden=!!wall;
    $('aim').hidden=selected?.k!=='sofa'||M.facingScreen(selected,ordered)==null;
    if(selected&&!wall)$('name').textContent+=' · '+(M.heading(selected)*90)+'°';
    $('overlap').hidden=overlap.length<2;
    $('undo').disabled=!hist[room].length;
    $('remove').textContent=life&&!selected?.exhibit?'수납':'삭제';
    const adjustable=M.adjustableHeight(item);
    $('up').hidden=$('down').hidden=!adjustable;
    if(adjustable){
      $('down').disabled=(selected.e??0)<=-item.elev;
      $('name').textContent+=' · 높이 '+M.elevation(room,selected);
    }
    updateDrawerCards();
    // Keep the scene and touch targets in place before the next tap after a panel swap.
    if(hadTools!==showTools)fit();
  }
  function updateDrawerHeading(){
    const units=space==='my'&&cat==='가전'&&life;
    $('drawerTitle').textContent=units?(drawer.classList.contains('expanded')?'가전':'가전 · '+life.unitSummary(undefined,true)):'제품 서랍';
    if(units)$('count').textContent=life.unitSummary();
  }
  function updateDrawerCards(){
    updateDrawerHeading();
    const host=$('products'),cards=Array.from(host.querySelectorAll('[data-key]'));
    cards.forEach(b=>{
      b.setAttribute('aria-pressed',String(b.dataset.key===selected?.k&&(!b.dataset.unit||b.dataset.unit===selected?.deviceId)));
      b.disabled=!!life&&!placedRoom(b.dataset.unit)&&!life.canAdd(b.dataset.key,b.dataset.unit);
      const status=b.querySelector('.placement-status');
      if(status)status.textContent=placementStatus(b.dataset.key,b.dataset.unit);
    });
    if(space==='my'&&cat==='가전'){
      const sorted=cards.slice().sort((a,b)=>Number(!!placedRoom(a.dataset.unit))-Number(!!placedRoom(b.dataset.unit))||Number(a.dataset.order)-Number(b.dataset.order));
      if(sorted.some((card,i)=>card!==cards[i]))host.append(...sorted);
    }
  }
  function refresh(){$('comboHint').textContent='';redraw();updateTools()}
  function browseHint(){return camera.zoom>1?'빈 곳을 끌어 둘러보기':'제품을 눌러 선택'}
  function sync(){
    for(const [attr,value] of [['room',room],['cat',cat]])
      document.querySelectorAll('[data-'+attr+']').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset[attr]===value)));
  }
  const drawerPages=new Map();
  function inventory(){
    const items=Object.values(M.products).filter(i=>
      (i.c===cat||(space==='my'&&cat==='가전'&&i.k==='floor_lamp'))&&
      !ProductCatalog.componentOnly(i.k)&&(life?life.allowed(i.k):i.c!=='가전'));
    if(space==='my'&&cat==='가전'){
      items.sort((a,b)=>(myDrawerOrder.get(a.k)??myDrawerOrder.size)-(myDrawerOrder.get(b.k)??myDrawerOrder.size));
    }
    const cards=items.flatMap(item=>life&&space==='my'&&life.isAppliance(item.k)?
      life.owned(item.k).map(unit=>({item,unit})):[{item}]);
    const hints=space==='dream'?ProductCatalog.differences(items.map(item=>item.k)):null;
    drawer.classList.toggle('unit-counts',space==='my'&&cat==='가전');
    $('count').textContent=space==='my'&&cat==='가전'&&life?life.unitSummary():items.length+'종';
    const page=inventoryPage(cards,drawerPages,cat);
    $('products').replaceChildren(...page.items.map(({item,unit},index)=>{
      const b=document.createElement('button'),pic=document.createElement('canvas'),name=document.createElement('span');
      b.className='card';b.dataset.key=item.k;b.setAttribute('aria-pressed',String(selected?.k===item.k&&(!unit||unit.id===selected?.deviceId)));
      if(unit)b.dataset.unit=unit.id;
      b.dataset.order=index;
      pic.width=64;pic.height=54;pic.setAttribute('aria-hidden','true');M.thumbnail(pic,item.k,tone);
      name.className='drawer-label';
      if(unit){name.classList.add('list-title');name.textContent=ProductCatalog.unitTitle(unit,item)}
      else ProductCatalog.labelItem(name,item,null,hints);
      b.append(pic,name);
      if(life?.isAppliance(item.k)){
        const status=document.createElement('small');status.id='placement-'+index;status.className='placement-status';
        b.setAttribute('aria-label',Array.from(name.childNodes,n=>n.textContent).join(' · '));b.setAttribute('aria-describedby',status.id);
        status.textContent=placementStatus(item.k,unit?.id);
        b.append(status);
      }
      b.onclick=()=>{
        const destination=placedRoom(unit?.id);
        if(destination)focusPlacement(destination,o=>o.deviceId===unit.id);
        else add(item.k,unit?.id);
      };
      return b;
    }));
    if(page.count>1)$('products').append(pageNavigation(page,n=>{drawerPages.set(cat,n);inventory()}));
    if(!items.length)$('products').textContent=!online?'제품 DB를 사용하려면 로컬 서버에서 방을 열어 주세요.':space==='my'?'ThinQ 등록 가전이 없어요.':'가전 촬영으로 제품을 모아 보세요.';
    updateDrawerCards();$('products').scrollTo(0,0);
  }
  function drawerOpen(open){
    drawer.classList.toggle('expanded',open);$('expand').setAttribute('aria-expanded',String(open));
    $('expand').textContent=open?'접기 ⌄':'펼치기 ⌃';updateDrawerHeading();
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
    view.dataset.zoom=String(camera.zoom);
    if(!selected)$('name').textContent=browseHint();
    $('out').disabled=camera.zoom<=1.001;$('in').disabled=camera.zoom>=3.599;
  }
  function home(){
    const [l,t,r,b]=bounds[room];
    camera.zoom=document.body.matches('.room-overview,.personal-browse')?1:1.12;camera.x=(l+r)/2;camera.y=(t+b)/2;fit();
  }
  function local(x,y){const rect=view.getBoundingClientRect();return {x:(x-rect.left)/previewScale,y:(y-rect.top)/previewScale}}
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
  function focusPlacement(destination,match){
    if(destination!==room){room=destination;renderRoom();save()}
    const item=list().find(o=>match(o)&&(!life||life.visible(o)));
    if(!item){notice('배치된 항목을 찾지 못했어요.');return}
    select(item);drawerOpen(false);refresh();
    const {x,y,s}=M.place(room,tone,item);
    camera.zoom=Math.max(camera.zoom,1.5);camera.x=x+s.w/2;camera.y=y+s.h/2;fit();
    view.focus({preventScroll:true});return item;
  }
  function renderRoom(){
    $('keyboardTarget').hidden=true;
    life?.identifyDevices(list());life?.reset();
    const bg=M.bg(room,tone);cv.width=bg.width;cv.height=bg.height;
    select();drawerOpen(false);sync();inventory();refresh();home();
  }
  function newPlacement(k){
    const it=M.products[k],{W,D}=M.roomData(room);
    const o={id:id(),k,f:0,e:0,x:Math.round((W-it.w)/2),y:it.wall?0:Math.round((D-it.d)/2)};
    if(it.previousFootprint)o.artVersion=1;
    if(space==='my'&&k==='sofa')o.routineIds=[];
    if(!findSpace(o))return;
    return o;
  }
  function add(k,unitId){
    if(ProductCatalog.componentOnly(k)||(life&&!life.canAdd(k,unitId)))return;
    const o=newPlacement(k);if(!o)return;
    checkpoint();life?.bindUnit(o,unitId);list().push(o);select(o);drawerOpen(false);
    const persisted=save();refresh();fit();reveal();if(persisted){life?.placementClue(o);return o}
  }
  function startBagPlacement(unit,enterEditor,onFinish=null){
    if(!storageOK){notice('저장할 수 없어 배치를 시작하지 못했어요.');return}
    if(bagDraft||!life.canAdd(unit.k,unit.id))return;
    const item=newPlacement(unit.k);
    if(!item){notice('이 방에 놓을 자리가 없어요. 다른 가구를 옮기거나 수납해 주세요.');return}
    life.bindUnit(item,unit.id);
    enterEditor();
    bagDraft=item;afterBagPlacement=onFinish;select(item);cat=life.isAppliance(item.k)?'가전':M.products[item.k].c;drawerOpen(false);
    document.body.classList.add('placing-from-bag');$('bagPlacement').hidden=false;
    document.querySelector('.top').inert=$('spaces').inert=true;
    $('bagPlacementName').textContent=ProductCatalog.unitTitle(unit,M.products[item.k]);
    sync();inventory();refresh();fit();reveal();view.focus({preventScroll:true});
  }
  function finishBagPlacement(commit){
    if(!bagDraft||gesture)return;
    const item=bagDraft;
    if(commit){
      if(!life.canAdd(item.k,item.deviceId)){notice('현재 방에 놓을 수 없는 제품이에요.');return}
      const issue=placementIssue(item,visibleItems());if(issue){notice(issue);return}
      const before=JSON.stringify(list());
      list().push(item);
      if(!save()){list().pop();notice('배치를 저장하지 못했어요.');return}
      checkpoint(before);
    }
    bagDraft=null;select(commit?item:null);
    document.body.classList.remove('placing-from-bag');$('bagPlacement').hidden=true;
    document.querySelector('.top').inert=$('spaces').inert=false;
    inventory();refresh();view.focus({preventScroll:true});
    const done=afterBagPlacement;afterBagPlacement=null;
    if(done)done(commit);else if(commit)life.placementClue(item);
  }
  // A touch drag can suppress Chrome's synthesized click on the next control.
  function bindTapButton(button,action){
    let start=null;
    button.ontouchstart=e=>{start=e.touches.length===1?e.changedTouches[0]:null};
    button.ontouchcancel=()=>{start=null};
    button.addEventListener('touchend',e=>{
      const end=e.changedTouches[0];
      if(start&&start.identifier===end.identifier&&Math.hypot(end.clientX-start.clientX,end.clientY-start.clientY)<8){
        e.preventDefault();
        if(!button.disabled&&button.contains(document.elementFromPoint(end.clientX,end.clientY)))action();
      }
      start=null;
    },{passive:false});
    button.onclick=action;
  }
  bindTapButton($('bagPlaceConfirm'),()=>finishBagPlacement(true));
  bindTapButton($('bagPlaceCancel'),()=>finishBagPlacement(false));
  function placeCollected(k){
    cat=M.products[k].c;sync();inventory();const placed=add(k);
    view.focus({preventScroll:true});
    return placed;
  }
  function placementIssue(o,items){
    if((M.products[o.k].behaviorKey||o.k)==='robot_vacuum'&&M.robotCrossesStep(room,o))return '청소기나 앞쪽 이동 경로가 단차에 걸려요.';
    const blocker=M.placementBlocker(o,items,room);
    return blocker?M.products[blocker.k].n+' · 겹쳐서 놓을 수 없어요':'';
  }
  function findSpace(o){
    M.clamp(room,o);
    const items=visibleItems();
    // A low open drawer can fit on the floor while its entire lid is hidden by a tower.
    const drawer=M.products[o.k].washerStyle==='drawer';
    const smallSensor=M.products[o.k].catalogFamily==='센서';
    const checkView=drawer||smallSensor;
    function visibleAt(candidate){
      const order=M.sorted(room,[...items,candidate]),loc=M.place(room,tone,candidate);
      if(smallSensor){
        let solid=0,visible=0;
        for(let y=1;y<loc.s.h;y+=2)for(let x=1;x<loc.s.w;x+=2){
          const px=candidate.f?loc.s.w-1-x:x;
          if(loc.s.pixels[(y*loc.s.w+px)*4+3]<=10)continue;
          solid++;
          if(M.hits(room,tone,order,loc.x+x,loc.y+y)[0]===candidate)visible++;
        }
        return solid>0&&visible>=solid*.8;
      }
      return [0.38,0.5,0.62].every(fraction=>
        M.hits(room,tone,order,loc.x+loc.s.w*fraction,loc.y+loc.s.h*.42)[0]===candidate);
    }
    if(!placementIssue(o,items)&&(!checkView||visibleAt(o)))return true;
    const {W,D}=M.roomData(room),{w,d}=M.dims(o),wall=M.products[o.k].wall;
    const probe={...o},viewSpots=[];let best=null,distance=Infinity;
    for(let y=0;y<=(wall&&!o.f?0:D-d);y++)for(let x=0;x<=(wall&&o.f?0:W-w);x++){
      const score=(x-o.x)**2+(y-o.y)**2;
      if(!checkView&&score>=distance)continue;
      probe.x=x;probe.y=y;M.clamp(room,probe);
      if(probe.x!==x||probe.y!==y||placementIssue(probe,items))continue;
      if(checkView)viewSpots.push({x,y,score});
      if(score<distance){best={x,y};distance=score}
    }
    if(!best){notice('자리가 부족해요. 다른 제품을 옮겨 공간을 만들어 주세요.');return false}
    if(checkView){
      viewSpots.sort((a,b)=>a.score-b.score);
      for(const spot of viewSpots){
        probe.x=spot.x;probe.y=spot.y;
        if(visibleAt(probe)){best={x:spot.x,y:spot.y};break}
      }
    }
    Object.assign(o,best);return true;
  }
  function edit(change){
    if(!selected)return;
    const candidate={...selected};change(candidate);M.clamp(room,candidate);
    const issue=placementIssue(candidate,ordered);
    if(issue){notice(issue);return}
    if(JSON.stringify(selected)===JSON.stringify(candidate))return;
    if(!bagDraft)checkpoint();delete selected.rotationOrigin;Object.assign(selected,candidate);
    overlap=[];if(!bagDraft)save();refresh();reveal();
  }
  const rotate=step=>edit(o=>M.turnTo(room,o,M.products[o.k].wall?(o.f?0:3):M.heading(o)+step));
  const flip=()=>rotate(1);
  bindTapButton($('ccw'),()=>rotate(-1));
  $('aim').onclick=()=>edit(o=>{const next=M.facingScreen(o,ordered);if(next!=null)M.turnTo(room,o,next)});
  function height(n){
    if(M.adjustableHeight(selected&&M.products[selected.k]))edit(o=>o.e=Math.max(-M.products[o.k].elev,(o.e??0)+n));
  }
  function remove(){
    if(!selected||bagDraft||readOnly)return;
    const previous=list();
    if(!previous.includes(selected))return;
    layouts[room]=previous.filter(o=>o!==selected);
    if(!save({retryable:true})){
      layouts[room]=previous;notice('저장하지 못했어요. 잠시 후 다시 시도해 주세요.');return;
    }
    checkpoint(JSON.stringify(previous));
    if(life&&!selected.exhibit)notice('수납했어요. 되돌리기로 원래 위치에 놓을 수 있어요.');
    select();refresh();
  }
  function undo(){
    const previous=hist[room].at(-1);if(!previous)return;
    const restored=JSON.parse(previous.before);
    if(space==='my'&&restored.some(o=>{const r=placedRoom(o.deviceId);return r&&r!==room})){
      notice('다른 방에 놓인 기기를 먼저 수납해 주세요.');return;
    }
    const current=list(),wasWood=woodRooms.has(room);
    layouts[room]=restored;
    if(previous.wood)woodRooms.add(room);else woodRooms.delete(room);
    if(!save({retryable:true})){
      layouts[room]=current;
      if(wasWood)woodRooms.add(room);else woodRooms.delete(room);
      notice('되돌리기를 저장하지 못했어요. 다시 시도해 주세요.');return;
    }
    hist[room].pop();select();refresh();
  }
  const pointers=new Map();let gesture=null;
  function pinchData(){
    const [a,b]=[...pointers.values()];
    return {mid:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},dist:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};
  }
  view.onpointerdown=e=>{
    if(!ready||e.button!==0)return;
    if(!$('keyboardTarget').hidden)clearBrowseSelection();
    const p=local(e.clientX,e.clientY);
    view.setPointerCapture(e.pointerId);pointers.set(e.pointerId,p);view.classList.add('busy');
    if(pointers.size===2){
      const {mid,dist}=pinchData();
      gesture={type:'pinch',dist,anchor:native(mid),zoom:camera.zoom};
      $('placementHint').textContent='';paintFrame();return;
    }
    if(pointers.size!==1)return;
    if(document.body.classList.contains('room-overview')){
      gesture={type:'overview',p,x:camera.x,y:camera.y,k:camera.k};return;
    }
    const n=native(p), stack=M.hits(room,tone,displayed,n.x,n.y);
    const visiting=life&&!life.editing(),finger=visiting&&e.pointerType==='touch';
    if(finger&&(!stack.length||!M.products[stack[0].k].layer)){
      const near=M.nearbyTarget(room,tone,displayed,n.x,n.y,10/camera.k,life.interactive);
      if(near)stack.unshift(near);
    }
    if(displayed!==ordered)for(let i=0;i<stack.length;i++)stack[i]=ordered.find(o=>o.id===stack[i].id);
    // After explicitly picking a covered object, dragging that same overlap moves it.
    const o=bagDraft?(stack.includes(bagDraft)?bagDraft:null):overlap.length>1&&stack.includes(selected)?selected:stack[0];
    gesture=visiting?{type:'visit',p,o,slop:finger?10:4,x:camera.x,y:camera.y,k:camera.k}:o?{type:'move',o,stack,p,ox:o.x,oy:o.y,k:camera.k,before:JSON.stringify(list())}:
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
    if(!g.moved&&Math.hypot(dx,dy)<(g.slop??4))return;
    g.moved=true;
    if(g.type==='pan'||g.type==='visit'||g.type==='overview'){camera.x=g.x-dx/g.k;camera.y=g.y-dy/g.k;fit();return}
    previewMove(g,dx,dy);
  };
  function previewMove(g,dx,dy){
    const o={...g.o},mx=dx/g.k,my=dy/g.k;
    let wx=(mx/2+my)/2,wy=(my-mx/2)/2;
    if(M.products[o.k].wall){
      if(o.f){wy=(-2*mx+my)/5;wx=0}else{wx=(2*mx+my)/5;wy=0}
    }
    o.x=g.ox+Math.round(wx);o.y=g.oy+Math.round(wy);M.clamp(room,o);
    g.candidate=o;const message=placementIssue(o,ordered);
    g.blocker=message;
    if(!message)g.lastValid=o;
    if($('placementHint').textContent!==message)$('placementHint').textContent=message;
    select(g.o);paintFrame();
  }
  function finish(e,cancelled){
    if(!pointers.has(e.pointerId))return;
    pointers.delete(e.pointerId);
    if(gesture?.type==='pinch'){if(pointers.size>=2)return;gesture=null}
    const g=gesture;
    if(g?.type==='move'&&g.moved&&!cancelled){
      const p=local(e.clientX,e.clientY);previewMove(g,p.x-g.p.x,p.y-g.p.y);
    }
    gesture=null;$('placementHint').textContent='';
    if(g?.type==='visit'&&!cancelled&&!g.moved){
      const end=local(e.clientX,e.clientY);
      if(Math.hypot(end.x-g.p.x,end.y-g.p.y)<g.slop)life.tap(g.o);
    }
    else if(g?.type==='move'){
      if(!cancelled&&g.moved){
        const end=g.lastValid;
        if(end&&(end.x!==g.ox||end.y!==g.oy)){
          if(!bagDraft)checkpoint(g.before);
          g.o.x=end.x;g.o.y=end.y;delete g.o.rotationOrigin;if(!bagDraft)save();
        }
        if(g.blocker)notice('마지막으로 놓을 수 있던 자리에 두었어요.');
        select(g.o);
      }else if(!cancelled&&!bagDraft)select(g.stack[0],g.stack);
    }else if(g?.type==='pan'&&!g.moved&&!cancelled&&!bagDraft)select();
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
  function overview(open){
    document.body.classList.toggle('room-overview',open);
    const button=$('overview');
    button.setAttribute('aria-pressed',String(open));
    button.title=open?'미리보기로 돌아가기':'전체 보기';button.setAttribute('aria-label',button.title);
    document.querySelector('.map-zoom').hidden=!open;
    home();
    button.focus({preventScroll:true});
  }
  $('overview').onclick=()=>overview(!document.body.classList.contains('room-overview'));
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&document.body.classList.contains('room-overview')&&!document.querySelector('dialog[open]')){
      e.preventDefault();e.stopImmediatePropagation();overview(false);
    }
  },true);
  $('expand').onclick=()=>drawerOpen(!drawer.classList.contains('expanded'));
  let handleY;
  const handle=document.querySelector('.drawerHead');
  handle.addEventListener('touchstart',e=>handleY=e.touches[0].clientY,{passive:true});
  handle.addEventListener('touchend',e=>{const dy=(e.changedTouches[0].clientY-handleY)/previewScale;if(Math.abs(dy)>22)drawerOpen(dy<0)},{passive:true});
  bindTapButton($('flip'),flip);$('up').onclick=()=>height(1);$('down').onclick=()=>height(-1);
  $('pickAnother').onclick=()=>{
    select();refresh();
    $('expand').focus({preventScroll:true});
  };
  bindTapButton($('remove'),remove);bindTapButton($('undo'),undo);
  $('overlap').onclick=()=>{select(overlap[(overlap.indexOf(selected)+1)%overlap.length],overlap);refresh()};
  $('more').onclick=()=>$('menu').showModal();
  document.querySelectorAll('dialog .close').forEach(b=>b.onclick=()=>b.closest('dialog').close());
  $('clear').onclick=()=>{checkpoint();layouts[room]=[];select();save();refresh();$('menu').close()};
  $('reset').onclick=()=>{checkpoint();layouts[room]=defaultLayout(room);$('menu').close();renderRoom();save()};
  $('shot').onclick=()=>{
    const c=document.createElement('canvas');c.width=cv.width*4;c.height=cv.height*4;
    const x=c.getContext('2d');x.scale(4,4);M.paint(x,room,tone,ordered,null,null,false,woodRooms.has(room));
    const url=c.toDataURL('image/png');$('exportImage').src=url;
    $('download').href=url;$('download').download='MY DOT ROOM '+room+' '+tone+'.png';
    $('menu').close();$('picture').showModal();
  };
  function downloadLayout(text,filename){
    const a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
    a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  $('saveFile').onclick=()=>downloadLayout(record(),'dotroom.json');
  $('previousLayout').onclick=()=>{
    const backup=roomStorage.getItem(backupKey());
    if(backup)downloadLayout(backup,'dotroom-before-wood.json');
  };
  $('openFile').onclick=()=>$('layoutFile').click();
  $('layoutFile').onchange=async e=>{
    const file=e.target.files[0];e.target.value='';if(!file)return;
    try{
      const raw=JSON.parse(await file.text());
      if(!valid(raw))throw Error();
      if(!confirm('이 파일의 방과 배치로 바꿀까요? 현재 배치는 방 메뉴에서 파일로 저장할 수 있어요.'))return;
      restore(raw);cleanLayouts();reconcileMyUnits();Object.values(hist).forEach(h=>h.length=0);storageOK=true;save();$('menu').close();renderRoom();
    }catch{alert('MY DOT ROOM 배치 JSON 파일을 확인해 주세요.')}
  };
  addEventListener('keydown',e=>{
    if(document.body.classList.contains('room-overview')||(life&&!life.editing())||!ready||gesture||document.querySelector('dialog[open]')||e.target.tagName==='INPUT')return;
    if(bagDraft){
      if(e.key==='Escape'){e.preventDefault();finishBagPlacement(false);return}
      if(e.target!==view)return;
      if(e.key==='Enter'){e.preventDefault();finishBagPlacement(true);return}
      if(!e.key.startsWith('Arrow'))return;
    }
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo();return}
    if(!selected)return;
    const mv={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
    if(mv){e.preventDefault();edit(o=>{
      if(M.products[o.k].wall){if(o.f)o.y+=mv[0]+mv[1];else o.x+=mv[0]+mv[1]}
      else{o.x+=mv[0];o.y+=mv[1]}
    });return}
    switch(e.key.toLowerCase()){
      case 'r':rotate(e.shiftKey?-1:1);break;case ']':height(1);break;case '[':height(-1);break;
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
  let getWeatherPlace;
  async function startRoomEnvironment(){
    let places=[];
    let result=null,lastPlace='',lastAttempt=0,busy=false;
    function apply(){
      const now=Date.now(),local=new Date(now+9*3600000),hour=local.getUTCHours();
      const period=hour<6||hour>=20?'night':hour<9?'dawn':hour<17?'day':'dusk';
      const place=places.find(p=>p.id===getWeatherPlace?.())||places[0];
      const sample=result?.placeId===place?.id?result?.weather:null;
      const age=now-Date.parse(sample?.observedAt),fresh=age>=0&&age<=90*60000;
      const rain=fresh&&typeof sample.raining==='boolean'?(sample.raining?'rain':'dry'):'unknown';
      view.dataset.period=period;view.dataset.weather=rain;
      const label=$('environmentLabel');
      const time=local.toISOString().slice(11,19);
      label.textContent=time+(rain==='rain'?' · 비':fresh&&Number.isFinite(sample.temperature)?' · '+sample.temperature+'°':'');
      label.title=(place?.label||'한국')+' · '+({dawn:'아침',day:'낮',dusk:'저녁',night:'밤'})[period]+
        (rain==='unknown'?' · 날씨 확인 대기':rain==='rain'?' · 비':' · 비 없음');
      label.setAttribute('aria-label',label.title+' · '+time);
      return place?.id;
    }
    async function update(){
      const place=apply();
      if(!getWeatherPlace||!online||document.hidden||busy||!place||(lastPlace===place&&Date.now()-lastAttempt<300000))return;
      lastAttempt=Date.now();lastPlace=place;busy=true;
      try{
        const response=await fetch('/api/routine-context?'+new URLSearchParams({place}),{cache:'no-store',signal:AbortSignal.timeout(15000)});
        if(!response.ok)throw Error();
        const data=await response.json();
        if(data.placeId!==place)throw Error();
        result=data;
      }catch{result=null}
      finally{busy=false;apply()}
    }
    let timer;
    function tick(){
      clearTimeout(timer);
      if(document.hidden)return;
      void update();
      timer=setTimeout(tick,1000-Date.now()%1000);
    }
    tick();
    document.addEventListener('visibilitychange',tick);
    window.addEventListener('pagehide',()=>clearTimeout(timer));
    window.addEventListener('pageshow',tick);
    if(online){({places}=await import('./routine-places.mjs'));update()}
  }
  async function init(){
    logo();let raw=null;
    if(online){
      try{await ProductCatalog.loadModels();await ProductCatalog.loadRetiredSales()}catch{
        storageOK=false;entryError('제품 목록을 불러오지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.');return;
      }
    }
    await Promise.all([M.load(),online&&ProductCatalog.loadBodies().catch(()=>{
      notice('제품별 외형 정보를 불러오지 못해 기본 도트로 표시해요.');
    })]);
    if(online){
      if(compareWashers){
        const link=$('washerShelf'),nextShelf=washerShelf===1?2:1,url=new URL(location.href);
        url.searchParams.set('shelf',String(nextShelf));
        link.href=url.href;link.textContent='비교 '+nextShelf+'관 보기';link.hidden=false;
      }
      if(!compareWashers){
        for(const item of Object.values(M.products)){
          if(item.washerStyle)item.photoUrl='/api/catalog/photo?'+new URLSearchParams({category:'세탁기',model:item.modelCode,v:'2'});
        }
      }
      const model=await import('./state.js');
      for(const k of model.state.collection)ProductCatalog.restore(M.products,k);
      if(space==='my'){
        await model.loadHome();
        if(model.homeSource!=='demo')storeKey+='.'+model.homeSource;
        if(model.homeSource==='unavailable')storageOK=false;
      }
      getWeatherPlace=()=>model.state.weatherPlace;
      if(!readOnly)try{model.pruneRetiredCollection()}catch(e){storageOK=false;entryError(e.message);return}
      for(const k of [...Object.values(model.demoModels),...model.registeredAppliances().map(d=>d.k)]){
        if(ProductCatalog.hasModel(k))ProductCatalog.restore(M.products,k);
      }
      const conditions=space==='my'?await import('./routine-condition-editor.mjs'):null;
      life=createLivingRoom({model,conditions,showApplianceDrawer:()=>{cat='가전';sync();inventory()},space,compareWashers,M,$,list,placedRoom,id,room:()=>room,tone:()=>tone,notice,
        draw:paintFrame,refresh,inventory,focusPlacement,placeCollected,startBagPlacement,save,checkpoint,home,findSpace,select,drawerOpen,gestureActive:()=>!!gesture});
    }
    try{
      const old=space==='example'?null:roomStorage.getItem(storeKey);
      if(old!==null){
        raw=JSON.parse(old);
        if(!valid(raw)||(raw.layoutVersion!=null&&raw.layoutVersion!==layoutVersion))throw Error();
        life?.restoreDeviceIds(raw);
        if(raw.layoutVersion==null&&storageOK){
          // Write the original first. A failed backup must never overwrite the active layout.
          if(!readOnly&&roomStorage.getItem(backupKey())===null)roomStorage.setItem(backupKey(),old);
          if(!personalRoom)raw={room:'B',theme:raw.theme,layouts:{}};
        }
      }
      $('previousLayout').hidden=readOnly||roomStorage.getItem(backupKey())===null;
    }catch{
      if(!valid(raw))raw=null;
      storageOK=false;notice('기존 배치를 보존하기 위해 자동 저장을 멈췄어요.');
    }
    restore(raw);
    cleanLayouts();
    if(space==='my'&&raw){
      const before=record();
      reconcileMyUnits();
      if(storageOK&&before!==record()){
        try{
          const key=storeKey+'.before-unit-limit';
          if(roomStorage.getItem(key)===null)roomStorage.setItem(key,roomStorage.getItem(storeKey));
        }catch{storageOK=false;notice('기존 배치를 보관할 수 없어 자동 저장을 멈췄어요.')}
      }
    }
    if(personalRoom&&!homePreview&&(params.has('room')||params.get('display')==='retro')){
      const requested=params.get('room')||(params.get('display')==='retro'?'C':null);
      if(activeRooms.includes(requested))room=requested;
      const url=new URL(location.href);url.searchParams.delete('room');url.searchParams.delete('display');
      history.replaceState(history.state,'',url);
    }
    if(online)fetch('/experience/qr',{method:'HEAD'}).then(r=>{$('visitorQR').hidden=!r.ok}).catch(()=>{});
    for(const r of activeRooms){
      const name=M.names[r];
      const b=document.createElement('button');b.dataset.room=r;b.innerHTML='<b>'+r+'</b>'+name;
      bindTapButton(b,()=>{
        if(room===r||bagDraft||gesture)return;room=r;renderRoom();save();
      });$('rooms').append(b);
    }
    for(const c of cats){const b=document.createElement('button');b.dataset.cat=c;b.textContent=c;
      b.onclick=()=>{cat=c;sync();inventory()};$('categories').append(b)}
    if(location.protocol==='file:')$('mini').hidden=true;
    ready=true;renderRoom();
    delete document.documentElement.dataset.roomEntry;
    home();await life?.enter();
    if(homePreview){
      const model=await import('./state.js');
      const units=space==='my'?model.registeredAppliances():[...new Set(model.state.collection)].filter(model.isCollectibleProduct).map(k=>({k}));
      const placed=new Set(Object.values(layouts).flat().filter(o=>!o.exhibit && o.bundleId==null).map(o=>o.k));
      const rows=units.slice(0,3).map(unit=>{
        const item=ProductCatalog.restore(M.products,unit.k), pic=document.createElement('canvas');
        pic.width=48;pic.height=42;M.thumbnail(pic,unit.k,tone);
        const name=ProductCatalog.unitTitle(unit,item),shortName=ProductCatalog.listTitle(item.k,item.n);
        const detail=space==='my'?(shortName===name?'등록 가전':shortName):(placed.has(unit.k)?'드림룸에 놓임':'도감에 보관');
        return {key:unit.k,name,detail,image:pic.toDataURL(),placed:placed.has(unit.k)};
      });
      const [left,top,right,bottom]=bounds[room], shot=document.createElement('canvas');
      shot.width=right-left;shot.height=bottom-top;
      shot.getContext('2d').drawImage(cv,-left,-top);
      parent.postMessage({type:'miniroom-home-preview',space,room,image:shot.toDataURL(),count:units.length,rows,unavailable:space==='my'&&model.homeSource==='unavailable'},location.origin);
      return;
    }
    if(params.get('homeAction')==='overview')overview(true);
    save();
    new ResizeObserver(fit).observe(view);
  }
  if(!homePreview)void startRoomEnvironment();
  init().catch(e=>{console.error(e);entryError('방을 불러오지 못했어요. 다시 시도해 주세요.')});
})();

// Keep thumbnail canvases bounded on accounts with the entire catalog.
function inventoryPage(items,pages,key,focusIndex=-1){
  const size=36,count=Math.max(1,Math.ceil(items.length/size));
  const index=Math.min(count-1,focusIndex>=0?Math.floor(focusIndex/size):(pages.get(key)||0));
  pages.set(key,index);
  return {index,count,items:items.slice(index*size,(index+1)*size)};
}
function pageNavigation(page,select){
  const nav=document.createElement('nav');nav.className='inventory-pages';nav.setAttribute('aria-label','제품 목록 페이지');
  const status=document.createElement('span');status.textContent=(page.index+1)+' / '+page.count;
  function button(label,n){
    const b=document.createElement('button');b.type='button';b.textContent=label;
    b.disabled=n<0||n>=page.count;b.onclick=()=>select(n);return b;
  }
  nav.append(button('이전',page.index-1),status,button('다음',page.index+1));return nav;
}
function createLivingRoom({model,conditions,showApplianceDrawer,space,compareWashers,M,$,list,placedRoom,id,room,tone,notice,draw,refresh,inventory,focusPlacement,placeCollected,startBagPlacement,save,checkpoint,home,findSpace,select,drawerOpen,gestureActive}){
  const my=space==='my',params=new URLSearchParams(location.search);
  const friend=space==='example',menu=space==='menu',readOnly=friend||menu;
  const samplePreview=friend&&params.has('previewTemplate');
  const source=(friend&&!samplePreview)||params.get('source')==='example_room'?'example_room':'collection';
  const baseKey=k=>M.products[k]?.behaviorKey||k;
  const isTV=o=>o && ['tvset','standbyme'].includes(baseKey(o.k));
  const saved=()=>model.state.savedRoutines.find(r=>r.anchorId==='sofa'&&r.templateId==='movie-night');
  let editMode=false, panel='idle',target=null,seat=null,start=null,started=0,walking=false;
  let furniture=null,composerFurniture=null,movieFurniture=null;
  const isFurniture=o=>o&&M.products[o.k].c==='가구'&&!isAppliance(o.k);
  let playback=null,previousPanel='idle',bindings={},raf=0,lastFrame=-100,offer=null;
  let lampOn=false,poweredTV=null,sceneBeforeMovie=null;
  let sleepBed=null;
  let reaction=null,perchDescent=null;
  let productTapTime=-Infinity;
  let previewFurniture=[];
  let cleaningRuns=[];
  const approachMs=740,reactionCycleMs=2100;
  const sample=model.homeSource==='demo';
  const hasHome=()=>model.homeSource==='thinq'||(sample&&(model.state.myFixtureId==='sample-home-v1'||model.state.myFixtureId==='sample-light-v1'||!!model.state.cameraAppliances?.length));
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
  const nameOf=id=>liveTVs().find(d=>d.id===id)?.name||tvCatalog().find(d=>d.id===id)?.name||'이전 TV';
  const liveTVs=()=>model.candidates(tvAction);
  const screenFor=id=>list().find(o=>isTV(o)&&o.deviceId===id&&visible(o));
  const availableTVs=()=>liveTVs().filter(d=>screenFor(d.id));
  const available=id=>!!id&&availableTVs().some(d=>d.id===id);
  const needsRepair=()=>!!saved()&&!liveTVs().some(d=>d.id===saved().bindings['tv-on']);
  const isAppliance=k=>model.isCollectibleProduct(k)||M.products[k]?.cameraArt||k==='floor_lamp';
  const owned=k=>model.registeredAppliances().filter(d=>d.k===k);
  function allowed(k){
    if(M.products[k]?.c==='가전'&&!ProductCatalog.hasModel(k)&&!M.products[k].cameraArt)return false;
    if(k==='floor_lamp'&&!my)return true;
    if(friend||!isAppliance(k))return true;
    return my?owned(k).length>0:model.collected(k);
  }
  function visible(o){
    if(o.bundleId!=null)return false;
    if(M.products[o.k]?.c==='가전'&&!ProductCatalog.hasModel(o.k)&&!M.products[o.k].cameraArt)return false;
    if((space==='dream'||menu)&&room()==='C'&&o.exhibit)return true;
    if(!my||!isAppliance(o.k))return allowed(o.k);
    return owned(o.k).some(d=>d.id===o.deviceId)&&
      list().find(other=>other.k===o.k&&other.deviceId===o.deviceId)===o;
  }
  function freeUnit(k,unitId){
    return owned(k).find(d=>(!unitId||d.id===unitId)&&!placedRoom(d.id));
  }
  function unitSummary(units=model.registeredAppliances(),compact=false){
    const placed=units.filter(d=>placedRoom(d.id)).length;
    const remaining='배치 가능 '+(units.length-placed)+'대';
    return compact?remaining:'등록 '+units.length+'대 · 배치 '+placed+'대 · '+remaining;
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
  const groupFor=k=>Object.keys(groups).find(kind=>groups[kind].keys.includes(baseKey(k)));
  const combinationReasons=new Map([
    ['room-comfort','에어컨 냉방과 공기청정기 자동 청정을 함께 사용할 수 있어요.'],
    ['cleaning-time','로봇청소기로 바닥을 청소하는 동안 공기청정기를 함께 켤 수 있어요.']
  ]);
  const supportsAction=(device,a)=>model.customOptions(device).some(op=>op.actionId===a.actionId);
  function combinationSuggestions(devices){
    return templates.filter(t=>combinationReasons.has(t.id)&&t.actions.every(a=>devices.some(d=>supportsAction(d,a))));
  }
  const recipeFor=k=>templates.find(t=>t.actions.some(a=>a.kind===groupFor(k)));
  const tapKind=k=>k==='dryer'?'washer':k?.startsWith('fridge_')?'fridge':['vacuum','robot_vacuum','humidifier','dehumidifier'].includes(k)?k:null;
  const tapDescriptions={
    air:'고양이가 에어컨 바람을 맞으며 귀를 살짝 접어요.',
    purifier:'고양이가 공기청정기 앞에서 코를 들고 바람 냄새를 맡아요.',
    dehumidifier:'고양이가 제습기 옆에 앉아 표시등을 바라봐요.',
    humidifier:'고양이가 가습기 옆에 앉아 가습기를 바라봐요.',
    washer:'고양이가 세탁조 안에서 도는 양말을 눈으로 따라가요.',
    styler:'고양이가 김이 오르는 스타일러 앞에 몸을 말고 잠들어요.',
    fridge:'고양이가 냉장고 문을 올려다보며 간식을 기다려요.',
    vacuum:'청소기가 떨리면 고양이가 한 발 물러났다가 다시 들여다봐요.',
    robot_vacuum:'고양이가 움직이는 로봇청소기를 눈으로 따라가요.'
  };
  let recipe=null,recipeBindings={},recipeEffects={};
  function remember(t){
    try{model.rememberPreview(t.id,my&&source==='collection'?'my_room':source)}catch{notice('발견 기록을 저장할 수 없어요. 저장 공간을 확인해 주세요.')}
  }
  function productUse(k){
    k=baseKey(k);
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
    for(const [old,k] of Object.entries(model.demoModels)){
      const group=groupFor(k);if(!group)continue;
      const candidates=items.filter(o=>(o.k===k||o.k===old)&&typeof o.deviceId==='string'&&
        new RegExp('^my-'+group+'-[a-f0-9]+-[a-f0-9]+-[a-f0-9]+$').test(o.deviceId));
      const existing=candidates.find(o=>linked.has(o.deviceId))||candidates[0];
      if(existing)ids[k]=existing.deviceId;
    }
    if(Object.keys(ids).length)try{model.update(s=>s.sampleDeviceIds=ids)}catch(e){notice(e.message)}
  }
  function registeredReplacement(o){
    if(!my)return;
    const units=model.registeredAppliances();
    return (units.find(d=>d.id===o.deviceId)||
      (sample&&!o.deviceId&&units.find(d=>d.k===model.demoModels[o.k])))?.k;
  }
  function identifyDevices(items){
    if(!my||!sample||!hasHome())return;
    for(const o of items){
      if(!isAppliance(o.k)||o.deviceId)continue;
      const unit=freeUnit(o.k);
      if(unit)o.deviceId=unit.id;
    }
  }
  function planTV(d){
    const key=d.k||model.demoModels[d.id==='my-tv-1'?'tvset':'standbyme'];
    const location=placedRoom(d.id);
    if(location&&location!==room())return null;
    const existing=screenFor(d.id)||list().find(o=>o.k===key&&!o.deviceId);
    if(existing)return existing;
    const primary=d.id==='my-tv-1';
    const o={id:id(),deviceId:d.id,k:key,x:primary?1:65,y:primary?49:8,f:primary?1:0,e:0};
    return findSpace(o)?o:null;
  }
  function placeTV(o,deviceId){
    o.deviceId=deviceId;
    if(!list().includes(o))list().push(o);
  }
  function ensureTV(d){
    const o=planTV(d);if(o)placeTV(o,d.id);
  }
  function floorPoint(gx,gy){
    const {zones}=M.roomData(room());
    const level=zones.find(([x1,y1,x2,y2])=>gx>=x1&&gx<x2&&gy>=y1&&gy<y2)?.[4]||0;
    const [x,y]=M.project(room(),gx,gy,level);
    return {x,y,depth:gx+gy};
  }
  function spawn(){
    const home=floorPoint(28,43),robots=list().filter(o=>baseKey(o.k)==='robot_vacuum'&&visible(o));
    if(!robots.length||cleanerClearance([],robots)(home))return home;
    // A newly placed cleaner can cover the default idle spot before anything is tapped.
    const clear=cleanerClearance([]);
    let closest=home,best=Infinity;
    for(const [x,y] of standingTiles()){
      const distance=(x-28)**2+(y-43)**2;
      if(distance>=best)continue;
      const point=floorPoint(x,y);
      if(clear(point)){closest=point;best=distance}
    }
    return closest;
  }
  function sofaPoint(o){
    const {w,d}=M.dims(o),cx=o.x+w/2,cy=o.y+d/2;
    const [x,y]=M.project(room(),cx,cy,M.elevation(room(),o)+6.7);
    return {x,y,depth:cx+cy};
  }
  let standing=null;
  const perchDuration=850;
  function perchPosition(floor,perch,elapsed){
    const {step,seat:top}=perch;
    if(still()||elapsed>=perchDuration)return {...top,perchPose:'seated'};
    if(elapsed>=330&&elapsed<470)return {...step,perchPose:'step'};
    const first=elapsed<330;
    const from=first?floor:step,to=first?step:top;
    const t=Math.max(0,first?elapsed/330:(elapsed-470)/380);
    return {x:from.x+(to.x-from.x)*t,
      y:from.y+(to.y-from.y)*t-4*t*(1-t)*(first?10:13),
      depth:to.depth,perchPose:'jump'};
  }
  function position(now){
    const end=seat?sofaPoint(seat):(standing??=spawn());
    const t=Math.max(0,Math.min(1,(now-started)/approachMs));
    if(!walking||t>=1){
      walking=false;
      return reaction?.perch&&now>=reaction.arrives?perchPosition(end,reaction.perch,now-reaction.arrives):end;
    }
    const eased=t*t*(3-2*t);
    return {x:start.x+(end.x-start.x)*eased,y:start.y+(end.y-start.y)*eased-3*Math.sin(Math.PI*t),depth:start.depth+(end.depth-start.depth)*eased};
  }
  function animate(){
    if(!raf)raf=requestAnimationFrame(function tick(now){
      raf=0;
      if(now-lastFrame>=60){lastFrame=now;draw()}
      if(walking||perchDescent||((playback||reaction||poweredTV)&&!still()))animate();
    });
  }
  function nearbySofa(tv){
    const {w,d}=M.dims(tv);
    let nearest=null,best=27; // Maximum walking distance from the TV to a seat, in floor units.
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
  // Test the seated silhouette in screen pixels, including the small head movement and a gap.
  function cleanerClearance(runs,items=list()){
    const sprites=[];
    function include(item,original=item){
      sprites.push({original,flip:item.f,...M.place(room(),tone(),item)});
    }
    for(const item of items)if(visible(item)&&M.products[item.k].layer)include(item);
    for(const {item,path} of runs){
      for(let step=1;step<=path.length;step++){
        const moved={...item,x:item.x+step*path.dx,y:item.y+step*path.dy};
        if(M.products[item.k].hasDock)moved.robotPart='mobile';
        include(moved,item);
      }
    }
    return (point,ignore=null)=>{
      const px=Math.round(point.x),py=Math.round(point.y);
      for(const {original,flip,s,x,y} of sprites){
        if(original===ignore)continue;
        const left=Math.max(0,px-18-x),right=Math.min(s.w-1,px+18-x);
        const top=Math.max(0,py-29-y),bottom=Math.min(s.h-1,py+4-y);
        if(left>right||top>bottom)continue;
        for(let row=top;row<=bottom;row++)for(let col=left;col<=right;col++){
          if(s.pixels[(row*s.w+(flip?s.w-1-col:col))*4+3]>10)return false;
        }
      }
      return true;
    };
  }
  function* standingTiles(){
    const {W,D}=M.roomData(room());
    for(let x=2;x<=W-2;x+=2)for(let y=2;y<=D-2;y+=2){
      if(room()==='B'&&x+2>52&&y+2>48)continue;
      yield [x,y];
    }
  }
  function clearApproach(from,to,clear,ignore=null){
    if(still()||!from)return true;
    const dx=to.x-from.x,dy=to.y-from.y,steps=Math.ceil(Math.hypot(dx,dy)/3);
    let outside=clear(from,ignore);
    for(let i=1;i<steps;i++){
      const t=i/steps,eased=t*t*(3-2*t);
      const point={x:from.x+dx*eased,y:from.y+dy*eased-3*Math.sin(Math.PI*t)};
      if(clear(point,ignore))outside=true;
      else if(outside)return false;
    }
    return true;
  }
  function standingPoint(item,kind,patrol=null,clearForCat=null){
    const {w,d}=M.dims(item),{W,D}=M.roomData(room());
    // Let the cat observe the cleaner from beside its forward lane.
    const side=kind==='robot_vacuum'||kind==='cleaning';
    const [nx,ny]=M.frontStep((M.heading(item)+(side?1:0))%4);
    const cx=item.x+w/2,cy=item.y+d/2,gap=kind==='washer'?4:kind==='cleaning'?15:8;
    const frontX=cx+nx*(w/2+gap),frontY=cy+ny*(d/2+gap);
    const level=M.zone(room(),item);
    const watchFromSide=patrol||kind==='humidifier'||kind==='dehumidifier';
    const appliance=watchFromSide&&M.place(room(),tone(),item);
    const travelX=patrol?patrol.dx*patrol.length:0,travelY=patrol?patrol.dy*patrol.length:0;
    const screenTravelX=2*(travelX-travelY);
    const nearEdge=appliance?appliance.x+Math.min(0,screenTravelX):0;
    const farEdge=appliance?appliance.x+appliance.s.w+Math.max(0,screenTravelX):0;
    const watchY=appliance?appliance.y+appliance.s.h+(travelX+travelY)/2+3:0;
    if(!clearForCat){
      const robots=list().filter(o=>baseKey(o.k)==='robot_vacuum'&&visible(o));
      if(robots.length)clearForCat=cleanerClearance([],robots);
    }
    const obstacles=list().filter(o=>visible(o)&&M.products[o.k].layer&&!M.products[o.k].wall)
      .map(o=>({x:o.x,y:o.y,...M.dims(o),loc:kind&&M.place(room(),tone(),o),flipped:o.f}));
    let best=Infinity,point=null;
    for(const [x,y] of standingTiles()){
      if(x>=item.x-1&&x<=item.x+w+1&&y>=item.y-1&&y<=item.y+d+1)continue;
      const floor=floorPoint(x,y);
      let score;
      if(watchFromSide){
        // Score both sides of the whole patrol in screen space, so the silhouettes read side by side.
        if(x>=item.x+Math.min(0,travelX)-2&&x<=item.x+w+Math.max(0,travelX)+2&&
           y>=item.y+Math.min(0,travelY)-2&&y<=item.y+d+Math.max(0,travelY)+2)continue;
        const left=(floor.x-(nearEdge-19))**2,right=(floor.x-(farEdge+19))**2+24;
        score=Math.min(left,right)+2*(floor.y-watchY)**2;
        score+=12*Math.max(0,8-Math.min(x,y,W-x,D-y))**2;
        if(floor.y!==M.project(room(),x,y,level)[1])score+=2400;
      }else if(kind==='washer'){
        const across=(x-frontX)*ny-(y-frontY)*nx,along=(x-frontX)*nx+(y-frontY)*ny;
        score=(Math.abs(across)-6)**2+along**2;
      }else score=(x-frontX)**2+(y-frontY)**2;
      if(score>=best)continue;
      if(obstacles.some(o=>x>o.x-2&&x<o.x+o.w+2&&y>o.y-2&&y<o.y+o.d+2))continue;
      if(!watchFromSide&&(x-cx)*nx+(y-cy)*ny<0)score+=100;
      if(score>=best)continue;
      if(clearForCat&&(!clearForCat(floor)||!clearApproach(start,floor,clearForCat)))continue;
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
  function watch(tv,sofa=nearbySofa(tv)){
    const current=position(performance.now());
    if(target===tv&&seat===sofa&&(sofa||standing))return;
    start=current;target=tv;seat=sofa;standing=sofa?null:standingPoint(tv);
    const end=sofa?sofaPoint(sofa):standing;
    started=Math.max(performance.now(),perchDescent?.until||0);walking=!still()&&Math.hypot(end.x-current.x,end.y-current.y)>1;
    if(walking)animate();
  }
  function approachAppliance(item,kind){
    const now=performance.now();
    start=position(now);seat=null;target=item;
    const patrol=kind==='robot_vacuum'?robotPath(item,null):null;
    const clearance=patrol&&cleanerClearance([{item,path:patrol}]);
    standing=standingPoint(item,kind,patrol,clearance);started=Math.max(now,perchDescent?.until||0);
    walking=!still()&&Math.hypot(standing.x-start.x,standing.y-start.y)>1;
    reaction={itemId:item.id,kind,wall:baseKey(item.k)==='wall_ac',arrives:started+(walking?approachMs:0)};
    if(kind==='purifier'){
      const {x,y,s}=M.place(room(),tone(),item);
      if(s.perch){
        const anchor=([px,py])=>({x:x+(item.f?s.w-1-px:px),y:y+py,depth:item.x+item.y});
        reaction.perch={step:anchor(s.perch.step),seat:anchor(s.perch.seat)};
      }
    }
    if(patrol){
      reaction.path=robotPath(item);
      const loc=M.place(room(),tone(),item),{dx,dy,length}=reaction.path;
      reaction.facingLeft=loc.x+loc.s.w/2+(dx-dy)*length<standing.x;
    }
    if(!still())animate();
  }
  function robotPath(item,resting=standing,reserved=[]){
    const {w,d}=M.dims(item),level=M.zone(room(),item);
    const [dx,dy]=M.frontStep(M.heading(item));
    const blocks=list().filter(o=>o!==item&&visible(o)&&M.products[o.k].layer&&!M.products[o.k].wall);
    let length=0;
    for(let n=1;n<=M.robotTravel;n++){
      const x=item.x+dx*n,y=item.y+dy*n,probe={...item,x,y};
      M.clamp(room(),probe);
      if(probe.x!==x||probe.y!==y||M.robotCrossesStep(room(),item,n))break;
      if(blocks.some(o=>{
        const size=M.dims(o);
        return x<o.x+size.w&&x+w>o.x&&y<o.y+size.d&&y+d>o.y;
      }))break;
      if(reserved.some(b=>x<b.x+b.w&&x+w>b.x&&y<b.y+b.d&&y+d>b.y))break;
      const [cx,cy]=M.project(room(),x+w/2,y+d/2,level);
      if(resting&&Math.hypot(cx-resting.x,cy-resting.y)<13)break;
      length=n;
    }
    return {dx,dy,length};
  }
  function blockedRobotMessage(item){
    return M.robotCrossesStep(room(),item,1)
      ?'앞쪽 단차에 걸려요. 배치 편집에서 위치나 방향을 바꿔 주세요.'
      :'앞쪽에 빈 통로가 없어 제자리에서 표시등만 깜박여요.';
  }
  function stopReaction(){
    if(!reaction)return;
    const now=performance.now(),current=position(now);
    if(current.perchPose&&!still()&&!perchDescent){
      // Reverse only the part of the climb that the cat has actually completed.
      const elapsed=Math.min(perchDuration,Math.max(0,now-reaction.arrives));
      perchDescent={until:now+elapsed,itemId:reaction.itemId,perch:reaction.perch,floor:standing};
      animate();
    }
    if(!current.perchPose)standing=current;
    walking=false;reaction=null;
  }
  function frame(){
    if(editMode)return;
    const now=performance.now();
    if(perchDescent&&(still()||now>=perchDescent.until))perchDescent=null;
    const remaining=perchDescent?perchDescent.until-now:0;
    const cat=perchDescent?perchPosition(perchDescent.floor,perchDescent.perch,remaining):position(now);
    let pose=null;
    const active=cleaningRuns[0]||reaction;
    if(perchDescent){
      pose={kind:'purifier',itemId:perchDescent.itemId,perchPose:cat.perchPose};
    }else if(active&&!walking){
      const elapsed=Math.max(0,now-active.arrives);
      const progress=still() ? 0.7 : (elapsed%reactionCycleMs)/reactionCycleMs;
      const settle=still()?1:Math.min(1,elapsed/450);
      pose={kind:active.kind,itemId:active.itemId,wall:active.wall,progress,settle,perchPose:cat.perchPose};
    }
    const movie=playback&&(!playback.templateId||playback.templateId==='movie-night');
    const tv=movie?target:poweredTV;
    const movingUnits=new Map();
    if(pose?.kind==='robot_vacuum'&&!still()){
      for(const {item,path} of cleaningRuns.length?cleaningRuns:[{item:target,path:reaction.path}]){
        const step=Math.round(path.length*(1-Math.cos(2*Math.PI*pose.progress))/2);
        if(step){
          const body={...item,x:item.x+path.dx*step,y:item.y+path.dy*step};
          if(M.products[item.k].hasDock)body.robotPart='mobile';
          movingUnits.set(item.id,body);
        }
      }
    }
    const movingRobot=movingUnits.get(target?.id)||null;
    const tvLoc=target&&M.place(room(),tone(),movingRobot||target);
    const destination=walking&&(seat?sofaPoint(seat):standing);
    const dx=destination?destination.x-start.x:tvLoc?tvLoc.x+tvLoc.s.w/2-cat.x:0;
    const dy=destination?destination.y-start.y:tvLoc?tvLoc.y+tvLoc.s.h/3-cat.y:0;
    let facingLeft=dx<0;
    if(perchDescent){
      const next=remaining>470?perchDescent.perch.step:perchDescent.floor;
      facingLeft=next.x<cat.x;
    }
    if(pose?.kind==='robot_vacuum'&&!cleaningRuns.length){
      facingLeft=reaction.facingLeft;
      pose.watchingCleaner=true;
      // Sample the continuous patrol for the eyes and head while the cleaner is drawn on whole pixels.
      const path=reaction.path;
      const offset=still()?0:path.length*(1-Math.cos(2*Math.PI*pose.progress))/2;
      pose.gazeX=(facingLeft?-1:1)*(path.dx-path.dy)*offset/4;
      pose.gazeY=-(path.dx+path.dy)*offset/6;
    }else if(pose?.kind==='robot_vacuum'){
      const gx=movingRobot?movingRobot.x-target.x:0,gy=movingRobot?movingRobot.y-target.y:0;
      pose.gazeX=Math.max(-2,Math.min(2,(gx-gy)*(dx<0?-1:1)/3));
      pose.gazeY=Math.max(-1,Math.min(1,-(gx+gy)/5));
    }
    const mist=reaction?.kind==='humidifier'?{itemId:reaction.itemId,
      phase:still() ? .42 : ((now-started)%2800)/2800}:null;
    return {cat,reaction:pose,mist,movingRobot,movingUnits,sleepBed:!walking&&sleepBed?sleepBed.id:null,
      tucked:still()?1:Math.max(0,Math.min(1,(now-started-approachMs)/450)),focusedProduct:panel==='product'?target?.id:null,
      tapGlow:still()?0:Math.max(0,1-(now-productTapTime)/200),depth:cat.depth,seat:!perchDescent&&!walking&&seat?seat.id:null,
      time:still()?0:now,walking:!perchDescent&&walking,facingAway:dy<0,facingLeft,
      facingSide:walking?Math.abs(dx)>Math.abs(dy)*.65:Math.abs(dx)>12,tv:tv?.id,
      appliances:recipeEffects,playing:!!movie||!!poweredTV,
      dim:!!playback?.bindings['light-dim']||(playback?.custom&&Object.values(recipeEffects).some(op=>op==='light-off'||op==='light-dim')),
      lampLit:lampOn||!!playback?.bindings['light-dim'],
      curtain:!!movie&&!my};
  }
  function clearScene(){
    sleepBed=perchDescent=null;
    furniture=composerFurniture=movieFurniture=null;
    cleaningRuns=[];
    if(raf)cancelAnimationFrame(raf);raf=0;walking=false;standing=start=seat=target=playback=reaction=null;
    poweredTV=null;
    offer?.disconnect();offer=null;offeredTarget=null;skipped=false;sceneBeforeMovie=null;
  }
  function reset(){
    if(panel==='routineSetup')clearConnectLink();
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
    if(next!=='applianceConfig'&&next!=='product')stopReaction();
    if(panel==='routineSetup'&&next!=='routineSetup')clearConnectLink();
    panel=next;render();draw();
    if(poweredTV&&!still())animate();
  }
  function toggleEdit(){
    if(readOnly||gestureActive())return;
    if(panel==='routineSetup')clearConnectLink();
    clearScene();panel='idle';editMode=!editMode;select();drawerOpen(false);
    if(my&&editMode)showApplianceDrawer();
    render();refresh();home();
  }
  function prepare(){
    if(!sample)return;
    if(model.state.myFixtureId!=='sample-home-v1')model.update(s=>{
      s.registeredTvIds=tvCatalog().map(d=>d.id);
      s.myFixtureId='sample-home-v1';s.myLayout['tv-slot']='my-tv-1';s.myLayout['light-slot']='my-light-1';
    });
    const starter=[[model.demoModels.tvset,1,49,1],['floor_lamp',21,49,0],['sofa',34,48,1]];
    for(const [k,x,y,f] of starter){
      if(isAppliance(k)&&(!owned(k).some(d=>!d.camera)||!canAdd(k)))continue;
      if(list().some(o=>k===model.demoModels.tvset?isTV(o):o.k===k))continue;
      const o={id:id(),k,x,y,f,e:0};if(k==='sofa')o.turn=1;
      if(findSpace(o)){if(isAppliance(k))bindUnit(o);list().push(o)}
    }
    identifyDevices(list());for(const d of liveTVs())if(!d.camera)ensureTV(d);
    save();inventory();refresh();
    if(panel==='routineSetup')openMyRoutine(recipe||model.movieTemplate);
    else setPanel('idle');
  }
  function prepareLightHome(){
    if(!sample||hasHome())return;
    model.update(s=>{
      s.myFixtureId='sample-light-v1';s.registeredTvIds=[];s.myLayout['light-slot']='my-light-1';
    });
    inventory();refresh();setPanel('idle');
  }
  function connect(attachTo=null){
    movieFurniture=attachTo;
    bindings={...(saved()?.bindings||{})};setPanel('connect');
  }
  function clearConnectLink(){
    const entry=new URL(location.href);
    if(!entry.searchParams.has('connect')&&!entry.searchParams.has('inventoryConnect'))return;
    entry.searchParams.delete('inventoryConnect');
    entry.searchParams.delete('connect');entry.searchParams.delete('template');
    history.replaceState(history.state,'',entry);
  }
  function startMovie(from=panel){
    const editing=from==='connect'||from==='repair';
    if(!editing)movieFurniture=null;
    if(my&&!editing&&from!=='product'&&needsRepair()){beginRepair();return}
    const chosen={...(editing?bindings:saved()?.bindings||{})};
    if(my&&!editing&&(from==='product'||!saved())){
      const options=availableTVs();
      const choice=from==='product'?target?.deviceId:(options.length===1?options[0].id:null);
      if(!available(choice)){connect();return}
      chosen['tv-on']=choice;if(!saved())chosen['light-dim']=model.state.myLayout['light-slot'];
    }
    const device=my&&liveTVs().find(d=>d.id===chosen['tv-on']);
    if(my&&device&&!screenFor(device.id)){
      if(!editing)connect(from==='furniture'?furniture:null);
      notice(placedRoom(device.id)?placedRoom(device.id)+'룸에 배치된 TV예요.':'TV를 먼저 놓아 주세요.');return;
    }
    if(friend&&from==='friendMovie'){
      previewFurniture=[{id:id(),k:model.demoModels.tvset,x:1,y:49,f:1,e:0},{id:id(),k:'floor_lamp',x:21,y:49,f:0,e:0}];
      list().push(...previewFurniture);refresh();
    }
    const tv=my?screenFor(chosen['tv-on']):
      (isTV(target)&&visible(target)?target:list().find(o=>isTV(o)&&visible(o)));
    if(!tv){notice('배치 편집에서 TV를 놓아 주세요.');return}
    // Preserve the saved optional actions during TV repair, even in a room without a lamp.
    const repaired=from==='repair'?{...saved(),bindings:{...saved().bindings,'tv-on':chosen['tv-on']}}:null;
    if(!list().some(o=>o.k==='floor_lamp'&&o.deviceId===chosen['light-dim']&&visible(o)))delete chosen['light-dim'];
    const result=my?model.routine(chosen):{bindings:{'tv-on':true,'light-dim':hasLamp(),'curtain-close':true}};
    if(repaired){
      persistRoutine(repaired);from='idle';log('routine_reconnected',savedSource());
    }
    previousPanel=from;
    if(!samplePreview)history.pushState({...history.state,dotMovie:true},'');
    const replay=my&&['idle','furniture'].includes(from);
    const origin=replay?savedSource():source;
    if(!my&&from==='product')log('routine_opened');
    stopReaction();
    sceneBeforeMovie={target,seat,standing,start,walking,elapsed:performance.now()-started};
    watch(tv,from==='furniture'&&furniture?.k==='sofa'?furniture:nearbySofa(tv));
    playback=result;panel='playing';render();draw();if(!still())animate();
    remember(model.movieTemplate);
    if(replay){if(from==='idle')log('routine_reopened',origin);log('routine_replayed',origin)}
    log('preview_opened',origin);
  }
  function leaveMovie(destination=previousPanel){
    const draft=destination==='composer'&&playback?.custom?playback:null;
    if(destination==='connect'&&playback)bindings={...playback.bindings};
    playback=null;skipped=false;recipeEffects={};cleaningRuns=[];sleepBed=null;
    if(previewFurniture.length){
      for(const item of previewFurniture){
        const index=list().indexOf(item);if(index>=0)list().splice(index,1);
      }
      previewFurniture=[];refresh();
    }
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
    panel=backToBag||draft||destination==='recommendation'?'idle':destination;render();draw();
    if((poweredTV||reaction)&&!still())animate();
    if(backToBag)openBag();
    if(draft)openComposer(draft,composerFurniture);
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
  let revealSavedRoutine=null;
  function persistRoutine(record){
    model.saveRoutines([record]);
    revealSavedRoutine=record.templateId;
  }
  let pendingFurnitureLink=null;
  function saveLabel(item){
    if(!item||!list().includes(item))return '내 루틴에 저장';
    const name=item.k==='bed'?'침대':item.k==='sofa'?'소파':'가구';
    return '저장하고 이 '+name+'에 연결';
  }
  function finishRoutineSave(record,item){
    pendingFurnitureLink=null;
    if(item&&list().includes(item)){
      furniture=item;
      if(!linkSavedRoutine(item,record)){
        pendingFurnitureLink={item,recordId:record.templateId};
        closeMovie('linkRetry');return;
      }
      closeMovie('furniture');
    }else closeMovie('idle');
    notice(routineName(record)+' 루틴을 저장했어요.');
  }
  function renderLinkRetry(){
    const pending=pendingFurnitureLink;
    const record=model.state.savedRoutines.find(r=>r.templateId===pending?.recordId);
    show('내 루틴에 저장됨',record?routineName(record)+' 루틴을 저장했어요. 가구 연결을 다시 시도할 수 있어요.':'내 루틴에서 저장 상태를 확인해 주세요.');
    if(record&&list().includes(pending.item))action('가구 연결 재시도',()=>{
      if(!list().includes(pending.item)||!linkSavedRoutine(pending.item,record))return;
      furniture=pending.item;pendingFurnitureLink=null;setPanel('furniture');
      notice('저장된 루틴을 가구에 연결했어요.');
    },true);
    action('내 루틴으로',()=>{pendingFurnitureLink=null;setPanel('idle')});
  }
  function storeRoutine(){
    if(!playback)return;
    const verified=model.routine(playback.bindings);
    if(saved()&&!confirm('내 루틴의 영화 보기 연결을 바꿀까요?'))return;
    persistRoutine(verified);
    const item=previousPanel==='connect'?movieFurniture:null;
    log('routine_saved');
    finishRoutineSave(verified,item);
  }
  function tap(o){
    if(playback||menu)return;
    productTapTime=performance.now();
    if(panel==='product'&&reaction&&reaction.itemId===o?.id)return;
    stopReaction();
    poweredTV=isTV(o)?o:null;
    const kind=tapKind(baseKey(o?.k))||groupFor(o?.k)||(o?.k==='floor_lamp'?'lamp':null);
    if(kind){
      approachAppliance(o,kind);
      setPanel('product');
      return;
    }
    if(isTV(o)){
      if(my&&!hasHome()){setPanel('setup');return}
      watch(o);setPanel('product');return;
    }
    if(!friend||o&&M.products[o.k].catalogFamily){
      standing=position(performance.now());walking=false;
      seat=null;target=o;
    }
    if(o&&M.products[o.k].catalogFamily){setPanel('product');return}
    if(friend){
      if(o?.k==='sofa'){
        if(panel!=='friendMovie')log('routine_opened');
        setPanel('friendMovie');
      }else setPanel('idle');
      return;
    }
    target=null;
    if(my&&isFurniture(o)){
      furniture=o;
      if(!hasHome()){setPanel('setup');return}
      if(o.routineIds?.includes('movie-night')&&saved())log('routine_reopened',savedSource());
      setPanel('furniture');return;
    }
    furniture=null;setPanel('idle');
  }
  function beginRepair(){
    bindings={...saved().bindings};delete bindings['tv-on'];setPanel('repair');
  }
  function placeForMovie(device,step){
    const destination=panel,anchor=movieFurniture;
    startBagPlacement(device,()=>{if(!editMode)toggleEdit()},committed=>{
      if(editMode)toggleEdit();
      movieFurniture=anchor;
      if(committed)bindings[step]=device.id;
      setPanel(destination);
    });
  }
  function tvPicker(label){
    const field=document.createElement('label'),picker=document.createElement('select');
    field.className='tv-picker';field.append(label,picker);
    picker.add(new Option('TV 선택',''));
    for(const d of liveTVs()){
      const r=placedRoom(d.id);
      const option=new Option(d.name+(r&&r!==room()?' · '+r+'룸':screenFor(d.id)?'':' · 방에 놓기'),d.id);
      option.disabled=!!r&&r!==room();picker.add(option);
    }
    picker.value=bindings['tv-on']||'';
    picker.onchange=()=>{
      bindings['tv-on']=picker.value;render();$('lifeActions').querySelector('select')?.focus({preventScroll:true});
    };
    $('lifeActions').append(field);
    const chosen=liveTVs().find(d=>d.id===picker.value);
    if(chosen&&canAdd(chosen.k,chosen.id))action(chosen.name+' 방에 놓기',()=>placeForMovie(chosen,'tv-on'));
  }
  function applianceOptions(a){
    if(my&&!hasHome())return [];
    const units=my?model.registeredAppliances().filter(d=>supportsAction(d,a)):null;
    return list().filter(o=>groupFor(o.k)===a.kind&&visible(o)&&(space!=='dream'||!o.exhibit))
      .flatMap(item=>{
        const unit=units?.find(d=>d.id===item.deviceId&&d.k===item.k);
        if(my&&!unit)return [];
        return [{item,id:my?unit.id:String(item.id),name:ProductCatalog.unitTitle(unit,M.products[item.k])}];
      });
  }
  function openRecipe(t,item=null,recommended=false){
    if(my&&!hasHome()){requestRoutineSetup(t);return}
    recipe=t;
    recipeBindings={...(my?savedRecipe(t)?.bindings:{})};
    for(const a of t.actions){
      const options=applianceOptions(a);
      const tapped=options.find(d=>d.item===item);
      if(tapped)recipeBindings[a.actionId]=tapped.id;
      else if(!my&&options.length)recipeBindings[a.actionId]=options[0].id;
      else if(!options.some(d=>d.id===recipeBindings[a.actionId])){
        delete recipeBindings[a.actionId];
        if(options.length===1&&(a.required||(recommended&&!savedRecipe(t)&&!unplacedOptions(a).length)))
          recipeBindings[a.actionId]=options[0].id;
      }
    }
    if(item&&!my)model.logObservation('routine_opened',space,source,t.id);
    setPanel('applianceConfig');
  }
  function unplacedOptions(a){
    return model.registeredAppliances().filter(d=>supportsAction(d,a)&&canAdd(d.k,d.id));
  }
  function addDemoAppliance(a,unit=unplacedOptions(a)[0]){
    if(!my||!unit)throw Error('연결할 등록 기기가 없어요.');
    const k=unit.k;
    const o={id:id(),k,x:Math.round(M.roomData(room()).W/2),y:18,f:0,e:0};
    if(!findSpace(o))throw Error('이 방에 기기를 배치할 빈자리가 없어요.');
    bindUnit(o,unit.id);list().push(o);
    if(!save()){list().pop();throw Error('가전 배치를 저장할 수 없어요. 저장 공간을 확인해 주세요.')}
    refresh();
    return o.deviceId;
  }
  function placeAppliance(a,unit){
    recipeBindings[a.actionId]=addDemoAppliance(a,unit);setPanel('applianceConfig');
  }
  function pickAppliance(a){
    const options=applianceOptions(a);
    const label=groups[a.kind].label;
    const unplaced=unplacedOptions(a);
    for(const unit of unplaced){
      const name=options.length+unplaced.length===1?(sample?'체험용 ':'등록 ')+label:ProductCatalog.unitTitle(unit,M.products[unit.k]);
      action(name+' 배치',()=>placeAppliance(a,unit));
    }
    if(!options.length){
      if(!unplaced.length)$('lifeDetail').textContent+=' · '+label+' 연결할 기기 없음';
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
    target=robots[0];start=current;started=now;
    const reserved=[];
    cleaningRuns=robots.map(item=>{
      const path=robotPath(item,null,reserved),{w,d}=M.dims(item);
      const dx=path.length*path.dx,dy=path.length*path.dy;
      reserved.push({x:item.x+Math.min(0,dx),y:item.y+Math.min(0,dy),w:w+Math.abs(dx),d:d+Math.abs(dy)});
      return {item,itemId:item.id,path,kind:'robot_vacuum'};
    });
    const clearance=cleanerClearance(cleaningRuns);
    seat=nearbySofa(target);
    if(seat){
      const cushion=sofaPoint(seat);
      if(!clearance(cushion,seat)||!clearApproach(start,cushion,clearance,seat))seat=null;
    }
    standing=seat?null:standingPoint(target,'cleaning',cleaningRuns[0].path,clearance);
    const end=seat?sofaPoint(seat):standing;
    walking=!still()&&Math.hypot(end.x-current.x,end.y-current.y)>1;
    for(const run of cleaningRuns)run.arrives=now+(walking?approachMs:0);
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
    const replay=my&&from==='idle';
    const origin=replay?model.savedObservationSource(source,recipe.id):source;
    if(replay)model.logObservation('routine_replayed',space,origin,recipe.id);
    model.logObservation('preview_opened',space,origin,recipe.id);
  }
  function runSavedRecipe(t,from='idle'){
    recipe=t;recipeBindings={...savedRecipe(t).bindings};
    if(!recipeReady()){openRecipe(t);notice('필수 기기를 다시 연결해 주세요.');return}
    playRecipe(from);
  }
  const kindName=kind=>groups[kind]?.label||({tv:'TV',light:'조명',curtain:'커튼'})[kind]||'기기';
  function supportsSavedStep(unit,step){
    return model.customOptions(unit).some(op=>op.actionId===(step.operation||step.actionId));
  }
  // Custom actions can run without a sprite. Built-in routines need their required unit in this room.
  function shelfState(record,devices){
    const summary=[];
    const steps=record.custom?record.actions:batchTemplates.find(t=>t.id===record.templateId).actions;
    for(const step of steps){
      const deviceId=record.bindings[step.actionId];
      const unit=devices.find(d=>d.id===deviceId&&supportsSavedStep(d,step));
      if(!unit){
        if(step.required)return {next:'repair',step,detail:kindName(step.kind)+' 다시 연결'};
        continue;
      }
      const name=ProductCatalog.unitTitle(unit,M.products[unit.k]);
      if(!record.custom){
        const location=placedRoom(unit.id);
        if(location!==room()){
          if(!step.required)continue;
          if(location)return {next:'visit',unit,location,detail:location+'룸에서 '+name+' 보기'};
          return {next:'place',unit,detail:name+' 다시 놓기'};
        }
      }
      const setting=step.label||(step.kind==='light'?'밝기 '+step.value+'%':'켜기');
      summary.push(name+' '+setting);
    }
    return {next:'play',detail:summary.join(' · ')};
  }
  function useShelfRoutine(record,status){
    if(status.next==='place'){
      startBagPlacement(status.unit,toggleEdit,()=>{
        if(editMode)toggleEdit();
        setPanel('idle');
      });
      return;
    }
    if(status.next==='visit'){
      focusPlacement(status.location,o=>o.deviceId===status.unit.id);
      setPanel('idle');return;
    }
    const movie=record.templateId===model.movieTemplate.id;
    if(status.next==='repair'){
      if(movie)beginRepair();
      else {repairingRecord=record;setPanel('repairStep')}
      return;
    }
    if(movie)startMovie('idle');
    else if(record.custom)runCustom(record,'idle');
    else runSavedRecipe(templates.find(t=>t.id===record.templateId));
  }
  let repairingRecord=null;
  function renderStepRepair(){
    const record=repairingRecord,devices=model.registeredAppliances();
    const status=shelfState(record,devices);
    if(status.next!=='repair'){setPanel('idle');return}
    const step=status.step;
    const choices=devices.filter(d=>supportsSavedStep(d,step)&&
      (!record.custom||!Object.values(record.bindings).includes(d.id)||record.bindings[step.actionId]===d.id));
    show(routineName(record),choices.length?status.detail+' · '+(step.label||'동작'):kindName(step.kind)+' · 연결할 기기가 없어요.');
    if(choices.length){
      const field=document.createElement('label'),pick=document.createElement('select');
      field.append('대체 '+kindName(step.kind),pick);pick.add(new Option('기기 선택',''));
      for(const unit of choices)pick.add(new Option(ProductCatalog.unitTitle(unit,M.products[unit.k]),unit.id));
      $('lifeActions').append(field);
      const confirm=action('연결 변경',()=>{
        const updated={...record,bindings:{...record.bindings,[step.actionId]:pick.value}};
        persistRoutine(updated);setPanel('idle');
      },true);
      confirm.disabled=true;pick.onchange=()=>{confirm.disabled=!pick.value};
    }
    if(record.custom)action('동작 수정',()=>{setPanel('idle');openComposer(record)});
    action('취소',()=>setPanel('idle'));
  }
  function shelfOffers(devices,records){
    const offers=combinationSuggestions(devices).filter(t=>!savedRecipe(t)).map(t=>({
      template:t,label:t.name+' 추천',reason:combinationReasons.get(t.id),open:()=>openRecipe(t,null,true)
    }));
    const unit=devices.length===1&&devices[0],rule=unit&&model.singleDeviceSuggestion(unit);
    if(rule&&!records.some(r=>r.custom&&r.actions.length===1&&r.actions[0].operation===rule.operation&&
      r.bindings[r.actions[0].actionId]===unit.id)){
      offers.push({label:rule.name+' 미리보기',reason:rule.reason,open:()=>previewHomeSuggestion(rule,unit)});
    }
    return offers;
  }
  function openShelfAdd(offers){
    const dialog=$('shelfAdd'),choices=$('shelfChoices');
    choices.replaceChildren();
    function choice(label,open,reason,host=choices){
      const button=action(label,()=>{dialog.close();open()},false,host);
      if(reason){
        button.setAttribute('aria-label',label);
        const detail=document.createElement('small');detail.textContent=reason;button.append(detail);
      }
    }
    if(offers.length){
      const group=document.createElement('fieldset'),title=document.createElement('legend');
      title.textContent='추천에서 고르기';group.append(title);choices.append(group);
      for(const offer of offers)choice(offer.label,offer.open,offer.reason,group);
      const recommended=offers.flatMap(offer=>offer.template?[offer.template.id]:[]);
      if(recommended.length>1)choice('추천 '+recommended.length+'개 함께 설정',()=>openBatch(recommended),null,group);
    }
    if(!saved()&&liveTVs().length)choice('영화 보기 연결',connect);
    choice('여러 루틴 설정',openBatch);
    choice('직접 만들기',()=>openComposer());
    dialog.showModal();
  }
  const openConditions=conditions?.conditionEditor({model,render,notice,run:record=>useShelfRoutine(record,shelfState(record,model.registeredAppliances()))});
  function renderRoutineShelf(running,scrollTop){
    const records=model.state.savedRoutines,devices=model.registeredAppliances();
    const offers=shelfOffers(devices,records),host=$('lifeActions');
    show('내 루틴 '+records.length);
    action('＋ 추가',()=>openShelfAdd(offers),false,$('routineTools')).disabled=running;
    if(!records.length){
      if(offers.length)action('내 가전으로 가능한 루틴 '+offers.length+'개 보기',()=>openShelfAdd(offers));
      else if(devices.length)show('내 루틴 0','＋ 추가에서 첫 루틴을 만들어 보세요.');
      else action('등록 가전 열기',openLibrary);
      return;
    }
    for(const record of records){
      const active=running&&record.templateId===playback.templateId;
      const state=shelfState(record,devices),name=routineName(record);
      const row=document.createElement('div');row.className='shelf-row';
      row.dataset.routineId=record.templateId;host.append(row);
      let label=name;
      if(record.templateId===model.movieTemplate.id&&state.next!=='play')label=state.detail;
      if(active)label='재생 종료';
      const main=action(name+(active?' · 종료':''),active?()=>closeMovie():()=>useShelfRoutine(record,state),false,row);
      main.className='routine-card';main.setAttribute('aria-label',label);
      main.disabled=running&&!active;
      const detail=active?$('lifeDetail'):document.createElement('small');
      detail.id=active?'lifeDetail':'shelf-'+record.templateId;
      detail.textContent=active?playingSummary(record):state.detail;
      main.setAttribute('aria-describedby',detail.id);main.append(detail);
      if(active)main.classList.add('playing');
      if(record.condition){
        const summary=document.createElement('small');
        summary.textContent=conditions.describeRule(record.condition);main.append(summary);
      }
      action('조건 설정',()=>openConditions(record,name),false,row).disabled=running;
      if(record.templateId===model.movieTemplate.id){
        action('연결 기기 변경',()=>connect(),false,row).disabled=running;
      }else if(record.custom){
        action('동작 수정',()=>openComposer(record),false,row).disabled=running;
      }
    }
    host.scrollTop=scrollTop;
    if(!running&&revealSavedRoutine){
      const row=Array.from(host.children).find(el=>el.dataset.routineId===revealSavedRoutine);
      row?.scrollIntoView({block:'nearest'});
      revealSavedRoutine=null;
    }
  }
  function playingSummary(record){
    if(record.custom)return customSummary(playback);
    if(record.templateId!==model.movieTemplate.id)return recipeSummary();
    return nameOf(playback.bindings['tv-on'])+' 재생 중 · '+(playback.bindings['light-dim']?'조명 30%':'조명 제외')+' · 실제 가전은 작동하지 않아요';
  }
  function customSummary(record){
    const devices=model.registeredAppliances();
    const results=record.actions.map(a=>{
      const d=devices.find(d=>d.id===record.bindings[a.actionId]);
      const placed=list().some(o=>o.deviceId===d.id&&visible(o));
      const light=placed&&a.kind==='light'?' ('+(lampOn?'100%':'0%')+' → '+a.value+'%)':'';
      return ProductCatalog.unitTitle(d,M.products[d.k])+' '+a.label+light+(placed?'':' (이 방에 미배치)');
    });
    return results.join(' · ')+' · 실제 가전은 작동하지 않아요'+(record.omitted?.length?' · 제외된 동작 '+record.omitted.join(', '):'');
  }
  function customSteps(record){
    return record.actions.map(a=>({deviceId:record.bindings[a.actionId],operation:a.operation}));
  }
  function previewHomeSuggestion(rule,device){
    const draft=model.customRoutine(rule.name,[{deviceId:device.id,operation:rule.operation}]);
    playCustom(draft,'recommendation');
  }
  function showDreamSuggestion(){
    const placed=list().filter(o=>!o.exhibit&&visible(o)&&isAppliance(o.k));
    const keys=new Set(model.state.collection.filter(model.isCollectibleProduct));
    for(const o of placed)keys.add(o.k);
    const devices=Array.from(keys,k=>({k}));
    const suggestions=combinationSuggestions(devices);
    if(suggestions.length){
      const pending=new Map();
      show('드림룸 추천',suggestions.map(t=>combinationReasons.get(t.id)).join(' '));
      for(const t of suggestions){
        const missing=t.actions.find(a=>!placed.some(o=>supportsAction(o,a)));
        if(missing){
          pending.set(missing.kind,devices.find(d=>supportsAction(d,missing)).k);
        }else action(t.name+' 미리보기',()=>{openRecipe(t);playRecipe('idle')},true);
      }
      for(const [kind,k] of pending){
        action(groups[kind].label+' 배치',()=>{toggleEdit();placeCollected(k)},true);
      }
      return true;
    }
    if(keys.size!==1)return false;
    const [k]=keys,rule=model.singleDeviceSuggestion({k});
    if(!rule)return false;
    const units=placed.filter(o=>o.k===k);
    show('드림룸 추천',units.length?rule.reason:rule.reason+' 먼저 이 방에 놓아 보세요.');
    if(!units.length){
      action('방에 놓기',()=>{toggleEdit();placeCollected(k)},true);return true;
    }
    action(rule.name+' 미리보기',()=>{
      const step=model.customOptions({k}).find(a=>a.actionId===rule.operation);
      history.pushState({...history.state,dotMovie:true},'');previousPanel='idle';
      playback={templateId:'dream-'+rule.operation,name:rule.name,operation:rule.operation,custom:true,bindings:{}};
      recipeEffects=Object.fromEntries(units.map(o=>[o.id,groups[step.kind]?step.kind:rule.operation]));
      setPanel('dreamSuggestion');if(!still())animate();
    },true);return true;
  }
  function customReady(record,devices=model.registeredAppliances()){
    return customSteps(record).every(s=>devices.some(d=>d.id===s.deviceId&&model.customOptions(d).some(a=>a.actionId===s.operation)));
  }
  function routineName(record,records=model.state.savedRoutines){
    if(record.custom){
      const matches=records.filter(r=>r.custom&&r.name===record.name);
      const index=matches.findIndex(r=>r.templateId===record.templateId);
      if(matches.length>1&&index>=0)return record.name+' ('+(index+1)+')';
    }
    return record.name||batchTemplates.find(t=>t.id===record.templateId)?.name||record.templateId;
  }
  function runCustom(record,from,attachTo=null){
    if(customReady(record))playCustom(record,from);
    else openComposer(record,attachTo);
  }
  function saveFurnitureLinks(item,ids){
    const old=item.routineIds,before=JSON.stringify(list());item.routineIds=ids;
    if(save({retryable:true})){
      if(before!==JSON.stringify(list()))checkpoint(before);
      return true;
    }
    if(old===undefined)delete item.routineIds;else item.routineIds=old;
    notice('가구 연결을 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.');
    return false;
  }
  function linkSavedRoutine(item,record){
    return saveFurnitureLinks(item,[...new Set([...(item.routineIds||[]),record.templateId])]);
  }
  function configureFurniture(item){
    const dialog=$('furnitureLinks'),rows=$('furnitureChoices');
    $('furnitureLinksTitle').textContent=M.products[item.k].n+' · 루틴 연결';
    rows.replaceChildren();
    for(const record of model.state.savedRoutines){
      const label=document.createElement('label'),box=document.createElement('input');
      label.className='batch-choice';box.type='checkbox';box.value=record.templateId;
      box.checked=item.routineIds?.includes(record.templateId)||false;
      label.append(box,routineName(record));rows.append(label);
    }
    $('applyFurnitureLinks').onclick=()=>{
      const ids=Array.from(rows.querySelectorAll('input:checked'),b=>b.value);
      if(!saveFurnitureLinks(item,ids))return;
      dialog.close();setPanel('furniture');
    };
    dialog.showModal();
  }
  function renderFurniture(){
    const records=model.state.savedRoutines;
    const linked=records.filter(r=>furniture.routineIds?.includes(r.templateId));
    const movie=linked.find(r=>r.templateId===model.movieTemplate.id);
    const detail=movie?nameOf(movie.bindings['tv-on'])+' · '+(movie.bindings['light-dim']?'조명 30%':'조명 제외')+' · 커튼 제외':
      linked.length?'실행할 루틴을 선택하세요.':'이 가구에 연결된 루틴이 없어요.';
    show(M.products[furniture.k].n,detail);
    for(const record of linked){
      action(routineName(record),()=>{
        if(record.custom){
          runCustom(record,'furniture',furniture);
        }else if(record.templateId===model.movieTemplate.id)startMovie('furniture');
        else runSavedRecipe(templates.find(t=>t.id===record.templateId),'furniture');
      },true);
    }
    if(records.length)action('루틴 연결 설정',()=>configureFurniture(furniture));
    if(furniture.k==='sofa'&&!saved())action('영화 보기 설정',()=>connect(furniture));
    if(furniture.k==='bed'&&!linked.some(r=>r.scene==='bedtime'||r.name==='취침 모드'))
      action('취침 모드 만들기',()=>openComposer(null,furniture));
    else action('새 루틴 만들기',()=>openComposer(null,furniture));
    action('닫기',()=>tap(null));
  }
  let friendCopy=null;
  async function loadFriendCopy(id){
    setPanel('friendLoading');
    try{
      const res=await fetch('/api/members/imports',{cache:'no-store'});
      if(!res.ok)throw Error('로그인 후 가져온 루틴을 열어 주세요.');
      friendCopy=(await res.json()).imports.find(copy=>String(copy.id)===id);
      if(!friendCopy)throw Error('이 계정에 보관된 루틴이 없어요.');
      const existing=model.state.savedRoutines.find(r=>r.templateId==='friend-import-'+id);
      if(existing)friendCopy.prior=customSteps(existing);
      const url=new URL(location.href);url.searchParams.delete('friendImport');history.replaceState(history.state,'',url);
      setPanel('friendMatch');
    }catch(error){setPanel('idle');notice(error.message)}
  }
  function renderFriendMatch(){
    const devices=model.registeredAppliances(),rows=[];
    show(friendCopy.name,'내 기기로 실행할 동작을 선택하세요.');
    for(const step of friendCopy.steps){
      const options=devices.filter(d=>model.customOptions(d).some(op=>op.actionId===step.operation));
      const field=document.createElement('label'),pick=document.createElement('select');
      field.append(step.label+(step.required?' · 필수':' · 선택'),pick);
      pick.add(new Option(options.length?(step.required?'기기 선택':'제외'):'연결할 기기 없음',''));
      for(const unit of options)pick.add(new Option(ProductCatalog.unitTitle(unit,M.products[unit.k]),unit.id));
      const previous=friendCopy.prior?.find(x=>x.operation===step.operation&&options.some(d=>d.id===x.deviceId)&&
        !rows.some(row=>row.pick.value===x.deviceId));
      if(previous)pick.value=previous.deviceId;
      else if(options.length===1&&!rows.some(row=>row.pick.value===options[0].id))pick.value=options[0].id;
      pick.disabled=!options.length;rows.push({pick,step});$('lifeActions').append(field);
    }
    const preview=action('미리보기',()=>{
      const selected=rows.filter(row=>row.pick.value).map(({pick,step})=>({deviceId:pick.value,operation:step.operation}));
      const record=model.customRoutine(friendCopy.name,selected,'friend-import-'+friendCopy.id);
      record.omitted=rows.filter(row=>!row.pick.value).map(row=>row.step.label);
      playCustom(record,'friendMatch');
    },true);
    const update=()=>{
      const ids=rows.map(r=>r.pick.value).filter(Boolean);
      const missing=rows.some(r=>r.step.required&&!r.pick.value);
      const duplicate=ids.length!==new Set(ids).size;
      preview.disabled=missing||!ids.length||duplicate;
      $('lifeDetail').textContent=missing?'필수 기기를 연결하면 실행할 수 있어요. 루틴은 계정에 보관돼요.':
        duplicate?'각 동작에 서로 다른 기기를 선택하세요.':'선택한 내 기기로 미리 볼 수 있어요.';
    };
    for(const {pick} of rows)pick.onchange=update;
    update();action('닫기',()=>setPanel('idle'));
  }
  function openComposer(record=null,attachTo=null){
    composerFurniture=attachTo;
    const dialog=$('composer'),rows=$('customDevices'),name=$('customName'),submit=$('customPreview');
    const steps=record?customSteps(record):[],fields=[];
    $('composerTitle').textContent=record?'루틴 수정':'루틴 만들기';
    const bedtime=!record&&attachTo?.k==='bed';
    name.value=record?.name||(bedtime?'취침 모드':'');rows.replaceChildren();
    let suggestedLight=false;
    const selected=()=>fields.filter(f=>f.select.value).map(f=>({deviceId:f.deviceId,operation:f.select.value}));
    const update=()=>{
      const count=selected().length;
      submit.disabled=!name.value.trim()||!count;
      $('customStatus').textContent=!fields.length?'지원하는 등록 기기가 없어요.':count?count+'개 동작 선택':'사용할 기기의 동작을 골라 주세요.';
    };
    for(const d of model.registeredAppliances()){
      const options=model.customOptions(d);if(!options.length)continue;
      const label=document.createElement('label'),select=document.createElement('select');
      const deviceName=ProductCatalog.unitTitle(d,M.products[d.k]);
      select.setAttribute('aria-label',deviceName);label.append(deviceName,select);
      select.add(new Option('사용 안 함',''));
      for(const a of options)select.add(new Option(a.label,a.actionId));
      select.value=steps.find(s=>s.deviceId===d.id)?.operation||'';
      if(bedtime&&!suggestedLight&&options.some(a=>a.actionId==='light-off')){
        select.value='light-off';suggestedLight=true;
      }
      select.onchange=update;rows.append(label);fields.push({deviceId:d.id,select});
    }
    name.oninput=update;update();
    if(steps.length>selected().length)$('customStatus').textContent='사용할 수 없는 기기가 있어요. 연결할 동작을 다시 골라 주세요.';
    submit.onclick=()=>{
      try{
        const draft=model.customRoutine(name.value,selected(),record?.templateId);
        if(bedtime||record?.scene==='bedtime')draft.scene='bedtime';
        dialog.close();playCustom(draft,'composer');
      }catch(e){$('customStatus').textContent=e.message}
    };
    dialog.showModal();
  }
  function playCustom(record,from){
    if(from!=='composer')composerFurniture=from==='furniture'?furniture:null;
    const verified=model.customRoutine(record.name,customSteps(record),record.templateId);
    if(record.scene==='bedtime')verified.scene='bedtime';
    if(record.omitted)verified.omitted=record.omitted;
    recipeEffects={};
    for(const a of verified.actions){
      const item=list().find(o=>o.deviceId===verified.bindings[a.actionId]&&visible(o));
      if(item)recipeEffects[item.id]=groups[a.kind]?a.kind:a.operation;
    }
    history.pushState({...history.state,dotMovie:true},'');
    const linkedBed=composerFurniture?.k==='bed'?composerFurniture:list().find(o=>o.k==='bed'&&o.routineIds?.includes(record.templateId));
    const bedtime=linkedBed&&(verified.scene==='bedtime'||record.name==='취침 모드')&&
      verified.actions.some(a=>a.operation==='light-off'||a.operation==='light-dim');
    const now=performance.now(),current=position(now);
    beginCleaningScene(recipeEffects);
    if(bedtime){
      sceneBeforeMovie??={target,seat,standing,start,walking,elapsed:now-started,reaction,arrivalOffset:reaction?reaction.arrives-now:0};
      sleepBed=linkedBed;seat=null;target=linkedBed;reaction=null;start=current;started=now;
      standing=M.bedPoint(room(),tone(),linkedBed);
      walking=!still()&&Math.hypot(current.x-standing.x,current.y-standing.y)>1;
    }
    previousPanel=from;playback=verified;setPanel('customPlaying');if(!still())animate();
  }
  // Each selected template owns a draft. Only the final save writes routine records.
  const batchTemplates=[model.movieTemplate,...templates];
  const movieActions={
    tv:'TV 켜기',light:'조명 30%',curtain:'커튼 닫기'
  };
  const shownClues=new Set();
  let clueTimer;
  function supportsPlacement(o,a){
    if(a.kind==='tv')return isTV(o);
    if(a.kind==='light')return o.k==='floor_lamp';
    if(a.kind==='curtain')return o.k==='window';
    return groupFor(o.k)===a.kind;
  }
  function placementClue(added){
    if(space!=='dream'||readOnly)return;
    const placed=list().filter(visible),before=placed.filter(o=>o!==added),messages=[];
    for(const t of batchTemplates){
      const required=t.actions.filter(a=>a.required);
      if(!required.every(a=>placed.some(o=>supportsPlacement(o,a))))continue;
      const justOpened=!required.every(a=>before.some(o=>supportsPlacement(o,a)));
      const labels=[];
      for(const a of t.actions){
        if(!placed.some(o=>supportsPlacement(o,a))||(!justOpened&&before.some(o=>supportsPlacement(o,a))))continue;
        const key='lg-miniroom.placement-clue.'+room()+'.'+t.id+'.'+a.actionId;
        if(shownClues.has(key))continue;
        try{if(roomStorage.getItem(key))continue}catch{/* Session-only deduplication is still available. */}
        shownClues.add(key);
        try{roomStorage.setItem(key,'1')}catch{/* Keep the hint once per open session. */}
        labels.push(a.kind==='light'?'조명 밝기 30%':batchLabel(a));
      }
      if(labels.length)messages.push(t.name+(justOpened?' 가능 · ':'에 추가 · ')+labels.join(', '));
    }
    if(messages.length){
      $('comboHint').textContent=messages.join(' / ');
      clearTimeout(clueTimer);clueTimer=setTimeout(()=>$('comboHint').textContent='',4500);
    }
  }
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
  function requestRoutineSetup(t){
    recipe=t===model.movieTemplate?null:t;
    const url=new URL(location.href);
    url.searchParams.delete('inventoryConnect');
    url.searchParams.set('connect','1');
    url.searchParams.set('template',t.id);
    history.replaceState(history.state,'',url);
    setPanel('routineSetup');
  }
  function openMyRoutine(t){
    recipe=t===model.movieTemplate?null:t;
    if(model.homeSource==='unavailable'){setPanel('idle');return}
    if(!hasHome()){requestRoutineSetup(t);return}
    clearConnectLink();
    if(t===model.movieTemplate){
      if(saved()&&needsRepair())beginRepair();else connect();
    }else openRecipe(t,null,combinationSuggestions(model.registeredAppliances()).includes(t));
  }
  let returnToBag=false;
  function previewFromInventory(t){
    const device=list().find(o=>!o.exhibit&&visible(o)&&(t===model.movieTemplate?isTV(o):groupFor(o.k)===t.actions[0].kind));
    if(device){
      if(t===model.movieTemplate)startMovie(my?'inventory':'product');
      else{
        openRecipe(t,my?null:device);
        if(!recipeReady())return;
        playRecipe('applianceConfig');
      }
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
      const k=Object.values(model.demoModels).find(key=>ProductCatalog.hasModel(key)&&groupFor(key)===a.kind);
      if(!k){if(!a.required)continue;setPanel('idle');notice('이 루틴에 맞는 DB 제품이 없어요.');return}
      const o={id:id(),k,x:a.required?15:45,y:30,f:0,e:0};
      if(!findSpace(o)){setPanel('idle');return}
      list().push(o);
    }
    refresh();openRecipe(t);playRecipe('applianceConfig');
  }
  const furnitureFamilies={
    sofa:'소파',bed:'침대',wardrobe:'수납 가구',dresser:'수납 가구',bookshelf:'수납 가구',
    desk:'책상·테이블',nightstand:'책상·테이블',dining:'책상·테이블',coffee:'책상·테이블',
    chair:'의자·벤치',stool:'의자·벤치',bench:'의자·벤치',island:'주방 가구',counter:'주방 가구',
    vanity:'욕실 가구',shower:'욕실 가구'
  };
  function bagFamily(item){
    if(item.catalogFamily)return item.catalogFamily;
    if(item.washerStyle)return '세탁기';
    if(item.k==='floor_lamp'&&my)return '조명';
    return furnitureFamilies[item.k]||item.c;
  }
  let bagFilter='routine',bagGroup='';
  const bagPositions=new Map(),bagGroups=new Map(),bagPages=new Map();
  function navigateBag(filter,group){
    const host=$('bagItems'),previous=bagGroup;
    if(!host.hidden)bagPositions.set(bagFilter+'/'+bagGroup,host.scrollTop);
    showBagItems(filter,group);
    if(filter==='routine')return;
    const scroll=bagPositions.get(filter+'/'+bagGroup)||0;
    if(bagGroup!==previous){
      const focus=bagGroup?$('bagGroupBack'):[...host.querySelectorAll('[data-family]')].find(b=>b.dataset.family===previous);
      focus?.focus({preventScroll:true});
    }
    host.scrollTop=scroll;
  }
  function showBagItems(filter,group='',focusKey){
    const host=$('bagItems'),routines=filter==='routine';
    bagFilter=filter;bagGroup=group;
    $('bagGroupNav').hidden=true;
    $('bagRows').hidden=!routines;host.hidden=routines;
    for(const b of $('bagFilters').querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.bag===filter));
    host.replaceChildren();
    if(routines)return;
    const basicFurniture=filter==='furniture';
    const counts=new Map();
    for(const item of list()){
      if(item.exhibit||!visible(item))continue;
      const key=my&&item.deviceId?item.deviceId:item.k;
      counts.set(key,(counts.get(key)||0)+1);
    }
    let entries,modelGroups;
    if(basicFurniture){
      entries=Object.values(M.products).filter(item=>item.c!=='가전'&&allowed(item.k)&&(!isAppliance(item.k)||(!my&&item.k==='floor_lamp'))).map(item=>({k:item.k}));
    }else if(my){
      modelGroups=new Map();
      for(const d of model.registeredAppliances()){
        if(!modelGroups.has(d.k))modelGroups.set(d.k,[]);
        modelGroups.get(d.k).push(d);
      }
      entries=[...modelGroups.values()].flat();
    }else{
      entries=[...new Set(model.state.collection)].filter(model.isCollectibleProduct).map(k=>({k}));
    }
    if(!entries.length){
      const empty=document.createElement('li');
      empty.textContent=my?(model.homeSource==='unavailable'?'등록 목록을 불러오지 못했어요.':'등록 가전에서 가전을 추가해 보세요.'):'가전 촬영으로 제품을 모아 보세요.';
      host.append(empty);return;
    }
    const families=new Map();
    for(const d of entries){
      const item=M.products[d.k]||ProductCatalog.restore(M.products,d.k);
      if(!item)continue;
      const family=bagFamily(item);
      if(!families.has(family))families.set(family,[]);
      families.get(family).push(d);
    }
    if(!families.has(group))bagGroup='';
    bagGroups.set(filter,bagGroup);
    $('bagGroupNav').hidden=!bagGroup;
    $('bagGroupTitle').textContent=bagGroup;
    let closeOpenDetails=null;
    function bindDetails(button,details){
      button.setAttribute('aria-expanded','false');
      button.onclick=()=>{
        const opening=details.hidden;
        closeOpenDetails?.();
        closeOpenDetails=null;
        if(!opening)return;
        details.hidden=false;button.setAttribute('aria-expanded','true');
        closeOpenDetails=()=>{details.hidden=true;button.setAttribute('aria-expanded','false')};
      };
    }
    const hints=ProductCatalog.differences((families.get(group)||[]).map(d=>d.k));
    for(const [family,members] of families){
      if(bagGroup&&family!==bagGroup)continue;
      if(!bagGroup&&(!basicFurniture||members.length>1)){
        const row=document.createElement('li'),button=document.createElement('button'),pic=document.createElement('canvas');
        const title=document.createElement('strong'),total=document.createElement('small');
        pic.width=48;pic.height=42;pic.setAttribute('aria-hidden','true');M.thumbnail(pic,members[0].k,tone());
        button.type='button';button.className='bag-group';button.dataset.family=family;
        title.textContent=family;total.textContent=members.length+(modelGroups?'대':'종')+' ›';
        button.append(pic,title,total);row.append(button);host.append(row);
        button.onclick=()=>navigateBag(filter,family);
        continue;
      }
      const key=filter+'/'+family;
      const page=inventoryPage(members,bagPages,key,focusKey?members.findIndex(d=>d.k===focusKey):-1);
      for(const d of page.items)appendItem(d);
      if(page.count>1){
        const row=document.createElement('li');
        row.append(pageNavigation(page,n=>{
          bagPages.set(key,n);showBagItems(filter,group);host.scrollTop=0;
          host.querySelector('button')?.focus({preventScroll:true});
        }));
        host.append(row);
      }
    }
    function appendItem(d){
      const item=M.products[d.k]||ProductCatalog.restore(M.products,d.k);
      const count=counts.get(d.id||d.k)||0;
      const row=document.createElement('li'),pic=document.createElement('canvas'),label=document.createElement('span'),status=document.createElement('small');
      row.dataset.item=d.k;
      pic.width=48;pic.height=42;pic.setAttribute('aria-hidden','true');M.thumbnail(pic,d.k,tone());
      ProductCatalog.labelItem(label,item,my?d:null,hints);
      const location=my&&d.id?placedRoom(d.id):null;
      if(modelGroups){
        status.textContent=location?location+'룸에 배치됨':'미배치';
      }else{
        const source=basicFurniture?'기본 '+item.c:'드림룸 수집품';
        status.textContent=source+' · '+(count?'이 방에 '+count+'개 배치':'이 방에 미배치');
      }
      label.append(status);
      const group=modelGroups?.get(d.k);
      if(group?.length>1&&group[0]===d){
        const summary=document.createElement('strong');
        summary.className='unit-summary';summary.textContent=unitSummary(group);
        row.append(summary);
      }
      const toggle=document.createElement('button'),details=document.createElement('div');
      toggle.type='button';toggle.className='bag-unit';
      toggle.append(pic,label);details.hidden=true;
      const enterEditor=()=>{$('routineBag').close();if(!editMode)toggleEdit()};
      const placeable=canAdd(d.k,d.id);
      const instances=my&&!basicFurniture?(location?[{location,match:o=>o.deviceId===d.id}]:[]):
        list().filter(o=>o.k===d.k&&!o.exhibit&&visible(o)).map(o=>({location:room(),item:o,match:item=>item.id===o.id}));
      const locate=instance=>{
        enterEditor();focusPlacement(instance.location,instance.match);
      };
      const directPlace=placeable&&!instances.length;
      const single=instances.length===1?instances[0]:null;
      row.append(toggle);
      if(directPlace||single){
        const hint=document.createElement('span');hint.className='bag-tap-hint';
        hint.textContent=directPlace?'놓기':single.location===room()?'찾기':single.location+'룸 찾기';
        toggle.append(hint);
        toggle.onclick=directPlace?()=>startBagPlacement(d,enterEditor):()=>locate(single);
        if(!basicFurniture||single){
          const info=document.createElement('button');info.type='button';info.className='bag-info';
          info.textContent=single?'상세':'정보';
          info.setAttribute('aria-label',ProductCatalog.unitTitle(d,item)+(single?' 배치 상세':' 제품 정보'));
          row.append(info);bindDetails(info,details);
        }
      }else{
        bindDetails(toggle,details);
        if(instances.length>1){
          const hint=document.createElement('span');hint.className='bag-tap-hint';hint.textContent='위치 선택';toggle.append(hint);
        }
      }
      for(const [i,instance] of instances.entries()){
        const suffix=instances.length>1?' '+(i+1):'';
        if(instances.length>1){
          const find=action(instance.location+'룸에서 보기'+suffix,()=>locate(instance),false,details);
          find.className='bag-place';
        }
        if(my&&basicFurniture&&isFurniture(instance.item)){
          const links=model.state.savedRoutines.filter(r=>instance.item.routineIds?.includes(r.templateId));
          const names=document.createElement('small');
          names.textContent=(suffix?item.n+suffix+' · ':'')+
            (links.length?'연결된 루틴 · '+links.map(r=>routineName(r)).join(', '):'연결된 루틴 없음');
          details.append(names);
          const routines=action('가구 루틴 열기'+suffix,()=>{
            $('routineBag').close();if(editMode)toggleEdit();
            const placed=focusPlacement(instance.location,instance.match);
            if(placed)tap(placed);
          },false,details);
          routines.className='bag-place';
        }
      }
      if(placeable&&instances.length){
        const place=action('하나 더 놓기',()=>startBagPlacement(d,enterEditor),false,details);
        place.className='bag-place';
      }
      if(!basicFurniture){
        const detail=document.createElement('small');
        detail.className='bag-product-detail';
        detail.textContent=[ProductCatalog.productTitle(d.k,item.salesName||item.n),item.modelCode||d.modelCode].filter(Boolean).join(' · ');
        details.append(detail);
      }
      row.append(details);
      host.append(row);
    }
  }
  let chosenRoutine='movie-night';
  function bagCard(rows,{id,title,status,badge,sprite,steps,scope,unknown}){
    const section=document.createElement('article'),toggle=document.createElement('button'),icon=document.createElement('span');
    const pic=document.createElement('canvas'),tag=document.createElement('small'),summary=document.createElement('span');
    const name=document.createElement('strong'),caption=document.createElement('small'),details=document.createElement('div');
    const all=steps.every(step=>step.available),required=steps.filter(step=>step.required).every(step=>step.available);
    const fit=unknown?'확인 필요':steps.some(s=>s.required&&!s.available&&s.registered)?'배치 확인':all?'전체 적용 가능':required?'일부 적용 가능':'필수 기기 없음';
    section.dataset.cardId=id;toggle.className='routine-card';toggle.setAttribute('aria-label',title+' 상세');
    icon.className='routine-orb';icon.classList.toggle('compatible',!unknown&&all);
    pic.width=42;pic.height=42;pic.setAttribute('aria-hidden','true');M.thumbnail(pic,sprite,tone());
    tag.textContent=badge;icon.append(pic,tag);name.textContent=title;caption.textContent=status+' · '+fit;
    summary.append(name,caption);toggle.append(icon,summary);section.append(toggle,details);rows.append(section);
    details.className='bag-details';details.id='bag-detail-'+rows.children.length;toggle.setAttribute('aria-controls',details.id);
    const heading=document.createElement('strong'),list=document.createElement('ul');
    heading.textContent=title+' · '+scope;
    for(const step of steps){
      const line=document.createElement('li');
      line.textContent=step.label+' · '+(step.required?'필수':'선택')+' · '+(unknown?'확인 필요':step.state||(step.available?'가능':'기기 없음'));list.append(line);
    }
    details.append(heading,list);
    function select(open){details.hidden=!open;toggle.setAttribute('aria-expanded',String(open))}
    select(chosenRoutine===id);
    toggle.onclick=()=>{
      const previous=rows.querySelector('.routine-card[aria-expanded=true]');
      if(previous){previous.setAttribute('aria-expanded','false');previous.nextElementSibling.hidden=true}
      chosenRoutine=id;select(true);
    };
    return details;
  }
  function openBag(filter='routine',group='',focusKey){
    const dialog=$('routineBag');
    bagPositions.clear();bagGroups.clear();bagPages.clear();showBagItems(filter,group,focusKey);
    $('bagItems').scrollTop=0;
    if(!dialog.open)dialog.showModal();
    refreshBagRoutines();
  }
  function refreshBagRoutines(){
    const dialog=$('routineBag'),rows=$('bagRows');
    rows.replaceChildren();
    const loading=document.createElement('p');loading.textContent='루틴을 불러오는 중이에요.';rows.append(loading);
    const request=Symbol();bagRequest=request;
    async function drawRows(){
      let records,placed,registered=[],unknown=false;
      try{
        if(my){
          records=model.homeSource==='unavailable'?[]:model.state.savedRoutines;
          unknown=model.homeSource==='unavailable';
          placed=list().filter(visible);
          registered=model.registeredAppliances();
        }else{
          const snapshot=await model.inventoryHome();
          records=snapshot.records;placed=snapshot.placed;
          registered=snapshot.registered||[];
        }
      }catch{records=[];placed=[];unknown=true}
      if(request!==bagRequest||!dialog.open)return;
      rows.replaceChildren();
      const current=list().filter(o=>visible(o)&&!o.exhibit);
      const sprites={tv:'tvset',air:'tower_ac',washer:'wash_m',robot_vacuum:'robot_vacuum'};
      for(const t of batchTemplates){
        const record=records.find(r=>r.templateId===t.id),movie=t===model.movieTemplate;
        const required=t.actions.find(a=>a.required);
        const broken=record&&!unknown&&!registered.some(d=>d.id===record.bindings[required.actionId]&&supportsAction(d,required));
        const origin=model.discovery(t.id),known=!!origin||!!record;
        const steps=t.actions.map(a=>{
          const compatible=registered.filter(d=>supportsAction(d,a));
          const available=current.some(o=>supportsPlacement(o,a)&&(!my||compatible.some(d=>d.id===o.deviceId)));
          let state;
          if(my&&!available){
            if(compatible.length)state=compatible.some(d=>!placedRoom(d.id))?'등록됨 · 미배치':'다른 방에 배치됨';
            else if(registered.some(d=>d.kind===a.kind||groupFor(d.k)===a.kind))state='등록 기기가 이 동작을 지원하지 않음';
            else state=a.required?'등록 기기 없음':'등록 기기 없음 · 제외 가능';
          }
          return {label:batchLabel(a),required:a.required,available,registered:compatible.length,state};
        });
        const ready=steps.every(s=>!s.required||s.available);
        const need=movie?'TV':groups[required.kind].label;
        const status=record?(broken?'저장됨 · 재연결 필요':'내 루틴에 저장됨'):(known?'발견함':ready?'체험 가능':'미발견');
        const sourceTag=origin==='example_room'?'친구':origin==='collection'?'드림':origin==='my_room'?'마이':'';
        const badge=record?(sourceTag?sourceTag+'·저장':'마이·저장'):(sourceTag||'미발견');
        const section=bagCard(rows,{id:t.id,title:t.name,status:status+' · '+need+' 필수',badge,sprite:sprites[required.kind],
          steps,scope:'이 방의 배치',unknown:my&&unknown});
        if(known||ready){
          action(known?'다시 미리보기':'미리보기',()=>{
            dialog.close();if(editMode)toggleEdit();previewFromInventory(t);
          },true,section);
        }
        if(my&&!unknown&&!steps.some(s=>s.required&&s.registered)&&!record){
          action('가전 추가',()=>{dialog.close();openLibrary()},false,section);
        }
        if(known||my&&steps.some(s=>s.required&&s.registered)){
          action(record?(broken?'다시 연결':'저장한 연결 보기'):my&&movie&&!ready&&steps[0].registered?'TV 골라 놓기':'내 방에 맞추기',()=>{
            dialog.close();if(editMode)toggleEdit();
            if(my)openMyRoutine(t);
            else location.assign(inventoryUrl('my',{inventoryConnect:t.id,source:model.discovery(t.id)||source}));
          },false,section);
        }
      }
      for(const record of records.filter(r=>r.custom)){
        const ready=customReady(record,registered);
        const steps=record.actions.map(a=>{
          const device=registered.find(d=>d.id===record.bindings[a.actionId]);
          return {label:(device?.name||'이전 기기')+' · '+a.label,required:true,
            available:!!device&&model.customOptions(device).some(op=>op.actionId===a.operation)};
        });
        const section=bagCard(rows,{id:record.templateId,title:routineName(record,records),badge:'마이·저장',sprite:'sofa',steps,
          status:ready?'내 루틴에 저장됨':'저장됨 · 재연결 필요',scope:'내 등록 가전',unknown});
        section.parentElement.dataset.routineId=record.templateId;
        action(ready?(my?'실행':'마이룸에서 실행'):'다시 연결',()=>{
          dialog.close();if(editMode)toggleEdit();
          if(!my){location.assign(inventoryUrl('my',{inventoryRun:record.templateId}));return}
          returnToBag=ready;runCustom(record,'idle');
        },true,section);
      }
    }
    drawRows().catch(()=>{if(request===bagRequest)rows.textContent='인벤토리를 읽지 못했어요. 다시 열어 주세요.'});
  }
  let bagRequest=null;
  function openBatch(recommended=[]){
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
      return {template,original,bindings,selected:recommended.includes(template.id)};
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
        if(groups[a.kind]&&!options.length&&unplacedOptions(a).length){
          action((sample?'체험용 ':'등록 ')+groups[a.kind].label+' 배치',()=>{
            d.bindings[key]=addDemoAppliance(a);
            for(const other of drafts.filter(row=>row.selected))fieldsFor(other,$('batch-'+other.template.id));
            updateStatus();
          },false,fields);
        }
        if(a.kind==='tv'&&options.some(o=>o.id===selected)&&!screenFor(selected)){
          action(nameOf(selected)+' 방에 놓기',()=>{
            const tv=planTV(liveTVs().find(o=>o.id===selected));
            if(!tv)throw Error('TV를 배치할 빈자리가 없어요.');
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
      check.checked=d.selected;fields.hidden=!d.selected;
      label.append(check,d.template.name);
      if(d.original){const badge=document.createElement('small');badge.textContent='저장됨';label.append(badge)}
      row.append(label,fields);rows.append(row);
      if(d.selected)fieldsFor(d,fields);
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
        model.saveRoutines(records);revealSavedRoutine=records[0].templateId;
        for(const record of records)model.logObservation('routine_saved',space,source,record.templateId);
        dialog.close();setPanel('idle');notice(records.length+'개 루틴을 저장했어요.');
      }catch(error){status.textContent='저장하지 못했어요. '+error.message}
    };
    updateStatus();dialog.showModal();
  }
  function recipeSummary(){
    const summary=recipe.actions.map(a=>{
      const d=applianceOptions(a).find(d=>d.id===playback.bindings[a.actionId]);
      return d?d.name+' '+a.label:groups[a.kind].label+' 제외';
    });
    if(cleaningRuns.length){
      summary.push(seat?'고양이는 소파에서 청소기를 지켜봐요':'고양이는 옆에서 청소기를 지켜봐요');
      if(!cleaningRuns[0].path.length)summary.push(blockedRobotMessage(cleaningRuns[0].item));
    }
    return summary.join(' · ')+' · 실제 가전은 작동하지 않아요';
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
    show(recipe.name+' 실행 중',recipeSummary());
    if(!still())action('연출 건너뛰기',()=>{skipped=true;walking=false;render();draw()});
    action('재생 종료',()=>closeMovie());
    if(my&&previousPanel==='applianceConfig')action('내 루틴에 저장',()=>{
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
      // A removed TV may still have an old anchor that has since been occupied.
      const returning=!registered&&list().find(o=>isTV(o)&&o.deviceId===d.id);
      const placement=returning&&{...returning};
      if(placement&&!findSpace(placement))return;
      model.update(s=>s.registeredTvIds=registered?active.filter(id=>id!==d.id):[...active,d.id]);
      if(placement&&(returning.x!==placement.x||returning.y!==placement.y)){
        returning.x=placement.x;returning.y=placement.y;delete returning.rotationOrigin;
      }
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
    if(params.get('app')==='thinq')url.searchParams.set('app','thinq');
    if(adapt){url.searchParams.set('connect','1');url.searchParams.set('source',source);
      if(panel==='appliancePlaying'&&recipe)url.searchParams.set('template',recipe.id);
    }
    return url.href;
  }
  const photoPicker=space==='dream'?createPhotoPicker({$,showProducts,isCollectible:model.isCollectibleProduct,
    recognizePhoto:model.recognizePhoto,provider:model.photoProvider}):null;
  const catalog=space==='dream'?ProductCatalog.browser({$,scene:M,tone,collected:model.collected,collect(item,row){
    try{model.collect(item.k,'catalog')}catch(e){$('catalogStatus').textContent=e.message;return}
    inventory();refresh();render();$('catalogBrowse').hidden=true;showCollectionResult(item,row,true);
  }}):null;
  if(catalog)$('openCatalog').onclick=()=>{photoPicker.reset();catalog.gallery();$('library').scrollTop=0};
  async function openScanner(){
    const back=new URL(route(my?'my':'dream'));
    back.searchParams.set('camera',my?'register':'collect');
    const account=document.getElementById('account-data');
    if(account){
      try{
        await roomStorage.whenSynced();
        const ticket=Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('');
        sessionStorage.setItem('miniroom.camera.return',JSON.stringify({
          ticket,owner:JSON.parse(account.textContent).user.id,path:back.pathname+back.search
        }));
        back.searchParams.delete('app');back.searchParams.set('camera','resume');back.searchParams.set('ticket',ticket);
      }catch{notice('계정 저장 상태를 확인한 뒤 카메라를 다시 열어 주세요.');return}
    }
    const scan=new URL('/scan','https://lg-camera-lab.pages.dev');
    scan.searchParams.set('returnTo',back.href);location.assign(scan.href);
  }
  function openLibrary(){
    photoPicker?.reset();
    $('collectionResult').hidden=true;$('libraryBrowse').hidden=false;
    $('libraryTitle').textContent=my?'등록 가전':'가전 수집';
    $('openCamera').hidden=!my;
    $('libraryDemo').hidden=!(my&&sample&&model.state.cameraAppliances?.length&&model.state.myFixtureId!=='sample-home-v1');
    $('libraryDemo').onclick=()=>{prepare();openLibrary()};
    $('openCamera').onclick=openScanner;
    $('libraryNote').textContent=my?(sample?(hasHome()?'등록한 가전은 배치 편집에서 방에 놓을 수 있어요.':'연결된 계정이 없어요. 모델명 라벨을 촬영해 가전을 추가할 수 있어요.'):
      model.homeSource==='thinq'?'이 계정에서 방에 배치할 수 있는 등록 가전이에요.':'ThinQ 등록 목록을 읽지 못했어요.'):'사진은 기기 안에서만 사용해요. 후보 체험에는 예시 제품이 표시돼요.';
    if(my)$('libraryNote').textContent+=' 전체 모델 코드까지 촬영해 주세요. 카메라의 ‘드림룸에 등록’을 눌러도 여기서 시작하면 마이룸 등록 가전에 추가돼요.';
    $('collectionPhoto').hidden=my;
    $('openCatalog').hidden=true;$('catalogBrowse').hidden=true;
    $('libraryStatus').textContent='';showProducts();if(!$('library').open)$('library').showModal();
  }
  function showCollectionResult(product,row,fromCatalog=false){
    const dialog=$('library'),offset=row.getBoundingClientRect().top-dialog.getBoundingClientRect().top;
    photoPicker.reset();
    $('libraryBrowse').hidden=true;$('collectionResult').hidden=false;
    $('libraryTitle').textContent='수집 완료';$('collectedName').textContent=ProductCatalog.productTitle(product.k,product.n);
    $('collectedUse').textContent=productUse(product.k);
    M.thumbnail($('collectedPic'),product.k,tone());
    $('placeCollected').textContent='방에 놓기';
    $('keepScanned').hidden=true;$('continueCollecting').hidden=false;
    $('placeCollected').onclick=()=>{
      dialog.close();
      if(!editMode)toggleEdit();
      placeCollected(product.k);
    };
    $('continueCollecting').onclick=()=>{
      if(fromCatalog){$('collectionResult').hidden=true;catalog.resume();return}
      $('collectionResult').hidden=true;$('libraryBrowse').hidden=false;
      $('libraryTitle').textContent='가전 수집';$('libraryStatus').textContent='';
      showProducts([...new Set([...ProductCatalog.representatives(),product.k])]);
      const anchor=$('libraryItems').querySelector('[data-product="'+product.k+'"]');
      dialog.scrollTop+=(anchor.getBoundingClientRect().top-dialog.getBoundingClientRect().top-offset)/(dialog.getBoundingClientRect().width/dialog.offsetWidth);
      anchor.tabIndex=-1;anchor.focus({preventScroll:true});
    };
    $('placeCollected').focus();
  }
  function showScanChoice(record){
    const {exact}=ProductCatalog.cameraModel(record);
    if(!exact){$('library').close();notice(record.modelCode+'에 일치하는 수집 모델이 없어요.');return}
    const item=ProductCatalog.restore(M.products,exact),dialog=$('library');
    $('libraryBrowse').hidden=true;$('collectionResult').hidden=false;$('libraryTitle').textContent='촬영 결과';
    $('collectedName').textContent=record.displayName;
    $('collectedUse').textContent=record.modelCode+(model.collected(exact)?' · 이미 수집한 가전':'');
    M.thumbnail($('collectedPic'),exact,tone());
    $('placeCollected').textContent='드림룸에 놓기';$('keepScanned').hidden=false;$('continueCollecting').hidden=true;
    function accept(place){
      try{model.collect(exact,'photo',{provider:'lg-camera',decision:'confirmed'})}
      catch(error){$('collectedUse').textContent=error.message;return}
      const from=$('collectedPic').getBoundingClientRect();
      dialog.close();
      let destination,host=document.body;
      if(place){
        if(!editMode)toggleEdit();
        const added=placeCollected(exact);
        if(!added){notice('인벤토리에 보관했어요. 배치 공간과 저장 상태를 확인해 주세요.');return}
        const q=M.place(room(),tone(),added),cv=$('scene'),rect=cv.getBoundingClientRect();
        destination={x:rect.left+(q.x+q.s.w/2)*rect.width/cv.width,y:rect.top+(q.y+q.s.h/2)*rect.height/cv.height};
      }else{
        openBag('appliance',bagFamily(M.products[exact]),exact);host=$('routineBag');
        const thumbnail=[...$('bagItems').children].find(row=>row.dataset.item===exact)?.querySelector('canvas');
        if(!thumbnail)return;
        thumbnail.scrollIntoView({block:'nearest'});const rect=thumbnail.getBoundingClientRect();
        destination={x:rect.left+rect.width/2,y:rect.top+rect.height/2};
      }
      if(reducedMotion.matches)return;
      const ghost=document.createElement('canvas');ghost.className='scan-transfer';ghost.setAttribute('aria-hidden','true');
      ghost.width=64;ghost.height=54;M.thumbnail(ghost,exact,tone());host.append(ghost);
      ghost.style.left=(from.left+from.width/2-32)+'px';ghost.style.top=(from.top+from.height/2-27)+'px';
      const dx=destination.x-from.left-from.width/2,dy=destination.y-from.top-from.height/2;
      const anim=ghost.animate([{transform:'scale(1)'},{transform:'translate('+dx+'px,'+dy+'px) scale('+(place?1.15:.48)+')',opacity:.3}],{duration:300,easing:'ease-out'});
      anim.onfinish=anim.oncancel=()=>ghost.remove();
    }
    $('placeCollected').onclick=()=>accept(true);$('keepScanned').onclick=()=>accept(false);
    $('keepScanned').focus();
  }
  function showProducts(keys){
    const host=$('libraryItems');host.replaceChildren();
    const entries=my?model.registeredAppliances().filter(d=>d.camera||d.k==='floor_lamp'||ProductCatalog.hasModel(d.k)):
      (keys||ProductCatalog.representatives()).filter(ProductCatalog.hasModel).map(k=>ProductCatalog.restore(M.products,k));
    const hints=ProductCatalog.differences(entries.map(d=>d.k));
    for(const d of entries){
      if(ProductCatalog.componentOnly(d.k)||(!my&&ProductCatalog.heldSale(d.k)))continue;
      const row=document.createElement('div'),pic=document.createElement('canvas'),label=document.createElement('span');
      pic.width=40;pic.height=36;pic.setAttribute('aria-hidden','true');
      if(M.products[d.k])M.thumbnail(pic,d.k,tone());
      ProductCatalog.labelItem(label,M.products[d.k]||d,my?d:null,hints);
      if(d.camera){
        const info=document.createElement('small');
        info.textContent=d.modelCode+(M.products[d.k]?.spriteKey==='camera_generic'?' · 기본 아이콘':'');
        label.append(info);
      }
      row.dataset.product=d.k||'';row.append(pic,label);host.append(row);
      if(!M.products[d.k])label.append(' · 배치 미지원');
      if(!my){
        const name=Array.from(label.childNodes,n=>n.textContent).join(' · '),role=document.createElement('small');
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
    if(my&&!entries.length&&hasHome())host.textContent='제품 DB와 일치하는 등록 모델이 없어요.';
    if(my&&!sample)action('목록 새로고침',()=>location.reload(),false,host);
  }
  // Both room pages use the same objects and actions as taps on the canvas and inventory.
  function renderRoomCards(){
    const section=$('roomCards'),host=$('roomCardList');
    section.hidden=readOnly||editMode||panel!=='idle'||!!playback;
    if(section.hidden)return;
    $('roomCardsTitle').textContent=my?'가구를 눌러 루틴 시작':'수집한 가전';
    $('roomCollectionAll').hidden=my;
    host.replaceChildren();
    function card(k,title,detail,open){
      const b=document.createElement('button'),pic=document.createElement('canvas');
      pic.width=48;pic.height=38;pic.setAttribute('aria-hidden','true');M.thumbnail(pic,k,tone());
      const label=document.createElement('strong');label.textContent=title;
      const sub=document.createElement('small');sub.textContent=detail;
      b.append(pic,label,sub);b.onclick=open;host.append(b);
    }
    if(my){
      for(const o of list().filter(isFurniture)){
        const linked=model.state.savedRoutines.filter(r=>o.routineIds?.includes(r.templateId));
        const title=linked.length?routineName(linked[0]):M.products[o.k].n;
        const detail=linked.length?M.products[o.k].n+(linked.length>1?' · 외 '+(linked.length-1)+'개':''):'연결된 루틴 없음';
        card(o.k,title,detail,()=>tap(o));
      }
    }else{
      const groups=new Map();
      for(const k of new Set(model.state.collection)){
        if(!model.isCollectibleProduct(k)||!M.products[k])continue;
        const family=bagFamily(M.products[k]);
        const group=groups.get(family);
        if(group)group.count++;else groups.set(family,{k,count:1});
      }
      for(const [family,{k,count}] of groups)card(k,family,count+'종',()=>openBag('appliance',family));
      $('roomCollectionAll').onclick=()=>openBag('appliance');
    }
    if(!host.childElementCount)host.textContent=my?'이 방에 배치한 가구가 없어요.':'가전을 촬영하면 여기에 모여요.';
  }
  function renderRoomChrome(){
    if(readOnly||params.get('homePreview')==='1')return;
    const browse=!editMode,shortcuts=$('roomShortcuts'),tools=browse?shortcuts:$('spaces');
    document.body.classList.toggle('personal-browse',browse);
    document.body.dataset.space=space;
    const title=$('personalRoomName');title.hidden=!browse;
    shortcuts.hidden=!browse;
    if($('editMode').parentElement!==tools)tools.append($('routineBagButton'),$('editMode'),$('libraryButton'));
    const context=$('roomContext');context.hidden=!browse;
    if(browse)context.textContent=my?'마이룸 · 등록 가전':'✦ 수집 가전 '+new Set(model.state.collection.filter(model.isCollectibleProduct)).size+'개 · 가상 루틴 체험';
    renderRoomCards();
  }
  function render(){
    renderRoomChrome();
    $('living').classList.toggle('model-card',panel==='product'&&!editMode);
    offer?.disconnect();offer=null;
    if(!((friend&&panel==='idle')||(!readOnly&&!my&&!editMode&&panel==='product'&&isTV(target))))offeredTarget=null;
    for(const b of $('rooms').children)b.disabled=readOnly||!!playback;
    $('routineBagButton').hidden=readOnly;$('routineBagButton').disabled=!!playback;
    $('editMode').hidden=readOnly;$('saveFile').hidden=readOnly;
    $('libraryButton').hidden=readOnly||!my;$('libraryButton').disabled=!!playback;
    $('libraryButton').textContent=my?'등록 가전':'가전 수집';
    $('scanDream').hidden=readOnly||editMode||!!playback;
    if($('bgm'))$('bgm').disabled=!!playback;
    $('friendRoom').href=route('example');$('mini').href=$('account-data')&&params.get('observe')!=='1'?'/miniroom/home?space='+(my?'my':'dream'):route('menu');
    $('manageTVs').hidden=!my||!sample||model.state.myFixtureId==='sample-light-v1'||!hasHome()||!!playback||editMode;
    $('spaces').hidden=false;$('friendRoom').hidden=friend;$('mini').hidden=menu;
    $('dreamLink').href=route('dream');$('myLink').href=route('my');
    if(!readOnly)$(my?'myLink':'dreamLink').setAttribute('aria-current','page');
    $('editMode').textContent=editMode?'배치 완료':'배치 편집';$('editMode').disabled=!!playback||(my&&model.homeSource==='unavailable');
    document.body.classList.toggle('visiting',!editMode);$('living').hidden=editMode;
    for(const el of [$('reset'),$('clear'),$('openFile')])el.hidden=!editMode;
    const detail=$('lifeDetail'),actions=$('lifeActions'),tools=$('routineTools');
    const shelfScroll=$('living').classList.contains('routine-shelf')?actions.scrollTop:0;
    if(detail.parentElement!==$('living'))actions.before(detail);
    actions.replaceChildren();tools.replaceChildren();
    const running=!!playback&&previousPanel==='idle'&&['playing','appliancePlaying','customPlaying'].includes(panel);
    const shelf=my&&hasHome()&&!editMode&&(panel==='idle'||running);
    $('living').classList.toggle('browse-card',!shelf&&(!readOnly||compareWashers)&&!editMode&&(!my||hasHome())&&
      (panel==='idle'||panel==='product'||panel==='furniture'));
    tools.hidden=!shelf;
    $('living').classList.toggle('routine-shelf',shelf);
    $('living').classList.toggle('appliance-panel',!shelf&&(panel.startsWith('appliance')||panel==='recipeList'));
    if(shelf){renderRoutineShelf(running,shelfScroll);return}
    if(editMode)return;
    if(menu){
      show('LG 미니룸');
      action('드림룸 들어가기',()=>{log('miniroom_open');location.assign(route('dream'))},true).id='enter';
      action('예시 친구 방',()=>location.assign(route('example')));
      return;
    }
    if(compareWashers&&panel==='idle'){
      show('세탁기 모델 비교','제품을 눌러 모델명과 사진을 확인하세요.');return;
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
    if(panel==='dreamSuggestion'){
      show(playback.name,'드림룸 가상 미리보기 · 실제 가전은 작동하지 않아요.');
      action('내 방에 맞추기',()=>location.assign(inventoryUrl('my',{suggestion:playback.operation})),true);
      action('재생 종료',()=>closeMovie('idle'));return;
    }
    if(panel==='friendLoading'){show('가져온 루틴','불러오는 중…');return}
    if(panel==='friendMatch'){renderFriendMatch();return}
    if(panel==='suggestionMatch'){
      const rule=model.singleDeviceRules.find(r=>r.operation===params.get('suggestion'));
      const matches=model.registeredAppliances().filter(d=>model.singleDeviceSuggestion(d)===rule);
      show(rule.name,matches.length?'내 가전을 선택해 미리 보세요.':'연결할 등록 가전이 없어요.');
      for(const d of matches)action(ProductCatalog.unitTitle(d,M.products[d.k]),()=>previewHomeSuggestion(rule,d),true);
      action('마이룸 둘러보기',()=>setPanel('idle'));return;
    }
    if(panel==='linkRetry'){renderLinkRetry();return}
    if(panel==='customPlaying'){
      const record=playback;
      show(routineName(record),customSummary(record));
      if(previousPanel==='recommendation'||previousPanel==='friendMatch'){
        action('내 루틴에 저장',()=>{persistRoutine(record);closeMovie('idle');notice(record.name+' 루틴을 저장했어요.');},true);
        action('저장하지 않고 닫기',()=>closeMovie('idle'));return;
      }
      if(previousPanel==='composer')action(saveLabel(composerFurniture),()=>{
        persistRoutine(record);
        finishRoutineSave(record,composerFurniture);
      },true);
      action('동작 수정',()=>closeMovie('composer'));
      action('재생 종료',()=>closeMovie(previousPanel==='furniture'?'furniture':'idle'));return;
    }
    if(renderRecipes())return;
    if(panel==='repair'){
      const any=liveTVs().length>0;
      show('영화 보기 · TV 다시 연결',any?'대체 TV를 선택하면 기존 조명 설정으로 바로 재생해요.':sample?'연결할 TV가 없어요. 체험용 TV를 등록해 주세요.':'ThinQ 등록 목록에서 연결할 TV를 찾지 못했어요.');
      if(any){
        tvPicker('대체 TV');
        action('연결하고 재생',()=>startMovie('repair'),true).disabled=!available(bindings['tv-on']);
      }else if(sample)action('체험용 TV 관리',manageTVs,true);
      action('취소',()=>setPanel('idle'));return;
    }
    if(panel==='devices'){
      show('체험용 TV 관리','등록을 해제하면 해당 TV는 루틴의 연결 목록에서 빠집니다.');
      for(const d of tvCatalog()){
        const key=model.demoModels[d.id==='my-tv-1'?'tvset':'standbyme'];
        if(!owned(key).some(unit=>unit.camera))deviceAction(d);
      }
      action('완료',()=>setPanel('idle'),true);return;
    }
    if(my&&model.homeSource==='unavailable'){
      show('마이룸','ThinQ 등록 목록을 불러오지 못했어요. 연결 설정을 확인해 주세요.');
      action('목록 다시 불러오기',()=>location.reload());return;
    }
    if(panel==='repairStep'){renderStepRepair();return}
    if(panel==='routineSetup'){
      show((recipe||model.movieTemplate).name+' 연결','체험용 기기를 준비한 뒤 이 루틴에 쓸 가전을 선택하세요.');
      action('체험용 기기 사용',prepare,true);
      action('방 둘러보기',()=>setPanel('idle'));return;
    }
    if(panel==='setup'||(panel==='idle'&&my&&!hasHome())){
      show('마이룸','등록 가전에서 내 가전을 추가하거나 체험용 기기로 방을 둘러보세요.');
      action('체험용 기기 사용',prepare,true);
      if(sample&&!hasHome())action('조명 한 대로 체험',prepareLightHome);
      action('다른 가전 루틴',()=>setPanel('recipeList'));return;
    }
    if(panel==='playing'){
      const light=!!playback.bindings['light-dim'];
      show('영화 보기 재생 중',(my?nameOf(playback.bindings['tv-on']):'TV')+' 재생 · '+(light?'조명 30%':'조명 제외')+(my?' · 커튼 제외':' · 커튼 닫힘')+' · 실제 가전은 작동하지 않아요');
      if(!still())action('연출 건너뛰기',()=>{skipped=true;walking=false;render();draw()});
      action('재생 종료',()=>closeMovie());
      if(my){action(saveLabel(previousPanel==='connect'?movieFurniture:null),storeRoutine,true);action('연결 설정',()=>closeMovie('connect'))}
      else action('내 방에 맞추기',()=>location.assign(route('my',true)),true);
      return;
    }
    if(panel==='connect'){
      const missing=model.registeredTVs().length?'등록된 TV가 전원 켜기를 지원하지 않아요.':'연결할 TV가 없어요.';
      show('영화 보기 연결',(liveTVs().length?'TV 필수':'TV 필수 · '+missing)+' · 조명 선택 · 커튼은 연결할 기기 없음');
      tvPicker('재생할 TV');
      if(sample&&model.state.myFixtureId!=='sample-light-v1'&&!liveTVs().length)action('체험용 TV 관리',manageTVs);
      for(const a of model.actions.filter(a=>a.kind==='light')){
        const lights=model.candidates(a);
        for(const device of lights){
          const r=placedRoom(device.id);
          if(!r){action(device.name+' 방에 놓기',()=>placeForMovie(device,a.actionId));continue}
          const on=bindings[a.actionId]===device.id;
          const b=action((on?'✓ ':'＋ ')+(lights.length>1?device.name+' ':'')+'조명 30%',()=>{
            if(on)delete bindings[a.actionId];else bindings[a.actionId]=device.id;render();
          });b.setAttribute('aria-pressed',String(on));b.disabled=r!==room();
        }
      }
      action('미리보기',()=>startMovie(),true).disabled=!available(bindings['tv-on']);
      action('다른 가전 루틴',()=>setPanel('recipeList'));action('여러 루틴 설정',openBatch);
      action('루틴 만들기',()=>openComposer());action('방 둘러보기',()=>setPanel('idle'));return;
    }
    if(panel==='furniture'){renderFurniture();return}
    if(panel==='product'){
      const item=target,k=item.k;
      const product=M.products[k];
      if(product.modelCode){
        const category=product.catalogFamily||(product.washerStyle?'세탁기':'가전');
        show(product.salesName||category);
        if(!product.salesName)ProductCatalog.loadSalesName(product,category).then(name=>{
          if(name&&panel==='product'&&target===item&&!editMode)show(name);
        });
      }else show(my&&isTV(item)&&item.deviceId?nameOf(item.deviceId):product.n);
      if(isTV(item)){
        if(!friend){
          const button=action('영화 보기',()=>startMovie(),true);
          if(!my)observeOffer(button,item);
          action(poweredTV===item?'TV 끄기':'TV 켜기',()=>{
            poweredTV=poweredTV===item?null:item;setPanel('product');
          });
          if(my)action('연결 설정',connect);
        }
      }else if(k==='floor_lamp'){
        if(!friend)action(lampOn?'조명 끄기':'조명 켜기',()=>{lampOn=!lampOn;setPanel('product')});
      }else{
        const t=recipeFor(k);
        if(t&&!compareWashers)action(t.name,()=>openRecipe(t,item),true);
      }
      action('닫기',()=>tap(null));return;
    }
    if(space==='dream'&&panel==='idle'&&showDreamSuggestion())return;
    if(space==='dream'&&room()==='C'&&list().some(o=>o.exhibit)){
      show('C 현관 투존 · 가전 전시','제품을 눌러 살펴보거나 배치 편집에서 돌려 보세요.');return;
    }
    if(space==='dream'&&panel==='idle'&&!model.state.collection.length){$('living').hidden=true;return}
    show(my?'마이룸':'드림룸',list().some(o=>isTV(o)&&visible(o))?'방 안의 TV를 눌러 보세요.':
      list().some(o=>visible(o)&&recipeFor(o.k))?'방 안의 가전을 눌러 루틴을 확인해 보세요.':
      my?'배치 편집에서 등록 가전을 놓아 보세요.':'가전을 촬영하거나 인벤토리에서 골라 방에 놓아 보세요.');
  }
  async function enter(){
    const account=$('account-data');
    if(!readOnly&&params.get('homePreview')!=='1'){
      const user=account&&JSON.parse(account.textContent).user;
      $('personalRoomName').textContent=user?user.nickname+'의 미니룸':'내 미니룸';
      $('roomHomeLink').href='/miniroom/home?space='+space;
      $('roomNotesLink').href=user?'/members?'+new URLSearchParams({visit:user.id,space})+'#guestbook':'/members';
      $('sideInventory').onclick=()=>openBag();
      if(user)fetch('/api/members/wallet').then(r=>r.ok?r.json():null).then(w=>{
        if(!w)return;
        $('roomLevel').textContent='LV.'+w.level;$('roomPoints').textContent=w.points;$('roomPoints').setAttribute('aria-label',w.points+' 포인트');
        $('roomXp').value=w.level>=99?10:w.xp%10;$('roomXpText').textContent=w.level>=99?'MAX':w.xp%10+'/10';
      }).catch(()=>{});
    }
    $('washerComparison').hidden=compareWashers;
    if(menu){$('view').tabIndex=-1;$('view').setAttribute('aria-label','드림룸 미리보기')}
    if(friend)$('view').setAttribute('aria-label',compareWashers?'세탁기 비교. 제품을 탭하거나 방향키로 선택하고 Enter로 모델 정보를 확인하세요.':'예시 친구 방. 소파를 누르거나 방향키로 선택한 뒤 Enter로 루틴을 열 수 있어요.');
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
    $('routineBagButton').onclick=()=>openBag();
    $('scanDream').onclick=my?()=>location.assign(inventoryUrl('dream',{homeAction:'scan'})):openScanner;
    $('bagGroupBack').onclick=()=>navigateBag(bagFilter,'');
    $('routineBag').addEventListener('cancel',event=>{
      if(!bagGroup)return;
      event.preventDefault();navigateBag(bagFilter,'');
    });
    for(const b of $('bagFilters').querySelectorAll('button'))b.onclick=()=>navigateBag(b.dataset.bag,bagGroups.get(b.dataset.bag)||'');
    $('editMode').onclick=toggleEdit;$('manageTVs').onclick=manageTVs;$('libraryButton').onclick=openLibrary;
    window.addEventListener('storage',e=>{
      if($('routineBag').open&&e.key?.startsWith(model.discoveryPrefix)){refreshBagRoutines();return}
      const suffix=sample?'':'.'+model.homeSource;
      if(!friend&&(e.key==='lg-miniroom.state'+suffix||e.key===(my?'lg-miniroom.dot.my'+suffix:'dotroom')||e.key===null))location.reload();
    });
    if(my&&(params.has('inventoryConnect')||params.has('connect'))){
      // Older movie links omit the template. A named routine must resolve to its own template.
      const id=params.get('inventoryConnect')??params.get('template')??model.movieTemplate.id;
      const requested=batchTemplates.find(t=>t.id===id);
      if(requested)openMyRoutine(requested);
      else{clearConnectLink();notice('가져온 루틴을 찾을 수 없어요. 마이룸에서 다시 선택해 주세요.')}
    }
    if(history.state?.dotMovie)history.replaceState(null,'');
    if(my&&model.singleDeviceRules.some(r=>r.operation===params.get('suggestion'))){
      const url=new URL(location.href);url.searchParams.delete('suggestion');history.replaceState(history.state,'',url);
      setPanel('suggestionMatch');
    }
    if(my&&params.has('friendImport'))void loadFriendCopy(params.get('friendImport'));
    if(my&&params.has('inventoryRun')){
      const id=params.get('inventoryRun'),url=new URL(location.href);
      url.searchParams.delete('inventoryRun');history.replaceState(history.state,'',url);
      const record=model.state.savedRoutines.find(r=>r.custom&&r.templateId===id);
      if(record&&hasHome()){returnToBag=customReady(record);runCustom(record,'idle')}
      else{openBag();notice('이 계정에서 저장한 루틴을 확인해 주세요.')}
    }
    if(!readOnly&&params.has('homeAction')){
      const action=params.get('homeAction'),key=params.get('product');
      const clean=new URL(location.href);clean.searchParams.delete('homeAction');clean.searchParams.delete('product');history.replaceState(history.state,'',clean);
      if(action==='scan')void openScanner();
      if(action==='registered'&&my)openLibrary();
      if(action==='products'){
        const item=key&&M.products[key];openBag('appliance',item?bagFamily(item):'',item?.k);
      }
    }
    if(!readOnly&&params.get('inventory')==='1'){
      const url=new URL(location.href);url.searchParams.delete('inventory');history.replaceState(history.state,'',url);
      openBag();
    }
    if((my&&(params.has('modelCode')||params.get('camera')==='register'))||(space==='dream'&&params.get('camera')==='collect')){
      if(my)openLibrary();
      else{
        $('libraryBrowse').hidden=true;$('catalogBrowse').hidden=true;$('collectionResult').hidden=true;
        $('library').showModal();
      }
      try{
        const record=model.readCameraResult(params);
        if(!record){
          if(my)$('libraryStatus').textContent='촬영을 취소했어요.';
          else{$('library').close();notice('촬영을 취소했어요.')}
        }
        else{
          const response=await fetch('/api/catalog/scan?'+new URLSearchParams({code:record.modelCode}),{signal:AbortSignal.timeout(8000)});
          if(!response.ok)throw Error('제품 DB에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.');
          const result=await response.json();
          if(result.status!=='collectible')throw Error(record.modelCode+'에 일치하는 수집 모델이 없어요. 제품 본체의 단품 모델 라벨을 확인해 주세요.');
          const exact=ProductCatalog.matchModel(result.category,result.model);
          if(!exact)throw Error('이 제품은 아직 방에 등록할 수 없어요.');
          const unit={id:exact,modelCode:result.model,category:result.category,
            displayName:result.displayName||ProductCatalog.productTitle(exact,result.model),imageUrl:''};
          if(my){
            const message=model.registerFromCamera(unit);
            inventory();render();openLibrary();$('libraryStatus').textContent=message;
          }else showScanChoice(unit);
        }
      }catch(error){
        if(my)$('libraryStatus').textContent=error.message;
        else{$('library').close();notice(error.message)}
      }
      finally{
        const clean=new URL(location.href);
        for(const field of [...clean.searchParams.keys()]){
          if(!['space','app','observe','room'].includes(field))clean.searchParams.delete(field);
        }
        history.replaceState(history.state,'',clean);
      }
    }
    if(samplePreview)startSamplePreview();
    if(model.storageMessage)notice(model.storageMessage);
    window.addEventListener('pageshow',e=>{if(e.persisted)location.reload()});
  }
  const interactive=o=>!menu&&(isAppliance(o.k)||o.k==='sofa'||(my&&isFurniture(o)));
  return {enter,registeredReplacement,visible,allowed,owned,unitSummary,isAppliance,bindUnit,interactive,restoreDeviceIds,identifyDevices,placementClue,editing:()=>editMode,frame,tap,canAdd,reset};
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
