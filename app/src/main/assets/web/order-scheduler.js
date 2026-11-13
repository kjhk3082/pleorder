/* Reservations use immutable order addresses and absolute, timestamped ETA samples.
 * Route uncertainty gates dispatch immediately, including cancel/start reroutes. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.PleorderScheduler=api;})(globalThis,()=>{
  const MINUTE=60000;
  function install(Repository,CATALOG){
    const p=Repository.prototype,oldDestination=p.updateVehicleDestination;
    p.reservationRoute=function(d=this.draft){
      if(!d)return null;
      const nav=this.navigationSample;
      const target=d.mode==='pickup'?this.store(d.storeId):d.address||this.home;
      if(nav&&nav.status==='known'&&nav.measuredAt<=Date.now()&&Date.now()-nav.measuredAt<90000&&CATALOG.meters(nav.destination,target)<300&&Number.isFinite(nav.remainingSeconds))
        return {etaAt:this.clock+Math.max(0,nav.remainingSeconds-(Date.now()-nav.measuredAt)/1000)*1000,source:'vehicle',measuredAt:nav.measuredAt};
      const route=d.mode==='pickup'?this.routeMetrics?.pickups?.[d.storeId]:this.homeRoute();
      if(route&&Number.isFinite(route.etaAt))return route;
      if(!this.needsRouteForArrival())return {etaAt:this.startedAt+this.homeMinutes*MINUTE,source:'demo'};
      return null;
    };
    p.initializeReservation=function(o){
      o.submittedAt=o.startAt<=this.clock?this.clock:null;
      if(o.timing!=='arrival'||o.submittedAt!==null)return;
      o.stage='reserved';
      o.reservation={destination:this.navigationDestination?{...this.navigationDestination}:null,createdWall:Date.now(),lastTickWall:Date.now(),revision:this.navigationSample?.revision||0};
      this.event(o,'reserved','모의 결제 완료 · 도착에 맞춰 매장 전송 대기');
    };
    p.holdReservation=function(o,reason){
      if(!['reserved','held'].includes(o.stage))return;
      o.stage='held';o.holdReason=reason;
      // Multiple route changes are events, unlike one-off payment transitions.
      if(o.events.at(-1)?.message!==reason)o.events.push({kind:'reservation_held',message:reason,at:this.clock});
    };
    p.observeNavigation=function(event){
      if(event.type==='vehicle-destination')return this.updateVehicleDestination(event.destination);
      if(event.type!=='destination-state')return false;
      this.navigationStatus=event.status;
      this.navigationSample={...this.navigationSample,status:event.status,measuredAt:Date.now()};
      for(const o of this.orders)if(o.stage==='reserved'&&o.reservation?.destination)this.holdReservation(o,event.status==='none'?'차량 경로 안내가 종료되었어요.':'차량 목적지와 도착 시간을 다시 확인하고 있어요.');
      return true;
    };
    p.updateVehicleDestination=function(place){
      const measuredAt=Number.isFinite(place?.measuredAt)?place.measuredAt:Date.now();
      if(this.navigationSample?.measuredAt>measuredAt)return false;
      const old=this.navigationDestination;
      const r=oldDestination.call(this,place);
      if(!r||!this.navigationDestination||!place)return r;
      const changed=!!old&&CATALOG.meters(old,place)>300;
      this.navigationSample={destination:{...place},status:'known',measuredAt,remainingSeconds:Number.isFinite(place.remainingSeconds)&&place.remainingSeconds>=0?place.remainingSeconds:null,revision:(this.navigationSample?.revision||0)+(changed?1:0)};
      this.navigationStatus='known';
      for(const o of this.orders){
        if(!['reserved','held'].includes(o.stage))continue;
        if(o.mode==='delivery'&&o.reservation?.destination&&CATALOG.meters(o.reservation.destination,place)>300){this.holdReservation(o,'차량 목적지가 바뀌었어요. 기존 배달 주소를 유지할지 확인해 주세요.');continue;}
        if(o.stage==='reserved')this.refreshReservation(o);
      }
      return r;
    };
    p.refreshReservation=function(o){
      if(o.stage!=='reserved')return;
      const sample=this.reservationRoute(o);if(!sample)return;
      if(sample.measuredAt&&o.reservation?.etaMeasuredAt>=sample.measuredAt)return;
      const s=this.store(o.storeId),prep=s.prep+(o.delayMinutes||0),rider=this.scenario.riderDelay||s.simulation?.riderDelay||0;
      const sendAt=Math.max(this.clock,sample.etaAt-(prep+(o.mode==='delivery'?10+rider:1))*MINUTE);
      const delta=sendAt-o.startAt;
      o.startAt=sendAt;o.readyAt+=delta;o.dispatchAt+=delta;o.deliveryAt+=delta;
      if(o.reservation){
        o.reservation.etaMeasuredAt=sample.measuredAt||sample.queriedAt;
        if(Math.abs(delta)>=2*MINUTE){
          const minutes=Math.round(Math.abs(delta)/MINUTE);
          o.reservation.adjustment={minutes,delayed:delta>0,at:this.clock,sendAt,etaAt:sample.etaAt,source:sample.source||'route'};
          o.events.push({kind:'reservation_retimed',message:`도착 예상이 달라져 매장 전송을 ${minutes}분 ${delta>0?'늦췄어요':'앞당겼어요'}. 추가 결제는 없어요.`,at:this.clock});
        }
      }
    };
    p.reservationSummary=function(o){
      if(o?.stage==='held')return o.holdReason+' 매장 전송은 보류 중이에요.';
      if(o?.stage!=='reserved')return '';
      const minutes=Math.max(0,Math.ceil((o.startAt-this.clock)/MINUTE)),a=o.reservation?.adjustment;
      const change=a?`도착 예상 변경으로 전송을 ${a.minutes}분 ${a.delayed?'늦췄어요':'앞당겼어요'}. `:'';
      return change+`아직 매장에 보내지 않았어요. 약 ${minutes}분 뒤 전송할 예정이며 추가 결제는 없어요.`;
    };
    p.resumeReservation=function(o){
      if(!o||o.stage!=='held')return {status:'asking',message:'재개할 예약이 없어요.'};
      if(o.reservation?.destination&&this.navigationSample?.status!=='known')return {status:'asking',message:'차량 목적지를 아직 확인하지 못했어요. 안내가 다시 연결된 뒤 예약을 재개해 주세요.'};
      if(o.reservation?.destination&&(!this.navigationSample?.measuredAt||Date.now()-this.navigationSample.measuredAt>=90000||this.navigationSample.measuredAt>Date.now()))return {status:'asking',message:'최신 도착 시간을 확인한 뒤 다시 재개해 주세요. 아직 매장에는 보내지 않았어요.'};
      // Explicit resume keeps the already-approved delivery address and amount.
      o.stage='reserved';o.holdReason=null;
      o.reservation.destination=this.navigationDestination?{...this.navigationDestination}:null;
      o.reservation.lastTickWall=Date.now();
      this.refreshReservation(o);
      this.event(o,'resumed','기존 수령 장소와 결제 금액으로 예약을 재개했어요.');
      this.update();
      return {status:'success',message:'기존 수령 장소로 예약을 재개했어요.',order:o,voiceText:this.describe(o)};
    };
    p.guardTrackingGap=function(now=Date.now()){
      const prev=this.simulation?.savedWall;
      if(prev&&!this.simulation.paused&&now-prev>90000){
        for(const o of this.orders)if(o.stage==='reserved')this.holdReservation(o,'앱이 실행되지 않는 동안 예약 전송 시점을 확인하지 못했어요.');
      }
    };
    p.dispatchReservation=function(o){
      if(o.stage==='held')return false;
      if(o.stage!=='reserved')return true;
      if(o.reservation?.destination&&this.navigationSample?.status!=='known'){
        this.holdReservation(o,'차량 경로를 확인하지 못해 전송을 멈췄어요.');return false;
      }
      if(o.reservation?.destination&&(!this.navigationSample?.measuredAt||Date.now()-this.navigationSample.measuredAt>=90000||this.navigationSample.measuredAt>Date.now())){
        this.holdReservation(o,'차량 도착 시간 정보가 오래되어 전송을 보류했어요.');return false;
      }
      if(this.clock<o.startAt)return false;
      if(o.submittedAt!==null&&o.submittedAt!==undefined)return false;
      o.submittedAt=this.clock;o.stage='accepted';
      this.event(o,'submitted','예약 시각에 매장으로 모의 주문을 보냈어요.');return true;
    };
  }
  return {install};
});
