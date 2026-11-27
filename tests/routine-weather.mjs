import assert from 'node:assert/strict';
import {weatherService} from '../weather.mjs';
const clock=()=>Date.parse('2026-11-27T15:07:00Z');
const none=weatherService({clock,key:'',provider:'kma',request:()=>{throw Error('unexpected request')}});
assert.equal((await none('seoul-jongno')).source,'unconfigured');
assert.equal((await none(null)).weather,null);await assert.rejects(()=>none('../test'));
let calls=[];
const request=async url=>{
  calls.push(url);
  const q=url.searchParams, date=q.get('base_date'),time=q.get('base_time');
  const header={resultCode:time==='0000'?'03':'00'};
  const item=[['T1H','28'],['PTY','3']].map(([category,obsrValue])=>({category,obsrValue,baseDate:date,baseTime:time,nx:60,ny:127}));
  return Response.json({response:{header,body:{items:{item}}}});
};
const kma=weatherService({clock,key:'test+key',provider:'kma',request});
const [a,b]=await Promise.all([kma('seoul-jongno'),kma('seoul-jongno')]);
assert.deepEqual(a,b);assert.deepEqual(a.weather,{temperature:28,raining:false,observedAt:'2026-11-27T14:50:00.000Z'});
await kma('seoul-jongno');assert.equal(calls.length,2);assert.equal(calls[1].searchParams.get('base_date'),'20261127');
assert.equal(calls[1].searchParams.get('serviceKey'),'test+key');
assert.deepEqual(calls.map(url=>url.searchParams.get('base_time')),['0000','2350']);
const recent=weatherService({clock:()=>Date.parse('2026-11-27T01:45:00Z'),key:'test',provider:'kma',request});
assert.equal((await recent('seoul-jongno')).weather.observedAt,'2026-11-27T01:40:00.000Z');
const broken=weatherService({clock,key:'test',request:async()=>{throw Error('offline')},provider:'kma'});
assert.equal((await broken('busan-yeonje')).weather,null);
for(const [code,rain] of [[61,true],[73,false],[null,null]]){
 const service=weatherService({clock,provider:'open-meteo',request:async()=>Response.json({current:{time:clock()/1000,temperature_2m:0,weather_code:code}})});
 const result=await service('jeju-si');assert.equal(result.weather.raining,rain);assert.equal(result.weather.temperature,0);
}
console.log('PASS API key absence, concurrent requests, cache, previous day fallback, rain/snow, missing data and provider failure');
