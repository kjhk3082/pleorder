# 검증 기록

날짜: 2026-11-09. Pleos Connect Emulator 2.1.0 / Android API34 / `dev.pleorder.app`.

## 확인한 결과

- 주문·결제·이벤트 Node 자동 검사 40개 통과. 부정 발화, 중복 확인, 결제 결과 미확인, 결제 수단 변경, 환불, 재실행 데이터 복원 포함.
- 브라우저에서 메뉴 선택→픽업 2개→배달비 0원→확정, 카드 승인 거절→다른 수단→결제 성공, 상세 거래 표시를 실행했다.
- 1224px / 1720px / 2560px 창에서 메뉴 카드 본문이 카드 바깥으로 잘리지 않는지 실제 DOM 크기로 검사했다.
- 실제 Android APK 빌드·설치 및 UI_READY 확인. 시스템이 D 기어에서 앱 화면을 차단하는 것을 관찰했고, 공식 Virtual Console로 Park 변경 후 화면을 검사했다.
- 실제 ON_DEVICE TTS `TTS_STARTED → TTS_DONE` 확인.
- 한국어 합성 PCM을 실제 Pleos STT에 입력: `비빔밥 1개의 집으로 배달해 줘` 인식→비빔밥 1개 배달 초안 생성.
- 두 번째 PCM `이대로 주문` 인식→12,500원, 테스트카드 1234 모의 거래 승인 및 주문 1개 생성. 자세한 음성 안내의 TTS_DONE까지 확인했다.
- Android Intent에서 PREPARE→CONFIRM→중복 CONFIRM→STATUS를 실행했고 callback은 asking→success→success→success였다. 주문은 1개였다. 잘못된 JSON에는 fail callback이 반환됐다. 이는 실제 Gleo 클라우드 발화 검증과 다르다.
- UI의 Gleo 수신 경로로 만든 주문과 새로고침 후 복원한 주문에서 시뮬레이션 시계가 계속 진행하는 것을 검사했다.

합성 PCM은 Windows 한국어 음성으로 만든 QA 입력이다. 사람이 마이크로 말한 실제 환경·노이즈·발음 품질을 검증한 것으로 확대하지 않는다.

## 별도 확인이 필요한 항목

- Gleo 클라우드가 실제 발화를 이해하고 앱을 호출하는 종단 간 흐름 및 공식 스키마 활성화.
- 실제 내비게이션 경유 요청의 성공 Callback. 요청 전송과 안내 성공을 UI에서 구분한다.
- 실시간 차량 GPS에서 귀가 경로·ETA·주소 이름 산출. 현재는 좌표 표시만 사용하고 데모 ETA와 섞지 않는다.
- 사람 마이크 발화, 주행 소음, 장시간 실행, 실제 차량 하드웨어, 접근성 읽기 순서 및 성능 계측.
- 실제 결제·배달·매장 연결과 운영 수준의 보안·장애 복구. 현재는 모두 로컬 시뮬레이션이다.

## 실행 명령

```powershell
npm test
.\tools\Build-Pleorder.ps1 -Install
powershell.exe -NoProfile -File .\tools\New-SpeechFixtures.ps1
```

`tools/device-eval.cjs`는 디버그 빌드의 해당 앱 WebView에만 연결하는 로컬 QA 도구다. 릴리스 빌드의 원격 디버깅은 비활성화된다.
