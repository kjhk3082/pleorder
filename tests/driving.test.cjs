const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {OrderRepository}=require('../app/src/main/assets/web/core.js');
const {DrivingSession}=require('../app/src/main/assets/web/driving-session.js');
function session(){const r=new OrderRepository({now:1000});r.preferences.catalogMode='demo';return new DrivingSession(r.serialize(),1000);}
test('driving surface restores parked draft; explicit voice approval charges only once',()=>{
 const s=session();s.act('비빔밥 한 개 배달',undefined,1000);const id=s.repo.draft.id;
 const restored=new DrivingSession(s.save(1000),1000);
 restored.act('네',undefined,1000);assert.equal(restored.repo.orders.length,0);
 restored.act('결제 승인',undefined,1000);assert.equal(restored.repo.orders.length,1);
 restored.act('CONFIRM_FOOD_ORDER',{draftId:id,confirmation:true},1000);
 assert.equal(restored.repo.payments.transactions.length,1);
 const status=restored.act('주문 상태',undefined,1000);
 assert.match(status.voiceText,/12,500/);assert.match(status.voiceText,/1234/);
});
test('Gleo card change requires a new confirmation, insufficient card declines and alternate succeeds',()=>{
 const s=session();s.act('비빔밥 한 개 배달',undefined,1000);const first=s.repo.draft.id;
 s.act('CONFIRM_FOOD_ORDER',{draftId:first,confirmation:true,paymentMethod:'B'},1000);
 assert.equal(s.repo.orders.length,0);assert.notEqual(s.repo.draft.id,first);
 const declined=s.act('CONFIRM_FOOD_ORDER',{draftId:s.repo.draft.id,confirmation:true},1000);
 assert.equal(declined.status,'fail');assert.equal(s.repo.orders.length,0);
 s.act('CONFIRM_FOOD_ORDER',{draftId:s.repo.draft.id,confirmation:true,paymentMethod:'A'},1000);
 assert.equal(s.repo.orders.length,0);
 s.act('CONFIRM_FOOD_ORDER',{draftId:s.repo.draft.id,confirmation:true},1000);
 assert.equal(s.repo.orders.length,1);
});
test('Gleo explicit rejection clears draft without payment',()=>{
 const s=session();s.act('비빔밥 한 개 배달',undefined,1000);
 s.act('CONFIRM_FOOD_ORDER',{draftId:s.repo.draft.id,confirmation:false},1000);
 assert.equal(s.repo.draft,null);assert.equal(s.repo.payments.transactions.length,0);
});
test('Gleo can approve an app-bound quote without inventing an opaque draft ID',()=>{
 const s=session();
 s.act('PREPARE_FOOD_ORDER',{query:'비빔밥',fulfillment:'delivery'},1000);
 assert.match(s.repo.quoteForGleo().voiceText,/12,500.*1234/);
 const restored=new DrivingSession(s.save(1000),1000);
 restored.act('CONFIRM_FOOD_ORDER',{confirmation:true},1000);
 restored.act('CONFIRM_FOOD_ORDER',{confirmation:true,paymentMethod:'A'},1000);
 assert.equal(restored.repo.orders.length,1);assert.equal(restored.repo.payments.transactions.length,1);
});
test('Gleo never approves an unseen, changed or expired quote on the first request',()=>{
 const s=session();s.act('비빔밥 한 개 배달',undefined,1000);
 assert.equal(s.act('CONFIRM_FOOD_ORDER',{confirmation:true},1000).status,'asking');
 assert.equal(s.repo.orders.length,0);
 s.repo.draft.request='벨 누르지 마세요';
 assert.equal(s.act('CONFIRM_FOOD_ORDER',{confirmation:true},1000).status,'asking');
 assert.equal(s.repo.orders.length,0);
 s.repo.gleoQuote.expiresAt=0;
 assert.equal(s.act('CONFIRM_FOOD_ORDER',{confirmation:true},1000).status,'asking');
 assert.equal(s.repo.orders.length,0);
 s.act('CONFIRM_FOOD_ORDER',{confirmation:true},1000);
 assert.equal(s.repo.orders.length,1);
});
test('Gleo rejects invented IDs and requires fresh approval after changing cards',()=>{
 const s=session();s.act('PREPARE_FOOD_ORDER',{query:'비빔밥',fulfillment:'delivery'},1000);
 assert.equal(s.act('CONFIRM_FOOD_ORDER',{draftId:'invented',confirmation:true},1000).status,'fail');
 s.act('CONFIRM_FOOD_ORDER',{confirmation:true,paymentMethod:'B'},1000);
 assert.equal(s.repo.orders.length,0);
 assert.equal(s.act('CONFIRM_FOOD_ORDER',{confirmation:true},1000).status,'fail');
 s.act('CONFIRM_FOOD_ORDER',{confirmation:false,paymentMethod:'A'},1000);
 assert.ok(s.repo.draft);assert.equal(s.repo.orders.length,0);
 s.act('CONFIRM_FOOD_ORDER',{confirmation:false},1000);
 assert.equal(s.repo.draft,null);assert.equal(s.repo.orders.length,0);
});
test('driving clock and order survive transitions without double elapsed time',()=>{
 const s=session();s.act('비빔밥 한 개 배달',undefined,1000);s.act('결제 승인',undefined,1000);
 const state=s.save(61000),clock=s.repo.clock;
 const restored=new DrivingSession(state,61000);assert.equal(restored.repo.clock,clock);
 restored.tick(121000);assert.equal(restored.repo.clock,clock+600000);
});
test('unknown vehicle policy remains closed; Korean policy allows voice and preserves limits',()=>{
 const s=session();assert.equal(s.policy.blockAll,true);
 s.setPolicy({requiresDo:true,activeRestrictions:0x50});assert.equal(s.policy.blockAll,false);
 assert.equal(s.policy.keyboard,true);assert.equal(s.policy.setup,false);
 s.setPolicy({requiresDo:true,activeRestrictions:4,maxStringLength:12});assert.equal(s.text('1234567890123456').length,12);
});
test('Gleo shipped schema uses supported property types without examples and eight activity entries for conversation, orders and delivery addresses',()=>{
 const schema=JSON.parse(fs.readFileSync('app/src/main/assets/schema.json','utf8'));
 assert.equal(schema.actionCalls.length,8);
 for(const {function:f} of schema.actionCalls){assert.equal(f.component,'activity');for(const p of Object.values(f.parameters.properties)){assert.ok(['string','number','boolean','array'].includes(p.type));assert.doesNotMatch(p.description,/such as|for example/i);}}
});

test('simulated traffic time cannot expire a freshly read Gleo quote',()=>{
 const s=session();
 s.act('PREPARE_FOOD_ORDER',{query:'비빔밥',fulfillment:'delivery'},1000);
 const id=s.repo.draft.id;
 s.repo.advance(15);
 const approved=s.act('CONFIRM_FOOD_ORDER',{draftId:id,confirmation:true},1000);
 assert.equal(approved.status,'success');assert.equal(approved.order.total,12500);
 assert.equal(s.repo.payments.transactions.length,1);
});
test('an explicitly supplied draft ID still requires a new quote after wall-clock expiry',()=>{
 const s=session();
 s.act('PREPARE_FOOD_ORDER',{query:'비빔밥',fulfillment:'delivery'},1000);
 const id=s.repo.draft.id;s.repo.gleoQuote.expiresAt=Date.now()-1;
 assert.equal(s.act('CONFIRM_FOOD_ORDER',{draftId:id,confirmation:true},1000).status,'asking');
 assert.equal(s.repo.payments.transactions.length,0);
});
