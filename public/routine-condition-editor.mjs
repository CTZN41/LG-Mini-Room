import {describeRule,needsWeather,validateRule,seoulClock} from './routine-conditions.mjs';
import {places} from './routine-places.mjs';

export {describeRule};
export function conditionEditor({model,render,notice,run}){
  const el=id=>document.getElementById(id);
  const dialog=el('conditionDialog'),form=el('conditionForm'),area=el('conditionArea'),status=el('conditionStatus');
  let recordId,requestVersion=0;
  const saved=()=>model.state.savedRoutines.find(r=>r.templateId===recordId);
  for(const place of places)area.add(new Option(place.label,place.id));
  function fields(){
    el('conditionSchedule').hidden=!el('useTime').checked;
    el('temperatureValue').hidden=!el('useTemperature').checked;
    el('weatherLocation').hidden=!el('useTemperature').checked&&!el('useRain').checked;
  }
  function resetCheck(){
    ++requestVersion;status.textContent='';el('conditionRun').hidden=true;el('conditionSource').hidden=true;
  }
  form.oninput=()=>{resetCheck();fields()};
  dialog.addEventListener('close',resetCheck);
  function draft(){
    const rule={};
    if(el('useTime').checked)Object.assign(rule,{time:el('conditionTime').value,days:el('conditionDays').value});
    if(el('useTemperature').checked)rule.minTemp=el('conditionTemp').valueAsNumber;
    if(el('useRain').checked)rule.rain=true;
    validateRule(rule);
    if(needsWeather(rule)&&!places.some(p=>p.id===area.value))throw Error('우리 집의 날씨 지역을 선택해 주세요.');
    return rule;
  }
  function store(rule){
    model.update(home=>{
      const record=home.savedRoutines.find(r=>r.templateId===recordId);
      if(!record)throw Error('저장된 루틴을 찾을 수 없어요.');
      if(rule){
        record.condition=rule;
        if(needsWeather(rule))home.weatherPlace=area.value;
      }else delete record.condition;
    });
    dialog.close();render();notice(rule?'실행 조건을 저장했어요.':'조건을 해제했어요.');
  }
  form.onsubmit=event=>{event.preventDefault();try{store(draft())}catch(e){status.textContent=e.message}};
  el('conditionClear').onclick=()=>{try{store(null)}catch(e){status.textContent=e.message}};
  async function check(execute){
    const version=++requestVersion;el('conditionSource').hidden=true;
    el('conditionRun').hidden=true;
    try{
      const record=saved(),rule=draft();
      if(!record?.condition || describeRule(rule)!==describeRule(record.condition) ||
          (needsWeather(rule)&&model.state.weatherPlace!==area.value)){
        status.textContent='변경한 조건을 먼저 저장해 주세요.';return;
      }
      const params=new URLSearchParams({rule:JSON.stringify(rule)});
      if(needsWeather(rule))params.set('place',area.value);
      status.textContent='조건 확인 중…';
      const res=await fetch('/api/routine-context?'+params,{cache:'no-store',signal:AbortSignal.timeout(15000)});
      if(!res.ok)throw Error();
      const result=await res.json();
      if(version!==requestVersion||!dialog.open)return;
      const decision=result.check, clock=seoulClock(result.now);
      const lines=[{match:'조건 맞음',miss:'아직 안 맞음',pending:'날씨 확인 대기'}[decision.status]+' · '+decision.detail,
        '한국 시각 '+clock.date+' '+clock.time];
      if(needsWeather(rule)){
        const region=area.selectedOptions[0].textContent;
        const source=result.source==='kma'?'기상청 관측':result.source==='open-meteo'?'Open-Meteo 모델 추정':'날씨 연결 대기';
        const at=result.weather?.observedAt && seoulClock(result.weather.observedAt);
        if(at){
          const box=el('conditionSource'),link=box.querySelector('a');
          link.href=result.source==='kma'?'https://www.data.go.kr/data/15084084/openapi.do':'https://open-meteo.com/';
          link.textContent=source+' 자료 출처';box.hidden=false;
        }
        lines.push(region+' · '+source+(at?' · '+at.date+' '+at.time+' 기준':''));
      }
      status.textContent=lines.join('\n');
      if(decision.status==='match'){
        if(execute){dialog.close();run(record)}
        else el('conditionRun').hidden=false;
      }
    }catch(e){
      if(version===requestVersion&&dialog.open)status.textContent='조건 확인 대기 · '+(e instanceof TypeError||e.name==='TimeoutError'?'서버 연결을 확인한 뒤 다시 눌러 주세요.':e.message||'다시 시도해 주세요.');
    }
  }
  el('conditionCheck').onclick=()=>check(false);
  el('conditionRun').onclick=()=>check(true);
  return function open(record,name){
    recordId=record.templateId;resetCheck();
    const r=record.condition||{};
    el('conditionTitle').textContent=name+' · 실행 조건';
    el('useTime').checked=!!r.time;el('conditionTime').value=r.time||'18:00';el('conditionDays').value=r.days||'weekday';
    el('useTemperature').checked=r.minTemp!=null;el('conditionTemp').value=r.minTemp??28;
    el('useRain').checked=r.rain===true;area.value=model.state.weatherPlace||'';
    el('conditionCheck').hidden=!record.condition;el('conditionClear').hidden=!record.condition;
    fields();dialog.showModal();
  };
}
