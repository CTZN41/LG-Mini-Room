import {seoulClock} from './public/routine-conditions.mjs';
import {places} from './public/routine-places.mjs';

const minute=60_000;
function numeric(raw,low,high){
  if(raw==null || typeof raw==='boolean'|| String(raw).trim()==='')return null;
  const value=Number(raw);
  return Number.isFinite(value)&&value>=low&&value<=high?value:null;
}
async function getJson(url,request){
  const response=await request(url,{signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw Error('upstream unavailable');
  return response.json();
}
async function openMeteo(place,request){
  const url=new URL('https://api.open-meteo.com/v1/forecast');
  url.search=new URLSearchParams({latitude:place.lat,longitude:place.lon,current:'temperature_2m,weather_code',timeformat:'unixtime',timezone:'UTC',forecast_days:'1'});
  const {current}=await getJson(url,request);
  if(!Number.isFinite(current?.time))throw Error('missing time');
  const code=numeric(current.weather_code,0,99);
  const rain=[51,53,55,56,57,61,63,65,66,67,80,81,82];
  const dry=[0,1,2,3,45,48,71,73,75,77,85,86];
  return {observedAt:new Date(current.time*1000).toISOString(),temperature:numeric(current.temperature_2m,-80,65),
    raining:rain.includes(code)?true:dry.includes(code)?false:null};
}
async function kma(place,key,now,request){
  const interval=10*minute;
  const latest=Math.floor(now/interval)*interval;
  // The latest observation may still be publishing, including just after midnight.
  for(const instant of [latest,latest-interval,latest-2*interval]){
    const local=seoulClock(instant),date=local.date.replaceAll('-',''),time=local.time.replace(':','');
    const url=new URL('https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst');
    url.search=new URLSearchParams({serviceKey:key,dataType:'JSON',numOfRows:'20',pageNo:'1',base_date:date,base_time:time,nx:place.nx,ny:place.ny});
    const {response}=await getJson(url,request);
    if(response?.header?.resultCode==='03')continue;
    if(response?.header?.resultCode!=='00')throw Error('observation unavailable');
    const items=response.body?.items?.item;
    if(!Array.isArray(items))continue;
    const observations=items.filter(i=>String(i.baseDate)===date&&String(i.baseTime).padStart(4,'0')===time&&Number(i.nx)===place.nx&&Number(i.ny)===place.ny);
    const value=name=>observations.find(i=>i.category===name)?.obsrValue;
    const temperature=numeric(value('T1H'),-80,65),pty=numeric(value('PTY'),0,7);
    const raining=[1,2,4,5,6].includes(pty)?true:[0,3,7].includes(pty)?false:null;
    if(temperature!==null||raining!==null)return {observedAt:new Date(instant).toISOString(),temperature,raining};
  }
  throw Error('no observation');
}

export function weatherService({key=process.env.MINIROOM_KMA_KEY,provider=process.env.MINIROOM_WEATHER_PROVIDER,request=fetch,clock=Date.now}={}){
  const cache=new Map(),pending=new Map();
  const source=provider==='open-meteo'?'open-meteo':key?'kma':'unconfigured';
  return async function context(placeId){
    const place=places.find(p=>p.id===placeId);
    if(placeId&&!place)throw Error('지원 지역을 선택해 주세요.');
    const now=clock();
    let weather=null;
    if(place && source!=='unconfigured'){
      const cached=cache.get(place.id);
      if(cached&&now<cached.expires)weather=cached.weather;
      else{
        if(!pending.has(place.id)){
          const lookup=source==='kma'?kma(place,key,now,request):openMeteo(place,request);
          pending.set(place.id,lookup.catch(()=>null).then(value=>{
            cache.set(place.id,{weather:value,expires:clock()+(value?5*minute:30_000)});return value;
          }).finally(()=>pending.delete(place.id)));
        }
        weather=await pending.get(place.id);
      }
    }
    return {now:new Date(clock()).toISOString(),placeId:place?.id??null,source,weather};
  };
}
