(()=>{
  const slot=document.querySelector('[data-bgm-slot]');if(!slot)return;
  const byId=id=>document.getElementById(id);
  slot.insertAdjacentHTML('afterend',`<button id="bgm" class="bgm"><b class="music-meter" aria-hidden="true"><i></i><i></i><i></i><i></i></b><span><small>BGM · 무료 음원</small>탭해서 곡 고르기</span><em aria-hidden="true">▷　▷▏</em></button>
<dialog id="music" aria-labelledby="musicTitle"><div class="handle"></div><header><h2 id="musicTitle">♫ 미니홈피 BGM</h2><small>FREE DB</small><button class="close" aria-label="BGM 닫기">×</button></header>
<p>음원 준비 중이에요. 곡 목록을 미리 둘러보세요.</p><div class="tracks"></div><button class="apply" disabled>이 곡으로 설정</button></dialog>
`);
  slot.remove();
  const music=byId('music');
  for(const [icon,title,detail] of [['▷','레트로 도트 01','2:14 · 레트로'],['☕','도트 카페','1:58 · 잔잔한'],['🌧','비 오는 방','3:02 · 로파이'],['🕹','8bit 산책','2:40 · 신나는']]){
    const row=document.createElement('button');row.className='track';row.setAttribute('aria-pressed','false');
    const glyph=document.createElement('span');glyph.textContent=icon;
    const label=document.createElement('div'),name=document.createElement('strong'),sub=document.createElement('small');name.textContent=title;sub.textContent=detail;label.append(name,sub);
    const action=document.createElement('em');action.textContent='듣기 준비 중';row.append(glyph,label,action);
    row.onclick=()=>{for(const t of music.querySelectorAll('.track'))t.setAttribute('aria-pressed',String(t===row))};
    music.querySelector('.tracks').append(row);
  }
  function syncSheet(){
    if(location.hash==='#bgm'&&!music.open){music.querySelector('.track').click();music.showModal()}
    else if(location.hash!=='#bgm'&&music.open)music.close();
  }
  function closeMusic(){
    if(history.state?.music)history.back();
    else{const url=new URL(location.href);url.hash='';history.replaceState(null,'',url);syncSheet()}
  }
  byId('bgm').onclick=()=>{history.pushState({music:true},'','#bgm');syncSheet()};
  music.oncancel=e=>{e.preventDefault();closeMusic()};
  music.querySelector('.close').onclick=closeMusic;
  music.onclick=e=>{if(e.target===music){const r=music.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeMusic()}};
  addEventListener('popstate',syncSheet);
  syncSheet();
})();
