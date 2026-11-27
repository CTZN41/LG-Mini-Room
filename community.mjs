import {createHash} from 'node:crypto';

export function setupCommunity(db){
  db.exec(`CREATE TABLE IF NOT EXISTS guest_notes(
      id INTEGER PRIMARY KEY, room_owner TEXT NOT NULL REFERENCES members(id), space TEXT NOT NULL,
      writer TEXT NOT NULL REFERENCES members(id), message TEXT NOT NULL, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS imports(
      id INTEGER PRIMARY KEY, owner TEXT NOT NULL REFERENCES members(id), source TEXT NOT NULL REFERENCES members(id),
      share TEXT NOT NULL, recipe TEXT NOT NULL, UNIQUE(owner,source,share));`);
}
const titles={'movie-night':'영화 보기','cleaning-time':'청소 시간','room-comfort':'쾌적한 방','clothes-care':'의류 관리'};
export const operations={
  'tv-on':['tv','TV 켜기'],'light-dim':['light','조명 30%'],'light-off':['light','조명 끄기'],'curtain-close':['curtain','커튼 닫기'],
  'air-cool':['air','에어컨 냉방'],'air-clean':['purifier','자동 청정'],'wash-normal':['washer','표준 세탁'],
  'style-refresh':['styler','의류 리프레시'],'robot-clean':['robot_vacuum','바닥 청소']
};
export function publicRecipes(saves){
  const home=JSON.parse(saves['lg-miniroom.state']||saves['lg-miniroom.state.thinq']||'{}');
  const recipes=[];
  for(const r of home.savedRoutines||[]){
    if(!r||typeof r.templateId!=='string'||!Array.isArray(r.actions)||!r.bindings)continue;
    const steps=[];
    for(const a of r.actions){
      const operation=a?.operation||a?.actionId;
      if(!Object.hasOwn(operations,operation)||!r.bindings[a.actionId])continue;
      steps.push({operation,required:a.required!==false,label:operations[operation][1]});
    }
    const name=r.custom?r.name:titles[r.templateId];
    if(!steps.length||typeof name!=='string')continue;
    // No private device ID, account display name, schedule or room-item ID leaves the owner's snapshot.
    const share=createHash('sha256').update(JSON.stringify([r.templateId,r.anchorId])).digest('hex');
    recipes.push({share,name:name.slice(0,32),steps});
  }
  return recipes;
}
export function notes(db,owner,space){
  return db.prepare(`SELECT m.nickname,n.message,n.created FROM guest_notes n JOIN members m ON m.id=n.writer
    WHERE room_owner=? AND space=? ORDER BY n.id DESC LIMIT 50`).all(owner,space);
}
export function listImports(db,owner){
  return db.prepare('SELECT id,recipe FROM imports WHERE owner=? ORDER BY id DESC').all(owner)
    .map(r=>({id:r.id,...JSON.parse(r.recipe)}));
}
