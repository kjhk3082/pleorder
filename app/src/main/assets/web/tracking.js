(function(root,factory){const api=factory(typeof module==='object'?require('./catalog.js'):root.PleorderCatalog);if(typeof module==='object')module.exports=api;else root.PleorderTracking=api;})(globalThis,Catalog=>{
  const transports={motorcycle:{icon:'motorbike',label:'오토바이'},bicycle:{icon:'bike',label:'자전거'},walking:{icon:'footprints',label:'도보'},car:{icon:'car',label:'자동차'}};
  const transport=value=>transports[value] || transports.motorcycle;
  const clamp=n=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
  function bearing(a,b){const rad=Math.PI/180,dl=(b.lng-a.lng)*rad;return (Math.atan2(Math.sin(dl)*Math.cos(b.lat*rad),Math.cos(a.lat*rad)*Math.sin(b.lat*rad)-Math.sin(a.lat*rad)*Math.cos(b.lat*rad)*Math.cos(dl))/rad+360)%360;}
  const paths=new WeakMap();
  function along(route,progress){
    if(!route?.geometry?.coordinates?.length)return null;
    let path=paths.get(route);
    if(!path){const points=route.geometry.coordinates.map(p=>({lat:p[1],lng:p[0]}));let total=0;const lengths=points.slice(1).map((p,i)=>{const d=Catalog.meters(points[i],p);total+=d;return d;});path={points,lengths,total};paths.set(route,path);}
    const {points,lengths,total}=path;let remaining=clamp(progress)*total;
    for(let i=0;i<lengths.length;i++){
      const a=points[i],b=points[i+1],d=lengths[i];
      if(remaining<=d && d>0){const f=remaining/d;return {lat:a.lat+(b.lat-a.lat)*f,lng:a.lng+(b.lng-a.lng)*f,heading:bearing(a,b)};}
      remaining-=d;
    }
    return {...points.at(-1),heading:points.length>1?bearing(points.at(-2),points.at(-1)):0};
  }
  function courier(order,clock,route){
    if(!order || order.mode!=='delivery' || !['delivering','contact_needed'].includes(order.stage))return null;
    const live=order.courier?.source==='live' && order.courier.location;
    if(live && Number.isFinite(live.lat)&&Number.isFinite(live.lng)&&Math.abs(live.lat)<=90&&Math.abs(live.lng)<=180)
      return {position:live,source:'live',transport:transport(order.courier.transport),progress:null};
    if(order.courier?.source==='live')return null;
    const start=order.dispatchAt || order.readyAt,progress=clamp((clock-start)/Math.max(1,order.deliveryAt-start));
    const position=along(route,progress);
    return position?{position,progress,source:'simulation',transport:transport(order.courier?.transport)}:null;
  }
  return {along,bearing,courier,transport,clamp};
});
