const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fromEvent}=require('../app/src/main/assets/web/ux-policy.js');

test('observed Korea emulator 0x50 does not block keyboard, search or the entire app',()=>{
  const p=fromEvent({requiresDo:true,activeRestrictions:0x50,maxStringLength:120,maxContentItems:21});
  assert.equal(p.blockAll,false);assert.equal(p.keyboard,true);assert.equal(p.filtering,true);
  assert.equal(p.setup,false);assert.equal(p.video,false);assert.equal(p.transcription,true);
  assert.equal(p.maxString,Infinity);assert.equal(p.maxItems,Infinity);
});
test('text entry restrictions are independent of the DO requirement and other flags',()=>{
  const p=fromEvent({requiresDo:true,activeRestrictions:0x0a});
  assert.equal(p.keyboard,false);assert.equal(p.filtering,false);assert.equal(p.setup,true);assert.equal(p.blockAll,false);
});
test('parked policy restores controls even when stale mask values are supplied',()=>{
  const p=fromEvent({requiresDo:false,activeRestrictions:511});
  assert.equal(p.blockAll,false);assert.equal(p.keyboard,true);assert.equal(p.setup,true);assert.equal(p.reduceMotion,false);
});
test('content and string limits apply only when their restriction bits are active',()=>{
  const p=fromEvent({requiresDo:true,activeRestrictions:0x24,maxStringLength:60,maxContentItems:10});
  assert.equal(p.maxItems,10);assert.equal(p.maxString,60);assert.equal(p.keyboard,true);
});
test('missing restriction data while DO is required does not silently unlock the UI',()=>{
  assert.equal(fromEvent({requiresDo:true,known:false}).blockAll,true);
  assert.equal(fromEvent({requiresDo:true,activeRestrictions:511}).blockAll,true);
});
