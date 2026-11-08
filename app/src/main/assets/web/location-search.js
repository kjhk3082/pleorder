(function(root, factory) {
  const api = factory();
  if (typeof module === 'object') module.exports = api;
  else root.PleorderLocation = api;
})(globalThis, () => {
  'use strict';
  const clean = value => String(value || '').trim().replace(/\s+/g, ' ');
  function splitQuery(value) {
    const text = clean(value);
    // Unit/room information belongs to the app, never the map provider.
    const at = text.search(/(?:\d+|[일이삼사오육칠팔구십백천]+)\s*(?:동|호(?:실)?|층)(?=\s|\d|$|[,，])|(?:지하\s*\d*층|로비|프런트|프론트|문\s*앞)/u);
    return { query: clean(at < 0 ? text : text.slice(0, at)).replace(/[,，]$/, ''), detail: at < 0 ? '' : clean(text.slice(at)) };
  }
  function normalize(feature) {
    const p = feature?.properties || {}, point = feature?.geometry?.coordinates;
    if (!point || !Number.isFinite(point[0]) || !Number.isFinite(point[1]) || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90) return null;
    return { name: clean(p.name || p.street || '선택한 장소').slice(0, 80),
      description: [...new Set([p.state, p.city, p.district, p.street, p.housenumber].filter(Boolean))].join(' ').slice(0, 160),
      lat: point[1], lng: point[0], source: 'OpenStreetMap / Photon', kind: p.osm_value, key: p.osm_key };
  }
  function candidates(features, query) {
    const transport = /역|정류장|정거장/.test(query);
    const result = features.map(normalize).filter(p => p && p.description &&
      (transport || !['bus_stop', 'station', 'stop', 'subway_entrance'].includes(p.kind)) &&
      !['bicycle_rental', 'parking', 'parking_entrance', 'vending_machine'].includes(p.kind));
    const score = p => (clean(p.name).replace(/\s/g, '') === clean(query).replace(/\s/g, '') ? 10 : 0) +
      (/호텔/.test(query) && p.kind === 'hotel' ? 8 : 0) + (/구청|시청/.test(query) && p.kind === 'government' ? 8 : 0);
    return result.sort((a,b) => score(b)-score(a)).filter((p,i,a) => !a.slice(0,i).some(x => x.name === p.name && Math.hypot(x.lat-p.lat,x.lng-p.lng)<0.0005)).slice(0, 3);
  }
  function naverCandidates(addresses) {
    return (addresses || []).map(a => {
      const lat=Number(a.y),lng=Number(a.x),description=clean(a.roadAddress || a.jibunAddress);
      const building=(a.addressElements || []).find(e=>e.types?.includes('BUILDING_NAME'))?.longName;
      if (!description || !Number.isFinite(lat) || !Number.isFinite(lng) || lat<33 || lat>39 || lng<124 || lng>132) return null;
      return {lat,lng,name:clean(building || description).slice(0,80),description:description.slice(0,160),source:'NAVER Maps'};
    }).filter(Boolean).slice(0,3);
  }
  function naverReverse(response,lat,lng) {
    const address=response?.v2?.address;
    const description=clean(address?.roadAddress || address?.jibunAddress);
    if(!description)return null;
    const building=(response.v2.results || []).flatMap(r=>[r.land?.addition0,r.land?.addition1,r.land?.addition2]).find(a=>a?.type==='building' && a.value)?.value;
    return {lat,lng,name:clean(building || '선택한 장소'),description,source:'NAVER Maps'};
  }
  async function naverService(method, options) {
    if(globalThis.PleorderMapSdk) await PleorderMapSdk.ready;
    if(globalThis.PleorderMapSdk?.state.provider!=='naver') return null;
    const service=globalThis.naver.maps.Service;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('네이버 주소 검색 응답이 지연되고 있어요.')),3000);
      service[method](options,(status,response)=>{
        clearTimeout(timer);
        status===service.Status.OK ? resolve(response) : reject(Error('네이버 주소 검색을 사용할 수 없어요. API 설정을 확인해 주세요.'));
      });
    });
  }
  async function search(value, initial, fetcher = globalThis.fetch) {
    const { query } = splitQuery(value);
    if (query.length < 2 || query.length > 160) throw Error('장소 이름이나 도로명주소를 알려 주세요.');
    const center = initial && Number.isFinite(initial.lat) && Number.isFinite(initial.lng) ? initial : {lat:37.5665,lng:126.978};
    // Maps Geocoder resolves street addresses; it is not Naver Local keyword search.
    // Never silently substitute a less exact result when a street-address lookup fails.
    if (/(?:로|길)\s*\d|\d+(?:-\d+)?\s*번지/.test(query)) {
      const response=await naverService('geocode',{query,coordinate:`${center.lng},${center.lat}`});
      if(response)return naverCandidates(response.v2?.addresses);
    }
    const response = await fetcher(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=${center.lat}&lon=${center.lng}&countrycode=KR&limit=12&lang=default`, {signal: AbortSignal.timeout(3500)});
    if (!response.ok) throw Error('장소 검색 연결이 원활하지 않아요. 잠시 후 다시 말씀해 주세요.');
    return candidates((await response.json()).features || [], query);
  }
  async function reverse(lat,lng,fetcher=globalThis.fetch) {
    if(globalThis.PleorderMapSdk)await PleorderMapSdk.ready;
    if(globalThis.PleorderMapSdk?.state.provider==='naver') {
      const n=globalThis.naver.maps;
      const response=await naverService('reverseGeocode',{coords:new n.LatLng(lat,lng),orders:[n.Service.OrderType.ROAD_ADDR,n.Service.OrderType.ADDR].join(',')});
      return naverReverse(response,lat,lng);
    }
    const response=await fetcher(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&limit=1&lang=default`,{signal:AbortSignal.timeout(5000)});
    if(!response.ok)throw Error('주소 검색 연결을 확인해 주세요.');
    const first=(await response.json()).features?.[0];return first?normalize(first):null;
  }
  return { clean, splitQuery, normalize, candidates, naverCandidates, naverReverse, search, reverse };
});
