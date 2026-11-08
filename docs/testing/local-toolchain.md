# 현재 Windows 개발 환경

사용자 홈 경로는 `%USERPROFILE%`로 표기한다. 별도 `Pleos.exe`를 설치하는 구조가 아니라 Android Emulator가 Pleos 시스템 이미지를 실행한다.

| 구성 | 경로 |
| --- | --- |
| Android Studio | `%LOCALAPPDATA%\Programs\Android\android-studio\bin\studio64.exe` |
| Android SDK | `%USERPROFILE%\Android\Sdk` |
| ADB | `%USERPROFILE%\Android\Sdk\platform-tools\adb.exe` |
| Android Emulator | `%USERPROFILE%\Android\Sdk\emulator\emulator.exe` |
| Pleos API34 시스템 이미지 | `%USERPROFILE%\Android\Sdk\system-images\android-34\pleos_car_emulator\x86_64` |
| 실행 중 AVD의 데이터 | `E:\PleorderAndroid\avd\Pleorder_VoiceClean_API34.avd` |
| AVD 경로 등록 | `%USERPROFILE%\.android\avd\Pleorder_VoiceClean_API34.ini` |
| Pleos SDK Gradle 캐시 | `%USERPROFILE%\.gradle\caches\modules-2\files-2.1\ai.pleos.playground` |
| 네이티브 빌드 작업 폴더 | `%USERPROFILE%\Android\projects\Pleorder` |

프로젝트의 `app/build.gradle`에서 FusedLocation 1.1.3, NaviHelper 3.0.5, SpeechToText/TextToSpeech 3.3.1을 선언한다. SDK는 독립 실행 앱이 아닌 프로젝트 의존 라이브러리다. Gleo 앱은 Pleos 에뮬레이터 내부에 있다.

가상 차량 콘솔은 `adb -s emulator-5554 forward tcp:8088 tcp:8088` 후 `http://127.0.0.1:8088/`에서 열린다. 현 콘솔의 제어 목록에는 지역/국가 또는 DO 해제 설정이 없다. 기어·브레이크 등 차량 신호와 시스템이 반환하는 CarUxRestrictions는 별개로 확인한다.
