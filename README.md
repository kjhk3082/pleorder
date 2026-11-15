# 플레오더 · Pleorder

![플레오더. 서울의 퇴근길에서 음성으로 주문해 집으로 배달받거나, 가는 길에 픽업하는 차량용 앱.](docs/design/pleorder-cover.jpg)

**플레오더는 목적지와 도착 시각에 맞춰 식사를 주문하는 Pleos Connect 앱입니다.** 운전자가 Gleo에 메뉴를 말하면 견적을 내고, 금액과 카드를 확인한 뒤 승인하면 배달이나 픽업을 진행합니다. 매장 접수와 결제는 공모전용 시뮬레이션입니다.

[**차량 Gleo 실기**](#차량-gleo에서-주문-시작하기)　·　[**APK 다운로드**](https://github.com/kjhk3082/pleorder/releases/download/contest-2026-11-15-gleo/pleorder_release.zip)　·　[**기획서 PDF**](산출물/01_기획서/플레오더_기획서.pdf)　·　[**실행 방법**](#실행-방법)　·　[**기기 검증**](docs/testing/gleo-release-2026-11-15.md)

## 퇴근길 한 번으로 보는 플레오더

https://github.com/user-attachments/assets/e328a0f6-d18b-4107-b16d-60b8a778237b

**2분 1초**　[1080p 원본](https://github.com/kjhk3082/pleorder/releases/download/contest-2026-11-15-gleo/pleorder_film_1080p.mp4) · [한국어 자막](산출물/02_시연영상/플레오더_대표시연.srt)

| 시간 | 장면 | 화면에서 확인할 수 있는 것 |
| --- | --- | --- |
| 0:24 | 음성 주문과 승인 | 비빔밥 한 개, 총 12,500원. 결제 승인 뒤 조리 현황을 읽어 준다. |
| 0:47 | 카드 한도 부족 | 거절 이유를 듣고 다른 카드로 바꾼 뒤 다시 승인한다. |
| 0:59 | 퇴근길 정체 | 차량 ETA가 60분에서 75분으로 늘자 매장 전송을 15분 늦춘다. |
| 1:17 | 문 앞 배달 | 배송 완료 시각과 문 앞에 놓인 음식 사진을 확인한다. |
| 1:26 | 매장 픽업 | 가는 길의 매장을 고르고 내비 경유지 전송 여부를 확인한 뒤 수령을 마친다. |
| 1:42 | 주행 화면 | D단 정차와 시속 30km에서 음성과 주문 요약을 표시한다. |

0:24의 음성은 공개 Pleos STT/TTS를 사용한 11월 12일 debug 촬영입니다. 정체 장면에는 시험용 ETA와 시뮬레이션 시계를 사용했습니다. 픽업 내비는 전송 확인창까지 촬영했습니다. [장면별 촬영 범위](산출물/02_시연영상/대표시연_설명.md)

## 차량 Gleo에서 주문 시작하기

> “플레오더에서 치킨 한 마리 집으로 배달해 줘.”

차량 설정을 보고 있어도 음성 버튼으로 Gleo를 부를 수 있습니다. **0.2.2**에서 Gleo는 이 요청을 플레오더의 App Schema로 전달합니다. 주차 중에는 주문 확인창, 주행 제한이 활성화되면 간결한 음성 화면을 엽니다. 현황을 물으면 열어 둔 앱에서 답을 들을 수 있습니다.

https://github.com/user-attachments/assets/bd2a4a6c-377f-4fdc-904c-9abce7602202

**1분 52초 실기**　0:00 차량 설정에서 주문 · 0:29 현대카드 M 21,000원 모의 승인 · 0:56 같은 주문의 조리 현황 · 1:18 D단에서 강남구청 배달 26,000원 승인. [원본 MP4](https://github.com/kjhk3082/pleorder/releases/download/contest-2026-11-15-gleo/pleorder_gleo.mp4) · [한국어 장면 자막](산출물/02_시연영상/플레오더_Gleo_실기시연.srt)

[11월 15일 release 시험 기록](docs/testing/gleo-release-2026-11-15.md) · [Gleo 동작 8개](app/src/main/assets/schema.json) · [참가팀의 App Schema 사용 안내](https://appdevchallenge.auto-hmg.io/notice/c0a1a000-2026-4923-8000-000000000008)

<details>
<summary><strong>기능별 전체 시연 · 8분 44초</strong></summary>

https://github.com/user-attachments/assets/5009070b-35eb-4df8-9866-301175d5d446

[전체 시연 1080p](https://github.com/kjhk3082/pleorder/releases/download/contest-2026-11-15-gleo/pleorder_demo.mp4) · [전체 자막](산출물/02_시연영상/플레오더_전체기능시연.srt) · [전체 차례](산출물/02_시연영상/장면별_설명.md)

</details>

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

**차량 에뮬레이터**　Pleos Connect `release_connect_v2.1.0` · Android 14/API 34 · x86_64 · 2560 × 1440 · density 160. 공모전 release는 0.2.2, versionCode 4다. [설치 파일과 체크섬](https://github.com/kjhk3082/pleorder/releases/tag/contest-2026-11-15-gleo)

1. APK ZIP을 풀어 `apk/`에 놓고 에뮬레이터를 실행한다.
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
