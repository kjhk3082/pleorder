(function (root, factory) {
  const value = factory();
  if (typeof module === "object") module.exports = value;
  else root.PleorderPayments = value;
})(globalThis, () => {
  "use strict";
  const CARD_TEMPLATES = [
    {
      id: "test-card",
      label: "A",
      name: "현대카드 M",
      last4: "1234",
      balance: 120000,
      provider: "incar",
      decision: "approve",
      color: "navy",
      registered: true,
    },
    {
      id: "limit-card",
      label: "B",
      name: "배달앱 체크카드",
      last4: "5678",
      balance: 0,
      provider: "delivery",
      decision: "approve",
      color: "silver",
      registered: true,
    },
    {
      id: "test-pay",
      label: "C",
      name: "배달앱 신용카드",
      last4: "9012",
      balance: 50000,
      provider: "delivery",
      decision: "review_decline",
      color: "sage",
      registered: true,
    },
  ];
  class PaymentRepository {
    constructor() {
      this.selected = "test-card";
      this.methods = CARD_TEMPLATES.map((c) => ({ ...c }));
      this.defaultId = "test-card";
      this.transactions = [];
      this.counter = 0;
    }
    static restore(value) {
      const p = new PaymentRepository();
      if (
        value &&
        Array.isArray(value.methods) &&
        Array.isArray(value.transactions)
      ) {
        Object.assign(p, value);
        p.methods = CARD_TEMPLATES.map((c) => ({
          ...c,
          ...value.methods.find((m) => m.id === c.id),
          label: c.label,
          provider: c.provider,
          decision: c.decision,
          registered:
            value.methods.find((m) => m.id === c.id)?.registered !== false,
        }));
      }
      return p;
    }
    method() {
      return (
        this.methods.find((m) => m.id === this.selected && m.registered) ||
        this.methods.find((m) => m.registered) ||
        null
      );
    }
    select(id) {
      if (
        this.transactions.some((t) => t.status === "pending") ||
        !this.methods.some((m) => m.id === id && m.registered)
      )
        return false;
      this.selected = id;
      return true;
    }
    setDefault(id) {
      if (!this.select(id)) return false;
      this.defaultId = id;
      return true;
    }
    register(id, options = {}) {
      const template = CARD_TEMPLATES.find((c) => c.id === id);
      if (!template || options.number)
        return {
          status: "fail",
          message: "준비된 테스트 카드만 등록할 수 있어요.",
        };
      let card = this.methods.find((c) => c.id === id);
      if (card?.registered)
        return { status: "asking", message: "이미 등록된 카드예요." };
      if (!card) {
        card = { ...template };
        this.methods.push(card);
      }
      card.registered = true;
      card.nickname = String(options.nickname || card.name)
        .trim()
        .slice(0, 24);
      if (!this.selected) this.selected = id;
      if (!this.methods.some((c) => c.id === this.defaultId && c.registered))
        this.defaultId = id;
      return { status: "success", message: "테스트 카드를 등록했어요.", card };
    }
    unregister(id) {
      const card = this.methods.find((c) => c.id === id);
      if (!card) return { status: "fail", message: "등록된 카드가 아니에요." };
      if (
        this.transactions.some(
          (p) =>
            p.methodId === id &&
            ["pending", "refund_pending"].includes(p.status),
        )
      )
        return {
          status: "fail",
          message: "결제 또는 환불 확인 중인 카드는 해제할 수 없어요.",
        };
      card.registered = false;
      if (this.selected === id)
        this.selected = this.methods.find((c) => c.registered)?.id || null;
      if (this.defaultId === id) this.defaultId = this.selected;
      return { status: "success", message: "카드 등록을 해제했어요." };
    }
    charge(key, amount, now, outcome = "auto") {
      const method = this.method();
      const existing = this.transactions.find(
        (t) => t.key === key && t.status !== "failed",
      );
      if (existing) return existing;
      if (!method) return { status: "failed", reason: "no_method", amount };
      if (!Number.isInteger(amount) || amount <= 0)
        throw Error("Invalid payment amount");
      const transaction = {
        id: "PAY-" + ++this.counter,
        key,
        methodId: method.id,
        name: method.name,
        last4: method.last4,
        provider: method.provider,
        amount,
        createdAt: now,
        status: "pending",
        simulated: true,
      };
      this.transactions.push(transaction);
      if (outcome === "auto" && method.decision === "review_decline") {
        transaction.resolution = "declined";
        return transaction;
      }
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
      if (p.resolution === "declined" || approved === false) {
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
  return { PaymentRepository, CARD_TEMPLATES };
});
