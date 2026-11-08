const icon = (name, size = 24) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${window.PleorderLucidePaths[name] || window.PleorderLucidePaths.bowl}</svg>`;
const brand = () =>
  `<img class="brand-symbol" src="logo-mark.png" alt=""><span class="wordmark">플레오더<span class="wordmark-dot" aria-hidden="true"></span></span>`;
function cardArt(card) {
  return card?.image ? `<span class="card-art ${card.issuer || ''}"><img src="${card.image}" alt="" decoding="async"></span>` : icon('card',24);
}
function menuArt(menu) {
  if (menu?.image) return sourcedPhoto({image:menu.image, name:menu.name}, menu.name);
  return menu?.demoMenu ? photoPlaceholder(menu.short || "메뉴", "테스트 메뉴") : foodArt(menu?.art);
}
function photoPlaceholder(name, label="사진 준비 중") {
  const letters=String(name || "가게").replace(/\(주\)|주식회사|\s/g, "").slice(0,2);
  const hue=Array.from(String(name)).reduce((a,c)=>a+c.charCodeAt(0),0)%3;
  return `<span class="photo-placeholder tone-${hue}" aria-hidden="true"><b>${safe(letters)}</b><small>${safe(label)}</small></span>`;
}
function sourcedPhoto(photo, fallback) {
  if (!/^images\/official\/[a-zA-Z0-9_.-]+$/.test(photo?.image || "")) return photoPlaceholder(fallback);
  return `<span class="sourced-photo">${photoPlaceholder(fallback)}<img class="food-photo official-photo" src="${safe(photo.image)}" alt="${safe(photo.name || fallback)} · ${photo.kind === 'place' ? '매장 사진' : '브랜드 공식 사진'}" loading="lazy" decoding="async"></span>`;
}
function storeArt(store, menu) {
  const photo=menu?.image ? {image:menu.image,name:menu.name,kind:'menu'} : store.photo;
  return photo ? sourcedPhoto(photo,store.name)+`<small class="example-photo">${photo.kind==='place'?'매장 사진':'브랜드 사진'}</small>` : photoPlaceholder(store.name);
}
document.addEventListener('error',event=>{
  if(event.target instanceof HTMLImageElement && event.target.closest('.sourced-photo'))event.target.remove();
},true);
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
