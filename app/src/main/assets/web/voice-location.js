(function(root, factory) {
  const api = factory(typeof module === 'object' ? require('./location-search.js') : root.PleorderLocation);
  if (typeof module === 'object') module.exports = api;
  else root.PleorderVoice = api;
})(globalThis, Location => {
  const actions = ['SEARCH_DELIVERY_DESTINATION', 'CONFIRM_DELIVERY_DESTINATION', 'SET_DELIVERY_ADDRESS_DETAIL'];
  const requests = new WeakMap();
  async function dispatch(repo, name, params = {}, search = Location.search) {
    if (name !== actions[0]) return repo.handleAction(name, params);
    if (!params || typeof params.query !== 'string' || params.query.length > 240) return {status:'asking',message:'배달받을 장소 이름이나 도로명주소를 알려 주세요.'};
    const blocked = repo.addressChangeIssue();
    if (blocked) return blocked;
    const {query, detail} = Location.splitQuery(params.query);
    if (query.length < 2) return {status:'asking',message:'먼저 장소 이름을 알려 주세요. 동·호수는 상세주소로 입력할 수 있어요.'};
    repo.destinationSearch = null;
    const fingerprint = JSON.stringify(repo.home);
    const request = {}; requests.set(repo, request);
    try {
      const saved = repo.savedPlaces.filter(p => [p.name,p.placeName,p.description].some(v => v && Location.clean(v) === query));
      const places = saved.length ? saved.slice(0,3) : await search(query, repo.home || repo.origin);
      if (requests.get(repo) !== request || fingerprint !== JSON.stringify(repo.home)) return {status:'fail',message:'배송지가 변경됐어요. 새 위치를 기준으로 다시 검색해 주세요.'};
      const issue = repo.addressChangeIssue(); if (issue) return issue;
      if (!places.length) return {status:'asking',message:'일치하는 수령 장소를 찾지 못했어요. 지역과 건물명 또는 도로명주소를 다시 알려 주세요.'};
      repo.destinationSearch = {places,detail:detail.slice(0,80),expiresAt:Date.now()+180000,homeFingerprint:fingerprint};
      return {status:'asking',message:places.map((p,i)=>`${i+1}번 ${p.name}, ${p.description}`).join('. ')+'. 배달받을 곳이 맞으면 번호와 함께 선택해 주세요. 아직 배송지를 변경하지 않았어요.',candidates:places.map((p,i)=>({number:i+1,name:p.name,address:p.description}))};
    } catch { return {status:'fail',message:'장소 검색에 연결하지 못했어요. 배송지는 유지했어요. 잠시 후 다시 말씀해 주세요.'}; }
    finally { if(requests.get(repo) === request) requests.delete(repo); }
  }
  return {actions,dispatch};
});
