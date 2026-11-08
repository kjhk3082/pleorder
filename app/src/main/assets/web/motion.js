// Small, local motion layer. No network runtime; respects reduced motion.
window.PleorderMotion = (() => {
  const systemMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const reduced = {
    get matches() {
      return (
        systemMotion.matches ||
        document.documentElement.dataset.motion === "reduce"
      );
    },
  };
  const tabs = new WeakMap();
  const contents = new WeakMap();
  const ease = "cubic-bezier(.23,1,.32,1)";
  let keyboard = false;
  document.addEventListener("keydown", () => (keyboard = true), true);
  document.addEventListener("pointerdown", () => (keyboard = false), true);
  function animate(el, frames, options = {}) {
    if (!el || reduced.matches || keyboard) return;
    return el.animate(frames, { duration: 240, easing: ease, ...options });
  }
  function selection(root) {
    if (!root) return;
    root.classList.add("motion-tabs");
    const active = root.querySelector("button.selected,button.active");
    if (!active) return;
    const box = { x: active.offsetLeft, width: active.offsetWidth };
    const previous = tabs.get(root);
    root.querySelector(".tab-indicator")?.remove();
    const indicator = document.createElement("span");
    indicator.className = "tab-indicator";
    indicator.setAttribute("aria-hidden", "true");
    indicator.style.left = box.x + "px";
    indicator.style.width = box.width + "px";
    root.prepend(indicator);
    if (previous && previous.x !== box.x)
      animate(
        indicator,
        [
          {
            transform: `translateX(${previous.x - box.x}px) scaleX(${previous.width / box.width})`,
          },
          { transform: "translateX(0) scaleX(1)" },
        ],
        { duration: 300 },
      );
    tabs.set(root, box);
  }
  function revealList(root) {
    root.querySelectorAll(".restaurant-card").forEach((el, i) =>
      animate(
        el,
        [
          { opacity: 0, transform: "translateY(12px)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 260, delay: Math.min(i, 4) * 28 },
      ),
    );
  }
  function replace(el, html, kind = "panel") {
    if (contents.get(el) === html) return false;
    contents.set(el, html);
    el.innerHTML = html;
    if (kind === "number")
      animate(
        el.querySelector(".hud-title"),
        [
          { opacity: 0.3, transform: "translateY(7px)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 210 },
      );
    else
      animate(el.firstElementChild, [
        { opacity: 0.4, transform: "translateY(10px)" },
        { opacity: 1, transform: "none" },
      ]);
    return true;
  }
  function dialog(el, direction = 1) {
    animate(el, [
      { opacity: 0, transform: `translateX(${direction * 16}px)` },
      { opacity: 1, transform: "none" },
    ]);
  }
  function pop(el) {
    animate(
      el,
      [
        { transform: "scale(.88)" },
        { transform: "scale(1.04)", offset: 0.6 },
        { transform: "scale(1)" },
      ],
      { duration: 260 },
    );
  }
  function sharedImage(source, target) {
    if (!source || !target || reduced.matches || keyboard) return;
    const a = source.getBoundingClientRect(),
      b = target.getBoundingClientRect();
    if (a.bottom < 0 || a.top > innerHeight) return;
    const clone = source.cloneNode();
    Object.assign(clone.style, {
      position: "fixed",
      left: b.left + "px",
      top: b.top + "px",
      width: b.width + "px",
      height: b.height + "px",
      zIndex: "10002",
      pointerEvents: "none",
      borderRadius: "17px",
      objectFit: "cover",
      transformOrigin: "top left",
    });
    document.body.append(clone);
    target.style.opacity = "0";
    const motion = animate(
      clone,
      [
        {
          transform: `translate(${a.left - b.left}px,${a.top - b.top}px) scale(${a.width / b.width},${a.height / b.height})`,
          opacity: 1,
        },
        { transform: "none", opacity: 1 },
      ],
      { duration: 360 },
    );
    const finish = () => {
      clone.remove();
      target.style.opacity = "";
    };
    if (motion) motion.finished.then(finish, finish);
    else finish();
  }
  return { selection, revealList, replace, dialog, pop, sharedImage, reduced };
})();
