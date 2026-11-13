/* Continue only an explicit, foreground voice conversation after its spoken reply. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.PleorderVoiceTurn=api;})(globalThis,()=>{
  class Followup {
    constructor(){this.cancel();}
    arm(result, now=Date.now()) {
      this.expiresAt=result?.draft||result?.conversation ? now+45000 : 0;
    }
    cancel(){this.expiresAt=0;}
    consume({active,blocked,listening},now=Date.now()) {
      const allowed=this.expiresAt>now&&active&&!blocked&&!listening;
      this.cancel();return !!allowed;
    }
  }
  return {Followup};
});
