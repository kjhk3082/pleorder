const icon = (name, size = 24) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${window.PleorderLucidePaths[name] || window.PleorderLucidePaths.bowl}</svg>`;
const brand = () =>
  `<img class="brand-symbol" src="logo-mark.png" alt=""><span class="wordmark">플레오더<span class="wordmark-dot" aria-hidden="true"></span></span>`;
function foodArt(kind) {
  const file =
    {
      bowl: "bibimbap",
      tacos: "tacos",
      pizza: "pizza",
      coffee: "coffee",
      bulgogi: "bibimbap",
      soup: "soup",
      chicken: "chicken",
      burger: "burger",
      salad: "salad",
      ramen: "ramen",
    }[kind] || "bibimbap";
  return `<img class="food-art food-photo" src="images/${file}.png" alt="" loading="lazy" decoding="async" width="1536" height="1024">`;
}
