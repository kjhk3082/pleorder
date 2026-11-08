const {test}=require('node:test');
const assert=require('node:assert/strict');
const {OrderRepository,DATA}=require('../app/src/main/assets/web/core.js');
const Catalog=require('../app/src/main/assets/web/catalog.js');

test('manual departure is configurable, persists and does not replace destination',()=>{
  const r=new OrderRepository({now:0}),home={...r.home};
  const origin={name:'테스트 출발지',lat:37.57,lng:126.98,description:'서울시청 근처'};
  assert.equal(r.setSimulationOrigin(origin).status,'success');
  assert.deepEqual(r.home,home);
  const restored=OrderRepository.restore(r.serialize());
  assert.equal(restored.origin.name,origin.name);
  assert.equal(restored.preferences.locationSource,'manual');
});
test('vehicle fixes do not silently override a selected test departure; switching back is explicit',()=>{
  const r=new OrderRepository();r.setSimulationOrigin({name:'출발지',lat:37.57,lng:126.98});
  const fix={lat:37.51,lng:127.04};
  assert.equal(r.receiveVehicleLocation(fix),false);assert.equal(r.liveLocation,null);
  r.useVehicleLocation();assert.deepEqual(r.liveLocation,fix);
});
test('manual departure changes are rejected while a paid order is active',()=>{
  const r=new OrderRepository({now:0});r.prepare({items:[{menuId:'bibimbap',quantity:1}],mode:'pickup'});
  r.confirm(r.draft.id,true);const original={...r.origin};
  assert.equal(r.setSimulationOrigin({lat:37.57,lng:126.98}).status,'fail');
  assert.deepEqual(r.origin,original);
});
test('en-route candidates can be near departure even when the destination is more than 8 km away',()=>{
  const store={id:'start-shop',name:'출발지 식당',lat:37.5,lng:127.04,realPlace:true,delivery:'unknown'};
  const data={realStores:[store],menusForStore:()=>[{id:'m',aliases:['음식']}]};
  const options={realOnly:true,origin:{lat:37.5,lng:127.04},home:{lat:37.6,lng:126.9}};
  assert.equal(Catalog.rank(data,{...options,scope:'home'}).length,0);
  assert.equal(Catalog.rank(data,{...options,scope:'route'}).length,1);
});
test('known no-delivery shops are excluded and nearby duplicate OSM points are merged in results',()=>{
  const first={id:'1',name:'식당',lat:37.5,lng:127.04,realPlace:true,delivery:'yes'};
  const data={realStores:[first,{...first,id:'2',lat:37.50001},{...first,id:'3',name:'포장만',delivery:'no'}],menusForStore:()=>[{id:'m',aliases:['음식']}]};
  const result=Catalog.rank(data,{realOnly:true,fulfillment:'delivery',origin:first,home:first});
  assert.equal(result.length,1);assert.equal(result[0].store.id,'1');
});
test('category filtering precedes page size, so farther matching restaurants remain discoverable',()=>{
  const stores=Array.from({length:40},(_,i)=>({id:String(i),name:'매장'+i,lat:37.5+i*0.0004,lng:127.04,realPlace:true,category:i<35?'카페':'치킨'}));
  const data={realStores:stores,menusForStore:()=>[{id:'m',aliases:['음식']}]};
  const rows=Catalog.rank(data,{realOnly:true,home:stores[0],origin:stores[0],category:'치킨',limit:30});
  assert.equal(rows.length,5);assert.ok(rows.every(r=>r.store.category==='치킨'));
});
test('arrival scheduling cannot fall back to the old trip duration after departure changes',()=>{
  const r=new OrderRepository({now:0});
  r.setSimulationOrigin({lat:37.65,lng:126.85});
  const outcome=r.prepare({items:[{menuId:'bibimbap',quantity:1}],mode:'delivery',timing:'arrival'});
  assert.equal(outcome.status,'asking');assert.equal(r.draft,null);assert.equal(r.orders.length,0);
});
test('changing departure invalidates previously approved draft identity',()=>{
  const r=new OrderRepository({now:0});r.prepare({items:[{menuId:'bibimbap',quantity:1}],mode:'pickup'});
  const old=r.draft.id;r.setSimulationOrigin({lat:37.57,lng:126.98});
  assert.notEqual(r.draft.id,old);assert.equal(r.confirm(old,true).status,'fail');
});
