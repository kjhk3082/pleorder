(function (root, factory) {
  const value = factory();
  if (typeof module === "object") module.exports = value;
  else root.PleorderCatalog = value;
})(globalThis, () => {
  function meters(a, b) {
    if (!a || !b) return Infinity;
    const rad = (n) => (n * Math.PI) / 180,
      dlat = rad(b.lat - a.lat),
      dlng = rad(b.lng - a.lng),
      v =
        Math.sin(dlat / 2) ** 2 +
        Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dlng / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(1 - v));
  }
  function rank(
    data,
    {
      query = "",
      scope = "home",
      origin,
      home,
      history = [],
      available = () => true,
      realOnly = false,
      fulfillment,
      category,
      limit = 30,
    } = {},
  ) {
    const center = scope === "nearby" ? origin : home || origin;
    const generic = new Set([
      "치킨",
      "피자",
      "버거",
      "한식",
      "중식",
      "일식",
      "카페",
      "커피",
      "음료",
      "밥",
      "국밥",
      "비빔밥",
      "라멘",
      "샐러드",
      "주문",
      "배달",
      "픽업",
      "근처",
      "주변",
      "먹고",
      "싶어",
    ]);
    const nameTerms = query
      .split(/\s+/)
      .map((s) => s.replace(/(?:에서|으로|로)$/, " ").trim())
      .filter((s) => s.length > 1 && !generic.has(s));
    const results = (realOnly ? data.realStores || [] : data.stores).flatMap(
      (store) => {
        if (category && category !== "전체" && store.category !== category) return [];
        const distance = meters(scope === "route" ? origin : center, store);
        const detour = Math.max(0, meters(origin, store) + meters(store, home) - meters(origin, home));
        if (realOnly && fulfillment === "delivery" && store.delivery === "no") return [];
        if (realOnly && fulfillment === "pickup" && store.takeaway === "no") return [];
        if (realOnly && (scope === "route" ? detour > 4000 || distance > meters(origin,home) + 8000 : distance > (query ? 20000 : 8000))) return [];
        const menus = store.realPlace
          ? data.menusForStore(store)
          : data.menus.filter((m) => m.storeId === store.id && available(m));
        const menu = menus.find(
          (m) =>
            !query ||
            [store.name, ...m.aliases].some(
              (a) => query.includes(a) || a.includes(query),
            ),
        );
        if (!menu) return [];
        const nameScore = Math.max(
          0,
          ...nameTerms.map((term) =>
            store.name.replace(/\s/g, "").includes(term.replace(/\s/g, ""))
              ? term.length
              : 0,
          ),
        );
        const recent = history.find(
          (h) => h.storeId === store.id && (!query || h.menuId === menu.id),
        );
        return [
          {
            store,
            menu,
            distance,
            detour,
            recent: !!recent,
            nameScore,
            score:
              (scope === "route" ? detour : distance) -
              (query && recent ? 5000 : 0),
            reason:
              query && recent
                ? "최근 주문한 가게"
                : scope === "nearby"
                  ? "현재 위치 주변"
                  : scope === "route"
                    ? "가는 길에 들르기 좋은"
                    : "집에서 가까운 가게",
          },
        ];
      },
    );
    const named = results.some((r) => r.nameScore > 0);
    const ranked = results
      .filter((r) => !named || r.nameScore > 0)
      .sort((a, b) => a.score - b.score);
    const unique = [];
    for (const item of ranked) {
      if (realOnly && unique.some(other => other.store.name.replace(/\s/g,"") === item.store.name.replace(/\s/g,"") && meters(other.store,item.store) < 35)) continue;
      unique.push(item);
      if (unique.length >= (realOnly ? Math.max(1, Math.min(300, limit)) : 100)) break;
    }
    return unique;
  }
  function routeFacts(home, via) {
    const leg = via?.legs?.[0];
    return {
      meters: Number.isFinite(leg?.distance) ? leg.distance : null,
      minutes: Number.isFinite(leg?.duration)
        ? Math.max(1, Math.ceil(leg.duration / 60))
        : null,
      extraMeters:
        home && via ? Math.max(0, via.distance - home.distance) : null,
      extraMinutes:
        home && via
          ? Math.max(0, Math.ceil((via.duration - home.duration) / 60))
          : null,
    };
  }
  return { meters, rank, routeFacts };
});
