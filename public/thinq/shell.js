(() => {
  const query = new URLSearchParams(location.search);
  const inRoom = !document.body.classList.contains('thinq');
  const hompy = document.body.classList.contains('hompy');
  if (inRoom && !hompy && query.get('app') !== 'thinq') return;

  const tabs = [
    ['home', '홈', '/?tab=home'], ['devices', '디바이스', '/?tab=devices'],
    ['my', '마이룸', '/miniroom/home?space='+ (query.get('space') === 'my' ? 'my' : 'dream')],
    ['care', '케어', '/?tab=care'], ['menu', '메뉴', '/?tab=menu']
  ];
  const icons = {
    home: '<path d="m3 11 9-8 9 8v9H5v-9m5 9v-7h5v7"/>',
    devices: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="m14 17 3 3 5-6"/>',
    care: '<path d="m3 10 9-7 9 7v11H3Z M7 17v-2m5 2v-4m5 4v-7"/>',
    menu: '<rect x="2.5" y="2.5" width="19" height="19" rx="5"/><path d="M7 8h10M7 12h10M7 16h10"/>',
    my: '<path d="m12 2 9 5v10l-9 5-9-5V7Zm0 10v10M3 7l9 5 9-5"/><path d="m7 9 9-5"/>',
    user: '<circle cx="12" cy="7" r="4"/><path d="M3 21c0-9 18-9 18 0Z"/>',
    support: '<path d="M3 15v-3a9 9 0 0 1 18 0v5q0 4-7 4"/><path d="M3 11h3v7H3zm15 0h3v7h-3z"/>',
    diagnose: '<rect x="2" y="3" width="15" height="16" rx="4"/><path d="M9 7v8m-4-4h8m4 1h5v10h-5z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-11v2"/>',
    book: '<path d="M4 3h15v18H5q-2 0-2-3V6q0-3 2-3Zm0 14h15M8 7h7"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v5m10-5v5M3 10h18"/>',
    play: '<path d="m3 10 9-7 9 7v11H3Z"/><path d="m10 10 6 4-6 4z"/>',
    routine: '<path d="M3 12a9 9 0 1 1 3 7m-4 1 1-6 5 3m0-6 3 3 6-6"/>'
  };
  function icon(key) {
    return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+icons[key]+'</svg>';
  }
  let active;
  if (inRoom) {
    active = hompy || ['dream','my'].includes(query.get('space')) ? 'my' : 'menu';
  } else {
    active = ['devices','care','menu'].includes(query.get('tab')) ? query.get('tab') : 'home';
    for (const screen of document.querySelectorAll('.screen')) screen.hidden = screen.id !== active;
    for (const slot of document.querySelectorAll('[data-icon]')) slot.innerHTML = icon(slot.dataset.icon);
    document.title = 'LG ThinQ · '+tabs.find(([id]) => id === active)[1];
    const uid=sessionStorage.getItem('miniroom.welcomeUid');
    if(active==='home'&&/^\d{8}$/.test(uid||'')){
      const note=document.createElement('p');
      note.setAttribute('role','status');note.textContent='가입했어요 · 내 UID '+uid;
      document.querySelector('#home header').after(note);
      sessionStorage.removeItem('miniroom.welcomeUid');
    }
  }
  const footer = document.createElement('footer');
  footer.className = 'thinq-footer';
  const nav = document.createElement('nav');
  nav.className = 'thinq-tabs';
  nav.setAttribute('aria-label','ThinQ 하단 메뉴');
  for (const [id,label,url] of tabs) {
    const link = document.createElement('a');
    link.href = id === 'my' && !inRoom ? '/miniroom/start' : url;
    if (id === active) link.setAttribute('aria-current','page');
    link.innerHTML = icon(id)+'<span>'+label+'</span>';
    nav.append(link);
  }
  if(!inRoom&&active==='devices'){
    nav.querySelectorAll('svg').forEach((slot,i)=>{
      const img=document.createElement('img');img.alt='';img.width=22;img.height=22;
      img.src='/onboarding/nav-'+['home','grid','room','care','menu'][i]+'.svg';slot.replaceWith(img);
    });
    const entry=nav.querySelectorAll('a')[2];
    const tip=document.createElement('span');tip.className='entry-tip';tip.setAttribute('aria-hidden','true');
    tip.textContent='NEW  탭해서 미니룸 시작하기';entry.append(tip);
    const clock=document.querySelector('.device-status time');
    const tick=()=>clock.textContent=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
    tick();setInterval(tick,30000);
  }
  footer.append(nav);
  document.body.append(footer);
})();
