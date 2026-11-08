class JourneyMap {
  constructor() {
    this.map = L.map("map", {
      zoomControl: false,
      scrollWheelZoom: false,
      attributionControl: true,
    }).setView([DATA.home.lat, DATA.home.lng], 16);
    this.tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(this.map);
    this.cache = new Map();
    this.pending = new Set();
    this.retryAfter = new Map();
    this.markers = new Map();
    this.routeLayer = L.layerGroup().addTo(this.map);
    this.manualUntil = 0;
    this.map.on("dragstart", () => (this.manualUntil = Date.now() + 15000));
    this.tiles.on("tileerror", () =>
      this.notice("지도를 불러오지 못했어요. 주문 정보는 유지됩니다."),
    );
    this.tiles.on("load", () => this.notice(""));
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
    const key = this.key(points);
    if (this.cache.has(key)) return this.cache.get(key);
    const fixture = this.fixture(points, kind);
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
    const url =
      "https://router.project-osrm.org/route/v1/driving/" +
      points.map((p) => `${p.lng},${p.lat}`).join(";") +
      "?overview=full&geometries=geojson&steps=false";
    fetch(url, { signal: AbortSignal.timeout(10000) })
      .then((r) => r.json())
      .then((d) => {
        if (d.code !== "Ok" || !d.routes?.[0]) throw Error("No route");
        this.cache.set(key, d.routes[0]);
        this.notice("");
        this.update(this.repo);
        window.Pleorder?.onRouteUpdate();
      })
      .catch(() => {
        this.retryAfter.set(key, Date.now() + 30000);
        this.notice("경로를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.");
      })
      .finally(() => this.pending.delete(key));
    return null;
  }
  point(pos, type, label) {
    return L.marker(pos, {
      icon: L.divIcon({
        className: "map-marker",
        html: `<span class="point ${type}">${type === "store" ? icon("bowl", 17) : icon(type === "rider" ? "bike" : type === "car" ? "car" : "home", type === "store" ? 17 : 22)}</span>`,
        iconSize: type === "store" ? [32, 32] : [40, 40],
        iconAnchor: type === "store" ? [16, 16] : [20, 20],
      }),
    }).bindTooltip(label, { className: "map-label", direction: "top" });
  }
  mark(id, pos, type, label) {
    let marker = this.markers.get(id);
    if (!marker) {
      marker = this.point(pos, type, label).addTo(this.map);
      if (type === "rider")
        marker.getElement()?.classList.add("rider-tracking");
      this.markers.set(id, marker);
    } else marker.setLatLng(pos);
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
    if (repo.scenario.offline) {
      if (this.map.hasLayer(this.tiles)) this.map.removeLayer(this.tiles);
      this.notice("지도 연결 없음 · 저장된 경로");
    } else if (!this.map.hasLayer(this.tiles)) this.tiles.addTo(this.map);
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
      if (repo.routeMetrics?.home?.key !== key || repo.liveLocation) {
        repo.routeMetrics = {
          home: {
            key,
            distance: homeRoute.distance,
            duration: homeRoute.duration,
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
    if (active?.mode === "delivery") {
      const store = repo.store(active.storeId),
        r = this.route([store, home], "delivery-" + store.id);
      line = r;
      if (["delivering", "contact_needed"].includes(active.stage) && r) {
        const p =
            (repo.clock - (active.dispatchAt || active.readyAt)) /
            (active.deliveryAt - (active.dispatchAt || active.readyAt)),
          pos = this.interpolate(r, p);
        keep.push("rider");
        this.mark("rider", pos, "rider", "배달기사님");
        focusPoints = [pos, [home.lat, home.lng]];
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
    this.keep(keep);
    const lineKey = line?.geometry
      ? JSON.stringify(line.geometry.coordinates[0]) +
        line.geometry.coordinates.length
      : "";
    if (this.lineKey !== lineKey) {
      this.lineKey = lineKey;
      this.routeLayer.clearLayers();
      if (line)
        L.geoJSON(line.geometry, {
          style: {
            className: "delivery-route",
            color: active?.mode === "delivery" ? "#258e87" : "#00365b",
            weight: 5,
            opacity: 0.85,
          },
        }).addTo(this.routeLayer);
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
      this.map.fitBounds(L.latLngBounds(points).pad(0.24), {
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
    if (this.repo?.home) {
      this.manualUntil = Date.now() + 8000;
      this.map.setView([this.repo.home.lat, this.repo.home.lng], 16.5, {
        animate: !PleorderMotion.reduced.matches,
        duration: 0.3,
      });
    }
  }
  focusCurrent() {
    const p = this.origin();
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
      const d = L.latLng(coordinates[i][1], coordinates[i][0]).distanceTo([
        store.lat,
        store.lng,
      ]);
      if (d < distance) {
        nearest = i;
        distance = d;
      }
    }
    const leg = coordinates.slice(0, Math.max(2, nearest + 1));
    let length = 0;
    for (let i = 1; i < leg.length; i++)
      length += L.latLng(leg[i - 1][1], leg[i - 1][0]).distanceTo([
        leg[i][1],
        leg[i][0],
      ]);
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
    if (!route?.geometry?.coordinates.length) return null;
    const c = route.geometry.coordinates,
      target = Math.max(0, Math.min(1, progress)) * route.distance;
    let sum = 0;
    for (let i = 1; i < c.length; i++) {
      const a = L.latLng(c[i - 1][1], c[i - 1][0]),
        b = L.latLng(c[i][1], c[i][0]),
        d = a.distanceTo(b);
      if (sum + d >= target) {
        const p = d ? (target - sum) / d : 0;
        return [a.lat + (b.lat - a.lat) * p, a.lng + (b.lng - a.lng) * p];
      }
      sum += d;
    }
    return [c.at(-1)[1], c.at(-1)[0]];
  }
}
