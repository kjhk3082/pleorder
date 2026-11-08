(function(root,factory){const api=factory(typeof module==='object'?require('./core.js'):root.PleorderCore,typeof module==='object'?require('./ux-policy.js'):root.PleorderUx);if(typeof module==='object')module.exports=api;else root.PleorderDriving=api;})(globalThis,(Core,Ux)=>{
  class DrivingSession {
    constructor(state,now=Date.now()){
      this.repo=state?Core.OrderRepository.restore(state):new Core.OrderRepository();
      this.repo.preferences.catalogMode||='real';
      this.policy=Ux.fromEvent({requiresDo:true,known:false});
      this.lastWall=this.repo.simulation?.savedWall||now;
      this.tick(now);
    }
    tick(now=Date.now()){
      const sim=this.repo.simulation;
      if(sim&&!sim.paused)this.repo.advance(Math.min(1440,Math.max(0,(now-this.lastWall)*(sim.rate||10)/60000)));
      this.lastWall=now;
    }
    save(now=Date.now()){
      this.tick(now);
      this.repo.simulation={paused:this.repo.simulation?.paused??!this.repo.activeOrder(),rate:this.repo.simulation?.rate||10,savedWall:now};
      return this.repo.serialize();
    }
    setPolicy(event){this.policy=Ux.fromEvent(event);}
    act(input,params,now=Date.now()){
      this.tick(now);
      const previous=this.repo.orders.length;
      let r=params===undefined?this.repo.handleCommand(input):this.repo.handleAction(input,params);
      if(r.open){r={status:'asking',message:r.open==='registration'?'카드 등록은 주차 후 설정에서 해 주세요. 저장된 카드로 주문할 수 있어요.':'현재 화면에서는 음성 주문과 현황 확인을 이용할 수 있어요. 장소 선택은 주차 화면에서 해 주세요.'};}
      if(this.repo.orders.length>previous)this.repo.simulation={paused:false,rate:this.repo.simulation?.rate||10,savedWall:now};
      return r;
    }
    callback(name,r){return Core.gleoCallback(name,r);}
    text(value){const s=String(value||'');const max=Math.min(90,this.policy.maxString);return s.length>max?s.slice(0,Math.max(0,max-1))+'…':s;}
  }
  return {DrivingSession};
});
