const {DatabaseSync}=require('node:sqlite');
const path=require('node:path');
function registeredModels({collectibleOnly=false}={}){
  const db=new DatabaseSync(process.env.MINIROOM_CATALOG_DB||path.join(__dirname,'../../data/lg_appliances.db'),{readOnly:true});
  try{
    const indexed=db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='camera_held'").get();
    const filter=collectibleOnly&&indexed?'WHERE NOT EXISTS (SELECT 1 FROM camera_held h WHERE h.model_code=upper(trim(p.model_name)))':'';
    return db.prepare('SELECT DISTINCT category,model_name FROM products p '+filter+' ORDER BY category,model_name').all().map(row=>[row.category,row.model_name]);
  }finally{db.close()}
}
module.exports={registeredModels};
