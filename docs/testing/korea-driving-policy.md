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

## 남은 시스템 조건

`MainActivity`는 DO 메타데이터를 선언하지 않는다. 그러므로 에뮬레이터는 `requiresDO=true`에서 여전히 시스템 차단 화면을 띄울 수 있다. 해당 화면의 문구·배경은 앱 소유가 아니다. 이번 수정으로 주행 중 전체 화면 사용이 승인됐다고 주장하지 않는다.

주행용 시각 UI를 제공하려면 실제로 DO 원칙을 충족하는 화면을 만들고 검토해야 한다. 풀 메뉴·설정 화면에 메타데이터만 추가해 차단을 제거하지 않았다. [Android DO/제한 구분](https://source.android.com/docs/automotive/driver_distraction/consume), [플래그 의미](https://developer.android.com/reference/android/car/drivingstate/CarUxRestrictions).

## 검증

- `tests/ux-policy.test.cjs`: 0x50에서 키보드·검색 유지, 다른 마스크의 키보드 제한, 주차 복원, 조건부 길이/항목 수, 알 수 없는 제한 차단.
- 브라우저 UI: 0x50에서 검색과 주문 요청 입력·결제 승인 컨트롤 유지, 설정 비활성화, 모션 중단. 0x5a에서 텍스트 입력 차단, 0x0에서 복원.
- 스크린샷: `pleorder-korea-0x50-checkout.png`는 플래그 주입 UI 검사다. 실제 D단 전체 화면 사용 성공 증거로 보지 않는다.
