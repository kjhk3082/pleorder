const {test}=require('node:test');
const assert=require('node:assert/strict');
const {OrderRepository,gleoCallback}=require('../app/src/main/assets/web/core.js');
const Voice=require('../app/src/main/assets/web/voice-location.js');
const Location=require('../app/src/main/assets/web/location-search.js');
const place={name:'테스트 숙소',description:'서울특별시 테스트로 100',lat:37.51,lng:127.09};
const search='SEARCH_DELIVERY_DESTINATION',confirm='CONFIRM_DELIVERY_DESTINATION',detail='SET_DELIVERY_ADDRESS_DETAIL';
const find=async()=>[{...place}];

test('spoken room numbers are formatted without guessing ambiguous place words',()=>{
 assert.equal(Location.normalizeDetail('구백구십구 동 구천구백구십구 호'),'999동 9999호');
 assert.equal(Location.normalizeDetail('일공일 동 이공이 호'),'101동 202호');
 assert.equal(Location.normalizeDetail('101 동 202 호실'),'101동 202호실');
 assert.equal(Location.normalizeDetail('삼 층 로비에서 받아요'),'3층 로비에서 받아요');
 assert.equal(Location.normalizeDetail('신관 로비, 안내 데스크'),'신관 로비, 안내 데스크');
 assert.equal(Location.normalizeDetail('일동빌딩 로비'),'일동빌딩 로비');
});
test('spoken place is not saved until confirmed; room digits survive restart',async()=>{
 let r=new OrderRepository();const original=r.home;
 const result=await Voice.dispatch(r,search,{query:'테스트 숙소 101동 202호'},find);
 assert.equal(result.status,'asking');assert.deepEqual(r.home,original);assert.equal(r.destinationSearch.detail,'101동 202호');
 r=OrderRepository.restore(r.serialize());
 assert.equal((await Voice.dispatch(r,confirm,{confirmation:true})).status,'success');
 assert.equal(r.home.name,place.name);assert.equal(r.preferences.addressDetail,'101동 202호');
 assert.equal((await Voice.dispatch(r,detail,{detail:'102동 1002호'})).status,'asking');
 assert.equal(r.home.detail,'101동 202호');
 await Voice.dispatch(r,detail,{confirmation:true});
 assert.equal(r.home.detail,'102동 1002호');assert.equal(r.savedPlaces.find(p=>p.id===r.home.id).detail,'102동 1002호');
});
test('room details never leave in a map query',async()=>{
 for(const input of ['테스트 숙소 101동 202호','테스트 숙소 101동202호','테스트 숙소 202호','테스트 숙소 3층 로비','테스트 숙소 이백이호']) {
  let url;await Location.search(input,place,async u=>{url=u;return {ok:true,json:async()=>({features:[]})}});
  assert.equal(new URL(url).searchParams.get('q'),'테스트 숙소');
 }
 assert.equal(Location.splitQuery('서울 연희로32길 48').query,'서울 연희로32길 48');
});
test('selection rejects ambiguity, arbitrary indexes and expired results',async()=>{
 const r=new OrderRepository();await Voice.dispatch(r,search,{query:'테스트 숙소'},async()=>[place,{...place,name:'다른 숙소'}]);
 const original=JSON.stringify(r.home);
 for(const selection of [undefined,0,4,1.5,'1']) assert.equal((await Voice.dispatch(r,confirm,{confirmation:true,selection})).status,'asking');
 assert.equal(JSON.stringify(r.home),original);r.destinationSearch.expiresAt=0;
 assert.equal((await Voice.dispatch(r,confirm,{confirmation:true,selection:1})).status,'asking');assert.equal(JSON.stringify(r.home),original);
});
test('detail for pending destination never overwrites previous destination',async()=>{
 const r=new OrderRepository();const previous=JSON.stringify(r.home);
 await Voice.dispatch(r,search,{query:'테스트 숙소'},find);await Voice.dispatch(r,detail,{detail:'5층 로비'});
 assert.equal(JSON.stringify(r.home),previous);
 await Voice.dispatch(r,confirm,{confirmation:true});assert.equal(r.home.detail,'5층 로비');
});
test('rejecting location preserves old address and does not place an order',async()=>{
 const r=new OrderRepository();const previous=JSON.stringify(r.home);
 await Voice.dispatch(r,search,{query:'테스트 숙소'},find);await Voice.dispatch(r,confirm,{confirmation:false});
 assert.equal(r.destinationSearch,null);assert.equal(JSON.stringify(r.home),previous);assert.equal(r.orders.length,0);
});
test('active orders and pending payments block both speech address actions',async()=>{
 for(const pending of [false,true]){
 const r=new OrderRepository();r.prepare({items:[{menuId:'bibimbap',quantity:1}],mode:'delivery'});r.confirm(r.draft.id,true);
 if(pending){r.orders[0].stage='completed';r.payments.transactions[0].status='pending';}
 const previous=JSON.stringify(r.home);
 assert.equal((await Voice.dispatch(r,search,{query:'테스트 숙소'},find)).status,'fail');
 assert.equal((await Voice.dispatch(r,detail,{detail:'3층'})).status,'fail');assert.equal(JSON.stringify(r.home),previous);
 }});
test('network failure, empty results, and stale asynchronous results do not change destination',async()=>{
 const r=new OrderRepository();let resolve;
 const pending=Voice.dispatch(r,search,{query:'테스트 숙소'},()=>new Promise(r=>resolve=r));
 r.setDeliveryPlace({...place,name:'새 장소',id:'new'});resolve([place]);
 assert.equal((await pending).status,'fail');assert.equal(r.destinationSearch,null);
 assert.equal((await Voice.dispatch(r,search,{query:'검색 실패'},async()=>{throw Error()})).status,'fail');
 assert.equal((await Voice.dispatch(r,search,{query:'검색 없음'},async()=>[])).status,'asking');
 assert.equal(r.home.name,'새 장소');
});
test('a saved place can be selected offline without transmitting its address',async()=>{
 const r=new OrderRepository();const result=await Voice.dispatch(r,search,{query:'우리 집'},()=>{throw Error('must not fetch')});
 assert.equal(result.status,'asking');
});
test('address changes invalidate voice approval and preserve pickup/timing/options',()=>{
 const r=new OrderRepository();r.prepare({items:[{menuId:'bibimbap',quantity:1}],mode:'pickup',timing:'soon',handoff:'hand',request:'수저 빼 주세요'});r.quoteForGleo();
 const id=r.draft.id;r.setDeliveryDetail('101동 202호');
 assert.notEqual(r.draft.id,id);assert.equal(r.draft.mode,'pickup');assert.equal(r.draft.handoff,'hand');assert.equal(r.draft.request,'수저 빼 주세요');
 assert.equal(r.handleAction('CONFIRM_FOOD_ORDER',{confirmation:true}).status,'asking');assert.equal(r.orders.length,0);
});
test('irrelevant transport and bicycle matches are not presented as hotels or offices',()=>{
 const feature=(name,key,value)=>({properties:{name,osm_key:key,osm_value:value,city:'서울',street:'학동로'},geometry:{coordinates:[127,37]}});
 const matches=Location.candidates([feature('강남구청','railway','station'),feature('강남구청','amenity','bicycle_rental'),feature('강남구청','office','government')],'강남구청');
 assert.equal(matches.length,1);assert.equal(matches[0].kind,'government');
 assert.equal(Location.candidates([feature('강남구청','railway','station')],'강남구청역').length,1);
});
test('location callback asks for address, not payment, and omits coordinates',()=>{
 const r=gleoCallback(confirm,{status:'success',message:'주소 저장',location:place});
 assert.doesNotMatch(r.message,/payment method/);assert.equal(JSON.parse(r.data)[0].location.lat,undefined);
});

test('expired pending destination cannot redirect a room edit to the previous home',async()=>{
 const r=new OrderRepository();const before=JSON.stringify(r.home);
 await Voice.dispatch(r,search,{query:'테스트 숙소'},find);r.destinationSearch.expiresAt=0;
 assert.equal((await Voice.dispatch(r,detail,{detail:'9층'})).status,'asking');assert.equal(JSON.stringify(r.home),before);
});

test('explicitly clearing a detail preserves the selected place',async()=>{
 const r=new OrderRepository();r.setDeliveryDetail('101동 202호');const name=r.home.name;
 assert.equal((await Voice.dispatch(r,detail,{detail:'',clear:true})).status,'asking');
 assert.equal(r.home.detail,'101동 202호');
 assert.equal((await Voice.dispatch(r,detail,{confirmation:true})).status,'success');
 assert.equal(r.home.detail,'');assert.equal(r.home.name,name);assert.equal(r.preferences.addressDetail,'');
});

test('misheard room digits can be corrected after readback and survive a restart before confirmation',async()=>{
 let r=new OrderRepository();r.setDeliveryDetail('9층');
 const wrong=await Voice.dispatch(r,detail,{detail:'101동 201호',confirmation:true});
 assert.match(wrong.message,/201호/);assert.equal(r.home.detail,'9층');
 const corrected=await Voice.dispatch(r,detail,{detail:'일공일 동 이공이 호',confirmation:true});
 assert.match(corrected.message,/101동 202호/);assert.equal(r.home.detail,'9층');
 r=OrderRepository.restore(r.serialize());
 const empty=await Voice.dispatch(r,detail,{detail:''});
 assert.match(empty.message,/101동 202호/);assert.equal(r.home.detail,'9층');
 assert.equal((await Voice.dispatch(r,confirm,{selection:1,confirmation:true})).status,'success');
 assert.equal(r.home.detail,'101동 202호');assert.equal(r.orders.length,0);
});

test('a rejected, expired or different-location room proposal cannot overwrite a saved unit',async()=>{
 const r=new OrderRepository();r.setDeliveryDetail('3층');
 await Voice.dispatch(r,detail,{detail:'7층'});await Voice.dispatch(r,detail,{confirmation:false});
 assert.equal((await Voice.dispatch(r,detail,{confirmation:true})).status,'asking');
 await Voice.dispatch(r,detail,{detail:'9층'});r.spokenDetail.expiresAt=0;
 assert.equal((await Voice.dispatch(r,detail,{confirmation:true})).status,'asking');assert.equal(r.home.detail,'3층');
 await Voice.dispatch(r,detail,{detail:'2층'});r.setDeliveryPlace({...place, id:'different', detail:'1층'});
 await Voice.dispatch(r,detail,{confirmation:true});assert.equal(r.home.detail,'1층');
});

test('Gleo confirmation with an empty optional detail saves the proposed digits and never clears by omission',async()=>{
 const r=new OrderRepository();r.setDeliveryDetail('2층');
 await Voice.dispatch(r,detail,{detail:'101동 202호'});
 const yes=await Voice.dispatch(r,detail,{detail:'',confirmation:true});
 assert.equal(yes.status,'success');assert.equal(r.home.detail,'101동 202호');
 assert.equal((await Voice.dispatch(r,detail,{detail:''})).status,'asking');
 assert.equal(r.home.detail,'101동 202호');
});
