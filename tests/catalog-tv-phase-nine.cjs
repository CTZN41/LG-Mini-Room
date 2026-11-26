const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const {verifyPhone} = require('./catalog-room-check.cjs');

const base = process.argv[2] || 'http://127.0.0.1:4174';
(async () => {
  const browser = await chromium.launch({channel:'chrome'});
  try {
    const page = await browser.newPage();
    await page.goto(base+'/editor?space=dream&room=C');
    await page.waitForSelector('#rooms button');
    const rows = (await (await page.request.get(base+'/api/catalog/bodies')).json()).filter(r => r[0]==='TV');
    assert.equal(rows.length,769);
    const audit = await page.evaluate(rows => {
      const recipes = new Set(), widths = {}, issues = [];
      function film(pose,loc,time) {
        const canvas = document.createElement('canvas');
        canvas.width = loc.s.w; canvas.height = loc.s.h;
        const ctx = canvas.getContext('2d'); ctx.translate(-loc.x,-loc.y);
        DotScene.paint(ctx,'C','pink',[pose],null,{time,playing:true,tv:1,sleepBed:-1});
        return ctx.getImageData(0,0,canvas.width,canvas.height).data;
      }
      for (const [,model,,,,detail,,,decision,inches] of rows) {
        const key = ProductCatalog.matchModel('TV',model);
        const item = ProductCatalog.restore(DotScene.products,key);
        if (!item || !inches || !detail || decision==='미판정') throw Error(model);
        if (detail==='feet') widths[inches] = item.displayWidth;
        if (recipes.has(item.spriteKey)) continue;
        recipes.add(item.spriteKey);
        for (let turn=0; turn<4; turn++) {
          const o = {id:1,k:key,x:16,y:20,e:0,f:turn%2,turn};
          const loc = DotScene.place('C','pink',o), s = loc.s;
          const rear = turn===1 || turn===2;
          if (Boolean(s.screen)===rear) throw Error('screen '+model);
          const first = film(o,loc,0), second = film(o,loc,1250);
          let changed = 0;
          for (let i=0; i<first.length; i+=4) {
            if (first[i]===second[i] && first[i+1]===second[i+1] && first[i+2]===second[i+2]) continue;
            changed++;
            if (rear) break;
            const [sx,sy,w,h] = s.screen;
            const x = i/4%s.w, u = (o.f?s.w-1-x:x)-sx;
            const v = Math.floor(i/4/s.w)-sy-u/2;
            // Canvas antialias coverage includes partially covered edge pixels.
            if (u < -1 || u > w || v < -1 || v > h+1) {issues.push([model,turn,'outside']);break;}
          }
          if (Boolean(changed)===rear) issues.push([model,turn,'playback']);
        }
      }
      return {issue:issues[0],count:recipes.size,widths};
    },rows);
    assert.equal(audit.issue,undefined,JSON.stringify(audit.issue));
    assert.ok(audit.widths[43]<audit.widths[65] && audit.widths[65]<audit.widths[86]);
    console.log('PASS',rows.length,'TVs /',audit.count,'sprite recipes, four directions and screen playback');
    const examples = new Map();
    for (const row of rows) if (!examples.has(row[5])) examples.set(row[5],{model:row[1]});
    // Avoid using the largest example in every collector flow. These three share a base shape.
    examples.set('feet',{model:rows.find(r=>r[5]==='feet'&&r[9]===43)[1]});
    for (const size of [65,86]) examples.set('feet'+size,{model:rows.find(r=>r[5]==='feet'&&r[9]===size)[1]});
    await page.close();
    await Promise.all([[320,568],[390,844]].map(([w,h])=>
      verifyPhone(browser,base,w,h,[...examples.values()],'TV','tv','phase9')));
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
