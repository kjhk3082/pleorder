const {test}=require('node:test');
const assert=require('node:assert/strict');
const {normalize,pointsOf,createDirections}=require('../tools/naver-directions.cjs');
const Tracking=require('../app/src/main/assets/web/tracking.js');
const {OrderRepository}=require('../app/src/main/assets/web/core.js');
const Location=require('../app/src/main/assets/web/location-search.js');
const points=[{lat:37.51,lng:127.04},{lat:37.56,lng:126.98}];
const payload={code:0,route:{traoptimal:[{summary:{distance:1200,duration:180000},path:[[127.04,37.51],[127.04,37.52],[126.98,37.56]],guide:[{type:1,distance:400,duration:60000},{type:87,distance:100,duration:20000},{type:88,distance:700,duration:100000}]}]}};
test('Directions converts milliseconds and splits waypoint legs, rejecting malformed coordinates',()=>{
 const route=normalize(payload,123);assert.equal(route.duration,180);assert.equal(route.queriedAt,123);assert.deepEqual(route.legs,[{distance:500,duration:80},{distance:700,duration:100}]);
 assert.throws(()=>normalize({...payload,route:{traoptimal:[{...payload.route.traoptimal[0],path:[[127,'bad']]}]}}));
 assert.throws(()=>pointsOf([{lat:91,lng:0},points[1]]));assert.throws(()=>pointsOf(Array(8).fill(points[0])));
 assert.deepEqual(pointsOf(points.map(p=>({...p,name:'private',detail:'room'}))),points);
});
test('Directions deduplicates in-flight requests, caches for one minute, bounds rate, and never returns credentials',async()=>{
 let calls=0,clock=100000;const api=createDirections({readConfig:()=>({naverClientId:'id',naverClientSecret:'test-only-secret'}),now:()=>clock,maxPerMinute:1,fetcher:async(url,options)=>{calls++;assert.equal(options.headers['x-ncp-apigw-api-key'],'test-only-secret');assert.equal(url.hostname,'maps.apigw.ntruss.com');return {ok:true,json:async()=>payload};}});
 const results=await Promise.all([api(points),api(points)]);assert.equal(calls,1);assert.equal(results[0],results[1]);assert.doesNotMatch(JSON.stringify(results),/test-only-secret/);
 await api(points);assert.equal(calls,1);await assert.rejects(api([points[0],{lat:37.55,lng:126.98}]),/요청이 많아요/);
 clock+=61000;await api(points);assert.equal(calls,2);
});
test('Directions authorization failure exposes only a safe error, then can retry',async()=>{
 let fail=true;const api=createDirections({readConfig:()=>({naverClientId:'id',naverClientSecret:'secret'}),fetcher:async()=>fail?{ok:false,status:403}:{ok:true,json:async()=>payload}});
 await assert.rejects(api(points),/인증과 API/);fail=false;assert.equal((await api(points)).provider,'naver');
});
test('courier follows route segments for all transport types and disappears at completion',()=>{
 const route={geometry:{coordinates:[[127,37],[127,37.01],[127.01,37.01]]}};
 assert.equal(Tracking.along(route,-1).lat,37);assert.equal(Tracking.along(route,2).lng,127.01);
 const p=Tracking.along(route,.5);assert.ok(p.lng===127||p.lat===37.01,'must stay on the road, not cut diagonally');
 for(const transport of ['motorcycle','bicycle','walking','car']){
  const order={mode:'delivery',stage:'delivering',dispatchAt:100,readyAt:100,deliveryAt:1100,courier:{source:'simulation',transport}};
  assert.equal(Tracking.courier(order,600,route).transport,Tracking.transport(transport));order.stage='completed';assert.equal(Tracking.courier(order,600,route),null);
 }
 const live={mode:'delivery',stage:'delivering',courier:{source:'live',location:{lat:37.5,lng:127}}};assert.equal(Tracking.courier(live,0,null).source,'live');live.courier.location.lat=NaN;assert.equal(Tracking.courier(live,0,route),null);
});
test('DEMO reset clears transactions, drafts and old orders but preserves configured places',()=>{
 const r=new OrderRepository({now:0});r.home={id:'hotel',name:'여행 숙소',lat:37.51,lng:127.04,detail:'999호'};r.preferences.addressDetail='999호';r.orders=[{id:'old'}];r.payments.transactions=[{status:'pending'}];r.draft={id:'draft'};r.pendingLocation={query:'old'};r.payments.methods[0].balance=1;
 const fresh=r.resetDemo();assert.equal(fresh.home.id,'hotel');assert.equal(fresh.preferences.addressDetail,'999호');assert.equal(fresh.origin.lat,r.origin.lat);assert.equal(fresh.orders.length,0);assert.equal(fresh.payments.transactions.length,0);assert.equal(fresh.draft,null);assert.ok(!fresh.pendingLocation);assert.equal(fresh.payments.methods[0].balance,120000);assert.equal(fresh.recentOrders.length,0);assert.equal(fresh.simulation.paused,true);
});
test('Naver address normalization uses building/address labels and discards invalid results',()=>{
 const p=Location.naverCandidates([{x:'127.04',y:'37.51',roadAddress:'서울특별시 강남구 학동로 426',addressElements:[{types:['BUILDING_NAME'],longName:'강남구청'}]},{x:'bad',y:'37.5',roadAddress:'서울'}]);assert.equal(p.length,1);assert.equal(p[0].name,'강남구청');assert.equal(p[0].source,'NAVER Maps');
});
test('real Korean card names change payment selection without approving a charge',()=>{
 const r=new OrderRepository({now:0});r.handleCommand('신한카드로 바꿔줘');assert.equal(r.payments.selected,'limit-card');r.handleCommand('삼성카드로 결제할게');assert.equal(r.payments.selected,'test-pay');r.handleCommand('현대카드로 변경');assert.equal(r.payments.selected,'test-card');assert.equal(r.payments.transactions.length,0);
});
