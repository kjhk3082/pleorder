// A small rendering adapter; ordering and route simulation stay provider-independent.
window.PleorderMaps = (() => {
  const point = p => Array.isArray(p) ? {lat:p[0],lng:p[1]} : p;
  function create(id, options = {}) {
    const naverMode = PleorderMapSdk.state.provider === 'naver', n = window.naver?.maps;
    const element = typeof id === 'string' ? document.getElementById(id) : id;
    const coord = p => {const v=point(p);return new n.LatLng(v.lat,v.lng);};
    const raw = naverMode
      ? new n.Map(element, {center:coord(options.center),zoom:options.zoom || 16,minZoom:7,maxZoom:19,
          scrollWheel:false,zoomControl:!!options.zoomControl,zoomControlOptions:{position:n.Position.TOP_LEFT},
          logoControl:true,logoControlOptions:{position:n.Position.BOTTOM_LEFT},mapDataControl:true,scaleControl:false})
      : L.map(element,{zoomControl:!!options.zoomControl,scrollWheelZoom:false}).setView(options.center,options.zoom || 16);
    const tiles = naverMode ? null : L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(raw);
    const markers = new Set(), handles = [], lines = [];
    let offline = false, removed = false;
    const on = (type, fn, once=false) => {
      if (naverMode) {
        const cb = e => fn(e?.coord ? {latlng:{lat:e.coord.lat(),lng:e.coord.lng()}} : e);
        handles.push(n.Event[once?'addListenerOnce':'addListener'](raw,type,cb));
      } else raw[once?'once':'on'](type,fn);
    };
    const error = text => options.onStatus?.(text);
    const unsubscribe = PleorderMapSdk.onError(error);
    if (naverMode) on('tilesloaded', () => {
      if (!PleorderMapSdk.state.reason) {PleorderMapSdk.state.authenticated=true; if(!offline)error('');}
    });
    else {tiles.on('tileerror',()=>error('지도를 불러오지 못했어요. 주문 정보는 유지됩니다.'));}
    if (PleorderMapSdk.state.reason) queueMicrotask(() => error(PleorderMapSdk.state.reason + (naverMode?'':' OpenStreetMap으로 표시합니다.')));
    const api = {
      raw, provider:naverMode?'naver':'osm',
      on(type, fn) {on(type,fn);return api;},
      once(type,fn) {on(type,fn,true);return api;},
      setView(pos, zoom, opts={}) {
        if (naverMode) {
          if(opts.animate) raw.morph(coord(pos),Math.round(zoom),{duration:Math.round((opts.duration || .3)*1000)});
          else {raw.setCenter(coord(pos));raw.setZoom(Math.round(zoom),false);}
        } else raw.setView(pos,zoom,opts);
        return api;
      },
      fitBounds(points, opts={}) {
        if(naverMode) raw.fitBounds(points.map(coord),{maxZoom:opts.maxZoom || 17,
          top:opts.paddingTopLeft?.[1] || 30,left:opts.paddingTopLeft?.[0] || 30,
          bottom:opts.paddingBottomRight?.[1] || 30,right:opts.paddingBottomRight?.[0] || 30});
        else raw.fitBounds(L.latLngBounds(points).pad(.24),opts);
      },
      getSize() {const s=raw.getSize();return naverMode?{x:s.width,y:s.height}:s;},
      getCenter() {const c=raw.getCenter();return naverMode?{lat:c.lat(),lng:c.lng()}:c;},
      invalidateSize() {if(!removed)naverMode?raw.autoResize():raw.invalidateSize();},
      stop() {if(naverMode)raw.stop?.();else raw.stop();},
      setOffline(value) {
        if(value===offline)return;
        offline=value; element.classList.toggle('map-offline',value);
        if(!naverMode) {if(value)raw.removeLayer(tiles);else tiles.addTo(raw);}
        error(value?'지도 연결 없음 · 마지막 위치':PleorderMapSdk.state.reason);
      },
      marker(pos, {html,label='',size=[40,40],anchor=[20,20],className='map-marker'}={}) {
        const content=document.createElement('span');content.className=className;
        content.innerHTML=html;content.setAttribute('aria-label',label);content.title=label;
        const item = naverMode
          ? new n.Marker({map:raw,position:coord(pos),title:label,icon:{content,size:new n.Size(...size),anchor:new n.Point(...anchor)}})
          : L.marker(pos,{icon:L.divIcon({className:'',html:content,iconSize:size,iconAnchor:anchor})}).addTo(raw);
        if(!naverMode) {const text=document.createElement('span');text.textContent=label;item.bindTooltip(text,{className:'map-label',direction:'top'});}
        const events = new Map();
        let frame=0,position=point(pos),routeState=null;
        const paint=p=>{position=point(p);naverMode?item.setPosition(coord(position)):item.setLatLng(position);if(Number.isFinite(p.heading))content.style.setProperty('--heading',p.heading+'deg');};
        const animate=(sample,enabled=true)=>{
          cancelAnimationFrame(frame);
          if(!enabled || window.PleorderMotion?.reduced.matches || document.documentElement.dataset.motion==='reduce')return paint(sample(1));
          const start=performance.now();
          const tick=time=>{const f=Math.min(1,(time-start)/900);paint(sample(f));if(f<1)frame=requestAnimationFrame(tick);};
          frame=requestAnimationFrame(tick);
        };
        const marker = {
          setLatLng(p, smooth=false) {
            const target=point(p),from={...position};
            if(target.lat===position.lat&&target.lng===position.lng)return marker;
            animate(f=>({lat:from.lat+(target.lat-from.lat)*f,lng:from.lng+(target.lng-from.lng)*f,
              heading:globalThis.PleorderTracking?.bearing(from,target)}),smooth);return marker;
          },
          setRouteProgress(route,progress) {
            const previous=routeState;routeState={route,progress};
            if(previous?.route===route && previous.progress===progress)return marker;
            const smooth=previous?.route===route && progress>=previous.progress && progress-previous.progress<.2;
            const from=smooth?previous.progress:progress;
            animate(f=>PleorderTracking.along(route,from+(progress-from)*f),smooth);return marker;
          },
          getElement:()=>content,
          on(type,fn) {marker.off(type);if(naverMode)events.set(type,n.Event.addListener(item,type,fn));else item.on(type,fn);return marker;},
          off(type) {if(naverMode){if(events.has(type))n.Event.removeListener(events.get(type));events.delete(type);}else item.off(type);return marker;},
          remove() {cancelAnimationFrame(frame);for(const type of events.keys())marker.off(type);naverMode?item.setMap(null):item.remove();markers.delete(marker);},
        };
        markers.add(marker);return marker;
      },
      removeLayer(marker) {marker.remove();},
      clearRoute() {for(const line of lines)naverMode?line.setMap(null):line.remove();lines.length=0;},
      drawRoute(geometry,color) {
        api.clearRoute();if(!geometry?.coordinates?.length)return;
        if(naverMode) lines.push(new n.Polyline({map:raw,path:geometry.coordinates.map(p=>new n.LatLng(p[1],p[0])),strokeColor:color,strokeWeight:5,strokeOpacity:.85}));
        else lines.push(L.geoJSON(geometry,{style:{className:'delivery-route',color,weight:5,opacity:.85}}).addTo(raw));
      },
      remove() {removed=true;unsubscribe();api.clearRoute();for(const m of [...markers])m.remove();if(naverMode){handles.forEach(h=>n.Event.removeListener(h));raw.destroy();}else raw.remove();},
    };
    element.dataset.provider=api.provider;
    return api;
  }
  return {create};
})();
