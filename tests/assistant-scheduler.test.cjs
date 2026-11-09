const {test}=require('node:test');
const assert=require('node:assert/strict');
const {OrderRepository:R,DATA}=require('../app/src/main/assets/web/core.js');
const A=require('../app/src/main/assets/web/order-assistant.js');
const make=()=>new R({now:1000000});
const draft=(r,id='bibimbap',timing='soon')=>r.prepare({items:[{menuId:id,quantity:1}],mode:'delivery',timing});
const paid=(r,id='bibimbap',timing='soon')=>{draft(r,id,timing);return r.confirm(r.draft.id,true).order;};
test('numbered restaurant/menu/options conversation survives restore and never pays',()=>{
 let r=make();let x=r.foodConversation({query:'비빔밥',fulfillment:'pickup'});assert.equal(x.candidates[0].storeId,'sodam');
 r=R.restore(r.serialize());x=r.foodConversation({selection:1});assert.equal(x.conversation.stage,'menus');
 x=r.foodConversation({selection:1});assert.equal(x.conversation.stage,'options');
 x=r.foodConversation({selection:2});assert.equal(x.draft.items[0].options[0].id,'none');assert.equal(x.draft.mode,'pickup');
 assert.equal(r.orders.length,0);assert.equal(r.payments.transactions.length,0);
});
test('expired and out-of-range choices do not select a store or create a draft',()=>{
 const r=make();r.foodConversation({query:'비빔밥'});r.foodConversation({selection:99});assert.equal(r.draft,null);
 r.conversation.expiresAt=0;r.foodConversation({selection:1});assert.equal(r.draft,null);assert.equal(r.conversation,null);
});
test('negation wins even when a mistaken planner supplies confirmation true',()=>{
 const r=make();draft(r);r.quoteForGleo();r.handleAction('CONFIRM_FOOD_ORDER',{confirmation:true,utterance:'네, 결제하지 마'});
 assert.equal(r.orders.length,0);assert.equal(r.draft,null);assert.equal(r.payments.transactions.length,0);
});
test('multiple Korean quantity items stay in the same store and add correctly',()=>{
 const r=make();const x=r.handleAction('PREPARE_FOOD_ORDER',{query:'한식',fulfillment:'delivery',items:['비빔밥 두 개','불고기 한 개']});
 assert.equal(x.draft.items.length,2);assert.equal(x.draft.total,35900);assert.equal(r.orders.length,0);
 const y=r.handleAction('PREPARE_FOOD_ORDER',{query:'저녁',fulfillment:'delivery',items:['비빔밥','치킨']});assert.equal(y.status,'asking');assert.equal(r.orders.length,0);
});
test('editing quantity invalidates old quote and does not debit the card',()=>{
 const r=make();draft(r);const old=r.draft.id;r.quoteForGleo();r.amendDraft({quantity:2});
 assert.notEqual(r.draft.id,old);assert.equal(r.draft.total,23000);assert.equal(r.confirm(old,true).status,'fail');assert.equal(r.payments.transactions.length,0);
});
test('priced options recompute once and replay without price inflation',()=>{
 const r=make();draft(r,'burger');r.amendDraft({option:'치즈 추가'});assert.equal(r.draft.total,12800);
 const o=r.confirm(r.draft.id,true).order;r.advance(80);assert.equal(o.stage,'completed');
 const x=r.foodConversation({request:'last'});assert.equal(x.draft.items[0].options[0].id,'extra');assert.equal(x.draft.total,12800);
});
test('unknown paid option is rejected and cannot supply its own price',()=>{
 const r=make();const x=r.prepare({items:[{menuId:'burger',quantity:1,options:[{groupId:'cheese',id:'extra',price:-90000}]}]});assert.equal(x.draft.items[0].price,10800);
 const y=r.prepare({items:[{menuId:'burger',quantity:1,options:[{groupId:'cheese',id:'invented'}]}]});assert.equal(y.status,'fail');
});
test('usual uses three actual completed identical orders; seeds do not count',()=>{
 const r=make();assert.equal(r.personalHistory().usual,null);
 for(let i=0;i<3;i++){paid(r);r.advance(80);}
 assert.equal(r.personalHistory().usual.count,3);const x=r.foodConversation({request:'usual'});assert.equal(x.draft.items[0].menuId,'bibimbap');assert.match(x.voiceText,/3번/);assert.equal(r.orders.length,3);
});
test('cancelled orders do not contribute to usual meals',()=>{
 const r=make();for(let i=0;i<3;i++){const o=paid(r);r.cancel(o.id);r.advance(4);}
 assert.equal(r.personalHistory().count,0);
});
test('multi-order targeting avoids cancelling the wrong paid order or another draft',()=>{
 const r=make(),a=paid(r),b=paid(r,'burger');draft(r,'chicken');const d=r.draft.id;
 const ask=r.manageOrder({action:'status'});assert.equal(ask.orders.length,2);
 r.manageOrder({action:'cancel',target:a.id});assert.equal(a.stage,'cancelled');assert.equal(b.stage,'accepted');assert.equal(r.draft.id,d);
 assert.match(r.manageOrder({action:'number',target:b.id}).message,new RegExp(b.id));
});
test('a reservation pays once but is not sent before its send time',()=>{
 const r=make();r.homeMinutes=60;const o=paid(r,'bibimbap','arrival');assert.equal(o.stage,'reserved');assert.equal(o.submittedAt,null);
 r.advance(35);assert.equal(o.stage,'reserved');r.advance(2);assert.equal(o.stage,'accepted');
 r.update();assert.equal(o.events.filter(e=>e.kind==='submitted').length,1);assert.equal(r.payments.transactions.length,1);
});
test('unknown or ambiguous explicit targets never cancel a different order or draft',()=>{
 const r=make(),a=paid(r);draft(r,'burger');const d=r.draft.id;
 r.manageOrder({action:'cancel',target:'없는 가게'});assert.equal(a.stage,'accepted');assert.equal(r.draft.id,d);
 const b=paid(r);r.manageOrder({action:'cancel',target:'소담한상'});
 assert.equal(a.stage,'accepted');assert.equal(b.stage,'accepted');
 assert.ok(r.payments.transactions.every(t=>t.status!=='refund_pending'));
});
test('cancel/start transition gates dispatch immediately, even before re-query completes',()=>{
 const r=make();r.homeMinutes=60;r.updateVehicleDestination({...DATA.home,remainingSeconds:3600,measuredAt:Date.now()});const o=paid(r,'bibimbap','arrival');
 r.observeNavigation({type:'destination-state',status:'changing'});r.advance(60);
 assert.equal(o.stage,'held');assert.equal(o.submittedAt,null);assert.equal(o.events.filter(e=>e.kind==='submitted').length,0);
 r.updateVehicleDestination({...DATA.home,remainingSeconds:60,measuredAt:Date.now()});assert.equal(o.stage,'held');
 r.manageOrder({action:'resume',target:o.id});assert.notEqual(o.stage,'held');assert.equal(r.payments.transactions.length,1);
});
test('changed vehicle destination holds delivery without changing its approved address',()=>{
 const r=make();r.homeMinutes=60;r.updateVehicleDestination({...DATA.home,remainingSeconds:3600});const o=paid(r,'bibimbap','arrival');
 r.updateVehicleDestination({...DATA.origin,remainingSeconds:3000});assert.equal(o.stage,'held');assert.equal(o.address.lat,DATA.home.lat);
 r.advance(90);assert.equal(o.submittedAt,null);r.cancel(o.id);assert.equal(o.payment.status,'refund_pending');
});
test('fresh ETA sample is paired with its own measured time and stale samples cannot rewind',()=>{
 const r=make();r.homeMinutes=90;const now=Date.now();r.updateVehicleDestination({...DATA.home,remainingSeconds:5400,measuredAt:now-60000});const o=paid(r,'bibimbap','arrival');
 r.updateVehicleDestination({...DATA.home,remainingSeconds:3600,measuredAt:now});assert.ok(Math.abs((o.startAt-r.clock)/60000-36)<0.1);
 const start=o.startAt;r.updateVehicleDestination({...DATA.home,remainingSeconds:7200,measuredAt:now-30000});assert.equal(o.startAt,start);
});
test('restoring after a tracking gap holds unsent reservations',()=>{
 const r=make();r.homeMinutes=60;const o=paid(r,'bibimbap','arrival');r.simulation={paused:false,rate:10,savedWall:Date.now()-120000};
 const restored=R.restore(r.serialize());restored.guardTrackingGap();restored.advance(100);assert.equal(restored.orders[0].stage,'held');assert.equal(restored.orders[0].submittedAt,null);
});
test('pickup arrival uses the store route instead of home ETA',()=>{
 const r=make();r.homeMinutes=90;r.routeMetrics={pickups:{sodam:{etaAt:r.clock+40*60000}}};
 r.prepare({items:[{menuId:'bibimbap',quantity:1}],mode:'pickup',timing:'arrival'});const o=r.confirm(r.draft.id,true).order;
 assert.equal((o.startAt-r.clock)/60000,25);assert.equal(o.stage,'reserved');
});
test('held reservation cancels with one refund and never sends later',()=>{
 const r=make();r.homeMinutes=60;const o=paid(r,'bibimbap','arrival');r.holdReservation(o,'경로 변경');r.cancel(o.id);r.advance(100);
 assert.equal(o.stage,'cancelled');assert.equal(o.payment.status,'refunded');assert.equal(o.submittedAt,null);
});
test('quantity parser recognizes Korean units and rejects out of bounds',()=>{
 for(const [s,n] of [['두 잔',2],['세 인분',3],['네 마리',4],['비빔밥',1],['21개',null],['0개',null],['-2개',null],['1.5개',null],['콜라 500ml 한 개',1],['2인 세트 한 개',1]])assert.equal(A.quantity(s),n);
});
test('invalid and stale location samples cannot replace the current destination',()=>{
 const r=make(),now=Date.now();r.updateVehicleDestination({...DATA.home,measuredAt:now});
 r.updateVehicleDestination({...DATA.origin,measuredAt:now-10});assert.equal(r.navigationDestination.lat,DATA.home.lat);
 r.updateVehicleDestination({lat:NaN,lng:127,measuredAt:now+1});assert.equal(r.navigationDestination.lat,DATA.home.lat);
});
test('reserved merchant cancellation and refund timing begin after dispatch, not payment',()=>{
 const r=new R({now:1000000,scenario:'merchant-cancel'});r.homeMinutes=60;const o=paid(r,'bibimbap','arrival');
 r.advance(36);assert.equal(o.stage,'accepted');r.advance(7);assert.equal(o.stage,'cancelled');
 assert.equal(o.events.find(e=>e.kind==='merchant_cancelled').at,r.clock);r.update();assert.equal(o.payment.status,'refund_pending');
 r.advance(3);assert.equal(o.payment.status,'refunded');
});
