"use strict";
const { OrderRepository, SCENARIOS, DATA } = PleorderCore;
const $ = (id) => document.getElementById(id),
  money = (n) => n.toLocaleString("ko-KR") + "원",
  escapeText = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let saved = null;
try {
  saved = window.Native
    ? Native.loadState()
    : localStorage.getItem("pleorder-v1");
} catch {}
let repo = saved ? OrderRepository.restore(saved) : new OrderRepository(),
  category = "전체",
  paused =
    repo.simulation?.paused ??
    !(
      repo.activeOrder() ||
      repo.payments.transactions.some((p) => p.status === "refund_pending")
    ),
  rate = repo.simulation?.rate || 10,
  menuId = null,
  quantity = 1,
  modalKind = "",
  lastWall = Date.now(),
  listening = false;
const map = new JourneyMap();
let resumedOrderId = repo.activeOrder()?.id;
function startOrderClock(r) {
  if (r.order && r.status === "success" && r.order.id !== resumedOrderId) {
    paused = false;
    rate = 10;
    lastWall = Date.now();
    resumedOrderId = r.order.id;
  }
}
function save() {
  repo.simulation = { paused, rate, savedWall: Date.now() };
  const state = repo.serialize();
  try {
    if (window.Native) Native.saveState(state);
    else localStorage.setItem("pleorder-v1", state);
  } catch {}
}
function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("toast").classList.remove("show"), 5500);
}
function modal(title, subtitle, body, kind = "") {
  modalKind = kind;
  $("modalContent").innerHTML =
    `<header class="modal-head"><div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</div><button class="icon-button" data-command="close" aria-label="닫기">${icon("close")}</button></header><div class="modal-body">${body}</div>`;
  if (!$("modal").open) $("modal").showModal();
}
function close() {
  modalKind = "";
  $("modal").close();
}
function speak(text) {
  if (window.Native) Native.speak(text);
  else toast("실제 음성 출력은 Pleos Android 앱에서 사용할 수 있어요.");
}
function respond(r, { voice = false } = {}) {
  startOrderClock(r);
  save();
  render();
  toast(r.message);
  if (voice) speak(r.voiceText || r.message);
  if (r.payment && r.status !== "success") openPaymentResult(r);
  else if (r.draft) openSummary();
  else if (r.status === "success" && r.order) close();
  return r;
}
function setMode(mode) {
  if (repo.activeOrder()) {
    toast("진행 중인 주문을 먼저 확인해 주세요.");
    return;
  }
  if (repo.draft) {
    const r = repo.prepare({
      items: repo.draft.items,
      mode,
      timing: repo.timing,
    });
    if (r.status === "fail" || !r.draft) {
      toast(r.message);
      return;
    }
  } else repo.mode = mode;
  save();
  render();
}
function card(menu, featured = false) {
  const s = repo.store(menu.storeId),
    available = repo.available(menu);
  return `<button class="restaurant-card ${featured ? "featured" : ""} ${!available ? "card-disabled" : ""}" data-menu="${menu.id}" aria-label="${s.name}, ${menu.name}, ${money(menu.price)}"><div class="food-surface">${foodArt(menu.art)}</div><div class="restaurant-body"><span class="tagline">${featured ? icon("spark", 14) : ""}${featured ? "오늘의 한 끼 추천" : menu.tags[0]}</span><h3>${s.name}</h3>${featured ? `<p class="subtitle">${s.subtitle}</p>` : ""}<p class="menu-line">${menu.name}</p><span class="price">${money(menu.price)}</span><div class="metadata"><span class="rating">★ ${s.rating}</span><span>·</span><span>${repo.mode === "delivery" ? `배달 ${s.prep + 10}–${s.prep + 15}분` : `픽업 준비 ${s.prep}분`}</span>${repo.mode === "pickup" ? '<span class="mini-tag">배달비 0원</span>' : ""}</div></div>${!available ? `<span class="availability">${(repo.scenario.closed || []).includes(s.id) ? "영업 종료" : "품절"}</span>` : ""}</button>`;
}
function render() {
  $("deliveryTab").classList.toggle("active", repo.mode === "delivery");
  $("pickupTab").classList.toggle("active", repo.mode === "pickup");
  $("deliveryTab").setAttribute("aria-selected", repo.mode === "delivery");
  $("pickupTab").setAttribute("aria-selected", repo.mode === "pickup");
  $("orderDot").classList.toggle("has-order", !!repo.activeOrder());
  $("intro").textContent =
    repo.mode === "delivery"
      ? "집에 도착할 때쯤, 따뜻한 저녁도 도착하도록."
      : "가는 길에 들러요. 맛있는 저녁을 기다리지 않도록.";
  $("categories").innerHTML = ["전체", "한식", "치킨", "간편식"]
    .map(
      (c) =>
        `<button class="category ${category === c ? "selected" : ""}" data-category="${c}">${c}</button>`,
    )
    .join("");
  $("timingButton").innerHTML =
    icon("clock", 19) +
    (repo.mode === "pickup"
      ? "가는 길에 픽업"
      : repo.timing === "arrival"
        ? "내 도착에 맞춰"
        : "바로 배달");
  const menus = DATA.menus.filter(
    (m) =>
      m.id !== "bulgogi" &&
      (category === "전체" ||
        (category === "간편식"
          ? ["버거", "샐러드", "일식"].includes(repo.store(m.storeId).category)
          : repo.store(m.storeId).category === category)),
  );
  $("restaurantList").innerHTML = menus
    .map((m, i) => card(m, i === 0))
    .join("");
  $("destinationName").textContent = repo.home
    ? "우리 집으로"
    : "어디로 돌아가세요?";
  $("currentPlace").textContent = repo.liveLocation
    ? "차량 GPS 수신 중"
    : repo.origin.name;
  $("locationButton").textContent = repo.liveLocation
    ? "차량 위치"
    : "데모 위치";
  $("journeyNote").innerHTML =
    icon(repo.mode === "delivery" ? "home" : "route", 23) +
    `<span>${repo.mode === "delivery" ? "배달은 집으로, 나는 익숙한 길로." : "매장을 들른 뒤, 집까지 이어서 안내해요."}<br><small>시간·차량·주문은 시뮬레이션입니다.</small></span>`;
  if (!repo.home)
    $("journeyNote").innerHTML =
      '<button class="button secondary full-width" data-command="set-home">배달받을 데모 집 설정</button>';
  renderOrder();
  map.update(repo);
  save();
}
function renderOrder() {
  $("orderPanel").innerHTML = serviceOrderView(repo);
}
function openMenu(id) {
  menuId = id;
  quantity = 1;
  const m = repo.menu(id),
    s = repo.store(m.storeId);
  map.update(repo, s.id);
  modal(
    s.name,
    "가상 매장 · 주문과 결제는 시뮬레이션입니다.",
    `<div class="modal-food">${foodArt(m.art)}<div><h3>${m.name}</h3><p>${m.desc}</p><strong class="price">${money(m.price)}</strong></div></div>${!repo.available(m) ? '<div class="error-banner">지금 이 메뉴는 주문할 수 없어요. 다른 메뉴를 골라 주세요.</div>' : ""}<div class="detail-row"><span>수량</span><div class="quantity"><button data-command="minus" aria-label="수량 줄이기">${icon("minus")}</button><strong id="quantityValue">1</strong><button data-command="plus" aria-label="수량 늘리기">${icon("plus")}</button></div></div><div class="segmented"><button data-select-mode="delivery" class="${repo.mode === "delivery" ? "selected" : ""}">집으로 배달</button><button data-select-mode="pickup" class="${repo.mode === "pickup" ? "selected" : ""}">매장에서 픽업</button></div><div class="detail-row"><span>준비 시간</span><strong>${s.prep}분 · 모의 예상</strong></div><div class="detail-row"><span>배달비</span><strong id="menuFee">${money(repo.mode === "delivery" ? s.fee : 0)}</strong></div><div class="modal-footer"><button class="button primary" data-command="prepare" ${repo.available(m) ? "" : "disabled"}>주문 내용 확인 ${icon("arrow", 22)}</button></div><p class="hint">실제 결제는 이루어지지 않습니다. 주문 전 합계와 수령 방식을 한 번 더 확인합니다.</p>`,
    "menu",
  );
}
function openSummary() {
  const d = repo.draft;
  if (!d) return;
  modal(
    "이대로 주문할까요?",
    repo.store(d.storeId).name + " · 가상 매장",
    `<div class="segmented"><button data-summary-mode="delivery" class="${d.mode === "delivery" ? "selected" : ""}">집으로 배달</button><button data-summary-mode="pickup" class="${d.mode === "pickup" ? "selected" : ""}">매장에서 픽업</button></div>${d.items.map((i) => `<div class="detail-row"><span>${i.name} ${i.quantity}개</span><strong>${money(i.price * i.quantity)}</strong></div>`).join("")}<div class="detail-row"><span>배달비</span><strong>${money(d.fee)}</strong></div><div class="detail-row"><span>받는 곳</span><strong>${d.mode === "delivery" ? repo.home?.name || "목적지 미설정" : repo.store(d.storeId).name}</strong></div>${d.mode === "delivery" ? `<div class="detail-row"><span>배달 시점</span><strong>${d.timing === "arrival" ? "내 도착에 맞춰" : "준비되는 대로"}</strong></div>` : ""}<button class="payment-card full-width" data-command="payment-method"><span class="payment-card-mark">TEST</span><span><strong>${repo.payments.method().name} · ${repo.payments.method().last4}</strong><p>모의 결제 수단 · 변경</p></span></button><div class="detail-row total-row"><span>총 주문 금액</span><strong>${money(d.total)}</strong></div>${d.storeId === "sodam" && d.items.length === 1 ? '<button class="button secondary full-width" data-command="add-side">같은 매장 메뉴 추가</button>' : ""}<div class="modal-footer"><button class="button outlined" data-command="discard">다시 고르기</button><button class="button primary" data-command="confirm">모의 주문 확정</button></div><p class="hint">공모전 데모입니다. 매장에 주문이 전달되거나 요금이 청구되지 않습니다.</p>`,
    "summary",
  );
}
function navigate() {
  const o = repo.activeOrder();
  if (!o || o.mode !== "pickup") return;
  const s = repo.store(o.storeId),
    summary = map.summary(s.id);
  modal(
    "가는 길에 들를까요?",
    `${s.name}을 들른 뒤 집까지 이어서 안내합니다.`,
    `<div class="route-detail"><strong>현재 위치 → ${s.name} → ${repo.home?.name || "목적지 미설정"}</strong><br>${summary.extraMeters !== null ? `직행보다 ${(summary.extraMeters / 1000).toFixed(1)} km · 약 ${summary.extraMinutes}분 추가` : "경로 정보를 불러오는 중이에요."}<br><small>OSRM 도로 경로 기준 · 실시간 교통 미반영</small></div><p class="muted">${repo.home ? "매장을 경유지로 추가하고 집으로 안내할까요?" : "집이 설정되지 않았어요. 먼저 데모 집을 설정해 주세요."}</p><div class="modal-footer"><button class="button outlined" data-command="close">나중에</button><button class="button primary" data-command="navigation-confirm">${repo.home ? "안내 요청" : "데모 집 설정"}</button></div><p class="hint">내비게이션 SDK의 결과를 확인한 뒤 연결 상태를 표시합니다.</p>`,
    "navigation",
  );
}
function openHistory() {
  modal(
    "주문 내역",
    "배달과 픽업 기록을 한곳에서 확인해요.",
    repo.orders.length
      ? repo.orders
          .map(
            (o) =>
              `<article class="order-history-row"><div class="order-heading"><h3>${repo.store(o.storeId).name}</h3><span class="status-badge">${o.mode === "delivery" ? "배달" : "픽업"}</span></div><p>${o.items.map((i) => i.name + " " + i.quantity + "개").join(", ")}</p><div class="detail-row"><span>${{ accepted: "접수", cooking: "조리 중", delivering: "배달 중", ready: "픽업 준비", completed: "완료", cancelled: "취소" }[o.stage]}</span><strong>${money(o.total)}</strong></div><span class="hint">${o.id} · 모의 주문</span></article>`,
          )
          .join("")
      : '<p class="empty-list">아직 주문 내역이 없어요.<br>오늘의 첫 한 끼를 골라 보세요.</p>',
    "history",
  );
}
function openText() {
  modal(
    "주문을 말하듯 적어 보세요",
    "이 입력은 텍스트 시뮬레이션이며 Gleo 음성 인식과 구분됩니다.",
    `<form id="commandForm"><input id="commandInput" class="text-command" autocomplete="off" maxlength="500" placeholder="비빔밥 두 개, 집으로 배달해 줘" aria-label="테스트할 주문 문장"><button class="button primary full-width" type="submit">명령 실행 ${icon("arrow", 22)}</button></form><div class="command-examples">${["비빔밥 한 개 집으로 배달해 줘", "국밥 두 개 포장해 줘", "픽업으로 바꿔 줘", "이대로 주문", "주문 상태 알려 줘", "아니 주문하지 마"].map((t) => `<button data-example="${t}">“${t}”</button>`).join("")}</div>`,
    "text",
  );
  setTimeout(() => $("commandInput")?.focus(), 50);
}
function executeText(text, voice = false) {
  $("voiceTitle").textContent = voice
    ? "음성을 알아들었어요"
    : "텍스트 명령을 실행했어요";
  $("voiceStatus").textContent = text;
  close();
  respond(repo.handleCommand(text), { voice });
}
function openLab() {
  modal(
    "시나리오 테스트",
    "실제 지도 위 가상의 매장·차량·라이더로 반복 테스트합니다.",
    `<div class="lab-summary"><button data-command="pause">${paused ? "▶ 재생" : "Ⅱ 일시정지"}</button><button data-command="advance">+5분</button><button data-command="speed">${rate}×</button><strong>${Math.floor((repo.clock - repo.startedAt) / 60000)}분 경과</strong><button data-command="reload">재시작 복원</button></div><div class="scenario-grid">${SCENARIOS.map((s) => `<button class="scenario ${repo.scenario.id === s.id ? "current" : ""}" data-scenario="${s.id}"><small>${s.group}</small><strong>${s.name}</strong><p>${s.desc}</p></button>`).join("")}</div><p class="hint">시나리오를 선택하면 현재 모의 주문이 초기화됩니다. 지도 원본에는 가상 매장을 등록하지 않습니다.<br>음성 입력: ${window.Native ? "실제 Pleos ON_DEVICE SDK" : "Android 앱에서 사용 가능"} · Gleo: 별도 Intent 연동 계약 / 승인·대화 왕복 미검증</p>`,
    "lab",
  );
}
function scenario(id) {
  repo = new OrderRepository({ scenario: id });
  paused = true;
  resumedOrderId = null;
  lastWall = Date.now();
  save();
  render();
  close();
  map.fit();
  toast(repo.scenario.desc);
}
$("brand").innerHTML = brand();
$("labButton").innerHTML = icon("lab");
$("micButton").innerHTML = icon("mic", 29);
$("speakButton").innerHTML = icon("volume", 23);
$("mapFit").innerHTML = icon("route", 20);
$("deliveryTab").onclick = () => setMode("delivery");
$("pickupTab").onclick = () => setMode("pickup");
$("ordersTab").onclick = openHistory;
$("labButton").onclick = openLab;
$("textButton").onclick = openText;
$("speakButton").onclick = () => speak(repo.status().voiceText);
$("mapFit").onclick = () => map.fit();
$("micButton").onclick = () => {
  if (!window.Native) {
    openText();
    return;
  }
  if (listening) {
    Native.stopSpeech();
    listening = false;
    $("micButton").classList.remove("listening");
  } else Native.startListening();
};
$("locationButton").onclick = () => {
  if (window.Native) {
    Native.requestLocation();
    toast("차량 위치를 요청했어요. 지도 목적지는 데모 집을 유지합니다.");
  } else
    toast(
      "브라우저는 데모 위치를 사용해요. 차량 GPS는 Android 앱에서 확인할 수 있어요.",
    );
};
$("timingButton").onclick = () => {
  if (repo.mode === "pickup") {
    toast("픽업은 준비 시간과 경유 거리를 함께 확인해 주세요.");
    return;
  }
  repo.timing = repo.timing === "arrival" ? "soon" : "arrival";
  if (repo.draft) repo.prepare({ items: repo.draft.items });
  save();
  render();
};
document.addEventListener("submit", (e) => {
  if (e.target.id === "commandForm") {
    e.preventDefault();
    executeText($("commandInput").value);
  }
});
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.menu) return openMenu(b.dataset.menu);
  if (b.dataset.category) {
    category = b.dataset.category;
    return render();
  }
  if (b.dataset.scenario) return scenario(b.dataset.scenario);
  if (b.dataset.paymentMethod) {
    if (!repo.payments.select(b.dataset.paymentMethod)) {
      toast("결제 결과를 먼저 확인해 주세요.");
      return;
    }
    save();
    render();
    openSummary();
    return;
  }
  if (b.dataset.example) {
    $("commandInput").value = b.dataset.example;
    return;
  }
  if (b.dataset.selectMode) {
    const keep = quantity;
    repo.mode = b.dataset.selectMode;
    openMenu(menuId);
    quantity = keep;
    $("quantityValue").textContent = quantity;
    render();
    return;
  }
  if (b.dataset.summaryMode) {
    respond(
      repo.prepare({ items: repo.draft.items, mode: b.dataset.summaryMode }),
    );
    return;
  }
  switch (b.dataset.command) {
    case "payment-method":
      openPaymentMethods();
      break;
    case "reconcile-payment":
      respond(repo.reconcilePayment(true), { voice: !!window.Native });
      break;
    case "details":
      openOrderDetails();
      break;
    case "support":
      respond(repo.resolveIssue("contact"), { voice: !!window.Native });
      break;
    case "missing-item":
      respond(repo.resolveIssue("missing-item"), { voice: !!window.Native });
      break;
    case "recipient-ready":
      respond(repo.resolveIssue("recipient-ready"), { voice: !!window.Native });
      break;
    case "set-home":
      repo.home = { ...DATA.home };
      save();
      render();
      toast("데모 집을 목적지로 설정했어요.");
      break;
    case "close":
      close();
      break;
    case "plus":
      quantity = Math.min(20, quantity + 1);
      $("quantityValue").textContent = quantity;
      break;
    case "minus":
      quantity = Math.max(1, quantity - 1);
      $("quantityValue").textContent = quantity;
      break;
    case "prepare":
      respond(repo.prepare({ items: [{ menuId, quantity }] }));
      break;
    case "summary":
      openSummary();
      break;
    case "confirm":
      respond(repo.confirm(repo.draft?.id, true), { voice: !!window.Native });
      break;
    case "discard": {
      const r = repo.cancel();
      save();
      render();
      if (!repo.draft) close();
      else toast(r.message);
      break;
    }
    case "add-side": {
      const items = [
        ...repo.draft.items,
        {
          menuId:
            repo.draft.items[0].menuId === "bulgogi" ? "bibimbap" : "bulgogi",
          quantity: 1,
        },
      ];
      respond(repo.prepare({ items }));
      break;
    }
    case "cancel":
      respond(repo.cancel());
      break;
    case "collect":
      respond(repo.collect());
      break;
    case "navigate":
      navigate();
      break;
    case "history":
      openHistory();
      break;
    case "navigation-confirm":
      if (!repo.home) {
        repo.home = { ...DATA.home };
        save();
        render();
        navigate();
        break;
      }
      repo.navigationRequested = true;
      save();
      close();
      if (window.Native)
        Native.navigate(
          JSON.stringify({
            store: repo.store(repo.activeOrder().storeId),
            home: repo.home,
          }),
        );
      else
        toast(
          "경로를 선택했어요. 실제 내장 내비 연결은 Android 앱에서 확인합니다.",
        );
      break;
    case "pause":
      paused = !paused;
      lastWall = Date.now();
      openLab();
      break;
    case "advance":
      repo.advance(5);
      save();
      render();
      openLab();
      break;
    case "speed":
      rate = rate === 1 ? 10 : rate === 10 ? 60 : 1;
      openLab();
      break;
    case "reload":
      save();
      location.reload();
      break;
  }
});
$("modal").addEventListener("click", (e) => {
  if (e.target === $("modal")) close();
});
window.Pleorder = {
  openMenu,
  scenario,
  persist: save,
  getState: () => JSON.parse(repo.serialize()),
  receiveNative(event) {
    if (event.type === "external-state") {
      repo = OrderRepository.restore(event.state);
      paused = repo.simulation?.paused ?? true;
      rate = repo.simulation?.rate || 10;
      resumedOrderId = repo.activeOrder()?.id;
      lastWall = Date.now();
      render();
    }
    if (event.type === "speech-ready") {
      listening = true;
      $("micButton").classList.add("listening");
      $("voiceTitle").textContent = "듣고 있어요";
      $("voiceStatus").textContent = "원하는 메뉴와 배달·픽업을 말해 주세요.";
    }
    if (event.type === "speech-result") {
      $("voiceStatus").textContent = event.text;
      if (event.final) {
        listening = false;
        $("micButton").classList.remove("listening");
        executeText(event.text, true);
      }
    }
    if (event.type === "speech-error") {
      listening = false;
      $("micButton").classList.remove("listening");
      $("voiceTitle").textContent = "다시 말해 주세요";
      $("voiceStatus").textContent = event.message;
      toast(event.message);
    }
    if (event.type === "speech-end") {
      listening = false;
      $("micButton").classList.remove("listening");
    }
    if (event.type === "tts-done")
      $("voiceTitle").textContent = "말로 편하게 주문하세요";
    if (event.type === "location") {
      repo.liveLocation = { lat: event.lat, lng: event.lng };
      render();
    }
    if (event.type === "navigation") {
      repo.navigationAccepted = event.success === true;
      save();
      toast(event.message);
    }
    if (event.type === "restriction") {
      $("restriction").hidden = !event.restricted;
      if (event.restricted) close();
    }
    if (event.type === "gleo-action") {
      let r;
      try {
        r = repo.handleAction(event.name, event.params);
      } catch {
        r = { status: "fail", message: "요청을 처리하지 못했어요." };
      }
      startOrderClock(r);
      save();
      render();
      if (r.payment && r.status !== "success") openPaymentResult(r);
      else if (r.draft) openSummary();
      else if (r.order) close();
      const payload = {
        functionName: event.name,
        status: r.status,
        message:
          r.status === "success"
            ? "The simulated food order action completed."
            : r.status === "asking"
              ? "Please confirm the order details or provide the missing information."
              : "The simulated order action could not be completed.",
        data: JSON.stringify([
          {
            simulated: true,
            detail: r.voiceText || r.message,
            payment: r.payment || r.order?.payment,
            stage: r.order?.stage,
            draftId: r.draft?.id,
            orderId: r.order?.id,
            mode: r.draft?.mode || r.order?.mode,
            total: r.draft?.total || r.order?.total,
          },
        ]),
        mode: "voice",
      };
      if (window.Native) Native.replyAction(JSON.stringify(payload));
    }
  },
};
setInterval(() => {
  const now = Date.now();
  if (!paused) {
    const watched = repo.activeOrder() || repo.orders[0];
    const before = watched?.events.length || 0;
    repo.advance(((now - lastWall) * rate) / 60000);
    const active = repo.activeOrder() || repo.orders[0];
    if (active?.events.length > before) {
      const event = active.events[active.events.length - 1];
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
        toast(event.message);
        if (window.Native && !listening) speak(repo.describe(active));
      }
    }
    save();
    renderOrder();
    map.update(repo);
  }
  lastWall = now;
}, 1000);
if (!paused && repo.simulation?.savedWall) {
  repo.advance(
    Math.min(
      1440,
      Math.max(0, ((Date.now() - repo.simulation.savedWall) * rate) / 60000),
    ),
  );
}
document.addEventListener("visibilitychange", () => {
  lastWall = Date.now();
  save();
});
render();
if (window.Native) Native.ready();

function openPaymentMethods() {
  const blocked = repo.payments.transactions.some(
    (p) => p.status === "pending",
  );
  if (blocked) {
    toast("확인 중인 결제 결과를 먼저 조회해 주세요.");
    return;
  }
  modal(
    "결제 수단",
    "테스트용 결제 수단입니다. 실제 카드가 연결되지 않습니다.",
    `<div class="payment-options">${repo.payments.methods.map((p) => `<button class="${p.id === repo.payments.selected ? "selected" : ""}" data-payment-method="${p.id}"><strong>${p.name} · ${p.last4}</strong><p class="hint">모의 사용 가능 금액 ${money(p.balance)}</p></button>`).join("")}</div>`,
    "payment",
  );
}
function openPaymentResult(r) {
  const pending = r.payment.status === "pending";
  modal(
    pending ? "결제 결과를 확인하고 있어요" : "결제가 승인되지 않았어요",
    "실제 청구가 없는 모의 결제입니다.",
    `<div class="notice-info">${escapeText(r.voiceText || r.message)}</div><div class="modal-footer">${pending ? '<button class="button primary" data-command="reconcile-payment">결제 결과 확인</button>' : '<button class="button primary" data-command="payment-method">다른 결제 수단 선택</button>'}<button class="button outlined" data-command="close">닫기</button></div>`,
    "payment-result",
  );
}
function openOrderDetails() {
  const o = repo.activeOrder() || repo.orders[0];
  if (!o) return;
  const payment = o.payment,
    states = {
      paid: "모의 결제 완료",
      refund_pending: "모의 환불 처리 중",
      refunded: "모의 환불 완료",
    };
  modal(
    "주문 상세",
    o.id + " · " + repo.store(o.storeId).name,
    `<div class="notice-info">${escapeText(repo.describe(o))}</div><div class="detail-row"><span>주문 금액</span><strong>${money(o.total)}</strong></div>${payment ? `<div class="detail-row"><span>${states[payment.status] || payment.status}</span><strong>${payment.name} · ${payment.last4}</strong></div><p class="hint">거래 번호 ${payment.id} · 실제 금융 거래 없음</p>` : ""}<div style="margin-top:18px">${o.events.map((e) => `<div class="activity-event"><span><span class="event-time">시뮬레이션 ${Math.max(0, Math.floor((e.at - repo.startedAt) / 60000))}분</span>${escapeText(e.message)}</span></div>`).join("")}</div>${o.support ? `<div class="notice-info">문의 ${o.support.id} · 확인 대기</div>` : ""}<div class="modal-footer"><button class="button secondary" data-command="${o.stage === "completed" ? "missing-item" : "support"}">${o.stage === "completed" ? "메뉴 누락 문의" : "주문 문의 접수"}</button><button class="button outlined" data-command="close">닫기</button></div>`,
    "details",
  );
}
