'use strict';
const byId=id=>document.getElementById(id);
const roomName={my:'마이룸',dream:'드림룸'};
const spaceFromURL=()=>new URLSearchParams(location.search).get('space')==='my'?'my':'dream';
let space,reader,loadNumber=0,timeout;
function editor(target,extras={}){
  return '/editor?'+new URLSearchParams({space:target,app:'thinq',...extras});
}
function textRow(message){
  const p=document.createElement('p');p.className='empty';p.textContent=message;return p;
}
function previewFailure(){
  byId('roomStatus').textContent='방을 불러오지 못했어요. 눌러서 방을 열어 보세요.';
  byId('rows').replaceChildren(textRow('목록을 불러오지 못했어요.'));
}
window.addEventListener('message',event=>{
  const data=event.data;
  if(!reader||event.source!==reader.contentWindow||event.origin!==location.origin||data?.type!=='miniroom-home-preview'||data.space!==space)return;
  clearTimeout(timeout);reader.remove();reader=null;
  if(data.error){previewFailure();return;}
  const shot=byId('roomImage');shot.src=data.image;shot.alt=roomName[space]+' '+data.room+'룸의 현재 배치';shot.hidden=false;
  byId('roomStatus').textContent='';
  const my=space==='my';
  byId('all').textContent=data.unavailable?'ALL ›':'ALL '+data.count+' ›';
  const rows=data.rows.map(unit=>{
    const a=document.createElement('a');a.className='unit';a.href=editor(space,{homeAction:'products',product:unit.key});
    const img=document.createElement('img');img.src=unit.image;img.alt='';
    const name=document.createElement('strong');name.textContent=unit.name;
    const tag=document.createElement('small');tag.textContent=my?'가동 미확인':unit.placed?'배치됨':'보관';
    const detail=document.createElement('span');detail.className='unit-detail';detail.textContent=unit.detail;
    a.classList.toggle('placed',!my&&unit.placed);a.append(img,name,detail,tag);return a;
  });
  byId('rows').replaceChildren(...(rows.length?rows:[textRow(data.unavailable?'등록 가전을 불러오지 못했어요.':my?'등록된 가전이 없어요.':'아직 수집한 가전이 없어요.')]));
});
async function showRoom(){
  const sequence=++loadNumber;
  space=spaceFromURL();const my=space==='my';
  document.body.dataset.space=space;
  document.querySelectorAll('.switch button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.space===space)));
  byId('enter').href=byId('roomTab').href=editor(space);
  byId('enter').setAttribute('aria-label',roomName[space]+' 들어가기');
  byId('full').href=editor(space,{homeAction:'overview'});
  byId('all').href=editor(space,{homeAction:my?'registered':'products'});
  byId('bookTab').href=editor(space,{inventory:'1'});
  byId('shoot').href=editor('dream',{homeAction:'scan'});
  byId('listTitle').textContent=my?'지금 돌아가는 가전':'수집한 가전';
  byId('badgeLabel').textContent=my?'장착 루틴':'드림룸 적용';
  byId('roomRoutine').textContent=my?'☾ 장착 루틴':'✦ 적용 루틴';
  byId('routineGlyph').textContent=my?'☾':'◎';
  byId('roomImage').hidden=true;byId('roomStatus').textContent='방을 불러오는 중…';
  byId('all').textContent='ALL ›';byId('rows').replaceChildren(textRow('가전을 불러오는 중…'));
  byId('notes').textContent='불러오는 중…';byId('noteTotal').textContent='›';
  for(const id of ['guest','noteTab'])byId(id).removeAttribute('href');
  clearTimeout(timeout);reader?.remove();
  reader=document.createElement('iframe');reader.className='reader';reader.title='방 미리보기 생성';reader.tabIndex=-1;reader.setAttribute('aria-hidden','true');reader.inert=true;
  reader.src=editor(space,{homePreview:'1'});document.body.append(reader);
  timeout=setTimeout(()=>{if(sequence===loadNumber&&reader)previewFailure()},20000);
  try{
    const res=await fetch('/api/members/home?space='+space,{cache:'no-store'});
    if(!res.ok)throw Error();
    const {user,wallet,notes}=await res.json();if(sequence!==loadNumber)return;
    byId('nickname').textContent=user.nickname+'의 방';
    byId('level').textContent='LV.'+wallet.level;byId('coins').textContent=wallet.points;byId('coins').setAttribute('aria-label',wallet.points+' 포인트');
    byId('xp').value=wallet.level>=99?10:wallet.xp%10;byId('xpText').textContent=wallet.level>=99?'MAX':wallet.xp%10+'/10';
    const guest='/members?'+new URLSearchParams({visit:user.id,space})+'#guestbook';
    byId('guest').href=byId('noteTab').href=guest;
    byId('notes').replaceChildren(...notes.slice(0,2).map(n=>{
      const p=document.createElement('p'),name=document.createElement('b');name.textContent=n.nickname;p.append(name,n.message);return p;
    }));
    if(!notes.length)byId('notes').textContent='아직 남겨진 글이 없어요.';
    byId('noteTotal').textContent='NEW — ›';
  }catch{if(sequence===loadNumber)byId('notes').textContent='계정 정보를 불러오지 못했어요. 새로고침해 주세요.'}
}
for(const button of document.querySelectorAll('.switch button'))button.onclick=()=>{
  if(button.dataset.space===space)return;
  const url=new URL(location.href);url.searchParams.set('space',button.dataset.space);
  history.replaceState(null,'',url);void showRoom();
};
for(const button of document.querySelectorAll('[data-pending]'))button.onclick=()=>{
  byId('pendingTitle').textContent=button.dataset.pending;byId('pending').showModal();
};
const pending=byId('pending');
pending.querySelector('.close').onclick=()=>pending.close();
pending.onclick=e=>{if(e.target===pending){const r=pending.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)pending.close()}};
addEventListener('pageshow',e=>{if(e.persisted)void showRoom()});
const clock=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function tick(){byId('clock').textContent=clock.format(new Date())}
tick();setInterval(tick,30000);void showRoom();
