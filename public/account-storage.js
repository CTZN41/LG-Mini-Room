// Signed-in pages share a private snapshot and a per-account queue in this tab.
const roomStorage=globalThis.miniroomStorage=(()=>{
  const node=document.getElementById('account-data');
  if(!node||document.documentElement.classList.contains('camera-return'))return localStorage;
  const {user,entries}=JSON.parse(node.textContent);
  const draftKey='miniroom.account.draft.'+user.id;
  const draft=JSON.parse(sessionStorage.getItem(draftKey)||'{}');
  // The home card uses the current editor's renderer; keep preview migrations in memory.
  if (new URLSearchParams(location.search).get('homePreview')==='1') {
    const copy=new Map(Object.entries(entries));
    for(const [key,change] of Object.entries(draft))copy.set(key,change.value);
    return {getItem:key=>copy.get(key)??null,setItem:(key,value)=>copy.set(key,String(value)),removeItem:key=>copy.delete(key),whenSynced:async()=>{}};
  }
  const status=document.getElementById('accountSaveStatus');
  status.hidden=false;
  const notify=message=>{status.textContent=message};
  const persist=()=>sessionStorage.setItem(draftKey,JSON.stringify(draft));
  let pending=null;
  async function drain(){
    try{
      while(Object.keys(draft).length){
        const key=Object.keys(draft)[0],{before,value}=draft[key];
        if((entries[key]??null)!==value){
          const res=await fetch('/api/members/save',{method:'POST',headers:{'Content-Type':'application/json','X-Miniroom':'1'},
            body:JSON.stringify({owner:user.id,key,before,value})});
          if(!res.ok)throw Error((await res.json()).error);
          entries[key]=value;
        }
        if(draft[key].value===value)delete draft[key];
        else draft[key].before=value;
        persist();
      }
      notify('계정에 저장됨');
    }catch(error){notify('계정 저장 대기 · '+error.message);return error}
  }
  function flush(){
    if(!pending)pending=Promise.resolve().then(drain).finally(()=>{pending=null});
    return pending;
  }
  function put(key,value){
    const current=Object.hasOwn(draft,key)?draft[key].value:entries[key]??null;
    if(current===value)return;
    const previous=draft[key];
    draft[key]={before:previous?previous.before:entries[key]??null,value};
    try{persist()}catch(error){
      if(previous)draft[key]=previous;
      else delete draft[key];
      throw error;
    }
    notify('계정에 저장 중');void flush();
  }
  window.addEventListener('online',flush);
  status.onclick=flush;void flush();
  return {
    getItem:key=>Object.hasOwn(draft,key)?draft[key].value:entries[key]??null,
    setItem:(key,value)=>put(key,String(value)),removeItem:key=>put(key,null),
    async whenSynced(){const error=await flush();if(error)throw error}
  };
})();
