const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const {OrderRepository,DATA}=require('../app/src/main/assets/web/core.js');
const root='app/src/main/assets/web/';const host={};
const hydration=(()=>{vm.runInNewContext(fs.readFileSync(root+'real-catalog.js','utf8'),{window:host,PleorderData:DATA,Map,fetch:async name=>({json:async()=>JSON.parse(fs.readFileSync(root+name,'utf8'))})});return host.PleorderRealCatalog.ready;})();
test('public catalog hydrates unique Seoul places and preserves cuisine provenance',async()=>{await hydration;assert.ok(DATA.realStores.length>40000);assert.equal(new Set(DATA.realStores.map(s=>s.id)).size,DATA.realStores.length);const vatos=DATA.realStores.find(s=>s.name.includes('바토스파르나스'));assert.equal(vatos.category,'멕시칸');assert.match(vatos.sourceUrl,/openstreetmap.org/);});
test('official brand menu prices create and restore a multi-item simulated order',async()=>{await hydration;const r=new OrderRepository({now:0});const rec=r.recommend('교촌치킨')[0];assert.ok(rec.store.name.includes('교촌'));const items=DATA.menusForStore(rec.store);assert.ok(items.length>20);assert.ok(items.every(m=>m.officialMenu&&m.price>0));r.prepare({mode:'pickup',items:items.slice(0,2).map(m=>({menuId:m.id,quantity:1}))});const expected=items[0].price+items[1].price;assert.equal(r.draft.total,expected);r.confirm(r.draft.id,true);const restored=OrderRepository.restore(r.serialize());assert.equal(restored.orders.length,1);assert.ok(restored.store(rec.store.id));assert.equal(restored.menu(items[0].id).price,items[0].price);});
test('unknown merchant menu is explicitly marked as sample instead of sourced',async()=>{await hydration;const store=DATA.realStores.find(s=>!s.name.includes('교촌'));const menu=DATA.menuForStore(store);assert.equal(menu.demoMenu,true);assert.notEqual(menu.officialMenu,true);});

test('official menu photos resolve to files, with branch-independent brand photo provenance',async()=>{
 await hydration;
 const kyochon=DATA.realStores.find(s=>s.name.includes('교촌'));
 const menus=DATA.menusForStore(kyochon);assert.ok(menus.length>=83);
 for(const menu of menus){assert.ok(fs.existsSync(root+menu.image));assert.match(menu.imageSource,/https:\/\/www.kyochon.com\//);}
 const starbucks=DATA.realStores.find(s=>s.name.startsWith('스타벅스'));
 assert.equal(starbucks.photo.kind,'brand');assert.match(starbucks.photo.sourcePage,/starbucks.co.kr/);
 const ordinary=DATA.realStores.find(s=>s.name==='화덕쪽갈비');assert.ok(ordinary);assert.equal(ordinary.photo,null);
 const catalog=JSON.parse(fs.readFileSync(root+'place-photos.json','utf8'));
 for(const brand of catalog.brands)for(const photo of brand.photos){assert.ok(fs.existsSync(root+photo.image));assert.ok(photo.sourcePage.startsWith('https://'));}
});

test('real merchants without sourced photos never receive an unrelated sample food photograph',()=>{
 const context={window:{PleorderLucidePaths:{}},document:{addEventListener(){}},HTMLImageElement:class{}};vm.createContext(context);
 vm.runInContext(fs.readFileSync(root+'icons.js','utf8'),context);vm.runInContext(fs.readFileSync(root+'product-views.js','utf8'),context);
 const result=vm.runInContext('storeArt({name:"연희수산",photo:null},{demoMenu:true,art:"bowl"})',context);
 assert.match(result,/photo-placeholder/);assert.doesNotMatch(result,/<img|bibimbap/);
 const bad=vm.runInContext('sourcedPhoto({image:"https://unverified.invalid/photo.jpg"},"가게")',context);assert.doesNotMatch(bad,/<img/);
});

test('known no-delivery policy is enforced in preparation and confirmation, including requested pickup voice mode',async()=>{
  await hydration;
  const store=DATA.realStores.find(s=>s.delivery==='no'&&s.takeaway==='yes');
  assert.ok(store);
  const menu=DATA.menuForStore(store),r=new OrderRepository({now:0});r.home={...store};
  r.prepare({items:[{menuId:menu.id,quantity:1}],mode:'pickup'});
  assert.equal(r.prepare({items:r.draft.items,mode:'delivery'}).status,'fail');
  r.draft.mode='delivery';
  assert.equal(r.confirm(r.draft.id,true).status,'fail');assert.equal(r.payments.transactions.length,0);
  r.draft=null;r.mode='delivery';
  const action=r.handleAction('PREPARE_FOOD_ORDER',{query:store.name,fulfillment:'pickup',quantity:1});
  assert.equal(action.status,'asking');assert.equal(r.draft.mode,'pickup');
  assert.equal(r.store(r.draft.storeId).name,store.name);
});
