import {paint,captureRoom,furnitureThumbnail,focusObject,furniturePose,placementIssue,setDragHandlers,previewDrag} from './room.js';
import {model,state,update,actions,candidates,routine,storageMessage,observing,logObservation,exportObservation} from './state.js';
const $=s=>document.querySelector(s);
const rooms={menu:'메뉴',dream:'드림룸',my:'마이룸',example:'예시 친구 방'};
const labels={'tv-on':'TV 켜기','light-dim':'조명 밝기 30%','curtain-close':'커튼 닫기'};
const reasons={no_device:'연결할 기기 없음',unselected:'기기를 선택하지 않음',skipped:'사용자가 제외함',unsupported:'지원하지 않는 동작'};
const roomFromURL=()=>Object.hasOwn(rooms,location.hash.slice(1))?location.hash.slice(1):'menu';
function fresh(room){return {room,view:'',watch:false,source:room==='example'?'example_room':'collection',bindings:{}};}
const itemNames={tv:'TV와 TV장',sofa:'소파',lamp:'스탠드 조명',bed:'침대',table:'원형 테이블'};
let draft=null,drag=null,category='전체',shelfCollapsed=false;
const phoneShelf=matchMedia('(orientation: portrait) and (max-width: 760px)');
const desktopShelf=matchMedia('(min-width:981px) and (min-height:510px)');
const editHistory={dream:[],my:[]};
const categories={전체:Object.keys(itemNames),가전:['tv','lamp'],가구:['sofa','bed','table']};
function finishForRoom(){return state.finishes?.[ui.room]||'rose';}
// Undo only placement fields. Collection, device registration and routines have their own lifetimes.
function rememberPlacement(change){
 const room=ui.room;
 const snapshot={items:{...roomItems()},poses:structuredClone(layoutForRoom()),
  slots:{...(room==='my'?state.myLayout:state.dreamLayout)}};
 update(change);
 const history=editHistory[room];
 history.push(snapshot);if(history.length>30)history.shift();
}
function undoPlacement(){
 const history=editHistory[ui.room],last=history?.at(-1);
 if(!last||drag||draft||ui.view!=='layout')return;
 update(s=>{
  s.roomItems[ui.room]=last.items;s.placements??={};s.placements[ui.room]=last.poses;
  if(ui.room==='my')s.myLayout=last.slots;else s.dreamLayout=last.slots;
 });
 history.pop();render();notify('이전 배치로 되돌렸어요');
}
let ui=fresh(roomFromURL()), previewRecord=null, offerKey='', observer,returnFocus=null;
function log(event){logObservation(event,ui.room,ui.source)}
function sync(push=false){history[push?'pushState':'replaceState'](ui,'','#'+ui.room);}
function roomTo(room,extra={}){
  if(room==='dream'||room==='my'){
    const url=new URL('/editor',location.href);url.searchParams.set('space',room);
    if(extra.view)url.searchParams.set('connect','1');
    if(extra.source)url.searchParams.set('source',extra.source);
    if(new URLSearchParams(location.search).get('observe')==='1')url.searchParams.set('observe','1');
    location.assign(url);return;
  }
  drag=null;draft=null;ui={...fresh(room),...extra};sync(true);render();}
function openView(view,extra={},push=false){
  if(!ui.view) returnFocus=document.activeElement;
  ui={...ui,view,...(!view?{watch:false,editorOpen:false}:{}),...extra};sync(push);render();
  if(view==='connect') $('.spot.tv').focus({preventScroll:true});
  else if(view==='catalog')$('#shelf-title').focus({preventScroll:true});
  else if(view==='layout') $('canvas').focus({preventScroll:true});
  else if(view) $('#object-title').focus({preventScroll:true});
  else if(returnFocus?.isConnected&&!returnFocus.hidden) returnFocus.focus({preventScroll:true});
}
window.addEventListener('popstate',e=>{
  drag=null;draft=null;
  ui=e.state?.room===roomFromURL()?e.state:fresh(roomFromURL());
  if(ui.view==='preview' && ui.room==='my'){try{previewRecord=routine(ui.bindings);}catch{ui.view='connect';}}
  render();
});
const button=(act,text,primary=false,disabled=false)=>'<button data-act="'+act+'" class="'+(primary?'primary':'')+'" '+(disabled?'disabled':'')+'>'+text+'</button>';
// Manual switches belong to a room for this session. Playback overlays them temporarily.
const power={dream:{tv:false,lamp:false},my:{tv:false,lamp:false}};
function switchProduct(id,enabled){
  if(!roomItems()[id]||!power[ui.room])return;
  const switches=power[ui.room];
  switches[id]=enabled??!switches[id];
  openView(id==='tv'?'product':'lamp',{watch:id==='tv'&&switches.tv,editorOpen:false});
}
const saved=()=>state.savedRoutines.find(r=>r.templateId==='movie-night' && r.anchorId==='sofa');
function summary(record){
  return '<ul>'+actions.map(a=>{
    const id=a.actionId,device=candidates(a).find(d=>d.id===record.bindings[id]);
    const detail=device?.name || (record.bindings[id]?'다시 연결 필요':reasons[record.exclusions[id]]||'제외');
    return '<li>'+labels[id]+' · '+detail+'</li>';
  }).join('')+'</ul>';
}
function contents(){
  switch(ui.view){

    case 'collect-tv':return ['미니룸 TV','예시 TV를 수집하면 방에 놓을 수 있어요.',button('collect','TV 수집하고 배치',true)];
    case 'lamp':{
      const on=power[ui.room].lamp;
      return ['스탠드 조명',on?'불이 켜져 있어요.':'불이 꺼져 있어요.',button('lamp-power',on?'조명 끄기':'조명 켜기',true)];
    }
    case 'product':{
      const on=power[ui.room].tv;
      return ['미니룸 TV',on?'TV가 켜져 있어요.':'TV가 꺼져 있어요.',button('movie','영화 보기',true)+button('tv-power',on?'TV 끄기':'TV 켜기')+
        (ui.room==='dream'?(roomItems().sofa?'':button('add-sofa','소파 놓기'))+button('remove','방에서 빼기'):'')];
    }
    case 'movie':return ['영화 보기','TV 켜기 · 조명 30% · 커튼 닫기',button('preview','미리보기')+button('adapt','내 방에 맞추기',true)];
    case 'setup':return ['내 방에 맞추기','가상 TV와 조명, 루틴을 저장할 소파를 방에 놓습니다.',button('setup','체험용 기기 사용',true)];
    case 'preview':{
      const my=ui.room==='my';
      const detail=my?summary(previewRecord):'<p>TV 재생 중 · 조명 30% · 커튼 닫힘</p>';
      const next=my?(ui.playFrom==='connect'?button('save','소파에 저장',true):button('edit-playing','연결 설정')):button('adapt','내 방에 맞추기');
      return ['영화 보기 재생 중',detail+'<small>실제 가전은 작동하지 않아요</small>',button('endpreview','재생 종료')+next];
    }
    case 'replace':return ['소파의 루틴을 갱신할까요?',summary(previewRecord),button('close','취소')+button('confirm','갱신하기',true)];
    case 'saved':return ['저장한 영화 보기',summary(saved()),button('movie','영화 보기',true)+button('edit','연결 수정')];
    case 'sofa':return ['소파','마이룸에 저장한 루틴을 여기서 열 수 있어요.',''];
    default:return ['','',''];
  }
}
function observeOffer(target){
  observer?.disconnect();
  if(!target){offerKey='';return;}
  const key=ui.room+':'+ui.source;
  if(offerKey===key) return;
  observer=new IntersectionObserver(entries=>{
    if(entries.some(e=>e.isIntersecting) && document.visibilityState==='visible' && target.isConnected){
      offerKey=key;log('routine_offered');observer.disconnect();
    }
  });observer.observe(target);
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible') render();});
function layoutForRoom(){
  if(ui.room==='menu'||ui.room==='example')return Object.fromEntries(Object.keys(firstPositions).map(id=>[id,initialPose({},id)]));
  return state.placements?.[ui.room]||{};
}
function roomItems(room=ui.room){
  if(room==='example')return {tv:true,sofa:true,lamp:true};
  const my=room==='my',tv=my?!!state.myLayout['tv-slot']:room==='dream'&&state.dreamLayout['tv-slot']===model;
  const existing=state.roomItems?.[room];
  return {...(existing||{sofa:my&&(tv||!!saved()),lamp:my&&!!state.myFixtureId}),tv};
}
// New rooms use the window wall for viewing and the foreground for seating.
const firstPositions={tv:[0,-2.20],lamp:[3.55,-1.88],sofa:[0,1.72],table:[1.7,.1],bed:[-4.30,1.1]};
function initialPose(layout,id){
 if(layout[id])return furniturePose(layout,id);
 const [x,z]=firstPositions[id];
 return {x,z,angle:id==='sofa'?180:0};
}
function chooseStart(layout,id,items){
  const pose=initialPose(layout,id);
  if(!placementIssue(layout,id,pose,items))return pose;
  const options=[];
  for(let x=-5.5;x<=5.5;x+=.5)for(let z=-3;z<=3;z+=.5)options.push({x,z,angle:pose.angle});
  options.sort((a,b)=>Math.hypot(a.x-pose.x,a.z-pose.z)-Math.hypot(b.x-pose.x,b.z-pose.z));
  return options.find(p=>!placementIssue(layout,id,p,items))||pose;
}
function picker(){
  const items=roomItems();
  const tabs=Object.keys(categories).map(k=>'<button data-category="'+k+'" aria-pressed="'+(category===k)+'">'+k+'</button>').join('');
  const themes=[['rose','핑크'],['sage','연두']].map(([k,label])=>'<button data-finish="'+k+'" aria-label="'+label+' 테마" aria-pressed="'+(finishForRoom()===k)+'"><i></i>'+label+'</button>').join('');
  const cards=categories[category].map(id=>{
    const needsSetup=ui.room==='my'&&!state.myFixtureId&&['tv','lamp'].includes(id);
    const detail=items[id]?'배치됨':state.roomItems?.[ui.room]?.[id]===false?'수납됨':needsSetup?'체험용 기기':id==='tv'&&ui.room==='dream'&&!state.collection.includes(model)?'수집 후 배치':'배치 가능';
    return '<button data-pick="'+id+'"><img src="'+furnitureThumbnail(id)+'" alt="" draggable="false"><b>'+itemNames[id]+'</b><small>'+detail+'</small></button>';
  });
  return '<div class="inventory-tools"><div class="filters" role="group" aria-label="가구 종류">'+tabs+'</div><div class="finishes" role="group" aria-label="방 색상">'+themes+'</div></div><div class="items">'+cards.join('')+'</div>';

}
function storeItem(id){
  const items=roomItems();
  if(!items[id])return;
  rememberPlacement(s=>{
    s.roomItems??={};s.roomItems[ui.room]={...items,[id]:false};
    if(id==='tv'&&ui.room==='dream')delete s.dreamLayout['tv-slot'];
    if(ui.room==='my'&&['tv','lamp'].includes(id))delete s.myLayout[id==='tv'?'tv-slot':'light-slot'];
  });
  if(id==='tv'||id==='lamp')power[ui.room][id]=false;
  draft=null;render();
}
function setupDevices(){
  const items=roomItems(),layout={...layoutForRoom()};
  for(const id of ['tv','lamp','sofa']){
    if(!items[id]){
      layout[id]=chooseStart(layout,id,items);
      if(placementIssue(layout,id,layout[id],items))throw Error('가구를 옮겨 체험용 기기 자리를 마련해 주세요.');
      items[id]=true;
    }
  }
  update(s=>{
    s.myFixtureId='sample-home-v1';s.myLayout={'tv-slot':'my-tv-1','light-slot':'my-light-1'};
    s.placements??={};s.placements.my=layout;s.roomItems??={};s.roomItems.my=items;
  });
  editHistory.my.length=0;
}
function beginPlacement(id,install=false){
  $('#message').textContent='';
  draft={id,pose:install?chooseStart(layoutForRoom(),id,roomItems()):furniturePose(layoutForRoom(),id),install};
  if(ui.view!=='layout')openView('layout',{watch:false},true);
  else render();
  $('canvas').focus({preventScroll:true});
}
function finishPlacement(collectOnDrop=false){
  if(!draft||ui.view!=='layout'||!['dream','my'].includes(ui.room))return;
  const {id,pose,install}=draft;
  const issue=placementIssue(layoutForRoom(),id,pose,roomItems());
  if(issue){notify(issue);return;}
  const newlyCollected=collectOnDrop&&id==='tv'&&ui.room==='dream'&&!state.collection.includes(model);
  rememberPlacement(s=>{
    const items=roomItems();
    if(newlyCollected)s.collection.push(model);
    if(install&&id==='tv'&&ui.room==='dream'){
      if(ui.room!=='dream'||!s.collection.includes(model))throw Error('먼저 TV를 수집해 주세요.');
      s.dreamLayout['tv-slot']=model;
    }
    if(install&&ui.room==='my'&&['tv','lamp'].includes(id)){
      if(!s.myFixtureId)throw Error('체험용 기기를 먼저 준비해 주세요.');
      if(id==='tv')s.myLayout['tv-slot']='my-tv-1';else s.myLayout['light-slot']='my-light-1';
    }
    s.roomItems??={};s.roomItems[ui.room]={...items,[id]:true};
    s.placements??={};s.placements[ui.room]??={};s.placements[ui.room][id]={...pose};
  });
  if(newlyCollected)log('collection_added');
  draft=null;render();notify(itemNames[id]+' 배치를 저장했어요');
}
function overStorage(e){
 const zone=$('#storage-zone');if(zone.hidden)return false;
 const r=zone.getBoundingClientRect();
 return e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;
}
function resetDrag(){
 if(!drag)return;
 const previous=drag;drag=null;ui=previous.ui;draft=previous.draft;render();
}
function updateGrab(point,e){
 if(!drag)return '';
 draft.pose={...draft.pose,x:point.x,z:point.z};
 const store=overStorage(e),target=document.elementFromPoint(e.clientX,e.clientY);
 const outside=!target||!!target.closest('header,.room-tools,footer,#context,#inventory');
 const issue=outside?'방 안에 놓으세요':placementIssue(layoutForRoom(),draft.id,draft.pose,roomItems());
 $('#storage-zone').classList.toggle('over',store);
 previewDrag(draft.id,draft.pose,issue);
 const status=$('.placement-label');
 status.classList.toggle('invalid',!!issue&&!store);
 status.textContent=store?'손을 떼면 수납합니다':issue||'손을 떼면 배치합니다';
 return issue;
}
setDragHandlers({
 begin(id,catalog){
  if(!['dream','my'].includes(ui.room)||!['','catalog','layout'].includes(ui.view))return false;
  if(catalog&&ui.room==='my'&&!state.myFixtureId&&['tv','lamp'].includes(id)){
   openView('setup');return false;
  }
  drag={ui,draft,catalog};
  const pose=draft?.id===id?draft.pose:roomItems()[id]?furniturePose(layoutForRoom(),id):initialPose(layoutForRoom(),id);
  draft={id,pose:{...pose},install:!roomItems()[id]};
  ui={...ui,view:'layout',watch:false};render();return true;
 },
 move:updateGrab,
 drop(point,e){
  if(!drag)return;
  const issue=updateGrab(point,e),previous=drag;
  if(!overStorage(e)&&issue){resetDrag();notify(issue+' · 배치를 되돌렸어요');return;}
  try{
   if(overStorage(e)){storeItem(draft.id);notify('수납했어요 · 가구 추가에서 다시 놓을 수 있어요');}
   else finishPlacement(previous.catalog);
  }catch(error){resetDrag();notify(error.message||'저장할 수 없어요');return;}
  drag=null;draft=null;
  ui=previous.ui.view==='catalog'||previous.draft?{...previous.ui,view:previous.ui.editorOpen?'layout':'',watch:false}:previous.ui;
  sync();render();
 },
 cancel:resetDrag
});
$('.stage').addEventListener('place-cell',e=>{
  if(!draft||ui.view!=='layout')return;
  const {x,z}=e.detail;
  // Keep taps on the backdrop from sending the model off-screen.
  if(Math.abs(x)>6||Math.abs(z)>3.5){notify('방 안쪽 칸을 선택하세요');return;}
  draft.pose={...draft.pose,x,z};render();
});
function render(){
  $('.stage').dataset.finish=finishForRoom();
  const {room,view}=ui,menu=room==='menu',my=room==='my',friend=room==='example';
  const items=roomItems(),placed=!!items.tv;
  const editing=view==='layout', placing=editing&&!!draft;
  const issue=placing?placementIssue(layoutForRoom(),draft.id,draft.pose,roomItems()):'';
  const preview=view==='preview';
  const binding=my&&view==='connect';
  $('.stage').toggleAttribute('data-dragging',!!drag);
  const docked=desktopShelf.matches&&!menu&&!friend&&!shelfCollapsed;
  const phoneTray=phoneShelf.matches&&!shelfCollapsed&&!menu&&!friend&&!placing&&!drag&&(!view||editing);
  const shelf=$('#inventory'),showShelf=docked||phoneTray||view==='catalog';
  $('.stage').toggleAttribute('data-phone-tray',phoneTray||phoneShelf.matches&&view==='catalog');
  $('.stage').toggleAttribute('data-docked',docked);
  $('.stage').toggleAttribute('data-inventory',view==='catalog');
  shelf.hidden=!showShelf;
  shelf.inert=showShelf&&(!!drag||placing||!!view&&!editing&&view!=='catalog');
  if(showShelf)$('#shelf-items').innerHTML=picker();
  $('.stage').toggleAttribute('data-playing',preview);
  $('#undo-layout').hidden=!editing||placing;
  $('#room-photo').hidden=menu||!!view;
  $('#undo-layout').disabled=!editHistory[room]?.length;
  $('#storage-zone').hidden=!drag||draft?.install;
  $('h1').textContent=menu?'LG 미니룸':rooms[room];
  $('nav').innerHTML=menu?'':['dream','my','example'].map(k=>'<button data-room="'+k+'" aria-current="'+(room===k)+'">'+rooms[k]+'</button>').join('');
  $('#enter').hidden=!menu;
  $('#dot-editor-link').hidden=!menu;
  const tv=$('.spot.tv'),sofa=$('.spot.sofa'),lamp=$('.spot.lamp');
  const browseProducts=(!view||view==='product'||view==='lamp')&&!menu&&!friend;
  tv.hidden=!(binding||(browseProducts&&placed));
  lamp.hidden=!(binding||(browseProducts&&items.lamp));
  sofa.hidden=!items.sofa||menu||!!view;
  const tvLabel=binding?(ui.bindings['tv-on']?'✓ TV 켜기':'＋ TV 켜기 · 필수'):placed&&!my&&!view?'이 TV로 해볼 수 있는 루틴':'';
  tv.querySelector('span').textContent=tvLabel;
  tv.classList.toggle('routine-clue',!!tvLabel&&!binding&&!view);
  tv.setAttribute('aria-label',binding?'TV 켜기 연결':placed?'배치된 미니룸 TV':'빈 TV 자리');
  for(const [el,id] of [[tv,'tv-on'],[lamp,'light-dim']]){
    if(binding)el.setAttribute('aria-pressed',!!ui.bindings[id]);else el.removeAttribute('aria-pressed');
    el.classList.toggle('bound',binding&&!!ui.bindings[id]);
  }
  lamp.querySelector('span').textContent=binding?(ui.bindings['light-dim']?'✓ 조명 30%':'＋ 조명 30% · 선택'):'';
  sofa.querySelector('span').textContent=!view&&(friend||(my&&saved()))?'영화 보기':'';
  const hint=$('#hint');hint.textContent='';
  if(binding)hint.innerHTML='가전을 눌러 연결 · 커튼은 연결할 기기 없음 '+button('preview','미리보기',true,!ui.bindings['tv-on']);
  else if(!view){
    if(menu)hint.textContent='예시 방 미리보기';
    else if(friend)hint.textContent='소파를 눌러 루틴을 만나보세요';
    else if(my&&!state.myFixtureId)hint.innerHTML=button('prepare','체험용 기기 사용');
    else if(my&&saved()&&!items.sofa)hint.innerHTML=button('add-sofa','루틴 소파 다시 놓기');
    else if(my)hint.textContent=saved()?'소파에 저장한 루틴이 있어요':'드림룸 TV에서 루틴을 가져오세요';
    else hint.textContent=placed?'TV를 눌러 시청하기':(docked||phoneTray)?'인벤토리에서 가구를 끌어 놓으세요':'가구 추가에서 시작하세요';
  }
  $('#layout-toggle').hidden=menu||friend||!!view&&!editing;
  $('#layout-toggle').textContent=editing?'편집 종료':'배치 편집';
  $('#layout-toggle').setAttribute('aria-pressed',editing);
  $('#catalog').hidden=menu||friend||placing||docked||phoneTray||!!view&&!editing;
  $('.stage').toggleAttribute('data-placing',placing);
  $('#placement').hidden=!placing;
  for(const b of document.querySelectorAll('[data-furniture]'))b.hidden=!editing||placing||!items[b.dataset.furniture];
  if(editing){
    tv.hidden=placing||!placed;
    sofa.hidden=placing||!items.sofa;lamp.hidden=placing||!items.lamp;
    tv.querySelector('span').textContent=placed?'TV':'TV 배치';
    sofa.querySelector('span').textContent='소파';
    lamp.querySelector('span').textContent='조명';
    tv.setAttribute('aria-label','TV 배치 편집');
    sofa.setAttribute('aria-label','소파 배치 편집');lamp.setAttribute('aria-label','조명 배치 편집');
    hint.textContent=Object.values(items).some(Boolean)?'가구를 끌어 옮기세요':(docked||phoneTray)?'인벤토리에서 가구를 끌어 놓으세요':'가구 추가에서 시작하세요';
    if(placing){
      const status=$('.placement-label');
      status.textContent=itemNames[draft.id]+' · '+(issue||'끌어서 놓기');
      const degrees=Math.round(draft.pose.angle)%360;
      $('#angle-range').value=degrees;
      if(document.activeElement!==$('#angle-input'))$('#angle-input').value=degrees;
      status.classList.toggle('invalid',!!issue);
      $('[data-act=apply]').disabled=!!issue;
      $('[data-act=store]').hidden=draft.install;
      const tryButton=$('[data-act=try-product]');
      const original=furniturePose(layoutForRoom(),draft.id);
      const changed=['x','z','angle'].some(key=>original[key]!==draft.pose[key]);
      tryButton.hidden=draft.install||!['tv','lamp'].includes(draft.id)||changed;
      tryButton.textContent=draft.id==='tv'?'TV 보기':'조명 켜기';
    }
  }else{
    sofa.setAttribute('aria-label','소파');lamp.setAttribute('aria-label',binding?'조명 연결':power[room]?.lamp?'스탠드 조명 끄기':'스탠드 조명 켜기');
  }
  const [title,body,footer]=contents(),note=$('#context');

  note.classList.toggle('playback',preview);
  note.hidden=!view||binding||editing||view==='catalog';$('#object-title').textContent=title;$('#content').innerHTML=body;$('.actions').innerHTML=footer;
  focusObject(view==='lamp'?'lamp':view==='product'?'tv':friend||my||view==='sofa'?'sofa':'tv');
  const manual=power[room]||{};
  const dim=preview&&(!my||!!previewRecord?.bindings['light-dim']);
  const shownItems=binding||preview?{
    ...items,tv:true,lamp:!my||binding||!!previewRecord?.bindings['light-dim']||items.lamp
  }:items;
  paint({
    theme:finishForRoom(),allowDrag:!menu&&!friend&&(!view||editing),layout:layoutForRoom(),
    editing,draft:placing?draft:null,issue,items:menu?{...roomItems('example'),bed:true,table:true}:shownItems,
    lampLevel:dim?0.3:Number(!!(manual.lamp&&items.lamp)),on:preview||!!manual.tv,
    movie:preview,dim,curtains:preview&&!my,visitLamp:view==='lamp'&&manual.lamp,
    watch:(view==='product'&&manual.tv)||preview,animate:view==='product'||view==='lamp'||preview
  });
  observeOffer(!view?(friend?sofa.querySelector('span'):room==='dream'&&placed?tv.querySelector('span'):null):null);
}
function setAngle(e){
 if(!draft||drag)return;
 const field=e.target;
 if(field.value===''||!field.validity.valid)return;
 const value=Number(field.value);
 if(!Number.isInteger(value)||value<0||value>359)return;
 draft.pose.angle=value;
 $('#angle-range').value=value;$('#angle-input').value=value;render();
}
$('#angle-range').addEventListener('input',setAngle);
$('#angle-input').addEventListener('input',setAngle);
$('#angle-input').addEventListener('blur',()=>{if(draft)$('#angle-input').value=Math.round(draft.pose.angle)%360;});
function bind(id){
  const match=candidates(actions.find(a=>a.actionId===id))[0];if(!match)return;
  if(ui.bindings[id]===match.id)delete ui.bindings[id];else ui.bindings[id]=match.id;
  sync();render();
}
function notify(text){$('#message').textContent=text;clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('#message').textContent='',3000);}
function playMovie(from){
  let bindings={};
  if(ui.room==='my'){
    if(from==='connect')bindings=ui.bindings;
    else if(saved())bindings=saved().bindings;
    else{
      // First play uses the registered products placed in this room, without saving a routine.
      bindings={'tv-on':state.myLayout['tv-slot'],'light-dim':state.myLayout['light-slot']};
    }
    try{previewRecord=routine(bindings);}
    catch(error){openView('connect',{bindings:{...bindings},watch:false});notify(error.message);return;}
    bindings=previewRecord.bindings;
  }
  if(from==='product')log('routine_opened');
  openView('preview',{playFrom:from,bindings:{...bindings}},true);log('preview_opened');
}
function endMovie(){
  const origin=ui.playFrom||(ui.room==='my'?'connect':'movie');
  openView(origin==='sofa'?'saved':origin);
}
function save(){
  const verified=routine(ui.bindings);
  if(JSON.stringify(verified)!==JSON.stringify(previewRecord)){previewRecord=verified;openView('preview');return;}
  update(s=>{s.savedRoutines=s.savedRoutines.filter(r=>r.templateId!=='movie-night'||r.anchorId!=='sofa');s.savedRoutines.push(verified);});
  log('routine_saved');openView('');notify('소파에 저장했어요');
}
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.room){roomTo(b.dataset.room);return;}
  try{
    if(b.closest('#inventory')&&(b.dataset.category||b.dataset.finish)){
      if(b.dataset.category)category=b.dataset.category;
      else update(s=>{s.finishes??={};s.finishes[ui.room]=b.dataset.finish;});
      render();
      const attr=b.dataset.category?'category':'finish';
      document.querySelector('[data-'+attr+'="'+b.dataset[attr]+'"]').focus({preventScroll:true});return;
    }
    if(b.dataset.pick&&b.closest('#inventory')){
      const id=b.dataset.pick;
      if(ui.room==='my'&&!state.myFixtureId&&['tv','lamp'].includes(id)){openView('setup');return;}
      if(id==='tv'&&ui.room==='dream'&&!state.collection.includes(model)){openView('collect-tv');return;}
      beginPlacement(id,!roomItems()[id]);return;
    }
    if(ui.view==='layout'&&b.dataset.furniture){beginPlacement(b.dataset.furniture);return;}
    if(ui.view==='layout'&&['tv','sofa','light'].includes(b.dataset.act)){
      const id=b.dataset.act==='light'?'lamp':b.dataset.act;
      beginPlacement(id,id==='tv'&&ui.room==='dream'&&!state.dreamLayout['tv-slot']);return;
    }
    switch(b.dataset.act){
      case 'layout':
        draft=null;
        if(ui.view==='layout')openView('',{editorOpen:false});
        else if(['dream','my'].includes(ui.room))openView('layout',{watch:false,editorOpen:true},true);
        break;

      case 'try-product':{
        if(!draft||draft.install||!['tv','lamp'].includes(draft.id))break;
        const id=draft.id;draft=null;switchProduct(id,true);break;
      }
      case 'discard':draft=null;render();break;
      case 'apply':
        finishPlacement();
        if(!draft&&!ui.editorOpen)openView('');
        break;
      case 'undo':undoPlacement();break;
      case 'photo':{
        const link=document.createElement('a');link.href=captureRoom();link.download='LG 미니룸 - '+rooms[ui.room]+'.png';
        link.click();break;
      }
      case 'turn':
        if(draft){draft.pose.angle=(Math.round(draft.pose.angle)+90)%360;render();}
        break;
      case 'store':if(draft)storeItem(draft.id);break;
      case 'menu':roomTo('menu');break;
      case 'enter':roomTo('dream');log('miniroom_open');break;
      case 'shelf-close':
        shelfCollapsed=desktopShelf.matches||phoneShelf.matches;
        if(ui.view==='catalog')openView(ui.editorOpen?'layout':'');else render();
        break;
      case 'catalog':
        shelfCollapsed=false;category='전체';
        if(desktopShelf.matches||phoneShelf.matches){render();$('#shelf-title').focus({preventScroll:true});}
        else openView('catalog',{editorOpen:ui.view==='layout'});
        break;
      case 'add-sofa':beginPlacement('sofa',true);break;
      case 'collect':if(!state.collection.includes(model)){update(s=>s.collection.push(model));log('collection_added');}beginPlacement('tv',true);break;
      case 'light':
        if(ui.view==='connect')bind('light-dim');
        else switchProduct('lamp');
        break;
      case 'tv':if(ui.view==='connect'){bind('tv-on');break;}switchProduct('tv');break;
      case 'tv-power':switchProduct('tv');break;
      case 'lamp-power':switchProduct('lamp');break;
      case 'remove':storeItem('tv');openView('',{watch:false});break;
      case 'sofa':if(ui.room==='example'){openView('movie');log('routine_opened');}else if(ui.room==='my' && saved()){log('routine_reopened');playMovie('sofa');}else openView('sofa');break;
      case 'movie':playMovie(ui.view);break;
      case 'edit-playing':openView('connect',{watch:false});break;
      case 'adapt':roomTo('my',{source:ui.source,view:state.myFixtureId?'connect':'setup'});break;
      case 'prepare':openView('setup');break;
      case 'setup':setupDevices();openView('connect');break;
      case 'edit':openView('connect',{bindings:{...saved().bindings}});break;
      case 'preview':playMovie(ui.view);break;
      case 'endpreview':endMovie();break;
      case 'save':if(saved())openView('replace');else save();break;
      case 'confirm':save();break;
      case 'close':if(ui.view==='preview')endMovie();else openView('');break;
    }
  }catch(err){notify(err.name==='Error'?err.message:'저장할 수 없어요. 다시 시도해 주세요.');}
});
desktopShelf.addEventListener('change',render);
phoneShelf.addEventListener('change',render);
const exportButton=$('#observationFile');
exportButton.hidden=!observing;
if(observing)$('#dot-editor-link').href='/editor?observe=1';
exportButton.onclick=()=>{try{exportObservation()}catch{notify('관찰 기록을 내려받을 수 없어요.')}};
sync();render();if(storageMessage)notify(storageMessage);
