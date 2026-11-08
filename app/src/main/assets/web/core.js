(function (root, factory) {
  const value = factory(
    typeof module === "object" ? require("./data.js") : root.PleorderData,
    typeof module === "object"
      ? require("./payments.js")
      : root.PleorderPayments,
  );
  if (typeof module === "object") module.exports = value;
  else root.PleorderCore = value;
})(globalThis, (DATA, PAYMENT) => {
  "use strict";
  const { PaymentRepository } = PAYMENT;
  const MINUTE = 60000;
  const SCENARIOS = [
    {
      id: "delivery-home",
      name: "퇴근길 집으로 배달",
      group: "배달",
      desc: "비빔밥을 집으로 주문하고 라이더의 이동을 확인해요.",
      mode: "delivery",
    },
    {
      id: "delivery-arrival",
      name: "내 도착에 맞춰 배달",
      group: "배달",
      desc: "귀가까지 50분. 조리 시작을 조정해 배달 시점을 맞춰요.",
      mode: "delivery",
      homeMinutes: 50,
      timing: "arrival",
    },
    {
      id: "family-order",
      name: "함께 먹을 저녁",
      group: "배달",
      desc: "같은 매장 메뉴를 여러 개 담고 수량과 합계를 확인해요.",
      mode: "delivery",
    },
    {
      id: "pickup-route",
      name: "가는 길에 픽업",
      group: "픽업",
      desc: "매장을 경유지로 추가할지 확인하고 집까지 이어서 안내해요.",
      mode: "pickup",
    },
    {
      id: "pickup-direct",
      name: "가까운 매장 픽업",
      group: "픽업",
      desc: "가까운 코너버거에서 주문하고 직접 수령해요.",
      mode: "pickup",
    },
    {
      id: "switch-mode",
      name: "배달에서 픽업으로",
      group: "주문 변경",
      desc: "확정 전 수령 방식을 바꾸고 배달비가 빠지는지 확인해요.",
      mode: "delivery",
    },
    {
      id: "sold-out",
      name: "선택 메뉴 품절",
      group: "예외 상황",
      desc: "비빔밥이 품절이에요. 다른 메뉴를 안내해요.",
      mode: "delivery",
      soldOut: ["bibimbap"],
    },
    {
      id: "closed",
      name: "매장 영업 종료",
      group: "예외 상황",
      desc: "소담한상 영업이 끝났어요. 다른 매장에서 주문해요.",
      mode: "delivery",
      closed: ["sodam"],
    },
    {
      id: "outside-area",
      name: "배달 지역 밖",
      group: "예외 상황",
      desc: "배달할 수 없는 목적지예요. 픽업으로 전환할 수 있어요.",
      mode: "delivery",
      outsideArea: true,
    },
    {
      id: "delay",
      name: "조리가 늦어질 때",
      group: "예외 상황",
      desc: "조리가 10분 늦어져요. 갱신된 도착 시간을 확인해요.",
      mode: "delivery",
      delay: 10,
    },
    {
      id: "offline-map",
      name: "지도 연결 끊김",
      group: "복구",
      desc: "배경지도 대신 저장된 도로 경로를 사용하고 주문 상태는 유지해요.",
      mode: "delivery",
      offline: true,
    },
    {
      id: "no-destination",
      name: "집이 설정되지 않음",
      group: "복구",
      desc: "배달 전 목적지를 선택해요. 픽업은 계속 이용할 수 있어요.",
      mode: "delivery",
      noHome: true,
    },
    {
      id: "speech-retry",
      name: "음성을 못 알아들었을 때",
      group: "복구",
      desc: "짧은 예시를 보고 다시 말하거나 화면에서 선택해요.",
      mode: "delivery",
    },
    {
      id: "cancel-early",
      name: "조리 전 주문 취소",
      group: "주문 변경",
      desc: "주문 직후 취소하면 진행이 멈추는지 확인해요.",
      mode: "delivery",
    },
    {
      id: "cancel-late",
      name: "조리 후 취소 요청",
      group: "주문 변경",
      desc: "조리 시작 후에는 자동 취소하지 않고 안내를 보여줘요.",
      mode: "delivery",
    },
    {
      id: "relaunch",
      name: "앱을 다시 열었을 때",
      group: "복구",
      desc: "앱을 종료하고 열어도 주문과 진행 상태가 복원돼요.",
      mode: "delivery",
    },
    {
      id: "duplicate",
      name: "확정이 두 번 들어오면",
      group: "복구",
      desc: "같은 확인 요청을 다시 보내도 주문은 하나만 생성돼요.",
      mode: "delivery",
    },
    {
      id: "payment-insufficient",
      name: "결제 잔액·한도 부족",
      group: "결제",
      desc: "테스트카드 승인이 거절돼요. 다른 수단으로 바꿔 다시 확인해요.",
      mode: "delivery",
      payment: "insufficient",
    },
    {
      id: "card-declined",
      name: "카드사 승인 거절",
      group: "결제",
      desc: "원인을 단정하지 않고 다른 수단이나 카드사 확인을 안내해요.",
      mode: "delivery",
      payment: "declined",
    },
    {
      id: "payment-pending",
      name: "결제 결과 미확인",
      group: "결제",
      desc: "결과 조회 전 재결제하지 않아 이중 결제를 방지해요.",
      mode: "delivery",
      payment: "unknown",
    },
    {
      id: "merchant-reject",
      name: "매장이 주문을 거절",
      group: "매장",
      desc: "주문을 취소하고 원래 결제 수단으로 환불 대기를 안내해요.",
      mode: "delivery",
      merchantReject: 2,
    },
    {
      id: "merchant-cancel",
      name: "조리 중 매장 취소",
      group: "매장",
      desc: "매장 사정으로 조리 중 취소된 주문과 환불 내역을 확인해요.",
      mode: "delivery",
      merchantReject: 7,
    },
    {
      id: "rider-delay",
      name: "라이더 배정 지연",
      group: "배달",
      desc: "음식은 준비됐지만 라이더가 없어 배달 시작으로 표시하지 않아요.",
      mode: "delivery",
      riderDelay: 12,
    },
    {
      id: "rider-reassigned",
      name: "라이더 재배정",
      group: "배달",
      desc: "기존 배정 취소를 알리고 새 라이더가 연결될 때까지 기다려요.",
      mode: "delivery",
      riderDelay: 8,
      reassigned: true,
    },
    {
      id: "recipient-unavailable",
      name: "도착했지만 수령인 부재",
      group: "배달",
      desc: "배송 완료로 넘기지 않고 수령 가능 확인을 기다려요.",
      mode: "delivery",
      recipientAbsent: true,
    },
    {
      id: "pickup-no-show",
      name: "픽업 시간이 지났을 때",
      group: "픽업",
      desc: "준비 후 30분이 지나면 수령 안내를 보내요. 자동 완료하지 않아요.",
      mode: "pickup",
    },
    {
      id: "refund-delay",
      name: "환불 처리 지연",
      group: "결제",
      desc: "취소와 환불 완료를 구분하고 환불 대기 금액을 보여줘요.",
      mode: "delivery",
      refundDelay: 30,
    },
    {
      id: "missing-item",
      name: "배달 뒤 누락 신고",
      group: "고객 지원",
      desc: "누락 접수와 확인 대기를 기록하고 임의로 환불을 완료하지 않아요.",
      mode: "delivery",
    },
  ];
  const result = (status, message, extra = {}) => ({
    status,
    message,
    ...extra,
  });
  class OrderRepository {
    constructor({ scenario = "delivery-home", now = Date.now() } = {}) {
      this.scenario = SCENARIOS.find((s) => s.id === scenario) || SCENARIOS[0];
      this.clock = now;
      this.startedAt = now;
      this.home = this.scenario.noHome ? null : { ...DATA.home };
      this.origin = { ...DATA.origin };
      this.mode = this.scenario.mode;
      this.timing = this.scenario.timing || "soon";
      this.draft = null;
      this.orders = [];
      this.counter = 0;
      this.homeMinutes = this.scenario.homeMinutes || 24;
      this.navigationRequested = false;
      this.navigationAccepted = false;
      this.payments = new PaymentRepository();
    }
    static restore(value) {
      try {
        const o = typeof value === "string" ? JSON.parse(value) : value;
        if (
          !o ||
          o.version !== 1 ||
          !Array.isArray(o.orders) ||
          !Number.isFinite(o.clock)
        )
          throw Error("state");
        const r = new OrderRepository({ scenario: o.scenario, now: o.clock });
        Object.assign(r, o, {
          scenario: SCENARIOS.find((s) => s.id === o.scenario) || SCENARIOS[0],
        });
        r.payments = PaymentRepository.restore(o.payments);
        for (const order of r.orders) {
          order.events = order.events || [];
          if (order.payment)
            order.payment =
              r.payments.transactions.find((p) => p.id === order.payment.id) ||
              order.payment;
        }
        r.update();
        return r;
      } catch {
        return new OrderRepository();
      }
    }
    serialize() {
      return JSON.stringify({
        ...this,
        scenario: this.scenario.id,
        version: 1,
      });
    }
    activeOrder() {
      return (
        this.orders.find(
          (o) => !["completed", "cancelled"].includes(o.stage),
        ) || null
      );
    }
    menu(id) {
      return DATA.menus.find((m) => m.id === id);
    }
    store(id) {
      return DATA.stores.find((s) => s.id === id);
    }
    available(menu) {
      return (
        menu &&
        !(this.scenario.soldOut || []).includes(menu.id) &&
        !(this.scenario.closed || []).includes(menu.storeId)
      );
    }
    prepare({ items, mode = this.mode, timing = this.timing } = {}) {
      if (this.payments.transactions.some((p) => p.status === "pending"))
        return result("asking", "확인 중인 결제 결과를 먼저 조회해 주세요.");
      if (this.activeOrder())
        return result("fail", "진행 중인 주문을 먼저 확인해 주세요.");
      if (!["delivery", "pickup"].includes(mode))
        return result("fail", "배달 또는 픽업을 선택해 주세요.");
      if (!["soon", "arrival"].includes(timing))
        return result("fail", "수령 시점을 다시 선택해 주세요.");
      if (!Array.isArray(items) || !items.length || items.length > 8)
        return result("asking", "먹고 싶은 메뉴를 골라 주세요.");
      const rows = [];
      let storeId = null;
      for (const line of items) {
        const menu = this.menu(line.menuId);
        if (!menu) return result("fail", "찾을 수 없는 메뉴예요.");
        if (
          !Number.isInteger(line.quantity) ||
          line.quantity < 1 ||
          line.quantity > 20
        )
          return result("fail", "수량은 1개부터 20개까지 선택해 주세요.");
        if (!this.available(menu))
          return result(
            "fail",
            (this.scenario.closed || []).includes(menu.storeId)
              ? "이 매장은 오늘 영업을 마쳤어요. 다른 매장을 골라 주세요."
              : "이 메뉴는 품절이에요. 다른 메뉴를 골라 주세요.",
          );
        if (storeId && storeId !== menu.storeId)
          return result("fail", "한 주문에는 같은 매장의 메뉴를 담아 주세요.");
        storeId = menu.storeId;
        rows.push({
          menuId: menu.id,
          name: menu.name,
          quantity: line.quantity,
          price: menu.price,
        });
      }
      if (mode === "delivery" && !this.home)
        return result("asking", "배달받을 곳을 먼저 정해 주세요.");
      if (timing === "arrival" && this.liveLocation)
        return result(
          "asking",
          "차량 GPS 모드에서는 아직 실시간 도착 시점 예약을 지원하지 않아요. 바로 배달하거나 데모 경로로 전환해 주세요.",
        );
      if (mode === "delivery" && this.scenario.outsideArea)
        return result(
          "fail",
          "지금 목적지는 배달 지역 밖이에요. 픽업으로 바꿀 수 있어요.",
        );
      const store = this.store(storeId),
        subtotal = rows.reduce((a, b) => a + b.price * b.quantity, 0),
        fee = mode === "delivery" ? store.fee : 0;
      this.mode = mode;
      this.timing = timing;
      this.draft = {
        id: `draft-${this.clock}-${++this.counter}`,
        createdAt: this.clock,
        storeId,
        items: rows,
        mode,
        timing,
        subtotal,
        fee,
        total: subtotal + fee,
      };
      return result(
        "asking",
        `${store.name}, ${rows.map((i) => `${i.name} ${i.quantity}개`).join(", ")}. ${mode === "delivery" ? "집으로 배달" : "매장에서 픽업"}, 합계 ${this.draft.total.toLocaleString("ko-KR")}원이에요. 이대로 주문할까요?`,
        { draft: this.draft },
      );
    }
    confirm(id, confirmation) {
      const existing = this.orders.find((o) => o.draftId === id);
      if (existing)
        return result("success", "이미 접수된 주문이에요.", {
          order: existing,
        });
      if (confirmation !== true)
        return result("asking", "내용을 확인하고 주문을 확정해 주세요.");
      if (!this.draft || typeof id !== "string" || id !== this.draft.id)
        return result("fail", "주문 내용이 바뀌었어요. 다시 확인해 주세요.");
      if (
        this.clock - this.draft.createdAt > 10 * MINUTE &&
        !this.payments.transactions.some(
          (p) => p.key === id && ["pending", "paid"].includes(p.status),
        )
      ) {
        this.draft = null;
        return result(
          "fail",
          "주문 확인 시간이 지났어요. 메뉴를 다시 골라 주세요.",
        );
      }
      if (this.activeOrder())
        return result("fail", "이미 진행 중인 주문이 있어요.");
      const d = this.draft,
        s = this.store(d.storeId);
      if (d.items.some((i) => !this.available(this.menu(i.menuId))))
        return result("fail", "메뉴 판매 상태가 바뀌었어요. 다시 골라 주세요.");
      const pending = this.payments.transactions.find(
        (p) => p.key === d.id && p.status === "pending",
      );
      if (pending)
        return result(
          "asking",
          "결제 결과를 확인 중이에요. 먼저 승인 결과를 조회해 주세요.",
          {
            payment: pending,
            voiceText:
              "아직 승인 결과를 확인하지 못했어요. 다른 수단으로 중복 결제하지 않고 기존 결제 결과를 먼저 확인할게요.",
          },
        );
      const outcome =
        this.payments.selected === "test-card"
          ? this.scenario.payment || "success"
          : "success";
      const payment = this.payments.charge(d.id, d.total, this.clock, outcome);
      if (payment.status === "failed") {
        const detail =
          payment.reason === "insufficient"
            ? "사용 가능 잔액 또는 한도가 부족해요."
            : "카드사에서 승인을 거절했어요.";
        return result("fail", detail + " 다른 결제 수단을 선택해 주세요.", {
          payment,
          voiceText: `${payment.name} 끝번호 ${payment.last4}로 ${d.total.toLocaleString("ko-KR")}원 모의 결제를 시도했지만, ${detail} 주문은 접수되지 않았어요. 다른 결제 수단으로 바꿀 수 있어요.`,
        });
      }
      if (payment.status === "pending")
        return result(
          "asking",
          "결제 결과를 확인 중이에요. 다시 결제하지 말고 결과를 조회해 주세요.",
          {
            payment,
            voiceText: `총 ${d.total.toLocaleString("ko-KR")}원 모의 결제의 승인 결과를 아직 확인하지 못했어요. 주문도 아직 보내지 않았어요. 이중 결제를 막기 위해 결과를 먼저 확인할게요.`,
          },
        );
      const delayMinutes = this.scenario.delay || 0,
        prepMinutes = s.prep + delayMinutes,
        travelMinutes = 10,
        riderDelay = this.scenario.riderDelay || 0;
      const startAt =
        d.mode === "delivery" && d.timing === "arrival"
          ? Math.max(
              this.clock,
              this.startedAt +
                this.homeMinutes * MINUTE -
                (prepMinutes + travelMinutes) * MINUTE,
            )
          : this.clock;
      const order = {
        ...JSON.parse(JSON.stringify(d)),
        id: `PO-${String(++this.counter).padStart(4, "0")}`,
        draftId: d.id,
        createdAt: this.clock,
        startAt,
        readyAt: startAt + prepMinutes * MINUTE,
        dispatchAt: startAt + (prepMinutes + riderDelay) * MINUTE,
        deliveryAt:
          startAt + (prepMinutes + riderDelay + travelMinutes) * MINUTE,
        delayMinutes,
        stage: "accepted",
        simulated: true,
        payment,
        events: [],
      };
      this.event(
        order,
        "payment",
        `총 ${d.total.toLocaleString("ko-KR")}원 · ${payment.name} ${payment.last4} 모의 결제 승인`,
        this.clock,
      );
      this.orders.unshift(order);
      this.draft = null;
      return result("success", `${s.name}에 모의 주문을 보냈어요.`, {
        order,
        voiceText: this.describe(order),
      });
    }
    event(o, kind, message, at = this.clock) {
      if (!o.events.some((e) => e.kind === kind))
        o.events.push({ kind, message, at });
    }
    update() {
      this.payments.settle(this.clock);
      for (const o of this.orders) {
        if (o.payment?.status === "refunded")
          this.event(
            o,
            "refunded",
            `${o.total.toLocaleString("ko-KR")}원 모의 환불 완료`,
            o.payment.refundedAt,
          );
        if (["cancelled", "completed"].includes(o.stage)) continue;
        if (
          this.scenario.merchantReject &&
          this.clock >= o.createdAt + this.scenario.merchantReject * MINUTE
        ) {
          o.stage = "cancelled";
          o.cancelReason = "매장 사정으로 주문이 취소됐어요.";
          this.event(
            o,
            "merchant_cancelled",
            o.cancelReason,
            o.createdAt + this.scenario.merchantReject * MINUTE,
          );
          this.payments.refund(
            o.payment.id,
            o.createdAt + this.scenario.merchantReject * MINUTE,
            this.scenario.refundDelay || 3,
          );
          this.event(
            o,
            "refund_requested",
            "원래 결제 수단으로 모의 환불 접수",
          );
          continue;
        }
        if (this.clock >= o.startAt + 2 * MINUTE)
          this.event(
            o,
            "cooking",
            "매장이 주문을 수락하고 조리를 시작했어요.",
            o.startAt + 2 * MINUTE,
          );
        if (o.delayMinutes && this.clock >= o.startAt + 3 * MINUTE)
          this.event(
            o,
            "cooking_delayed",
            `조리가 ${o.delayMinutes}분 늦어져 예상 시간을 조정했어요.`,
            o.startAt + 3 * MINUTE,
          );
        if (this.clock >= o.readyAt)
          this.event(o, "ready", "음식 준비가 끝났어요.", o.readyAt);
        if (o.mode === "pickup") {
          if (this.clock >= o.readyAt) {
            o.stage = "ready";
            if (this.clock >= o.readyAt + 30 * MINUTE)
              this.event(
                o,
                "pickup_reminder",
                "음식 준비 후 30분이 지났어요. 매장 수령 시간을 확인해 주세요.",
                o.readyAt + 30 * MINUTE,
              );
          } else
            o.stage =
              this.clock >= o.startAt + 2 * MINUTE ? "cooking" : "accepted";
          continue;
        }
        if (this.clock >= o.deliveryAt) {
          if (this.scenario.recipientAbsent && !o.recipientAvailable) {
            o.stage = "contact_needed";
            this.event(
              o,
              "recipient_absent",
              "라이더가 도착했지만 수령 확인을 기다리고 있어요.",
              o.deliveryAt,
            );
          } else {
            o.stage = "completed";
            this.event(o, "delivered", "모의 배달을 완료했어요.", o.deliveryAt);
          }
        } else if (this.clock >= o.dispatchAt) {
          o.stage = "delivering";
          this.event(
            o,
            "dispatch",
            "가상 라이더가 배달을 시작했어요.",
            o.dispatchAt,
          );
        } else if (this.clock >= o.readyAt) {
          o.stage = "waiting_rider";
          this.event(
            o,
            "rider_wait",
            this.scenario.reassigned
              ? "라이더 배정이 취소되어 새 라이더를 찾고 있어요."
              : "라이더 배정이 지연되고 있어요.",
            o.readyAt,
          );
        } else
          o.stage =
            this.clock >= o.startAt + 2 * MINUTE ? "cooking" : "accepted";
      }
    }
    advance(minutes) {
      if (!Number.isFinite(minutes) || minutes < 0 || minutes > 1440)
        return result("fail", "올바른 시간을 입력해 주세요.");
      this.clock += minutes * MINUTE;
      this.update();
      return this.status();
    }
    describe(o) {
      if (!o)
        return "아직 진행 중인 주문이 없어요. 먹고 싶은 메뉴와 배달 또는 픽업을 알려 주세요.";
      const meal = o.items.map((i) => `${i.name} ${i.quantity}개`).join(", "),
        price = o.total.toLocaleString("ko-KR"),
        p = o.payment;
      const paid = p
        ? `${p.name} 끝번호 ${p.last4}로 총 ${price}원 모의 결제됐어요.`
        : `총 ${price}원 모의 주문이에요.`;
      const remain = Math.max(
        0,
        Math.ceil(
          ((o.mode === "delivery" ? o.deliveryAt : o.readyAt) - this.clock) /
            MINUTE,
        ),
      );
      const progress = {
        accepted: `매장의 주문 확인을 기다리고 있어요. ${o.mode === "delivery" ? "집까지 배달" : "픽업 준비"} 예상 시간은 ${remain}분이에요.`,
        cooking: `매장에서 조리 중이에요.${o.delayMinutes ? ` 조리가 ${o.delayMinutes}분 늦어져 예상 시간을 조정했어요.` : ""} ${o.mode === "delivery" ? "배달 도착" : "픽업 준비"}까지 약 ${remain}분 남았어요.`,
        ready: `음식이 준비됐어요. ${this.store(o.storeId).name}에서 직접 수령해 주세요. 수령 뒤 픽업 완료를 눌러 주세요.`,
        waiting_rider: `음식은 준비됐지만 ${this.scenario.reassigned ? "새 라이더를 다시 배정" : "아직 라이더를 배정"}하고 있어요. 배달은 아직 시작하지 않았고 도착 예상까지 ${remain}분이에요.`,
        delivering: `가상 라이더가 집으로 이동 중이에요. 도착까지 약 ${remain}분이에요.`,
        contact_needed:
          "라이더가 도착했지만 수령 확인이 되지 않았어요. 배달 완료로 처리하지 않았어요. 수령 가능 여부를 알려 주세요.",
        completed:
          o.mode === "delivery"
            ? "모의 배달이 완료됐어요. 누락된 메뉴가 있으면 주문 내역에서 알려 주세요."
            : "매장 픽업을 완료했어요. 맛있게 드세요.",
        cancelled: `${o.cancelReason || "주문이 취소됐어요."} ${p?.status === "refunded" ? `${price}원 모의 환불이 완료됐어요.` : `${price}원 모의 환불을 접수했고, 아직 완료되지 않았어요.`}`,
      }[o.stage];
      return `${this.store(o.storeId).name}, ${meal}. ${paid} ${progress || ""}`;
    }
    status() {
      this.update();
      const order = this.activeOrder() || this.orders[0];
      return result(
        "success",
        order
          ? {
              accepted: "매장 확인을 기다리고 있어요.",
              cooking: "맛있게 준비하고 있어요.",
              delivering: "라이더가 집으로 가고 있어요.",
              ready: "음식이 준비됐어요.",
              waiting_rider: "라이더 배정을 기다리고 있어요.",
              contact_needed: "도착 후 수령 확인이 필요해요.",
              completed: "주문이 완료됐어요.",
              cancelled: "주문이 취소됐어요.",
            }[order.stage]
          : "아직 주문이 없어요.",
        { order: order || null, voiceText: this.describe(order) },
      );
    }
    cancel() {
      if (this.draft) {
        const pending = this.payments.transactions.find(
          (p) => p.key === this.draft.id && p.status === "pending",
        );
        if (pending)
          return result(
            "asking",
            "결제 결과를 먼저 확인해야 해요. 결과가 확인되면 취소를 처리할 수 있어요.",
            {
              voiceText:
                "결제 승인 여부가 아직 확인되지 않아 임의로 주문을 지우지 않았어요. 결제 결과를 먼저 확인할게요.",
            },
          );
        this.draft = null;
        return result("asking", "담아 둔 주문을 비웠어요.");
      }
      this.update();
      const order = this.activeOrder();
      if (!order) return result("asking", "취소할 주문이 없어요.");
      if (order.stage !== "accepted")
        return result(
          "fail",
          "이미 조리를 시작해 자동 취소할 수 없어요. 문의 접수에서 상황을 알려 주세요.",
        );
      order.stage = "cancelled";
      order.cancelledAt = this.clock;
      this.payments.refund(
        order.payment?.id,
        this.clock,
        this.scenario.refundDelay || 3,
      );
      this.event(order, "cancelled", "사용자가 조리 전 주문을 취소했어요.");
      this.event(
        order,
        "refund_requested",
        "원래 결제 수단으로 모의 환불 접수",
      );
      return result("success", "주문을 취소하고 모의 환불을 접수했어요.", {
        order,
        voiceText: this.describe(order),
      });
    }
    collect() {
      const o = this.activeOrder();
      if (!o || o.mode !== "pickup" || o.stage !== "ready")
        return result("fail", "픽업 준비가 끝나면 수령을 확인할 수 있어요.");
      o.stage = "completed";
      o.completedAt = this.clock;
      this.event(o, "collected", "사용자가 매장 수령을 확인했어요.");
      return result("success", "픽업을 완료했어요. 조심히 돌아가세요.", {
        order: o,
        voiceText: this.describe(o),
      });
    }
    reconcilePayment(approved = true) {
      const p = this.payments.transactions.findLast(
        (p) => p.status === "pending",
      );
      if (!p) return result("asking", "확인 중인 결제가 없어요.");
      this.payments.reconcile(p.id, approved);
      if (p.status === "paid") return this.confirm(p.key, true);
      return result(
        "fail",
        "결제가 승인되지 않았어요. 다른 결제 수단을 선택해 주세요.",
        {
          voiceText:
            "조회 결과, 모의 결제 승인이 이루어지지 않았어요. 주문은 접수되지 않았고 차감된 금액도 없어요. 다른 결제 수단으로 다시 시도할 수 있어요.",
        },
      );
    }
    resolveIssue(kind) {
      const o = this.activeOrder() || this.orders[0];
      if (!o) return result("asking", "먼저 주문 내역을 확인해 주세요.");
      if (kind === "recipient-ready" && o.stage === "contact_needed") {
        o.recipientAvailable = true;
        this.update();
        return this.status();
      }
      if (kind === "missing-item" || kind === "contact") {
        o.support = {
          id: "HELP-" + o.id,
          status: "open",
          reason: kind,
          createdAt: this.clock,
        };
        this.event(
          o,
          "support_opened",
          kind === "missing-item"
            ? "메뉴 누락 문의를 접수했어요."
            : "주문 문의를 접수했어요.",
        );
        return result(
          "asking",
          "모의 문의를 접수했어요. 확인 전에는 환불 완료로 표시하지 않아요.",
          {
            voiceText: `${this.store(o.storeId).name} 주문에 관한 문의를 접수했어요. 접수 번호는 ${o.support.id}예요. 매장 확인을 기다리고 있고, 환불 여부나 금액은 아직 확정되지 않았어요.`,
          },
        );
      }
      return result("fail", "현재 단계에서는 처리할 수 없는 요청이에요.");
    }
    handleCommand(input) {
      if (typeof input !== "string" || input.length > 500)
        return result("fail", "명령을 짧게 다시 말해 주세요.");
      const t = input.trim();
      if (
        /못\s*받|안\s*받|받을\s*수\s*없|완료.*(안|못)|결제.*(하지\s*마|안\s*할|아니)/.test(
          t,
        )
      )
        return result(
          "asking",
          "완료나 결제로 처리하지 않았어요. 현재 주문 상태를 유지할게요.",
        );
      if (/결제.*(조회|확인)/.test(t)) return this.reconcilePayment(true);
      if (/페이로|다른\s*카드|결제\s*수단\s*변경/.test(t)) {
        if (this.payments.transactions.some((p) => p.status === "pending"))
          return result("asking", "결제 결과 확인이 먼저 필요해요.");
        this.payments.select(
          this.payments.selected === "test-card" ? "test-pay" : "test-card",
        );
        return result(
          "asking",
          `${this.payments.method().name}로 바꿨어요. 주문 내용을 다시 확인해 주세요.`,
        );
      }
      if (/잔액|한도/.test(t)) {
        const p = this.payments.method();
        return result(
          "success",
          `${p.name}의 모의 사용 가능 금액은 ${p.balance.toLocaleString("ko-KR")}원이에요.`,
        );
      }
      if (/누락|문의|문제/.test(t))
        return this.resolveIssue(/누락/.test(t) ? "missing-item" : "contact");
      if (/수령\s*가능|받을\s*수/.test(t))
        return this.resolveIssue("recipient-ready");
      if (/취소|하지\s*마|안\s*할|^아니/.test(t)) return this.cancel();
      if (/어디|상태|얼마나|언제.*(와|도착|돼)|주문\s*조회/.test(t))
        return this.status();
      if (/수령.*완료|받았|픽업.*완료/.test(t)) return this.collect();
      const mode = /픽업|포장|찾아|찾으러/.test(t)
        ? "pickup"
        : /배달|집으로/.test(t)
          ? "delivery"
          : this.mode;
      const wanted = t.includes("말고")
        ? t.slice(t.lastIndexOf("말고") + 2)
        : t;
      const matches = DATA.menus
        .map((m) => ({
          menu: m,
          score: Math.max(
            0,
            ...m.aliases.filter((a) => wanted.includes(a)).map((a) => a.length),
          ),
        }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score);
      const menu = matches[0]?.menu;
      if (menu) {
        let quantity = 1;
        const n = t.match(/(\d+)\s*(개|인분|마리)/);
        if (n) quantity = Number(n[1]);
        else if (/두\s*(개|인분|마리)|둘/.test(t)) quantity = 2;
        else if (/세\s*(개|인분|마리)/.test(t)) quantity = 3;
        return this.prepare({
          items: [{ menuId: menu.id, quantity }],
          mode,
          timing: /도착.*맞|맞춰/.test(t) ? "arrival" : this.timing,
        });
      }
      if (/바꿔|변경/.test(t) && this.draft)
        return this.prepare({ items: this.draft.items, mode });
      if (
        /^(네|예|응|좋아|확정|주문해\s*줘|주문할게|이대로\s*주문)[.!\s]*$/.test(
          t,
        )
      )
        return this.confirm(this.draft?.id, true);
      return result(
        "asking",
        "“비빔밥 한 개 집으로 배달해 줘”처럼 말해 주세요. 주문 내용은 한 번 더 확인할게요.",
      );
    }
    handleAction(name, params = {}) {
      if (!params || typeof params !== "object" || Array.isArray(params))
        return result("fail", "올바르지 않은 요청이에요.");
      if (name === "GET_FOOD_ORDER_STATUS") return this.status();
      if (name === "CONFIRM_FOOD_ORDER")
        return this.confirm(params.draftId, params.confirmation);
      if (name !== "PREPARE_FOOD_ORDER")
        return result("fail", "지원하지 않는 요청이에요.");
      if (typeof params.query !== "string" || params.query.length > 500)
        return result("fail", "메뉴를 짧게 알려 주세요.");
      if (!["delivery", "pickup"].includes(params.fulfillment))
        return result("asking", "배달 또는 픽업을 알려 주세요.");
      const menu = DATA.menus
        .map((m) => ({
          menu: m,
          score:
            params.query === m.id
              ? 999
              : Math.max(
                  0,
                  ...m.aliases
                    .filter((a) => params.query.includes(a))
                    .map((a) => a.length),
                ),
        }))
        .sort((a, b) => b.score - a.score)
        .find((x) => x.score > 0)?.menu;
      if (!menu)
        return result(
          "asking",
          "원하는 메뉴를 다시 알려 주세요. 비빔밥, 국밥, 치킨 등을 주문할 수 있어요.",
        );
      return this.prepare({
        items: [
          {
            menuId: menu.id,
            quantity: params.quantity === undefined ? 1 : params.quantity,
          },
        ],
        mode: params.fulfillment,
        timing: params.timing || "soon",
      });
    }
  }
  return { OrderRepository, SCENARIOS, MINUTE, DATA };
});
