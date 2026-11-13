const cash = (n) => Number(n || 0).toLocaleString("ko-KR") + "원";
const clockText = (t) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(t));
const safe = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const uiIcon = (type, size = 22) => icon(type, size);
function restaurantView(rec, repo, roadDistance, route) {
  const { store: s, menu: m } = rec;
  if (s.realPlace) {
    const distance = route
      ? route.meters != null
        ? `매장까지 ${(route.meters / 1000).toFixed(1)}km · ${route.minutes}분`
        : "도로 경로 확인 중"
      : `${(rec.distance / 1000).toFixed(1)}km · 직선`;
    return `<article class="restaurant-card"><button class="restaurant-open" data-menu="${m.id}" aria-label="${safe(s.name)}, ${safe(s.category)}"><div class="restaurant-photo">${storeArt(s,m)}</div><div class="restaurant-body"><div class="store-heading"><h3>${safe(s.name)}</h3></div><p class="menu-name">${safe(m.officialMenu ? m.name : s.category + " · " + (s.address || "서울"))}</p><div class="metadata"><span>${distance}</span>${s.hasOfficialMenu ? '<span class="source-verified">공식 메뉴</span>' : ""}</div>${route ? `<div class="route-detour">${icon("route", 14)}<span>${route.extraMinutes != null ? `경유 시 +${(route.extraMeters / 1000).toFixed(1)}km · +${route.extraMinutes}분` : "추가 이동 확인 중"}</span></div>` : ""}<div class="price-row">${m.officialMenu ? `<strong>${cash(m.price)}</strong><span>공식 권장가</span>` : '<strong class="place-info-link">메뉴 · 매장 정보 보기</strong>'}</div></div><span class="card-arrow">${icon("chevron", 18)}</span></button></article>`;
  }
  return `<article class="restaurant-card"><button class="restaurant-open" data-menu="${m.id}" aria-label="${safe(s.name)}, ${safe(m.name)}"><div class="restaurant-photo">${menuArt(m)}</div><div class="restaurant-body"><div class="store-heading"><h3>${safe(s.name)}</h3>${rec.recent ? '<span class="tag recent">최근 주문</span>' : ""}</div><p class="menu-name">${safe(m.name)}</p><div class="metadata"><span class="rating">${s.realPlace ? "공개 지도 매장" : "★ " + s.rating}</span><span>${route ? (route.meters != null ? `매장까지 ${(route.meters / 1000).toFixed(1)}km · ${route.minutes}분` : "도로 경로 확인 중") : roadDistance || `${(rec.distance / 1000).toFixed(1)}km · 직선`}</span><span>${repo.mode === "pickup" ? `준비 ${s.prep}분` : `배달 ${s.prep + 10}–${s.prep + 15}분`}</span></div>${route ? `<div class="route-detour">${icon("route", 14)}<span>${route.extraMinutes != null ? `경유 시 +${(route.extraMeters / 1000).toFixed(1)}km · +${route.extraMinutes}분` : "추가 이동 확인 중"}</span></div>` : ""}<div class="price-row"><strong>${s.realPlace ? "<small>테스트 </small>" : ""}${cash(m.price)}</strong><span>${repo.mode === "pickup" ? "픽업 · 배달비 없음" : `배달팁 ${cash(s.fee)}`}</span></div></div><span class="card-arrow">${icon("chevron", 18)}</span></button></article>`;
}
function trackingView(repo) {
  const o = repo.activeOrder() || repo.orders[0];
  if (!o) {
    const route = repo.homeRoute();
    return `<div><span class="hud-label">${repo.liveLocation ? "현재 위치에서" : "출발 위치에서"} ${safe(repo.home?.name || "배송지")}까지</span><strong class="hud-title">${route ? `${(route.distance / 1000).toFixed(1)}<small>km</small> <span class="hud-distance-separator">·</span> ${Math.max(1, Math.ceil((route.etaAt - repo.clock) / 60000))}<small>분</small>` : "경로 확인 중"}</strong></div><span class="hud-mark">${icon("car", 25)}</span>`;
  }
  if(["reserved","held"].includes(o.stage))return `<div><span class="hud-label">${o.stage==='held'?'예약 보류':'도착 맞춤 예약'}</span><strong class="hud-title">${o.stage==='held'?'확인 필요':clockText(o.startAt)+' 전송'}</strong></div><span class="hud-mark">${icon("clock",25)}</span>`;
  if (o.stage === "completed")
    return `<div><span class="hud-label">${o.mode === "delivery" ? "배달 완료" : "픽업 완료"}</span><strong class="hud-title">${clockText(o.completedAt || o.deliveryAt)}</strong></div><span class="hud-check">${icon("check", 25)}</span>`;
  if (o.stage === "cancelled")
    return `<div><span class="hud-label">주문 취소</span><strong class="hud-title">${o.payment?.status === "refunded" ? "환불 완료" : "환불 처리 중"}</strong></div>`;
  const remaining = Math.max(
    1,
    Math.ceil(
      ((o.mode === "pickup" ? o.readyAt : o.deliveryAt) - repo.clock) / 60000,
    ),
  );
  const title =
    o.stage === "waiting_rider"
      ? "배달기사님 배정 중"
      : o.stage === "contact_needed"
        ? "배달기사님이 도착했어요"
        : o.mode === "pickup"
          ? o.stage === "ready"
            ? "픽업할 수 있어요"
            : "픽업 준비까지"
          : o.stage === "delivering"
            ? "배달기사님 도착까지"
            : "배달 도착 예정";
  return `<div><span class="hud-label">${title}</span><strong class="hud-title">${o.stage === "waiting_rider" ? "잠시만 기다려 주세요" : o.stage === "contact_needed" ? "수령을 확인해 주세요" : o.stage === "ready" ? "준비 완료" : o.stage === "delivering" || o.mode === "pickup" ? `${remaining}<small>분</small>` : `${clockText(o.deliveryAt)}–${clockText(o.deliveryAt + 5 * 60000)}`}</strong></div><span class="hud-mark">${icon(o.mode === "pickup" ? "bag" : "bike", 30)}</span>`;
}
function serviceOrderView(repo) {
  const o = repo.activeOrder() || repo.orders[0],
    d = repo.draft;
  if (d)
    return `<div class="delivery-card compact"><div class="delivery-title"><h2>주문 확인</h2><strong>${cash(d.total)}</strong></div><p>${d.items.map((i) => `${safe(i.name)} ${i.quantity}개`).join(" · ")}</p><button class="button primary full-width" data-command="summary">결제 정보 확인 ${icon("arrow")}</button></div>`;
  if (!o) {
    const personal=repo.personalHistory();
    if(personal.last){const usual=personal.usual;const last=usual?.order||personal.last;return `<div class="recent-order"><div><span class="section-label">${usual?`${usual.count}번 함께한 한 끼`:'최근 완료한 주문'}</span><strong>${safe(repo.store(last.storeId).name)}</strong><p>${safe(last.items.map(i=>`${i.name} ${i.quantity}개`).join(' · '))}</p></div><button class="button secondary" data-reorder-kind="${usual?'usual':'last'}">다시 담기</button></div>`;}
    const last = repo.recentOrders.find(entry => {
      const s = repo.store(entry.storeId);
      return s && (repo.mode === "pickup" || (s.delivery !== "no" && PleorderCatalog.meters(repo.home,s) <= 8000));
    }),
      store = repo.store(last?.storeId);
    return store
      ? `<div class="recent-order"><div><span class="section-label">최근 주문한 가게</span><strong>${safe(store.name)}</strong><p>${safe(repo.menu(last.menuId).name)} · 배달</p></div><button class="button secondary" data-reorder="${last.menuId}">다시 주문</button></div>`
      : "";
  }
  if(['reserved','held'].includes(o.stage))return `<section class="delivery-card reservation-card ${o.stage}"><div class="delivery-title"><h2>${o.stage==='held'?'예약을 확인해 주세요':'도착에 맞춰 준비할게요'}</h2><span class="reservation-icon">${icon(o.stage==='held'?'pause':'clock',25)}</span></div><p class="order-menu">${safe(repo.store(o.storeId).name)} · ${safe(o.items.map(i=>`${i.name} ${i.quantity}개`).join(', '))}</p><div class="reservation-summary"><strong>${o.stage==='held'?'전송 보류':`${Math.max(0,Math.ceil((o.startAt-repo.clock)/60000))}분 후 매장에 전송`}</strong><p>${safe(o.stage==='held'?o.holdReason:o.reservation?.adjustment?`도착 예상이 달라져 전송을 ${o.reservation.adjustment.minutes}분 ${o.reservation.adjustment.delayed?'늦췄어요':'앞당겼어요'}. 추가 결제는 없어요.`:'도착 시간에 맞춰 매장에 보낼게요. 추가 결제는 없어요.')}</p><small>${o.mode==='pickup'?'매장 픽업':safe(o.address?.name||'선택한 배송지')} · ${cash(o.total)} 모의 결제 완료</small></div><div class="order-actions">${o.stage==='held'?'<button class="button primary" data-command="resume-reservation">기존 장소로 예약 재개</button>':''}<button class="button outlined" data-command="details">상세 내역</button><button class="button outlined" data-command="cancel">예약 취소</button></div></section>`;
  const labels =
    o.mode === "delivery"
      ? ["주문 확인", "조리 중", "배달 중", "배달 완료"]
      : ["주문 확인", "조리 중", "픽업 준비", "픽업 완료"];
  const idx = {
    accepted: 0,
    cooking: 1,
    waiting_rider: 1,
    delivering: 2,
    contact_needed: 2,
    ready: 2,
    completed: 3,
    cancelled: -1,
  }[o.stage];
  const titles = {
    accepted: "주문을 확인하고 있어요",
    cooking: "음식을 준비하고 있어요",
    waiting_rider: "배달기사님을 찾고 있어요",
    delivering: "배달 중이에요",
    contact_needed: "도착했어요",
    ready: "픽업 준비가 끝났어요",
    completed: "맛있게 드세요",
    cancelled: "주문이 취소됐어요",
  };
  const p = o.payment;
  return `<div class="delivery-card"><div class="delivery-title"><h2>${titles[o.stage]}</h2>${o.stage === "completed" ? `<time>${clockText(o.completedAt || o.deliveryAt)} ${o.mode === "delivery" ? "배달 완료" : "픽업 완료"}</time>` : `<button class="text-link" data-command="details">주문 상세 ${icon("chevron", 15)}</button>`}</div><p class="order-menu">${safe(repo.store(o.storeId).name)} · ${o.items.map((i) => `${safe(i.name)} ${i.quantity}개`).join(", ")}</p>${o.stage === "waiting_rider" ? '<p class="status-note">음식은 준비됐어요. 기사님이 정해지면 알려드릴게요.</p>' : o.delayMinutes && idx < 3 ? `<p class="status-note">매장 준비가 ${o.delayMinutes}분 늦어지고 있어요.</p>` : ""}<ol class="order-timeline ${o.stage === "completed" ? "completed" : ""}">${labels.map((l, i) => `<li class="${i <= idx ? "done" : ""} ${i === idx ? "current" : ""}"><span>${i < idx || o.stage === "completed" ? icon("check", 16) : i === idx ? '<i class="stage-current-dot"></i>' : ""}</span>${l}</li>`).join("")}</ol>${o.proof ? `<button class="proof-preview" data-command="proof"><img src="${o.proof.image}" alt="문 앞에 놓인 배달 음식 샘플 사진"><span><strong>문 앞에 놓아드렸어요</strong><small>${clockText(o.proof.capturedAt)} · 사진 보기</small></span>${icon("chevron", 18)}</button>` : ""}<div class="paid-line"><span>${p?.name || "등록 카드"} · ${p?.last4 || ""}</span><strong>${cash(o.total)} ${p?.status === "refund_pending" ? "환불 중" : p?.status === "refunded" ? "환불 완료" : "결제 완료"}</strong></div><div class="order-actions">${o.mode === "pickup" && idx < 3 ? `<button class="button ${o.stage === "ready" ? "primary" : "secondary"}" data-command="${o.stage === "ready" ? "collect" : "navigate"}">${o.stage === "ready" ? "픽업 완료" : "매장으로 안내"}</button>` : ""}${o.stage === "contact_needed" ? '<button class="button primary" data-command="recipient-ready">지금 받을 수 있어요</button>' : ""}<button class="button outlined" data-command="details">${o.stage === "completed" ? "주문 상세" : "상세 내역"}</button>${idx >= 0 && idx < 2 ? '<button class="button outlined" data-command="cancel">주문 취소</button>' : ""}</div></div>`;
}
function bankCardView(card, selected = false) {
  return `<button class="bank-card ${card.color} ${selected ? "selected" : ""}" data-payment-method="${card.id}" aria-label="${safe(card.name)} 선택"><span class="bank-card-top"><span>${card.provider === "incar" ? "인카페이먼트" : "배달앱 등록 카드"}</span>${cardArt(card)}</span><strong>${safe(card.nickname || card.name)}</strong><span class="card-number">•••• &nbsp; •••• &nbsp; •••• &nbsp; ${card.last4}</span><span class="bank-card-bottom"><span>${card.decision === "review_decline" ? "승인 확인 필요" : `모의 사용 가능 ${cash(card.balance)}`}</span>${selected ? icon("check", 20) : ""}</span></button>`;
}
function paymentSuccessView(o, repository) {
  return `<div class="payment-result success-receipt"><div class="receipt-eyebrow"><span>ORDER CONFIRMED</span><span>${o.id}</span></div><div class="success-orbit"><span class="success-halo"></span><svg class="success-check" viewBox="0 0 64 64"><circle cx="32" cy="32" r="29"/><path d="m18 33 10 10 20-23"/></svg><i class="glass-glint"></i></div><h2>결제했어요</h2><p class="success-store">${safe(repository?.store(o.storeId)?.name || "")}</p><strong class="payment-amount">${cash(o.total)}</strong><div class="receipt-preview"><div class="receipt-meal">${menuArt(repository?.menu(o.items[0].menuId))}<span>${safe(o.items.map((i) => i.name + " " + i.quantity + "개").join(", "))}</span></div><div class="receipt-card">${uiIcon("card", 19)}<span>${safe(o.payment.name)} · ${o.payment.last4}</span><span>승인</span></div></div><div class="arrival-chip">${icon(o.mode === "delivery" ? "bike" : "bag", 20)}<span>${o.mode === "delivery" ? `<b>${clockText(o.deliveryAt)}</b> 도착 예정` : "매장에서 픽업"}</span></div><button class="button primary full-width" data-command="close">${o.mode === "delivery" ? "배달 현황 보기" : "픽업 현황 보기"}${icon("arrow", 20)}</button><span class="micro-note">실제 청구 없는 데모 결제</span></div>`;
}
function realStoreView(store, repo, cart, tab, limit, showSample) {
  const items = DATA.menusForStore(store),
    official = items.some((m) => m.officialMenu),
    amount = Object.entries(cart).reduce(
      (n, [id, q]) => n + (repo.menu(id)?.price || 0) * q,
      0,
    ),
    count = Object.values(cart).reduce((a, b) => a + b, 0);
  const tabs = `<div id="storeTabs" class="store-tabs">${[
    ["menu", "메뉴"],
    ["info", "매장 정보"],
    ["reviews", "리뷰"],
  ]
    .map(
      ([id, label]) =>
        `<button data-store-tab="${id}" class="${tab === id ? "selected" : ""}">${label}</button>`,
    )
    .join("")}</div>`;
  let content = "";
  const gallery=store.photos?.length ? `<div class="store-photo-strip" aria-label="브랜드 공식 사진">${store.photos.slice(0,8).map(p=>`<figure>${sourcedPhoto(p,store.name)}<figcaption>${safe(p.name)}</figcaption></figure>`).join('')}</div><p class="menu-source-note">브랜드 공식 사진 · 지점별 판매 메뉴와 구성은 다를 수 있어요. <button class="text-link photo-source-link" data-external="${safe(store.photo.sourcePage)}">사진 출처 ${icon('arrow',14)}</button></p>` : '';
  if (tab === "menu") {
    if (!official && !showSample)
      content = `<div class="menu-source-empty">${icon("bowl", 34)}<h3>확인된 메뉴판을 기다리고 있어요</h3><p>이 매장의 메뉴·가격을 아직 확보하지 못했어요.<br>등록된 메뉴판이나 웹사이트에서 확인할 수 있어요.</p><div>${store.menuUrl || store.website ? `<button class="button primary" data-external="${safe(store.menuUrl || store.website)}">${store.menuUrl ? "메뉴판 보기" : "등록된 웹사이트"}</button>` : ""}<button class="button outlined" data-action="sample-menu">시뮬레이션 메뉴로 테스트</button></div></div>`;
    else
      content = `<p class="menu-source-note">${official ? "공식 브랜드 메뉴 · 권장소비자가격 · 매장별 상이" : "아래 구성은 실제 판매 메뉴가 아닌 테스트 메뉴입니다."} ${official ? "<span>사진: 교촌 공식 홈페이지 · 지점별 구성은 다를 수 있어요</span>" : ""}</p><div class="real-menu-grid">${items
        .slice(0, limit)
        .map(
          (m) =>
            `<article class="real-menu-card ${cart[m.id] ? "in-cart" : ""}"><div class="real-menu-photo">${menuArt(m)}</div><div class="real-menu-copy"><h3>${safe(m.name)}</h3><span>${m.officialMenu ? "공식 메뉴" : "시뮬레이션"}</span><strong>${cash(m.price)}</strong><div class="quantity-control"><button data-quantity="-1" data-id="${m.id}" aria-label="${safe(m.name)} 수량 줄이기">${icon("minus", 18)}</button><output>${cart[m.id] || 0}</output><button data-quantity="1" data-id="${m.id}" aria-label="${safe(m.name)} 수량 늘리기">${icon("plus", 18)}</button></div></div></article>`,
        )
        .join(
          "",
        )}</div>${items.length > limit ? '<button class="button outlined full-width" data-action="more-menu">메뉴 더 보기</button>' : ""}`;
  } else if (tab === "info")
    content = `<dl class="store-facts"><div><dt>주소</dt><dd>${safe(store.address || "공개 데이터에 등록된 주소가 없어요.")}</dd></div><div><dt>업종</dt><dd>${safe(store.cuisine || store.category)}</dd></div><div><dt>배달 · 포장</dt><dd>배달 ${store.delivery === "yes" ? "표기 있음" : store.delivery === "no" ? "하지 않음" : "미확인"} · 포장 ${store.takeaway === "yes" || store.takeaway === "only" ? "표기 있음" : store.takeaway === "no" ? "하지 않음" : "미확인"}<small>공개 지도 태그이며 주소별 실제 배달 권역은 확인되지 않았어요.</small></dd></div><div><dt>전화</dt><dd>${safe(store.phone || "등록 정보 없음")}</dd></div><div><dt>영업시간</dt><dd>${safe(store.hours || "등록 정보 없음")}<small>공개 지도에 등록된 정보이며 실제 영업 여부와 다를 수 있어요.</small></dd></div></dl><div class="store-source-links">${store.website ? `<button class="button outlined" data-external="${safe(store.website)}">등록된 웹사이트</button>` : ""}<button class="button outlined" data-external="${safe(store.sourceUrl)}">지도 원본 보기</button></div><p class="menu-source-note">© OpenStreetMap contributors · ODbL · 스냅샷 데이터</p>`;
  else
    content = `<div class="menu-source-empty">${icon("star", 34)}<h3>실제 리뷰를 아직 연결하지 않았어요</h3><p>리뷰와 별점은 임의로 만들지 않습니다.<br>지도에서 이 매장의 실제 이용 후기를 확인해 주세요.</p><button class="button outlined" data-external="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(store.name + " " + (store.address || ""))}">지도에서 리뷰 확인</button></div>`;
  return `<div class="store-overview"><span>${safe(store.category)}</span><p>${safe(store.address || "서울 · 공개 지도 등록 매장")}</p></div>${tabs}<div class="store-tab-content">${tab==='menu'&&!official?gallery:''}${content}</div>${count ? `<div class="store-cart-bar"><span><strong>${count}개</strong> 담았어요</span><button class="button primary" data-action="prepare-cart">${cash(amount)} 주문 확인 ${icon("arrow", 18)}</button></div>` : ""}`;
}
