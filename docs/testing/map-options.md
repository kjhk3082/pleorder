# Pleos 지도 관련 기능과 현재 지도 선택

2026-11-09 공식 문서와 설치된 NaviHelper 3.0.5 AAR의 공개 메서드를 대조했다.

## NaviHelper

목적지·경유지 설정/조회, 경로 옵션, 재탐색, 목적지/현재 위치/즐겨찾기/최근 목적지 조회, 경로 이벤트를 제공한다. `requestNavigationScreen(NavigationScreenRequest)`로 차량 내비 화면을 요청할 수 있다.

설치 SDK에서 확인한 화면 요청: `SearchPlace(keyword)`, `Foreground`, `MoveToCurrentLocationOnMap`, `OverviewRoute`, `RecentDestinations`, `FavoriteMain`, `POIDetailPopup`, `EditRoute` 등. 공개 API에서 앱 내부에 지도 뷰를 받아 임의의 라이더/매장 마커를 올리는 MapView 기능은 확인하지 못했다. 이는 차량 내비 화면 요청과 구분한다.

근거: [공식 소개](https://document.pleos.ai/docs/pleos-only/connect-sdk-pleos/NaviHelper/intro), [권한](https://document.pleos.ai/en/api-reference/connect-sdk-pleos/NaviHelper/declaring-permissions). 화면 요청에는 `NAVI_CUSTOM_MAP` 권한이 필요하다. 기능 제공 여부와 실제 응답은 내비 앱 구현 상태에 따라 다를 수 있다.

## 플레오더

현재 지도 표시는 Leaflet + OpenStreetMap, 장소 검색은 Photon, 앱의 도로 경로는 OSRM이다. 필수 구성은 아니다. 차량 내비의 목적지 읽기/경유 경로 요청에는 NaviHelper를 이미 사용한다. 지도 데이터를 바꾸는 일과 차량 길 안내 연동은 독립적으로 개선할 수 있다.

앱 지도 대안은 [카카오 지도](https://apis.map.kakao.com/web/guide/) 또는 [네이버 지도 SDK](https://navermaps.github.io/android-map-sdk/guide-ko/1.html)이다. 카카오 Web SDK는 지도·장소 검색·주소 좌표 변환을 제공하고 앱 키 및 도메인 등록이 필요하다. 네이버 Android SDK도 애플리케이션 등록과 클라이언트 ID가 필요하다. 차량 플랫폼에서의 지원·사용 조건 및 실제 기기 동작은 도입 시 확인해야 한다.

제안: 음식점/배달 현황은 앱 내부 지도, 픽업 길 안내는 Pleos 내비. 현재 턴에서는 지도 공급자를 교체하거나 새 서비스에 등록하지 않았다.
