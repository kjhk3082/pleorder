# 한국 대상 주행 UX 정책 · 2026-11-09

## 확인한 정책과 코드 수정

한국 출시 기준이다. 한국을 북미 표에 맞추거나 `D단`, `속도 0`, `브레이크 입력` 하나로 기능을 잠그거나 해제하지 않는다. 지역별 규정은 차량이 계산해 주는 `CarUxRestrictions`의 실제 비트마스크로 반영한다.

[Pleos 지역별 정책](https://document.pleos.ai/docs/pleos-only/vehicle-app-planning-guide/driving-restiction-policy)의 그외 지역 표에는 주행 중 키보드·다이얼패드·검색이 허용되어 있다. 앱은 국가 분류를 자체 추정하지 않는다. [공식 개발 가이드](https://document.pleos.ai/docs/pleos-only/vehicle-app-developer-guide/driving-restriction-development-guide)는 플랫폼이 지역별 `ActiveRestrictions`를 전달하므로 그 값을 반영하도록 명시한다.

| Before | After | Why |
|---|---|---|
| `isRequiresDistractionOptimization()` 하나를 전체 잠금으로 처리 | DO 요구 여부와 실제 제한 비트 전달을 분리 | DO 대상 Activity 자격과 개별 기능 제한은 다름 |
| 지역을 구분하지 않는 화면 조작 불가 안내 | 제한된 설정/입력만 비활성화 | 허용된 기능까지 북미 기준으로 잠그지 않음 |
| D단 정차도 무조건 화면 입력 금지라고 설명 | 실제 차량 제한에 따라 판단 | 정차/브레이크 자체는 허용·금지의 충분조건이 아님 |

## 실제 에뮬레이터 근거

`adb -s emulator-5554 shell dumpsys car_service --services CarUxRestrictionsManagerService`:

| 상태 | DO 요구 | 제한 마스크 |
|---|---:|---:|
| parked | false | `0x0` |
| idling | true | `0x50` |
| moving | true | `0x50` |
| unknown | true | `0x1ff` |

`0x50 = 16(NO_VIDEO) + 64(NO_SETUP)`이다. 키보드(8), 검색 필터(2), 음성 전사(256), 문자열 길이(4), 콘텐츠 수(32)는 이 마스크에 없다. 반환된 길이 120·항목 수 21·깊이 3은 해당 제한 비트가 없으면 강제로 적용하지 않는다.

앱은 설정·카드 등록/기본값 관리만 제한하고, 저장 카드 선택·주문 요청 입력은 유지한다. DO 상태에서는 반복 애니메이션과 장식 전환을 중단한다. 전체 제한 또는 정책 읽기 실패 시에만 앱 자체 블러 안내가 적용된다. 마이크 주문과 Gleo 배경 함수 계약은 별도다.

## 별도 주행 화면과 실제 표시 검증

`DrivingActivity`만 `distractionOptimized=true`를 선언한다. 앱 진입 및 차량 제한 변경 때 `CarUxRestrictions`에 따라 주차용 `MainActivity`와 전환한다. 주행 화면은 음성 주문·금액/카드 확인·현황·미결제 취소만 제공하며 지도, 메뉴 탐색, 설정, 반복 모션을 제거했다. 두 화면은 동일한 저장소를 사용한다. 이 선언은 심사 승인이나 실차 안전 인증을 의미하지 않는다.

2026-11-09 최종 검증에서 **D단 정차, D단 콜드 실행, 에뮬레이터 27km/h 주행 상태에서 실제 시스템 화면에 주행 UI가 보임**을 확인했다. 처음에는 CDP 내부 렌더링만 보고 성공을 잘못 판단했고, 다음에는 일반 CarPackageManager의 false 결과를 Pleos 차단의 직접 원인으로 잘못 단정했다. 최종 결과는 Pleos HomeScreen의 태스크 판정 로그와 전체 시스템 캡처를 기준으로 한다.

| 확인 대상 | 실제 결과 |
|---|---|
| 실행 중 화면 | `dev.pleorder.app/.DrivingActivity` |
| Pleos 런처의 새 태스크 판정 | `DrivingActivity ... distractionOptimized: true` |
| 일반 CarPackageManager 조회 | `PLATFORM_DO_RECOGNIZED=false activity=DrivingActivity` — 실제 Pleos 표출과 다름 |
| 차량 제한 | D / 0 km/h, `DO=true mask=0x50` |
| 빌드 종류 | `ro.build.type=user`, `ro.debuggable=0` |
| 설치 출처 | `installer=null` (ADB 설치) |
| CarService 로그 | `dev.pleorder.app not installed from permitted sources NULL` |
| CarServiceUpdatable 리소스 | `array/allowedAppInstallSources`, size=0 |
| 적용 오버레이 | `CarServiceOverlayCuttleFish.apk`에 해당 배열 재정의 없음 |

[AOSP CarPackageManagerService](https://android.googlesource.com/platform/packages/services/Car/+/master/service/src/com/android/car/pm/CarPackageManagerService.java)의 설치 출처 검사는 일반 API가 false인 이유를 설명하지만 **이 값이 Pleos HomeScreen의 최종 차단 판정과 같다는 증거는 없다**. 실제로 같은 조건에서 Pleos 런처는 새 DrivingActivity 태스크를 DO=true로 기록했고 화면을 표시했다. API false만으로 개발 이미지 교체나 추가 설치 승인이 필수라고 단정하지 않는다.

변경 전 일반 화면/기존 태스크가 남은 실행과 새 주행용 태스크의 판정이 달랐다. `tools/Build-Pleorder.ps1`는 설치 후 앱 태스크를 종료하고 DO를 선언한 DrivingActivity로 새로 실행하도록 수정했다. 기존 태스크의 런처 판정 캐시가 원인에 관여한 것으로 추정되며, 정확한 OEM 내부 캐시 구현까지 검증한 것은 아니다. 주차 시 MainActivity, DO 요구 시 DrivingActivity로 전환한다. P→D→P 왕복 후 주문 1건·거래 1건이 보존됐다.

[공식 ADB 안내](https://document.pleos.ai/docs/pleos-only/vehicle-app-developer-guide/adb-command-reference-guide)의 `hmg_car_service`는 현재 이미지에 없었다. 주행 규제를 강제로 끄거나 설치 출처를 위장한 조치는 하지 않았다. 새 화면의 DO 선언과 정상 태스크 실행으로 검증했다. 제품 심사·실차 안전 검증을 통과했다는 의미는 아니다.

Gleo의 service 방식 주문도 별도로 실행된다. [실제 음성 검증](gleo-voice-e2e.md)을 참고한다. 30km/h 입력 후 콘솔의 감속을 반영한 **27km/h 전체 시스템 캡처**는 `pleorder-driving-27kmh.png`이며, 주행 중 Gleo 현황 조회 콜백도 성공했다. 시험 후 속도 0/P로 복원했다.

## 검증

- `tests/ux-policy.test.cjs`: 0x50에서 키보드·검색 유지, 다른 마스크의 키보드 제한, 주차 복원, 조건부 길이/항목 수, 알 수 없는 제한 차단.
- 브라우저 UI: 0x50에서 검색과 주문 요청 입력·결제 승인 컨트롤 유지, 설정 비활성화, 모션 중단. 0x5a에서 텍스트 입력 차단, 0x0에서 복원.
- 스크린샷: `pleorder-korea-0x50-checkout.png`는 플래그 주입 UI 검사다. 실제 D단 전체 화면 사용 성공 증거로 보지 않는다.

### 추가 확인 · 브레이크와 콘솔

2026-11-09, D단·0km/h에서 Virtual Console의 `brake_pct=100` 및 `brake_pressed=true`를 확인한 뒤에도 시스템 값은 `DO=true, UxR=80(0x50)`으로 유지됐다. 실험 후 원래 브레이크 값으로 복원했다. 이 이미지에서는 풋브레이크만으로 주차 정책으로 바뀌지 않는다.

`/vehicle/catalog`의 전체 제어 목록에 국가·지역 또는 DO 해제 항목은 없었다. 속도·기어·브레이크를 조정하는 콘솔이며 지역 정책 선택 UI로 보지 않는다.

공식 문서는 DO 미선언 앱의 사용 가능 여부와 지역별 기능 허용 표를 별도로 제시한다. DO 요구가 키보드·검색 금지를 뜻하지 않는다. 앱의 간소한 주행 화면은 제품 구현 선택이며 한국에서 모든 터치/검색이 금지됐다는 근거가 아니다. 최종 앱은 플랫폼의 실제 제한 플래그를 반영한다.
