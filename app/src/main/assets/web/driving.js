'use strict';
PleorderRealCatalog.ready.then(()=>{
  const $=id=>document.getElementById(id);
  let raw;try{raw=window.Native?Native.loadState():localStorage.getItem('pleorder-v1');}catch{}
  let session=new PleorderDriving.DrivingSession(raw),listening=false,pageActive=true,lastFeedback='Gleo에게 주문이나 배달받을 곳을 말씀해 주세요.';
  const text=(id,value)=>{$(id).textContent=session.text(value);};
  const cash=n=>Number(n||0).toLocaleString('ko-KR')+'원';
  function save(){const s=session.save();try{if(window.Native)Native.saveState(s);else localStorage.setItem('pleorder-v1',s);}catch{}}
  function speak(message){if(window.Native)Native.speak(message);}
  function render(){
    const r=session.repo,d=r.draft,o=r.activeOrder()||r.orders[0],card=r.payments.method(),p=session.policy;
    const theme=r.preferences.ui?.theme;
    document.documentElement.dataset.theme=theme==='dark'||(theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';
    $('policyCover').hidden=!p.blockAll;$('drivingShell').inert=p.blockAll;
    text('headline',listening?'듣고 있어요':d?'주문을 확인해 주세요':o?(o.stage==='completed'?'맛있게 드세요':o.stage==='cancelled'?'주문이 취소됐어요':o.mode==='pickup'?(o.stage==='ready'?'음식이 준비됐어요':'픽업을 준비하고 있어요'):'한 끼가 오고 있어요'):'무엇을 주문할까요?');
    text('micLabel',listening?'듣기 중지':'Gleo로 말하기');text('voiceHint',d?'승인하려면 “결제 승인”':o?'“플레오더 주문 상태 알려 줘”':'“플레오더에서 치킨 배달해 줘”');
    text('feedback',lastFeedback);text('summaryLabel',d?'결제 전 확인':o?'주문 현황':'배달받을 곳');
    text('summaryTitle',d?(r.store(d.storeId)?.name||'선택한 매장'):o?r.status().message:(r.home?.placeName||r.home?.name||'배송지를 먼저 설정해 주세요'));
    text('summarySubtitle',d?d.items.map(i=>`${i.name} ${i.quantity}개`).join(', '):o?`${r.store(o.storeId)?.name} · ${o.mode==='pickup'?'픽업':'배달'}`:(r.home?.description||'Gleo에게 배달받을 곳을 말씀해 주세요.'));
    text('amountLabel',d?'총 결제금액':o?'결제금액':'저장된 카드');
    text('amount',d?cash(d.total):o?cash(o.total):card?`카드 ${card.label}`:'없음');
    text('card',d?`${card?.name||'카드 등록 필요'} · ${card?.last4||''} / ${d.mode==='pickup'?'매장 픽업':d.address?.name||'선택한 배송지'}`:o?`${o.payment?.name||''} · ${o.payment?.last4||''}`:card?`${card.name} · ${card.last4}`:'');
    const remain=o?Math.max(0,Math.ceil(((o.mode==='delivery'?o.deliveryAt:o.readyAt)-r.clock)/60000)):0;
    text('approvalHint',d?'금액과 카드를 확인한 뒤 음성으로 승인해 주세요.':o?(o.stage==='completed'?'맛있게 드세요':o.stage==='cancelled'?'환불 상태는 “현황 듣기”로 확인해 주세요':`${o.mode==='delivery'?'배달 도착':'픽업 준비'}까지 약 ${remain}분`):'주문 내용 확인 후에만 결제합니다.');
    $('driveCancel').hidden=!d;
  }
  function apply(r,voice=true){save();lastFeedback=r.message;render();if(voice)speak(r.voiceText||r.message);return r;}
  function runCommand(value){return apply(session.act(value));}
  $('micIcon').innerHTML=icon('mic');
  $('driveMic').onclick=()=>{if(listening){Native.stopSpeech();}else if(window.Native){Native.startGleo();}else{lastFeedback='음성 입력은 차량 앱에서 이용해 주세요.';render();}};
  $('driveStatus').onclick=()=>runCommand('주문 상태');
  $('driveCancel').onclick=()=>runCommand('주문 취소');
  window.Pleorder={suspend:save,runCommand,async receiveNative(e){
    if(e.type==='visibility'){if(!e.visible)save();pageActive=e.visible;}
    if(e.type==='restriction'){session.setPolicy(e);render();}
    if(e.type==='speech-ready'){listening=true;lastFeedback='말씀해 주세요.';render();}
    if(e.type==='speech-end'){listening=false;render();}
    if(e.type==='speech-error'){listening=false;lastFeedback=e.message;render();}
    if(e.type==='speech-result'){
      if(session.policy.transcription){lastFeedback=e.text;render();}
      if(e.final){listening=false;runCommand(e.text);}
    }
    if(e.type==='external-state'){const policy=session.policy;session=new PleorderDriving.DrivingSession(e.state);session.policy=policy;render();}
    if(e.type==='gleo-action'){const previous=session.repo.orders.length;const r=await PleorderVoice.dispatch(session.repo,e.name,e.params);if(session.repo.orders.length>previous)session.repo.simulation={paused:false,rate:session.repo.simulation?.rate||10,savedWall:Date.now()};apply(r,false);Native.replyAction(JSON.stringify(session.callback(e.name,r)));}
    if(e.type==='vehicle-destination'){session.repo.updateVehicleDestination(e.destination);save();}
    if(e.type==='location'){session.repo.receiveVehicleLocation(e);save();}
  }};
  render();if(window.Native)Native.ready();else{session.setPolicy({requiresDo:true,activeRestrictions:0x50});render();}
  setInterval(()=>{if(!pageActive)return;session.tick();save();render();},1000);
});
