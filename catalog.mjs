import { catalogBodies } from './catalog-bodies.mjs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const defaultDB = fileURLToPath(new URL('./data/lg_appliances.db', import.meta.url));
let blockedModels, cameraFeed, hasCameraIndex;
let db,bodyIndex,legacyIndex,modelIndex,labelIndex,version;
// Checked against the refrigerator compartment specs on LG's model pages:
// https://www.lge.co.kr/refrigerators/h875gga011 and https://www.lge.co.kr/refrigerators/h875gga031
const interiorFeatures=new Map([['H875GGA011','신선플러스 트레이'],['H875GGA031','1단 접이식 선반']]);
function catalogLabels(db, held){
  const rows=db.prepare(`SELECT category,model_name,product_name,fridge_display_name,door_color,door_material,appearance
    FROM products WHERE product_id IN (SELECT MIN(product_id) FROM products GROUP BY category,model_name)
    ORDER BY category,model_name`).all();
  return rows.map(r=>{
    const color=r.door_color||r.appearance?.match(/(?:본체|세탁기) 색상 ([^·]+)/)?.[1]?.trim()||'';
    return [r.category,r.model_name,r.fridge_display_name||r.product_name,color,
      r.door_material||'',interiorFeatures.get(r.model_name)||'',held.has(r.model_name.toUpperCase())];
  });
}

// Keep one search result per existing collection key (category, model). The lowest
// product_id is also the canonical photo when opening an older saved placement.
const matchesFor = () => `FROM products p WHERE p.category=? AND ${eligibleProduct()} AND (
  instr(lower(p.model_name),lower(?)) OR instr(lower(p.product_name),lower(?)) OR
  EXISTS (SELECT 1 FROM product_components c WHERE c.product_id=p.product_id
          AND instr(lower(c.component_model),lower(?))))`;

// Compatibility data is separate from the searchable products and photo index.
function legacySales(db){
  return db.prepare('SELECT old_id,category,sale_code,unit_category,unit_code,old_choices FROM retired_sale_keys ORDER BY old_id').all()
    .map(r=>[r.old_id,r.category,r.sale_code,r.unit_category,r.unit_code,JSON.parse(r.old_choices)]);
}

// Explicit exclusions recorded in the commercial-photo review and retire-sales.py.
const excludedScanCodes=new Set(['LZ-H154GB','Z-E0250U2SC','65EP5G','55CT5WN','A948BWE','RD22WSQ','K83IGY','K83WGY']);
// Availability applies to both new collection and camera recognition. Historical
// placements still resolve through the complete product index.
function blockedCodes(){
  return `SELECT upper(trim(sale_code)) AS code FROM retired_sale_keys
    UNION ALL SELECT column1 FROM (VALUES ${Array.from(excludedScanCodes, code => `('${code}')`).join(',')})
    ${hasCameraIndex ? 'UNION ALL SELECT model_code FROM camera_held' : ''}`;
}
function eligibleProduct(){
  return `upper(trim(p.model_name)) NOT IN (SELECT code FROM (${blockedCodes()}) WHERE code IS NOT NULL)`;
}
function cameraProducts(db){
  const rows=db.prepare(`SELECT p.product_id,p.category,p.model_name,p.product_name,p.fridge_display_name
    FROM products p JOIN (SELECT MIN(p.product_id) AS id FROM products p WHERE ${eligibleProduct()}
      GROUP BY upper(trim(p.model_name)) HAVING count(DISTINCT p.category)=1) canon ON canon.id=p.product_id
    ORDER BY p.category,p.model_name`).all();
  const labels=new Map();
  if(hasCameraIndex){
    for(const {label,model_code} of db.prepare('SELECT label,model_code FROM camera_label ORDER BY model_code,label').iterate()){
      if(!labels.has(model_code))labels.set(model_code,[]);
      labels.get(model_code).push(label);
    }
  }
  return rows.map(p=>({
    id:String(p.product_id), brand:'LG', modelCode:p.model_name, category:p.category,
    displayName:p.fridge_display_name||p.product_name, source:'LG 미니룸 제품 DB',
    labelCodes:labels.get(p.model_name.trim().toUpperCase())||[]
  }));
}
function scanLookup(db,code){
  if(excludedScanCodes.has(code))return {status:'review_required',reasons:['excluded']};
  if(db.prepare('SELECT 1 FROM retired_sale_keys WHERE upper(trim(sale_code))=? LIMIT 1').get(code))
    return {status:'review_required',reasons:['retired_sale']};
  if(hasCameraIndex && db.prepare('SELECT 1 FROM camera_held WHERE model_code=?').get(code))
    return {status:'review_required',reasons:['sale_package']};
  const lookup=db.prepare(`SELECT p.category,p.model_name AS model,p.product_id AS id,
      coalesce(nullif(p.fridge_display_name,''),p.product_name) AS displayName
    FROM products p JOIN (SELECT min(product_id) AS id FROM products
      WHERE upper(trim(model_name))=? GROUP BY category) canon ON canon.id=p.product_id
    ORDER BY p.category`);
  let matches=lookup.all(code);
  if(!matches.length && hasCameraIndex){
    const alias=db.prepare('SELECT model_code FROM camera_label WHERE label=?').get(code);
    if(alias && !blockedModels.has(alias.model_code))matches=lookup.all(alias.model_code);
  }
  if(matches.length===1)return {status:'collectible',...matches[0],modelCode:matches[0].model};
  if(matches.length>1)return {status:'ambiguous',candidates:matches};
  const component=db.prepare('SELECT DISTINCT component_role FROM product_components WHERE upper(trim(component_model))=?').all(code);
  if(component.length)return {status:'review_required',reasons:component.map(r=>r.component_role==='미니워시'?'mini_wash':'component_only')};
  return {status:'not_found'};
}

export async function serveCatalog(url, response) {
  function json(status, body) {
    response.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}).end(JSON.stringify(body));
  }
  const q=url.searchParams;
  const category=q.get('category')||'';
  try {
    db??=new DatabaseSync(process.env.MINIROOM_CATALOG_DB||defaultDB,{readOnly:true});
    const current=db.prepare('PRAGMA data_version').get().data_version;
    if(current!==version){
      version=current;modelIndex=bodyIndex=legacyIndex=labelIndex=cameraFeed=undefined;
      hasCameraIndex=!!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='camera_held'").get();
      blockedModels=new Set(db.prepare(blockedCodes()).all().map(row=>row.code));
    }
    if(url.pathname==='/api/catalog/camera-products')return json(200,cameraFeed??=cameraProducts(db));
    if(url.pathname==='/api/catalog/scan'){
      const code=(q.get('code')||'').trim().toUpperCase();
      if(!code||code.length>200||/[\x00-\x1f\x7f]/.test(code))return json(400,{error:'invalid_code'});
      return json(200,scanLookup(db,code));
    }
    if(url.pathname==='/api/catalog/retired-sales')return json(200,legacyIndex??=legacySales(db));
    if(url.pathname==='/api/catalog/models'&&q.get('labels')==='1')return json(200,labelIndex??=catalogLabels(db,blockedModels));
    if(url.pathname==='/api/catalog/models')return json(200,modelIndex??=db.prepare('SELECT DISTINCT category,model_name FROM products ORDER BY category,model_name').all().map(row=>[row.category,row.model_name]));
    if(url.pathname==='/api/catalog/bundles')return json(200,[]);
    if(url.pathname==='/api/catalog/bodies')return json(200,bodyIndex??=catalogBodies(db));
    if(url.pathname==='/api/catalog/photo'){
      const byId=q.has('id');
      const photo=db.prepare(`SELECT i.data,i.mime_type FROM products p JOIN images i USING(image_id)
        WHERE ${byId?'p.product_id=?':'p.category=? AND p.model_name=?'} ORDER BY p.product_id LIMIT 1`)
        .get(...(byId?[q.get('id')]:[category,q.get('model')||'']));
      if(!photo)return json(404,{error:'photo_missing'});
      response.writeHead(200,{'Content-Type':photo.mime_type,'Cache-Control':'private, no-cache'}).end(photo.data);
      return;
    }
    if(url.pathname==='/api/catalog/product'){
      const id=Number(q.get('id'));
      if(!Number.isSafeInteger(id)||id<1)return json(400,{error:'invalid_product'});
      const product=db.prepare(`SELECT p.product_id AS id,p.category,p.model_name AS model,p.title_model AS titleModel,
        p.group_id AS appearanceGroup,g.photo_subject AS subject,p.photo_review_status AS photoStatus
        FROM products p JOIN appearance_groups g USING(group_id) WHERE p.product_id=?`).get(id);
      if(!product)return json(404,{error:'product_missing'});
      const components=db.prepare(`SELECT c.component_group_id AS componentGroup,c.component_role AS role,
        c.component_model AS model,c.evidence,c.specification,unit.category AS category,g.photo_subject AS subject
        FROM product_components c LEFT JOIN products unit ON unit.product_id=(
          SELECT MIN(p.product_id) FROM products p WHERE p.model_name=c.component_model
          AND p.category=CASE WHEN c.component_role IN ('워시타워','워시콤보','트윈워시','미니워시')
                              THEN '세탁기' WHEN c.component_role='판매 상품' AND c.component_model=?
                              THEN ? ELSE c.component_role END)
        LEFT JOIN appearance_groups g ON g.group_id=unit.group_id
        WHERE c.product_id=? ORDER BY (c.component_model=?) DESC,c.rowid`).all(product.model,product.category,id,product.titleModel);
      return json(200,{...product,components});
    }
    const query=(q.get('q')||'').trim().slice(0,100);
    const offset=Number(q.get('offset')||0);
    if(!Number.isSafeInteger(offset)||offset<0)return json(400,{error:'invalid_offset'});
    const matches=matchesFor();
    const args=[category,query,query,query];
    const total=db.prepare('SELECT COUNT(DISTINCT p.model_name) AS n '+matches).get(...args).n;
    const rows=db.prepare(`WITH page AS (SELECT (SELECT MIN(canon.product_id) FROM products canon WHERE canon.category=p.category AND canon.model_name=p.model_name) AS id ${matches}
      GROUP BY p.model_name ORDER BY (p.model_name=?) DESC,p.model_name LIMIT 16 OFFSET ?)
      SELECT p.product_id AS id,p.model_name AS model,p.product_name AS name FROM page
      JOIN products p ON p.product_id=page.id
      ORDER BY (p.model_name=?) DESC,p.model_name`).all(...args,q.get('featured')||'',offset,q.get('featured')||'');
    json(200,{total,rows});
  }catch{
    json(503,{error:'catalog_unavailable'});
  }
}
