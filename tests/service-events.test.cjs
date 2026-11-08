const { test } = require("node:test");
const assert = require("node:assert/strict");
const { OrderRepository } = require("../app/src/main/assets/web/core.js");
function order(s = "delivery-home", mode = "delivery") {
  const r = new OrderRepository({ scenario: s, now: 0 });
  r.prepare({ mode, items: [{ menuId: "bibimbap", quantity: 1 }] });
  return [r, r.confirm(r.draft.id, true)];
}
test("confirmation explains meal, total and simulated card", () => {
  const [r, a] = order();
  assert.match(a.voiceText, /12,500/);
  assert.match(a.voiceText, /1234/);
  assert.match(a.voiceText, /모의 결제/);
  assert.equal(r.orders[0].payment.status, "paid");
});
test("insufficient payment leaves draft intact and makes no order", () => {
  const [r, a] = order("payment-insufficient");
  assert.equal(a.status, "fail");
  assert.ok(r.draft);
  assert.equal(r.orders.length, 0);
  r.payments.select("test-pay");
  assert.equal(r.confirm(r.draft.id, true).status, "success");
});
test("pending payment is neither declared failed nor charged again", () => {
  const [r, a] = order("payment-pending");
  assert.equal(a.status, "asking");
  assert.equal(r.orders.length, 0);
  assert.match(a.voiceText, /확인/);
  const id = r.draft.id;
  r.confirm(id, true);
  assert.equal(r.payments.transactions.length, 1);
  assert.equal(r.reconcilePayment(true).status, "success");
  assert.equal(r.orders.length, 1);
  assert.equal(r.confirm(id, true).order.id, r.orders[0].id);
});
test("merchant rejection cancels order and starts a refund", () => {
  const [r] = order("merchant-reject");
  r.advance(3);
  const o = r.orders[0];
  assert.equal(o.stage, "cancelled");
  assert.equal(o.payment.status, "refund_pending");
  assert.match(r.status().voiceText, /매장/);
  r.advance(5);
  assert.equal(o.payment.status, "refunded");
});
test("courier delay waits instead of claiming delivery started", () => {
  const [r] = order("rider-delay");
  r.advance(16);
  assert.equal(r.orders[0].stage, "waiting_rider");
  assert.match(r.status().voiceText, /라이더/);
  assert.match(r.status().voiceText, /12,500/);
  r.advance(15);
  assert.equal(r.orders[0].stage, "delivering");
});
test("recipient issue waits for explicit availability then completes", () => {
  const [r] = order("recipient-unavailable");
  r.advance(40);
  assert.equal(r.orders[0].stage, "contact_needed");
  assert.equal(r.resolveIssue("recipient-ready").status, "success");
  assert.equal(r.orders[0].stage, "completed");
});
test("late pickup stays ready and raises a collection reminder", () => {
  const [r] = order("pickup-no-show", "pickup");
  r.advance(60);
  assert.equal(r.orders[0].stage, "ready");
  assert.ok(r.orders[0].events.some((e) => e.kind === "pickup_reminder"));
  assert.equal(r.collect().status, "success");
});
test("post delivery missing item creates support record without altering full refund amount", () => {
  const [r] = order();
  r.advance(60);
  const result = r.resolveIssue("missing-item");
  assert.equal(result.status, "asking");
  assert.equal(r.orders[0].support.status, "open");
  assert.equal(r.orders[0].payment.status, "paid");
});
test("cancellation refunds once and rich status names its state", () => {
  const [r] = order();
  r.cancel();
  assert.equal(r.orders[0].payment.status, "refund_pending");
  assert.match(r.status().voiceText, /환불/);
  r.advance(5);
  assert.equal(r.payments.methods[0].balance, 120000);
});
test("pending payment cannot be abandoned by changing draft or payment method", () => {
  const [r] = order("payment-pending");
  const id = r.draft.id;
  r.prepare({ mode: "pickup", items: [{ menuId: "soup", quantity: 1 }] });
  assert.equal(r.draft.id, id);
  r.payments.select("test-pay");
  r.confirm(id, true);
  assert.equal(r.payments.transactions.length, 1);
  assert.equal(r.orders.length, 0);
});
test("late payment reconciliation cannot orphan an approved charge", () => {
  const [r] = order("payment-pending");
  r.advance(12);
  assert.equal(r.reconcilePayment(true).status, "success");
  assert.equal(r.orders.length, 1);
});
test("changing selected method cannot duplicate a reconciled payment", () => {
  const [r] = order("payment-pending");
  r.payments.selected = "test-pay";
  r.reconcilePayment(true);
  assert.equal(r.payments.transactions.length, 1);
  assert.equal(r.payments.methods[1].balance, 50000);
  assert.equal(r.orders[0].payment.methodId, "test-card");
});
test("negative speech never authorizes payment or reports receipt", () => {
  const [r] = order("payment-pending");
  r.handleCommand("결제 확인하지 마");
  assert.equal(r.orders.length, 0);
  const [p] = order("pickup-no-show", "pickup");
  p.advance(60);
  p.handleCommand("아직 못 받았어요");
  assert.equal(p.orders[0].stage, "ready");
  const [d] = order("recipient-unavailable");
  d.advance(60);
  d.handleCommand("지금 받을 수 없어요");
  assert.equal(d.orders[0].stage, "contact_needed");
});
