const assert = require('node:assert/strict');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { chromium } = require('playwright');
const { verifyPhone } = require('./catalog-room-check.cjs');

const base = process.argv[2] || 'http://127.0.0.1:4174';
const families = [
  ['냉장고','fridge',['B052S15','W0082GLE','J825GBB442','D646GBB021']],
  ['무선청소기','vacuum',['A938RA','AS9272WD','AO9571GKT','AU9202WD']],
  ['로봇청소기','robot_vacuum',['N95THU','B95AWBH']],
  ['제습기','dehumidifier',['DQ134MWEC','DQ202PPBC']],
  ['가습기','humidifier',['AW141YBW','HY505RWLL','HY704RSUA']]
];

(async () => {
  const db = new DatabaseSync(path.join(__dirname,'../data/lg_appliances.db'),{readOnly:true});
  const rows = db.prepare(`SELECT p.category,p.model_name model,i.sha256 photo FROM products p JOIN images i USING(image_id)
    WHERE p.product_id IN (SELECT min(product_id) FROM products GROUP BY category,model_name)`).all()
    .filter(r=>families.some(([category])=>category===r.category));
  db.close();
  const browser = await chromium.launch({channel:'chrome'});
  try {
    const page = await browser.newPage();
    await page.goto(base+'/editor?space=dream&room=C');
    await page.waitForSelector('#rooms button');
    const result = await page.evaluate(rows=>{
      const examples={
        B052S15:['miniCube',''],D646GBB021:['drawerFour',''],J825GBB442:['four','windowWater'],
        W0082GLE:['wineShort',''],A938RA:['stickA9','bare'],AS9272WD:['stickA9','stand'],
        AO9571GKT:['stickA9S','sideTower'],AU9202WD:['stickA9','dock']
      };
      const photos=new Map(),recipes=new Set(),counts={};
      for(const {category,model,photo} of rows){
        const k=ProductCatalog.matchModel(category,model),item=ProductCatalog.restore(DotScene.products,k);
        if(!item.appearance)throw Error('외형 누락 '+model);
        if(['냉장고','무선청소기'].includes(category)&&!item.body?.decision)throw Error('사진 판정 누락 '+model);
        if(examples[model]){
          const [shape,detail]=examples[model];
          if(item.body.shape!==shape||item.body.detail!==detail)throw Error('대표 외형 '+model);
          delete examples[model];
        }
        const old=photos.get(photo);
        if(old && old!==item.spriteKey)throw Error('동일 사진 도트 불일치 '+model+' '+old+' '+item.spriteKey);
        photos.set(photo,item.spriteKey);
        counts[category]=(counts[category]||0)+1;
        if(recipes.has(item.spriteKey))continue;
        recipes.add(item.spriteKey);
        for(const turn of [0,1,2,3]){
          const o={id:1,k,x:18,y:18,e:0,f:turn%2,turn};
          const get=t=>DotScene.place('C',t,o).s;
          const s=get('pink');
          if(s.im!==get('lime').im)throw Error('테마에 따른 제품 변색 '+model);
          const outlet=category==='냉장고'?s.doorEdge:category==='제습기'?s.outlet:category==='가습기'?s.mistOutlet:null;
          if(['냉장고','제습기','가습기'].includes(category)&&(!outlet||!s.pixels[(outlet[1]*s.w+outlet[0])*4+3]))throw Error('효과 기준점 '+model);
          if(item.hasDock){
            const part=p=>DotScene.place('C','pink',{...o,robotPart:p}).s;
            if(part('station').im===part('mobile').im)throw Error('고정 도크 '+model);
          }
        }
      }
      if(Object.keys(examples).length)throw Error('대표 모델 누락 '+Object.keys(examples).join(','));
      return {counts,photos:photos.size,recipes:recipes.size};
    },rows);
    console.log(result);
    await page.close();
    await Promise.all([[320,568],[390,844]].map(async ([w,h])=>{
      for(const [category,reaction,models] of families){
        await verifyPhone(browser,base,w,h,models.map(model=>({model,reaction})),category,reaction,'phase10-11');
      }
    }));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
