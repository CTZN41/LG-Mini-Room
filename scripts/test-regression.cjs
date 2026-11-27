const {execFile}=require('node:child_process');
const {readdir}=require('node:fs/promises');
const path=require('node:path');
const {promisify}=require('node:util');
const withServer=require('../tests/member-server.cjs');
const run=promisify(execFile);
const root=path.join(__dirname,'..');
const helpers=new Set(['member-server.cjs','catalog-room-check.cjs','catalog-room-title.cjs']);

async function main(){
  const all=(await readdir(path.join(root,'tests'))).filter(file=>/\.(cjs|mjs)$/.test(file)&&!helpers.has(file));
  const requested=process.argv.slice(2);
  const queue=requested.length?requested:all;
  for(const name of queue)if(!all.includes(name))throw Error('알 수 없는 테스트 '+name);
  const total=queue.length,failed=[];
  // Both processes listen on temporary ports and use temporary account databases.
  await withServer(base=>withServer(async visitor=>{
    async function worker(){
      while(queue.length){
        const file=queue.shift(),origin=file==='visitor-experience.cjs'?visitor:base;
        try{
          await run(process.execPath,[path.join('tests',file),origin],{cwd:root,windowsHide:true,timeout:360000,maxBuffer:4*1024*1024});
          console.log('PASS',file);
        }catch(e){
          failed.push(file);
          console.error('FAIL',file,e.stderr||e.message);
        }
      }
    }
    await Promise.all([worker(),worker()]);
  },{visitorOnly:true}));
  console.log('통과 '+(total-failed.length)+'개 / 전체 '+total+'개');
  if(failed.length)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1});
