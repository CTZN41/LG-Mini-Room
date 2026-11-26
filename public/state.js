let key = 'lg-miniroom.state';
export const model = 'demo-tv-01';
export function isCollectibleProduct(k){
  return typeof ProductCatalog!=='undefined'&&ProductCatalog.hasModel(k);
}
// Adapter boundary: a selected File in, an ordered list of catalog product keys out.
// The examples are independent of the file contents. No image leaves the browser.
export const photoProvider='example';

const photoExamples={
  single:['catalog:tv:55LX1QKNA'],
  multiple:['catalog:fridge:M876GBC472','catalog:fridge:B315DS11','catalog:fridge:S836MDS002'],
  none:[]
};

export async function recognizePhoto(file,{example,signal}){
  if(!(file instanceof File))throw new TypeError('제품 사진을 선택해 주세요.');
  signal.throwIfAborted();
  await new Promise((resolve,reject)=>{
    function cancel(){clearTimeout(timer);reject(signal.reason)}
    const timer=setTimeout(()=>{
      signal.removeEventListener('abort',cancel);
      resolve();
    },450);
    signal.addEventListener('abort',cancel,{once:true});
  });
  if(!Object.hasOwn(photoExamples,example))throw Error('후보 조회 실패');
  return photoExamples[example];
}

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
  washer:{label:'세탁기',keys:['wash_m','wash_b','wash_s',...(typeof DOT_ASSETS==='undefined'?[]:DOT_ASSETS.items.filter(p=>p.washerStyle&&p.washerStyle!=='drawer').map(p=>p.k))]},
  styler:{label:'스타일러',keys:['styler']},
  robot_vacuum:{label:'로봇청소기',keys:['robot_vacuum']}
};
const purifyAir={actionId:'air-clean',kind:'purifier',capability:'mode.set',value:'auto',label:'자동 청정',required:false};
export const applianceTemplates=[
  {id:'room-comfort',name:'쾌적한 방',anchor:'air',actions:[
    {actionId:'air-cool',kind:'air',capability:'mode.set',value:'cool',label:'냉방',required:true},
    purifyAir
  ]},
  {id:'clothes-care',name:'의류 관리',anchor:'washer',actions:[
    {actionId:'wash-normal',kind:'washer',capability:'cycle.set',value:'normal',label:'표준 세탁',required:true},
    {actionId:'style-refresh',kind:'styler',capability:'cycle.set',value:'refresh',label:'리프레시',required:false}
  ]},
  {id:'cleaning-time',name:'청소 시간',anchor:'robot_vacuum',actions:[
    {actionId:'robot-clean',kind:'robot_vacuum',capability:'operation.set',value:'start',label:'바닥 청소',required:true},
    purifyAir
  ]}
];
const empty = {schemaVersion:1,revision:0,collection:[],dreamLayout:{},myFixtureId:null,myLayout:{},savedRoutines:[]};
export let state=structuredClone(empty);
let previous, blocked=false;
export let storageMessage='';
function readState(){
  blocked=false;storageMessage='';state=structuredClone(empty);
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
}
const guestVisit = location.pathname === '/experience';
if (!guestVisit) readState();
export let homeSource='demo';
let accountDevices=[];
async function fetchHome(){
  const response=await fetch('/api/my-appliances',{cache:'no-store'});
  if(!response.ok)throw Error();
  const result=await response.json();
  if(result.mode!=='demo'&&(result.mode!=='thinq'||!Array.isArray(result.devices)))throw Error();
  return result;
}
export async function loadHome(){
  try{
    const result=await fetchHome();
    if(result.mode==='demo')return;
    accountDevices=matchedAccountDevices(result.devices);
    homeSource='thinq';
    key='lg-miniroom.state.thinq';readState();
  }catch{homeSource='unavailable';accountDevices=[]}
}
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
  if(homeSource!=='demo')return registeredAppliances().filter(d=>d.kind==='tv').map(d=>d.id);
  // Version-one homes shipped with the living-room TV as their only registered TV.
  return sampleTvIds(state);
}
function sampleTvIds(home){
  return home?.myFixtureId==='sample-home-v1'?(home.registeredTvIds??['my-tv-1']):[];
}
// This fixture represents the device list from ThinQ in the local MVP.
// Product keys describe a sprite; device IDs identify individual registered units.
// Device IDs remain stable when the demo account moves from generic sprites to DB models.
export const demoModels={
  tvset:'catalog:tv:55LX1QKNA',standbyme:'catalog:tv:27LX6TPGA',
  puri_p:'catalog:purifier:AS206NGHA',wash_m:'washer_wl2521wdur',
  fridge_bm:'catalog:fridge:M876GBC472',fridge_pb:'catalog:fridge:B315DS11',
  fridge_sg:'catalog:fridge:S836MDS002',vacuum:'catalog:stick:A727TA',robot_vacuum:'catalog:robot:R560BL1'
};
function matchedAccountDevices(devices){
  return devices.flatMap(d=>{
    const k=ProductCatalog.matchModel(d.category,d.modelCode);
    if(!k)return [];
    return [{...d,k,...(d.category==='TV'?{kind:'tv',capability:'power.set'}:{})}];
  });
}
export function pruneRetiredCollection(){
  if(blocked)return;
  const retired=k=>!isCollectibleProduct(k);
  if(!state.collection.some(retired)&&!['collectionSources','photoSelections'].some(field=>
    Object.keys(state[field]||{}).some(retired)))return;
  update(s=>{
    for(const key of s.collection){
      const old=ProductCatalog.retiredSale(key);
      if(!old)continue;
      for(const unit of old.keys){
        if(!s.collection.includes(unit))s.collection.push(unit);
        if(s.collectionSources?.[key]!=null)s.collectionSources[unit]??=s.collectionSources[key];
      }
      if(s.photoSelections?.[key]!=null)s.photoSelections[old.primary]??=s.photoSelections[key];
    }
    s.collection=s.collection.filter(isCollectibleProduct);
    for(const field of ['collectionSources','photoSelections']){
      for(const k of Object.keys(s[field]||{}))if(retired(k))delete s[field][k];
    }
  });
}
export function registeredAppliances(){
  if(homeSource!=='demo')return accountDevices;
  return sampleAppliances(state);
}
function sampleAppliances(home){
  if(home?.myFixtureId!=='sample-home-v1')return [];
  const keys={'my-tv-1':demoModels.tvset,'my-tv-2':demoModels.standbyme,'my-light-1':'floor_lamp'};
  const fixed=devices.filter(d=>d.kind==='tv'?sampleTvIds(home).includes(d.id):home.myLayout['light-slot']===d.id);
  return [...fixed.map(d=>({...d,k:keys[d.id]})),
    ...Object.entries(demoModels).filter(([old])=>!['tvset','standbyme'].includes(old))
      .map(([old,k])=>({k,id:home.sampleDeviceIds?.[k]||home.sampleDeviceIds?.[old]||'sample-'+old}))]
    .filter(d=>d.k==='floor_lamp'||isCollectibleProduct(d.k));
}
// Discoveries are shared across rooms. One key per template makes concurrent discoveries independent.
export const discoveryPrefix='lg-miniroom.discovered.';
export function discovery(id){return localStorage.getItem(discoveryPrefix+id)}
export function rememberPreview(id,source){
  if(!discovery(id))localStorage.setItem(discoveryPrefix+id,source);
}
export async function inventoryHome(){
  const read=key=>JSON.parse(localStorage.getItem(key)||'null');
  const demo=read('lg-miniroom.state'),thinq=read('lg-miniroom.state.thinq');
  if(!demo?.savedRoutines?.length&&!thinq?.savedRoutines?.length)return {records:[],placed:[]};
  const home=await fetchHome();
  const suffix=home.mode==='demo'?'':'.thinq';
  const stored=home.mode==='demo'?demo:thinq;
  const layout=read('lg-miniroom.dot.my'+suffix);
  const registered=home.mode==='demo'?sampleAppliances(stored):matchedAccountDevices(home.devices);
  const placed=layout?(layout.layouts?.[layout.room]||[]).filter(o=>registered.some(d=>d.id===o.deviceId&&d.k===o.k)):null;
  return {records:stored?.savedRoutines||[],placed,registered};
}
function catalogKey(k){
  return k===model?'tvset':k;
}
export function collected(k,collection=state.collection){
  const product=catalogKey(k);
  return isCollectibleProduct(product)&&collection.some(entry=>catalogKey(entry)===product);
}
// Also used by the older editor when collection and placement share one transaction.
export function addToCollection(draft,k,source){
  const product=catalogKey(k);
  if(!isCollectibleProduct(product))throw Error('수집 카탈로그에 없는 제품이에요. 목록에서 제품을 골라 주세요.');
  if(collected(product,draft.collection))return;
  draft.collection.push(product);
  draft.collectionSources??={};draft.collectionSources[product]=source;
}
export function collect(k,source,photoSelection){
  if(collected(k))return;
  update(s=>{
    addToCollection(s,k,source);
    if(source==='photo'&&photoSelection){
      s.photoSelections??={};
      s.photoSelections[catalogKey(k)]=photoSelection;
    }
  });
  logCollection(k);
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
  return registeredAppliances().filter(d=>d.kind===action.kind && d.capability===action.capability);
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

// These actions simulate the room sprites. The inventory supplies the individual unit IDs.
const customActions=[
  {...actions[0],label:'TV 켜기'},
  {...actions[1],label:'밝기 30%'},
  {...actions[1],actionId:'light-off',value:0,label:'조명 끄기'},
  ...new Set(applianceTemplates.flatMap(t=>t.actions))
];
export function customOptions(device){
  const key=typeof DotScene!=='undefined'?(DotScene.products[device.k]?.behaviorKey||device.k):device.k;
  const kind=key==='floor_lamp'?'light':['tvset','standbyme'].includes(key)?'tv':
    Object.keys(applianceGroups).find(group=>applianceGroups[group].keys.includes(key));
  return customActions.filter(a=>a.kind===kind&&(!device.capability||device.capability===a.capability));
}
export function customRoutine(name,steps,recordId){
  name=name.trim();
  if(!name||name.length>32)throw Error('루틴 이름을 1~32자로 입력해 주세요.');
  if(!steps.length)throw Error('기기 동작을 하나 이상 골라 주세요.');
  const devices=registeredAppliances(),bindings={},selected=[],used=new Set();
  for(const {deviceId,operation} of steps){
    const device=devices.find(d=>d.id===deviceId);
    const action=device&&customOptions(device).find(a=>a.actionId===operation);
    if(!action||used.has(deviceId))throw Error('등록 기기와 동작을 다시 선택해 주세요.');
    used.add(deviceId);
    const actionId='step-'+selected.length;
    selected.push({...action,operation,actionId,required:true});
    bindings[actionId]=deviceId;
  }
  const template={id:recordId||'custom-'+Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16).padStart(8,'0')).join(''),anchor:'my-room',actions:selected};
  return {...routine(bindings,template,a=>devices.filter(d=>customOptions(d).some(o=>o.actionId===a.operation))),name,custom:true};
}

// Observation is opt-in and scoped to the current browser tab.
export const observing = new URLSearchParams(location.search).get('observe') === '1';
const observationKey = guestVisit ? 'lg-miniroom.guest.events' : 'lg-miniroom.events';
let guestSessionId;
function observationRows(){
  const rows=JSON.parse(sessionStorage.getItem(observationKey)||'[]');
  if(!Array.isArray(rows))throw Error('관찰 기록을 열 수 없어요.');
  return rows;
}
export function logCollection(k){
  logObservation('collection_added','dream','collection',null,catalogKey(k));
}
export function logObservation(event,room,source,templateId='movie-night',productKey){
  if(!observing)return;
  try{
    const rows=observationRows();
    let sessionId=guestVisit ? guestSessionId : sessionStorage.getItem('lg-miniroom.session');
    if(!sessionId){
      sessionId=Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16).padStart(8,'0')).join('');
      if(guestVisit)guestSessionId=sessionId;
      else sessionStorage.setItem('lg-miniroom.session',sessionId);
    }
    const row={event,sessionId,time:new Date().toISOString(),room,source};
    if(templateId)row.templateId=templateId;
    if(productKey)row.productKey=productKey;
    rows.push(row);
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
  const rows=observationRows();
  const selected=guestVisit ? rows.filter(row=>row.sessionId===guestSessionId) : rows;
  const events=selected.map(({event,sessionId,time,room,source,templateId,productKey})=>({event,sessionId,time,room,source,templateId,productKey}));
  const file=new Blob([JSON.stringify({version:1,events},null,2)],{type:'application/json'});
  const link=document.createElement('a'),url=URL.createObjectURL(file);
  link.href=url;link.download='miniroom-observation-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
  link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
