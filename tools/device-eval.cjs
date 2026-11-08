// Debug-only WebView CDP helper. Operates only on the Pleorder app-assets origin.
const fs = require("node:fs");
(async () => {
  const targets = await (await fetch("http://127.0.0.1:9223/json")).json();
  const target = targets.find((t) =>
    /^https:\/\/appassets\.androidplatform\.net\/web\/(index|driving)\.html(?:[?#]|$)/.test(t.url),
  );
  if (!target)
    throw Error(
      "Pleorder WebView not found. Forward its debug socket to port 9223 first.",
    );
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let sequence = 0;
  const calls = new Map();
  ws.onmessage = (e) => {
    const message = JSON.parse(e.data);
    if (message.id) {
      const c = calls.get(message.id);
      if (c) {
        calls.delete(message.id);
        message.error ? c.reject(message.error) : c.resolve(message.result);
      }
    }
  };
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
    setTimeout(() => reject(Error("CDP timeout")), 10000).unref();
  });
  const call = (method, params) =>
    new Promise((resolve, reject) => {
      const id = ++sequence;
      const timeout = setTimeout(() => { calls.delete(id); reject(Error(method + " timed out")); }, 10000);
      calls.set(id, { resolve: value => { clearTimeout(timeout); resolve(value); }, reject: error => { clearTimeout(timeout); reject(error); } });
      ws.send(JSON.stringify({ id, method, params }));
    });
  if (process.argv[2] === "--screenshot") {
    let visible = true;
    try { visible = JSON.parse(target.description).visible !== false; } catch {}
    if (!visible) { console.log("WebView hidden; use full system screenshot as evidence."); ws.close(); return; }
    const r = await call("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    fs.writeFileSync(process.argv[3], Buffer.from(r.data, "base64"));
    console.log(process.argv[3]);
  } else {
    const expression =
      process.argv[2] === "--file"
        ? fs.readFileSync(process.argv[3], "utf8")
        : process.argv[2];
    const r = await call("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
    console.log(JSON.stringify(r.result.value ?? r.result.description));
  }
  ws.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
