'use strict';
const $=id=>document.getElementById(id);
const steps=[
  ['PLACE','놓아 보기','사기 전에 LG 가전을 내 방에 먼저 놓아 봐요. 밖에서 만난 가전은 카메라로 찍어 모을 수 있어요.','여기에 딱 맞네!','❄ 에어컨'],
  ['LIVE','살아 보기','가구를 누르면 루틴이 시작돼요. 고양이가 먼저 살아 보니까, 실제 가전은 그대로예요.','🌙 잘 준비 미리보기 중','조명 켜짐 → 꺼짐'],
  ['SHARE','가져와 쓰기','친구 방에서 마음에 드는 루틴을 가져와요. 내 가전에 맞게 바꾸고, 모을수록 레벨이 올라요.']
];
const params=new URLSearchParams(location.search);
const login=new URL('/login?from=miniroom',location.origin);
if(params.has('next'))login.searchParams.set('next',params.get('next'));
let timer;
function finish(){location.replace(login.href)}
function render(){
  clearTimeout(timer);
  const screen=location.hash.slice(1),i=['place','live','share'].indexOf(screen);
  $('door').hidden=i>=0||screen==='loading';
  $('loading').hidden=screen!=='loading';$('slides').hidden=i<0;
  if(screen==='loading'){
    timer=setTimeout(()=>location.replace('#place'),1500);return;
  }
  if(i<0){$('doorTitle').focus({preventScroll:true});return}
  const [tag,title,detail,...hints]=steps[i];
  $('mode').textContent=tag;$('slideTitle').textContent=title;$('detail').textContent=detail;
  $('progress').textContent=(i+1)+' / 3';
  $('sceneHints').replaceChildren(...hints.map(t=>{const span=document.createElement('span');span.textContent=t;return span}));
  $('preview').dataset.step=tag;
  document.querySelector('.room-art').hidden=i===2;
  document.querySelector('.shared').hidden=i!==2;
  document.querySelectorAll('.dots i').forEach((el,n)=>el.classList.toggle('current',n===i));
  $('next').textContent=i===2?'내 미니룸 만들기':'다음';
  $('next').onclick=i===2?finish:()=>{location.hash=i===0?'live':'share'};
  $('slideTitle').focus({preventScroll:true});
}
$('skip').onclick=finish;
function clock(){const time=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());document.querySelectorAll('.intro-status time').forEach(el=>el.textContent=time)}
clock();
setInterval(clock,30000);
render();
addEventListener('hashchange',render);
addEventListener('pagehide',()=>clearTimeout(timer));
addEventListener('pageshow',e=>{if(e.persisted)render()});
