// Hydrate the local catalog before restoring orders that reference its records.
Promise.allSettled([PleorderRealCatalog.ready, PleorderMapSdk.ready]).then(() => {
  const script = document.createElement("script");
  script.src = "app.js";
  document.body.append(script);
});
