// Build a compact index for rendering saved model keys as well as search results.
// The canonical sale is the same lowest product_id used by the model photo route.
import tvPhotos from './data/tv-photo-profiles.json' with {type:'json'};
import fridgePhotos from './data/fridge-photo-profiles.json' with {type:'json'};
import stickPhotos from './data/stick-photo-profiles.json' with {type:'json'};
import washerReview from './washer-profiles.cjs';
import dryerReview from './dryer-profiles.cjs';
const tvByPhoto=new Map(Object.entries(tvPhotos).flatMap(([stand,hashes])=>hashes.map(hash=>[hash,stand])));
// Keys describe the photographed primary body. One photograph always uses one recipe.
const reviewedBodies=new Map();
for(const [category,groups] of [['냉장고',fridgePhotos],['무선청소기',stickPhotos]]){
  for(const [recipe,hashes] of Object.entries(groups)){
    const [shape,upper,lower,detail,status]=recipe.split('/');
    for(const hash of hashes)reviewedBodies.set(category+'|'+hash,{shape,upper,lower,detail,status});
  }
}
const photoDetails={windowWater:'유리창과 정수 홈',edgeHandle:'세로 모서리 손잡이',
  sideTower:'측면에 본체가 드러난 충전 타워',stand:'낮은 거치대와 노출된 흡입관',bare:'흡입 헤드와 노출된 흡입관'};
const tvStands={
  openStand:'가운데가 열린 사각 받침', arcStand:'활처럼 휜 가로 받침', lowStand:'패널 아래 낮고 넓은 받침',
  unseen:'사진에서 받침 미확인', feet:'양쪽 하단의 독립된 다리', pedestal:'패널 중앙의 받침대',
  console:'패널 전체 폭의 하단부', frame:'열린 하부 프레임', kiosk:'세로 본체와 바닥 받침',
  wide:'가로로 긴 패널 · 받침 미확인', portrait:'세로 패널 · 받침 미확인',
  mobile:'이동형 기둥과 바닥 받침', deskWhite:'짧은 흰색 탁상 받침', easel:'패브릭 하단과 긴 다리',
  case:'케이스 일체형 하단', compact:'탁상형 일체 하단', flex:'곡면 패널과 중앙 받침'
};
// The reviewed Korean TV families encode the nominal diagonal in their model codes.
function tvInches(model){
  if(model==='LAPA163')return 163;
  return Number(/^(?:OLED)?(\d{2,3})(?=[A-Z])/.exec(model)?.[1])||null;
}
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
      p.photo_review_status,i.sha256 photoHash,g.photo_subject subject,
      EXISTS (SELECT 1 FROM product_components c WHERE c.product_id=p.product_id AND c.component_role='청소기 타워·충전대') hasDock,
      EXISTS (SELECT 1 FROM product_components c WHERE c.product_id=p.product_id AND c.component_role='미니워시') hasMini,
      (SELECT c.component_role FROM product_components c
      WHERE c.product_id=p.product_id AND c.component_model=p.title_model ORDER BY c.rowid LIMIT 1) role
    FROM chosen JOIN products p USING(product_id) JOIN appearance_groups g USING(group_id) JOIN images i USING(image_id)`).all();
  const washers=new Map(rows.filter(r=>r.category==='세탁기').map(r=>[r.model,r]));
  const units=new Map(rows.map(row=>[row.category+'|'+row.model,row]));
  const tvShapes={'이동형 화면':'tvMobile','포제 TV':'tvEasel','Flex TV':'tvFlex','룸앤TV':'tvCompact'};
  const stickShapes={'무선청소기 A5':'stickA5','무선청소기 A7':'stickA7','무선청소기 A9 Air':'stickAir',
    '무선청소기 A9S':'stickA9S','무선청소기 A9':'stickA9'};
  return rows.map(row=>{
    let shape,upper,lower,detail='',main='';
    const reviewed=reviewedBodies.get(row.category+'|'+row.photoHash);
    if(reviewed){
      const {shape,upper,lower,detail,status}=reviewed;
      return [row.category,row.model,shape,upper,lower,detail,'',photoDetails[detail]||'',
        status==='open'?'열린 문 사진 · 외관 일부 확인':'사진 대조 완료'];
    }
    if(row.category==='TV'||row.category==='무선청소기'){
      const set=row.main!==row.model,unit=(set&&units.get(row.category+'|'+row.main))||row;
      if(set)main=row.main;
      if(row.category==='TV'){
        shape=unit.appearance?.includes('캐리백형')?'tvCase':tvShapes[unit.subject]||'tvFlat';
        const reviewed=tvByPhoto.get(row.photoHash);
        detail=reviewed||'unseen';
        if(detail==='deskWhite')shape='tvFlat';
        upper=['tvCase','tvCompact','tvEasel','tvMobile'].includes(shape)||detail==='deskWhite'?'white':'black';
        return [row.category,row.model,shape,upper,upper,detail,main,tvStands[detail],
          reviewed?(detail==='unseen'?'받침 미확인':'사진 대조 완료'):'미판정',tvInches(row.model)];
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
      if(row.category==='세탁기'){
        const profile=washerReview.profile(unit?.model||row.model,shape,upper||'neutral',lower||upper||'neutral');
        const sameForm=['glassDoor','towerBand','compactDoor'].includes(profile.detail)&&!['combo','comboMini'].includes(shape);
        const sameColors=profile.upper===(upper||'neutral')&&profile.lower===(lower||upper||'neutral');
        const decision=sameForm?(sameColors?'기존 도트 유지':'색 변형'):'형태 수정';
        return [row.category,row.model,shape,profile.upper,profile.lower,profile.detail,main,profile.reason,decision];
      }
      if(row.category==='건조기'){
        const profile=dryerReview.models.get(row.model);
        if(profile){
          if(profile.detail!=='hold'){detail=profile.detail;upper=profile.tone}
          return [row.category,row.model,shape,upper||'neutral',upper||'neutral',detail,main,profile.reason];
        }
      }
    }
    return [row.category,row.model,shape,upper||'neutral',lower||upper||'neutral',detail,main];
  });
}
