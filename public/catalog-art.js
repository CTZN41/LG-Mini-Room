// Pixel art on the room's native 2:1 grid. Each family has a front and a rear sprite.
// Primary body visible in the reviewed DB photographs. Codes keep independent collection keys.
const dehumidifierProfiles=[
  ['cabinet','black','차콜 직사각형 · 낮은 바퀴',['DC356SKAA']],
  ['flush','white','흰 일체형 상단 · 반투명 매립 물통',['DQ134MWEC','DQ134MWECS','DQ136MWRA','DQ154MWGA','DQ154MWGAS','DQ185MWGA','DQ185MWGAS','DQ214MWGA','DQ214MWGAS','DQ235MWGA','DQ235MWGAS','DQ256MWGA','DQ256MWGAS']],
  ['flush','ivory','아이보리 일체형 상단 · 반투명 매립 물통',['DQ185MEGA','DQ185MEGAS','DQ214MEGA','DQ214MEGAS','DQ235MEGA','DQ235MEGAS','DQ256MEGA','DQ256MEGAS']],
  ['slim','white','흰 손잡이 · 좁은 측면 수위창',['DQ132PWXC']],
  ['slim','silver','실버 손잡이 · 좁은 측면 수위창',['DQ160PSAA']],
  ['slim','blue','연청색 손잡이 · 좁은 측면 수위창',['DQ162PBBC','DQ200PBBC']],
  ['slim','ivory','크림 본체 · 좁은 측면 수위창',['DQ163PECA']],
  ['slim','pewter','웜그레이 손잡이 · 좁은 측면 수위창',['DQ198PGE']],
  ['tank','blue','연청색 손잡이 · 돌출 물통',['DQ202PBBC','DQ205PBBC','DQ205PBBCS']],
  ['tank','pewter','웜그레이 손잡이 · 돌출 물통',['DQ202PGUA']],
  ['tank','pink','분홍 손잡이 · 돌출 물통',['DQ202PPBC']],
  ['tank','silver','실버 손잡이 · 돌출 물통',['DQ202PSUA','DQ205PSVA','DQ205PSVAS']],
  ['tank','sand','샌드 베이지 본체 · 돌출 물통',['DQ203PCCA']],
  ['tank','ivory','크림 본체 · 돌출 물통',['DQ203PECA','DQ205PEGA','DQ205PEGAS']]
];
const CatalogArt=(()=>{
  const models=new Map();
  // Model codes remain collection IDs; photographs that show the same primary robot share art.
  const profiles=[
    ['disc','black','pad','검은 원반 · 낮은 충전대',['R560BL1']],
    ['disc','white','pad','흰 원반 · 낮은 충전대',['R580HK','R580WK','R580WK1']],
    ['disc','white','tower','흰 원반 · 흰 세로 도크',['R585HK','R585HKA','R585HKA1','RO585HGH']],
    ['disc','cream','tower','아이보리 원반 · 세로 도크',['R585WKA','R585WKA1']],
    ['visor','cream','short','넓은 앞창 · 낮은 사각 도크',['B72WW']],
    ['visor','white','cabinet','흰 본체 · 사각 도크',['B93BHB','B94AHB']],
    ['visor','cream','cabinet','아이보리 본체 · 사각 도크',['B95AWBH','B95AWBH + AS520WA','B95AWBTH','B95AWDTH']],
    ['disc','black','garage','검은 원반 · 하부가 열린 흰 도크',['N95THO']],
    ['disc','black','low','검은 원반 · 납작한 검은 상판 도크',['N95THU','N95TWU']],
    ['mop','slate',null,'회청색 원반 · 검은 상단 조작부',['M970I','M971I']],
    ['mop','plum',null,'자주색 원반 · 검은 상단 조작부',['M971V']],
    ['mop','pine',null,'녹색 원반 · 검은 상단 조작부',['MO971GA','MO972GA']],
    ['mop','cream',null,'아이보리 원반 · 검은 상단 조작부',['MO971WA','MO972WA']],
    ['mop','white',null,'흰 원반 · 검은 상단 조작부',['MO972HA']],
    ['nozzle','cream','tower','넓은 앞 헤드 · 아이보리 세로 도크',['R9300WB','RO963WB','RO965WB']],
    ['nozzle','plum',null,'넓은 앞 헤드 · 자주색 본체',['R961VA']],
    ['nozzle','slate','tower','넓은 앞 헤드 · 짙은 회색 도크',['R965IB']],
    ['nozzle','pine','tower','넓은 앞 헤드 · 녹색 도크',['RO965GB','RO965GB + MO971GA','RO965GB + MO971WA']],
    ['nozzle','pine',null,'넓은 앞 헤드 · 녹색 본체',['RO971GA']],
    ['brush','red',null,'붉은 상판 · 돌출 앞면과 양옆 솔',['W71RVL','W71RVLB']]
  ];
  // Each painted material gets its own highlight and shade, in native pixels.
  // Measure just that material so the small table top gets a complete light band.
  function shadeMaterials(ctx,materials){
    const {width:w,height:h}=ctx.canvas,image=ctx.getImageData(0,0,w,h),pixels=image.data;
    const rgb=hex=>parseInt(hex.slice(1),16);
    const ramps=new Map(materials.map(([base,light,shade])=>[rgb(base),
      {light:rgb(light),shade:rgb(shade),left:w,right:0,top:h,bottom:0}]));
    const at=i=>ramps.get((pixels[i]<<16)|(pixels[i+1]<<8)|pixels[i+2]);
    for(let i=0;i<pixels.length;i+=4){
      const r=at(i);if(!r||!pixels[i+3])continue;
      const x=(i/4)%w,y=Math.floor(i/4/w);
      r.left=Math.min(r.left,x);r.right=Math.max(r.right,x);
      r.top=Math.min(r.top,y);r.bottom=Math.max(r.bottom,y);
    }
    for(let i=0;i<pixels.length;i+=4){
      const r=at(i);if(!r||!pixels[i+3])continue;
      const x=(i/4)%w,y=Math.floor(i/4/w);
      const level=.54*(x-r.left)/Math.max(1,r.right-r.left)+.46*(y-r.top)/Math.max(1,r.bottom-r.top)
        +((x+y)%2 ? .045 : -.045);
      if(level>=.28&&level<=.69)continue;
      const color=level<.28?r.light:r.shade;
      pixels[i]=color>>16;pixels[i+1]=(color>>8)&255;pixels[i+2]=color&255;
    }
    ctx.putImageData(image,0,0);
  }
  function sprite(w,d,h,rear,draw,live=false){
    const ax=2*d+3,ay=h+3,canvas=document.createElement('canvas');
    canvas.width=2*(w+d)+7;canvas.height=h+w+d+7;
    const ctx=canvas.getContext('2d');
    function point(x,y,z){return [Math.round(ax+2*(x-y)),Math.round(ay+x+y-z)]}
    function line(a,b,color){
      let [x,y]=a;const dx=Math.abs(b[0]-x),dy=-Math.abs(b[1]-y),sx=x<b[0]?1:-1,sy=y<b[1]?1:-1;
      let error=dx+dy;ctx.fillStyle=color;
      while(true){
        ctx.fillRect(x,y,1,1);if(x===b[0]&&y===b[1])return;
        const e=2*error;if(e>=dy){error+=dy;x+=sx}if(e<=dx){error+=dx;y+=sy}
      }
    }
    function polygon(points,fill,edge=fill){
      const ys=points.map(p=>p[1]);ctx.fillStyle=fill;
      for(let y=Math.min(...ys);y<Math.max(...ys);y++){
        const xs=[],scan=y+.5;
        for(let i=0;i<points.length;i++){
          const a=points[i],b=points[(i+1)%points.length];
          if((a[1]>scan)!==(b[1]>scan))xs.push(a[0]+(scan-a[1])*(b[0]-a[0])/(b[1]-a[1]));
        }
        xs.sort((a,b)=>a-b);
        for(let i=0;i+1<xs.length;i+=2)ctx.fillRect(Math.ceil(xs[i]),y,Math.ceil(xs[i+1])-Math.ceil(xs[i]),1);
      }
      points.forEach((p,i)=>line(p,points[(i+1)%points.length],edge));
    }
    const face=(pts,c,e)=>polygon(pts.map(p=>point(...p)),c,e);
    const bar=(a,b,c)=>line(point(...a),point(...b),c);
    function box(x,y,z,W,D,H,p){
      const [top,front,side,edge]=p,X=x+W,Y=y+D,Z=z+H;
      face([[x,y,Z],[X,y,Z],[X,Y,Z],[x,Y,Z]],top,edge);
      face([[x,Y,Z],[X,Y,Z],[X,Y,z],[x,Y,z]],front,edge);
      face([[X,Y,Z],[X,y,Z],[X,y,z],[X,Y,z]],side,edge);
    }
    function ellipse(cx,cy,rx,ry,fill,edge=fill){
      const pts=[];for(let i=0;i<32;i++){const t=Math.PI*i/16;pts.push([Math.round(cx+rx*Math.cos(t)),Math.round(cy+ry*Math.sin(t))])}
      polygon(pts,fill,edge);
    }
    function drum(cx,y,z,rx,rz,col){
      const pts=[];for(let i=0;i<32;i++){const t=Math.PI*i/16;pts.push([cx+rx*Math.cos(t),y,z+rz*Math.sin(t)])}
      face(pts,col);
    }
    function roundBody(x,y,z,r,bottom,H,p){
      const [cx,base]=point(x,y,z),cy=base-H,ry=Math.max(2,Math.round(r*.4)),by=Math.max(2,Math.round(bottom*.4));
      ellipse(cx,base,bottom,by,p[1],p[3]);
      polygon([[cx-r,cy],[cx+r,cy],[cx+bottom,base],[cx-bottom,base]],p[1]);
      polygon([[cx+Math.round(r*.55),cy],[cx+r,cy],[cx+bottom,base],[cx+Math.round(bottom*.55),base+2]],p[2]);
      line([cx-r,cy],[cx-bottom,base],p[3]);line([cx+r,cy],[cx+bottom,base],p[3]);
      ellipse(cx,cy,r,ry,p[0],p[3]);
    }
    const anchors=draw({rear,box,bar,face,drum,roundBody,point,ellipse,line,polygon});
    if(anchors?.retroAA)shadeMaterials(ctx,anchors.materials||applianceMaterials);
    if(live)return {canvas,ax,ay,...anchors};
    return {src:canvas.toDataURL('image/png').split(',')[1],ax,ay,...anchors};
  }
  const white=['#fff9ee','#e7e3db','#bebfc1','#74717a'],ivory=['#f6ecdc','#dccebe','#b0a296','#736b70'];
  const black=['#62636e','#363741','#454653','#282832'],silver=['#e0dedd','#c1c1c2','#96969e','#67646b'];
  const glass=['#959fab','#485363','#606a78','#343942'];
  function add(key,w,d,h,draw){
    for(const rear of [false,true])DOT_ASSETS.sprites.appl['db_'+key+(rear?'_rear':'')]=sprite(w,d,h,rear,draw);
  }
  for(const [key,buttons] of [['switch_two',2],['switch_three',3]]){
    add(key,5,1,15,({box,bar})=>{
      box(0,0,0,5,1,15,white);
      for(let i=1;i<buttons;i++)bar([0,1,15*i/buttons],[5,1,15*i/buttons],'#a9a4a4');
    });
  }
  for(const key of ['sensor_air','sensor_motion','sensor_climate']){
    const tall=key==='sensor_motion',h=tall?11:4;
    add(key,4,4,h+3,({roundBody,point,ellipse,line})=>{
      roundBody(2,2,0,5,5,h,white);
      const [x,y]=point(2,2,h);
      if(tall)ellipse(x,y-1,3,2,'#d4dbe0','#a5adb5');
      else if(key==='sensor_air'){
        for(const dx of [-2,0,2])line([x+dx,y],[x+dx,y],'#a2a0a2');
      }else{
        line([x-1,y-1],[x-1,y+1],'#8e8e95');
        ellipse(x+2,y,1,1,'#aabac4');
      }
    });
  }
  add('hub',7,7,10,({rear,roundBody,point,ellipse,line})=>{
    const [x,y]=point(3.5,3.5,6);
    roundBody(3.5,3.5,0,9,9,1,silver);
    roundBody(3.5,3.5,1,10,10,5,white);
    // Follow the curved grille so the stipple stays below the smooth top.
    for(let dx=-8;dx<=8;dx+=2){
      const rim=Math.round(4*Math.sqrt(1-(dx/10)**2));
      for(let dy=1;dy<=3;dy+=2){
        const px=x+dx+(dy===1?0:1);
        line([px,y+rim+dy],[px,y+rim+dy],'#aba8a9');
      }
    }
    const sign=rear?-1:1,ink='#88848a';
    line([x-6*sign-1,y],[x-6*sign+1,y],ink);
    line([x+6*sign-1,y],[x+6*sign+1,y],ink);
    line([x+6*sign,y-1],[x+6*sign,y+1],ink);
    ellipse(x,y+2*sign,1,0,ink);
  });
  add('tv',22,6,63,({rear,box,bar,face})=>{
    for(const x of [1,21]){
      bar([x,2,21],[x,0,0],'#8d8585');
      face([[x,4,20],[x+.7,4,20],[x+.7,6,0],[x,6,0]],'#9b8d80');
    }
    box(0,2,18,22,2,45,ivory);
    if(rear){for(let i=2;i<20;i+=2)bar([i,4,43],[i+1,4,43],'#b0a497');return}
    face([[0,4,63],[22,4,63],[22,4,27],[0,4,27]],'#292939');
    face([[1,4,61],[21,4,61],[21,4,29],[1,4,29]],'#535372');
    face([[1,4,31],[7,4,47],[13,4,35],[17,4,42],[21,4,36],[21,4,29],[1,4,29]],'#889aaa');
    bar([0,4,25],[22,4,25],'#b3a393');
  });
  add('humid',9,9,34,({roundBody,point,ellipse})=>{
    roundBody(4.5,4.5,1,11,12,3,black);roundBody(4.5,4.5,4,9,12,22,white);
    roundBody(4.5,4.5,25,12,9,8,glass);
    const [x,y]=point(4.5,4.5,33);
    ellipse(x,y,10,3,'#555d67');ellipse(x,y-1,6,2,'#b6c1c4');ellipse(x-1,y-2,3,1,'#dce1dd');
    ellipse(x-7,y+3,1,2,'#d4dedf');ellipse(x+4,y+5,2,0,'#697782');
    return {mistOutlet:[x-1,y-2]};
  });
  add('humid_essential',9,9,49,({roundBody,point,ellipse})=>{
    const body=white,rim=['#f6e4cd','#e8c8a9','#c5a68f','#968274'];
    roundBody(4.5,4.5,0,11,11,2,silver);
    roundBody(4.5,4.5,2,9,9,2,black);
    roundBody(4.5,4.5,4,10,10,41,body);
    roundBody(4.5,4.5,45,10,10,3,rim);
    const [x,y]=point(4.5,4.5,48);
    ellipse(x,y,8,2,'#c1b8b0');ellipse(x-1,y-1,6,1,'#e5e0da');
    return {mistOutlet:[x-1,y-1]};
  });
  function hydroTower(key,body,cap,foot){
    add('humid_'+key,9,9,64,({roundBody,point,ellipse,line,rear})=>{
      const [cx,cy]=point(4.5,4.5,0);
      roundBody(4.5,4.5,0,11,11,2,foot);
      roundBody(4.5,4.5,2,8,8,42,body);
      // A few low-contrast ribs stay legible at room scale without covering the display.
      for(const dx of [-5,-2,1,4]){
        const bottom=cy-2+(Math.abs(dx)<4?2:1);
        line([cx+dx,cy-38],[cx+dx,bottom],body[2]);
      }
      if(!rear){
        for(const x of [cx-3,cx-2,cx-1])line([x,cy-39],[x,cy-31],'#2c2c33');
        ellipse(cx-2,cy-37,0,0,'#ccd2c9');ellipse(cx-2,cy-34,0,0,'#999d99');
      }
      roundBody(4.5,4.5,44,8,8,5,silver);
      roundBody(4.5,4.5,49,8,8,14,cap);
      ellipse(cx,cy-63,6,2,'#34363a');ellipse(cx,cy-63,4,1,'#545456');
      return {mistOutlet:[cx,cy-63]};
    });
  }
  const pewter=['#b2afa9','#989898','#858588','#696971'];
  const taupe=['#b3aaa1','#887d76','#746c69','#514c50'];
  const moss=['#737b71','#49524f','#3d4644','#303438'];
  const olive=['#717268','#4c5048','#41453f','#303333'];
  hydroTower('taupe',taupe,['#dbccc2','#c4b3a8','#a8968e','#857971'],taupe);
  hydroTower('forest',moss,['#778781','#4e605d','#405250','#323e40'],moss);
  hydroTower('olive',olive,['#797c6e','#565c4e','#494e44','#383e36'],olive);
  hydroTower('cream',['#b7b2a6','#9f9c90','#8b887f','#6d6966'],
    ['#f3ede1','#e6ded0','#ccc3b9','#948b86'],ivory);
  hydroTower('silver',pewter,white,silver);
  // Native Retro AA material colours sampled from puri_b, puri_m and styler.
  // These four masters are already shaded. Keep their hand-placed pixels in every view.
  const ink='#1e1424', graphite='#2a2334', steel='#6e7c93', steelLight='#a5abb1';
  const cream='#eeebe3', ivoryLight='#fffcf5', warm='#e0d2ba', cool='#d6cedc', taupeShade='#c9b8b4';
  const applianceMaterials=[
    ['#ceb79f','#e6d5bf','#bca898'],['#e4dbcc','#f4efe2','#c9bec4'],
    ['#37373c','#54535c','#27263c'],
    [cream,'#f4efe2',cool],[warm,'#ebe0c9',taupeShade],[taupeShade,'#e0d2ba','#b7aab0'],
    ['#a59fa1','#bab3b8','#958c9c'],['#44534a','#627263','#39463f'],
    ['#363942','#565a63','#27263c'],['#435149','#56685a','#303d38']
  ];
  const purifierPaint={
    white:[ivoryLight,cream,cool,ink],silver:[steelLight,'#92979f','#686976',ink],
    taupe:['#b4aa98','#948a7b','#72695d',ink],green:['#687a6e','#44534a','#303d38',ink],
    teal:['#779193','#4d686b','#354b50',ink],rose:['#a08180','#775b5a','#574447',ink],
    wine:['#a26661','#814944','#593436',ink],red:['#f16b70','#c63847','#8a2336',ink],
    yellow:['#eedb93','#bf9f53','#907738',ink],bronze:['#cba98e','#a28572','#70594e',ink],
    aqua:['#e2f0f2','#b6d0d4','#8baab0',ink],black:[steel,graphite,'#25222c',ink]
  };
  function addPurifier(shape,w,d,h,draw){
    for(const [form,finish,,head] of purifierProfiles){
      if(form!==shape)continue;
      const key=PurifierReview.spriteKey(shape,finish,head).slice(3);
      add(key,w,d,h,tools=>draw(tools,finish,head));
    }
  }
  // Preserve the old floor anchor. Draw only the grille and casing visible in the product photo.
  addPurifier('grillePanel',8,8,55,({rear,box,bar,point})=>{
    box(.5,1,1,7,3.2,53,white);
    if(!rear){
      for(let z=4;z<53;z+=3)bar([1,4.2,z],[7,4.2,z],z<23?steel:cool);
    }
    return {retroAA:true,outlet:point(4,4.2,49)};
  });
  addPurifier('round',8,8,55,({rear,roundBody,point,ellipse,line},finish,head)=>{
    const [x,y]=point(4,4,0);
    roundBody(4,4,0,10,10,2,[steel,graphite,'#27263c',ink]);
    roundBody(4,4,2,9,11,30,purifierPaint[finish]);
    line([x-6,y-28],[x-7,y-2],'#56685a');
    for(let row=0;row<4;row++)for(let col=0;col<(rear?5:3);col++){
      const px=x-5+col*2+row%2,py=y-(rear?15:7)+row*2;
      line([px,py],[px,py],rear?'#293831':'#344339');
    }
    const cy=y-43;
    ellipse(x,cy,10,11,graphite,ink);ellipse(x,cy-1,8,9,rear?'#435149':head==='dark'||finish==='green'&&head!=='ring'?'#363942':steelLight);
    if(!rear&&head==='ring')ellipse(x,cy,4,5,graphite);
    if(rear){
      for(let i=-4;i<=4;i+=2)line([x+i,cy-5],[x+i,cy+4],'#303c37');
    }else{
      line([x-6,cy-6],[x-3,cy-8],steelLight);line([x-2,cy-8],[x+1,cy-8],steel);
      line([x-2,cy],[x-1,cy],steelLight);line([x+1,cy],[x+2,cy],steel);
      line([x-1,cy+2],[x,cy+2],steel);
    }
    return {retroAA:true,outlet:[x,cy-10]};
  });
  add('purifier_hitCylinder',8,8,38,({rear,roundBody,point,ellipse,line})=>{
    const [cx,base]=point(4,4,0);
    roundBody(4,4,0,9,10,3,[cool,graphite,steel,ink]);
    roundBody(4,4,3,12,11,31,[ivoryLight,cream,cool,ink]);
    ellipse(cx,base-34,11,4,graphite,ink);
    ellipse(cx,base-34,7,2,steel);
    ellipse(cx,base-34,3,1,graphite);
    for(let y=5;y<23;y+=3)for(let x=-8;x<=6;x+=4){
      const px=cx+x+(y%2);line([px,base-y],[px+1,base-y],steelLight);
    }
    if(rear)line([cx+5,base-29],[cx+5,base-6],cool);
    return {retroAA:true,outlet:[cx,base-34]};
  });
  addPurifier('stackedHead',8,8,75,({rear,roundBody,point,ellipse,line},finish,head)=>{
    const [cx,base]=point(4,4,0);
    const casing=purifierPaint[finish];
    roundBody(4,4,0,10,10,2,[steel,graphite,graphite,ink]);
    roundBody(4,4,2,10,11,23,casing);
    roundBody(4,4,25,9,9,4,[steel,graphite,graphite,ink]);
    roundBody(4,4,29,10,11,24,casing);
    for(const bottom of [3,31])for(const dx of [-6,-3,1,5]){
      line([cx+dx,base-bottom-2],[cx+dx,base-bottom-17],casing[2]);
    }
    const cy=base-64;
    ellipse(cx,cy,10,11,steel,ink);
    ellipse(cx,cy,9,10,'#353444');
    if(!rear&&head==='pale')ellipse(cx,cy,7,8,'#e1dbd0');
    else if(!rear&&head!=='dark'&&(finish!=='taupe'||head==='ring')){
      ellipse(cx,cy,6,7,steelLight);
      if(head==='ring')ellipse(cx,cy,3,4,graphite);
    }
    if(rear){
      for(let dx=-4;dx<=4;dx+=2)line([cx+dx,cy-5],[cx+dx,cy+5],graphite);
    }else{
      line([cx-5,cy-6],[cx-2,cy-8],steelLight);
      line([cx-2,cy],[cx+1,cy],steelLight);
    }
    return {retroAA:true,outlet:[cx,cy-10]};
  });
  addPurifier('tower',8,8,78,({rear,roundBody,point,polygon,line},finish)=>{
    const paint=finish==='twoTone'?purifierPaint.wine:purifierPaint[finish];
    const wing=finish==='twoTone'?null:paint;
    roundBody(4,4,0,9,10,2,[steel,graphite,'#27263c',ink]);
    roundBody(4,4,2,8,10,23,paint||[warm,'#a59fa1','#79757b',ink]);
    const [x,y]=point(4,4,25);
    for(let dx=-6;dx<=6;dx+=3)line([x+dx,y+3],[x+dx+Math.sign(dx),y+21],paint?paint[2]:dx<0?taupeShade:'#87818b');
    // Two separately inked blades leave the wall visible through the long air slot.
    polygon([[x-8,y],[x-5,y-49],[x-2,y-50],[x-2,y-10],[x-1,y-6],[x+1,y-6],
      [x+2,y-10],[x+2,y-50],[x+5,y-49],[x+8,y],[x+4,y+2],[x-5,y+2]],wing?wing[1]:rear?taupeShade:warm,ink);
    line([x-6,y-4],[x-4,y-47],wing?wing[0]:ivoryLight);line([x+4,y-46],[x+6,y-2],wing?wing[2]:rear?'#a59fa1':cream);
    line([x-1,y-5],[x+1,y-5],rear?'#958c9c':'#867f83');
    if(rear)line([x-4,y+6],[x-4,y+17],'#79757b');
    return {retroAA:true,outlet:[x-2,y-25]};
  });
  addPurifier('table',12,12,40,({rear,roundBody,point,ellipse,line},finish)=>{
    const body=({red:purifierPaint.red,redWhite:purifierPaint.red,yellow:purifierPaint.yellow})[finish];
    const top=({red:purifierPaint.red,redTop:purifierPaint.red,yellowTop:purifierPaint.yellow,yellow:purifierPaint.yellow})[finish];
    const [x,y]=point(6,6,0);
    roundBody(6,6,0,10,11,2,[cream,cool,'#958c9c',ink]);
    roundBody(6,6,2,7,10,22,body||[steelLight,'#a59fa1','#79757b',graphite]);
    for(let dx=-5;dx<=5;dx+=2)line([x+dx,y-21],[x+Math.round(dx*1.45),y-2],body?body[2]:dx<0?cool:'#63616c');
    roundBody(6,6,24,8,7,9,[ivoryLight,cream,cool,graphite]);
    roundBody(6,6,33,7,8,4,[steel,graphite,'#27263c',ink]);
    for(let dx=-5;dx<=5;dx+=2)line([x+dx,y-34],[x+dx+1,y-32],steelLight);
    roundBody(6,6,37,17,17,2,top||[cream,ivoryLight,taupeShade,ink]);
    line([x-12,y-42],[x-6,y-44],ivoryLight);
    if(!rear)ellipse(x+7,y-40,1,0,'#b8b2b5');
    else line([x-4,y-10],[x-4,y-4],'#79757b');
    return {retroAA:true,outlet:[x-6,y-33]};
  });
  add('purifier_wallfit',23,6,30,({rear,box,face,bar,point})=>{
    for(const x of [1,21])box(x,2,0,1,2,4,[steelLight,cool,steel,graphite]);
    box(0,0,4,23,5,24,[ivoryLight,cream,taupeShade,ink]);
    if(rear){
      face([[2,5,23],[21,5,23],[21,5,8],[2,5,8]],cool,'#a59fa1');
      for(let z=12;z<=20;z+=3)bar([5,5,z],[18,5,z],'#958c9c');
    }else{
      face([[1,5,24],[22,5,24],[22,5,6],[1,5,6]],taupeShade,'#958c9c');
      // Staggered mesh leaves the thin frame and top control strip readable at 1×.
      for(let z=8;z<=22;z+=3)for(let x=2+(z%2);x<22;x+=2){
        bar([x,5,z],[x,5,z],x<11?'#a59fa1':'#958c9c');
      }
      bar([1,5,26],[6,5,26],ivoryLight);bar([20,5,26],[21,5,26],steel);
    }
    bar([4,2,28],[18,2,28],taupeShade);
    return {retroAA:true,outlet:point(11,2,28)};
  });
  addPurifier('flatLight',8,8,38,({roundBody,point,ellipse,line,rear})=>{
    roundBody(4,4,0,10,10,2,silver);roundBody(4,4,2,12,11,32,purifierPaint.white);
    const [x,y]=point(4,4,34);
    ellipse(x,y,11,4,graphite,ink);ellipse(x,y,9,3,ivoryLight);
    for(let row=0;row<5;row++)for(let col=-7;col<7;col+=3){
      const px=x+col+(row%2);line([px,y+15+row*3],[px+1,y+15+row*3],steelLight);
    }
    if(rear)line([x+6,y+7],[x+6,y+27],cool);
    return {retroAA:true,outlet:[x-8,y]};
  });
  addPurifier('stackedFlat',8,8,57,({roundBody,point,ellipse,line,rear})=>{
    roundBody(4,4,0,10,10,2,silver);
    roundBody(4,4,2,10,11,23,purifierPaint.white);
    roundBody(4,4,25,9,9,4,black);
    roundBody(4,4,29,10,11,24,purifierPaint.white);
    const [x,y]=point(4,4,53);
    ellipse(x,y,9,3,graphite);ellipse(x,y,7,2,cream);
    if(rear)line([x+6,y+6],[x+6,y+20],cool);
    return {retroAA:true,outlet:[x-8,y]};
  });
  addPurifier('disc',8,8,30,({rear,roundBody,point,ellipse,line})=>{
    roundBody(5,3,0,9,10,3,silver);
    const [x,y]=point(4,4,16);
    ellipse(x+2,y-1,15,15,cool,ink);ellipse(x,y,14,15,rear?cool:'#b6d0d4',ink);
    if(rear)for(let i=-6;i<=6;i+=3)line([x+i,y-7],[x+i,y+6],steel);
    else line([x-9,y-8],[x-5,y-11],'#e2f0f2');
    return {retroAA:true,outlet:[x+7,y-12]};
  });
  for(const shape of ['pocketCup','pocket','miniCone']){
    const small=shape!=='miniCone',size=small?4:8,h=small?23:31;
    addPurifier(shape,size,size,h,({point,roundBody,box,line,ellipse,rear},finish)=>{
      const [x,y]=point(size/2,size/2,0),paint=purifierPaint[finish];
      if(shape==='pocket'){
        box(.5,.5,0,3,3,20,paint);
        line([x-4,y-19],[x-9,y-12],graphite);line([x-9,y-12],[x-9,y-4],graphite);
        line([x-9,y-4],[x-4,y-14],graphite);
        if(!rear)for(let z=4;z<17;z+=3)line([x-3,y-z],[x+1,y-z+1],steel);
      }else{
        roundBody(size/2,size/2,0,small?4:7,small?4:11,h-3,paint);
        ellipse(x,y-h+3,small?3:6,2,small?graphite:cream,ink);
        if(!rear)for(let z=4;z<h-8;z+=3)line([x-3,y-z],[x+2,y-z+1],small?'#917567':cool);
      }
      return {retroAA:true,outlet:[x,y-(shape==='pocket'?19:h-3)]};
    });
  }
  addPurifier('catPerch',14,12,47,({roundBody,point,ellipse,line,rear})=>{
    roundBody(7,6,0,17,18,2,purifierPaint.white);
    roundBody(8,4,2,8,10,29,silver);
    roundBody(8,4,31,8,8,5,purifierPaint.white);
    roundBody(8,4,36,15,8,8,purifierPaint.white);
    const [x,y]=point(8,4,44);ellipse(x,y,13,5,'#cbbfb3',cool);
    roundBody(3,8,2,2,2,15,purifierPaint.white);roundBody(3,8,17,8,8,2,ivory);
    if(rear)line([x+5,y+18],[x+5,y+34],steel);
    return {retroAA:true,outlet:[x-5,y+10],perch:{step:point(3,8,19),seat:[x,y+1]}};
  });
  for(const shape of ['wallTall','wallSquare']){
    const tall=shape==='wallTall',w=tall?13:15,h=tall?42:37;
    addPurifier(shape,w,5,h,({box,bar,face,point,rear})=>{
      const foot=tall?5:1;
      for(const x of [1,w-2])box(x,2,0,1,2,foot,silver);
      box(0,0,foot,w,4,h-foot,purifierPaint.white);
      face([[1,4,h-4],[w-1,4,h-4],[w-1,4,foot+2],[1,4,foot+2]],taupeShade,'#958c9c');
      if(tall||rear)for(let x=2;x<w-1;x+=2)bar([x,4,h-5],[x,4,foot+3],steel);
      else for(let z=foot+4;z<h-5;z+=3)bar([2,4,z],[w-2,4,z],cool);
      return {retroAA:true,outlet:point(w/2,2,h)};
    });
  }
  add('dryer',12,11,42,({rear,box,drum,bar,face})=>{
    box(0,0,1,12,11,41,white);
    if(rear){for(let z=7;z<16;z+=3)bar([2,11,z],[7,11,z],'#a59f9e');return}
    drum(6,11,20,5.2,14,'#38363e');drum(6,11,20,4.3,11,'#62626d');drum(6,11,20,3.5,9,'#424752');
    drum(6,11,19,2.4,6,'#535d68');drum(6,11,19,.9,2,'#7c858f');
    bar([4,11,24],[6,11,27],'#93a3aa');drum(6,11,37,1.1,2,'#363944');
    face([[8,11,38],[11,11,38],[11,11,35],[8,11,35]],'#373940');bar([1,11,4],[11,11,4],'#c5c4c2');
  });
  add('purifier',8,8,56,({roundBody,point,ellipse,rear,bar})=>{
    for(const z of [1,23]){
      roundBody(4,4,z,11,10,3,black);roundBody(4,4,z+3,10,9,17,white);
      const [x,y]=point(4,4,z+3);for(let j=0;j<3;j++)for(let i=-6;i<8;i+=3)ellipse(x+i,y-3-j*3,0,0,'#a8a7aa');
    }
    const [x,y]=point(4,4,48);ellipse(x,y,9,10,'#32373b','#585761');ellipse(x,y,6,7,rear?'#727879':'#bfc6c3');
    if(!rear){ellipse(x,y,3,4,'#87928f');bar([4,8,26],[5,8,26],'#a8d9c4')}
  });
  add('fridge',15,11,64,({rear,box,bar,face})=>{
    box(0,0,1,15,11,63,ivory);
    if(rear){for(let z=5;z<=13;z+=3)bar([2,11,z],[13,11,z],'#a99c96');return}
    face([[.5,11,63],[7.2,11,63],[7.2,11,29],[.5,11,29]],'#e2d9ce');
    face([[8,11,63],[15,11,63],[15,11,29],[8,11,29]],'#34373c');
    face([[9,11,57],[14,11,57],[14,11,34],[9,11,34]],'#515963');
    for(const z of [38,45,52])bar([9,11,z],[14,11,z],'#717982');
    bar([7.5,11,63],[7.5,11,2],'#766d6d');bar([0,11,28],[15,11,28],'#554f53');
    bar([1,11,26],[14,11,26],'#a7978d');
  });
  const finishes={black,white,cream:ivory,slate:['#9c9dae','#62697c','#505367','#373744'],
    pine:['#809087','#48655a','#375047','#293b38'],plum:['#bc8e9c','#8b536b','#6e4159','#453340'],
    red:['#ea6a70','#b13344','#8f2839','#502932']};
  for(const [shape,color,dock,appearance,codes] of profiles){
    const key='robot_'+[shape,color,dock].filter(Boolean).join('_');
    for(const code of codes)models.set(code,{spriteKey:'db_'+key,
      appearance:appearance+(code.includes(' + ')?' · 세트 중 주 로봇 표시':''),hasDock:!!dock});
    const finish=finishes[color],H={tower:38,cabinet:28,garage:35,low:10,short:17,pad:6}[dock]||15;
    function station({box,bar,rear}){
      const front=rear?5:0,faceY=front+3;
      const coat=dock==='garage'||dock==='low'?white:finish,base=dock==='pad'?black:coat;
      const slim=dock==='tower'||dock==='pad',x=slim?1.5:0,w=slim?5:8;
      if(dock==='low'){
        box(0,front,2,8,4,H-4,white);
        box(0,front,H-2,8,4,2,black);
        if(!rear)box(.5,front+4,.5,7,.2,3,black);
        return;
      }
      box(x,front,0,w,3,.9*H,base);
      if(dock==='tower'||dock==='low'||dock==='pad')box(x,front,.9*H,w,3,1.5,black);
      if(!rear){
        if(dock==='cabinet')bar([1,faceY,10],[7,faceY,10],base[2]);
        if(dock==='garage')bar([0,faceY,H*.58],[8,faceY,H*.58],'#9c9998');
        box(x+.5,front+2.9,1,w-1,.4,dock==='garage'?11:3,black);
      }
    }
    function body({rear,point,roundBody,ellipse,box,line}){
      const y=dock?(rear?2:6):4,r=dock?10:13,high=shape==='nozzle'?12:8;
      const [cx,cy]=point(4,y,high);
      const details=()=>{
        if(shape==='nozzle'){
          const headY=rear?y-3:y+1.4;
          box(.1,headY,0,7.8,2.3,3,black);
          const a=point(.7,headY+2.3,2),b=point(7.3,headY+2.3,2);
          line(a,b,'#949499');
        }
        if(shape==='brush'){
          for(const sign of [-1,1]){
            const tip=cx+sign*(r-2),base=cy+7;
            for(const dy of [-1,2,4])line([tip,base],[tip+4*sign,base+dy],'#49464c');
          }
        }
      };
      if(rear)details();
      const bumper=shape==='mop'||shape==='brush'||shape==='visor'||shape==='nozzle'?black:silver;
      roundBody(4,y,1,r,r-1,3,bumper);roundBody(4,y,4,r,r,high-4,finish);
      const side=rear?1:-1;
      if(shape==='mop'||shape==='nozzle'){
        ellipse(cx+side,cy-1,shape==='mop'?6:5,3,'#303137','#282831');
        if(shape==='mop'){ellipse(cx+side,cy-1,2,1,'#6f737c');ellipse(cx+side+2,cy,0,0,'#b0b2af')}
      }else if(shape==='disc'||shape==='brush'){
        ellipse(cx+side,cy-1,3,2,shape==='brush'?'#32343e':finish[2]);
        ellipse(cx+side,cy-2,2,1,shape==='brush'?'#5c6566':finish[0]);
      }
      if(!rear){
        if(shape==='visor'){ellipse(cx-2,cy+4,4,2,'#313236');line([cx-3,cy],[cx+1,cy],'#99918d')}
        if(shape==='mop')line([cx-5,cy+3],[cx-5,cy+7],'#25262b');
        if(shape==='brush'){box(2.5,y+1.8,2,3,2.3,5,finish);ellipse(cx-3,cy+4,2,1,'#48363a')}
        details();
      }
    }
    if(dock){
      add(key+'_station',8,8,H,station);add(key+'_mobile',8,8,15,body);
    }
    add(key,8,8,Math.max(H,15),p=>{
      if(dock&&!p.rear)station(p);body(p);if(dock&&p.rear)station(p);
    });
  }
  // Older imported layouts can still use the generic category art for unknown models.
  for(const suffix of ['','_rear'])DOT_ASSETS.sprites.appl['db_robot'+suffix]=DOT_ASSETS.sprites.appl['db_robot_disc_black_pad'+suffix];
  add('stick',6,6,52,({box,bar,drum,rear})=>{
    box(0,1,0,6,4,3,black);bar([.5,5,2],[5.5,5,2],'#a3a5a6');
    bar([3,3,4],[3,2,39],'#965d68');bar([3.5,3,4],[3.5,2,39],'#e7adb2');
    box(2,1,35,3,3,9,black);box(2,1,41,3,2,7,black);
    bar([4,1,46],[5,1,51],'#514850');bar([5,1,51],[3,1,51],'#514850');
    drum(3.4,4,41,2,4,rear?'#56555a':'#cd9a9c');drum(3.4,4,41,.9,2,'#55505b');
  });
  for(const [shape,finish] of dehumidifierProfiles){
    const trim={black:graphite,white:ivoryLight,silver:steelLight,blue:'#b8d9e5',pink:'#f3bbcc',
      ivory:'#d5c5af',pewter:'#b3a6a4',sand:'#b99e82'}[finish];
    const coat=finish==='black'?['#595963','#37373c','#27263c',ink]:
      finish==='sand'?['#e6d5bf','#ceb79f','#ab9790',ink]:
      finish==='ivory'?[ivoryLight,'#e4dbcc',taupeShade,ink]:[ivoryLight,cream,cool,ink];
    const key='dehumid_'+shape+'_'+finish;
    add(key,10,9,46,({rear,box,face,bar,point})=>{
      const h=shape==='cabinet'?42:39,side=8;
      for(const x of [1,7])box(x,5,0,1,2,3,[steel,graphite,graphite,ink]);
      if(shape==='cabinet'){
        box(.5,.5,3,8,6.5,h-3,coat);
        bar([1,7,h-1],[1,7,5],'#6e6871');
      }else{
        // Clipped front corners keep the moulded case round on the 2:1 grid.
        const rim=[[1,0],[7,0],[8,1],[8,6],[7,7],[1,7],[0,6],[0,1]];
        for(let i=2;i<6;i++){
          const [a,b]=[rim[i],rim[i+1]];
          face([[...a,h],[...b,h],[...b,3],[...a,3]],i===4?coat[1]:coat[2],coat[2]);
        }
        face(rim.map(([x,y])=>[x,y,h]),coat[0],ink);
        bar([0,6,h],[0,6,3],ink);bar([8,1,h],[8,1,3],ink);
        bar([0,6,3],[1,7,3],ink);bar([1,7,3],[7,7,3],ink);bar([7,7,3],[8,6,3],ink);bar([8,6,3],[8,1,3],ink);
      }
      if(shape==='tank'||shape==='slim'){
        const y=rear?4:1;
        const crest=[[.5,y,h],[4,y,h+1],[6,y,h+6],[8,y,h+7]];
        face([...crest,...crest.slice().reverse().map(([x,v,z])=>[x,v+2,z])],trim,graphite);
        face([...crest.map(([x,v,z])=>[x,v+2,z]),[8,y+2,h],[.5,y+2,h]],trim,graphite);
        bar([5,y+2,h+3],[7,y+2,h+5],trim);
      }
      if(shape==='flush'){
        // The flush case has a narrow recessed outlet under the top lip.
        bar([1.5,2,h],[6.5,2,h],coat[2]);
        bar([2,2.6,h],[6,2.6,h],graphite);
      }else bar([2,3,h],[5,3,h],graphite);
      if(rear){
        for(let z=h-5;z>h-15;z-=3)bar([2,7,z],[6,7,z],'#968c97');
        bar([2,7,8],[6,7,8],coat[2]);
        if(shape==='tank')box(0,5.8,4,2,1.6,17,[steelLight,'#cfccc7','#92919d',graphite]);
      }else if(shape==='tank'){
        box(side,1,4,1.5,4,17,[steelLight,'#cfccc7','#92919d',graphite]);
        bar([9.5,4,18],[9.5,4,7],ivoryLight);
      }else{
        const depth=shape==='slim'||shape==='cabinet'?2:4;
        face([[side,1,21],[side,1+depth,21],[side,1+depth,4],[side,1,4]],'#858795',graphite);
        bar([side,2,17],[side,2,6],'#b8bec6');
      }
      return {retroAA:true,outlet:shape==='flush'?point(4,2.6,h):point(3,3,h)};
    });
  }
  add('dehumid',10,9,35,({box,bar,rear,face})=>{
    box(1,1,0,8,7,2,black);box(.5,0,2,9,8,30,ivory);
    bar([1,1,32],[8,1,32],'#958477');bar([8,1,32],[8,0,35],'#796f6b');
    bar([8,0,35],[9,0,34],'#b09d87');
    face([[9.5,6,17],[9.5,2,17],[9.5,2,4],[9.5,6,4]],'#a99e8f','#887d73');
    if(rear)for(let z=9;z<22;z+=3)bar([2,8,z],[8,8,z],'#a79887');
  });
  const coats={
    coral:['#ffaaaa','#ec817f','#c7646c',ink],berry:['#d86a87','#aa375c','#822c4b',ink],
    wine:['#bb8380','#945d5c','#743f43',ink],peach:['#f7d0b9','#e5aa8c','#c78e79',ink],
    almond:['#d4bbb3','#ae9186','#90766f',ink],taupe:['#ded2c8','#b5a599','#94867f',ink],
    neutral:['#e2dedc','#cac6c8','#aba4af',ink],white:[ivoryLight,cream,cool,ink],
    beige:[ivoryLight,warm,taupeShade,ink],silver:['#e3e5e7','#b7bac0','#8c8c98',ink],
    grey:['#cccbd2','#9f9daa','#737480',ink],black:['#666370','#41404c','#302e39',ink],
    brown:['#c8b7aa','#a99282','#806f66',ink],green:['#9aa99f','#657971','#465c54',ink],
    mint:['#d9eade','#add0b8','#90afa5',ink],pink:['#f3e0dc','#dab8bc','#b492a4',ink],
    blue:['#e2e8ef','#bfcedf','#929daf',ink],navy:['#758396','#48586f','#374254',ink],
    violet:['#e3dcee','#c7b6d5','#a394b2',ink],yellow:['#f8f0cf','#e3d6a5','#bfb397',ink]
  };
  function standlessTV(item){
    return item.body?.shape==='tvFlat'&&['unseen','wide','portrait'].includes(item.body.detail);
  }
  function renderDisplay(item,rear){
    const {shape,upper,detail}=item.body,frame=coats[upper],w=item.w,d=item.d;
    const mobile=shape==='tvMobile',easel=shape==='tvEasel',carry=shape==='tvCase';
    const upright=detail==='portrait'||detail==='kiosk';
    const span=Math.min(w,item.displayWidth||w);
    const width=upright?Math.max(7,Math.round(span*.57)):span;
    const margin=Math.floor((w-width)/2),right=margin+width,mid=margin+width/2;
    const bare=standlessTV(item);
    const bottom=mobile?24:easel?17:detail==='frame'?12:detail==='kiosk'?14:
      detail==='console'?8:detail==='lowStand'?2:bare?0:carry?4:5;
    const height=Math.round(span*(upright?1.94:detail==='wide'?.57:shape==='tvFlex'?1.02:1.14));
    const top=bottom+height;
    return sprite(w,d,top+1,rear,({box,bar,face,point,roundBody})=>{
      if(mobile){
        const radius=Math.round(width*.6);
        roundBody(mid,d/2,0,radius,radius,2,frame);box(mid-1,2,2,1.6,1.5,bottom,frame);
      }else if(easel||detail==='feet'){
        for(const side of [-1,1]){
          const x=mid+side*(width/2-2);
          for(const y of [1,d-1]){
            const end=x+side;
            bar([x,3,bottom+1],[end,y,0],ink);
            bar([x+.5,3,bottom+1],[end+.5,y,0],frame[1]);
          }
        }
      }else if(carry){
        box(margin,0,0,width,d,4,frame);bar([mid-2,d,2],[mid+2,d,2],ink);
      }else if(detail==='frame'){
        box(margin,1,0,width,2,1.5,frame);
        for(const x of [margin,right-1])box(x,1,0,1,2,bottom+1,frame);
      }else if(detail==='kiosk'||detail==='console'||shape==='tvCompact'){
        box(margin,2,0,width,2,bottom+1,frame);
        if(detail==='kiosk')box(margin-1,0,0,width+2,d,2,frame);
      }else if(detail==='lowStand'){
        box(margin+width*.17,1,0,width*.66,3,bottom,frame);
      }else if(detail==='openStand'){
        const spread=Math.max(3,Math.round(width*.24));
        box(mid-spread,1,0,2*spread,3,1,frame);
        for(const side of [-1,1])bar([mid+side*(spread-1),3,bottom],[mid+side*spread,3,1],ink);
      }else if(detail==='arcStand'){
        box(mid-1,2,1,2,2,bottom,frame);
        const spread=Math.round(width*.39);
        for(const side of [-1,1]){
          face([[mid,2,2],[mid+side*spread*.65,2.7,1],[mid+side*spread,4.5,0],
            [mid+side*spread*.55,4,1],[mid,3.5,1]],frame[1],ink);
        }
      }else if(!bare){
        const base=Math.max(5,Math.round(width*.45));
        box(mid-base/2,1,0,base,3,2,frame);box(mid-1,2,1,2,1,bottom,frame);
      }
      const front=4;
      box(margin,2,bottom,width,2,height,frame);
      if(rear){
        for(let z=bottom+4;z<=bottom+Math.min(8,height-1);z+=2)bar([w/2-3,front,z],[w/2+3,front,z],frame[2]);
        return {retroAA:true,heightPx:top};
      }
      const strip=easel?5:1;
      face([[margin+.5,front,top-1],[right-.5,front,top-1],
        [right-.5,front,bottom+strip],[margin+.5,front,bottom+strip]],'#363343',ink);
      bar([margin+1,front,top-3],[w/2,front,top-3],'#5a5369');
      if(shape==='tvFlex'){
        for(const x of [margin,right-1])box(x,3,bottom+1,1,2,height-1,black);
      }
      const [sx,sy]=point(margin+1,front,top-2);
      return {retroAA:true,heightPx:top,screen:[sx,sy,2*width-4,height-strip-3]};
    },true);
  }
  function renderStick(item,rear){
    const {shape,upper,detail}=item.body,coat=coats[upper],w=item.w,d=item.d;
    const air=shape==='stickAir',slim=air||shape==='stickA5';
    const tower=detail==='dock'||detail==='sideTower', side=detail==='sideTower';
    const h=air?52:57;
    return sprite(w,d,h,rear,({box,roundBody,bar,face})=>{
      if(tower){
        const tx=side?1.8:0,tw=w-tx;
        box(0,0,0,w,d,2,coat);box(tx,0,2,tw,side?3:4,h-2,coat);
        if(rear){
          for(let i=0;i<3;i++)bar([1,2.5,6+i*2],[w-1,2.5,6+i*2],coat[2]);
          return {retroAA:true};
        }
      }
      if(detail==='dock'){
        // The front-facing tower frames the head and the slim vertical wand.
        box(w*.32,3.8,h-16,w*.36,.5,13,black);
        bar([w/2,4.2,5],[w/2,4.2,h-17],graphite);
        box(1,d-2,2,w-2,1.6,3,black);
        return {retroAA:true,materials:[[coat[1],coat[0],coat[2]]]};
      }
      if(detail==='stand'){
        box(0,0,0,w,d,2,black);
        box(1,1,2,w-2,1.5,h*.57,coat);
      }
      const y=d-2;
      box(.2,y-1,0,w-.4,2.7,slim?2:4,black);
      bar([.8,d-.5,1],[w-1,d-.5,1],coat[2]);
      const shaft=shape==='stickA7'?2:1;
      box(w/2-shaft/2,y,3,shaft,1,h-17,silver);
      if((shape==='stickA9'||air)&&upper!=='neutral')box(w/2-.65,y,9,1.3,1,h-26,coat);
      if(shape==='stickA5'||shape==='stickA7'){
        box(w/2-1.6,y-1,17,3.2,1.8,h-22,black);
        bar([w/2,y+1,19],[w/2,y+1,h-8],coat[1]);
      }
      const radius=air?3:shape==='stickA9S'?5:4;
      roundBody(w/2,y,h-15,radius,radius-1,10,coat);
      if(!rear&&!slim){
        box(.5,y-1,h-9,2.2,2.2,5,black);
        roundBody(1,y,h-7,3,3,3,silver);
      }
      box(w/2-1,y-1,h-5,2,2,4,black);
      if(!rear){
        face([[w/2-1,y+1,h-5],[w/2+1,y+1,h-5],[w/2+1,y+1,h-11],[w/2-1,y+1,h-11]],graphite);
        bar([w/2+1,y,h-2],[w/2+2,y,h-9],ink);
      }
      return {retroAA:true,materials:[[coat[1],coat[0],coat[2]]]};
    },true);
  }
  function renderDryer(item,rear){
    const {detail,upper}=item.body,coat=coats[upper],w=item.w,d=item.d;
    const rack=detail==='rackBase',drawer=detail==='drawerBase';
    const baseHeight=rack||drawer||detail==='closedBase'?14:0;
    const top=50+baseHeight,front=rack||drawer?d-2:d;
    return sprite(w,d,top+1,rear,({box,face,bar,drum,point,ellipse})=>{
      const panel=(left,right,bottom,height,fill,edge)=>face([
        [left,front,height],[right,front,height],[right,front,bottom],[left,front,bottom]
      ],fill,edge);
      if(baseHeight)box(0,1,1,w,d-1,baseHeight-1,coat);
      box(0,1,baseHeight+1,w,front-1,49,coat);
      const materials=[[coat[1],coat[0],coat[2]]],master={retroAA:true,materials};
      if(upper==='beige'||upper==='green'||upper==='almond'||upper==='taupe'){
        face([[0,1,top],[w,1,top],[w,front,top],[0,front,top]],graphite,ink);
      }
      if(rear){
        for(let z=6;z<12;z+=2)bar([2,front,baseHeight+z],[w-2,front,baseHeight+z],coat[2]);
        bar([1,front,top-5],[1,front,baseHeight+3],coat[2]);
        return master;
      }
      const older=['meshDoor','smokedDoor','chromeRim','coinPanel','steelConsole'].includes(detail);
      const level=baseHeight+(older?24:27);
      const metalDoor=detail==='coinPanel'||detail==='steelConsole';
      const smoked=detail==='smokedDoor',mesh=detail==='meshDoor';
      drum(w/2,front,level,w*.47,17,ink);
      drum(w/2,front,level,w*.44,16,metalDoor?'#cbd1d1':detail==='chromeRim'?steelLight:graphite);
      drum(w/2,front,level,w*(metalDoor ? .32 : .37),metalDoor?12:14,
        smoked?'#455955':mesh?'#485059':detail==='brightDrum'?'#8e969e':'#424650');
      if(mesh){
        for(const [dx,dz] of [[-2.3,6],[2.5,6],[0,-8]])bar([w/2,front,level],[w/2+dx,front,level+dz],steel);
      }else{
        drum(w/2+.4,front,level-1,w*.22,8,smoked?'#2e423f':metalDoor?'#626b6a':detail==='brightDrum'?'#a8adb4':'#555b67');
        bar([w*.29,front,level+2],[w*.40,front,level+8],metalDoor||smoked?'#cbd1cf':steelLight);
        bar([w*.33,front,level+2],[w*.44,front,level+8],steelLight);
        if(detail==='brightDrum')bar([w*.50,front,level-9],[w*.66,front,level-5],'#d2d4d6');
      }
      if(metalDoor){
        panel(0,w,top-8,top,steelLight,steel);
        panel(detail==='coinPanel'?1:4,detail==='coinPanel'?4:8,top-6,top-2,graphite);
        if(detail==='coinPanel'){
          panel(w-3,w-1,top-7,top-1,coat[2],graphite);
          panel(2,w-2,1,6,coat[1],steel);
        }
      }else{
        if(older)bar([0,front,top-8],[w,front,top-8],coat[2]);
        bar([1,front,top-5],[4,front,top-5],coat[2]);
        drum(w/2,front,top-4,1.15,2.5,older?steel:graphite);
        panel(w-4.4,w-.4,top-6,top-2,graphite,ink);
        bar([w-3.4,front,top-4],[w-2.1,front,top-4],steelLight);
        if(detail==='displayHatch'){
          panel(w-4.7,w-.7,2,9,coat[1],steel);
          bar([w-4.2,front,8],[w-3.1,front,8],coat[0]);
        }
      }
      if(rack||drawer){
        // Keep the pulled-out module within the placement footprint.
        box(0,d-4,2,w,4,6,coat);
        face([[1,d-4,9],[w-1,d-4,9],[w-1,d,9],[1,d,9]],graphite,ink);
        if(rack)for(let x=2;x<w-1;x+=2)bar([x,d-4,9],[x,d,9],steelLight);
        else{
          const [cx,cy]=point(w/2,d-2,9);
          ellipse(cx,cy,6,2,'#525866',steel);
        }
      }
      return {...master,drumCenter:point(w/2,front,level)};
    },true);
  }
  function renderFridge(item,rear){
    const {shape,detail,upper,lower}=item.body,up=coats[upper],down=coats[lower];
    const h={miniCube:29,miniTall:44,wineShort:36,wineMid:55,wineTall:78,
      single:72,column:80,bottom:77,freezerTop:69}[shape]||75;
    const wine=shape.startsWith('wine'),drawers=shape==='drawerFour'||shape==='glassDrawers';
    const narrow=wine||['single','column','bottom','miniCube','miniTall','glassDrawers'].includes(shape);
    const x=narrow?1.5:0,end=item.w-x,width=end-x,y=item.d;
    const split={four:33,french:23,side:33,freezerTop:47,bottom:28,two:39,drawerFour:31,glassDrawers:30}[shape];
    const paired=['four','side','drawerFour','french'].includes(shape);
    const mid=x+width/2;
    return sprite(item.w,y,h,rear,({box,bar,face,point})=>{
      const panel=(left,right,low,high,fill,edge)=>face([[left,y,high],[right,y,high],[right,y,low],[left,y,low]],fill,edge);
      const lineAt=(z,color)=>bar([x+.5,y,z],[end-.5,y,z],color);
      // The cabinet is recessed behind both the door skin and the dark toe kick.
      box(x+1,4,0,width-2,y-5,4,[graphite,graphite,ink,ink]);
      box(x,3,3,width,y-4,h-3,up);
      if(rear){
        panel(x+.6,end-.6,4,h-2,up[2],graphite);
        panel(x+1.6,end-1.6,5,15,up[1],graphite);
        for(const z of [7,10,13])bar([x+2.5,y,z],[end-2.5,y,z],graphite);
      }else{
        const door=(l,r,lo,hi,coat)=>{
          box(l,y-1.5,lo,r-l,1.5,hi-lo,coat);
          bar([l+.6,y,hi-1],[r-.6,y,hi-1],coat[0]);
        };
        const row=(lo,hi,coat,double)=>{
          if(double){
            door(x,mid-.4,lo,hi,coat);door(mid+.4,end,lo,hi,coat);
          }else door(x,end,lo,hi,coat);
        };
        if(split){
          row(split+1,h-1,up,paired);
          if(drawers){
            row(4,14,down,false);row(17,split-2,down,false);
          }else row(4,split-2,down,shape==='four'||shape==='side');
          // A recessed finger pull reads as a shadow with a lit lower lip.
          lineAt(split,ink);lineAt(split-1,graphite);
          if(!paired&&!drawers){
            bar([x+1,y,split-2],[x+width*.45,y,split-2],up[0]);
          }
        }else{
          row(4,h-1,up,false);
          if(!wine&&detail!=='edgeHandle'){
            const mini=shape==='miniTall'||shape==='miniCube';
            if(mini){
              panel(x+.8,x+width*.5,h-4,h-2,graphite,ink);
              bar([x+1,y,h-5],[x+width*.47,y,h-5],up[0]);
            }else{
              const grip=h*.57;
              panel(x+.6,x+1.7,grip-5,grip+5,graphite,ink);
              bar([x+1.8,y,grip+4],[x+1.8,y,grip-4],up[0]);
            }
          }
        }
        if(wine||shape==='glassDrawers'||detail==='window'||detail==='windowWater'){
          const full=wine||shape==='glassDrawers'||shape==='bottom';
          const left=full?x+.7:x+width*.53, right=end-.65;
          const low=wine?6:(split||33)+3;
          panel(left,right,low,h-2,'#32333f',ink);
          const spacing=wine?8:10;
          for(let z=low+4;z<h-5;z+=spacing){
            bar([left+.5,y,z],[right-.5,y,z],steel);
            if(wine)bar([left+1,y,z+2],[left+2.5,y,z+2],'#b39c84');
          }
        }
        if(detail==='water'||detail==='windowWater'){
          panel(x+1,x+width*.40,43,58,steel,graphite);
          panel(x+1.4,x+width*.37,44,53,'#424351',graphite);
          bar([x+1.7,y,45],[x+width*.34,y,45],steelLight);
        }
        if(detail==='edgeHandle'){
          panel(x+.7,x+1.9,h-23,h-9,graphite,ink);
          bar([x+1.8,y,h-10],[x+1.8,y,h-22],steelLight);
        }
      }
      return {retroAA:true,materials:[],
        doorEdge:point(x+.8,y,split||Math.round(h*.5))};
    },true);
  }
  function renderBody(item,rear){
    if(item.catalogFamily==='냉장고')return renderFridge(item,rear);
    if(item.body.shape==='dryer'&&item.body.detail&&!['blackGlass','raisedControl'].includes(item.body.detail))return renderDryer(item,rear);
    if(item.catalogFamily==='TV')return renderDisplay(item,rear);
    if(item.catalogFamily==='무선청소기')return renderStick(item,rear);
    const {shape,upper,lower,detail}=item.body,up=coats[upper],down=coats[lower];
    const h=({tower:100,twin:62,comboMini:65,small:38,top:49}[shape]||50);
    const w=item.w,d=item.d;
    // Reserve vertical canvas space for the raised panel without lifting the cabinet off the floor.
    const [washerFront,basePanel]=detail.split('+');
    const consoleLid=washerFront==='consoleLid',coinBox=washerFront==='coinDoor';
    const raised=detail==='raisedControl',blackGlass=detail==='blackGlass';
    return sprite(w,d,h+(raised||coinBox?10:consoleLid?5:0),rear,({box,bar,face,drum,point})=>{
      const x=0;
      const pedestal=shape==='twin'||shape==='comboMini';
      const width=w-2*x,front=d,z=pedestal?13:1;
      if(shape==='tower'&&!rear){
        box(0,1,1,w,d-1,47,down);box(0,1,48,w,d-1,5,washerFront==='towerThin'?down:[steel,graphite,graphite,ink]);
        box(0,1,53,w,d-1,h-53,up);
      }else box(x,1,1,width,d-1,h-1,up);
      const materials=[up,down].map(([light,base,shade])=>[base,light,shade]);
      const master={retroAA:true,materials};
      if(consoleLid)box(0,1,h,w,2,5,[graphite,graphite,steel,ink]);
      if(coinBox)box(w-4,2,h,3,3,9,up);
      if(raised)box(w-3,1,h,2.5,2,10,down);
      if(blackGlass&&upper!=='white')face([[x,1,h],[w,1,h],[w,d,h],[x,d,h]],graphite,ink);
      if(rear){
        for(let i=0;i<3;i++)bar([x+2,front,7+i*2],[x+width-2,front,7+i*2],up[2]);
        bar([x+1,front,h-5],[x+1,front,3],up[2]);
        return {...master,lid:point(4,2,h)};
      }
      if(shape==='top'){
        const edge=washerFront==='paleLid'?up[2]:graphite;
        const glass=washerFront==='paleLid'?up[0]:washerFront==='clearLid'?steel:graphite;
        const start=consoleLid?3:2;
        face([[1,start,h],[w-1,start,h],[w-1,d-1,h],[1,d-1,h]],glass,edge);
        bar([2,start+1,h],[w-3,start+1,h],washerFront==='clearLid'?steelLight:up[2]);return {...master,lid:point(w-2,2,h)};
      }
      const center=shape==='tower'?25:z+Math.round((h-z)*.46);
      function glassDoor(height){
        if(washerFront==='opaqueDoor'){
          drum(w/2,d,height,w*.45,16,ink);drum(w/2,d,height,w*.39,14,graphite);return;
        }
        if(['chromeDoor','coinDoor'].includes(washerFront)){
          drum(w/2,d,height,w*.46,16,steel);drum(w/2,d,height,w*.40,14,steelLight);
          drum(w/2,d,height,w*.28,10,graphite);bar([w*.36,d,height+3],[w*.46,d,height+7],steelLight);return;
        }
        drum(w/2,d,height,w*.42,15,graphite);drum(w/2,d,height,w*.34,12,steel);
        drum(w/2,d,height,w*.29,10,'#414653');drum(w*.53,d,height-2,w*.18,6,'#535a66');bar([w*.33,d,height+3],[w*.45,d,height+8],'#8898a6');
      }
      if(blackGlass||raised){
        const level=blackGlass?27:25;
        drum(w/2,d,level,w*.46,blackGlass?17:15,blackGlass?ink:graphite);
        drum(w/2,d,level,w*.40,blackGlass?15:13,blackGlass?graphite:steelLight);
        drum(w/2,d,level,w*.31,11,blackGlass?'#4e4d5a':'#626875');
        drum(w*.52,d,level-2,w*.22,7,blackGlass?'#373540':'#7c8287');
        bar([w*.32,d,level+3],[w*.44,d,level+8],steelLight);
        if(raised)bar([w*.52,d,level+7],[w*.62,d,level-3],'#bfc3c2');
        bar([1,d,h-4],[4,d,h-4],up[2]);
        if(blackGlass){
          drum(w/2,d,h-4,1.15,2,graphite);
          face([[w-4,d,8],[w-1,d,8],[w-1,d,2],[w-4,d,2]],up[1],up[2]);
        }else{
          bar([0,d,h-7],[w,d,h-7],steel);
          face([[w*.40,d,h-2],[w*.66,d,h-2],[w*.66,d,h-5],[w*.40,d,h-5]],graphite);
          bar([0,d,6],[w,d,6],up[2]);
        }
        return {...master,drumCenter:point(w/2,d,level)};
      }
      glassDoor(center);
      if(shape==='tower'){glassDoor(76);bar([w-4,d,51],[w-2,d,51],steelLight)}
      else{
        if(washerFront==='wideBand'||(!washerFront&&(shape==='comboMini'||shape==='combo')))face([[0,d,h],[w,d,h],[w,d,h-8],[0,d,h-8]],graphite);
        bar([1,d,h-4],[4,d,h-4],up[2]);drum(w/2,d,h-5,.85,2,graphite);
        face([[w-4,d,h-3],[w-1,d,h-3],[w-1,d,h-7],[w-4,d,h-7]],graphite);
      }
      if(basePanel||pedestal||shape==='dryer'){
        const level=pedestal||basePanel?13:7;
        bar([0,d,level],[w,d,level],up[2]);
        if(pedestal)bar([3,d,level-3],[w-3,d,level-3],graphite);
        if(shape==='dryer')for(let i=1;i<=3;i++)bar([1,d,i+1],[4,d,i+1],steel);
      }
      return {...master,drumCenter:point(w/2,d,center),lid:washerFront==='opaqueDoor'?point(w-3,d,h-5):undefined};
    },true);
  }
  return {robots:models,renderBody,standlessTV};
})();
