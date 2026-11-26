import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const runFile=promisify(execFile);
let pendingInventory;
async function sendInventory(request,response){
  const json=(status,body)=>response.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store"}).end(JSON.stringify(body));
  if(!process.env.THINQ_PAT)return json(200,{mode:"demo"});
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
  if(path==="/api/catalog/retired-sales"||path==="/api/catalog/models"||path==="/api/catalog/bundles"||path==="/api/catalog/bodies"||path==="/api/catalog"||path==="/api/catalog/photo"||path==="/api/catalog/product")
    return (await import('./catalog.mjs')).serveCatalog(new URL(request.url,'http://localhost'),response);
  if(path==="/api/my-appliances")return sendInventory(request,response);
  const page = pages.get(path);

  if (!page) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const [file, contentType] = page;
  try {
    const body = await readFile(new URL("./public/" + file, import.meta.url));
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
