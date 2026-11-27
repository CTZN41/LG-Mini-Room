// All conditions use the home's Korean local time, independent of the phone's zone.
const minute = 60_000;
export function seoulClock(instant) {
  const time = new Date(instant);
  if (!Number.isFinite(time.getTime())) throw Error('서버 시각을 확인할 수 없어요.');
  const local = new Date(time.getTime() + 9 * 60 * minute);
  const iso = local.toISOString();
  return {day:local.getUTCDay(), date:iso.slice(0,10), time:iso.slice(11,16)};
}

export function validateRule(rule) {
  if (!rule || typeof rule !== 'object' || Array.isArray(rule) ||
      !Object.keys(rule).length || Object.keys(rule).some(k=>!['time','days','minTemp','rain'].includes(k)))
    throw Error('시간이나 날씨 조건을 골라 주세요.');
  if ('time' in rule || 'days' in rule) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(rule.time) || !['daily','weekday','weekend'].includes(rule.days))
      throw Error('요일과 시각을 확인해 주세요.');
  }
  if ('minTemp' in rule && (!Number.isFinite(rule.minTemp) || rule.minTemp < -50 || rule.minTemp > 60))
    throw Error('바깥 기온을 -50~60°C 사이로 입력해 주세요.');
  if ('rain' in rule && rule.rain !== true) throw Error('강수 조건을 확인해 주세요.');
}
const dayNames={daily:'매일',weekday:'평일',weekend:'주말'};
export function describeRule(rule) {
  return [rule.time && dayNames[rule.days]+' '+rule.time,
    rule.minTemp != null && '바깥 '+rule.minTemp+'°C 이상',rule.rain && '비가 올 때'].filter(Boolean).join(' · ');
}
export const needsWeather = rule => rule.minTemp != null || rule.rain === true;
export function evaluateRule(rule, {now,weather}) {
  validateRule(rule);
  const clock=seoulClock(now), reasons=[];
  if(rule.time){
    const weekend=clock.day===0||clock.day===6;
    if(rule.time!==clock.time || (rule.days==='weekday'&&weekend) || (rule.days==='weekend'&&!weekend))
      return {status:'miss',detail:'현재 한국 시각 '+clock.date+' '+clock.time+' · 설정 '+dayNames[rule.days]+' '+rule.time};
    reasons.push('한국 시각 '+clock.time);
  }
  if(needsWeather(rule)){
    const age=Date.parse(now)-Date.parse(weather?.observedAt);
    if(!Number.isFinite(age)||age<0||age>90*minute)
      return {status:'pending',detail:'최근 90분 안의 동네 날씨를 확인할 수 없어요.'};
    if(rule.minTemp!=null){
      if(!Number.isFinite(weather.temperature))return {status:'pending',detail:'바깥 기온 확인 대기'};
      if(weather.temperature<rule.minTemp)return {status:'miss',detail:'현재 '+weather.temperature+'°C · 설정한 '+rule.minTemp+'°C보다 낮아요.'};
      reasons.push('바깥 '+weather.temperature+'°C');
    }
    if(rule.rain){
      if(typeof weather.raining!=='boolean')return {status:'pending',detail:'강수 형태 확인 대기'};
      if(!weather.raining)return {status:'miss',detail:'현재 우리 동네에 비가 오지 않아요.'};
      reasons.push('우리 동네에 비가 와요');
    }
  }
  return {status:'match',detail:reasons.join(' · ')};
}
