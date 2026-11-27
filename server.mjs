import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import {bootstrap, memberFor, serveMembers} from './members.mjs';
import {weatherService} from './weather.mjs';
import {evaluateRule,needsWeather,validateRule} from './public/routine-conditions.mjs';
let weatherKey=process.env.MINIROOM_KMA_KEY;
if(!weatherKey && process.platform==='win32' && process.env.LOCALAPPDATA && process.env.MINIROOM_WEATHER_PROVIDER!=='open-meteo'){
  try{
    weatherKey=(await readFile(join(process.env.LOCALAPPDATA,'LG Mini Room','secrets','kma.key'),'utf8')).trim();
  }catch(error){
    if(error.code!=='ENOENT')console.warn('기상청 로컬 인증 설정을 읽을 수 없습니다.');
  }
}
const routineContext=weatherService({key:weatherKey});
const require = createRequire(import.meta.url);

const runFile=promisify(execFile);
let pendingInventory;
async function sendInventory(request,response){
  const json=(status,body)=>response.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store"}).end(JSON.stringify(body));
  if(memberFor(request)||!process.env.THINQ_PAT)return json(200,{mode:"demo"});
  const localAddresses=["127.0.0.1","::1","::ffff:127.0.0.1"];
  if(!localAddresses.includes(request.socket.remoteAddress)||
    !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(request.headers.host||""))
    return json(403,{mode:"unavailable"});
  try{
    pendingInventory??=runFile(process.env.MINIROOM_PYTHON||"python",[fileURLToPath(new URL("./thinq_inventory.py",import.meta.url))],{timeout:20000,windowsHide:true})
      .then(({stdout})=>JSON.parse(stdout)).finally(()=>{pendingInventory=undefined});
    return json(200,{mode:"thinq",devices:await pendingInventory});
  }catch{return json(503,{mode:"unavailable"})}
}

const host = process.env.LG_MINI_ROOM_HOST || "127.0.0.1";
const port = Number(process.env.LG_MINI_ROOM_PORT ?? "4173");
const visitorOnly = process.env.MINIROOM_VISITOR_ONLY === "1";
const guestPages = new Map([
  ["/experience", ["experience.html", "text/html; charset=utf-8"]],
  ["/experience/qr", ["experience-qr.html", "text/html; charset=utf-8"]],
  ["/experience.js", ["experience.js", "text/javascript; charset=utf-8"]],
  ["/experience.css", ["experience.css", "text/css; charset=utf-8"]],
  ["/experience-tv.jpg", ["experience-tv.jpg", "image/jpeg"]],
]);
const guestAssets = new Set(["/dot-assets.js","/dot-scene.js","/purifier-profiles.js","/catalog-art.js","/product-catalog.js","/state.js"]);
const pages = new Map([
  ...guestPages,
  ["/miniroom/home", ["mini-home.html","text/html; charset=utf-8"]],
  ["/mini-shell.css", ["mini-shell.css","text/css; charset=utf-8"]],
  ...["jua","silkscreen"].map(name=>[`/fonts/${name}.woff`,[`fonts/${name}.woff`,"font/woff"]]),
  ["/fonts/status.ttf", ["fonts/status.ttf","font/ttf"]],
  ["/mini-music.css", ["mini-music.css","text/css; charset=utf-8"]],
  ["/mini-music.js", ["mini-music.js","text/javascript; charset=utf-8"]],
  ["/mini-home.js", ["mini-home.js","text/javascript; charset=utf-8"]],
  ["/mini-home.css", ["mini-home.css","text/css; charset=utf-8"]],
  ["/miniroom/start", ["onboarding.html","text/html; charset=utf-8"]],
  ["/onboarding.js", ["onboarding.js","text/javascript; charset=utf-8"]],
  ...['banner','bell','signals','room','transition','grass','door','door-cat','sky','loading-cat','pointer',
    'nav-home','nav-grid','nav-room','nav-care','nav-menu'].map(name=>['/onboarding/'+name+'.svg',['onboarding/'+name+'.svg','image/svg+xml']]),
  ["/login", ["login.html","text/html; charset=utf-8"]],
  ["/login.js", ["login.js","text/javascript; charset=utf-8"]],
  ["/login.css", ["login.css","text/css; charset=utf-8"]],
  ...['routine-conditions','routine-places','routine-condition-editor'].map(name=>['/'+name+'.mjs',[name+'.mjs','text/javascript; charset=utf-8']]),
  ["/members", ["members.html", "text/html; charset=utf-8"]],
  ["/members.js", ["members.js", "text/javascript; charset=utf-8"]],
  ["/account-storage.js", ["account-storage.js", "text/javascript; charset=utf-8"]],
  ["/thinq/shell.css", ["thinq/shell.css", "text/css; charset=utf-8"]],
  ["/thinq/shell.js", ["thinq/shell.js", "text/javascript; charset=utf-8"]],
  ...["home","support","devices","care","energy","usage","coupon"].map(name => {
    const file = "thinq/" + name + ".webp";
    return ["/" + file, [file, "image/webp"]];
  }),
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/editor", ["dot-room.html", "text/html; charset=utf-8"]],
  ["/dot-room.html", ["dot-room.html", "text/html; charset=utf-8"]],
  ["/dot-editor.css", ["dot-editor.css", "text/css; charset=utf-8"]],
  ["/dot-assets.js", ["dot-assets.js", "text/javascript; charset=utf-8"]],
  ["/purifier-profiles.js", ["purifier-profiles.js", "text/javascript; charset=utf-8"]],
  ["/catalog-art.js", ["catalog-art.js", "text/javascript; charset=utf-8"]],
  ["/product-catalog.js", ["product-catalog.js", "text/javascript; charset=utf-8"]],
  ["/dot-scene.js", ["dot-scene.js", "text/javascript; charset=utf-8"]],
  ["/dot-editor.js", ["dot-editor.js", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/room.js", ["room.js", "text/javascript; charset=utf-8"]],
  ["/state.js", ["state.js", "text/javascript; charset=utf-8"]],
]);

const server = createServer(async (request, response) => {
  if(!visitorOnly&&request.url?.startsWith('/api/members/'))
    return serveMembers(request,response,new URL(request.url,'http://localhost'));
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }

  const path = (request.url ?? "").split("?", 1)[0];
  if (path === "/experience-qr.js") {
    try {
      const body = await readFile(require.resolve("qrcode-generator"));
      response.writeHead(200, {"Content-Type":"text/javascript; charset=utf-8"}).end(request.method === "HEAD" ? undefined : body);
    } catch { response.writeHead(503).end("Install dependencies with npm ci"); }
    return;
  }
  if (visitorOnly && path === "/") { response.writeHead(302,{Location:"/experience"}).end(); return; }
  if (visitorOnly && !guestPages.has(path) && !guestAssets.has(path)) { response.writeHead(404).end(); return; }
  if(path==='/api/catalog/scan'||path==='/api/catalog/camera-products'){
    response.setHeader('Vary','Origin');
    if(request.headers.origin==='https://lg-camera-lab.pages.dev')
      response.setHeader('Access-Control-Allow-Origin',request.headers.origin);
    return (await import('./catalog.mjs')).serveCatalog(new URL(request.url,'http://localhost'),response);
  }
  if(path==="/api/catalog/retired-sales"||path==="/api/catalog/models"||path==="/api/catalog/bundles"||path==="/api/catalog/bodies"||path==="/api/catalog"||path==="/api/catalog/photo"||path==="/api/catalog/product")
    return (await import('./catalog.mjs')).serveCatalog(new URL(request.url,'http://localhost'),response);
  if(path==="/api/routine-context"){
    const params=new URL(request.url,'http://localhost').searchParams;
    try{
      const rule=params.has('rule')?JSON.parse(params.get('rule')):undefined;
      if(rule!==undefined)validateRule(rule);
      const result=await routineContext(rule&&!needsWeather(rule)?null:params.get('place'));
      if(rule)result.check=evaluateRule(rule,result);
      response.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(result));
    }catch{
      response.writeHead(400,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({error:'지역과 조건을 확인해 주세요.'}));
    }
    return;
  }
  if(path==="/api/my-appliances")return sendInventory(request,response);
  const page = pages.get(path);

  if (!page) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const [file, contentType] = page;
  try {
    const params=new URL(request.url,'http://localhost').searchParams;
    const inRoom=file==='dot-room.html'&&params.get('app')==='thinq';
    const isMember=(file==='index.html'||file==='members.html'||file==='login.html'||file==='mini-home.html'||inRoom)&&memberFor(request);
    const redirect=target=>response.writeHead(302,{Location:target,'Cache-Control':'no-store'}).end();
    if(file==='index.html'&&!isMember&&!params.size)return redirect('/?tab=devices');
    if(file==='members.html'&&!isMember)return redirect('/login');
    if((inRoom||file==='mini-home.html')&&!isMember)return redirect('/miniroom/start?'+new URLSearchParams({next:request.url}));
    if(file==='dot-room.html'&&params.get('space')==='menu'&&!params.has('observe')&&(isMember||memberFor(request)))return redirect('/miniroom/home?space=dream');
    if(file==='login.html'&&isMember){
      const next=params.get('next');
      return redirect(next&&/^\/(?:editor|miniroom\/home)\?[^#\r\n]*$/.test(next)?next:params.get('from')==='miniroom'?'/miniroom/home?space=dream':'/');
    }
    let body = await readFile(new URL("./public/" + file, import.meta.url));
    if(file==='experience-qr.html'&&!visitorOnly)
      body=Buffer.from(body.toString().replace('data-entry="/experience"','data-entry="/miniroom/start"').replace('href="/experience"','href="/miniroom/start"'));
    if(file==='dot-room.html'||file==='members.html'){
      const snapshot=bootstrap(request);
      if(snapshot){
        const data=JSON.stringify(snapshot).replaceAll('<','\\u003c');
        body=Buffer.from(body.toString().replace('<head>',()=>'<head><script type="application/json" id="account-data">'+data+'</script>'));
      }
    }
    response.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": body.length,
      "Cache-Control": "no-store",
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch (error) {
    console.error("Could not read the local page:", error.code);
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Unable to load the local page");
  }
});

server.on("error", (error) => {
  console.error("Could not start the Mini Room server:", error.message);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log("LG Mini Room is running at http://" + host + ":" + server.address().port);
});
