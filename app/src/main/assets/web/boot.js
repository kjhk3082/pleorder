// Hydrate the local catalog before restoring orders that reference its records.
PleorderRealCatalog.ready.finally(() => {
  const script = document.createElement("script");
  script.src = "app.js";
  document.body.append(script);
});
