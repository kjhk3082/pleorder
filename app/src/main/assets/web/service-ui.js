function serviceOrderView(repo) {
  const money = (n) => n.toLocaleString("ko-KR") + "원";
  const d = repo.draft,
    o = repo.activeOrder() || repo.orders[0];
  if (d) {
    const pending = repo.payments.transactions.find(
      (p) => p.key === d.id && p.status === "pending",
    );
    return `<div class="order-heading"><h3>${pending ? "결제 결과 확인 중" : "주문 내용을 확인해 주세요"}</h3><span class="status-badge">${pending ? "주문 접수 전" : "확정 전"}</span></div><p class="order-menu">${d.items.map((i) => i.name + " " + i.quantity + "개").join(" · ")}<br>${d.mode === "delivery" ? "집으로 배달" : "매장에서 픽업"} · ${money(d.total)}</p>${pending ? '<div class="notice-info">이중 결제를 막기 위해 승인 결과를 먼저 확인합니다.</div><button class="button primary full-width" data-command="reconcile-payment">결제 결과 확인</button>' : '<button class="button primary full-width" data-command="summary">주문 확인</button>'}`;
  }
  if (!o)
    return `<div class="empty-order"><div><h3>저녁은 맡겨 두세요</h3><p>마음에 드는 메뉴를 골라 주세요.</p></div>${icon("bowl", 36)}</div>`;
  const idx = {
    accepted: 0,
    cooking: 1,
    waiting_rider: 2,
    delivering: 2,
    contact_needed: 3,
    ready: 2,
    completed: 3,
    cancelled: -1,
  }[o.stage];
  const labels =
    o.mode === "delivery"
      ? ["주문 확인", "조리", "배달", "수령"]
      : ["주문 확인", "조리", "픽업 준비", "수령"];
  const title = {
    accepted: "매장 확인을 기다려요",
    cooking: "맛있게 준비하고 있어요",
    waiting_rider: "라이더를 찾고 있어요",
    delivering: "우리 집으로 가고 있어요",
    contact_needed: "도착했어요. 수령해 주세요",
    ready: "따뜻할 때 가져가세요",
    completed: "맛있게 드세요",
    cancelled: "주문이 취소됐어요",
  }[o.stage];
  const p = o.payment,
    paid = p
      ? `${p.name} · ${p.last4} · ${money(p.amount)}`
      : `${money(o.total)}`;
  const paymentStatus =
    {
      paid: "모의 결제 완료",
      refund_pending: "모의 환불 대기",
      refunded: "모의 환불 완료",
      failed: "승인 거절",
      pending: "승인 확인 중",
    }[p?.status] || "모의 주문";
  const warning =
    o.stage === "waiting_rider"
      ? "음식은 준비됐지만 배달은 아직 시작하지 않았어요."
      : o.stage === "contact_needed"
        ? "수령 여부를 확인하기 전에는 배달 완료로 처리하지 않아요."
        : o.stage === "cancelled" && p?.status === "refund_pending"
          ? "주문 취소는 끝났고, 결제 금액 환불을 기다리고 있어요."
          : o.delayMinutes && idx < 3
            ? `조리가 ${o.delayMinutes}분 늦어져 도착 시간을 다시 맞췄어요.`
            : "";
  return `<div class="order-heading"><h3>${title}</h3><span class="order-id">${o.id}</span></div><p class="order-menu">${repo.store(o.storeId).name} · ${o.items.map((i) => i.name + " " + i.quantity + "개").join(", ")}</p>${warning ? `<div class="notice-info">${warning}</div>` : ""}<div class="order-stage" aria-label="${title}">${labels.map((_, i) => `<span class="${i <= idx ? "done" : ""}"></span>`).join("")}</div><div class="metadata"><strong>${paymentStatus}</strong><span>· ${paid}</span></div><div class="order-actions">${o.stage === "contact_needed" ? '<button class="button primary" data-command="recipient-ready">지금 받을 수 있어요</button>' : o.mode === "pickup" && idx < 3 ? `<button class="button ${o.stage === "ready" ? "primary" : "secondary"}" data-command="${o.stage === "ready" ? "collect" : "navigate"}">${o.stage === "ready" ? "픽업 완료" : "경유지로 안내"}</button>` : ""}<button class="button outlined" data-command="details">상세 내역</button>${idx >= 0 && idx < 3 ? '<button class="button outlined" data-command="cancel">취소</button>' : ""}</div>`;
}
