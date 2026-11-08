// Only the public, origin-restricted Maps ID belongs in the client.
window.PleorderMapSdk = (() => {
  const state = { provider: 'osm', reason: '', authenticated: false };
  const listeners = new Set();
  const notify = reason => { state.reason = reason; for (const fn of listeners) fn(reason); };
  const ready = (async () => {
    try {
      const response = await fetch('map-config.json', {signal: AbortSignal.timeout(1500)});
      const config = response.ok ? await response.json() : {};
      const endpoint=config.routeEndpoint || '';
      if(endpoint==='/api/directions' || endpoint==='https://10.0.2.2:4174/api/directions')state.routeEndpoint=endpoint;
      const id = String(config.naverClientId || '');
      if (!/^[a-zA-Z0-9_-]{5,80}$/.test(id)) return state;
      // The SDK uses document.write for submodules during parsing. Dynamic loading
      // must start after DOMContentLoaded so it uses its asynchronous module loader.
      if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
      await new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => finish(Error('네이버 지도 연결이 지연되고 있어요.')), 4500);
        const finish = error => {
          if (settled) return;
          settled = true; clearTimeout(timer);
          error ? reject(error) : resolve();
        };
        window.navermap_authFailure = () => {
          state.authenticated = false;
          notify('네이버 지도 인증을 확인해 주세요. 등록한 Web 서비스 URL과 API 선택을 확인해 주세요.');
          finish(Error(state.reason));
        };
        window.pleorderNaverReady = () => finish();
        const script = document.createElement('script');
        script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(id)}&submodules=geocoder&callback=pleorderNaverReady`;
        script.onerror = () => finish(Error('네이버 지도를 불러오지 못했어요.'));
        document.head.append(script);
      });
      if (!window.naver?.maps?.Map || !window.naver.maps.Service) throw Error('네이버 지도 연결을 확인해 주세요.');
      state.provider = 'naver';
    } catch (error) { notify(error.message || '네이버 지도 연결을 확인해 주세요.'); }
    return state;
  })();
  return {state, ready, onError(fn) {listeners.add(fn); return () => listeners.delete(fn);}};
})();
