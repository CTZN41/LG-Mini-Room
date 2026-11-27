const {registeredModels}=require('./support/catalog.cjs');
const {expectedTitle}=require('./catalog-room-title.cjs');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.argv[2]||'http://127.0.0.1:4173';

async function check(browser,width,height,reduced){
  const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true,
    reducedMotion:reduced?'reduce':'no-preference'});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const tap=id=>page.locator('#'+id).tap();
  async function collect(code){
    await tap('libraryButton');await tap('openCatalog');
    await page.locator('#catalogFamilies button').filter({hasText:'AW141YBW'}).tap();
    await page.getByRole('button',{name:code+' 수집',exact:true}).tap();
    await tap('placeCollected');await tap('editMode');
  }
  async function tapProduct(code){
    const point=await page.evaluate(code=>{
      const {room,theme,layouts}=JSON.parse(localStorage.dotroom);
      const items=DotScene.sorted(room,layouts[room]),item=items.find(o=>DotScene.products[o.k].modelCode===code);
      const q=DotScene.place(room,theme,item),c=document.querySelector('#scene'),bounds=c.getBoundingClientRect();
      for(let y=8;y<q.s.h-5;y+=2)for(let x=5;x<q.s.w-5;x+=2){
        const X=q.x+x,Y=q.y+y;
        if([[0,0],[2,2],[-2,-2]].every(([dx,dy])=>DotScene.hits(room,theme,items,X+dx,Y+dy)[0]===item))
          return [bounds.x+(X+.5)*bounds.width/c.width,bounds.y+(Y+.5)*bounds.height/c.height];
      }
      throw Error('No visible pixel for '+code);
    },code);
    await page.touchscreen.tap(...point);
  }
  try{
    await page.goto(base+'/editor?space=dream');await collect('AW141YBW');await collect('HY705RWUA');
    await page.reload();await page.locator('#libraryButton').waitFor();
    const models=registeredModels().filter(([category])=>category==='가습기').map(([,code])=>code);
    const gallery=await page.evaluate(models=>{
      const keys=new Set();
      for(const model of models){
        const k='catalog:humid:'+model,item=ProductCatalog.restore(DotScene.products,k);
        keys.add(item.spriteKey);
        for(let turn=0;turn<4;turn++){
          const {s}=DotScene.place('B','pink',{k,x:4,y:4,turn,f:turn%2,e:0});
          const [x,y]=s.mistOutlet;
          if(!s.pixels[(y*s.w+x)*4+3])throw Error(model+' outlet outside product');
        }
      }
      return [models.length,keys.size];
    },models);
    assert.deepEqual(gallery,[14,7]);
    // The cat keeps its seated profile throughout the mist animation, on either side.
    await page.evaluate(()=>{
      const c=document.createElement('canvas');c.width=c.height=48;
      const ctx=c.getContext('2d',{willReadFrequently:true});
      for(const facingLeft of [false,true]){
        const render=progress=>{
          DotScene.paint(ctx,'B','pink',[],null,{cat:{x:24,y:32},facingLeft,
            reaction:{kind:'humidifier',settle:1,progress}});
          return new Uint32Array(ctx.getImageData(0,0,48,48).data.buffer);
        };
        const base=render(0);
        DotScene.paint(ctx,'B','pink',[],null,null);
        const background=new Uint32Array(ctx.getImageData(0,0,48,48).data.buffer);
        if(base.every((v,i)=>v===background[i]))throw Error('Missing seated cat');
        for(const progress of [.1,.18,.28,.39,.6,.99]){
          if(render(progress).some((v,i)=>v!==base[i]))throw Error('Watching pose changed');
        }
      }
    });
    await page.evaluate(()=>{
      const paint=DotScene.paint;
      window.approaches=0;window.mistedDuringApproach=false;
      DotScene.paint=function(...args){
        const fx=args[5];
        if(fx?.mist&&fx.walking&&!window.fx?.walking)window.approaches++;
        window.fx=fx;
        const result=paint(...args);
        if(fx?.walking&&fx.mist&&!window.mistedDuringApproach){
          const [ctx,room,tone,items]=args;
          const q=DotScene.place(room,tone,items.find(o=>o.id===fx.mist.itemId));
          const [x,y]=q.s.mistOutlet,area=[q.x+x-5,q.y+y-18,11,12];
          const without=document.createElement('canvas');
          without.width=ctx.canvas.width;without.height=ctx.canvas.height;
          const ref=without.getContext('2d');
          paint(ref,room,tone,items,args[4],{...fx,mist:null},...args.slice(6));
          const clean=ref.getImageData(...area).data;
          window.mistedDuringApproach=ctx.getImageData(...area).data.some((v,i)=>v!==clean[i]);
        }
        return result;
      };
    });
    for(const code of ['AW141YBW','HY705RWUA']){
      await tapProduct(code);
      await page.waitForFunction(code=>document.querySelector('#lifeTitle').textContent===code&&fx?.reaction?.kind==='humidifier'&&fx.reaction.settle===1,await expectedTitle(page,'가습기',code));
      const state=await page.evaluate(()=>{
        const {room,theme,layouts}=JSON.parse(localStorage.dotroom),o=layouts[room].find(o=>o.id===fx.mist.itemId);
        const q=DotScene.place(room,theme,o);
        return {x:fx.cat.x,side:fx.facingLeft,center:q.x+q.s.w/2,
          starts:approaches,phase:fx.mist.phase,cat:{...fx.cat}};
      });
      assert.ok(Math.abs(state.x-state.center)>24);assert.equal(state.side,state.x>state.center);
      await tapProduct(code);
      if(reduced){
        const pixels=await page.locator('#scene').evaluate(c=>c.toDataURL());
        await page.waitForTimeout(270);
        assert.equal(await page.locator('#scene').evaluate(c=>c.toDataURL()),pixels);
      }else await page.waitForFunction(phase=>fx.mist.phase!==phase,state.phase);
      assert.deepEqual(await page.evaluate(()=>fx.cat),state.cat);
      assert.equal(await page.evaluate(()=>approaches),state.starts);
    }
    assert.equal(await page.evaluate(()=>approaches),reduced?0:2);
    assert.equal(await page.evaluate(()=>mistedDuringApproach),!reduced);
    await page.getByRole('button',{name:'닫기',exact:true}).tap();
    await page.waitForFunction(()=>!fx.mist&&!fx.reaction);
    assert.deepEqual(errors,[]);console.log('PASS',width,height,reduced?'reduced':'animated','14 models, 7 outlet shapes, 4 headings, touch, stationary watching pose, re-tap, stop');
  }finally{await page.context().close()}
}
(async()=>{const b=await chromium.launch({channel:'chrome'});try{
  for(const [w,h,reduce] of [[390,844,false],[320,568,false],[320,568,true]])await check(b,w,h,reduce);
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
