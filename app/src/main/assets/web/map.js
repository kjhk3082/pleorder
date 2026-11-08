class JourneyMap {
  constructor() {
    this.map = L.map("map", {
      zoomControl: false,
      scrollWheelZoom: false,
      attributionControl: true,
    }).setView([37.51, 127.074], 14);
    this.tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    });
    this.tileErrors = 0;
    this.tiles.on("tileerror", () => {
      if (++this.tileErrors > 2)
        document.getElementById("mapStatus").textContent =
          "지도 연결 지연 · 저장된 도로 경로";
    });
    this.tiles.addTo(this.map);
    this.stores = L.layerGroup().addTo(this.map);
    this.routeLayer = L.layerGroup().addTo(this.map);
    this.car = null;
    this.rider = null;
    this.routes = {};
    this.ready = fetch("routes.json")
      .then((r) => r.json())
      .then((d) => {
        this.routes = d.routes || {};
        this.update(this.lastRepo);
        this.fit();
        return this.routes;
      })
      .catch(() => {
        document.getElementById("mapStatus").textContent =
          "경로를 불러오지 못했어요";
        return {};
      });
    new ResizeObserver(() => this.map.invalidateSize()).observe(
      document.getElementById("map"),
    );
  }
  point(coords, type, title) {
    return L.marker(coords, {
      icon: L.divIcon({
        className: "map-marker",
        html: `<span class="point ${type}">${icon(type === "car" ? "car" : type === "rider" ? "bike" : type === "home" ? "home" : "bowl", 17)}</span>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      }),
    }).bindTooltip(title, { className: "map-label", direction: "top" });
  }
  line(key, options) {
    const route = this.routes[key];
    if (!route) return;
    return L.geoJSON(route.geometry, {
      style: { weight: 5, opacity: 0.85, lineCap: "round", ...options },
    }).addTo(this.routeLayer);
  }
  summary(storeId) {
    if (this.lastRepo?.liveLocation)
      return { home: null, via: null, extraMeters: null, extraMinutes: null };
    const home = this.routes.home,
      via = this.routes["via-" + storeId];
    return {
      home,
      via,
      extraMeters:
        home && via ? Math.max(0, via.distance - home.distance) : null,
      extraMinutes:
        home && via
          ? Math.max(1, Math.round((via.duration - home.duration) / 60))
          : null,
    };
  }
  update(repo, selected) {
    if (!repo) return;
    this.lastRepo = repo;
    const off = !!repo.scenario.offline;
    if (off && this.map.hasLayer(this.tiles)) this.map.removeLayer(this.tiles);
    if (!off && !this.map.hasLayer(this.tiles)) this.tiles.addTo(this.map);
    this.stores.clearLayers();
    for (const s of PleorderData.stores)
      this.point([s.lat, s.lng], "store", `가상 · ${s.name}`)
        .addTo(this.stores)
        .on("click", () => window.Pleorder?.openMenu(s.menuIds[0]));
    if (repo.home)
      this.point(
        [repo.home.lat, repo.home.lng],
        "home",
        "우리 집 · 데모 목적지",
      ).addTo(this.stores);
    const order = repo.activeOrder(),
      focus = selected || repo.draft?.storeId || order?.storeId;
    this.routeLayer.clearLayers();
    this.line("home", { color: "#b5c2b7", weight: 7 });
    if (focus)
      this.line(repo.mode === "pickup" ? "via-" + focus : "delivery-" + focus, {
        color: repo.mode === "pickup" ? "#002c5f" : "#388a7f",
        weight: 6,
      });
    else this.line("home", { color: "#638d80", weight: 5 });
    const route =
      this.routes[repo.mode === "pickup" && focus ? "via-" + focus : "home"];
    const progress = Math.min(
      0.99,
      Math.max(0, (repo.clock - repo.startedAt) / (repo.homeMinutes * 60000)),
    );
    const carPosition = repo.liveLocation
      ? [repo.liveLocation.lat, repo.liveLocation.lng]
      : this.interpolate(route, progress) || [repo.origin.lat, repo.origin.lng];
    if (!this.car)
      this.car = this.point(carPosition, "car", "내 차 · 시뮬레이션").addTo(
        this.map,
      );
    else this.car.setLatLng(carPosition);
    if (order?.mode === "delivery" && order.stage === "delivering") {
      const p =
        (repo.clock - (order.dispatchAt || order.readyAt)) /
        (order.deliveryAt - (order.dispatchAt || order.readyAt));
      const position = this.interpolate(
        this.routes["delivery-" + order.storeId],
        p,
      );
      if (position) {
        if (!this.rider)
          this.rider = this.point(position, "rider", "가상 라이더").addTo(
            this.map,
          );
        else this.rider.setLatLng(position);
      }
    } else if (this.rider) {
      this.map.removeLayer(this.rider);
      this.rider = null;
    }
    const distance = this.routes.home?.distance;
    document.getElementById("homeDistance").textContent =
      repo.home && !repo.liveLocation
        ? distance
          ? `${((distance * Math.max(0, 1 - progress)) / 1000).toFixed(1)} km`
          : "경로 확인 중"
        : repo.liveLocation
          ? "경로 갱신 필요"
          : "집 설정 필요";
    document.getElementById("homeTime").innerHTML = repo.home
      ? `${Math.max(0, Math.ceil(repo.homeMinutes - (repo.clock - repo.startedAt) / 60000))}<span>분</span>`
      : "—";
    document.getElementById("mapStatus").textContent = off
      ? "오프라인 · 저장된 도로 경로"
      : repo.liveLocation
        ? "차량 위치 · 경로는 데모"
        : "실제 지도 · 가상 매장 / 경로";
  }
  interpolate(route, progress) {
    if (!route?.geometry?.coordinates?.length) return null;
    const c = route.geometry.coordinates,
      p = Math.max(0, Math.min(1, progress)),
      target = p * route.distance;
    let travelled = 0;
    for (let i = 1; i < c.length; i++) {
      const a = L.latLng(c[i - 1][1], c[i - 1][0]),
        b = L.latLng(c[i][1], c[i][0]),
        d = a.distanceTo(b);
      if (travelled + d >= target) {
        const r = d ? (target - travelled) / d : 0;
        return [a.lat + (b.lat - a.lat) * r, a.lng + (b.lng - a.lng) * r];
      }
      travelled += d;
    }
    return [c[c.length - 1][1], c[c.length - 1][0]];
  }
  fit() {
    const route = this.routes.home;
    if (route)
      this.map.fitBounds(L.geoJSON(route.geometry).getBounds().pad(0.3), {
        animate: false,
      });
  }
}
