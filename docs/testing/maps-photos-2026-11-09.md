# Naver map, payment cards and sourced photographs

## Data and presentation

- 83 Kyochon menu photos are joined to the corresponding official product IDs in `brand-menus.json`.
- `place-photos.json` adds 29 official photos: Starbucks (1), Mega MGC Coffee (20), Ediya (8). Brand aliases match 626 catalog entries; Kyochon official menus cover a further 57 entries.
- Brand photos are labeled as such; they are not branch photographs. The price/menu/order simulation distinction remains intact.
- Every photo has its original URL and source page. Downloads are packaged as local assets, with lazy loading and an image-error fallback. The sources retain their rights; the importer does not grant a redistribution license.
- Unknown restaurants no longer inherit a bibimbap photograph. Hwadeok ribs and Yeonhui fish shop remain without a verified photo; uncertain web matches were excluded.
- Naver Maps / Local Search do not supply a place-photo field. Naver Developers Image Search is a separate API/credential, not the Naver Cloud Maps secret. Search results still require branch verification.

| Before | After | Why |
| --- | --- | --- |
| Same example meal on unrelated real restaurants | Sourced photo or restrained name tile | Avoid implying that a merchant sells the pictured food |
| Photo with no provenance | Brand label and source in store detail | Distinguish brand imagery from a branch/menu claim |
| Broken image icon on load failure | Stable name tile beneath the photo | Keep the card dimensions and navigation usable |
| Card A/B/C displayed | Hyundai M, Shinhan Mr.Life, Samsung taptap O with official imagery | Make the mock wallet identifiable |
| Empty order panel's border across the map | Empty panel hidden | Remove the stray white line |

## Sources

- [Kyochon menu](https://www.kyochon.com/menu/chicken.asp): per-product pages and photo URLs recorded in the catalog.
- [Starbucks iced Americano](https://www.starbucks.co.kr/menu/drink_view.do?product_cd=110563).
- [Mega MGC official menu](https://www.mega-mgccoffee.com/menu/menu.php?category=1&menu_category1=1&menu_category2=1&page=1).
- [Ediya official drinks](https://ediya.com/contents/drink.html).
- [Hyundai M](https://www.hyundaicard.com/cpc/cr/CPCCR0201_01.hc?cardWcd=ME4), [Hyundai Card wordmark](https://commons.wikimedia.org/wiki/File:Hyundai_Card_logo.svg).
- [Shinhan Mr.Life](https://www.shinhancard.com/pconts/html/card/apply/credit/1187937_2207.html), [Samsung taptap O](https://www.samsungcard.com/home/card/cardinfo/PGHPPCCCardCardinfoDetails001?code=AAP1483).
- [Naver Image Search](https://developers.naver.com/docs/serviceapi/search/image/image.md), [Naver Local Search](https://developers.naver.com/docs/serviceapi/search/local/local.md).

## Functional changes

- Naver dynamic maps and marker adapter cover the journey map and location picker; geocoding handles road addresses, reverse geocoding resolves map clicks. Place-name search remains Photon.
- Directions 5 car routes go through a loopback-only HTTPS development server. Only rounded coordinates are sent; detailed addresses and the secret never enter the request body/APK. A 60-second cache, in-flight deduplication and 60 upstream calls/minute bound repeated requests.
- Courier movement supports four visual transport types, with simulation clearly identified. Courier route geometry is currently an OSRM automobile road reference, **not mode-specific bicycle or walking routing**, and no live courier feed is connected.
- Vehicle live coordinates take precedence over simulation. Current-location focus follows the displayed position; dragging cancels follow.
- DEMO keeps its name/colors and clears orders, drafts, payments, history and simulation progress. Saved destinations/origin remain configured.
- Named-card voice selection changes the method and still requires an explicit fresh approval. Test balance/decline behavior remains internal to the simulator.

## Validation

- 109 Node tests pass, including new route conversion/cache/validation, courier interpolation, reset isolation, named-card speech commands and sourced photo provenance cases.
- Android debug build and install succeed. Device visual checks are recorded locally under `.cache`, not committed with personal destination state.
- Dynamic Maps auth, address geocoding, reverse geocoding and a real Directions 5 response have been exercised on the Pleos emulator.
- The address picker returned Gangnam-gu Office from its road address, retained the fictitious unit detail separately and rendered the Naver map/pin with no broken images. The destination was not saved during this check.
- Runtime checks confirmed four courier icons, vehicle movement on loaded road geometry, current-location following and DEMO reset of a paid simulated order. The user's prior saved state was restored afterward.
- APK inspection found no Naver Client Secret; the map config contains only the public ID and local route endpoint.
- Real courier tracking, merchant ordering and card charging remain unconnected. This work does not claim a new end-to-end microphone/Gleo test.
