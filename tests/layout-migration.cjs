const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const url=(process.argv[2]||'http://127.0.0.1:4173')+'/editor?space=';
const stateKey='lg-miniroom.state',dream='dotroom',my='lg-miniroom.dot.my';
const old=JSON.stringify({room:'C',theme:'lime',layouts:{
  A:[],B:[{id:1,k:'tvset',x:1,y:49,f:1,e:0,deviceId:'my-tv-1'}],
  C:[{id:2,k:'bed',x:10,y:12,f:0,e:0}]
}});
const previousState=JSON.stringify({schemaVersion:1,revision:3,collection:['tvset'],dreamLayout:{},
  myFixtureId:'sample-home-v1',registeredTvIds:['my-tv-1'],myLayout:{'tv-slot':'my-tv-1'},
  savedRoutines:[{templateId:'movie-night',anchorId:'sofa',bindings:{'tv-on':'my-tv-1'},exclusions:{}}]});

(async()=>{
  const browser=await chromium.launch({channel:'chrome'});
  try{
    const p=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
    await p.route('**/api/my-appliances',r=>r.fulfill({json:{mode:'demo'}}));
    await p.goto(url+'menu');
    await p.evaluate(({dream,my,old,stateKey,previousState})=>{
      localStorage[dream]=localStorage[my]=old;localStorage[stateKey]=previousState;
    },{dream,my,old,stateKey,previousState});
    const get=key=>p.evaluate(key=>localStorage.getItem(key),key);
    const open=async space=>{
      await p.goto(url+space);
      await p.waitForFunction(()=>document.querySelectorAll('[data-room]').length===3);
    };
    await open('menu');
    assert.equal(await get(dream),old);assert.equal(await get(dream+'.before-wood'),null);
    for(const [key,space] of [[dream,'dream'],[my,'my']]){
      await open(space);
      const saved=JSON.parse(await get(key));
      assert.equal(saved.room,'B');assert.equal(saved.theme,'lime');assert.equal(saved.layoutVersion,1);
      assert.deepEqual(saved.woodRooms,['A','B','C']);
      for(const [r,items] of Object.entries(saved.layouts)){
        if(space==='dream'&&r==='C')assert.equal(items.filter(o=>o.artVersion===1&&o.exhibit).length,4);
        else assert.deepEqual(items.map(o=>o.k),['sofa']);
      }
      assert.equal(await get(key+'.before-wood'),old);
      assert.equal(await get(stateKey),previousState);
      await p.locator('[data-room=C]').tap();await open(space);
      assert.equal(JSON.parse(await get(key)).room,'C');
    }
    // If the backup cannot be stored, the only copy of an old layout must survive.
    await p.evaluate(({dream,old})=>{localStorage.removeItem(dream+'.before-wood');localStorage[dream]=old;},{dream,old});
    await p.addInitScript(()=>{
      const original=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){
        if(key==='dotroom.before-wood')throw new DOMException('Storage full','QuotaExceededError');
        return original.call(this,key,value);
      };
    });
    await open('dream');assert.equal(await get(dream),old);
    assert.equal(await get(dream+'.before-wood'),null);
    console.log('PASS one-time dream/my migration, original backups, routine and collection retention, read-only menu and failed backup');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
