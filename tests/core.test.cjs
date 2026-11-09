const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  OrderRepository,
  SCENARIOS,
} = require("../app/src/main/assets/web/core.js");
const make = (scenario = "delivery-home") =>
  new OrderRepository({ scenario, now: 0 });
const draft = (r, mode = "delivery", extra = {}) =>
  r.prepare({ items: [{ menuId: "bibimbap", quantity: 1 }], mode, ...extra });
test("delivery and pickup remain explicit, and draft never submits an order", () => {
  for (const mode of ["delivery", "pickup"]) {
    const r = make();
    const d = draft(r, mode);
    assert.equal(d.status, "asking");
    assert.equal(r.orders.length, 0);
    assert.equal(r.draft.mode, mode);
    const o = r.confirm(r.draft.id, true);
    assert.equal(o.status, "success");
    assert.equal(r.orders[0].mode, mode);
  }
});
test("delivery includes fee and pickup does not", () => {
  const r = make();
  draft(r);
  assert.equal(r.draft.total, 12500);
  draft(r, "pickup");
  assert.equal(r.draft.total, 10500);
});
test("invalid quantity and mode never create a draft", () => {
  for (const quantity of [0, -1, 1.1, NaN, 21, "two"]) {
    const r = make();
    assert.equal(
      r.prepare({ items: [{ menuId: "bibimbap", quantity }], mode: "delivery" })
        .status,
      "fail",
    );
    assert.equal(r.draft, null);
  }
  assert.equal(draft(make(), "teleport").status, "fail");
});
test("missing destination blocks delivery but not pickup", () => {
  const r = make("no-destination");
  assert.equal(draft(r).status, "asking");
  assert.equal(draft(r, "pickup").status, "asking");
  assert.equal(r.draft.mode, "pickup");
});
test("old draft is invalid after edits, and duplicate confirmation is idempotent", () => {
  const r = make();
  draft(r);
  const old = r.draft.id;
  draft(r, "pickup");
  assert.equal(r.confirm(old, true).status, "fail");
  const id = r.draft.id;
  const first = r.confirm(id, true);
  const second = r.confirm(id, true);
  assert.equal(first.order.id, second.order.id);
  assert.equal(r.orders.length, 1);
});
test("negative confirmation cannot submit; a stale draft expires", () => {
  const r = make();
  draft(r);
  const id = r.draft.id;
  assert.equal(r.confirm(id, false).status, "asking");
  r.advance(11);
  assert.equal(r.confirm(id, true).status, "fail");
});
test("pickup stops at ready until explicit collection", () => {
  const r = make();
  draft(r, "pickup");
  r.confirm(r.draft.id, true);
  r.advance(90);
  assert.equal(r.activeOrder().stage, "ready");
  assert.equal(r.collect().status, "success");
  assert.equal(r.orders[0].stage, "completed");
});
test("delivery completes through cooking and delivering", () => {
  const r = make();
  draft(r);
  r.confirm(r.draft.id, true);
  r.advance(3);
  assert.equal(r.activeOrder().stage, "cooking");
  r.advance(12);
  assert.equal(r.activeOrder().stage, "delivering");
  r.advance(20);
  assert.equal(r.activeOrder(), null);
  assert.equal(r.orders[0].stage, "completed");
});
test("cancel before cooking succeeds, after cooking is explicitly rejected", () => {
  const r = make();
  draft(r);
  r.confirm(r.draft.id, true);
  assert.equal(r.cancel().status, "success");
  r.advance(100);
  assert.equal(r.orders[0].stage, "cancelled");
  const late = make();
  draft(late);
  late.confirm(late.draft.id, true);
  late.advance(3);
  assert.equal(late.cancel().status, "fail");
});
test("order restore preserves clock, stage and idempotency", () => {
  const r = make();
  draft(r);
  const id = r.draft.id;
  r.confirm(id, true);
  r.advance(4);
  const restored = OrderRepository.restore(r.serialize());
  assert.equal(restored.activeOrder().stage, "cooking");
  assert.equal(restored.clock, r.clock);
  assert.equal(restored.confirm(id, true).order.id, r.orders[0].id);
});
test("unavailable menus, closed shop and delivery range produce no order", () => {
  for (const scenario of ["sold-out", "closed", "outside-area"]) {
    const r = make(scenario);
    assert.equal(draft(r).status, "fail");
    assert.equal(r.orders.length, 0);
  }
});
test("scheduled delivery never starts earlier than required", () => {
  const r = make("delivery-arrival");
  draft(r, "delivery", { timing: "arrival" });
  r.confirm(r.draft.id, true);
  const o = r.orders[0];
  assert.ok(o.startAt > r.clock);
  assert.equal(o.stage, "reserved");
  r.advance(2);
  assert.equal(o.stage, "reserved");
});
test("voice negation takes precedence over confirmation", () => {
  const r = make();
  draft(r);
  assert.notEqual(r.handleCommand("아니 주문하지 마").status, "success");
  assert.equal(r.orders.length, 0);
  assert.equal(r.draft, null);
});
test("voice creates a draft with requested mode and quantity", () => {
  const r = make();
  r.handleCommand("비빔밥 두 개 포장해 줘");
  assert.equal(r.draft.mode, "pickup");
  assert.equal(r.draft.items[0].quantity, 2);
  assert.equal(r.orders.length, 0);
});
test("voice unknown text never silently picks a meal", () => {
  const r = make();
  assert.equal(r.handleCommand("안녕하세요 오늘 날씨가 어때").status, "asking");
  assert.equal(r.draft, null);
});
test("changing delivery to pickup preserves selected meal and invalidates ID", () => {
  const r = make();
  draft(r);
  const id = r.draft.id;
  r.handleCommand("픽업으로 바꿔 줘");
  assert.equal(r.draft.mode, "pickup");
  assert.notEqual(r.draft.id, id);
});
test("Gleo actions share the same order use cases", () => {
  const r = make();
  assert.equal(
    r.handleAction("PREPARE_FOOD_ORDER", {
      query: "비빔밥",
      fulfillment: "delivery",
      quantity: 1,
    }).status,
    "asking",
  );
  const id = r.draft.id;
  assert.equal(
    r.handleAction("CONFIRM_FOOD_ORDER", { draftId: id, confirmation: true })
      .status,
    "success",
  );
  assert.equal(r.handleAction("GET_FOOD_ORDER_STATUS", {}).status, "success");
});
test("Gleo rejects invalid parameters; a separate draft can coexist with a paid order", () => {
  const r = make();
  assert.equal(
    r.handleAction("PREPARE_FOOD_ORDER", {
      query: "x".repeat(501),
      fulfillment: "delivery",
    }).status,
    "fail",
  );
  draft(r);
  r.confirm(r.draft.id, true);
  assert.equal(draft(r).status, "asking");
  assert.equal(r.orders.length, 1);
});
test("delay moves delivery estimate but does not rewind completed orders", () => {
  const r = make("delay");
  draft(r);
  r.confirm(r.draft.id, true);
  assert.ok(r.orders[0].delayMinutes > 0);
  r.advance(200);
  r.advance(1);
  assert.equal(r.orders[0].stage, "completed");
});
test("scenario catalog covers both modes and recoverable failures", () => {
  assert.ok(SCENARIOS.length >= 14);
  for (const id of [
    "delivery-home",
    "delivery-arrival",
    "pickup-route",
    "pickup-direct",
    "sold-out",
    "closed",
    "outside-area",
    "delay",
    "offline-map",
    "no-destination",
    "speech-retry",
    "cancel-early",
    "cancel-late",
    "family-order",
  ])
    assert.ok(
      SCENARIOS.some((s) => s.id === id),
      id,
    );
});
test("specific meal words take priority over a shorter alias", () => {
  const r = make();
  r.handleCommand("치킨 샐러드 한 개 배달해 줘");
  assert.equal(r.draft.items[0].menuId, "salad");
  r.handleCommand("샐러드 말고 치킨으로 주문해 줘");
  assert.equal(r.draft.items[0].menuId, "chicken");
});
