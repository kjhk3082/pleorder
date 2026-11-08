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
  async function search(value, initial, fetcher = globalThis.fetch) {
    const { query } = splitQuery(value);
    if (query.length < 2 || query.length > 160) throw Error('장소 이름이나 도로명주소를 알려 주세요.');
    const center = initial && Number.isFinite(initial.lat) && Number.isFinite(initial.lng) ? initial : {lat:37.5665,lng:126.978};
    const response = await fetcher(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=${center.lat}&lon=${center.lng}&countrycode=KR&limit=12&lang=default`, {signal: AbortSignal.timeout(3500)});
    if (!response.ok) throw Error('장소 검색 연결이 원활하지 않아요. 잠시 후 다시 말씀해 주세요.');
    return candidates((await response.json()).features || [], query);
  }
  return { clean, splitQuery, normalize, candidates, search };
});
