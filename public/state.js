const key = 'lg-miniroom.state';
export const model = 'demo-tv-01';
export const actions = [
  {actionId:'tv-on',kind:'tv',capability:'power.set',value:true,required:true},
  {actionId:'light-dim',kind:'light',capability:'brightness.set',value:30,required:false},
  {actionId:'curtain-close',kind:'curtain',capability:'position.set',value:'closed',required:false}
];
export const devices = [
  {id:'my-tv-1',kind:'tv',name:'거실 TV',capability:'power.set'},
  {id:'my-tv-2',kind:'tv',name:'침실 TV',capability:'power.set'},
  {id:'my-light-1',kind:'light',name:'거실 조명',capability:'brightness.set'}
];
export const movieTemplate={id:'movie-night',name:'영화 보기',anchor:'sofa',actions};
export const applianceGroups={
  air:{label:'에어컨',keys:['tower_ac','wall_ac']},
  purifier:{label:'공기청정기',keys:['puri_p','puri_m','puri_b']},
  washer:{label:'워시타워',keys:['wash_m','wash_b','wash_s']},
  styler:{label:'스타일러',keys:['styler']}
};
export const applianceTemplates=[
  {id:'room-comfort',name:'쾌적한 방',anchor:'air',actions:[
    {actionId:'air-cool',kind:'air',capability:'mode.set',value:'cool',label:'냉방',required:true},
    {actionId:'air-clean',kind:'purifier',capability:'mode.set',value:'auto',label:'자동 청정',required:false}
  ]},
  {id:'clothes-care',name:'의류 관리',anchor:'washer',actions:[
    {actionId:'wash-normal',kind:'washer',capability:'cycle.set',value:'normal',label:'표준 세탁',required:true},
    {actionId:'style-refresh',kind:'styler',capability:'cycle.set',value:'refresh',label:'리프레시',required:false}
  ]}
];
const empty = {schemaVersion:1,revision:0,collection:[],dreamLayout:{},myFixtureId:null,myLayout:{},savedRoutines:[]};
export let state=structuredClone(empty);
let previous, blocked=false;
export let storageMessage='';
try {
  previous=localStorage.getItem(key);
  if(previous!==null){
    const s=JSON.parse(previous);
    if(s?.schemaVersion!==1 || !Number.isInteger(s.revision) || !Array.isArray(s.collection) ||
      !s.dreamLayout || !s.myLayout || !Array.isArray(s.savedRoutines) ||
      s.savedRoutines.some(r=>!r || !r.bindings || !r.exclusions)) throw Error();
    state=s;
  }
} catch {blocked=true; storageMessage='저장 데이터를 열 수 없어요. 예시 방을 둘러볼 수 있어요.';}
export function update(change){
  if(blocked) throw Error(storageMessage);
  if(localStorage.getItem(key)!==previous) throw Error('저장본이 바뀌었어요. 새로고침해 주세요.');
  const next=structuredClone(state);
  change(next);next.revision++;
  const raw=JSON.stringify(next);
  localStorage.setItem(key,raw);
  previous=raw;state=next;
}
export function registeredTVs(){
  // Version-one homes shipped with the living-room TV as their only registered TV.
  return state.myFixtureId==='sample-home-v1'?(state.registeredTvIds??['my-tv-1']):[];
}
export function saveRoutines(records){
  update(s=>{
    for(const record of records){
      s.savedRoutines=s.savedRoutines.filter(r=>r.templateId!==record.templateId||r.anchorId!==record.anchorId);
      s.savedRoutines.push(record);
    }
  });
}
export function candidates(action){
  if(state.myFixtureId!=='sample-home-v1')return [];
  return devices.filter(d=>d.kind===action.kind && d.capability===action.capability &&
    (d.kind!=='tv'||registeredTVs().includes(d.id)));
}
export function routine(bindings,template=movieTemplate,deviceOptions=candidates){
  const applied={},exclusions={};
  for(const action of template.actions){
    const id=action.actionId, compatible=deviceOptions(action);
    if(compatible.some(d=>d.id===bindings[id])) applied[id]=bindings[id];
    else if(action.required) throw Error((action.label||'TV 켜기')+'에 연결할 기기를 선택해 주세요.');
    else exclusions[id]=compatible.length?'unselected':'no_device';
  }
  return {templateId:template.id,templateVersion:1,anchorId:template.anchor,actions:structuredClone(template.actions),bindings:applied,exclusions};
}

// Observation is opt-in and scoped to the current browser tab.
export const observing = new URLSearchParams(location.search).get('observe') === '1';
const observationKey = 'lg-miniroom.events';
function observationRows(){
  const rows=JSON.parse(sessionStorage.getItem(observationKey)||'[]');
  if(!Array.isArray(rows))throw Error('관찰 기록을 열 수 없어요.');
  return rows;
}
export function logObservation(event,room,source,templateId='movie-night'){
  if(!observing)return;
  try{
    const rows=observationRows();
    let sessionId=sessionStorage.getItem('lg-miniroom.session');
    if(!sessionId){
      sessionId=Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16).padStart(8,'0')).join('');
      sessionStorage.setItem('lg-miniroom.session',sessionId);
    }
    rows.push({event,sessionId,time:new Date().toISOString(),room,source,templateId});
    sessionStorage.setItem(observationKey,JSON.stringify(rows));
  }catch{/* Observation storage is independent of room and routine storage. */}
}
export function savedObservationSource(fallback,templateId='movie-night'){
  if(observing)try{
    return observationRows().findLast(row=>row.event==='routine_saved'&&row.templateId===templateId)?.source||fallback;
  }catch{}
  return fallback;
}
export function exportObservation(){
  if(!observing)return;
  const events=observationRows().map(({event,sessionId,time,room,source,templateId})=>({event,sessionId,time,room,source,templateId}));
  const file=new Blob([JSON.stringify({version:1,events},null,2)],{type:'application/json'});
  const link=document.createElement('a'),url=URL.createObjectURL(file);
  link.href=url;link.download='miniroom-observation-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
  link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
