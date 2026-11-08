// Server-only Naver REST adapter. Never serves or logs the credential object.
const fs=require('node:fs'),path=require('node:path');
const configPath=path.resolve(__dirname,'../.local/naver-maps.json');
function config(){try{return JSON.parse(fs.readFileSync(configPath,'utf8').replace(/^\uFEFF/,''));}catch{return {};}}
function pointsOf(input){
  if(!Array.isArray(input)||input.length<2||input.length>7)throw Error('출발지·목적지와 최대 5개 경유지를 지정해 주세요.');
  return input.map(p=>{if(!p||typeof p.lat!=='number'||typeof p.lng!=='number'||!Number.isFinite(p.lat)||!Number.isFinite(p.lng)||p.lat<33||p.lat>39||p.lng<124||p.lng>132)throw Error('대한민국 내 위치를 선택해 주세요.');return {lat:+p.lat.toFixed(5),lng:+p.lng.toFixed(5)};});
}
function normalize(data,now=Date.now()){
  const r=data.route?.traoptimal?.[0],s=r?.summary;
  if(data.code!==0||!s||!Number.isFinite(s.distance)||s.distance<0||!Number.isFinite(s.duration)||s.duration<0||!Array.isArray(r.path)||r.path.length<2||r.path.some(p=>!Array.isArray(p)||p.length<2||!Number.isFinite(p[0])||!Number.isFinite(p[1])||p[0]<124||p[0]>132||p[1]<33||p[1]>39))throw Error('자동차 경로를 찾지 못했어요. 도로 가까운 지점을 선택해 주세요.');
  const legs=[];let distance=0,duration=0;
  for(const step of r.guide || []) {distance+=step.distance || 0;duration+=step.duration || 0;if([87,88].includes(step.type)){legs.push({distance,duration:duration/1000});distance=0;duration=0;}}
  if(!legs.length)legs.push({distance:s.distance,duration:s.duration/1000});
  return {distance:s.distance,duration:s.duration/1000,geometry:{type:'LineString',coordinates:r.path},legs,provider:'naver',traffic:true,queriedAt:now,tollFare:s.tollFare || 0};
}
function createDirections({fetcher=fetch,readConfig=config,now=Date.now,maxPerMinute=60}={}){
  const cache=new Map(),pending=new Map();let minute=0,calls=0;
  return async input=>{
    const points=pointsOf(input),key=JSON.stringify(points),cached=cache.get(key),time=now();
    if(cached && time-cached.queriedAt<60000)return cached;
    if(pending.has(key))return pending.get(key);
    const c=readConfig();if(!c.naverClientId||!c.naverClientSecret)throw Error('네이버 경로 서버의 인증 설정이 필요해요.');
    if(Math.floor(time/60000)!==minute){minute=Math.floor(time/60000);calls=0;}
    if(calls>=maxPerMinute)throw Error('경로 요청이 많아요. 잠시 후 다시 시도해 주세요.');
    calls++;
    const job=(async()=>{
      const coords=p=>`${p.lng},${p.lat}`,url=new URL('https://maps.apigw.ntruss.com/map-direction/v1/driving');
      url.searchParams.set('start',coords(points[0]));url.searchParams.set('goal',coords(points.at(-1)));url.searchParams.set('option','traoptimal');
      if(points.length>2)url.searchParams.set('waypoints',points.slice(1,-1).map(coords).join('|'));
      const response=await fetcher(url,{headers:{'x-ncp-apigw-api-key-id':c.naverClientId,'x-ncp-apigw-api-key':c.naverClientSecret},signal:AbortSignal.timeout(8000)});
      if(!response.ok)throw Error(response.status===401||response.status===403?'네이버 Directions 5 인증과 API 선택을 확인해 주세요.':'네이버 경로 서버 응답을 확인하지 못했어요.');
      const route=normalize(await response.json(),now());
      if(cache.size>=300)cache.delete(cache.keys().next().value);cache.set(key,route);return route;
    })();
    pending.set(key,job);try{return await job;}finally{pending.delete(key);}
  };
}
module.exports={config,pointsOf,normalize,createDirections};
