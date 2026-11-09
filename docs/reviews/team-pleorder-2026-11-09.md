# 팀원 PleOrder 소스 재사용 검토

이 문서는 통합 전 분석 기록이다. 이후 구현과 재검증은 [통합 결과](../testing/team-integration-2026-11-09.md)에 별도로 기록했다.

검토일: 2026-11-09. 팀원 저장소 `ars2323/PleOrder`의 `bb91d112f40657c00d9cc9ad0888ef2c59249606`과 우리 저장소 `kjhk3082/pleorder`의 `ac73449cc32c9a3422e238c4b06ffa2380733b31`을 비교했다.

**추천: 우리 앱의 화면·실제 장소/사진·지도·결제 저장소에 팀원의 대화 처리, 개인화, 예약 추적, 음성 QA를 선별 이식한다.** 팀원 앱 전체로 교체하거나 주문 엔진 두 개를 함께 운영하는 방식은 권하지 않는다.

## 확인 범위와 근거

- 팀원 앱: Kotlin + Android View 기반 상태 패널. 순수 `core`와 Android 내비/서비스 계층이 분리되어 있다. Compose 앱은 아니다.
- 본 앱 Kotlin 소스 약 3,846 비공백 줄, 가상 브랜드 8개·매장 30개. 실제 식당 사진이나 지도 기반 메뉴 수집기는 확인되지 않았다.
- `core`와 기존 테스트를 별도 JVM에서 컴파일해 **69개 단위 테스트 모두 통과**했다. APK 설치·Gleo 음성 재실행은 하지 않았다.
- 검증 환경: 기존 캐시의 Kotlin compiler 2.0.21을 language/api 1.9 모드로 사용, JVM target 17, coroutines 1.9.0, JUnit 4.13.2, JSON 20231013. 팀원 원본 Gradle(Kotlin 1.9.22 / coroutines 1.7.3)의 Android 빌드와 동일한 환경은 아니다. 이번 결과는 순수 로직 검증에 한정한다.
- 테스트 실행기와 결과는 `.cache/team-pleorder-review/review-jvm/`에 저장했다. 대형 APK·음성 파일·스크린샷은 받지 않았다.
- 팀원 음성 실험 보고서와 원본 결과 JSON 세 건을 대조했다. 아래 E2E 성공률은 팀원 환경의 기록이며 이번 PC에서 새로 측정한 수치가 아니다.

## 우선 가져올 부분

| 우선순위 | 소스 | 우리 앱에 생기는 개선 | 이식 판단 |
|---|---|---|---|
| 1 | `core/text/Text.kt`, `MenuMatcher.kt`, `mock/lexicon.json` | “아아 두 잔”, “두 번째 걸로”, “아니 두 개로”, “덜 맵게”, 여러 사람의 메뉴를 구분. 정확 일치·별칭·부분 일치·모호한 메뉴 되묻기 | 순수 로직과 사례를 JS로 이식하기 좋음. 긍정/부정 승인 판정은 제외하고 재작성 |
| 1 | `core/dialog/Conversation.kt`, `DialogEngine.kt`, `schema/schema.template.json` | 메뉴 탐색 → 후보 선택 → 옵션 질문 → 초안 확인을 여러 턴으로 유지. 더 보기·가격·인분·세트 구성·수량 수정·저장 장바구니 | 가장 큰 기능 보완. 조회/장바구니 처리만 나누어 이식하고 우리 `CONFIRM_FOOD_ORDER`의 명시적 승인 유지 |
| 2 | `core/assist/History.kt`, `Scoring.kt` | “늘 먹던 거”와 “지난번 거” 구분, 옵션까지 복원, 시간대·요일·목적지 종류별 추천, 최근 먹은 종류 제외, 기다림/우회 비교 | 우리 `catalog.js`의 거리+최근 주문 순위보다 풍부. 실제 완료 주문 기록과 연결하는 추가 작업 필요 |
| 2 | `Tracker.kt`, `core/timing/Timing.kt`, `RouteJudge.kt`, `service/Services.kt` | 배달·픽업 도착 시각에서 주문 전송 시각 역산, 정체에 따른 예약 조정, 앱 종료 후 복원, 추적 상실 시 보류 | 제품 차별화 가치 큼. 아래 예약 경계 오류를 수정하고 Android 서비스/우리 저장소를 연결해야 함 |
| 2 | `car/NaviGateway.kt` | 내비 즐겨찾기 HOME/OFFICE 읽기, 목적지까지 남은 시간, 후보 매장 ETA 조회, 기존 경유지 확인·추가·삭제, 요청 응답 구분 | 우리 `NavigationController.java`를 보강할 좋은 재료. 콜백만 믿지 않고 결과 재조회·요청별 검증 필요 |
| 1~3 전체 과정 | `scripts/e2e/`, `scripts/voice_test.py`, `docs/07-sdk-deep-dive.md` | P/D0/D40, 전경/배경/강제 종료/분할 화면에서 실제 음성 입력·콜백·주문 상태·지연을 반복 검증 | 시나리오/기대 결과와 실패 분류를 우선 재사용. Linux 음성 재생 부분은 우리 Windows 도구로 교체 |
| 후속 | `core/order/Orders.kt`의 `byUrgency()` 및 복수 주문 구조 | 가는 길 커피 픽업과 호텔 치킨 배달을 동시에 진행하고, “주문 어떻게 됐어?”에 급한 주문부터 응답 | 우리 앱은 진행 중 주문 1개 제한이 있으므로 별도 기능 변경으로 다룰 것 |

주요 원본: [한국어 파싱](https://github.com/ars2323/PleOrder/blob/bb91d112f40657c00d9cc9ad0888ef2c59249606/app-android/app/src/main/java/com/pleorder/app/core/text/Text.kt), [메뉴 매칭](https://github.com/ars2323/PleOrder/blob/bb91d112f40657c00d9cc9ad0888ef2c59249606/app-android/app/src/main/java/com/pleorder/app/core/text/MenuMatcher.kt), [개인화](https://github.com/ars2323/PleOrder/blob/bb91d112f40657c00d9cc9ad0888ef2c59249606/app-android/app/src/main/java/com/pleorder/app/core/assist/History.kt), [예약 추적](https://github.com/ars2323/PleOrder/blob/bb91d112f40657c00d9cc9ad0888ef2c59249606/app-android/app/src/main/java/com/pleorder/app/Tracker.kt), [내비 연결](https://github.com/ars2323/PleOrder/blob/bb91d112f40657c00d9cc9ad0888ef2c59249606/app-android/app/src/main/java/com/pleorder/app/car/NaviGateway.kt).

## 그대로 가져오면 안 되는 동작

### 1. 동일 요청 재호출을 주문 승인으로 처리

`DialogEngine.kt:448`은 확인 단계에서 `same || YesNo.isYes(answer) || newItems.isNotEmpty()`이면 확정한다. `:819`도 2분 이내 같은 매장·방식·상품 구성의 재요청을 승인으로 간주한다. `DialogTest.kt:25`는 아예 동일 파라미터 두 번째 호출을 승인 사례로 검증한다.

Gleo의 재시도/중복 호출과 사용자의 실제 승인이 구분되지 않는다. 또한 `lastAskKey`에는 주소·가격·결제수단이 포함되지 않는다. “반복 요청은 같은 초안을 반환하고, 사용자 승인만 확정한다”는 우리 규칙을 유지해야 한다. 이 부분은 기존 테스트 통과가 제품 요구사항 충족을 뜻하지 않는 사례다.

추가로 `Text.kt:55`의 긍정 판정은 부분 문자열을 허용한다. `네, 주문하지 마`처럼 앞에 긍정어가 있는 부정 문장도 긍정으로 판정될 수 있다. 메뉴/수량 파서를 가져오더라도 결제 동의 해석에는 그대로 사용하지 않는다.

[확인 단계 원본](https://github.com/ars2323/PleOrder/blob/bb91d112f40657c00d9cc9ad0888ef2c59249606/app-android/app/src/main/java/com/pleorder/app/core/dialog/DialogEngine.kt#L448)

### 2. 목적지 변경을 판정하는 동안 예약 전송이 계속 가능

`Tracker.kt:314`는 경로 취소 시 45초 타이머를 걸고 뒤늦게 보류한다. 그 사이 예약은 `RESERVED`로 남고 `tick():228`은 전송 시간이 되면 `sendNow()`를 실행한다. 경로를 바꾸는 동안 전송 시각을 넘으면, 새 목적지를 확인하기 전에 이전 주소 주문이 발송될 수 있는 코드 경로다. 이번 검토에서는 정적 분석으로 확인했으며 실제 기기에서 재현한 것은 아니다.

이식 시 경로 변경 의심 순간 전송만 일시 중지하고, 같은 목적지의 재탐색인지 새 목적지인지 판정 후 예약을 재개해야 한다. 팀원 문서의 “즉시 보류” 설명과 실제 코드를 동일하게 보아서는 안 된다.

[경로 취소 처리](https://github.com/ars2323/PleOrder/blob/bb91d112f40657c00d9cc9ad0888ef2c59249606/app-android/app/src/main/java/com/pleorder/app/Tracker.kt#L314)

### 3. 실제 ETA를 새로 받았을 때의 기준 시각

`Tracker.kt:197`의 `remainOf()`는 최신 `navi.dest.remainTime`을 선택하면서 경과 시간은 주문에 저장된 `etaRawAt`을 기준으로 뺀다. 일반 30초 폴링(`:235`)은 이 주문별 측정 시각을 갱신하지 않는다. 실제 남은 시간이 갱신되는 환경에서는 이미 감소한 ETA에서 과거 경과 시간을 다시 빼 조기 주문할 위험이 있다. 데모 고정 ETA에서는 드러나지 않을 수 있다.

`remainingSeconds`, `measuredAt`, `routeRevision`을 한 묶음으로 관리하고, 정체·정차·새 측정값·만료된 값·목적지 변경을 나누어 검증할 필요가 있다.

### 4. “늘 먹던 거” 학습 연결이 완성되지 않음

`Pleo.kt:83–95`의 추천 이력은 번들 `mock/user.json`에서 읽은 `profile`이다. 새로 완료한 주문을 `HistoryIndex`에 합치는 연결은 없다. 반면 `PanelActivity.kt:373`의 안내 카드는 번들 이력과 새 완료 주문을 합쳐 “세 번 주문했으니 늘 먹던 거라고 말해도 된다”고 표시한다. 안내와 실제 음성 추천 데이터가 달라질 수 있다.

규칙 자체는 유용하지만 우리 완료 주문 저장소를 입력으로 연결해야 한다. 취소 이력이 한 번이라도 있는 가게를 모두 제외하는 정책도 그대로 가져오기보다 사용자 취소·매장 문제를 나누는 편이 맞다.

[추천 이력 생성](https://github.com/ars2323/PleOrder/blob/bb91d112f40657c00d9cc9ad0888ef2c59249606/app-android/app/src/main/java/com/pleorder/app/Pleo.kt#L83)

### 5. 지도·주행 정책·가격은 우리 구현에 맞춰 선별

- `Timing.kt`의 우회 시간은 일부 `requestTrip` 결과와 직선거리 보정으로 추정한다. 우리 Naver Directions 경유 경로 계산을 대체할 이유가 없다.
- `NaviGateway.kt:156`은 기존 경유지를 확인한다는 장점이 있지만 호출이 예외 없이 끝나면 바로 `added`로 반환한다. 실제 추가 성공은 재조회로 확인해야 한다. 요청 태그가 없고 대기 요청이 하나일 때 타 콜백을 수용하는 fallback도 제거하는 편이 좋다.
- `VehicleGateway.kt:33`은 `gear != P || requiresDO`이면 모든 터치를 없애는 보수적인 앱 정책이다. 한국의 기능별 제한 규칙을 표현하는 코드는 아니므로 우리 `CarUxRestrictions` 기반 정책을 이 코드로 덮어쓰지 않는다.
- `Pricing.kt:9,21–28`은 쿠폰 상한과 픽업 할인을 합산할 때 총액 0원 하한이 없다. 세트 변환(`:44`)도 기존 옵션을 새 세트로 전달하지 않는다. 할인/세트 추천 아이디어를 채택하더라도 기존 결제 엔진을 교체하지 않는다.
- 팀원 Gleo 진입점은 `component: activity`의 투명 DO Activity다. 우리는 `component: service`의 수신기와 공용 주문 저장소를 사용한다. 예약 추적 서비스 시작 요건은 검토하되 Gleo 진입 구조까지 무조건 교체할 필요는 없다.

## 음성 검증 결과 해석

[팀원 테스트 보고서](https://github.com/ars2323/PleOrder/blob/bb91d112f40657c00d9cc9ad0888ef2c59249606/docs/05-test-report.md)의 수치:

- P0: 시나리오 20개 중 18개 기준 통과, 실행 104회 중 90회 성공(86%).
- P1: 시나리오 37개 중 22개 기준 통과, 실행 53회 중 30회 성공(56%).
- 앱 호출부터 콜백 송신까지 402회 중앙값 1,031ms, 최대 6,015ms. **사용자 발화 시작부터 Gleo가 답변을 끝내기까지의 전체 지연이 아니다.**
- 원본 JSON 대조: S94 수량·옵션 확인은 PASS. S65 장기 예약 전송은 PASS. S53 목적지 변경 후 보류는 FAIL이다. 구현 존재와 음성 E2E 성공을 구분해야 한다.
- “오늘 뭐 먹지?”, “그거 얼마야?” 등이 Gleo 자체 답변이나 내비 검색으로 빠지는 실패가 기록돼 있다. 동일 앱의 스키마 확장 시 이 실패 문장도 회귀 목록으로 가져올 가치가 높다.
- 테스트 실행기는 실제 호출어·발화 WAV를 재생하고 마이크 상태 로그를 기다린다. 단순 intent 주입 테스트와 구분돼 있어 유용하다. 다만 셸·가상 마이크 연결은 Linux용이고 WAV는 저장소에 없다.

이 앱에도 별도 Gleo LLM 모델이나 독립 STT/TTS 해결 코드가 있는 것은 아니다. 앱 스키마 → Gleo 호출 → 앱 결과 콜백 구조이며, 앱 의존성은 NaviHelper/Vehicle/coroutines 중심이다. 따라서 우리 독립 Speech SDK의 모델/서버 오류 해결책으로 볼 수는 없다.

## 공식 문서와 실측 기록 구분

팀원의 SDK 실험 문서는 유용한 호환성 기록이다. 예를 들어 특정 에뮬레이터에서 `onDestinationChanged`가 안 오고 취소/재시작 이벤트가 온다는 관찰이 있다. 그러나 현재 공식 [목적지 문서](https://document.pleos.ai/api-reference/connect-sdk-pleos/NaviHelper/destinations)는 목적지 설정·제거 시 이 콜백을 설명하며, [이벤트 문서](https://document.pleos.ai/api-reference/connect-sdk-pleos/NaviHelper/event-listeners)는 Navigation 구현에 따라 전달 이벤트가 달라질 수 있다고 명시한다.

따라서 콜백 하나를 모든 버전의 보장으로 삼지 말고, 여러 경로 이벤트 후 목적지를 재조회하는 전략을 채택하는 것이 적절하다. 우리 `NavigationController`는 목적지 변경 콜백 의존을 줄이고 외부 경로 재시작 후 재조회도 보완할 필요가 있다.

## 통합 순서와 완료 기준

1. **회귀 사례부터 도입**: 한국어 옵션/수량/서수, 거절·수정, Gleo 오라우팅 문장을 우리 테스트 형식으로 옮긴다. Windows `Test-GleoVoice.ps1`와 음성 입력 도구를 재사용한다.
2. **대화·개인화 확장**: `FIND_FOOD`에 해당하는 조회 기능과 장바구니 옵션 대화를 추가한다. 현재 `CONFIRM_FOOD_ORDER`를 유일한 결제 승인 경계로 유지하고, 동일 발화 재전송 시 주문 0건을 검증한다.
3. **내비 관찰과 예약 추적**: 기존 경유지 보존, 경로 재탐색/목적지 변경 구분, 최신 ETA와 측정 시각, 종료 복원을 연결한다. 목적지 변경 중 전송 0건과 장기 백그라운드 예약을 검증한다.
4. **동시 주문**: 커피 픽업 + 호텔 배달을 서로 다른 초안·결제·주문 ID로 관리하고, 대상이 모호한 취소·현황 질문은 되묻는다.

난도는 텍스트 규칙 이식 < 대화/개인화 확장 < 내비 예약 추적·동시 주문 순이다. 팀원 Kotlin의 순수 정책은 우리 JS 주문 엔진으로 옮기고, Android 내비/서비스는 Java 호스트에 보완하는 편이 현재 앱의 단일 저장소를 유지하기 쉽다. `DialogEngine.kt` 전체를 추가해 또 하나의 결제/주문 상태를 만드는 방식은 피한다.

이번 작업의 산출물은 분석 보고서와 격리된 JVM 검증 결과다. 앱 코드와 설치된 앱에는 변경하지 않았다.
