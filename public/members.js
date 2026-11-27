'use strict';
const $=id=>document.getElementById(id);
let current;
async function api(path,data){
  if(data&&['claim','import'].includes(path))await globalThis.miniroomStorage?.whenSynced?.();
  const options=data?{method:'POST',headers:{'Content-Type':'application/json','X-Miniroom':'1'},body:JSON.stringify({...data,owner:current?.id})}:{};
  const response=await fetch('/api/members/'+path,options);
  const body=await response.json();
  if(!response.ok)throw Error(body.error||'요청을 마칠 수 없어요.');
  return body;
}
function report(error){$('status').textContent=error.message}
function form(id,handler){
  $(id).onsubmit=async event=>{
    event.preventDefault();const button=event.submitter;button.disabled=true;
    try{await handler(new FormData(event.currentTarget))}catch(error){report(error)}finally{button.disabled=false}
  };
}
function showWallet(data){
  $('balance').textContent='레벨 '+data.level+' · 경험치 '+data.xp+' · '+data.points+' 포인트';
  const tutorial=data.counts.tutorial?'첫 수집·배치 완료':'드림룸에 수집한 제품을 직접 배치하면 300 포인트';
  $('quests').textContent=tutorial+' · 수집 보상 '+(data.counts.collection||0)+'종 · 친구 루틴 '+(data.counts.friend||0)+'개';
  $('coupons').replaceChildren();
  for(const coupon of data.coupons){
    const li=document.createElement('li');
    li.textContent=coupon.family+' · '+new Date(coupon.created).toLocaleDateString('ko-KR')+' 발급';$('coupons').append(li);
  }
  if(!data.coupons.length)$('coupons').textContent='발급된 체험용 쿠폰이 없어요.';
}
$('claim').onclick=async()=>{
  $('claim').disabled=true;
  try{showWallet(await api('claim',{}));$('status').textContent='완료한 퀘스트의 보상을 확인했어요.'}
  catch(error){report(error)}finally{$('claim').disabled=false}
};
let visiting=null;
function showNotes(rows){
  $('notes').replaceChildren(...rows.map(row=>{
    const li=document.createElement('li');li.textContent=row.nickname+' · '+row.message;return li;
  }));
}
function matchLink(copy){
  const a=document.createElement('a');
  a.href='/editor?'+new URLSearchParams({space:'my',friendImport:copy.id,app:'thinq'});
  a.textContent=copy.name+' · 내 기기에 맞추기';return a;
}
async function loadCopies(){
  const {imports}=await api('imports');
  $('copies').replaceChildren(...imports.map(copy=>{const p=document.createElement('p');p.append(matchLink(copy));return p}));
  if(!imports.length)$('copies').textContent='아직 가져온 루틴이 없어요.';
}
form('guestbook',async data=>{
  const {notes}=await api('note',{source:visiting.id,space:visiting.space,message:data.get('message')});
  showNotes(notes);$('guestbook').reset();$('status').textContent='방명록에 남겼어요.';
});
async function visit(id,space){
  $('visit').hidden=true;
  const room=await api('room?'+new URLSearchParams({id,space}));
  await Promise.all([DotScene.load(),ProductCatalog.loadModels(),ProductCatalog.loadBodies()]);
  const items=room.items.filter(o=>DotScene.products[o.k]||ProductCatalog.hasModel(o.k)&&ProductCatalog.restore(DotScene.products,o.k));
  const bg=DotScene.bg(room.room,room.theme),canvas=$('preview');
  canvas.width=bg.width;canvas.height=bg.height;
  DotScene.paint(canvas.getContext('2d'),room.room,room.theme,DotScene.sorted(room.room,items),null,null,false,true);
  $('visitTitle').textContent=room.owner.nickname+' · '+(space==='dream'?'드림룸':'마이룸');
  visiting={id,space};showNotes(room.notes);
  $('shared').replaceChildren();
  for(const recipe of room.recipes){
    const row=document.createElement('article'),title=document.createElement('h3'),detail=document.createElement('p');
    title.textContent=recipe.name;detail.textContent=recipe.steps.map(s=>s.label+(s.required?' (필수)':' (선택)')).join(' · ');
    row.append(title,detail);
    if(id!==current.id){
      const button=document.createElement('button');button.textContent=recipe.name+' 가져오기';
      button.onclick=async()=>{
        button.disabled=true;
        try{const copy=await api('import',{source:id,share:recipe.share});await loadCopies();showWallet(await api('wallet'));
          button.replaceWith(matchLink({...copy,name:recipe.name}));$('status').textContent='내 계정에 보관했어요.';
        }catch(error){report(error);button.disabled=false}
      };
      row.append(button);
    }
    $('shared').append(row);
  }
  $('visit').hidden=false;
}
async function init(){
  const me=await api('me');current=me.user;
  if(!current){location.replace('/login');return}
  $('account').hidden=false;
  $('setCredentials').hidden=!me.needsCredentials;
  $('identity').textContent=current.nickname+' · UID '+current.id;
  $('profile').elements.nickname.value=current.nickname;$('profile').elements.myPublic.checked=current.myPublic;
  await loadCopies();showWallet(await api('wallet'));
  const params=new URLSearchParams(location.search);
  if(params.has('visit'))await visit(params.get('visit'),params.get('space'));
}
form('setCredentials',async data=>{await api('credentials',Object.fromEntries(data));$('setCredentials').reset();await init();$('status').textContent='로그인 정보를 저장했어요.'});
form('profile',async data=>{await api('profile',{nickname:data.get('nickname'),myPublic:data.has('myPublic')});await init();$('status').textContent='설정을 저장했어요.'});
$('logout').onclick=async()=>{try{await api('logout',{});location.replace('/members')}catch(error){report(error)}};
form('search',async data=>{
  const {members}=await api('find?'+new URLSearchParams(data));
  $('results').replaceChildren();
  for(const member of members){
    const row=document.createElement('article'),p=document.createElement('p');p.textContent=member.nickname+' · '+member.id;row.append(p);
    const nav=document.createElement('nav');
    for(const space of member.myPublic?['dream','my']:['dream']){
      const link=document.createElement('a');link.href='/members?'+new URLSearchParams({visit:member.id,space});link.textContent=space==='dream'?'드림룸 방문':'마이룸 방문';nav.append(link);
    }
    row.append(nav);$('results').append(row);
  }
  $('status').textContent=members.length?members.length+'명':'검색 결과가 없어요.';
});
init().catch(report);
