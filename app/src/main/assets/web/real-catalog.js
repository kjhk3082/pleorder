window.PleorderRealCatalog = (() => {
  const stores = new Map(),
    menuIndex = new Map(),
    storeMenus = new Map();
  let brands = {};
  const samples = {
    한식: ["한 끼 메뉴", 10500, "bowl", ["한식", "밥", "비빔밥", "국밥"]],
    치킨: ["치킨 메뉴", 19000, "chicken", ["치킨", "닭"]],
    버거: ["버거 메뉴", 9800, "burger", ["버거", "햄버거"]],
    샐러드: ["샐러드 메뉴", 11900, "salad", ["샐러드"]],
    일식: ["일식 메뉴", 11500, "ramen", ["일식", "라멘", "초밥"]],
    중식: ["식사 메뉴", 11000, "bowl", ["중식", "짜장", "짬뽕"]],
    피자: ["피자 메뉴", 18000, "pizza", ["피자"]],
    카페: ["음료 메뉴", 5000, "coffee", ["카페", "커피"]],
    멕시칸: ["타코 메뉴", 13000, "tacos", ["멕시칸", "타코"]],
    음식점: ["주문 테스트", 10000, "bowl", ["음식", "식사"]],
  };
  function menus(store) {
    if (!store?.realPlace) return [];
    if (storeMenus.has(store.id)) return storeMenus.get(store.id);
    const catalog = store.name.includes("교촌") ? brands.kyochon : null;
    let list;
    if (catalog?.items?.length) {
      store.menuSource = catalog.source;
      store.priceNote = catalog.priceType;
      store.hasOfficialMenu = true;
      list = catalog.items.map((item) => ({
        id: `official-${store.id}-${item.id}`,
        storeId: store.id,
        name: item.name,
        short: "치킨",
        price: item.price,
        art: "chicken",
        aliases: [item.name, store.name, "치킨"],
        desc: "공식 홈페이지 권장소비자가격 · 매장별 상이",
        officialMenu: true,
        sourceUrl: item.sourceUrl,
        image: item.image,
        imageSource: item.imageSource,
      }));
    } else {
      const s = samples[store.category] || samples.음식점;
      list = [
        {
          id: "sample-" + store.id,
          storeId: store.id,
          name: s[0] + " · 테스트",
          short: s[3][0],
          price: s[1],
          art: s[2],
          aliases: [store.name, ...s[3]],
          desc: "주문 흐름 확인용이며 실제 판매 메뉴가 아닙니다.",
          demoMenu: true,
        },
      ];
    }
    store.menuIds = list.map((m) => m.id);
    list.forEach((m) => menuIndex.set(m.id, m));
    storeMenus.set(store.id, list);
    return list;
  }
  const ready = Promise.all([
    fetch("seoul-places.json").then((r) => r.json()),
    fetch("brand-menus.json")
      .then((r) => r.json())
      .catch(() => ({})),
    fetch("place-photos.json").then(r=>r.json()).catch(()=>({brands:[],places:[]})),
  ])
    .then(([data, b, photos]) => {
      brands = b;
      PleorderData.realStores = data.rows.map(
        ([
          id,
          name,
          lat,
          lng,
          category,
          address,
          phone,
          website,
          hours,
          menuUrl,
          cuisine,
          delivery,
          takeaway,
        ]) => {
          const store = {
            id: "osm-" + id,
            name,
            lat,
            lng,
            category,
            address,
            phone,
            website,
            hours,
            menuUrl,
            cuisine,
            delivery: delivery || "unknown",
            takeaway: takeaway || "unknown",
            realPlace: true,
            prep: 20,
            fee: 2000,
            rating: null,
            menuIds: ["sample-osm-" + id],
            sourceUrl:
              "https://www.openstreetmap.org/" +
              { n: "node", w: "way", r: "relation" }[id[0]] +
              "/" +
              id.slice(1),
          };
          const normalized=name.replace(/\s/g,"").toLowerCase();
          const exact=photos.places?.find(p=>p.id===store.id);
          const brand=photos.brands?.find(p=>p.aliases.some(alias=>normalized.startsWith(alias.toLowerCase())));
          store.photos=exact?.photos || brand?.photos || [];
          store.photo=store.photos[0] || null;
          stores.set(store.id, store);
          return store;
        },
      );
      PleorderData.realSource = {
        source: data.source,
        license: data.license,
        retrievedAt: data.retrievedAt,
        count: data.count,
      };
      PleorderData.resolveStore = (id) => stores.get(id);
      PleorderData.resolveMenu = (id) => {
        if (menuIndex.has(id)) return menuIndex.get(id);
        const storeId = id.startsWith("sample-")
          ? id.slice(7)
          : id.match(/^official-(osm-[nwr]\d+)-/)?.[1];
        if (storeId) menus(stores.get(storeId));
        return menuIndex.get(id);
      };
      PleorderData.menuForStore = (store) => menus(store)[0];
      PleorderData.menusForStore = menus;
      return data.count;
    })
    .catch(() => 0);
  return { ready };
})();
