# 플레오더 참가용 APK

파일: **플레오더_플레오더_release.apk**

[GitHub Releases에서 APK 내려받기](https://github.com/kjhk3082/pleorder/releases/tag/contest-2026-11-12). 약 137 MiB로 GitHub 일반 파일 한도를 넘어 공식 제출 안내에 허용된 Releases에 보관합니다. 다운로드한 APK를 이 폴더에 두면 아래 설치 명령을 사용할 수 있습니다. 체크섬은 `산출물/03_검증자료/SHA256SUMS.txt`에 있습니다.

Android API 29 이상, Pleos Connect 서비스가 설치된 환경을 대상으로 합니다. 검증 환경은 Pleos `release_connect_v2.1.0`, API 34, x86_64, 물리 화면 2560 × 1440, density 160입니다. 일반 스마트폰에서는 Pleos 서비스 기능을 보장하지 않습니다.

```powershell
adb install -r apk/플레오더_플레오더_release.apk
adb shell am start --user current -n dev.pleorder.app/.DrivingActivity
```

앱이 주차 상태이면 탐색 화면, DO 요구 상태이면 음성 중심 화면을 표시합니다. 첫 사용은 P단에서 마이크·위치·내비 권한을 허용한 뒤 진행합니다. 음성 모델 설치가 완료된 공식 에뮬레이터가 필요합니다.

## 빌드와 서명

```powershell
.\gradlew.bat :app:assembleRelease
# 이 개발 컴퓨터의 한글 경로를 피하는 빌드 도구
.\tools\Build-Pleorder.ps1 -Release
```

release variant이며 `debuggable=false`입니다. 공모전 테스트용으로 기존 개발 서명 설정을 사용합니다. 상용 배포용 서명 키는 아닙니다. 다른 서명으로 설치한 기존 앱에는 덮어쓸 수 없으므로 별도 테스트 환경을 권장합니다.

## 지도 설정

제공 APK에는 네이버 지도 공개 Client ID만 포함되어 있습니다. 네이버 비밀키, Pleos Client Secret, 로컬 HTTPS 인증키는 포함하지 않습니다. 독립 실행 release는 개발자의 로컬 프록시 주소를 사용하지 않습니다. 도로 경로는 대체 제공자 OSRM을 이용할 수 있으며 네이버 Directions 5 실시간 교통 경로와 다릅니다. 인터넷과 외부 서비스 가용성이 필요합니다.

소스에서 재빌드할 때 `map-config.json`의 공개 식별자는 직접 설정할 수 있습니다. Directions 5 개발용 프록시 구성은 `tools/naver-directions.cjs`를 참고하세요. 비밀값은 `.local`에만 두며 배포 서버는 별도로 준비해야 합니다.

## 확인할 흐름

1. 배송지·출발지 변경과 매장 검색.
2. 메뉴 추가 후 총액·카드를 확인하고 슬라이드 승인.
3. 신한카드 Mr.Life 테스트 한도 0원 → 거절 확인 → 현대카드 M 재선택.
4. 마이크로 “비빔밥 한 개 배달해 줘”, “결제 승인”, “주문 상태”.
5. 픽업 주문의 내비 전송 확인, 주문 내역과 설정, DEMO 초기화.

모든 주문·결제·라이더 이동·배달 사진은 테스트입니다. 실제 매장 배달권역과 주문 접수는 연동하지 않았습니다. 공개 매장 정보와 테스트 메뉴 표시는 구분합니다. release에서는 실험용 Gleo Activity/Receiver가 비활성화됩니다.
