// Read-only worklist for the product art review. Prints JSON lines, one per model.
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {chromium}=require('playwright');
const reviews=require('../docs/catalog-art-reviews.json');

async function reviewCatalog(filter,base){
  const db=new DatabaseSync(process.env.MINIROOM_CATALOG_DB||path.join(__dirname,'../data/lg_appliances.db'),{readOnly:true});
  let rows;
  try{
    rows=db.prepare(`WITH canonical AS (SELECT MIN(product_id) id FROM products GROUP BY category,model_name)
      SELECT p.product_id id,p.category,p.model_name model,p.group_id bodyGroup,p.image_id imageId,
        p.photo_review_status photoStatus FROM canonical c JOIN products p ON p.product_id=c.id
      WHERE ?='--all' OR p.category=? OR p.model_name=? ORDER BY p.category,p.model_name`).all(filter,filter,filter);
    const components=db.prepare('SELECT component_role role,component_model model FROM product_components WHERE product_id=? ORDER BY rowid');
    for(const row of rows)row.components=components.all(row.id);
  }finally{db.close();}
  if(!rows.length)throw Error('일치하는 모델이나 제품군이 없습니다.');
  const browser=await chromium.launch({channel:'chrome'});
  try{
    const page=await browser.newPage();
    await page.goto(base+'/editor?space=dream&room=C');await page.waitForSelector('#rooms button');
    const dots=await page.evaluate(list=>list.map(({category,model})=>{
      const key=ProductCatalog.matchModel(category,model),item=ProductCatalog.restore(DotScene.products,key);
      if(!item||!key)throw Error('실행 서버의 DB 모델 불일치: '+model);
      return {key,spriteKey:item.spriteKey||key};
    }),rows);
    return rows.map((row,i)=>{
      const review=reviews[row.model];
      const decision=review?.category===row.category&&review.group===row.bodyGroup?review:null;
      return {...row,...dots[i],photo:base+'/api/catalog/photo?id='+row.id,
        decision:row.photoStatus==='보류'?'사진 보류':decision?.decision||'미판정',
        previousSprite:decision?.before||null,reason:decision?.reason||null};
    });
  }finally{await browser.close();}
}

if(require.main===module){
  const [filter,base='http://127.0.0.1:4174']=process.argv.slice(2);
  if(!filter){console.error('사용법: node scripts/review-catalog.cjs <모델명|제품군|--all> [서버 주소]');process.exitCode=1;}
  else reviewCatalog(filter,base).then(rows=>{for(const row of rows)console.log(JSON.stringify(row));})
    .catch(error=>{console.error(error);process.exitCode=1;});
}
module.exports={reviewCatalog};
