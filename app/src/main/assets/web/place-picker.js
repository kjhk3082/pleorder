window.PleorderPlaces = (() => {
  let picker,
    marker,
    candidate,
    sequence = 0;
  const cache = new Map();
  const endpoint = "https://photon.komoot.io";
  const pinIcon = () =>
    L.divIcon({
      className: "picker-pin",
      html: '<svg width="38" height="46" viewBox="0 0 38 46"><path d="M19 44S2 29 2 19a17 17 0 0 1 34 0c0 10-17 25-17 25Z" fill="#164a6c" stroke="white" stroke-width="2"/><circle cx="19" cy="18" r="6" fill="white"/></svg>',
      iconSize: [38, 46],
      iconAnchor: [19, 44],
    });
  const normalize = PleorderLocation.normalize;
  async function get(path) {
    if (cache.has(path)) return cache.get(path);
    const response = await fetch(endpoint + path, {
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw Error("검색 서비스 응답 지연");
    const json = await response.json();
    const places = (json.features || []).map(normalize).filter(Boolean);
    cache.set(path, places);
    return places;
  }
  function destroy() {
    sequence++;
    if (picker) {
      picker.remove();
      picker = null;
    }
    marker = null;
    candidate = null;
  }
  function renderCandidate(place, exact = true) {
    candidate = place;
    document.getElementById("placeName").value = place.name;
    document.getElementById("placeAddress").value = place.description;
    document.getElementById("placeNotice").textContent = exact
      ? "선택한 장소의 위치와 주소를 확인해 주세요."
      : "선택한 지점 주변의 주소입니다. 정확한 수령 장소를 확인해 주세요.";
    document.getElementById("savePlace").disabled = !place.description;
    if (marker) marker.setLatLng([place.lat, place.lng]);
    else
      marker = L.marker([place.lat, place.lng], { icon: pinIcon() }).addTo(
        picker,
      );
  }
  async function reverse(lat, lng) {
    const token = ++sequence;
    candidate = {lat,lng,name:"선택한 장소",description:""};
    document.getElementById("placeName").value="선택한 장소";
    document.getElementById("placeAddress").value="";
    document.getElementById("placeNotice").textContent =
      "주소를 확인하고 있어요…";
    document.getElementById("savePlace").disabled = true;
    try {
      const places = await get(
        `/reverse?lat=${lat}&lon=${lng}&limit=1&lang=default`,
      );
      if (token !== sequence || !picker) return;
      if (!places.length) throw Error("no address");
      renderCandidate({ ...places[0], lat, lng }, false);
    } catch {
      if (token !== sequence || !picker) return;
      candidate = { lat, lng, name: "선택한 장소", description: "" };
      document.getElementById("placeName").value = "선택한 장소";
      document.getElementById("placeAddress").value = "";
      document.getElementById("placeNotice").textContent =
        "주소를 찾지 못했어요. 도로명주소를 직접 입력하거나 다른 지점을 선택해 주세요.";
    }
  }
  function open(initial, onSelect, options = {}) {
    destroy();
    modal(
      options.title || "배달받을 위치",
      "장소를 검색하거나 지도에서 선택하세요",
      `<form id="placeSearch" class="place-search"><input id="placeQuery" class="field" aria-label="장소 또는 주소 검색" placeholder="예: 롯데호텔 서울, 올림픽로 300" maxlength="120"><button type="button" class="icon-button" data-action="voice-place" aria-label="목적지 음성 입력">${icon("mic", 22)}</button><button type="submit" class="button primary">검색</button></form><div id="placeResults" class="place-results"></div><div id="placeMap" class="place-map" aria-label="수령 위치 선택 지도"></div><p class="micro-note">© OpenStreetMap · Photon 장소 검색</p><p id="placeNotice" class="place-notice" role="status">지도에서 정확한 수령 지점을 선택해 주세요.</p><div class="place-fields"><label>장소 이름<input id="placeName" class="field" maxlength="40" placeholder="예: 여행 숙소"></label><label>주소<input id="placeAddress" class="field" maxlength="160" placeholder="도로명주소"></label><label class="place-detail-label">상세주소<div class="voice-field"><input id="placeDetail" class="field" maxlength="80" placeholder="동·호수, 로비 등"><button type="button" class="icon-button" data-action="voice-detail" aria-label="상세주소 음성 입력">${icon("mic", 22)}</button></div></label></div><button id="savePlace" class="button primary full-width" disabled>이 위치로 설정</button>`,
      "place-picker",
    );
    const footer = document.createElement("div");
    footer.className = "place-picker-footer";
    footer.appendChild(document.getElementById("savePlace"));
    document.getElementById("modalContent").appendChild(footer);
    picker = L.map("placeMap", { scrollWheelZoom: false }).setView(
      [initial.lat, initial.lng],
      16,
    );
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(picker);
    renderCandidate({...initial,description:initial.description || ""});
    document.getElementById("placeDetail").value = initial.detail || "";
    picker.on("click", (e) => {
      if (marker) marker.setLatLng(e.latlng);
      else marker = L.marker(e.latlng, { icon: pinIcon() }).addTo(picker);
      reverse(e.latlng.lat, e.latlng.lng);
    });
    setTimeout(() => picker?.invalidateSize(), 100);
    document
      .getElementById("placeSearch")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        const q = document.getElementById("placeQuery").value.trim();
        if (q.length < 2) return;
        const token = ++sequence;
        const results = document.getElementById("placeResults");
        results.textContent = "장소를 찾고 있어요…";
        try {
          const {detail} = PleorderLocation.splitQuery(q);
          const places = await PleorderLocation.search(q, initial);
          if (detail) document.getElementById("placeDetail").value = detail.slice(0,80);
          if (token !== sequence || !picker) return;
          results.innerHTML = places.length
            ? places
                .map(
                  (p, i) =>
                    `<button type="button" class="place-result" data-place-result="${i}"><strong>${safe(p.name)}</strong><span>${safe(p.description || "주소 정보 없음")}</span></button>`,
                )
                .join("")
            : "검색 결과가 없어요. 도로명주소나 건물명으로 다시 검색해 주세요.";
          results.querySelectorAll("[data-place-result]").forEach(
            (b) =>
              (b.onclick = () => {
                const p = places[Number(b.dataset.placeResult)];
                renderCandidate(p);
                picker.setView([p.lat, p.lng], 17);
                results.innerHTML = "";
              }),
          );
        } catch {
          if (token === sequence && picker)
            results.textContent =
              "검색 연결이 원활하지 않아요. 잠시 후 다시 검색하거나 지도에서 선택해 주세요.";
        }
      });
    document
      .getElementById("placeAddress")
      .addEventListener(
        "input",
        () => {
          sequence++;
          document.getElementById("savePlace").disabled =
            !candidate ||
            document.getElementById("placeAddress").value.trim().length < 3;
        },
      );
    document.getElementById("savePlace").onclick = () => {
      if (!candidate) return;
      const place = {
        ...candidate,
        id: "place-" + Date.now(),
        name:
          document.getElementById("placeName").value.trim() || candidate.name,
        description: document.getElementById("placeAddress").value.trim(),
        detail: document.getElementById("placeDetail").value.trim(),
      };
      if (!place.description) return;
      destroy();
      onSelect(place);
    };
  }
  return {
    open,
    destroy,
    normalize,
    selected: () => candidate && ({...candidate, name:document.getElementById("placeName").value.trim(), description:document.getElementById("placeAddress").value.trim(), detail:document.getElementById("placeDetail").value.trim()}),
    search: (query) => {
      const field = document.getElementById("placeQuery");
      if (field) {
        field.value = query;
        document.getElementById("placeSearch").requestSubmit();
      }
    },
  };
})();
