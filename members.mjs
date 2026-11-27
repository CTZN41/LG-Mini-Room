import {DatabaseSync} from 'node:sqlite';
import {randomBytes, createHash, timingSafeEqual, scrypt} from 'node:crypto';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';

const filepath=process.env.MINIROOM_MEMBERS_DB||fileURLToPath(new URL('./data/miniroom-members.sqlite',import.meta.url));
const digest=value=>createHash('sha256').update(value).digest('hex');
const derive=promisify(scrypt);
const fail=(status,message)=>{throw Object.assign(new Error(message),{status})};
import {setupCommunity,publicRecipes,notes,listImports} from './community.mjs';
import {setupRewards,rewardImport,claim,wallet} from './rewards.mjs';
let db;
function database(){
  if(db)return db;
  const conn=new DatabaseSync(filepath);
  conn.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS members(id TEXT PRIMARY KEY,nickname TEXT NOT NULL,my_public INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES members(id),expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS saves(owner TEXT NOT NULL REFERENCES members(id),key TEXT NOT NULL,value TEXT NOT NULL,PRIMARY KEY(owner,key));`);
  conn.exec(`CREATE TABLE IF NOT EXISTS member_credentials(
    owner TEXT PRIMARY KEY REFERENCES members(id), real_name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, password_hash TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0, window_end INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS uid_sequence(singleton INTEGER PRIMARY KEY CHECK(singleton=1), last_uid INTEGER NOT NULL);
    INSERT OR IGNORE INTO uid_sequence VALUES(1,0);`);
  setupCommunity(conn);setupRewards(conn);
  conn.exec('BEGIN IMMEDIATE');
  try{
    if(conn.prepare('PRAGMA table_info(members)').all().some(col=>col.name==='login_hash'))
      conn.exec('ALTER TABLE members DROP COLUMN login_hash');
    conn.exec('COMMIT');
  }catch(error){conn.exec('ROLLBACK');conn.close();throw error}
  db=conn;
  return db;
}
const validKey=key=>typeof key==='string'&&/^(?:(?:dotroom|lg-miniroom\.dot\.my(?:\.thinq)?)(?:\.before-wood)?|lg-miniroom\.(?:state(?:\.thinq)?|dot\.dream\.retro-c|discovered\.[\w-]{1,80}|placement-clue\.[\w.-]{1,120}))$/.test(key);
const profile=row=>({id:row.id,nickname:row.nickname,myPublic:!!row.my_public});
function nickname(raw){
  if(typeof raw!=='string'||!raw.trim()||raw.trim().length>30||/[\x00-\x1f]/.test(raw))fail(400,'닉네임을 1~30자로 입력하세요.');
  return raw.trim();
}
function token(request){return /(?:^|;\s*)miniroom_session=([0-9a-f]{64})(?:;|$)/.exec(request.headers.cookie||'')?.[1]}
function nextUid(conn){
  let n=conn.prepare('SELECT last_uid FROM uid_sequence WHERE singleton=1').get().last_uid;
  const used=conn.prepare('SELECT 1 FROM members WHERE id=?');
  while(++n<=99999999){
    const id=String(n).padStart(8,'0');
    if(used.get(id))continue;
    conn.prepare('UPDATE uid_sequence SET last_uid=? WHERE singleton=1').run(n);
    return id;
  }
  fail(409,'발급 가능한 UID가 모두 사용됐어요.');
}
const loginName=value=>typeof value==='string'?value.normalize('NFKC').trim().toLowerCase():'';
async function credentials(data){
  const username=loginName(data.username),name=typeof data.name==='string'?data.name.trim():'';
  if(!name||name.length>60||/[\x00-\x1f]/.test(name))fail(400,'이름을 1~60자로 입력하세요.');
  if(!/^[\p{L}\p{N}_.-]{1,40}$/u.test(username))fail(400,'아이디는 1~40자의 문자, 숫자, 점, 밑줄, 하이픈으로 입력하세요.');
  if(typeof data.password!=='string'||!/^\d{6}$/.test(data.password))fail(400,'비밀번호는 숫자 6자리로 입력하세요.');
  const salt=randomBytes(16).toString('hex');
  return [name,username,salt,(await derive(data.password,salt,64)).toString('hex')];
}
function setCredentials(conn,id,fields){
  if(conn.prepare('SELECT 1 FROM member_credentials WHERE username=?').get(fields[1]))fail(409,'이미 사용 중인 아이디예요.');
  conn.prepare('INSERT INTO member_credentials(owner,real_name,username,salt,password_hash) VALUES(?,?,?,?,?)').run(id,...fields);
}
export function memberFor(request){
  const value=token(request);
  if(!value)return null;
  return database().prepare('SELECT m.* FROM sessions s JOIN members m ON m.id=s.owner WHERE token_hash=? AND expires>?').get(digest(value),Date.now());
}
function entries(id){
  return Object.fromEntries(database().prepare('SELECT key,value FROM saves WHERE owner=?').all(id).map(r=>[r.key,r.value]));
}
export function bootstrap(request){
  const user=memberFor(request);
  return user?{user:profile(user),entries:entries(user.id)}:null;
}
function session(request,response,id){
  const secret=randomBytes(32).toString('hex'),ttl=30*86400;
  database().prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(secret),id,Date.now()+ttl*1000);
  response.setHeader('Set-Cookie','miniroom_session='+secret+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+ttl+(request.socket.encrypted?'; Secure':''));
}
async function payload(request){
  const chunks=[];let length=0;
  for await(const part of request){
    length+=part.length;if(length>3_000_000)fail(413,'방 데이터가 너무 큽니다.');
    chunks.push(part);
  }
  try{const data=JSON.parse(Buffer.concat(chunks));if(data&&typeof data==='object'&&!Array.isArray(data))return data}catch{}
  fail(400,'입력 형식을 확인하세요.');
}
function validateEntry(key,value){
  if(!validKey(key)||typeof value!=='string'||Buffer.byteLength(value)>900000)fail(400,'방 저장 항목을 확인하세요.');
  if(key.includes('.discovered.')||key.includes('.placement-clue.'))return;
  let raw;try{raw=JSON.parse(value)}catch{}
  if(!raw||typeof raw!=='object'||Array.isArray(raw))fail(400,'방 저장 형식을 확인하세요.');
  if(key.includes('.state')&&(!Array.isArray(raw.collection)||!Array.isArray(raw.savedRoutines)||raw.schemaVersion!==1))fail(400,'인벤토리 저장 형식을 확인하세요.');
  if(!key.includes('.state')&&(!raw.layouts||!['A','B','C'].includes(raw.room)))fail(400,'배치 저장 형식을 확인하세요.');
}
function roomPreview(id,space){
  const row=database().prepare('SELECT * FROM members WHERE id=?').get(id);
  if(!row||!['my','dream'].includes(space)||(space==='my'&&!row.my_public))fail(404,'방을 열 수 없어요.');
  const saves=entries(id);
  const layout=JSON.parse((space==='my'?saves['lg-miniroom.dot.my']||saves['lg-miniroom.dot.my.thinq']:saves.dotroom)||'null');
  const room=layout?.room||'B', theme=layout?.theme==='lime'?'lime':'pink';
  const starter=[{k:'sofa',x:34,y:48,f:1,turn:1}];
  const items=(layout?.layouts?.[room]??starter).filter(o=>o&&typeof o.k==='string'&&!o.k.startsWith('camera:')).map((o,index)=>({
    id:index+1,k:o.k,x:o.x,y:o.y,e:o.e||0,f:o.f||0,turn:o.turn||0
  }));
  return {owner:profile(row),space,room,theme,items,notes:notes(database(),id,space),
    recipes:space==='my'?publicRecipes(saves):[]};
}

export async function serveMembers(request,response,url){
  const send=(status,body)=>response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}).end(JSON.stringify(body));
  try{
    const path=url.pathname.slice('/api/members/'.length),method=request.method;
    const conn=database(),user=memberFor(request);
    if(method==='GET'){
      if(path==='me')return send(200,{user:user?profile(user):null,needsCredentials:!!user&&!conn.prepare('SELECT 1 FROM member_credentials WHERE owner=?').get(user.id)});
      if(!user)fail(401,'먼저 로그인하세요.');
      if(path==='find'){
        const q=(url.searchParams.get('q')||'').trim().slice(0,32);
        return send(200,{members:q?conn.prepare('SELECT * FROM members WHERE id=? OR nickname=? ORDER BY id LIMIT 30').all(q,q).map(profile):[]});
      }
      if(path==='wallet')return send(200,wallet(conn,user.id));
      if(path==='imports')return send(200,{imports:listImports(conn,user.id)});
      if(path==='room')return send(200,roomPreview(url.searchParams.get('id'),url.searchParams.get('space')));
      fail(404,'경로를 찾을 수 없어요.');
    }
    if(method!=='POST')fail(405,'지원하지 않는 방식입니다.');
    if(request.headers['x-miniroom']!=='1'||(request.headers.origin&&new URL(request.headers.origin).host!==request.headers.host))fail(403,'요청 출처를 확인하세요.');
    const data=await payload(request);
    if(path==='join'){
      if(user)fail(409,'다른 계정을 만들려면 먼저 로그아웃하세요.');
      const name=nickname(data.nickname),fields=await credentials(data);
      conn.exec('BEGIN IMMEDIATE');
      try{
        const id=nextUid(conn);
        conn.prepare('INSERT INTO members(id,nickname) VALUES(?,?)').run(id,name);
        setCredentials(conn,id,fields);
        session(request,response,id);conn.exec('COMMIT');
        return send(201,{id});
      }catch(error){conn.exec('ROLLBACK');throw error}
    }
    if(path==='login'){
        const row=conn.prepare('SELECT * FROM member_credentials WHERE username=?').get(loginName(data.username));
        const invalid=()=>fail(401,'아이디와 비밀번호를 확인하세요.');
        if(!row||typeof data.password!=='string'||!/^\d{6}$/.test(data.password))invalid();
        const now=Date.now();
        if(row.window_end>now&&row.attempts>=10)fail(429,'잠시 후 다시 로그인해 주세요.');
        conn.prepare('UPDATE member_credentials SET attempts=?,window_end=? WHERE owner=?').run(row.window_end>now?row.attempts+1:1,row.window_end>now?row.window_end:now+300000,row.owner);
        const hash=await derive(data.password,row.salt,64);
        if(!timingSafeEqual(Buffer.from(row.password_hash,'hex'),hash))invalid();
        conn.prepare('UPDATE member_credentials SET attempts=0,window_end=0 WHERE owner=?').run(row.owner);
        session(request,response,row.owner);
        return send(200,{user:profile(conn.prepare('SELECT * FROM members WHERE id=?').get(row.owner))});
    }
    if(!user)fail(401,'다시 로그인하세요.');
    if(data.owner!==user.id)fail(409,'로그인한 계정이 변경됐어요.');
    if(path==='credentials'){
      const fields=await credentials(data);
      if(memberFor(request)?.id!==user.id)fail(401,'다시 로그인하세요.');
      if(conn.prepare('SELECT 1 FROM member_credentials WHERE owner=?').get(user.id))fail(409,'이미 로그인 정보가 설정됐어요.');
      setCredentials(conn,user.id,fields);return send(200,{ok:true});
    }
    if(path==='note'){
      roomPreview(data.source,data.space);
      const message=typeof data.message==='string'?data.message.trim():'';
      if(!message||message.length>200)fail(400,'방명록은 1~200자로 입력하세요.');
      conn.prepare('INSERT INTO guest_notes(room_owner,space,writer,message,created) VALUES(?,?,?,?,?)')
        .run(data.source,data.space,user.id,message,Date.now());
      return send(201,{notes:notes(conn,data.source,data.space)});
    }
    if(path==='import'){
      if(data.source===user.id)fail(400,'친구의 방에서 루틴을 가져오세요.');
      const room=roomPreview(data.source,'my');
      const recipe=room.recipes.find(r=>r.share===data.share);
      if(!recipe)fail(404,'공유 루틴을 찾을 수 없어요.');
      conn.exec('BEGIN IMMEDIATE');
      try{
        conn.prepare('INSERT INTO imports(owner,source,share,recipe) VALUES(?,?,?,?) ON CONFLICT DO NOTHING')
          .run(user.id,data.source,recipe.share,JSON.stringify(recipe));
        const copy=conn.prepare('SELECT id,recipe FROM imports WHERE owner=? AND source=? AND share=?').get(user.id,data.source,recipe.share);
        rewardImport(conn,user.id,copy.id,JSON.parse(copy.recipe));
        conn.exec('COMMIT');return send(200,{id:copy.id});
      }catch(error){conn.exec('ROLLBACK');throw error}
    }
    if(path==='claim'){
      conn.exec('BEGIN IMMEDIATE');
      try{claim(conn,user.id);const result=wallet(conn,user.id);conn.exec('COMMIT');return send(200,result)}
      catch(error){conn.exec('ROLLBACK');throw error}
    }
    if(path==='logout'){
      conn.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token(request)));
      response.setHeader('Set-Cookie','miniroom_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict');
      return send(200,{ok:true});
    }
    if(path==='profile'){
      if(typeof data.myPublic!=='boolean')fail(400,'방 공개 설정을 확인하세요.');
      conn.prepare('UPDATE members SET nickname=?,my_public=? WHERE id=?').run(nickname(data.nickname),Number(data.myPublic),user.id);
      return send(200,{ok:true});
    }
    if(path==='save'){
      if(!validKey(data.key))fail(400,'알 수 없는 저장 항목입니다.');
      if(data.value!==null)validateEntry(data.key,data.value);
      const prior=conn.prepare('SELECT value FROM saves WHERE owner=? AND key=?').get(user.id,data.key)?.value??null;
      if(prior!==data.value){
        if(prior!==data.before)fail(409,'다른 세션에서 변경했어요. 새로고침해 서버 저장본을 확인하세요.');
        if(data.value===null)conn.prepare('DELETE FROM saves WHERE owner=? AND key=?').run(user.id,data.key);
        else conn.prepare('INSERT INTO saves VALUES(?,?,?) ON CONFLICT(owner,key) DO UPDATE SET value=excluded.value').run(user.id,data.key,data.value);
      }
      return send(200,{ok:true});
    }
    fail(404,'경로를 찾을 수 없어요.');
  }catch(error){return send(error.status||500,{error:error.status?error.message:'회원 저장소를 열 수 없어요.'})}
}
