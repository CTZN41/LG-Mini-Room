// Build a compact index for rendering saved model keys as well as search results.
// The canonical sale is the same lowest product_id used by the model photo route.
const tones=[
  ['black',/블랙|그라파이트|미드나잇|다크샤인/],['navy',/네이비/],['green',/그린/],
  ['mint',/민트/],['pink',/핑크|피치/],['blue',/스카이|블루/],['violet',/라벤더/],
  ['brown',/브라운|토프|레드우드/],['beige',/베이지|샌드|아몬드/],['white',/화이트/],
  ['grey',/그레이/],['silver',/실버|스테인리스/],['yellow',/레몬/]
];
const colorWords=new RegExp(tones.map(([,pattern])=>pattern.source).join('|'),'g');
function colors(value){
  return (value?.match(colorWords)||[]).map(word=>tones.find(([,pattern])=>pattern.test(word))[0]);
}
const fridgeShapes={'냉장고 4도어':'four','냉장고 3도어':'french','냉장고 1도어':'single',
  '컨버터블 냉장고':'column','모던엣지 냉장고':'bottom'};
const washShapes={'워시타워 전체':'tower','트윈워시 전체':'twin','워시콤보':'combo','미니워시':'mini',
  '상단도어 세탁기':'top','소형 세탁기':'small','전면도어 세탁·건조 가전':'drum'};
const roleShapes={'워시타워':'tower','트윈워시':'twin','워시콤보':'combo','미니워시':'mini'};
function laundryTone(text,role){
  const clause=text.split(' · ').find(part=>part.includes(role)&&part.includes('색상'));
  return colors(clause?.split('색상').pop())[0];
}
export function catalogBodies(db){
  const rows=db.prepare(`WITH chosen AS (
    SELECT min(product_id) AS product_id FROM products WHERE category IN ('냉장고','세탁기','건조기','TV','무선청소기')
    GROUP BY category,model_name)
    SELECT p.category,p.model_name model,p.title_model main,p.appearance,p.door_color,p.fridge_display_name,
      p.photo_review_status,g.photo_subject subject,
      EXISTS (SELECT 1 FROM product_components c WHERE c.product_id=p.product_id AND c.component_role='청소기 타워·충전대') hasDock,
      EXISTS (SELECT 1 FROM product_components c WHERE c.product_id=p.product_id AND c.component_role='미니워시') hasMini,
      (SELECT c.component_role FROM product_components c
      WHERE c.product_id=p.product_id AND c.component_model=p.title_model ORDER BY c.rowid LIMIT 1) role
    FROM chosen JOIN products p USING(product_id) JOIN appearance_groups g USING(group_id)`).all();
  const washers=new Map(rows.filter(r=>r.category==='세탁기').map(r=>[r.model,r]));
  const units=new Map(rows.map(row=>[row.category+'|'+row.model,row]));
  const tvShapes={'이동형 화면':'tvMobile','포제 TV':'tvEasel','Flex TV':'tvFlex','룸앤TV':'tvCompact'};
  const stickShapes={'무선청소기 A5':'stickA5','무선청소기 A7':'stickA7','무선청소기 A9 Air':'stickAir',
    '무선청소기 A9S':'stickA9S','무선청소기 A9':'stickA9'};
  return rows.map(row=>{
    let shape,upper,lower,detail='',main='';
    if(row.category==='TV'||row.category==='무선청소기'){
      const set=row.main!==row.model,unit=(set&&units.get(row.category+'|'+row.main))||row;
      if(set)main=row.main;
      if(row.category==='TV'){
        shape=unit.appearance?.includes('캐리백형')?'tvCase':tvShapes[unit.subject]||'tvFlat';
        upper=['tvCase','tvCompact','tvEasel','tvMobile'].includes(shape)?'white':'black';
      }else{
        shape=stickShapes[unit.subject]||'stickA9';
        upper=colors(unit.appearance||'')[0];
        if(!upper&&unit.model==='A912PM')upper='pink'; // Rose wand on the supplied product photo.
        if(unit.hasDock||row.hasDock)detail='dock';
      }
    }else if(row.category==='냉장고'){
      const name=row.fridge_display_name||'';
      shape=fridgeShapes[row.subject]||'plain';
      if(row.subject==='냉장고 2도어')shape=name.includes('양문')?'side':name.includes('일반')?'freezerTop':'two';
      if(name.includes('노크온'))detail='window';
      else if(name.includes('얼음정수'))detail='water';
      // The supplied representative photograph establishes this otherwise unlabelled front.
      if(row.model==='M876GCB472'){shape='four';detail='window';upper='brown';lower='beige'}
      else [upper,lower]=colors(row.door_color);
      if(row.photo_review_status==='보류')detail='review';
    }else{
      const set=['여러 가전이 포함된 세트','세탁기·건조기 세트'].includes(row.subject);
      const unit=set?washers.get(row.main):row;
      shape=row.category==='건조기'?'dryer':washShapes[row.subject]||roleShapes[row.role]||washShapes[unit?.subject]||'drum';
      if(row.hasMini&&shape==='combo')shape='comboMini';
      else if(row.hasMini&&shape==='drum')shape='twin';
      if(set)main=row.main;
      const evidence=row.appearance||'';
      const body=unit?.appearance?.startsWith('본체 색상')?colors(unit.appearance.split(' · ')[0])[0]:undefined;
      const singleTone=evidence.startsWith('본체 색상')?colors(evidence.split(' · ')[0])[0]:undefined;
      if(shape==='tower'){
        upper=laundryTone(evidence,'건조기')||laundryTone(unit?.appearance||'','건조기');
        lower=laundryTone(evidence,'세탁기')||laundryTone(unit?.appearance||'','세탁기')||'neutral';
      }else upper=laundryTone(evidence,row.role)||body||singleTone;
      if(row.category==='건조기'){
        if(row.model==='RD19ENC')detail='blackGlass';
        if(row.model==='RV12SBD'){detail='raisedControl';upper='silver'}
      }
    }
    return [row.category,row.model,shape,upper||'neutral',lower||upper||'neutral',detail,main];
  });
}
