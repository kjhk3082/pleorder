# 플레오더 시연 영상 제작

가로 시연 세 편과 세로 숏폼 한 편에 한국어 자막을 제공합니다. 대표 시연은 퇴근길 한 끼를, Gleo 실기는 한 건의 음성 주문을, 전체 시연은 목적지 선택부터 예약·수령까지를 담았습니다. [영상과 자막](../../../산출물/02_시연영상/)

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
- `soundtrack.py`는 112 BPM의 짧은 신시사이저 코드, 베이스, 브러시와 셰이커를 직접 합성합니다. 대화가 시작되면 음악이 낮아지고, 차량 스피커 녹음에는 타악기를 더 적게 배치했습니다. 가로 영상은 1080p, 초당 30프레임, 스테레오 AAC입니다.
- `src/StudioFilm.jsx`에서 카메라 이동과 곡선 그리기를 프레임으로 제어합니다. 경로의 15분 연기, 음성 파형, 주문 확인창은 실제 장면의 시점에 맞췄습니다. [Motion Canvas 트윈](https://motioncanvas.io/docs/tweening/) · [Remotion 스킬](https://github.com/remotion-dev/skills)

새 발화를 만들 때는 Windows 사용자 계정으로 암호화한 로컬 자격 증명이나 세션 환경 변수 `ELEVENLABS_API_KEY`를 사용합니다. 결과물에는 음성과 자막만 기록됩니다. [촬영 범위와 컷 시간](../../../산출물/02_시연영상/대표시연_설명.md)

## 세로 숏폼

“아니, 치킨이 저보다 먼저 퇴근했어요.” 45초 동안 집 앞의 치킨과 막힌 퇴근길을 번갈아 보여줍니다. 운전자가 음성으로 주문하면 차량이 26,000원 견적을 읽고, 나중에 같은 주문을 물으면 조리 상태와 남은 27분을 알려줍니다. 두 응답은 Pleos 에뮬레이터의 실제 스피커 녹음입니다. 다음 날의 예약과 매장 픽업은 별도 주문 장면입니다.

2026년 11월 15일 ElevenLabs에서 한국어 대사를 Taehyung, Hana Lee, VIV, Stella로 각각 생성했습니다. 비교한 네 보이스 중 Taehyung은 최근 7일 생성 글자 수가 16,915,330자로 가장 높았습니다. 짧은 반문과 농담 사이에 숨을 남기는 이 목소리를 `eleven_v3`로 합성했습니다. 운전자 주문과 Gleo 응답은 실기 시연과 같은 테이크입니다. [Taehyung 보이스](https://elevenlabs.io/app/voice-library?voiceId=m3gJBS8OofDJfycyA2Ip) · [사용량 집계 기준](https://elevenlabs.io/docs/api-reference/voices/voice-library/get-shared)

텀블러 릴스 첫 1.7초의 빠른 컷 전환과 안경 릴스의 착용자·시야 교차 편집을 참고했습니다. 치킨에 소스를 붓는 손, 현관 봉투, 차의 브레이크등을 첫 1.7초에 교차합니다. 결제와 경유지 확인 장면에는 플레오더 실기 화면을 넣었습니다. 팀이 만든 118 BPM 배경 음악은 자동차 스피커가 대답할 때 작아집니다. [텀블러 릴스](https://www.instagram.com/reel/DdeAn-eJmSY/) · [안경 릴스](https://www.instagram.com/reel/DezaRr-uAA1/)

주행·음식 실사 영상의 출처는 Timo Volz의 서울 교차로와 Bon appétit의 프라이드치킨입니다. 재편집하려면 원본을 `.cache/submission/film/shortform/`에 각각 `seoul-night-26690701.mp4`, `chicken-sauce-31707113.mp4`로 저장합니다. 현관·운전대·차량 실내·치킨 식탁·차창 사진은 이 영상용으로 생성했으며 `reel-assets/`에 있습니다. [서울 야경](https://www.pexels.com/video/a-city-street-at-night-with-cars-and-lights-26690701/) · [치킨 클로즈업](https://www.pexels.com/video/close-up-of-sauce-being-poured-on-fried-chicken-31707113/) · [Pexels 이용 조건](https://www.pexels.com/license/)

Remotion이 사진·자막·실기 화면의 장면별 영상을 그리면 MoneyPrinterTurbo의 `VideoProject`가 여덟 장면의 발화 길이를 측정하고, 세로 H.264 시퀀스를 조립해 음악과 믹싱합니다. 편집에 사용한 외부 도구 버전은 `ce289ffb61a118779c56d6b4a34181905dbed2b9`입니다. [MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo/tree/ce289ffb61a118779c56d6b4a34181905dbed2b9)

FFmpeg와 ffprobe를 PATH에 두고 아래 명령을 이 폴더에서 실행합니다. 음성 파일은 저장소에 들어 있습니다.

```sh
python shortform.py prepare
node render.mjs Short
python shortform.py assemble --mpt /path/to/MoneyPrinterTurbo
```
