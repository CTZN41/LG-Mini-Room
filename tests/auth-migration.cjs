const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const {createHash,randomBytes}=require('node:crypto');
const withServer=require('./member-server.cjs');
const hash=value=>createHash('sha256').update(value).digest('hex');
withServer(async(base,file)=>{
  const db=new DatabaseSync(file),token=randomBytes(32).toString('hex');
  try{
    db.exec('CREATE TABLE members(id TEXT PRIMARY KEY,nickname TEXT NOT NULL,login_hash TEXT NOT NULL,my_public INTEGER NOT NULL DEFAULT 0);CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES members(id),expires INTEGER NOT NULL)');
    db.prepare('INSERT INTO members VALUES(?,?,?,0)').run('00000002','별명',hash('old-test-key'));
    db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),'00000002',Date.now()+60000);
    const post=(path,data,cookie='')=>fetch(base+'/api/members/'+path,{method:'POST',headers:{'X-Miniroom':'1','Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(data)});
    const oldCookie='miniroom_session='+token;
    const fields={name:'테스트',username:'user',password:'001234',nickname:'별명'};
    assert.equal((await post('login',{id:'00000002',code:'old-test-key'})).status,401);
    assert.ok(!db.prepare('PRAGMA table_info(members)').all().some(c=>c.name==='login_hash'));
    assert.equal((await post('join',{...fields,password:'12'})).status,400);
    assert.equal((await (await post('join',fields)).json()).id,'00000001');
    assert.equal((await post('join',{...fields,username:'USER'})).status,409);
    assert.equal((await (await post('join',{...fields,username:'other'})).json()).id,'00000003');
    assert.equal((await post('credentials',{...fields,username:'legacy',owner:'00000002'},oldCookie)).status,200);
    const legacy=await post('login',{username:'legacy',password:fields.password});
    assert.equal((await legacy.json()).user.id,'00000002');
    assert.equal((await post('login',{username:'user',password:'998877'})).status,401);
    db.prepare('UPDATE uid_sequence SET last_uid=99999998').run();
    assert.equal((await (await post('join',{...fields,username:'last'})).json()).id,'99999999');
    assert.equal((await post('join',{...fields,username:'overflow'})).status,409);
    console.log('PASS sequential UID boundaries, duplicate IDs, legacy occupied UID, removed keys, existing session upgrade and password checks');
  }finally{db.close();}
}).catch(error=>{console.error(error);process.exitCode=1});
