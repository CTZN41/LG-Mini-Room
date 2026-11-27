'use strict';
const params = new URLSearchParams(location.search);
const next = params.get('next');
const room = '/miniroom/home?space=dream';
const destination = next && /^\/(?:editor|miniroom\/home)\?[^#\r\n]*$/.test(next) ? next : params.get('from') === 'miniroom' ? room : '/';
if (next && destination === next) document.querySelector('.replay').href += '&' + new URLSearchParams({next});
const forms = [...document.querySelectorAll('form')];
const statusText = document.querySelector('#status');
function show(mode){
  for(const form of forms) form.hidden=form.id!==mode;
  document.querySelector('#title').textContent={login:'미니룸 로그인',join:'미니룸 회원가입'}[mode];
  statusText.textContent='';
  document.querySelector('#'+mode+' input').focus();
}
for(const button of document.querySelectorAll('[data-mode]')) button.onclick=()=>show(button.dataset.mode);
for(const form of forms) form.onsubmit=async event=>{
  event.preventDefault();
  const button=event.submitter;
  if(button.disabled)return;
  button.disabled=true;statusText.textContent='';
  try{
    const data=Object.fromEntries(new FormData(form));
    const joining=form.id==='join';
    const response=await fetch('/api/members/'+(joining?'join':'login'),{method:'POST',headers:{'Content-Type':'application/json','X-Miniroom':'1'},body:JSON.stringify(data)});
    const result=await response.json();
    if(!response.ok)throw Error(result.error||'다시 시도해 주세요.');
    if(joining)sessionStorage.setItem('miniroom.welcomeUid',result.id);
    location.replace(destination);
  }catch(error){statusText.textContent=error.message;}finally{button.disabled=false;}
};
