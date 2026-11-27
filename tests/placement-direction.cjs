const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:4173';
const units=[
  ['무선청소기','A727TA','stick'],['로봇청소기','R560BL1','robot'],
  ['공기청정기','AS206NGHA','purifier'],['공기청정기','AS235DWSA','purifier'],
  ['공기청정기','AS153HWFS','purifier'],['에어컨','FQ16ET4HSN','ac']
].map(([category,modelCode,slug])=>({category,modelCode,id:modelCode,name:modelCode,k:'catalog:'+slug+':'+modelCode}));
const products=units.map(unit=>unit.k);

async function exercise(browser,space,width,height){
  const p=await browser.newPage({viewport:{width,height},isMobile:width<700,hasTouch:width<700});
  const key=space==='my'?'lg-miniroom.dot.my.thinq':'dotroom';
  await p.route('**/api/my-appliances',r=>r.fulfill({json:{mode:'thinq',
    devices:units}}));
  await p.goto(base+'/editor?space='+space);
  await p.getByRole('button',{name:'배치 편집',exact:true}).waitFor();
  await p.evaluate(({key,products})=>{
    localStorage.setItem(key,JSON.stringify({layoutVersion:1,room:'B',theme:'pink',layouts:{B:[]}}));
    localStorage.setItem(key==='dotroom'?'lg-miniroom.state':'lg-miniroom.state.thinq',JSON.stringify({schemaVersion:1,revision:1,
      collection:products,dreamLayout:{},myLayout:{},savedRoutines:[]}));
  },{key,products});
  await p.reload();await p.getByRole('button',{name:'배치 편집',exact:true}).click();
  async function arrow(){
    return p.evaluate(key=>{
      const c=document.querySelector('#scene'),pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
      let count=0,sx=0,sy=0;
      for(let i=0;i<pixels.length;i+=4){
        if(pixels[i]!==131||pixels[i+1]!==246||pixels[i+2]!==228)continue;
        count++;sx+=(i/4)%c.width;sy+=Math.floor(i/4/c.width);
      }
      if(!count)return null;
      const item=JSON.parse(localStorage.getItem(key)).layouts.B.at(-1);
      const {w,d}=DotScene.dims(item),[x,y]=DotScene.project('B',item.x+w/2,item.y+d/2,DotScene.zone('B',item));
      return [Math.sign(sx/count-x),Math.sign(sy/count-y)];
    },key);
  }
  for(const k of products){
    await p.locator('[data-key="'+k+'"]').click();
    // Test all headings in open floor away from other furniture.
    if(k===products[1])for(let i=0;i<10;i++)await p.keyboard.press('ArrowLeft');
    for(const quadrant of [[-1,1],[-1,-1],[1,-1],[1,1]]){
      assert.deepEqual(await arrow(),quadrant,k+' points out of the front edge');
      await p.locator('#flip').click();
    }
    await p.locator('#remove').click();assert.equal(await arrow(),null);
  }
  await p.locator('[data-cat="가구"]').click();await p.locator('[data-key=coffee]').click();
  assert.equal(await arrow(),null,'ordinary furniture keeps its footprint only');
  if(await p.locator('#products').isHidden())await p.getByRole('button',{name:'다른 제품 놓기'}).click();
  await p.locator('[data-cat="가전"]').click();
  await p.locator('[data-key="'+products.at(-1)+'"]').click();
  const drag=await p.evaluate(key=>{
    const items=JSON.parse(localStorage[key]).layouts.B,unit=items.at(-1),table=items[0];
    const scene=document.querySelector('#scene'),box=scene.getBoundingClientRect(),scale=box.width/scene.width;
    const order=DotScene.sorted('B',items),q=DotScene.place('B','pink',unit);
    const dx=table.x-unit.x,dy=table.y-unit.y;
    for(let y=2;y<q.s.h-2;y++)for(let x=2;x<q.s.w-2;x++){
      if(DotScene.hits('B','pink',order,q.x+x,q.y+y)[0]!==unit)continue;
      return {x:box.x+(q.x+x+.5)*scale,y:box.y+(q.y+y+.5)*scale,dx:2*(dx-dy)*scale,dy:(dx+dy)*scale};
    }
    throw Error('Tower AC is hidden');
  },key);
  await p.mouse.move(drag.x,drag.y);await p.mouse.down();
  await p.mouse.move(drag.x+drag.dx,drag.y+drag.dy,{steps:6});
  await p.waitForFunction(()=>document.querySelector('#placementHint').textContent.includes('겹쳐서'));
  assert.ok(await arrow(),'the arrow is visible together with the blocked placement warning');
  await p.mouse.up();
  await p.locator('#more').click();await p.locator('#shot').click();
  assert.equal(await p.locator('#exportImage').evaluate(async im=>{
    await im.decode();const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;
    const ctx=c.getContext('2d');ctx.drawImage(im,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;
    for(let i=0;i<data.length;i+=4)if(data[i]===131&&data[i+1]===246&&data[i+2]===228)return true;
    return false;
  }),false,'export contains only the room');
  await p.locator('#picture .close').click();
  await p.getByRole('button',{name:'배치 완료',exact:true}).click();
  await p.locator('#view').focus();await p.keyboard.press('ArrowRight');
  assert.equal(await arrow(),null,'browsing selection hides the placement arrow');
  await p.context().close();console.log('PASS',space,width,height,'six guide sprites, four headings and browse mode');
}
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
  await exercise(browser,'dream',390,844);await exercise(browser,'my',1150,750);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
