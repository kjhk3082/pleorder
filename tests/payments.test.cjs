const { test } = require("node:test");
const assert = require("node:assert/strict");
const { PaymentRepository } = require("../app/src/main/assets/web/payments.js");
test("payment approval has an idempotent transaction and identifiable test method", () => {
  const p = new PaymentRepository();
  const a = p.charge("draft-1", 12500, 0);
  const b = p.charge("draft-1", 12500, 0);
  assert.equal(a.id, b.id);
  assert.equal(a.status, "paid");
  assert.equal(p.methods[0].balance, 107500);
  assert.equal(a.last4, "1234");
});
test("insufficient funds never debit balance", () => {
  const p = new PaymentRepository();
  const balance = p.methods[0].balance;
  const r = p.charge("a", balance + 1, 0);
  assert.equal(r.status, "failed");
  assert.equal(r.reason, "insufficient");
  assert.equal(p.methods[0].balance, balance);
});
test("pending payment never gets debited twice during reconciliation", () => {
  const p = new PaymentRepository();
  const a = p.charge("a", 12500, 0, "unknown");
  assert.equal(a.status, "pending");
  assert.equal(p.methods[0].balance, 120000);
  p.reconcile(a.id, true);
  p.reconcile(a.id, true);
  assert.equal(p.methods[0].balance, 107500);
});
test("refund remains pending then completes exactly once", () => {
  const p = new PaymentRepository();
  const a = p.charge("a", 12500, 0);
  p.refund(a.id, 0);
  assert.equal(a.status, "refund_pending");
  assert.equal(p.methods[0].balance, 107500);
  p.settle(5 * 60000);
  p.settle(10 * 60000);
  assert.equal(a.status, "refunded");
  assert.equal(p.methods[0].balance, 120000);
});
test("switching method can recover from a decline without reusing failed charge", () => {
  const p = new PaymentRepository();
  assert.equal(p.charge("a", 10000, 0, "declined").status, "failed");
  p.select("test-card");
  assert.equal(p.charge("a", 10000, 0).status, "paid");
  assert.equal(p.method().balance, 110000);
});
test("restoring transactions preserves idempotency", () => {
  const p = new PaymentRepository();
  p.charge("a", 12500, 0);
  const r = PaymentRepository.restore(JSON.parse(JSON.stringify(p)));
  r.charge("a", 12500, 0);
  assert.equal(r.methods[0].balance, 107500);
});
