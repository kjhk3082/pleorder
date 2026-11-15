# 플레오더 · Pleorder

![플레오더. 서울의 퇴근길에서 음성으로 주문해 집으로 배달받거나, 가는 길에 픽업하는 차량용 앱.](docs/design/pleorder-cover.jpg)

**플레오더는 목적지와 도착 시각에 맞춰 식사를 주문하는 Pleos Connect 앱입니다.** 운전자가 Gleo에 메뉴를 말하면 견적을 내고, 금액과 카드를 확인한 뒤 승인하면 배달이나 픽업을 진행합니다. 매장 접수와 결제는 공모전용 시뮬레이션입니다.

[**대표 시연**](#퇴근길-한-번으로-보는-플레오더)　·　[**차량 Gleo 실기**](#차량-gleo에서-주문-시작하기)　·　[**전체 기능 시연**](#기능별-전체-시연)　·　[**APK 다운로드**](https://github.com/kjhk3082/pleorder/raw/refs/heads/main/apk/%ED%94%8C%EB%A0%88%EC%98%A4%EB%8D%94_%ED%94%8C%EB%A0%88%EC%98%A4%EB%8D%94_release.apk)　·　[**기획서 PDF**](산출물/01_기획서/플레오더_기획서.pdf)　·　[**실행 방법**](#실행-방법)　·　[**기기 검증**](docs/testing/gleo-release-2026-11-15.md)

## 퇴근길 한 번으로 보는 플레오더

https://github.com/user-attachments/assets/9580ea7f-c30d-4c0e-a6e1-10e1731240f1

**1분 41초**　[1080p 원본](https://github.com/kjhk3082/pleorder/releases/download/contest-2026-11-15-studio/pleorder_film_1080p.mp4) · [한국어 자막](산출물/02_시연영상/플레오더_대표시연.srt)

| 시간 | 장면 | 화면에서 확인할 수 있는 것 |
| --- | --- | --- |
| 0:16 | 차량 설정에서 주문 | Gleo에 치킨을 부탁하면 교촌치킨 잠실1호점 주문 확인창이 열린다. |
| 0:30 | 음성 승인과 조회 | 현대카드 M으로 26,000원을 모의 승인한다. 같은 주문은 조리 중이고 배달까지 약 27분 남았다. |
| 0:52 | 카드 한도 부족 | 카드를 바꾸고 다시 승인한다. |
| 0:59 | 퇴근길 정체 | 차량 ETA가 60분에서 75분으로 늘어나 매장 전송을 15분 늦춘다. |
| 1:11 | 문 앞 배달 | 완료 시각과 문 앞 예시 사진을 확인한다. |
| 1:16 | 매장 픽업 | 매장을 경유지로 전송할지 확인하고 음식을 수령한다. |
| 1:27 | 주행 화면 | D단·시속 30km에서 음성 중심 화면을 확인한다. |

운전자와 내레이션은 서로 다른 ElevenLabs 음성입니다. 주문·승인·현황을 읽어 주는 대답은 release 0.2.2를 실행한 Pleos 에뮬레이터의 스피커 원음입니다. 정체 장면은 시험용 ETA를 사용했고, 내비는 픽업 매장 전송 확인창까지 촬영했습니다. [장면 안내](산출물/02_시연영상/대표시연_설명.md)

## 차량 Gleo에서 주문 시작하기

> “플레오더에서 치킨 한 마리를 우리 집으로 배달해 주세요.”

차량 설정을 보고 있어도 음성 버튼으로 Gleo를 부를 수 있습니다. **0.2.2**에서 Gleo는 이 요청을 플레오더의 App Schema로 전달합니다. 주차 중에는 주문 확인창, 주행 제한이 활성화되면 간결한 음성 화면을 엽니다. 현황을 물으면 열어 둔 앱에서 답을 들을 수 있습니다.

https://github.com/user-attachments/assets/84e911e1-ccfa-491b-9db7-78fd84e9f510

**1분 2초 실기**　0:05 차량 설정에서 주문 · 0:19 현대카드 M 26,000원 모의 승인 · 0:29 같은 주문의 조리 현황 · 0:46 D단·시속 30km에서 별도 주문 21,500원 승인. [원본 MP4](https://github.com/kjhk3082/pleorder/releases/download/contest-2026-11-15-studio/pleorder_gleo.mp4) · [한국어 장면 자막](산출물/02_시연영상/플레오더_Gleo_실기시연.srt)

[제출 APK에서 다시 확인한 주차·주행 주문](docs/testing/gleo-release-2026-11-15.md#제출-apk-재시험) · [Gleo 동작 8개](app/src/main/assets/schema.json) · [참가팀의 App Schema 사용 안내](https://appdevchallenge.auto-hmg.io/notice/c0a1a000-2026-4923-8000-000000000008)

## 기능별 전체 시연

**3분 35초**　0:32 배송지 검색 · 0:59 결제 거절과 재승인 · 1:29 픽업 · 1:45 정체에 따른 예약 조정 · 2:24 시스템 Gleo · 3:19 주행 화면.

https://github.com/user-attachments/assets/c344ae2f-f92c-43c7-8423-1f267bb2bcdb

[전체 시연 1080p](https://github.com/kjhk3082/pleorder/releases/download/contest-2026-11-15-studio/pleorder_demo.mp4) · [전체 자막](산출물/02_시연영상/플레오더_전체기능시연.srt) · [전체 차례](산출물/02_시연영상/장면별_설명.md)

## 배달과 픽업이 갈라지는 순간

| 집이나 숙소로 배달 | 운전 경로에서 픽업 |
| --- | --- |
| 선택한 배송지 주변 매장을 찾는다. 호텔이 새 목적지로 들어오면 배송지 변경을 먼저 확인한다. | 현재 위치에서 매장까지의 거리·시간과 경유 때문에 더 걸리는 시간을 보고 고른다. |
| 도착에 맞춰 예약하고, 교통 정체가 생기면 아직 매장에 보내지 않은 주문의 전송 시각을 조정한다. | 매장을 차량 내비 경유지로 보내기 전에 사용자에게 묻는다. 음식 준비와 수령은 별도로 추적한다. |
| 배정 지연·매장 취소·환불을 안내한다. 완료 시각과 문 앞 샘플 사진을 남긴다. | 픽업 지연과 수령 대기를 안내하고, 사용자가 수령을 확인하면 주문을 완료한다. |

**음성 배송지.** “강남구청으로 배달해 줘”라고 말하면 장소 후보를 읽어 준다. 동·호수는 한 번 더 읽고, 운전자가 확인하면 저장한다. [실제 주소 확인 기록](docs/testing/gleo-release-2026-11-15.md)

**가격과 카드.** 금액·배송지·결제수단을 견적에 묶는다. 카드가 바뀌면 다시 확인한다. 승인·거절·재시도·환불을 모의 거래로 기록한다. [결제 처리](app/src/main/assets/web/payments.js)

**매장과 개인화.** 서울의 공개 음식점·카페 데이터 45,488곳을 검색한다. 출처가 확인된 브랜드 메뉴와 예시 메뉴를 구별한다. 완료한 주문 이력으로 최근 메뉴와 자주 먹는 구성을 추천한다. 실제 영업 상태와 배달 가능 권역은 제휴 전까지 확인할 수 없다. [데이터와 이미지 출처](docs/design/asset-provenance.md)

**운전 중 조작.** 한국을 대상으로 차량이 보내는 `CarUxRestrictions`를 적용한다. 주행 화면에는 음성, 총액, 카드, 주문 상태를 남긴다. 메뉴 탐색과 설정은 주차 화면에서 이용한다. [주행 정책 검증](docs/testing/korea-driving-policy.md) · [현대자동차그룹 UI 가이드](https://document.pleos.ai/docs/connect/guide/docs-design/Introduction/intro)

## 실행 방법

**차량 에뮬레이터**　Pleos Connect `release_connect_v2.1.0` · Android 14/API 34 · x86_64 · 2560 × 1440 · density 160. 출품 APK는 0.2.2, versionCode 5다. [설치 파일과 체크섬](https://github.com/kjhk3082/pleorder/releases/tag/contest-2026-11-15-studio)

1. 저장소의 [apk/플레오더_플레오더_release.apk](apk/플레오더_플레오더_release.apk)를 받고 에뮬레이터를 실행한다. 저장소를 클론하면 해당 경로에 설치 파일이 들어 있다.
2. 아래 명령으로 설치한다. P단에서 필요한 마이크·위치·내비 권한을 허용한다.
3. 차량의 기본 음성 비서를 Gleo로 설정한 환경에서 차량 음성 버튼을 누르고 “플레오더에서 치킨 배달해 줘”라고 말한다. 화면 상단 **DEMO**를 누르면 주문·모의 거래를 초기화해 다시 시도할 수 있다.

```sh
adb install -r "apk/플레오더_플레오더_release.apk"
adb shell am start -n dev.pleorder.app/.DrivingActivity
```

**브라우저 미리보기**　Node.js에서 주문 화면과 시뮬레이션을 열 수 있다. `npm run preview` 실행 후 [로컬 미리보기](http://127.0.0.1:4173)를 연다. 차량 Gleo·위치·내비 SDK 시험에는 위 에뮬레이터를 사용한다.

```sh
npm test
npm run preview
```

<details>
<summary><strong>빌드·지도·시뮬레이션 구성</strong></summary>

- JDK 21과 Android SDK 34로 `.\gradlew.bat :app:assembleRelease`를 실행한다. 출품 APK는 공모전 테스트용 개발 인증서로 서명했다. [빌드와 지도 인증 설정](apk/README.md)
- 지도는 네이버 지도 또는 OSM을 표시한다. 차량 좌표는 FusedLocation, 내비 목적지·경유 요청은 NaviHelper로 처리한다. 개발용 Directions 5 프록시는 별도 설정이 필요하며 배포 APK는 대체 경로 제공자를 사용할 수 있다.
- 주문 엔진은 주차 화면·주행 화면·백그라운드에서 공유한다. 승인 회귀, 여러 주문의 조회, 예약 보류와 재개를 테스트한다. [구조](docs/architecture.md) · [회귀 시나리오](docs/testing/scenario-matrix.md)
- [기획서 DOCX](산출물/01_기획서/플레오더_기획서.docx) · [버전별 검증](산출물/03_검증자료/검증결과.md) · [제출 안내](산출물/04_제출안내/공식요건_체크리스트.md)

</details>
