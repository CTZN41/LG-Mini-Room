module.exports=async function tapItem(page,id,storageKey='lg-miniroom.dot.my'){
    await page.locator('#view[data-zoom]').waitFor();
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const point=await page.evaluate(({id,storageKey})=>{
      const layout=JSON.parse(roomStorage.getItem(storageKey)),r=layout.room,t=layout.theme;
      const all=DotScene.sorted(r,layout.layouts[r]),item=all.find(o=>o.id===id),q=DotScene.place(r,t,item);
      const cv=document.querySelector('#scene'),rect=cv.getBoundingClientRect(),scale=rect.width/cv.width;
      let point,best=Infinity;
      for(let y=3;y<q.s.h-3;y++)for(let x=3;x<q.s.w-3;x++){
        const cost=(x-q.s.w/2)**2+(y-q.s.h/2)**2;
        if(cost>=best)continue;
        if([[0,0],[-3,0],[3,0],[0,3],[0,-3]].every(([dx,dy])=>DotScene.hits(r,t,all,q.x+x+dx,q.y+y+dy)[0]===item)){
          best=cost;point=[rect.x+(q.x+x)*scale,rect.y+(q.y+y)*scale];
        }
      }
      if(point)return point;
      throw Error('No exposed pixel for item '+id);
    },{id,storageKey});
    await page.touchscreen.tap(...point);
  };
