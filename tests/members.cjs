const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const withServer=require('./member-server.cjs');
const headers={'X-Miniroom':'1'};
withServer(async base=>{
  const browser=await chromium.launch({channel:'chrome'});
  try{
    const home=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const p=await home.newPage();p.setDefaultTimeout(6500);
    const errors=[];p.on('pageerror',e=>errors.push(e.message));
    let releaseCatalog;
    const gate=new Promise(resolve=>{releaseCatalog=resolve});
    await p.route('**/api/catalog/models*',async route=>{await gate;await route.continue()});
    await p.goto(base+'/editor?space=dream');
    const lime=p.getByRole('button',{name:'연두',exact:true});
    assert.ok(await lime.isDisabled());
    releaseCatalog();await lime.click();
    const original=await p.evaluate(()=>JSON.parse(localStorage.dotroom));
    assert.equal(original.theme,'lime');
    await p.goto(base+'/members');
    await p.getByRole('button',{name:'회원가입',exact:true}).click();
    await p.getByLabel('이름',{exact:true}).fill('김테스트');
    await p.locator('#join').getByLabel('아이디',{exact:true}).fill('first-user');
    await p.locator('#join').getByLabel('비밀번호',{exact:true}).fill('012345');
    await p.getByLabel('닉네임',{exact:true}).fill('미니룸 팀');
    assert.equal(await p.locator('#join input[type=checkbox]').count(),0);await p.getByRole('button',{name:'가입하고 시작하기'}).click();
    const id='00000001';
    await p.getByRole('status').filter({hasText:id}).waitFor();
    await p.getByRole('navigation',{name:'ThinQ 하단 메뉴'}).getByRole('link',{name:'마이룸'}).click();
    await p.waitForURL('**/editor?space=dream&app=thinq');
    await p.getByRole('button',{name:'배치 편집'}).waitFor();
    assert.equal(await p.evaluate(()=>JSON.parse(roomStorage.getItem('dotroom')).theme),'pink');
    await p.getByRole('button',{name:'연두',exact:true}).click();
    await p.waitForFunction(()=>document.getElementById('accountSaveStatus').textContent==='계정에 저장됨');
    assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.dotroom)),original);

    const other=await browser.newContext(),remote=await other.newPage();
    await remote.goto(base+'/experience/qr');await remote.locator('#entry').click();
    await remote.locator('#login').getByLabel('아이디',{exact:true}).fill('FIRST-user');
    await remote.locator('#login').getByLabel('비밀번호',{exact:true}).fill('012345');await remote.getByRole('button',{name:'로그인',exact:true}).click();
    await remote.locator('#home').waitFor();
    await remote.getByRole('navigation',{name:'ThinQ 하단 메뉴'}).getByRole('link',{name:'마이룸'}).click();
    await remote.getByRole('button',{name:'배치 편집'}).waitFor();
    assert.equal(await remote.evaluate(()=>JSON.parse(roomStorage.getItem('dotroom')).theme),'lime');
    assert.equal(await remote.evaluate(()=>localStorage.dotroom),undefined);

    const clients=await Promise.all(Array.from({length:20},()=>browser.newContext()));
    const ids=await Promise.all(clients.map(async(context,index)=>{
      const post=(route,data)=>context.request.post(base+'/api/members/'+route,{headers,data});
      const response=await post('join',{name:'회원',username:'member-'+index,password:'098765',nickname:'같은 이름'});
      assert.equal(response.status(),201);
      const {id}=await response.json();assert.match(id,/^\d{8}$/);
      const save=await post('save',{owner:id,key:'lg-miniroom.discovered.movie-night',before:null,value:'test-'+index});
      assert.equal(save.status(),200);
      return id;
    }));
    assert.equal(new Set(ids).size,20);
    assert.deepEqual(ids.slice().sort(),Array.from({length:20},(_,i)=>String(i+2).padStart(8,'0')));
    await Promise.all(clients.map(async(context,index)=>{
      const editor=await context.request.get(base+'/editor?space=my');
      const match=(await editor.text()).match(/id="account-data">([^<]+)<\/script>/);
      const snapshot=JSON.parse(match[1]);assert.equal(snapshot.user.id,ids[index]);
      assert.deepEqual(snapshot.entries,{'lg-miniroom.discovered.movie-night':'test-'+index});
    }));
    const visitor=clients[0].request;
    const find=await visitor.get(base+'/api/members/find?q='+encodeURIComponent('같은 이름'));assert.equal((await find.json()).members.length,20);
    const visit=space=>visitor.get(base+'/api/members/room?'+new URLSearchParams({id,space}));
    assert.equal((await visit('my')).status(),404);assert.equal((await visit('dream')).status(),200);
    const updated=await home.request.post(base+'/api/members/profile',{headers,data:{owner:id,nickname:'새 닉네임',myPublic:true}});
    assert.equal(updated.status(),200);assert.equal((await visit('my')).status(),200);
    const conflict=await home.request.post(base+'/api/members/save',{headers,data:{owner:id,key:'dotroom',before:null,value:JSON.stringify({...original,theme:'pink'})}});
    assert.equal(conflict.status(),409);
    const forged=await visitor.post(base+'/api/members/profile',{headers,data:{owner:id,nickname:'변경',myPublic:true}});
    assert.equal(forged.status(),409);assert.deepEqual(errors,[]);
    console.log('PASS Phase 3: mobile join without guest import, other-session login/restore, 20 isolated owners, duplicate names, room visibility, stale write rejected');
  }finally{await browser.close()}
}).catch(e=>{console.error(e);process.exitCode=1});
