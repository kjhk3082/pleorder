const icon = (name, size = 24) => {
  const p = {
    pin: '<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    home: '<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>',
    arrow: '<path d="m5 12 14 0m-5-5 5 5-5 5"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    check: '<path d="m5 12 4 4L20 5"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0m-7 7v5m-4 0h8"/>',
    bag: '<path d="M4 7h16l-1 14H5L4 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
    car: '<path d="m4 10 2-6h12l2 6M3 10h18v8H3Z"/><path d="M5 18v3m14-3v3M6 14h2m8 0h2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    route:
      '<circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M5 7v7a5 5 0 0 0 5 5h7M7 5h7a5 5 0 0 1 5 5v1"/>',
    lab: '<path d="M9 3h6m-5 0v6l-6 11h16L14 9V3M7 15h10"/>',
    volume:
      '<path d="M3 9h4l5-5v16l-5-5H3Zm13-2a7 7 0 0 1 0 10m3-13a11 11 0 0 1 0 16"/>',
    star: '<path d="m12 3 3 6 6 1-4.5 4.5 1 6L12 18l-5.5 2.5 1-6L3 10l6-1Z"/>',
    plus: '<path d="M12 4v16M4 12h16"/>',
    minus: '<path d="M4 12h16"/>',
    bike: '<circle cx="5" cy="17" r="4"/><circle cx="19" cy="17" r="4"/><path d="m5 17 5-10 4 10h-9m3-10h4m2-3h3l2 13"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    play: '<path d="m8 4 12 8-12 8Z"/>',
    history: '<path d="M4 7a9 9 0 1 1-1 8M3 3v5h5m4-1v5l4 2"/>',
    leaf: '<path d="M4 20C-3 7 12 2 21 3c2 11-5 21-17 17Zm0 0L16 8"/>',
    bowl: '<path d="M3 11h18c-1 7-5 10-9 10s-8-3-9-10Zm5-7v3m4-5v5m4-3v3"/>',
    spark:
      '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p[name] || p.bowl}</svg>`;
};
const brand = () =>
  `<span class="wordmark">플레오더<span class="wordmark-dot" aria-hidden="true"></span></span>`;
function foodArt(kind) {
  const file =
    {
      bowl: "bibimbap",
      bulgogi: "bibimbap",
      soup: "soup",
      chicken: "chicken",
      burger: "burger",
      salad: "salad",
      ramen: "ramen",
    }[kind] || "bibimbap";
  return `<img class="food-art food-photo" src="images/${file}.png" alt="" loading="lazy" decoding="async" width="1536" height="1024">`;
}
