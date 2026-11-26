import { catalogBodies } from './catalog-bodies.mjs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const defaultDB = fileURLToPath(new URL('./data/lg_appliances.db', import.meta.url));
let db,bodyIndex,legacyIndex,modelIndex,version;

// Keep one search result per existing collection key (category, model). The lowest
// product_id is also the canonical photo when opening an older saved placement.
const matches = `FROM products p WHERE p.category=? AND (
  instr(lower(p.model_name),lower(?)) OR instr(lower(p.product_name),lower(?)) OR
  EXISTS (SELECT 1 FROM product_components c WHERE c.product_id=p.product_id
          AND instr(lower(c.component_model),lower(?))))`;

// Compatibility data is separate from the searchable products and photo index.
function legacySales(db){
  return db.prepare('SELECT old_id,category,sale_code,unit_category,unit_code,old_choices FROM retired_sale_keys ORDER BY old_id').all()
    .map(r=>[r.old_id,r.category,r.sale_code,r.unit_category,r.unit_code,JSON.parse(r.old_choices)]);
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
    if(current!==version){version=current;modelIndex=bodyIndex=legacyIndex=undefined;}
    if(url.pathname==='/api/catalog/retired-sales')return json(200,legacyIndex??=legacySales(db));
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
                              THEN '세탁기' ELSE c.component_role END)
        LEFT JOIN appearance_groups g ON g.group_id=unit.group_id
        WHERE c.product_id=? ORDER BY (c.component_model=?) DESC,c.rowid`).all(id,product.titleModel);
      return json(200,{...product,components});
    }
    const query=(q.get('q')||'').trim().slice(0,100);
    const offset=Number(q.get('offset')||0);
    if(!Number.isSafeInteger(offset)||offset<0)return json(400,{error:'invalid_offset'});
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
