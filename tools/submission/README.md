# 산출물 제작 도구

실제 에뮬레이터 화면 녹화, 공개 음성 SDK 시험, 문서 및 영상 편집에 사용한 도구입니다. 테스트 이벤트·시간 가속을 사용하는 장면과 실제 마이크 입력 장면을 구분합니다. 실행에 필요한 로컬 캐시·인증정보·원시 로그는 저장소에 포함하지 않습니다.

| 도구 | 역할과 필요 환경 |
|---|---|
| `capture.cjs` | Node 22+, ADB, debug WebView CDP. 탐색·결제·예약·음성 장면 녹화. `ANDROID_SERIAL`, `SUBMISSION_PYTHON`으로 별도 시험 에뮬레이터 지정 |
| `capture-driving.py` | Python, ADB, 공식 Virtual Console. 0/P → D → 30km/h → 0/P 전환 녹화 |
| `release-voice-qa.py` | ADB 접근성 트리와 실제 가상 마이크를 이용한 release 시험. `ANDROID_SERIAL`과 `PLEORDER_EMULATOR_SERIAL`로 같은 시험 인스턴스 지정. SDK 준비를 기다려 음성을 보내며 전송 성공만으로 인식 성공을 판정하지 않음 |
| `upload-readme-video.py` | 검토한 10 MB 미만 MP4를 GitHub 공식 사용자 첨부 경로로 업로드. 별도 이슈나 댓글을 생성하지 않음 |
| `capture-audio.py` | Python, grpcio, protobuf. 공식 에뮬레이터 streamAudio로 실제 스피커 출력 기록 |
| `New-VoiceFixtures.ps1` | Windows 한국어 Heami TTS로 시험용 WAV/PCM 생성 |
| `New-Narration.ps1` | Windows 한국어 TTS로 영상 설명 음성 생성 |
| `render-video.py` | FFmpeg/libass, 맑은 고딕. 실제 녹화에 자막·설명 음성 추가. `--reuse`는 변경되지 않은 장면에만 사용 |
| `build-documents.py` | Python python-docx, 공식 DOCX 양식. 공개 기획서와 비공개 접수양식 생성. PDF는 Word에서 변환 후 페이지별 검수 |
| `publish-release.py` | Git credential helper와 GitHub API. 명시한 커밋의 제출 자료 업로드. 기존 첨부는 덮어쓰지 않음 |

실패한 시험용 명령도 진단 재현을 위해 코드에 남아 있습니다. 도구가 존재한다는 사실이 검증 성공을 의미하지 않습니다. 실제로 영상에 포함한 장면은 `video-plan.json`, 성공·실패 범위는 `산출물/03_검증자료/검증결과.md`에 기록했습니다.

문서 생성에는 `.cache/submission/official/contest-application-consent.docx`와 비공개 `.cache/submission/roster.json`이 필요합니다. 참가자의 동의나 서명을 자동 작성하지 않습니다. 테스트 시작 전 개인 배송지와 주문 상태를 별도 보관하고 공개용 시연 데이터만 녹화해야 합니다.

## 11월 15일 Gleo 시연 편집

`edit-gleo-demo.py`는 같은 시험의 화면 녹화, 에뮬레이터 스피커 WAV, 실제 주입한 발화 WAV와 시작 시점으로 영상을 편집합니다. `--chapter`는 전체 영상 7:08의 20초 장면을 만듭니다. 그 장면을 다시 합칠 때는 `render-video.py --reuse --refresh=18-gleo-release`를 실행합니다. Gleo 재생 영상의 결과와 녹화 범위는 [기기 검증](../../docs/testing/gleo-release-2026-11-15.md)에 있습니다.

주행용 UI를 덧붙일 때는 `--driving-session`에 별도 D단 시험의 녹화 폴더를 지정한다. 출품 Gleo 실기 영상은 같은 주문의 세 장면 뒤에 D단 견적·승인 장면을 붙였다.
