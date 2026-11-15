const { test } = require("node:test");
const assert = require("node:assert/strict");
const { OrderRepository } = require("../app/src/main/assets/web/core.js");
const { PaymentRepository } = require("../app/src/main/assets/web/payments.js");
const { SlideConfirmation } = require("../app/src/main/assets/web/checkout.js");
test("prepared cards drive success, limit failure and issuer review without choosing a scenario", () => {
  const p = new PaymentRepository();
  assert.equal(p.methods.length, 3);
  p.select("limit-card");
  assert.equal(p.charge("b", 12500, 0).reason, "insufficient");
  p.select("test-pay");
  const c = p.charge("c", 12500, 0);
  assert.equal(c.status, "pending");
  p.reconcile(c.id);
  assert.equal(c.status, "failed");
  p.select("test-card");
  assert.equal(p.charge("a", 12500, 0).status, "paid");
});
test("card management permits removal and re-registration of prepared card only", () => {
  const p = new PaymentRepository();
  assert.equal(p.unregister("limit-card").status, "success");
  assert.equal(p.methods.find((m) => m.id === "limit-card").registered, false);
  assert.equal(
    p.register("limit-card", { nickname: "장보기 카드" }).status,
    "success",
  );
  assert.equal(
    p.methods.find((m) => m.id === "limit-card").nickname,
    "장보기 카드",
  );
  assert.equal(
    p.register("real-pan", { number: "4111111111111111" }).status,
    "fail",
  );
});
test("empty wallet does not charge and can recover by registering a test card", () => {
  const p = new PaymentRepository();
  for (const c of [...p.methods]) p.unregister(c.id);
  assert.equal(p.method(), null);
  assert.equal(p.charge("empty", 10000, 0).reason, "no_method");
  p.register("test-card", {});
  assert.equal(p.charge("ok", 10000, 0).status, "paid");
});
test("sliding halfway never confirms, full deliberate drag confirms once", () => {
  let n = 0;
  const s = new SlideConfirmation(() => n++);
  s.begin(0, 300);
  s.move(120);
  assert.equal(s.release(), false);
  assert.equal(n, 0);
  s.begin(0, 300);
  s.move(295);
  assert.equal(s.release(), true);
  s.release();
  assert.equal(n, 1);
});
test("wanting chicken proposes recent store instead of placing an order", () => {
  const r = new OrderRepository({ now: 0 });
  const a = r.handleCommand("나 치킨 먹고 싶어");
  assert.equal(a.status, "asking");
  assert.equal(a.recommendation.storeId, "crisp");
  assert.match(a.message, /최근|교촌/);
  assert.equal(r.draft, null);
  assert.equal(r.orders.length, 0);
  const b = r.handleCommand("응 그걸로");
  assert.ok(b.draft);
  assert.equal(r.orders.length, 0);
});
test("delivery suggestions rank home distance and pickup suggestions use current location", () => {
  const r = new OrderRepository({ now: 0 });
  const home = r.recommend("", "home");
  const nearby = r.recommend("", "nearby");
  assert.equal(home[0].store.id, "green");
  assert.equal(nearby[0].store.id, "burger");
});
test("ordinary agreement after draft does not authorize payment", () => {
  const r = new OrderRepository({ now: 0 });
  r.handleCommand("비빔밥 한 개 배달해 줘");
  r.handleCommand("네");
  assert.equal(r.orders.length, 0);
  const result = r.handleCommand("결제 승인");
  assert.equal(result.status, "success");
  assert.equal(r.orders.length, 1);
});
test("door delivery records its actual completion instant and sample proof", () => {
  const r = new OrderRepository({ now: 0 });
  r.prepare({
    items: [{ menuId: "bibimbap", quantity: 1 }],
    mode: "delivery",
    handoff: "door",
  });
  r.confirm(r.draft.id, true);
  const due = r.orders[0].deliveryAt;
  r.advance(100);
  assert.equal(r.orders[0].completedAt, due);
  assert.equal(r.orders[0].proof.sample, true);
  assert.ok(r.orders[0].proof.image);
  assert.equal(r.orders[0].proof.capturedAt, due);
});
test("pickup completion has timestamp but never invents doorstep proof", () => {
  const r = new OrderRepository({ now: 0 });
  r.prepare({ items: [{ menuId: "bibimbap", quantity: 1 }], mode: "pickup" });
  r.confirm(r.draft.id, true);
  r.advance(20);
  r.collect();
  assert.equal(r.orders[0].completedAt, r.clock);
  assert.equal(r.orders[0].proof, undefined);
});

test("live arrival routing rejects stale origin metrics before any debit", () => {
  const r = new OrderRepository({ now: 0 });
  r.liveLocation = { ...r.origin };
  const key = [r.origin, r.home]
    .map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`)
    .join(";");
  r.routeMetrics = {
    home: { key, etaAt: 3600000, distance: 5000, duration: 3600 },
  };
  r.prepare({
    items: [{ menuId: "bibimbap", quantity: 1 }],
    timing: "arrival",
  });
  const id = r.draft.id;
  r.liveLocation.lat += 0.01;
  assert.equal(r.confirm(id, true).status, "asking");
  assert.equal(r.payments.transactions.length, 0);
  assert.equal(r.orders.length, 0);
});
test("voice delivery changes invalidate previous payment approval and cannot edit a pending charge", () => {
  const r = new OrderRepository({ now: 0 });
  r.prepare({ items: [{ menuId: "bibimbap", quantity: 1 }] });
  const old = r.draft.id;
  r.handleCommand("문 앞에 놓아 줘");
  assert.notEqual(r.draft.id, old);
  assert.equal(r.confirm(old, true).status, "fail");
  r.selectPayment("test-pay");
  r.confirm(r.draft.id, true);
  const pendingId = r.draft.id;
  r.handleCommand("문 앞에 놓아 줘");
  assert.equal(r.draft.id, pendingId);
});

test("empty wallet voice fallback asks for registration without throwing", () => {
  const r = new OrderRepository({ now: 0 });
  for (const c of [...r.payments.methods]) r.payments.unregister(c.id);
  const result = r.handleCommand("다른 카드로 바꿔 줘");
  assert.equal(result.open, "registration");
  assert.equal(r.orders.length, 0);
});
test("delayed hand receipt records confirmation time, not earlier delivery ETA", () => {
  const r = new OrderRepository({ now: 0 });
  r.prepare({ items: [{ menuId: "bibimbap", quantity: 1 }], handoff: "hand" });
  r.confirm(r.draft.id, true);
  r.advance(60);
  assert.equal(r.orders[0].stage, "contact_needed");
  r.resolveIssue("recipient-ready");
  assert.equal(r.orders[0].completedAt, r.clock);
  assert.equal(
    r.orders[0].events.find((e) => e.kind === "delivered").at,
    r.clock,
  );
});
test("checkout estimate includes natural merchant and rider delays", () => {
  const r = new OrderRepository({ now: 0 });
  r.prepare({ items: [{ menuId: "burger", quantity: 1 }] });
  const estimate = r.estimateOrder();
  const result = r.confirm(r.draft.id, true);
  assert.equal(estimate.deliveryAt, result.order.deliveryAt);
});

test("a cancelled one-off card choice returns to default on the next order", () => {
  const r = new OrderRepository({ now: 0 });
  r.prepare({ items: [{ menuId: "bibimbap", quantity: 1 }] });
  r.selectPayment("limit-card");
  r.cancel();
  r.prepare({ items: [{ menuId: "bibimbap", quantity: 1 }] });
  assert.equal(r.payments.selected, "test-card");
  r.cancel();
  r.selectPayment("limit-card");
  r.prepare({ items: [{ menuId: "bibimbap", quantity: 1 }] });
  assert.equal(r.payments.selected, "limit-card");
});

test("waypoint facts expose current-to-store leg and added route distance/time separately", () => {
  const { routeFacts } = require("../app/src/main/assets/web/catalog.js");
  const f = routeFacts(
    { distance: 3000, duration: 360 },
    {
      distance: 4200,
      duration: 500,
      legs: [
        { distance: 1800, duration: 185 },
        { distance: 2400, duration: 315 },
      ],
    },
  );
  assert.deepEqual(f, {
    meters: 1800,
    minutes: 4,
    extraMeters: 1200,
    extraMinutes: 3,
  });
  assert.equal(routeFacts(null, null).meters, null);
  assert.equal(
    routeFacts(
      { distance: 3000, duration: 360 },
      {
        distance: 2990,
        duration: 359,
        legs: [{ distance: 100, duration: 10 }],
      },
    ).extraMinutes,
    0,
  );
});

test("vehicle destination is a proposal and never silently changes delivery address", () => {
  const r = new OrderRepository({ now: 0 });
  const original = r.home;
  assert.equal(
    r.updateVehicleDestination({
      name: "레이크 호텔",
      lat: 37.51,
      lng: 127.1,
      description: "잠실동",
    }),
    true,
  );
  assert.equal(r.home, original);
  assert.equal(r.navigationDestination.name, "레이크 호텔");
  assert.equal(r.updateVehicleDestination({ lat: 0, lng: 0 }), false);
  assert.equal(r.navigationDestination.name, "레이크 호텔");
});

test("named restaurant searches do not substitute a competing brand", () => {
  const { rank } = require("../app/src/main/assets/web/catalog.js");
  const stores = [
    { id: "a", name: "통통닭", lat: 37.5, lng: 127 },
    { id: "b", name: "교촌치킨 잠실점", lat: 37.501, lng: 127 },
  ];
  const data = {
    stores,
    menus: stores.map((s) => ({ id: s.id, storeId: s.id, aliases: ["치킨"] })),
  };
  const result = rank(data, {
    query: "교촌치킨 배달해 줘",
    home: { lat: 37.5, lng: 127 },
    origin: { lat: 37.5, lng: 127 },
  });
  assert.deepEqual(
    result.map((r) => r.store.id),
    ["b"],
  );
});
test("voice destination searches ask for a place without changing the address", () => {
  const r = new OrderRepository({ now: 0 });
  const home = r.home;
  const a = r.handleCommand("목적지 롯데호텔 서울로 설정해 줘");
  assert.equal(a.open, "place-search");
  assert.equal(a.query, "롯데호텔 서울");
  assert.equal(r.home, home);
  r.prepare({ items: [{ menuId: "bibimbap", quantity: 1 }] });
  const id = r.draft.id;
  assert.equal(r.handleCommand("상세주소는 101동 1002호").status, "asking");
  assert.equal(r.draft.id, id);
  r.handleCommand("상세주소 확인");
  assert.equal(r.draft.address.detail, "101동 1002호");
  assert.notEqual(r.draft.id, id);
});

test("delivery narration keeps the destination saved on the order", () => {
  const r = new OrderRepository();
  r.setDeliveryPlace({ ...r.home, id: "hotel", name: "테스트 호텔" });
  r.prepare({ items: [{ menuId: "bibimbap", quantity: 1 }], mode: "delivery" });
  r.confirm(r.draft.id, true);
  const order = r.orders[0];
  assert.match(r.describe(order), /테스트 호텔까지 배달/);
  order.stage = "delivering";
  assert.match(r.describe(order), /테스트 호텔까지/);
});
