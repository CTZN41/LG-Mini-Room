const {spawn}=require('node:child_process');
const {mkdtemp,rm}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const path=require('node:path');
const {once}=require('node:events');
module.exports=async function withServer(test,{visitorOnly=false}={}){
  const dir=await mkdtemp(path.join(tmpdir(),'miniroom-members-'));
  const server=spawn(process.execPath,['server.mjs'],{cwd:path.join(__dirname,'..'),windowsHide:true,
    env:{...process.env,THINQ_PAT:'',LG_MINI_ROOM_HOST:'127.0.0.1',LG_MINI_ROOM_PORT:'0',MINIROOM_VISITOR_ONLY:visitorOnly?'1':'0',
      MINIROOM_MEMBERS_DB:path.join(dir,'accounts.sqlite')},stdio:['ignore','pipe','inherit']});
  const closed=once(server,'exit');
  try{
    const origin=await new Promise((resolve,reject)=>{
      let output='';server.stdout.on('data',chunk=>{output+=chunk;const m=output.match(/http:\/\/127\.0\.0\.1:\d+\r?\n/);if(m)resolve(m[0].trim())});
      server.once('error',reject);server.once('exit',()=>reject(Error('회원 테스트 서버 종료')));
    });
    await test(origin,path.join(dir,'accounts.sqlite'));
  }finally{server.kill();await closed;await rm(dir,{recursive:true,force:true})}
};
