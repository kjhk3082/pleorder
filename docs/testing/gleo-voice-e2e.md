# Gleo 실제 음성 경로 검증 · 2026-11-09

사람이 직접 녹음한 음성 대신 Windows 한국어 합성 음성을 에뮬레이터 가상 마이크에 주입했다. Gleo를 표준 `cmd voiceinteraction show`로 열고 **음성 인식 → Gleo 함수 선택 → 앱 BroadcastReceiver → 상태 저장 → Gleo 음성 응답**을 검사했다. 앱 주문 함수를 ADB broadcast로 직접 호출한 테스트가 아니다. 실제 도로 주행, 사람 목소리, 실결제 검증은 포함하지 않는다.

환경: Pleorder_VoiceClean_API34 / Pleos Connect 2.1.0 / Gleo 4.2.0.15 / CAAS 4.2.10. D단, 0 km/h. 로컬 emulator gRPC 포트 8554에 인증하여 오디오를 넣었다. 별도 외부 LLM API나 앱의 Client Secret을 사용하지 않았다. Gleo 플랫폼 자체의 네트워크 연결·음성 서비스가 사용되었으므로 무료 서비스나 오프라인 실행을 보장하는 근거로 삼지 않는다.

## 결과

| 경로 | 결과 |
|---|---|
| 치킨 배달 주문 → 결제 승인 → 현황 | 통과. 합계 21,000원, 현대카드 M 1234, 주문/성공 결제 각 1건 |
| 앱이 보이지 않는 상태의 Gleo 처리 | 통과. 설정 앱을 전면에 두고 `BACKGROUND_CALLBACK`으로 처리 |
| B 카드 선택 → 승인 | 통과. 한도/잔액 부족 안내, 주문 0건 |
| A 카드로 변경 → 재승인 → 현황 | 통과. 새 확인 후 성공, 거절 1건 + 성공 1건, 주문 1건 |
| 픽업 주문 → 결제 → 현황 | 통과. 19,000원, `mode=pickup`, 준비 예상 20분 |
| “결제하지 마, 담아 둔 주문 취소” | 통과. draft 없음, 주문 0건, 거래 0건 |
| D단 앱 화면 노출 | 최종 통과. 태스크 재생성 후 정차·콜드 실행·27km/h에서 확인. [판정 차이 분석](korea-driving-policy.md) |
| 앱 마이크 버튼 → Gleo | 통과. Android `Activity.showAssist()`가 true, 음성 현황 인식·콜백 성공 |
| 에뮬레이터 주행 중 현황 조회 | 통과. Gleo 음성 인식과 성공 콜백, 시험 후 0km/h/P 복원 |

기존 개인 장소·카드·주문 전체 상태를 로컬 파일에 저장하고 내용 일치 확인 후 테스트했다. 각 시험은 `try/finally`로 원래 상태를 복원한다. 원본 백업과 전체 화면 캡처는 개인정보를 포함할 수 있어 `.cache`에만 보관한다.

## 발견 및 수정

1. 실제 Gleo가 `dev.pleorder.app.PREPARE_FOOD_ORDER`처럼 패키지 접두어를 붙여 보냈다. Manifest 수신 필터와 이름 정규화를 수정했다.
2. 스키마의 `integer`를 지원되는 `number`로 바꾸었다.
3. 다음 음성 턴에서 Gleo가 긴 draft ID 대신 `current`를 보냈다. 앱이 읽어 준 주문 견적을 3분 동안 보관하고, 해당 견적의 메뉴·수량·금액·배송지·카드를 그대로 유지한 경우에만 명시적 승인을 처리하도록 했다. UI에서 수정하거나 확인 시간이 지나면 다시 읽고 새 승인을 요구한다. 임의의 잘못된 ID는 계속 거절한다.
4. 카드 변경은 같은 발화에 승인 값이 있더라도 결제하지 않는다. 변경된 카드와 금액을 먼저 읽고 다음 승인을 받는다.
5. 주차·주행·백그라운드 경로가 동일한 콜백을 사용한다. Gleo에 모의 주문/결제임을 명시하고 금액·카드·진행 상태를 전달한다.

## 관찰 로그 발췌

에뮬레이터 시각 기준. 계정 식별자·인증 토큰은 수집 결과에 포함하지 않았다.

```text
12:39:21 BACKGROUND_CALLBACK PREPARE_FOOD_ORDER status=asking
12:39:58 BACKGROUND_CALLBACK CONFIRM_FOOD_ORDER status=asking  [B 카드 변경]
12:40:12 BACKGROUND_CALLBACK CONFIRM_FOOD_ORDER status=fail    [B 승인 거절]
12:40:43 BACKGROUND_CALLBACK CONFIRM_FOOD_ORDER status=success [A 승인]
12:40:57 BACKGROUND_CALLBACK GET_FOOD_ORDER_STATUS status=success
```

실제 Gleo는 카드 B의 부족 사유를 읽고 다른 결제 수단을 물었다. A 승인 후에는 21,000원·현대카드 M·1234·예상 30분과 실제 결제가 아닌 모의 결과라는 내용을 읽었다.

## 재실행

`tools/New-SpeechFixtures.ps1`로 음성을 생성하고 `tools/Test-GleoVoice.ps1 -Background -Case card-retry`로 실행한다. 앱을 먼저 설치·실행해야 한다. `tools/emulator-audio-test.py`는 로컬 실행 중 에뮬레이터의 gRPC 인증을 메모리에서만 사용한다. 별도로 설치한 `grpcio`·`protobuf`가 필요하다. 테스트 산출물은 `.cache`에만 기록한다.

독립 SpeechToText/TextToSpeech SDK의 ON_DEVICE 오류와 Gleo 성공은 같은 상태가 아니다. 이번 성공은 Gleo가 제공하는 음성·함수 호출 경로의 성공이다. 주소 입력은 후속 수정에서 Gleo 경로로 전환하고 목적지·동호수 입력을 검증했다. [주소 후속 검증](voice-addresses.md)을 참고한다. 독립 SDK 자체의 모델 오류를 해결했다는 뜻은 아니다.

주문 마이크 버튼은 독립 STT 대신 [Android showAssist](https://developer.android.com/reference/android/app/Activity#showAssist(android.os.Bundle))로 기본 어시스턴트 Gleo를 연다. 12:45:18 `ASSIST_REQUEST shown=true` → 12:45:21 현황 요청 음성 인식 → 12:45:23 `GET_FOOD_ORDER_STATUS` 성공을 확인했다. 단순 `ACTION_ASSIST` Activity 실행은 이 이미지에서 마이크를 자동으로 열지 않아 사용하지 않았다.
