class JourneyMap {
  constructor() {
    this.map = PleorderMaps.create("map", {
      center: [DATA.home.lat, DATA.home.lng], zoom: 16,
      onStatus: text => this.notice(text),
    });
    this.cache = new Map();
    this.pending = new Set();
    this.retryAfter = new Map();
    this.routeTimes = new Map();
    this.recentRoutes = new Map();
    this.markers = new Map();
    this.manualUntil = 0;
    this.map.on("dragstart", () => {this.manualUntil=Date.now()+15000;this.followCurrent=false;});
    this.ready = fetch("routes.json")
      .then((r) => r.json())
      .then((d) => {
        this.fixtures = d.routes;
        this.update(this.repo);
        window.Pleorder?.onRouteUpdate();
      });
    new ResizeObserver(() => this.map.invalidateSize()).observe($("map"));
  }
  notice(text) {
    text=text || PleorderMapSdk.state.reason || '';
    $("mapStatus").textContent = text;
    $("mapStatus").hidden = !text;
  }
  key(points) {
    return points
      .map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`)
      .join(";");
  }
  same(a, b) {
    return (
      a &&
      b &&
      Math.abs(a.lat - b.lat) < 0.00001 &&
      Math.abs(a.lng - b.lng) < 0.00001
    );
  }
  fixture(points, kind) {
    if (!this.fixtures || !this.same(points.at(-1), DATA.home)) return null;
    if (kind === "home" && this.same(points[0], DATA.origin))
      return this.fixtures.home;
    if (kind.startsWith("via-") && this.same(points[0], DATA.origin))
      return this.fixtures[kind];
    if (kind.startsWith("delivery-")) return this.fixtures[kind];
    return null;
  }
  route(points, kind) {
    if (points.some((p) => !p)) return null;
    const endpoint=PleorderMapSdk.state.routeEndpoint;
    const naverRoute=!!endpoint && !kind.startsWith('delivery-');
    const key = (naverRoute?'naver:':'osrm:')+this.key(points);
    if (this.cache.has(key) && (!naverRoute || Date.now()-(this.routeTimes.get(key)||0)<60000)) return this.cache.get(key);
    const recent=this.recentRoutes.get(kind);
    // Live GPS fixes should move markers immediately, not create a paid request each second.
    if(naverRoute && this.repo?.liveLocation && recent && Date.now()-recent.at<30000 && this.same(points.at(-1),recent.destination) && this.key(points.slice(1))===recent.stops)return recent.route;
    const fixture = naverRoute?null:this.fixture(points, kind);
    if (fixture) {
      this.cache.set(key, fixture);
      return fixture;
    }
    if (
      this.pending.has(key) ||
      this.repo?.scenario.offline ||
      Date.now() < (this.retryAfter.get(key) || 0)
    )
      return null;
    this.pending.add(key);
    const url = naverRoute ? endpoint :
      "https://router.project-osrm.org/route/v1/driving/" +
      points.map((p) => `${p.lng},${p.lat}`).join(";") +
      "?overview=full&geometries=geojson&steps=false";
    fetch(url, { signal: AbortSignal.timeout(10000), ...(naverRoute?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({points:points.map(p=>({lat:p.lat,lng:p.lng}))})}:{}) })
      .then(async r => {const d=await r.json();if(!r.ok)throw Error(d.message || '경로 연결을 확인해 주세요.');return d;})
      .then((d) => {
        const route=naverRoute?d.route:d.routes?.[0];
        if (!route || (!naverRoute && d.code!=="Ok")) throw Error("경로를 찾지 못했어요.");
        this.cache.set(key,route);this.routeTimes.set(key,Date.now());
        this.recentRoutes.set(kind,{at:Date.now(),route,destination:points.at(-1),stops:this.key(points.slice(1))});
        this.notice("");
        this.update(this.repo);
        window.Pleorder?.onRouteUpdate();
      })
      .catch(error => {
        this.retryAfter.set(key, Date.now() + 30000);
        this.notice(naverRoute?error.message:"경로를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.");
      })
      .finally(() => this.pending.delete(key));
    return null;
  }
  point(pos, type, label) {
    const courier=type.startsWith("rider-");
    return this.map.marker(pos, {
      html: `<span class="point ${courier ? "rider" : type}">${icon(type === "store" ? "bowl" : courier ? PleorderTracking.transport(type.slice(6)).icon : type === "car" ? "car" : "home", type === "store" ? 17 : 22)}</span>`,
      label, size: type === "store" ? [32,32] : [40,40], anchor: type === "store" ? [16,16] : [20,20],
    });
  }
  mark(id, pos, type, label, routeMotion=false) {
    let marker = this.markers.get(id);
    if(marker && marker.kind!==type){marker.remove();this.markers.delete(id);marker=null;}
    if (!marker) {
      marker = this.point(pos, type, label);
      marker.kind=type;
      if (type.startsWith("rider-"))
        marker.getElement()?.classList.add("rider-tracking");
      this.markers.set(id, marker);
    } else if (!type.startsWith("rider-") && !routeMotion) marker.setLatLng(pos, type === "car");
    return marker;
  }
  keep(ids) {
    for (const [id, m] of this.markers)
      if (!ids.includes(id)) {
        this.map.removeLayer(m);
        this.markers.delete(id);
      }
  }
  origin() {
    return this.repo?.liveLocation || this.repo?.origin || DATA.origin;
  }
  storeDistance(id, scope) {
    if (
      scope !== "home" ||
      !this.same(this.repo?.home, DATA.home) ||
      !this.fixtures?.["delivery-" + id]
    )
      return "";
    return (
      (this.fixtures["delivery-" + id].distance / 1000).toFixed(1) + "km · 도로"
    );
  }
  summary(id, destination = this.repo?.home) {
    if (!destination) return { extraMeters: null, extraMinutes: null };
    const store = this.repo.store(id),
      home = this.route([this.origin(), destination], "home"),
      via = this.route([this.origin(), store, destination], "via-" + id);
    return PleorderCatalog.routeFacts(home, via);
  }
  update(repo) {
    if (!repo) return;
    this.repo = repo;
    this.map.setOffline(!!repo.scenario.offline);
    const home = repo.home,
      origin = this.origin(),
      o = repo.activeOrder() || repo.orders[0],
      active = o && !["cancelled", "completed"].includes(o.stage) ? o : null,
      keep = [];
    if (!home) {
      this.notice("배송지를 선택해 주세요.");
      return;
    }
    const homeRoute = this.route([origin, home], "home");
    if (homeRoute) {
      const key = this.key([origin, home]);
      if (repo.routeMetrics?.home?.key !== key || repo.liveLocation || repo.routeMetrics?.home?.provider !== (homeRoute.provider || 'osrm') || repo.routeMetrics?.home?.queriedAt !== homeRoute.queriedAt) {
        repo.routeMetrics = {
          home: {
            key,
            distance: homeRoute.distance,
            duration: homeRoute.duration,
            provider:homeRoute.provider || 'osrm',
            traffic:homeRoute.traffic === true,
            queriedAt:homeRoute.queriedAt,
            at: repo.clock,
            etaAt: repo.clock + homeRoute.duration * 1000,
          },
        };
      }
    }
    keep.push("home");
    this.mark("home", [home.lat, home.lng], "home", home.name || "배송지");
    let line = null,
      focusPoints = [];
    let courierFrame=null, pickupPosition=null;
    if (active?.mode === "delivery") {
      const store = repo.store(active.storeId),
        r = this.route([store, home], "delivery-" + store.id);
      line = r;
      courierFrame=PleorderTracking.courier(active,repo.clock,r);
      if (courierFrame) {
        const p=courierFrame.position,pos=[p.lat,p.lng];
        keep.push("rider");
        const marker=this.mark("rider",pos,"rider-"+(active.courier?.transport || "motorcycle"),"배달기사님 · "+courierFrame.transport.label);
        if(courierFrame.source==='simulation')marker.setRouteProgress(r,courierFrame.progress);
        else marker.setLatLng(pos,true);
        focusPoints=[pos,[home.lat,home.lng]];
      } else {
        keep.push(store.id);
        this.mark(store.id, [store.lat, store.lng], "store", store.name);
        focusPoints = [
          [store.lat, store.lng],
          [home.lat, home.lng],
        ];
      }
    } else if (active?.mode === "pickup" || this.selectedStore) {
      const store = repo.store(active?.storeId || this.selectedStore);
      line = this.route([origin, store, home], "via-" + store.id);
      keep.push(store.id, "car");
      this.mark(store.id, [store.lat, store.lng], "store", store.name);
      const progress = Math.max(
        0,
        Math.min(1, (repo.clock - repo.startedAt) / (repo.homeMinutes * 60000)),
      );
      // The vehicle stops at the pickup store until receipt is confirmed.
      const pickupLeg =
        active?.mode === "pickup" ? this.pickupLeg(line, store) : line;
      const pos = repo.liveLocation
        ? [origin.lat, origin.lng]
        : this.interpolate(
            pickupLeg || homeRoute,
            active?.mode === "pickup"
              ? Math.min(
                  1,
                  (repo.clock - active.createdAt) /
                    Math.max(60000, (pickupLeg?.duration || 600) * 1000),
                )
              : progress,
          ) || [origin.lat, origin.lng];
      this.mark("car", pos, "car", "현 위치");
      pickupPosition={lat:pos[0],lng:pos[1]};
      focusPoints = [[store.lat, store.lng], pos];
    } else {
      const scope = repo.preferences.scope || "home",
        center = scope === "nearby" ? origin : home;
      for (const rec of repo.recommend("", scope).slice(0, 5)) {
        keep.push(rec.store.id);
        this.mark(
          rec.store.id,
          [rec.store.lat, rec.store.lng],
          "store",
          rec.store.name,
        )
          .off("click")
          .on("click", () => window.Pleorder.openStore(rec.menu.id));
      }
      if (scope === "nearby" || this.showCurrent) {
        keep.push("car");
        this.mark("car", [origin.lat, origin.lng], "car", "현 위치");
      }
      focusPoints = [[center.lat, center.lng]];
      if (o?.stage === "completed") focusPoints = [[home.lat, home.lng]];
    }
    let carPosition=repo.liveLocation || pickupPosition || origin;
    if(!repo.liveLocation && homeRoute && (active?.mode==='delivery' || (o?.mode==='delivery' && o.stage==='completed'))){
      carPosition=PleorderTracking.along(homeRoute,(repo.clock-repo.startedAt)/Math.max(60000,repo.homeMinutes*60000)) || origin;
    }
    if(!keep.includes('car')) {
      keep.push('car');
      const marker=this.mark('car',[carPosition.lat,carPosition.lng],'car',repo.liveLocation?'내 차량 · 차량 위치':'내 차량 · 이동 시뮬레이션',!repo.liveLocation && !!homeRoute && o?.mode==='delivery');
      if(!repo.liveLocation && homeRoute && o?.mode==='delivery')marker.setRouteProgress(homeRoute,PleorderTracking.clamp((repo.clock-repo.startedAt)/Math.max(60000,repo.homeMinutes*60000)));
    }
    this.carPosition=carPosition;
    const motion=$('motionStatus');
    motion.hidden=false;
    motion.textContent=(repo.liveLocation?'차량 위치 연동':'차량 이동 시뮬레이션')+(courierFrame?' · '+courierFrame.transport.label+' 배달 '+(courierFrame.source==='simulation'?'시뮬레이션':'위치 연동'):'');
    if(this.followCurrent){this.map.setView([carPosition.lat,carPosition.lng],17,{animate:false});this.manualUntil=Date.now()+2000;}
    this.keep(keep);
    const lineKey = line?.geometry ? JSON.stringify(line.geometry.coordinates) : "";
    if (this.lineKey !== lineKey) {
      this.lineKey = lineKey;
      this.map.drawRoute(line?.geometry, active?.mode === "delivery" ? "#258e87" : "#00365b");
    }

    const stateKey =
      (active?.id || "idle") +
      ":" +
      (active?.stage || "") +
      ":" +
      (repo.preferences.scope || "home") +
      ":" +
      (this.selectedStore || "") +
      ":" +
      this.key([home]);
    const followKey =
      stateKey +
      (active?.stage === "delivering" ? Math.floor(Date.now() / 6000) : "");
    if (this.stateKey !== followKey && Date.now() > this.manualUntil) {
      this.stateKey = followKey;
      this.focus(focusPoints);
    }
  }
  focus(points) {
    if (!points.length) return;
    if (points.length === 1)
      this.map.setView(points[0], 16, { animate: false });
    else {
      this.map.fitBounds(points, {
        maxZoom: 17,
        paddingTopLeft: [22, 205],
        paddingBottomRight: [
          22,
          Math.min(
            $("orderPanel").offsetHeight + 45,
            this.map.getSize().y * 0.47,
          ),
        ],
        animate: false,
      });
    }
  }
  focusHome() {
    this.followCurrent=false;
    if (this.repo?.home) {
      this.manualUntil = Date.now() + 8000;
      this.map.setView([this.repo.home.lat, this.repo.home.lng], 16.5, {
        animate: !PleorderMotion.reduced.matches,
        duration: 0.3,
      });
    }
  }
  focusCurrent() {
    const p = this.repo?.liveLocation || this.carPosition || this.origin();
    this.followCurrent = true;
    this.showCurrent = true;
    this.mark("car", [p.lat, p.lng], "car", "현 위치");
    this.manualUntil = Date.now() + 8000;
    this.map.setView([p.lat, p.lng], 16.5, {
      animate: !PleorderMotion.reduced.matches,
      duration: 0.3,
    });
  }
  selectStore(id) {
    this.selectedStore = id;
    this.stateKey = null;
    this.update(this.repo);
  }
  clearSelection() {
    if (this.selectedStore) {
      this.selectedStore = null;
      this.stateKey = null;
      this.update(this.repo);
    }
  }
  pickLocation(callback) {
    this.notice("배달받을 위치를 지도에서 선택해 주세요.");
    this.map.once("click", (e) => {
      this.notice("");
      callback(e.latlng.lat, e.latlng.lng);
    });
  }
  pickupLeg(route, store) {
    const coordinates = route?.geometry?.coordinates;
    if (!coordinates?.length) return null;
    let nearest = 0,
      distance = Infinity;
    for (let i = 0; i < coordinates.length; i++) {
      const d = PleorderCatalog.meters({lat:coordinates[i][1],lng:coordinates[i][0]}, store);
      if (d < distance) {
        nearest = i;
        distance = d;
      }
    }
    const leg = coordinates.slice(0, Math.max(2, nearest + 1));
    let length = 0;
    for (let i = 1; i < leg.length; i++)
      length += PleorderCatalog.meters({lat:leg[i-1][1],lng:leg[i-1][0]}, {lat:leg[i][1],lng:leg[i][0]});
    return {
      geometry: { type: "LineString", coordinates: leg },
      distance: length,
      duration: Math.max(
        60,
        (route.duration * length) / Math.max(1, route.distance),
      ),
    };
  }
  interpolate(route, progress) {
    const p=PleorderTracking.along(route,progress);
    return p?[p.lat,p.lng]:null;
  }
  reset() {
    this.keep([]);this.map.clearRoute();this.lineKey='';this.stateKey=null;
    this.followCurrent=false;this.showCurrent=false;this.selectedStore=null;this.carPosition=null;this.manualUntil=0;
  }
}
