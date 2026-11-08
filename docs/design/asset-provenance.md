# 시각 자산

## 구현 디자인

현대 계열 네이비 `#002c5f`, 밝은 중성 배경, 배달 서비스의 메뉴·가격·상태 구조를 조합했다. 음식 사진과 정보를 구분하고 동일 화면에서 배달과 픽업을 선택한다. 작은 크기에서 겹치던 P 마크를 제거하고 본문은 번들 Pretendard, 헤더는 간결한 한글 워드마크를 사용한다. 앱 실행 아이콘은 코드로 작성한 `ㅍ` 기반 SVG/VectorDrawable이다.

| Before | After | Why |
|---|---|---|
| 작은 P 위에 겹친 원형 장식 | 한글 워드마크와 분리된 점 | 축소 시 획이 겹치는 문제 제거 |
| 도형으로 흉내 낸 음식 | 각 메뉴의 사진 스타일 생성 자산 | 식별성과 음식의 질감 확보 |
| 로컬 폰트에 의존 | Pretendard Variable 번들 | 환경별 글꼴 차이 감소 |
| 이미지가 본문을 밀어냄 | 이미지·정보를 분리한 명시적 그리드 | 가격·이름 잘림 방지 |

## 음식 이미지

`app/src/main/assets/web/images/`의 여섯 PNG는 2026-11-09 내장 이미지 생성 도구로 생성했다. 실제 매장 사진이라고 표시하지 않으며, 가상 메뉴 전용이다. 원본 사진 자산은 별도 저작권이 있는 음식점 이미지를 복제하지 않았다.

공통 프롬프트: “Create one photorealistic premium food product photograph for a Korean food ordering app. One single dish centered, elevated 35-degree camera, full bowl/plate visible including base, generous breathing room. Studio daylight from upper left, soft contact shadow, seamless warm ivory background approximately #F4F2EC. No table edge, props, cutlery, text, logos, collage, illustration or fake 3D render. Realistic ingredients and ceramic textures, natural warm grading. Wide landscape image, dish fills central 70 percent of width. Responsive food cards with object-fit contain.”

메뉴별 추가 내용:
- `bibimbap.png`: Korean bibimbap, cream ceramic bowl, rice, carrots, spinach, bean sprouts, mushrooms, beef and sunny-side-up egg.
- `soup.png`: clear Korean beef gukbap, charcoal ceramic bowl, shredded beef, scallions and rice; no noodles or egg.
- `chicken.png`: half golden fried chicken and half red yangnyeom chicken on an ivory plate.
- `burger.png`: brioche cheeseburger, grilled beef, cheddar, lettuce and tomato on an ivory plate.
- `salad.png`: grilled chicken breast, lettuce, tomatoes, avocado and corn in a cream bowl.
- `ramen.png`: tonkotsu broth, thin noodles, chashu, soft-boiled egg and scallions in a dark bowl.

## 라이브러리·데이터

- [Pretendard](https://github.com/orioncactus/pretendard): SIL Open Font License 1.1, 폰트와 OFL 사본을 함께 배포.
- [Leaflet 1.9.4](https://leafletjs.com/): BSD-2-Clause, `vendor/LEAFLET-LICENSE` 포함.
- [OpenStreetMap](https://www.openstreetmap.org/copyright): 지도 표시의 attribution 유지.
- [OSRM](https://project-osrm.org/docs/v5.24.0/api/): 13개 실제 도로 경로 응답의 URL/수집시각을 `routes.json`에 포함. 실시간 교통 시간이 아니다.

배민·현대·Apple 및 사용자가 제공한 디자인 문서는 참고 대상으로 읽었다. 해당 회사의 로고나 전용 폰트·상용 일러스트를 앱 자산으로 배포하지 않는다. Astryx/Glisse/Taste는 참고 조사 자료이며 런타임 의존성으로 사용하지 않는다.
