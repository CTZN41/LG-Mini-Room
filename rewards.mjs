import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import {operations} from './community.mjs';

const families={tv:'TV',washer:'세탁기',fridge:'냉장고',dryer:'건조기',purifier:'공기청정기',humid:'가습기',dehumid:'제습기',stick:'무선청소기',robot:'로봇청소기',ac:'에어컨',sensor:'센서',switch:'조명 스위치',hub:'AI 홈 허브'};
const kinds={tv:'TV',light:'조명',curtain:'커튼',air:'에어컨',purifier:'공기청정기',washer:'세탁기',styler:'스타일러',robot_vacuum:'로봇청소기'};
const cameraNames={'스탠바이미':'TV','벽걸이형 에어컨':'에어컨','시스템 에어컨':'에어컨','의류관리기':'스타일러','세탁 건조기':'세탁기','가습 공기청정기':'공기청정기'};
let catalog;
function products(){
  return catalog??=new DatabaseSync(process.env.MINIROOM_CATALOG_DB||fileURLToPath(new URL('./data/lg_appliances.db',import.meta.url)),{readOnly:true});
}
function identity(key){
  if(typeof key!=='string'||key.length>150)return null;
  const legacy=/^washer_([a-z0-9]+)$/.exec(key);
  const found=/^catalog:([a-z]+):([^:]+)$/.exec(key);
  if(!legacy&&(!found||!Object.hasOwn(families,found[1])))return null;
  const category=legacy?'세탁기':families[found[1]];
  let code;try{code=legacy?legacy[1].toUpperCase():decodeURIComponent(found[2])}catch{return null}
  return products().prepare('SELECT 1 FROM products WHERE category=? AND model_name=? LIMIT 1').get(category,code)?category+'/'+code:null;
}
export function setupRewards(db){
  db.exec(`CREATE TABLE IF NOT EXISTS rewards(
    owner TEXT NOT NULL REFERENCES members(id),kind TEXT NOT NULL,event TEXT NOT NULL,points INTEGER NOT NULL,half_xp INTEGER NOT NULL,
    created INTEGER NOT NULL,PRIMARY KEY(owner,kind,event));
    CREATE TABLE IF NOT EXISTS coupons(owner TEXT NOT NULL REFERENCES members(id),family TEXT NOT NULL,import_id INTEGER NOT NULL REFERENCES imports(id),
    created INTEGER NOT NULL,PRIMARY KEY(owner,family));`);
}
function grant(db,id,kind,event,points,halfXp){
  return db.prepare('INSERT INTO rewards VALUES(?,?,?,?,?,?) ON CONFLICT DO NOTHING').run(id,kind,event,points,halfXp,Date.now()).changes;
}
function states(db,id){
  return db.prepare("SELECT value FROM saves WHERE owner=? AND key IN ('lg-miniroom.state','lg-miniroom.state.thinq')").all(id).map(r=>JSON.parse(r.value));
}
function ownedFamilies(homes){
  const owned=new Set();
  for(const h of homes){
    if(h.myFixtureId==='sample-light-v1')owned.add('조명');
    if(h.myFixtureId==='sample-home-v1'){
      for(const family of ['에어컨','공기청정기','세탁기','냉장고','무선청소기','로봇청소기'])owned.add(family);
      if((h.registeredTvIds??['my-tv-1']).length)owned.add('TV');
      if(h.myLayout?.['light-slot'])owned.add('조명');
    }
    for(const d of h.cameraAppliances||[]){
      if(!d||typeof d.modelCode!=='string')continue;
      const row=products().prepare('SELECT category FROM products WHERE model_name=? LIMIT 1').get(d.modelCode);
      owned.add(row?.category||cameraNames[d.category]||d.category);
      if(d.category==='청소기'&&/로봇|로보킹|로보틱|R9|M9/i.test(d.displayName))owned.add('로봇청소기');
    }
  }
  return owned;
}
export function rewardImport(db,owner,id,recipe){
  if(!grant(db,owner,'friend',String(id),10,2))return;
  const owned=ownedFamilies(states(db,owner));
  const put=db.prepare('INSERT INTO coupons VALUES(?,?,?,?) ON CONFLICT DO NOTHING');
  for(const step of recipe.steps){
    const kind=operations[step.operation]?.[0],family=kinds[kind];
    if(family&&!owned.has(family))put.run(owner,family,id,Date.now());
  }
}
function collectionProgress(db,id){
  const keys=new Map();
  for(const h of states(db,id)){
    for(const key of new Set(h.collection||[])){
      const model=identity(key);if(model)keys.set(key,model);
    }
  }
  const layout=db.prepare("SELECT value FROM saves WHERE owner=? AND key='dotroom'").get(id);
  const rooms=Object.values(layout?JSON.parse(layout.value).layouts:{});
  const placed=rooms.some(items=>Array.isArray(items)&&items.some(o=>o&&!o.exhibit&&keys.has(o.k)));
  return {models:new Set(keys.values()),placed};
}
export function claim(db,id){
  const progress=collectionProgress(db,id);
  let collected=db.prepare("SELECT count(*) AS n FROM rewards WHERE owner=? AND kind='collection'").get(id).n;
  for(const model of progress.models){
    collected+=grant(db,id,'collection',model,1,collected===0?0:1);
  }
  if(progress.placed)grant(db,id,'tutorial','first-placement',300,2);
  for(const copy of db.prepare('SELECT id,recipe FROM imports WHERE owner=?').all(id))
    rewardImport(db,id,copy.id,JSON.parse(copy.recipe));
}
export function levelFor(xp){return Math.min(99,1+Math.floor(xp/10))}
export function wallet(db,id){
  const totals=db.prepare('SELECT coalesce(sum(points),0) points,coalesce(sum(half_xp),0) half FROM rewards WHERE owner=?').get(id);
  const counts=Object.fromEntries(db.prepare('SELECT kind,count(*) n FROM rewards WHERE owner=? GROUP BY kind').all(id).map(r=>[r.kind,r.n]));
  const xp=totals.half/2;
  const coupons=db.prepare('SELECT family,import_id AS importId,created FROM coupons WHERE owner=? ORDER BY created,family').all(id);
  return {points:totals.points,xp,level:levelFor(xp),counts,coupons};
}
