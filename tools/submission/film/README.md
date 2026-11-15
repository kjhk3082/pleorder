# 플레오더 시연 영상 제작

세 편의 편집본과 동기 자막을 제공합니다. 대표 시연은 퇴근길 한 끼를, Gleo 실기는 차량 설정에서 시작하는 한 건의 음성 주문을, 전체 시연은 목적지 선택부터 예약·수령까지를 담았습니다. [영상과 자막](../../../산출물/02_시연영상/)

## 편집과 출력

이 폴더에서 Node.js, Python 3, NumPy와 FFmpeg를 사용합니다. `storyboards.json`에 원본 컷과 화면 확대 영역, `voices.json`에 발화 대본, `narration/`에 생성된 음성과 자막 시점이 있습니다. 기존 음성으로 편집할 때는 API 키가 필요 없습니다.

```sh
npm ci
python edition.py
npm run studio
node render.mjs --proof
node render.mjs
```

원본 에뮬레이터 녹화는 프로젝트 루트의 `.cache/submission/recordings/`를, 이번 Gleo 시험은 `.cache/submission/film/park-status-take/`와 `studio-drive/`를 사용합니다. 원본 녹화는 로컬에 보관합니다. 다른 컴퓨터에서 재편집하려면 대응하는 화면·스피커 원본을 별도로 준비해야 합니다. `FFMPEG`과 `CHROME_FOR_RENDER`로 실행 파일을 지정할 수 있습니다. `node render.mjs --cover`는 첨부 원본에서 추출한 한글·영문 가로 로고를 사용해 README 배너를 출력합니다.

## 음성과 음악

- 한국어 내레이션은 ElevenLabs Sujin, 운전자 발화는 별도의 한국어 남성 음성입니다. `voices.ps1`은 브랜드명을 “플레 오더”로 발음시키고 화면 자막에는 “플레오더”를 씁니다. 기존 생성 파일과 대본이 일치하면 다시 요청하지 않습니다. [ElevenLabs 타임코드 API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps)
- `capture-gleo.py`는 차량 기본 음성 비서를 열고 운전자 오디오를 가상 마이크로 재생합니다. 차량의 실제 스피커 출력과 화면을 별도로 기록합니다. 응답은 원음에서 편집하고 소리가 끊긴 짧은 무음만 이어 붙입니다.
- `soundtrack.py`는 106 BPM의 건반, 베이스, 드럼을 직접 합성합니다. 대화 중에는 배경음악을 낮추고 화자의 자막을 같은 발화에 맞춥니다. 출력은 1080p, 초당 30프레임, 스테레오 AAC입니다.
- `src/StudioFilm.jsx`에서 카메라 이동과 곡선 그리기를 프레임으로 제어합니다. 경로의 15분 연기, 음성 파형, 주문 확인창은 실제 장면의 시점에 맞췄습니다. [Motion Canvas 트윈](https://motioncanvas.io/docs/tweening/) · [Remotion 스킬](https://github.com/remotion-dev/skills)

새 발화를 만들 때는 Windows 사용자 계정으로 암호화한 로컬 자격 증명이나 세션 환경 변수 `ELEVENLABS_API_KEY`를 사용합니다. 결과물에는 음성과 자막만 기록됩니다. [촬영 범위와 컷 시간](../../../산출물/02_시연영상/대표시연_설명.md)
