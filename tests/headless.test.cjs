const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const Core = require("../app/src/main/assets/web/core.js");
const { OrderRepository } = Core;
const html = fs.readFileSync("app/src/main/assets/web/headless.html", "utf8");
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
function engine() {
  let output;
  const context = {
    PleorderCore: Core,
    PleorderVoice: require("../app/src/main/assets/web/voice-location.js"),
    Date: { now: () => 0 },
    Headless: {
      ready() {},
      complete(id, state, response) {
        output = {
          id,
          state: JSON.parse(state),
          response: JSON.parse(response),
        };
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(script, context);
  return {
    async call(name, params, state) {
      await context.dispatch(name, params, JSON.stringify(state), 42);
      return output;
    },
  };
}
test("headless Gleo contract prepares then confirms without a UI", async () => {
  const e = engine();
  const s = JSON.parse(new OrderRepository({ now: 0 }).serialize());
  const draft = await e.call(
    "PREPARE_FOOD_ORDER",
    { query: "비빔밥", fulfillment: "delivery" },
    s,
  );
  assert.equal(draft.response.status, "asking");
  const order = await e.call(
    "CONFIRM_FOOD_ORDER",
    { draftId: draft.state.draft.id, confirmation: true },
    draft.state,
  );
  assert.equal(order.id, 42);
  assert.equal(order.response.status, "success");
  assert.match(order.response.message, /simulation/);
  assert.match(JSON.parse(order.response.data)[0].detail, /12,500/);
  assert.equal(order.state.orders.length, 1);
  assert.equal(order.state.simulation.paused, false);
});
test("headless Gleo duplicate confirmations create one charge", async () => {
  const e = engine();
  const r = new OrderRepository({ now: 0 });
  r.prepare({ mode: "pickup", items: [{ menuId: "bibimbap", quantity: 1 }] });
  const id = r.draft.id;
  let out = await e.call(
    "CONFIRM_FOOD_ORDER",
    { draftId: id, confirmation: true },
    JSON.parse(r.serialize()),
  );
  out = await e.call(
    "CONFIRM_FOOD_ORDER",
    { draftId: id, confirmation: true },
    out.state,
  );
  assert.equal(out.state.orders.length, 1);
  assert.equal(out.state.payments.transactions.length, 1);
});
