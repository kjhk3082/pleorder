# 플레오더 · Pleorder

차에서 고르는 한 끼. 집으로 배달받거나, 귀가 중 매장에 들러 픽업하는 **Pleos Connect용 주문 시뮬레이터**입니다.

![플레오더 화면](docs/testing/pleorder-final-home.png)

서울 OpenStreetMap 공개 데이터의 음식점·카페 45,488곳을 검색하고, 주문·결제·차량 이동·라이더는 시뮬레이션합니다. 교촌 브랜드의 공식 메뉴 83개와 권장가를 수집했으며 지점별 판매 여부·실제 배달 가능 여부는 확인되지 않았습니다. 메뉴판이 없는 매장에는 임의의 실제 메뉴·리뷰를 만들지 않고, 별도 테스트 메뉴를 제공합니다. 외부 지도에 가짜 영업점을 등록하지 않습니다.

## 구현 범위

- 배달 / 픽업, 수량·같은 매장 메뉴 추가, 귀가 시점에 맞춘 배달, 주문 확인·취소·내역 복원
- 실제 OSM 매장 검색·정보·공식 메뉴와 별도 테스트 메뉴, 도로 경유 거리/시간, 차량·라이더 이동
- 테스트 카드 등록·해제·기본 수단, 슬라이드/명시적 음성 승인, A/B/C 카드별 승인·한도 부족·결과 확인, 중복 결제 방지·환불
- 매장 거절·취소, 조리 지연, 라이더 배정 지연·재배정, 수령인 부재, 픽업 지연, 누락 문의
- 주문·결제 수단·금액·문제 상황을 설명하는 Gleo 음성 흐름, 별도 Pleos STT/TTS 어댑터
- Gleo의 세 가지 공식 Broadcast/Callback 계약, 화면 없는 백그라운드 처리, 앱 내 `assets/schema.json`
- 완료 시간·문 앞 샘플 사진, 지역·최근 주문 추천, 주소 관리, 앱 재시작 복원
- 장소 검색·지도 핀 선택·상세주소 음성 입력, 차량 내비 목적지 조회와 숙소 주변 추천 제안
- 유리 질감 화면, 라이트/다크 테마, 모션 줄이기, 주문 음성 알림 설정
- 개발자 API에 28개 회귀 시나리오를 유지하며 일반 사용자 화면에서는 시나리오 선택기를 제거

## 실행

Node.js가 있으면 별도 npm 의존성 설치 없이 미리볼 수 있습니다.

```powershell
npm test
npm run preview
```

브라우저에서 <http://127.0.0.1:4173>을 엽니다. 브라우저의 문장 입력은 로컬 규칙 기반 테스트이며 Gleo LLM이라고 표시하지 않습니다.

Android Studio에서 이 폴더를 열거나, JDK 21과 Android SDK 34 환경에서 빌드합니다.

```powershell
.\gradlew.bat :app:assembleDebug
adb install -r app\build\outputs\apk\debug\app-debug.apk
adb shell am start -n dev.pleorder.app/.DrivingActivity
```

현재 작업 컴퓨터에서는 Windows 한글 경로 문제를 피하는 아래 스크립트도 사용할 수 있습니다. 이 스크립트의 JDK/SDK 경로는 현재 컴퓨터 기준입니다.

```powershell
.\tools\Build-Pleorder.ps1 -Install
```

Pleos Emulator에서 전체 탐색·설정은 **주차 상태**, 간결한 음성·주문 요약은 **주행 상태**로 테스트합니다. 앱은 플랫폼의 주행 제한을 우회하지 않습니다.

한국 출시를 대상으로 합니다. 지역별 제한은 국가명이나 D/P 기어를 하드코딩하지 않고 차량의 `CarUxRestrictions` 비트마스크를 적용합니다. 현재 에뮬레이터는 정차 D와 주행 D에서 `0x50`(동영상·설정 제한)을 반환합니다. DO를 선언한 별도 `DrivingActivity`와 주차용 `MainActivity`를 자동 전환합니다. 설치 후 기존 태스크를 종료하고 새 주행용 태스크로 실행하여 **D단 정차·콜드 실행·27km/h 에뮬레이터 주행 중 화면 표시**를 확인했습니다. 제품 심사나 실차 검증 완료를 의미하지 않습니다. [판정 차이와 검증](docs/testing/korea-driving-policy.md)을 참고하세요.

## 구성

| 위치 | 역할 |
|---|---|
| `app/src/main/assets/web/core.js` | 주문 상태, 확인, 취소, 매장·배달 이벤트, 한국어 명령 |
| `app/src/main/assets/web/payments.js` | 모의 거래, 멱등성, 승인 결과 확인, 환불 |
| `app/src/main/assets/web/map.js` | 지도, 도로 경로, 가상 차량·라이더 |
| `app/src/main/assets/web/app.js` | 화면 상호작용과 Android 브리지 |
| `app/src/main/java/dev/pleorder/app` | 실제 Pleos 음성·위치·내비게이션 어댑터 및 Gleo 백그라운드 수신 |
| `app/src/main/assets/schema.json` | Gleo 기능 세 개 등록 계약 |
| `tests` | 주문·결제·이벤트의 회귀 검사 |

## Gleo 및 실제 SDK의 경계

Gleo는 외부 앱이 임의 프롬프트로 호출하는 공개 챗봇 API와 다릅니다. Gleo가 사용자 발화를 이해한 뒤 등록된 앱 기능을 Intent로 호출하고, 앱은 Callback으로 답합니다. **에뮬레이터 가상 마이크에 합성 한국어 음성을 넣어 Gleo 인식 → 배달/픽업 준비 → 결제 승인 → 현황 응답을 검증했습니다.** B 카드 부족 및 A 카드 재승인, 명시적 결제 거절도 포함합니다. 사람 목소리나 실제 도로 주행 검증은 아닙니다. [재현 방법과 결과](docs/testing/gleo-voice-e2e.md)를 참고하세요.

독립 STT/TTS 어댑터는 `3.3.1` ON_DEVICE 모드를 사용하지만 현재 이미지의 엔진 오류가 별도로 남아 있습니다. 이 경로와 Gleo 성공을 혼동하지 않습니다. 서버 키를 소스나 APK에 넣지 않으며 직접 서버 Speech API를 사용하는 코드도 없습니다. Gleo 서비스 전체의 무료 사용 또는 과금 조건을 보장하는 공식 근거는 확인하지 못했습니다.

FusedLocation은 실제 차량 좌표를 표시할 수 있습니다. 다른 좌표의 도로 경로는 OSRM에 요청하며, 현재 좌표와 일치하는 경로가 없으면 도착 맞춤 결제를 기다립니다. Photon 장소 검색·역지오코딩과 NaviHelper 목적지 읽기를 연결했습니다. 공개 주소 데이터는 불완전할 수 있어 사용자가 핀·주소·상세주소를 확인한 후 저장합니다. 실시간 교통은 연결하지 않았으며 저장된 데모 경로와 직선 거리를 구별해 표시합니다.

내비게이션은 사용자가 경유 요청을 확인한 후 NaviHelper를 호출합니다. 에뮬레이터에서 실제 안내 시작 Callback을 확인했습니다. Gleo 백그라운드 계약은 앱 프로세스를 종료한 상태에서도 준비·확정·중복 확정·조회가 작동하고 주문과 거래가 하나만 생성되는 것을 확인했습니다.

## 검증과 자료

- [제품 빈틈과 다음 설계](docs/product/2026-11-09-product-gap-review.md)
- [실제 검증 범위](docs/testing/verification.md)
- [28개 시나리오](docs/testing/scenario-matrix.md)
- [설계와 실제 서비스 전환](docs/architecture.md)
- [이미지·폰트·지도 출처](docs/design/asset-provenance.md)

OSM 공개 타일·OSRM·Photon 데모 서버는 소규모 개발 확인에 사용합니다. 운영 트래픽은 별도 제공자 또는 자체 서버로 전환해야 합니다. 타일을 일괄 다운로드하지 않습니다. 매장 데이터는 ODbL 출처·원본 링크를 표시하며, 도시 내 모든 영업점의 최신 상태를 보장하지 않습니다.
