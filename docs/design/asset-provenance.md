# 시각 자산

## 구현 디자인

현대 계열 네이비, 민트 상태색, 밝은 유리 질감과 배달 서비스의 메뉴·가격·상태 구조를 조합했다. 본문은 번들 Pretendard다. 사용자 승인 이미지 `codex-clipboard-15418ac9-f8ef-4f45-bc1f-5376429e81fd.png`를 참조해 이미지 생성 도구로 1254×1254 투명 P 마크를 제작했다. 웹의 `logo-mark.png`와 Android의 `pleorder_mark.png`는 동일 자산이다. 이전 수작업 SVG는 현재 화면에서 사용하지 않는다. 원본의 픽셀 추출본은 아니며 작은 형상 차이는 `design-qa.md`와 비교 이미지에 기록했다.

| Before | After | Why |
|---|---|---|
| 작은 P 위에 겹친 원형 장식/임시 ㅍ | 열린 P와 분리된 민트 점 | 사용자 선택 복원, 축소 시 획 중첩 제거 |
| 도형으로 흉내 낸 음식 | 각 메뉴의 사진 스타일 생성 자산 | 식별성과 음식의 질감 확보 |
| 로컬 폰트에 의존 | Pretendard Variable 번들 | 환경별 글꼴 차이 감소 |
| 이미지가 본문을 밀어냄 | 이미지·정보를 분리한 명시적 그리드 | 가격·이름 잘림 방지 |

## 음식 이미지

`app/src/main/assets/web/images/`의 음식 PNG는 2026-11-09 내장 이미지 생성 도구로 생성했다. 실제 매장·메뉴의 사진이라고 표시하지 않는다. 실매장 목록에서도 `예시`, 메뉴판에도 예시 사진임을 표시한다. 원본 사진 자산은 별도 저작권이 있는 음식점 이미지를 복제하지 않았다.

공통 프롬프트: “Create one photorealistic premium food product photograph for a Korean food ordering app. One single dish centered, elevated 35-degree camera, full bowl/plate visible including base, generous breathing room. Studio daylight from upper left, soft contact shadow, seamless warm ivory background approximately #F4F2EC. No table edge, props, cutlery, text, logos, collage, illustration or fake 3D render. Realistic ingredients and ceramic textures, natural warm grading. Wide landscape image, dish fills central 70 percent of width. Responsive food cards with object-fit contain.”

메뉴별 추가 내용:
- `bibimbap.png`: Korean bibimbap, cream ceramic bowl, rice, carrots, spinach, bean sprouts, mushrooms, beef and sunny-side-up egg.
- `soup.png`: clear Korean beef gukbap, charcoal ceramic bowl, shredded beef, scallions and rice; no noodles or egg.
- `chicken.png`: half golden fried chicken and half red yangnyeom chicken on an ivory plate.
- `burger.png`: brioche cheeseburger, grilled beef, cheddar, lettuce and tomato on an ivory plate.
- `salad.png`: grilled chicken breast, lettuce, tomatoes, avocado and corn in a cream bowl.
- `ramen.png`: tonkotsu broth, thin noodles, chashu, soft-boiled egg and scallions in a dark bowl.
- `tacos.png`: tacos with grilled meat and vegetables on an ivory plate, same studio framing.
- `pizza.png`: one baked pizza on an ivory plate, same studio framing.
- `coffee.png`: iced coffee and croissant, same studio framing.

## 라이브러리·데이터

- [Pretendard](https://github.com/orioncactus/pretendard): SIL Open Font License 1.1, 폰트와 OFL 사본을 함께 배포.
- [Leaflet 1.9.4](https://leafletjs.com/): BSD-2-Clause, `vendor/LEAFLET-LICENSE` 포함.
- [OpenStreetMap](https://www.openstreetmap.org/copyright): 지도 표시의 attribution 유지.
- [Lucide](https://lucide.dev/): 공식 SVG 경로를 번들링한 설정·현재 위치·상태 아이콘. ISC 라이선스 사본은 `vendor/LUCIDE-LICENSE`.
- [OSRM](https://project-osrm.org/docs/v5.24.0/api/): 13개 실제 도로 경로 응답의 URL/수집시각을 `routes.json`에 포함. 실시간 교통 시간이 아니다.

배민·현대·Apple 및 사용자가 제공한 디자인 문서는 참고 대상으로 읽었다. 해당 회사의 로고나 전용 폰트·상용 일러스트를 앱 자산으로 배포하지 않는다. Astryx/Glisse/Taste는 참고 조사 자료이며 런타임 의존성으로 사용하지 않는다.

## v7 추가 자산

`images/delivery-proof.png`는 2026-11-09 내장 이미지 생성 도구로 제작한 샘플이다. 문이 닫힌 현관 앞 회색 매트 위 무상표 종이봉투와 밀폐 용기를 촬영한 구도로, 인물·주소·상표가 없다. 실제 배송 증거로 사용하지 않으며 사진 화면에 샘플임을 표시한다.

프롬프트 요약: realistic delivery proof photograph, plain unbranded paper takeaway bag and sealed food container on a grey doormat outside a closed apartment door, no people, no address, no text or logos, natural daylight.

## 실제 장소·메뉴 데이터

- `seoul-places.json`: OpenStreetMap contributors, ODbL 1.0. 서울 행정구역 `KR-11` 안의 `restaurant`, `fast_food`, `cafe` 중 이름 있는 POI를 Overpass로 조회. 원본 타임스탬프 `2026-11-08T18:59:36Z`, 필터 후 45,488개 POI. 같은 이름·35m 내 중복은 표시할 때 묶는다. 완전한 서울 사업자 명부가 아니다.
- 제공 필드: OSM 식별자, 이름, 좌표, 분류, 주소, 전화, 사이트, 영업시간, 메뉴 URL, 음식 종류, 배달/포장 태그. 값이 없으면 미확인으로 표시한다. 원본 레코드 링크를 매장 정보에 제공한다.
- `delivery=yes/no`는 공개 지도 표기이며, 특정 주소로의 현재 배달 권역·접수 가능 여부를 보장하지 않는다. 주문/시간/배달팁은 시뮬레이션이다.
- `brand-menus.json`: [교촌 공식 메뉴판](https://www.kyochon.com/menu/chicken.asp)의 83개 메뉴명·권장소비자가격·원본 링크, 2026-11-09 수집. 지점별 메뉴 취급/가격은 다를 수 있다. 홍보 문구와 실제 메뉴 사진을 복제하지 않는다.
- [Photon](https://github.com/komoot/photon): OSM 기반 장소 검색·역지오코딩. 공개 데모 서버는 개발 테스트에 사용하며, 운영에서는 자체 호스팅 또는 계약된 제공자가 필요하다.
- 집 주소와 테스트 출발지 설정은 앱 로컬 저장소에만 보관하며, 사용자의 개별 주소를 저장소 기본 데이터에 하드코딩하지 않는다. 동·호수는 검색 요청에 포함하지 않는다.

재수집 스크립트 `tools/import-public-catalog.py`는 `.cache/places/seoul-osm.json`과 `.cache/places/kyochon.html`을 입력으로 사용한다. Overpass 원본 질의:

```text
[out:json][timeout:60];
area["ISO3166-2"="KR-11"]->.seoul;
nwr(area.seoul)["amenity"~"^(restaurant|fast_food|cafe)$"]["name"];
out center tags;
```
