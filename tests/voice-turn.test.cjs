const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Followup}=require('../app/src/main/assets/web/voice-turn.js');
const {OrderRepository}=require('../app/src/main/assets/web/core.js');
const visible={active:true,blocked:false,listening:false};
test('a spoken quote permits one follow-up but never approves payment itself',()=>{
 const r=new OrderRepository(),turn=new Followup();const reply=r.handleCommand('비빔밥 한 개 배달');
 turn.arm(reply,1000);assert.equal(turn.consume(visible,2000),true);assert.equal(turn.consume(visible,2000),false);
 assert.equal(r.orders.length,0);assert.equal(r.payments.transactions.length,0);
 r.handleCommand('결제 승인');assert.equal(r.orders.length,1);
 turn.arm(r.status(),3000);assert.equal(turn.consume(visible,4000),false);
});
test('cancel, expiry, background and restricted states cannot reopen microphone',()=>{
 const t=new Followup();
 for(const state of [{...visible,active:false},{...visible,blocked:true},{...visible,listening:true}]){
  t.arm({draft:{}},1000);assert.equal(t.consume(state,2000),false);assert.equal(t.consume(visible,2001),false);
 }
 t.arm({conversation:{}},1000);assert.equal(t.consume(visible,46000),false);
 t.arm({draft:{}},1000);t.cancel();assert.equal(t.consume(visible,2000),false);
});
