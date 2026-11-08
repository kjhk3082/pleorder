"use strict";
const { OrderRepository, DATA } = PleorderCore;
const $ = (id) => document.getElementById(id);
let saved;
try {
  saved = window.Native
    ? Native.loadState()
    : localStorage.getItem("pleorder-v1");
} catch {}
let repo = saved ? OrderRepository.restore(saved) : new OrderRepository();
repo.preferences.catalogMode ||= "real";
let searchQuery = "";
let storeListLimit = 30;
let category = "전체",
  scope = repo.preferences.scope || "home",
  paused = repo.simulation?.paused ?? !repo.activeOrder(),
  rate = repo.simulation?.rate || 10,
  lastWall = Date.now(),
  lastOrder = repo.activeOrder()?.id,
  listening = false,
  modalKind = "",
  walletContext = "manage",
  walletChannel = "incar",
  cart = {},
  focusedMenu = null,
  hintIndex = 0,
  lastVoiceAt = 0;
let awaitingLocationCenter = false;
let voiceTarget = null;
let navigationDraft = null;
let placePurpose = "destination";
let uxPolicy = PleorderUx.fromEvent({requiresDo:false, activeRestrictions:0});
let pageActive = true;
let storeTab = "menu",
  menuLimit = 12,
  showSampleMenus = false;
const hints = [
  "치킨 먹고 싶어",
  "최근 주문한 메뉴로 담아 줘",
  "집 주변 국밥 추천해 줘",
  "신한카드로 바꿔 줘",
  "문 앞에 놓아 줘",
  "배달기사님 언제 도착해?",
  "결제 승인",
];
const map = new JourneyMap();
function save() {
  repo.simulation = { paused, rate, savedWall: Date.now() };
  const s = repo.serialize();
  try {
    window.Native
      ? Native.saveState(s)
      : localStorage.setItem("pleorder-v1", s);
  } catch {}
}
function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("toast").classList.remove("show"), 4200);
}
function modal(title, subtitle, body, kind = "") {
  const previousKind = modalKind;
  const wasOpen = $("modal").open;
  modalKind = kind;
  $("modal").dataset.kind = kind;
  $("modalContent").innerHTML =
    `<header class="modal-head"><div><h2 id="dialogTitle">${safe(title)}</h2>${subtitle ? `<p>${safe(subtitle)}</p>` : ""}</div><button class="icon-button" data-action="close" aria-label="닫기">${icon("close")}</button></header><div class="modal-body">${body}</div>`;
  if (title) {
    $("modal").setAttribute("aria-labelledby", "dialogTitle");
    $("modal").removeAttribute("aria-label");
  } else {
    $("modal").removeAttribute("aria-labelledby");
    $("modal").setAttribute("aria-label", kind === "success" ? "결제 완료" : "주문 안내");
  }
  if (!$("modal").open) $("modal").showModal();
  applyUxControls();
  if (wasOpen && previousKind !== kind)
    PleorderMotion.dialog(
      $("modalContent").querySelector(".modal-body"),
      kind === "checkout" ? -1 : 1,
    );
}
function close() {
  if (voiceTarget && window.Native) Native.stopSpeech();
  voiceTarget = null;
  window.PleorderPlaces?.destroy();
  modalKind = "";
  $("modal").close();
  map.clearSelection();
}
function speak(text) {
  if (window.Native) Native.speak(text);
  else toast("음성 출력은 차량 앱에서 사용할 수 있어요.");
}
function startClock(r) {
  if (r.order && r.status === "success" && r.order.id !== lastOrder) {
    lastOrder = r.order.id;
    paused = false;
    rate = 10;
    lastWall = Date.now();
  }
}
function respond(r, { voice = false, payment = false } = {}) {
  if (r.open) {
    if (r.open === "registration") return openRegistration();
    if (r.open === "address") return openAddresses();
    if (r.open === "place-search") {
      openPlacePicker();
      setTimeout(() => PleorderPlaces.search(r.query), 0);
      return;
    }
    if (r.open === "location") {
      centerCurrentLocation();
      return;
    }
  }
  startClock(r);
  save();
  render();
  if (voice) speak(r.voiceText || r.message);
  if (r.recommendation) {
    focusedMenu = r.recommendation.menuId;
    openStore(focusedMenu, true);
    return r;
  }
  if (r.payment && r.status !== "success") {
    openPaymentResult(r);
    return r;
  }
  if (r.draft) {
    openCheckout();
    return r;
  }
  if (payment && r.order && r.status === "success") {
    modal("", "", "" + paymentSuccessView(r.order, repo), "success");
    return r;
  }
  if (r.status === "fail" || r.status === "asking") toast(r.message);
  else if (r.order) close();
  return r;
}
function render() {
  applyPreferences();
  $("deliveryTab").classList.toggle("active", repo.mode === "delivery");
  $("pickupTab").classList.toggle("active", repo.mode === "pickup");
  $("deliveryTab").setAttribute(
    "aria-pressed",
    String(repo.mode === "delivery"),
  );
  $("pickupTab").setAttribute("aria-pressed", String(repo.mode === "pickup"));
  $("orderDot").classList.toggle("has-order", !!repo.activeOrder());
  const place = scope === "home" ? repo.home : repo.liveLocation || repo.origin;
  $("areaLabel").textContent =
    scope === "home"
      ? repo.home?.description?.split(" · ")[0] || "배송지 미설정"
      : scope === "nearby"
        ? "현재 위치 주변"
        : `현재 위치 → ${repo.home?.name || "목적지"}`;
  $("catalogTitle").textContent =
    scope === "route"
      ? "가는 길에 픽업"
      : scope === "nearby"
        ? "내 주변 맛집"
        : `${repo.home?.id === "home" ? "집" : "목적지"} 주변 맛집`;
  $("addressButton").innerHTML = uiIcon("edit", 18) + " 배송지";
  $("originButton").innerHTML = icon("pin", 16) + `<span>출발 · ${safe(repo.preferences.locationSource === "manual" ? repo.origin.name || "선택한 위치" : repo.liveLocation ? "차량 현재 위치" : repo.origin.name || "출발 위치")}</span><b>변경</b>`;
  $("currentLocationButton").innerHTML = icon("locate",20) + (repo.preferences.locationSource === "manual" ? " 출발 위치" : " 현 위치");
  $("scopeTabs").innerHTML = [
    ["home", repo.home?.id === "home" ? "집 주변" : "목적지 주변"],
    ["nearby", "내 주변"],
    ["route", "가는 길"],
  ]
    .map(
      ([s, t]) =>
        `<button class="${scope === s ? "selected" : ""}" data-scope="${s}" aria-pressed="${scope === s}">${t}</button>`,
    )
    .join("");
  $("categories").innerHTML = ["전체", "한식", "치킨", "버거", "샐러드", "일식"]
    .map(
      (c) =>
        `<button class="category ${category === c ? "selected" : ""}" data-category="${c}" aria-pressed="${category === c}">${c}</button>`,
    )
    .join("");
  const destination = repo.navigationDestination;
  const showDestination =
    destination &&
    !repo.activeOrder() &&
    destination.key !== repo.dismissedDestination &&
    (!repo.home || PleorderCatalog.meters(destination, repo.home) > 70);
  $("recommendationBanner").hidden = !showDestination;
  if (showDestination)
    $("recommendationBanner").innerHTML =
      `<span class="section-label">차량 내비 목적지</span><strong>${safe(destination.name)}</strong><p>이곳 주변 음식점을 찾아볼까요?</p><div><button class="button secondary" data-action="use-destination">추천 보기</button><button class="text-link" data-action="dismiss-destination">나중에</button></div>`;
  map.repo = repo;
  const recs = repo
    .recommend(searchQuery, scope, {category, limit:storeListLimit})
    .filter((r) => category === "전체" || r.store.category === category);
  if (uxPolicy.limitedContent) recs.splice(uxPolicy.maxItems);
  if (scope === "route") {
    recs.splice(8);
    recs.forEach((r) => (r.route = map.summary(r.store.id)));
    recs.sort(
      (a, b) =>
        (a.route.extraMinutes ?? Infinity) -
          (b.route.extraMinutes ?? Infinity) ||
        (a.route.meters ?? Infinity) - (b.route.meters ?? Infinity),
    );
  }
  let listHtml =
    recs
      .map((r) =>
        restaurantView(r, repo, map.storeDistance(r.store.id, scope), r.route),
      )
      .join("") ||
    '<div class="empty-state">이 조건에 맞는 가게가 없어요.<button class="button secondary" data-action="reset-filter">전체 가게 보기</button></div>';
  if (scope !== "route" && repo.preferences.catalogMode === "real" && recs.length >= storeListLimit && storeListLimit < 300)
    listHtml += '<button class="button outlined full-width" data-action="more-stores">주변 가게 더 보기</button>';
  if (render.lastListHtml !== listHtml) {
    render.lastListHtml = listHtml;
    $("restaurantList").innerHTML = listHtml;
    PleorderMotion.revealList($("restaurantList"));
  }
  PleorderMotion.selection($("scopeTabs"));
  PleorderMotion.selection($("categories"));
  PleorderMotion.selection($("primaryNav"));
  const card = repo.payments.method();
  $("walletButton").innerHTML =
    cardArt(card) + `<span>${card ? safe(card.name) : "카드 등록"}</span>`;
  $("destinationButton").innerHTML =
    `${safe(repo.home?.name || "배송지 선택")} ${icon("chevron", 18)}`;
  $("destinationLabel").textContent =
    repo.mode === "delivery" ? "배달받을 곳" : "돌아갈 곳";
  $("timingButton").innerHTML =
    icon("clock", 18) +
    (repo.timing === "arrival" ? "내 도착에 맞춰" : "바로 주문");
  renderOrder();
  map.update(repo);
  applyUxControls();
  save();
}
function renderOrder() {
  PleorderMotion.replace($("trackingHud"), trackingView(repo), "number");
  const key =
    (repo.activeOrder() || repo.orders[0])?.stage ||
    (repo.draft ? "draft" : "idle");
  const changed = PleorderMotion.replace(
    $("orderPanel"),
    serviceOrderView(repo),
  );
  if (changed && renderOrder.lastStage !== key) {
    PleorderMotion.pop(
      $("orderPanel").querySelector(".order-timeline .current span"),
    );
    renderOrder.lastStage = key;
  }
  $("map").parentElement.style.setProperty(
    "--order-panel-height",
    $("orderPanel").offsetHeight + "px",
  );
  document
    .querySelector(".journey-panel")
    .style.setProperty(
      "--order-panel-height",
      $("orderPanel").offsetHeight + "px",
    );
}
function setMode(mode) {
  if (repo.activeOrder())
    return toast("진행 중인 주문에서 수령 방식을 변경할 수 없어요.");
  if (repo.draft) {
    const r = repo.prepare({ items: repo.draft.items, mode });
    if (!r.draft) return toast(r.message);
  } else repo.mode = mode;
  if (mode === "pickup") scope = "route";
  repo.preferences.scope = scope;
  render();
}
function openStore(menuId, recommended = false) {
  if (uxPolicy.limitedContent) return toast("지금은 간단한 주문 현황만 표시해요. Gleo로 원하는 메뉴를 말씀해 주세요.");
  const sourceImage = document.querySelector(`[data-menu="${menuId}"] img`);
  focusedMenu = menuId;
  const m = repo.menu(menuId),
    s = repo.store(m.storeId);
  storeTab = "menu";
  menuLimit = 12;
  showSampleMenus = false;
  cart = { [menuId]: s.realPlace && !recommended ? 0 : 1 };
  if (repo.draft?.storeId === s.id)
    cart = Object.fromEntries(
      repo.draft.items.map((i) => [i.menuId, i.quantity]),
    );
  map.selectStore(s.id);
  renderStore(s, recommended);
  PleorderMotion.sharedImage(
    sourceImage,
    document.querySelector(".store-food img"),
  );
}
function renderStore(store, recommended = false) {
  if (store.realPlace) {
    modal(
      store.name,
      `${store.category} · 실제 매장 정보`,
      realStoreView(store, repo, cart, storeTab, menuLimit, showSampleMenus),
      "store",
    );
    PleorderMotion.selection($("storeTabs"));
    return;
  }
  const recent = repo.recentOrders.some((o) => o.storeId === store.id);
  modal(
    store.name,
    `${store.category} · ${store.realPlace ? "실제 매장 · 주문 시뮬레이션" : "★ " + store.rating} · ${repo.mode === "pickup" ? "픽업" : "배달"}`,
    `${recommended || recent ? '<div class="recommendation-note">최근 주문한 가게예요. 지난 메뉴를 다시 담을 수 있어요.</div>' : ""}<div class="store-menu-list">${store.menuIds
      .map((id) => {
        const m = repo.menu(id),
          q = cart[id] || 0;
        return `<article class="store-menu-item"><div class="store-food">${menuArt(m)}</div><div><h3>${safe(m.name)}</h3><p>${safe(m.desc)}</p><strong>${cash(m.price)}</strong></div><div class="quantity-control"><button data-quantity="-1" data-id="${id}" aria-label="${m.name} 수량 줄이기">${icon("minus", 18)}</button><output>${q}</output><button data-quantity="1" data-id="${id}" aria-label="${m.name} 수량 늘리기">${icon("plus", 18)}</button></div></article>`;
      })
      .join(
        "",
      )}</div><div class="store-info"><span>${repo.mode === "delivery" ? `배달팁 ${cash(store.fee)}` : "픽업 · 배달팁 없음"}</span><span>준비 약 ${store.prep}분</span></div><button class="button primary full-width" data-action="prepare-cart">${cash(Object.entries(cart).reduce((n, [id, q]) => n + repo.menu(id).price * q, 0))} 담고 주문하기 ${icon("arrow")}</button>`,
    "store",
  );
  if (store.realPlace)
    document
      .querySelector(".store-menu-list")
      .insertAdjacentHTML(
        "beforebegin",
        '<p class="catalog-disclosure">매장명·위치는 공개 지도 정보입니다. 아래 메뉴·사진·가격·배달 조건은 테스트용이며 실제 매장에 접수되지 않습니다.</p>',
      );
  if (renderStore.lastId === store.id)
    document
      .querySelectorAll(".quantity-control output")
      .forEach(PleorderMotion.pop);
  renderStore.lastId = store.id;
}
function openCheckout() {
  walletContext = "checkout";
  const d = repo.draft;
  if (!d) return;
  const card = repo.payments.method(),
    pending = repo.payments.transactions.find(
      (t) => t.key === d.id && t.status === "pending",
    );
  if (pending)
    return openPaymentResult({
      payment: pending,
      status: "asking",
      message: "결제 결과 확인 중이에요.",
    });
  modal(
    "주문 · 결제",
    repo.store(d.storeId).name,
    `<div class="checkout-layout"><div class="checkout-main"><section class="checkout-section"><div class="section-heading"><h3>${d.mode === "delivery" ? "배달받을 곳" : "픽업 매장"}</h3><button class="text-link" data-action="address">변경</button></div><strong class="address-title">${safe(d.mode === "delivery" ? repo.home?.name || "배송지 미설정" : repo.store(d.storeId).name)}</strong><p>${safe(d.mode === "delivery" ? repo.home?.description || "" : repo.store(d.storeId).category)} ${safe(repo.preferences.addressDetail || "")}</p>${d.mode === "delivery" ? `<div class="handoff-options"><button class="${d.handoff === "door" ? "selected" : ""}" data-handoff="door">문 앞에 놓아주세요</button><button class="${d.handoff === "hand" ? "selected" : ""}" data-handoff="hand">직접 받을게요</button></div><label class="field-label" for="deliveryRequest">배달 요청사항</label><input id="deliveryRequest" maxlength="120" class="field" value="${safe(d.request)}" placeholder="예: 벨 누르지 말아주세요">` : ""}</section><section class="checkout-section"><div class="section-heading"><h3>주문 메뉴</h3><button class="text-link" data-action="edit-cart">변경</button></div>${d.items.map((i) => `<div class="detail-row"><span>${safe(i.name)} <b>${i.quantity}개</b></span><strong>${cash(i.price * i.quantity)}</strong></div>`).join("")}</section><section class="checkout-section"><div class="section-heading"><h3>결제 수단</h3><button class="text-link" data-action="choose-card">${card ? "변경" : "등록"}</button></div>${card ? `<button class="selected-payment" data-action="choose-card">${cardArt(card)}<span><strong>${safe(card.nickname || card.name)} · ${card.last4}</strong><small>${card.provider === "incar" ? "인카페이먼트" : "배달앱 등록 카드"}</small></span>${icon("chevron", 18)}</button>` : '<button class="button outlined full-width" data-action="register-card">결제 카드 등록</button>'}</section></div><aside class="checkout-total"><h3>결제 금액</h3><div class="detail-row"><span>메뉴 금액</span><strong>${cash(d.subtotal)}</strong></div><div class="detail-row"><span>배달팁</span><strong>${cash(d.fee)}</strong></div><div class="detail-row total-row"><span>총 결제금액</span><strong>${cash(d.total)}</strong></div><p class="payment-context">${d.mode === "delivery" ? `${clockText(repo.estimateOrder(d).deliveryAt)} 전후 도착 예정` : `약 ${repo.estimateOrder(d).prepMinutes}분 후 픽업 가능`}</p><div class="checkout-authorize">${card ? `<div id="paymentSlide" class="payment-slide" role="slider" tabindex="0" aria-label="밀어서 ${cash(d.total)} 결제" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="slide-fill"></div><span class="slide-copy">밀어서 ${cash(d.total)} 결제</span><span class="slide-thumb">${icon("arrow", 25)}</span></div><span class="slide-help">음성으로는 “결제 승인”이라고 말해 주세요.</span>` : '<button class="button primary full-width" data-action="register-card">카드 등록하고 결제</button>'}</div><p class="micro-note">실제 청구 없는 데모 결제</p></aside></div>`,
    "checkout",
  );
  if (card) attachSlide({ draftId: d.id, cardId: card.id, total: d.total });
}
function attachSlide(snapshot) {
  const el = $("paymentSlide");
  if (!el) return;
  const slider = new PleorderCheckout.SlideConfirmation(() => {
    if (
      repo.draft?.id !== snapshot.draftId ||
      repo.payments.method()?.id !== snapshot.cardId ||
      repo.draft?.total !== snapshot.total
    ) {
      toast("결제 정보가 바뀌었어요. 다시 확인해 주세요.");
      return openCheckout();
    }
    if ($("deliveryRequest")) {
      repo.draft.request = $("deliveryRequest").value.trim().slice(0, 120);
      repo.preferences.request = repo.draft.request;
    }
    respond(repo.confirm(snapshot.draftId, true), {
      voice: !!window.Native,
      payment: true,
    });
  });
  const paint = () => {
    el.style.setProperty("--slide-progress", slider.progress);
    el.setAttribute("aria-valuenow", String(Math.round(slider.progress * 100)));
  };
  el.addEventListener("order-request-change", () => {
    snapshot.draftId = repo.draft?.id;
    slider.cancel();
    paint();
    save();
  });
  el.addEventListener("pointerdown", (e) => {
    if (!e.target.closest(".slide-thumb")) return;
    slider.begin(e.clientX, el.clientWidth - 72);
    el.classList.add("dragging");
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener("pointermove", (e) => {
    slider.move(e.clientX);
    paint();
  });
  el.addEventListener("pointerup", () => {
    slider.release();
    el.classList.remove("dragging");
    paint();
  });
  el.addEventListener("pointercancel", () => {
    slider.cancel();
    el.classList.remove("dragging");
    paint();
  });
  el.addEventListener("keydown", (e) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End", "Enter"].includes(e.key))
      return;
    e.preventDefault();
    if (e.key === "Home") slider.progress = 0;
    else if (e.key === "End") slider.progress = 1;
    else if (e.key === "ArrowRight")
      slider.progress = Math.min(1, slider.progress + 0.1);
    else if (e.key === "ArrowLeft")
      slider.progress = Math.max(0, slider.progress - 0.1);
    else if (slider.progress >= 0.94) {
      slider.dragging = true;
      slider.release();
    }
    paint();
  });
}
function openWallet(context = walletContext, channel) {
  if (!uxPolicy.setup && context !== "checkout") return toast("카드 관리는 주차 후 이용해 주세요. 주문할 때 등록된 카드를 선택할 수 있어요.");
  walletContext = context;
  walletChannel = channel || repo.payments.method()?.provider || "incar";
  const cards = repo.payments.methods.filter(
    (c) => c.registered && c.provider === walletChannel,
  );
  modal(
    context === "checkout" ? "결제할 카드를 선택하세요" : "결제 카드",
    walletChannel === "incar"
      ? "차량 월렛에 연결된 테스트 카드"
      : "배달앱에 등록한 테스트 카드",
    `<div class="payment-tabs"><button class="${walletChannel === "incar" ? "active" : ""}" data-wallet-channel="incar">인카페이먼트</button><button class="${walletChannel === "delivery" ? "active" : ""}" data-wallet-channel="delivery">배달앱 카드</button></div><div class="wallet-grid">${cards.map((c) => `<article>${bankCardView(c, c.id === repo.payments.selected)}<div class="card-controls"><button class="text-link" data-card-default="${c.id}">${c.id === repo.payments.defaultId ? "기본 결제수단" : "기본으로 설정"}</button><button class="text-link muted" data-card-remove="${c.id}">등록 해제</button></div></article>`).join("") || '<div class="empty-state">등록된 카드가 없어요.</div>'}</div><button class="add-card" data-action="register-card">${uiIcon("plus")} 카드 등록</button>`,
    "wallet",
  );
}
function openRegistration() {
  if (!uxPolicy.setup) return toast("카드 등록은 주차 후 이용해 주세요. 등록된 카드는 주문에 사용할 수 있어요.");
  const cards = repo.payments.methods.filter((c) => !c.registered);
  modal(
    "카드 등록",
    "테스트 카드만 등록되며 실제 카드 정보는 입력하지 않습니다.",
    `<form id="cardRegistration"><label class="field-label" for="cardTemplate">등록할 카드</label><select id="cardTemplate" class="field">${(cards.length ? cards : repo.payments.methods).map((c) => `<option value="${c.id}">${c.name} (${c.last4})${c.registered ? " · 이미 등록됨" : ""}</option>`).join("")}</select><label class="field-label" for="cardNickname">카드 별명</label><input id="cardNickname" class="field" maxlength="24" placeholder="예: 생활비 카드"><div class="card-registration-preview">${uiIcon("card", 30)}<div><strong>안전한 테스트 카드 연결</strong><p>카드번호·CVC·비밀번호를 저장하지 않습니다.</p></div></div><label class="check-row"><input type="checkbox" id="cardConsent" required><span>데모 카드 등록임을 확인했습니다.</span></label><button class="button primary full-width" type="submit">등록하기</button></form>`,
    "registration",
  );
}
function openPaymentResult(r) {
  const pending = r.payment?.status === "pending";
  modal(
    pending ? "승인 결과를 확인하고 있어요" : "결제하지 못했어요",
    "",
    `<div class="payment-result"><div class="result-symbol ${pending ? "pending" : "failed"}">${pending ? '<span class="spinner"></span>' : icon("close", 34)}</div><h2>${pending ? "결제 결과 확인 중" : r.payment?.reason === "insufficient" ? "카드 한도가 부족해요" : "카드 승인이 거절됐어요"}</h2><p>${safe(pending ? "중복 결제를 막기 위해 먼저 승인 결과를 확인할게요." : r.payment?.reason === "insufficient" ? `필요 금액 ${cash(r.payment.amount)} · 사용 가능 ${cash(repo.payments.method()?.balance)}` : "카드 상태를 확인하거나 다른 카드를 선택해 주세요.")}</p><div class="payment-error-amount">${cash(r.payment?.amount || repo.draft?.total)}</div><button class="button primary full-width" data-action="${pending ? "reconcile" : "choose-card"}">${pending ? "승인 결과 확인" : "다른 카드로 결제"}</button><button class="button plain full-width" data-action="close">나중에</button></div>`,
    "payment-result",
  );
}
function openAddresses() {
  modal(
    "배달받을 곳",
    "선택한 위치를 기준으로 가게와 경로가 바뀝니다.",
    `<button class="add-card" data-action="read-destination">${icon("route", 20)} 차량 내비 목적지 불러오기</button><p class="micro-note">${repo.navigationDestination ? safe(repo.navigationDestination.name) : repo.navigationStatus === "unavailable" ? "내비게이션에서 목적지 응답을 받지 못했어요." : "차량에 설정된 목적지를 가져옵니다."}</p><div class="address-list">${repo.savedPlaces.map((p) => `<button class="address-option ${repo.home?.id === p.id ? "selected" : ""}" data-place="${p.id}">${icon(p.id === "work" ? "pin" : "home", 25)}<span><strong>${safe(p.name)}</strong><small>${safe(/^\d+\.\d+,\s*\d+\.\d+$/.test(p.description || "") ? "주소를 다시 선택해 주세요" : p.description || "지도에서 선택한 위치")} ${safe(p.detail || "")}</small></span>${repo.home?.id === p.id ? icon("check", 23) : ""}</button>`).join("")}</div><label class="field-label" for="addressDetail">상세주소</label><input id="addressDetail" class="field" maxlength="80" value="${safe(repo.preferences.addressDetail || "")}" placeholder="동·호수 등 (데모용)"><button class="text-link voice-address" data-action="voice-detail">${icon("mic", 19)} 상세주소 음성 입력</button><button class="button secondary full-width" data-action="save-address-detail">상세주소 저장</button><button class="add-card" data-action="pick-map">${uiIcon("locate")} 장소 검색 · 지도에서 선택</button>`,
    "address",
  );
  $("modalContent").querySelector(".address-list").insertAdjacentHTML("beforebegin", `<div class="saved-place-actions"><button class="text-link" data-action="edit-home">${icon("edit",16)} 집 주소 수정</button><button class="text-link" data-action="origin">${icon("pin",16)} 출발 위치 변경</button></div>`);
  applyUxControls();
}
function openPlacePicker() {
  if (
    repo.activeOrder() ||
    repo.payments.transactions.some((p) => p.status === "pending")
  )
    return toast("진행 중인 주문이나 결제 확인을 먼저 마쳐 주세요.");
  placePurpose = "destination";
  PleorderPlaces.open(
    repo.home || repo.liveLocation || repo.origin,
    (place) => {
      repo.savedPlaces.push(place);
      setAddress(place);
    },
  );
}
function openOrigin() {
  if (!uxPolicy.setup) return toast("테스트 출발 위치 변경은 주차 후 이용해 주세요.");
  const point = repo.preferences.locationSource === "manual" ? repo.origin : repo.liveLocation || repo.origin;
  modal("출발 위치", "차량 위치를 사용하거나 테스트할 출발지를 선택하세요.",
    `<div class="origin-current">${icon("pin", 26)}<div><strong>${safe(point.name || "차량 현재 위치")}</strong><p>${safe(point.description || "현재 수신한 차량 위치")}</p><small>${repo.preferences.locationSource === "manual" ? "선택한 출발지 · 차량 GPS와 별도로 사용" : "차량 위치 사용"}</small></div></div><button class="button primary full-width" data-action="pick-origin">검색 · 지도에서 출발지 변경</button><button class="button outlined full-width" data-action="vehicle-origin">차량의 현재 위치 사용</button>`, "origin");
}
function pickOrigin() {
  if (!uxPolicy.setup) return toast("출발 위치 변경은 주차 후 이용해 주세요.");
  placePurpose = "origin";
  PleorderPlaces.open(repo.origin, place=>{
    const r = repo.setSimulationOrigin(place);
    if (r.status !== "success") {toast(r.message); return;}
    close();render();save();map.focusCurrent();toast(r.message);
  }, {title:"출발 위치 선택"});
}
function editSavedHome() {
  if (!uxPolicy.setup || repo.activeOrder() || repo.payments.transactions.some(p=>p.status === "pending")) return toast("진행 중인 주문을 마치고 주차 상태에서 집 주소를 수정해 주세요.");
  placePurpose = "home";
  const home = repo.savedPlaces.find(p=>p.id === "home") || repo.home || repo.origin;
  PleorderPlaces.open(home, place=>{
    const updated = {...place,id:"home",name:"우리 집",placeName:place.name};
    repo.savedPlaces = repo.savedPlaces.filter(p=>p.id !== "home");
    repo.savedPlaces.unshift(updated);
    if (repo.home?.id === "home") setAddress(updated);
    else {close();save();render();}
  }, {title:"집 주소 수정"});
}
function syncVoicePlaceFields() {
  if (modalKind !== "place-picker") return;
  const selected = PleorderPlaces.selected(), pending = repo.destinationSearch;
  if (selected && pending?.places.some(p=>p.lat === selected.lat && p.lng === selected.lng)) $("placeDetail").value = pending.detail || "";
}
function startFieldVoice(id) {
  if (!uxPolicy.transcription) return toast("현재 차량 정책에 따라 음성 내용을 화면에 입력할 수 없어요. Gleo 음성 주문을 이용해 주세요.");
  const field = $(id);
  if (!field) return;
  if (!window.Native) {
    field.focus();
    return toast("차량 앱에서 음성 입력을 사용할 수 있어요.");
  }
  voiceTarget = null;
  if (id === "placeDetail") {
    const place = PleorderPlaces.selected();
    if (!place?.description) return toast("먼저 상세주소를 입력할 장소를 선택해 주세요.");
    repo.destinationSearch = {places:[place], detail:place.detail || "", expiresAt:Date.now()+180000,homeFingerprint:JSON.stringify(repo.home)};
    save();
  }
  toast(id === "placeQuery" ? "Gleo에게 ‘플레오더 배달받을 곳을 강남구청으로 찾아 줘’라고 말씀해 주세요." : "Gleo에게 ‘플레오더 상세주소는 101동 202호’라고 말씀해 주세요.");
  Native.startGleo();
}
function applyUxControls() {
  const restrict = (selector, denied) => document.querySelectorAll(selector).forEach(el => {
    if (denied && !el.hasAttribute("data-ux-disabled")) {
      el.dataset.uxDisabled = String(!!el.disabled);
      el.disabled = true;
      el.setAttribute("aria-description", "현재 차량 정책에 따라 이 기능이 제한됩니다.");
    } else if (!denied && el.hasAttribute("data-ux-disabled")) {
      el.disabled = el.dataset.uxDisabled === "true";
      delete el.dataset.uxDisabled;
      el.removeAttribute("aria-description");
    }
  });
  restrict('#settingsButton,#originButton,[data-action="origin"],[data-action="pick-origin"],[data-action="vehicle-origin"],[data-action="edit-home"],[data-action="register-card"],[data-card-default],[data-card-remove]', !uxPolicy.setup);
  restrict('input:not([type="checkbox"]):not([type="radio"]):not([type="range"]),textarea,#textButton', !uxPolicy.keyboard);
  restrict('#storeSearch', !uxPolicy.keyboard || !uxPolicy.filtering);
  restrict('[data-action="voice-place"],[data-action="voice-detail"]', !uxPolicy.transcription);
  restrict('#deliveryRequest', !uxPolicy.keyboard || !uxPolicy.messages);
  document.documentElement.dataset.uxDo = String(uxPolicy.requiresDo);
  document.documentElement.dataset.uxMask = String(uxPolicy.mask);
}
function applyPreferences() {
  const ui = repo.preferences.ui || {};
  document.documentElement.dataset.theme =
    ui.theme === "dark" ||
    (ui.theme === "system" &&
      matchMedia("(prefers-color-scheme: dark)").matches)
      ? "dark"
      : "light";
  document.documentElement.dataset.motion = ui.reduceMotion || uxPolicy.reduceMotion ? "reduce" : "full";
}
function openSettings() {
  if (!uxPolicy.setup) return toast("현재 차량 정책에 따라 설정을 사용할 수 없어요.");
  const ui = repo.preferences.ui || {};
  modal(
    "앱 설정",
    "플레오더를 편하게 맞춰보세요",
    `<div class="settings-list"><section><h3>내 정보</h3><button class="settings-row" data-action="origin"><span>출발 위치</span><b>${safe(repo.preferences.locationSource === "manual" ? repo.origin.name : "차량 현재 위치")}</b>${icon("chevron", 17)}</button><button class="settings-row" data-action="address"><span>배달받을 곳</span><b>${safe(repo.home?.name || "등록하기")}</b>${icon("chevron", 17)}</button><button class="settings-row" data-action="wallet-settings"><span>결제 카드</span><b>${repo.payments.methods.filter((c) => c.registered).length}개</b>${icon("chevron", 17)}</button><button class="settings-row" data-action="read-destination"><span>차량 내비 연결</span><b>${repo.navigationDestination ? safe(repo.navigationDestination.name) : "목적지 불러오기"}</b>${icon("chevron", 17)}</button></section><section><h3>화면과 움직임</h3><label class="settings-row"><span>화면 테마</span><select class="field" data-setting="theme"><option value="light" ${!ui.theme || ui.theme === "light" ? "selected" : ""}>라이트</option><option value="dark" ${ui.theme === "dark" ? "selected" : ""}>다크</option><option value="system" ${ui.theme === "system" ? "selected" : ""}>시스템 설정</option></select></label><label class="settings-row"><span><strong>모션 줄이기</strong><small>전환과 장식 움직임을 최소화해요</small></span><input type="checkbox" class="settings-switch" data-setting="reduceMotion" ${ui.reduceMotion ? "checked" : ""}></label></section><section><h3>음성 안내</h3><label class="settings-row"><span><strong>주문 진행 음성 알림</strong><small>지연·취소·도착 소식을 읽어드려요</small></span><input type="checkbox" class="settings-switch" data-setting="autoAnnouncements" ${ui.autoAnnouncements !== false ? "checked" : ""}></label><label class="settings-row"><span><strong>음성 명령 예시</strong><small>5초마다 할 수 있는 말을 보여드려요</small></span><input type="checkbox" class="settings-switch" data-setting="voiceExamples" ${ui.voiceExamples !== false ? "checked" : ""}></label></section><section><h3>앱 정보</h3><div class="settings-row"><span>플레오더</span><b>제품 시뮬레이션 · 0.2</b></div><p class="settings-note">주문·결제는 실제로 접수되거나 청구되지 않습니다. 지도와 연결 서비스는 별도로 표시합니다.</p></section></div>`,
    "settings",
  );
}
function setAddress(place) {
  const hadDraft = !!repo.draft;
  const changed = repo.setDeliveryPlace(place);
  if (changed.status !== "success") return toast(changed.message);
  scope = "home";
  repo.preferences.scope = scope;
  save();
  render();
  close();
  map.focusHome();
  if (hadDraft && repo.draft) openCheckout();
}
function openHistory() {
  modal(
    "주문 내역",
    "",
    `${repo.orders.map((o) => `<button class="history-order" data-order="${o.id}"><span class="history-food">${menuArt(repo.menu(o.items[0].menuId))}</span><span><small>${clockText(o.createdAt)} · ${o.mode === "delivery" ? "배달" : "픽업"} · ${{ accepted: "확인 중", cooking: "조리 중", waiting_rider: "기사님 배정 중", delivering: "배달 중", ready: "픽업 준비", contact_needed: "수령 확인", completed: "완료", cancelled: "취소" }[o.stage]}</small><strong>${safe(repo.store(o.storeId).name)}</strong><p>${o.items.map((i) => `${safe(i.name)} ${i.quantity}개`).join(", ")}</p><b>${cash(o.total)}</b></span>${icon("chevron", 20)}</button>`).join("")}${repo.orders.length ? "" : '<p class="empty-label">아직 진행한 주문이 없어요.</p>'}<h3 class="history-heading">최근에 주문한 가게</h3>${repo.recentOrders.map((o) => `<button class="address-option" data-reorder="${o.menuId}"><span class="history-food small">${menuArt(repo.menu(o.menuId))}</span><span><strong>${safe(repo.store(o.storeId).name)}</strong><small>${safe(repo.menu(o.menuId).name)} ${o.quantity}개</small></span><b>다시 주문</b></button>`).join("")}`,
    "history",
  );
}
function openDetails(id) {
  const o = id
    ? repo.orders.find((o) => o.id === id)
    : repo.activeOrder() || repo.orders[0];
  if (!o) return;
  modal(
    "주문 상세",
    o.id,
    `<div class="receipt-store"><h3>${safe(repo.store(o.storeId).name)}</h3><span>${clockText(o.createdAt)} 주문 · ${o.mode === "delivery" ? "배달" : "픽업"}</span></div>${o.proof ? `<button class="receipt-photo" data-proof-order="${o.id}"><img src="${o.proof.image}" alt="문 앞 배달 샘플 사진"><span>${clockText(o.completedAt)} 배달 완료 · 사진 보기</span></button>` : ""}<section class="checkout-section">${o.items.map((i) => `<div class="detail-row"><span>${safe(i.name)} ${i.quantity}개</span><strong>${cash(i.price * i.quantity)}</strong></div>`).join("")}<div class="detail-row"><span>배달팁</span><strong>${cash(o.fee)}</strong></div><div class="detail-row total-row"><span>총 결제금액</span><strong>${cash(o.total)}</strong></div><div class="detail-row"><span>${safe(o.payment?.name)} · ${o.payment?.last4}</span><strong>${o.payment?.status === "refunded" ? "환불 완료" : o.payment?.status === "refund_pending" ? "환불 처리 중" : "결제 완료"}</strong></div></section><section class="checkout-section"><h3>진행 내역</h3>${o.events.map((e) => `<div class="activity-event"><time>${clockText(e.at)}</time><span>${safe(e.message.replaceAll("모의 ", ""))}</span></div>`).join("")}</section><button class="button outlined full-width" data-support-order="${o.id}">메뉴 누락 · 주문 문의</button>`,
    "details",
  );
}
function openProof(id) {
  const o =
    repo.orders.find((o) => o.id === id) ||
    repo.activeOrder() ||
    repo.orders[0];
  if (!o?.proof) return;
  modal(
    "문 앞에 놓아드렸어요",
    `${clockText(o.proof.capturedAt)} 배달 완료`,
    `<figure class="delivery-proof"><img src="${o.proof.image}" alt="문 앞에 놓인 배달 음식 샘플"><figcaption>샘플 사진 · 가상 배달 확인</figcaption></figure><p class="proof-note">${safe(o.request || "문 앞에 놓아주세요")}</p><button class="button outlined full-width" data-support-order="${o.id}">음식이 보이지 않나요?</button>`,
    "proof",
  );
}
function cancelOrder() {
  const o = repo.activeOrder();
  if (!o) return;
  modal(
    "주문을 취소할까요?",
    repo.store(o.storeId).name,
    `<p class="dialog-description">${o.stage === "accepted" ? `${cash(o.total)}을 원래 결제한 카드로 환불 요청합니다.` : "이미 준비를 시작했어요. 매장 확인이 필요할 수 있습니다."}</p><div class="modal-actions"><button class="button outlined" data-action="close">계속 기다릴게요</button><button class="button danger" data-action="confirm-cancel">취소 요청</button></div>`,
    "cancel",
  );
}
function openText() {
  modal(
    "말하듯 입력해 보세요",
    "",
    `<form id="commandForm"><input id="commandInput" class="field command-field" maxlength="500" placeholder="예: 치킨 먹고 싶어" aria-label="주문할 내용" autocomplete="off"><button class="button primary full-width" type="submit">입력하기</button></form>`,
    "text",
  );
  setTimeout(() => $("commandInput")?.focus(), 50);
}
function runCommand(text, voice = false) {
  const previousOrders = new Set(repo.orders.map((o) => o.id));
  lastVoiceAt = Date.now();
  $("voiceTitle").textContent = voice ? "이렇게 들었어요" : "입력한 내용";
  $("voiceStatus").textContent = voice && !uxPolicy.transcription ? "음성 요청을 처리하고 있어요" : text;
  close();
  const r = repo.handleCommand(text);
  respond(r, {
    voice,
    payment:
      !!r.order &&
      r.status === "success" &&
      r.order.payment?.status === "paid" &&
      !previousOrders.has(r.order.id),
  });
}
function applyLocation(lat, lng) {
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180 ||
    (lat === 0 && lng === 0)
  )
    return;
  if (!repo.receiveVehicleLocation({lat,lng})) return;
  map.update(repo);
  render();
  if (awaitingLocationCenter) {
    map.focusCurrent();
    awaitingLocationCenter = false;
  }
}
function centerCurrentLocation() {
  map.focusCurrent();
  if (window.Native && repo.preferences.locationSource !== "manual") {
    awaitingLocationCenter = true;
    Native.requestLocation();
  }
}
function resetDemo() {
  close();
  if(window.Native) Native.stopSpeech();
  clearTimeout(render.searchTimer);
  repo = repo.resetDemo();
  paused=true;rate=10;lastWall=Date.now();lastOrder=null;
  searchQuery='';storeListLimit=30;category='전체';scope='home';cart={};focusedMenu=null;
  listening=false;awaitingLocationCenter=false;voiceTarget=null;navigationDraft=null;
  hintIndex=0;lastVoiceAt=0;walletContext='manage';walletChannel='incar';storeTab='menu';menuLimit=12;showSampleMenus=false;
  $('storeSearch').value='';$('micButton').classList.remove('listening');
  $('voiceTitle').textContent='이렇게 말해 보세요';$('voiceStatus').textContent='“'+hints[0]+'”';
  map.reset();save();render();map.focusHome();
  toast('주문·결제 내역을 지우고 처음 상태로 돌아왔어요.');
}
$('demoReset').onclick=resetDemo;
$("brand").innerHTML = brand();
$("micButton").innerHTML = icon("mic", 28);
$("speakButton").innerHTML = icon("volume", 22);
$("currentLocationButton").innerHTML = uiIcon("locate", 20) + " 현 위치";
$("homeLocationButton").innerHTML = icon("home", 20) + " 배송지";
$("deliveryTab").onclick = () => setMode("delivery");
$("pickupTab").onclick = () => setMode("pickup");
$("ordersTab").onclick = openHistory;
$("walletButton").onclick = () => openWallet("manage");
$("settingsButton").innerHTML = icon("settings", 21) + "<span>설정</span>";
$("settingsButton").onclick = openSettings;
$("originButton").onclick = openOrigin;
$("storeSearch").oninput = (e) => {
  storeListLimit = 30;
  searchQuery = e.target.value;
  clearTimeout(render.searchTimer);
  render.searchTimer = setTimeout(render, 180);
};
$("addressButton").onclick = openAddresses;
$("destinationButton").onclick = openAddresses;
$("textButton").onclick = openText;
$("speakButton").onclick = () => speak(repo.status().voiceText);
$("currentLocationButton").onclick = centerCurrentLocation;
$("homeLocationButton").onclick = () => map.focusHome();
$("timingButton").onclick = () => {
  if (repo.activeOrder())
    return toast("이미 접수한 주문의 시간은 변경할 수 없어요.");
  repo.timing = repo.timing === "soon" ? "arrival" : "soon";
  if (repo.draft) repo.prepare({ items: repo.draft.items });
  render();
};
$("micButton").onclick = () => {
  voiceTarget = null;
  if (!window.Native) return openText();
  if (listening) Native.stopSpeech();
  else Native.startGleo();
};
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.menu) return openStore(b.dataset.menu);
  if (b.dataset.reorder) return openStore(b.dataset.reorder, true);
  if (b.dataset.category) {
    category = b.dataset.category;
    return render();
  }
  if (b.dataset.scope) {
    if (b.dataset.scope === "route") return setMode("pickup");
    scope = b.dataset.scope;
    repo.preferences.scope = scope;
    render();
    return scope === "nearby" ? map.focusCurrent() : map.focusHome();
  }
  if (b.dataset.quantity) {
    cart[b.dataset.id] = Math.max(
      0,
      Math.min(20, (cart[b.dataset.id] || 0) + Number(b.dataset.quantity)),
    );
    return renderStore(repo.store(repo.menu(focusedMenu).storeId));
  }
  if (b.dataset.storeTab) {
    storeTab = b.dataset.storeTab;
    renderStore(repo.store(repo.menu(focusedMenu).storeId));
    return;
  }
  if (b.dataset.external) {
    const url = b.dataset.external;
    if (/^https?:\/\//.test(url)) {
      if (window.Native) Native.openExternal(url);
      else window.open(url, "_blank", "noopener");
    }
    return;
  }
  if (b.dataset.paymentMethod) {
    if (walletContext === "checkout") {
      const r = repo.selectPayment(b.dataset.paymentMethod);
      if (r.status === "fail") return toast(r.message);
      save();
      render();
      return openCheckout();
    }
    const change = repo.selectPayment(b.dataset.paymentMethod);
    if (change.status === "fail") return toast(change.message);
    repo.payments.setDefault(b.dataset.paymentMethod);
    save();
    render();
    return openWallet("manage");
  }
  if (b.dataset.walletChannel)
    return openWallet(walletContext, b.dataset.walletChannel);
  if (b.dataset.cardDefault) {
    const change = repo.selectPayment(b.dataset.cardDefault);
    if (change.status === "fail") return toast(change.message);
    repo.payments.setDefault(b.dataset.cardDefault);
    save();
    return openWallet(walletContext);
  }
  if (b.dataset.cardRemove) {
    if (repo.activeOrder()?.payment?.methodId === b.dataset.cardRemove)
      return toast("진행 중인 주문에 사용한 카드는 완료 후 해제할 수 있어요.");
    const r = repo.payments.unregister(b.dataset.cardRemove);
    toast(r.message);
    save();
    render();
    return openWallet(walletContext);
  }
  if (b.dataset.place)
    return setAddress(repo.savedPlaces.find((p) => p.id === b.dataset.place));
  if (b.dataset.handoff) {
    repo.preferences.handoff = b.dataset.handoff;
    repo.draft.handoff = b.dataset.handoff;
    repo.draft.id = `draft-${repo.clock}-${++repo.counter}`;
    return openCheckout();
  }
  if (b.dataset.order) return openDetails(b.dataset.order);
  if (b.dataset.proofOrder) return openProof(b.dataset.proofOrder);
  if (b.dataset.supportOrder) {
    const r = repo.resolveIssue("missing-item", b.dataset.supportOrder);
    toast(r.message);
    save();
    return close();
  }
  switch (b.dataset.action || b.dataset.command) {
    case "more-stores": storeListLimit += 30; render(); break;
    case "origin": openOrigin(); break;
    case "pick-origin": pickOrigin(); break;
    case "edit-home": editSavedHome(); break;
    case "vehicle-origin":
      toast(repo.useVehicleLocation().message);close();render();save();
      if(window.Native) Native.requestLocation();
      map.focusCurrent();break;
    case "more-menu":
      menuLimit += 12;
      renderStore(repo.store(repo.menu(focusedMenu).storeId));
      break;
    case "sample-menu":
      showSampleMenus = true;
      renderStore(repo.store(repo.menu(focusedMenu).storeId));
      break;
    case "voice-place":
      startFieldVoice("placeQuery");
      break;
    case "voice-detail":
      startFieldVoice(
        modalKind === "place-picker" ? "placeDetail" : "addressDetail",
      );
      break;
    case "wallet-settings":
      openWallet("manage");
      break;
    case "read-destination":
      if (window.Native) Native.requestDestination();
      else toast("차량 앱에서 내비게이션 목적지를 불러올 수 있어요.");
      break;
    case "dismiss-destination":
      repo.dismissedDestination = repo.navigationDestination?.key;
      save();
      render();
      break;
    case "use-destination":
      if (repo.navigationDestination) {
        const place = { ...repo.navigationDestination };
        if (/호텔|리조트|숙소|hotel|resort/i.test(place.name)) {
          repo.preferences.handoff = "hand";
          repo.preferences.request = "로비에서 직접 받을게요";
        }
        if (!repo.savedPlaces.some((p) => p.id === place.id))
          repo.savedPlaces.push(place);
        setAddress(place);
      }
      break;
    case "close":
      close();
      break;
    case "prepare-cart":
      respond(
        repo.prepare({
          items: Object.entries(cart)
            .filter(([, q]) => q > 0)
            .map(([menuId, quantity]) => ({ menuId, quantity })),
        }),
      );
      break;
    case "summary":
      openCheckout();
      break;
    case "choose-card":
      openWallet("checkout");
      break;
    case "register-card":
      openRegistration();
      break;
    case "address":
      openAddresses();
      break;
    case "edit-cart":
      openStore(repo.draft.items[0].menuId);
      break;
    case "reconcile":
      respond(repo.reconcilePayment(), {
        voice: !!window.Native,
        payment: true,
      });
      break;
    case "details":
      openDetails();
      break;
    case "proof":
      openProof();
      break;
    case "cancel":
      cancelOrder();
      break;
    case "confirm-cancel":
      respond(repo.cancel(), { voice: !!window.Native });
      break;
    case "collect":
      respond(repo.collect(), { voice: !!window.Native });
      break;
    case "recipient-ready":
      respond(repo.resolveIssue("recipient-ready"));
      break;
    case "navigate":
      openNavigation();
      break;
    case "confirm-navigation": {
      const request = navigationDraft,
        current = repo.navigationDestination || repo.home;
      if (
        !request ||
        !current ||
        request.home.lat !== current.lat ||
        request.home.lng !== current.lng
      ) {
        toast("차량 목적지가 바뀌었어요. 경로를 다시 확인해 주세요.");
        openNavigation();
        break;
      }
      close();
      if (window.Native) Native.navigate(JSON.stringify(request));
      else toast("차량 앱에서 내비게이션에 전달할 수 있어요.");
      break;
    }
    case "pick-map":
      openPlacePicker();
      break;
    case "save-address-detail":
      { const changed = repo.setDeliveryDetail($("addressDetail").value);
        if (changed.status !== "success") { toast(changed.message); break; } }
      save();
      render();
      if (repo.draft) openCheckout();
      else close();
      break;
    case "reset-filter":
      category = "전체";
      render();
      break;
  }
});
document.addEventListener("change", (e) => {
  if (!e.target.dataset.setting) return;
  repo.preferences.ui ||= {};
  repo.preferences.ui[e.target.dataset.setting] =
    e.target.type === "checkbox" ? e.target.checked : e.target.value;
  applyPreferences();
  save();
});
document.addEventListener("input", (e) => {
  if (e.target.id !== "deliveryRequest" || !repo.draft) return;
  repo.draft.request = e.target.value.trim().slice(0, 120);
  repo.preferences.request = repo.draft.request;
  repo.draft.id = `draft-${repo.clock}-${++repo.counter}`;
  $("paymentSlide")?.dispatchEvent(new Event("order-request-change"));
  save();
});
document.addEventListener("submit", (e) => {
  if (e.target.id === "commandForm") {
    e.preventDefault();
    runCommand($("commandInput").value);
  }
  if (e.target.id === "cardRegistration") {
    e.preventDefault();
    const id = $("cardTemplate").value,
      c = repo.payments.methods.find((c) => c.id === id);
    let r;
    if (c.registered) {
      c.nickname = $("cardNickname").value.trim().slice(0, 24) || c.name;
      r = { status: "success", message: "카드 별명을 저장했어요." };
    } else
      r = repo.payments.register(id, { nickname: $("cardNickname").value });
    toast(r.message);
    if (r.status === "success" && walletContext === "checkout")
      repo.selectPayment(id);
    save();
    render();
    if (r.status === "success" && walletContext === "checkout") openCheckout();
    else openWallet(walletContext, c.provider);
  }
});
$("modal").addEventListener("click", (e) => {
  if (e.target === $("modal")) close();
});
function openNavigation() {
  const o = repo.activeOrder();
  if (!o || o.mode !== "pickup") return;
  const s = repo.store(o.storeId),
    m = map.summary(s.id, repo.navigationDestination || repo.home);
  navigationDraft = JSON.parse(
    JSON.stringify({ store: s, home: repo.navigationDestination || repo.home }),
  );
  modal(
    "매장을 경유해 목적지로 갈까요?",
    s.name,
    `<div class="route-stops"><span>현 위치</span>${icon("arrow")}<strong>${safe(s.name)}</strong>${icon("arrow")}<span>${safe((repo.navigationDestination || repo.home)?.name || "목적지 미설정")}</span></div><div class="detail-row"><span>추가 이동</span><strong>${m.extraMeters != null ? `${(m.extraMeters / 1000).toFixed(1)}km · 약 ${m.extraMinutes}분` : "경로 확인 중"}</strong></div><p class="micro-note">${PleorderMapSdk.state.routeEndpoint ? "네이버 자동차 경로 · 조회 시점 교통 반영" : "도로 경로 기준 · 실시간 교통 미반영"}</p><button class="button primary full-width" data-action="confirm-navigation" ${!repo.home ? "disabled" : ""}>내비게이션에 전달</button>`,
    "navigation",
  );
}
window.Pleorder = {
  openMenu: openStore,
  openStore,
  getState: () => JSON.parse(repo.serialize()),
  persist: save,
  onRouteUpdate: () => {
    render();
  },
  scenario(id) {
    repo = new OrderRepository({ scenario: id });
    repo.preferences.catalogMode = "demo";
    storeListLimit = 30;
    searchQuery = "";
    $("storeSearch").value = "";
    paused = true;
    lastOrder = null;
    lastWall = Date.now();
    scope = "home";
    category = "전체";
    render();
    close();
    map.focusHome();
  },
  advance(minutes) {
    repo.advance(minutes);
    renderOrder();
    map.update(repo);
    save();
  },
  runCommand,
  suspend() { save(); },
  async receiveNative(e) {
    if (e.type === "visibility") { if (!e.visible) save(); pageActive = e.visible; }
    if (e.type === "vehicle-destination") {
      if (repo.updateVehicleDestination(e.destination)) {
        repo.navigationStatus = "ready";
        render();
      }
    }
    if (e.type === "destination-state") {
      repo.navigationStatus = e.status;
      if (e.status === "none") repo.navigationDestination = null;
      if (modalKind === "address") openAddresses();
      render();
    }
    if (e.type === "external-state") {
      const previousHome = JSON.stringify(repo.home);
      repo = OrderRepository.restore(e.state);
      paused = repo.simulation?.paused ?? true;
      rate = repo.simulation?.rate || 10;
      lastOrder = repo.activeOrder()?.id;
      lastWall = Date.now();
      render();
      if (previousHome !== JSON.stringify(repo.home) && ["place-picker", "address"].includes(modalKind)) { close(); map.focusHome(); }
      else syncVoicePlaceFields();
    }
    if (e.type === "speech-ready") {
      listening = true;
      $("micButton").classList.add("listening");
      $("voiceTitle").textContent = "듣고 있어요";
      $("voiceStatus").textContent = "";
    }
    if (e.type === "speech-result") {
      $("voiceStatus").textContent = uxPolicy.transcription ? e.text : "음성 요청을 처리하고 있어요";
      if (e.final) {
        listening = false;
        $("micButton").classList.remove("listening");
        if (voiceTarget) {
          const target = voiceTarget;
          voiceTarget = null;
          if (target.kind === modalKind && $(target.id)) {
            $(target.id).value = e.text;
            $(target.id).dispatchEvent(new Event("input", { bubbles: true }));
            if (target.id === "placeQuery") PleorderPlaces.search(e.text);
            else toast("상세주소를 입력했어요. 내용을 확인해 주세요.");
          }
          return;
        }
        runCommand(e.text, true);
      }
    }
    if (e.type === "speech-end") {
      listening = false;
      $("micButton").classList.remove("listening");
    }
    if (e.type === "speech-error") {
      voiceTarget = null;
      listening = false;
      $("micButton").classList.remove("listening");
      toast(e.message);
      $("voiceTitle").textContent = "다시 말해 주세요";
    }
    if (e.type === "location") applyLocation(e.lat, e.lng);
    if (e.type === "navigation") {
      repo.navigationAccepted = e.success === true;
      save();
      toast(e.message);
    }
    if (e.type === "restriction") {
      uxPolicy = PleorderUx.fromEvent(e);
      $("restriction").hidden = !uxPolicy.blockAll;
      document.querySelector(".app-shell")?.toggleAttribute("inert", uxPolicy.blockAll);
      if (uxPolicy.blockAll || (!uxPolicy.setup && (modalKind === "settings" || modalKind === "registration" || modalKind === "origin" || (modalKind === "place-picker" && placePurpose !== "destination") || (modalKind === "wallet" && walletContext !== "checkout"))) || (uxPolicy.limitedContent && modalKind === "store")) close();
      if (!uxPolicy.filtering) { searchQuery = ""; $("storeSearch").value = ""; }
      if (!uxPolicy.keyboard && document.activeElement?.matches("input,textarea")) document.activeElement.blur();
      if (!uxPolicy.transcription) { voiceTarget = null; $("voiceStatus").textContent = "Gleo로 음성 주문을 이용해 보세요"; }
      if (uxPolicy.reduceMotion) { document.getAnimations().forEach(a=>a.cancel()); map.map?.stop(); }
      render();
    }
    if (e.type === "gleo-action") {
      let r;
      const actionRepo=repo;
      try {
        r = await PleorderVoice.dispatch(actionRepo, e.name, e.params);
      } catch {
        r = { status: "fail", message: "요청을 처리하지 못했어요." };
      }
      if(actionRepo!==repo) {
        if(window.Native)Native.replyAction(JSON.stringify(PleorderCore.gleoCallback(e.name,{status:'fail',message:'데모가 초기화되어 이전 요청을 취소했어요. 다시 말씀해 주세요.'})));
        return;
      }
      startClock(r);
      save();
      render();
      if (r.locationChanged) { scope = "home"; close(); map.focusHome(); }
      else if (r.draft) openCheckout();
      else if (r.order) close();
      else syncVoicePlaceFields();
      const payload = PleorderCore.gleoCallback(e.name, r);
      if (window.Native) Native.replyAction(JSON.stringify(payload));
    }
  },
};
if (!paused && repo.simulation?.savedWall)
  repo.advance(
    Math.min(
      1440,
      Math.max(0, ((Date.now() - repo.simulation.savedWall) * rate) / 60000),
    ),
  );
setInterval(() => {
  if (!pageActive) return;
  const now = Date.now();
  if (!paused) {
    const o = repo.activeOrder() || repo.orders[0],
      count = o?.events.length || 0;
    repo.advance(((now - lastWall) * rate) / 60000);
    const next = repo.activeOrder() || repo.orders[0];
    if (next?.events.length > count) {
      const event = next.events.at(-1);
      if (
        [
          "rider_wait",
          "merchant_cancelled",
          "recipient_absent",
          "pickup_reminder",
          "cooking_delayed",
          "delivered",
          "refunded",
        ].includes(event.kind)
      ) {
        toast(event.message.replaceAll("모의 ", ""));
        if (
          window.Native &&
          !listening &&
          repo.preferences.ui?.autoAnnouncements !== false
        )
          speak(repo.describe(next));
      }
    }
    renderOrder();
    map.update(repo);
    save();
  }
  lastWall = now;
}, 1000);
setInterval(() => {
  if (
    listening ||
    Date.now() - lastVoiceAt < 10000 ||
    repo.preferences.ui?.voiceExamples === false ||
    PleorderMotion.reduced.matches ||
    document.activeElement?.closest(".voice-dock")
  )
    return;
  hintIndex = (hintIndex + 1) % hints.length;
  $("voiceStatus").classList.add("hint-changing");
  setTimeout(() => {
    $("voiceTitle").textContent = "이렇게 말해 보세요";
    $("voiceStatus").textContent = "“" + hints[hintIndex] + "”";
    $("voiceStatus").classList.remove("hint-changing");
  }, 170);
}, 5000);
document.addEventListener("visibilitychange", () => {
  if (!pageActive) return;
  lastWall = Date.now();
  save();
});
render();
PleorderRealCatalog.ready.then(() => {
  if (repo.preferences.catalogMode === "real" && repo.recentOrders[0]?.seeded) {
    const recent = DATA.realStores
      ?.filter((s) => s.name.includes("교촌"))
      .sort(
        (a, b) =>
          PleorderCatalog.meters(repo.home, a) -
          PleorderCatalog.meters(repo.home, b),
      )[0];
    if (recent)
      repo.recentOrders = [
        {
          storeId: recent.id,
          menuId: DATA.menuForStore(recent).id,
          quantity: 1,
          mode: "delivery",
          seeded: true,
        },
      ];
  }
  render();
});
if (window.Native) Native.ready();
