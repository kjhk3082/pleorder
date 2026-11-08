(function (root, factory) {
  const value = factory();
  if (typeof module === "object") module.exports = value;
  else root.PleorderPayments = value;
})(globalThis, () => {
  "use strict";
  class PaymentRepository {
    constructor() {
      this.selected = "test-card";
      this.methods = [
        { id: "test-card", name: "테스트카드", last4: "1234", balance: 120000 },
        { id: "test-pay", name: "모의 페이", last4: "5678", balance: 50000 },
      ];
      this.transactions = [];
      this.counter = 0;
    }
    static restore(value) {
      const p = new PaymentRepository();
      if (
        value &&
        Array.isArray(value.methods) &&
        Array.isArray(value.transactions)
      )
        Object.assign(p, value);
      return p;
    }
    method() {
      return (
        this.methods.find((m) => m.id === this.selected) || this.methods[0]
      );
    }
    select(id) {
      if (
        this.transactions.some((t) => t.status === "pending") ||
        !this.methods.some((m) => m.id === id)
      )
        return false;
      this.selected = id;
      return true;
    }
    charge(key, amount, now, outcome = "success") {
      const method = this.method();
      const existing = this.transactions.find(
        (t) => t.key === key && t.status !== "failed",
      );
      if (existing) return existing;
      if (!Number.isInteger(amount) || amount <= 0)
        throw Error("Invalid payment amount");
      const transaction = {
        id: "PAY-" + ++this.counter,
        key,
        methodId: method.id,
        name: method.name,
        last4: method.last4,
        amount,
        createdAt: now,
        status: "pending",
        simulated: true,
      };
      this.transactions.push(transaction);
      if (outcome === "unknown") return transaction;
      if (
        outcome === "declined" ||
        outcome === "insufficient" ||
        method.balance < amount
      ) {
        transaction.status = "failed";
        transaction.reason =
          outcome === "declined" ? "declined" : "insufficient";
        return transaction;
      }
      method.balance -= amount;
      transaction.status = "paid";
      return transaction;
    }
    reconcile(id, approved) {
      const p = this.transactions.find((t) => t.id === id);
      if (!p || p.status !== "pending") return p;
      if (!approved) {
        p.status = "failed";
        p.reason = "declined";
        return p;
      }
      const method = this.methods.find((m) => m.id === p.methodId);
      if (method.balance < p.amount) {
        p.status = "failed";
        p.reason = "insufficient";
        return p;
      }
      method.balance -= p.amount;
      p.status = "paid";
      return p;
    }
    refund(id, now, delayMinutes = 3) {
      const p = this.transactions.find((t) => t.id === id);
      if (!p || p.status !== "paid") return p;
      p.status = "refund_pending";
      p.refundAt = now + delayMinutes * 60000;
      p.refundAmount = p.amount;
      return p;
    }
    settle(now) {
      for (const p of this.transactions)
        if (p.status === "refund_pending" && now >= p.refundAt) {
          this.methods.find((m) => m.id === p.methodId).balance +=
            p.refundAmount;
          p.status = "refunded";
          p.refundedAt = p.refundAt;
        }
    }
  }
  return { PaymentRepository };
});
