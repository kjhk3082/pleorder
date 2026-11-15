# 플레오더 대표 시연 편집

1080p, 30fps, 3,642프레임입니다. 컷 위치와 화면 확대 영역은 `edit.json`, 설명 대본은 `narration.json`에 있습니다. 원본 녹화가 없는 체크아웃에서는 저장소의 [전체 시연](../../../산출물/02_시연영상/플레오더_전체기능시연.mp4)에서 같은 장면을 추출합니다.

## 편집과 출력

이 디렉터리에서 Node.js, Python 3와 NumPy, H.264 인코딩을 지원하는 FFmpeg를 사용합니다. 한국어 글꼴은 Noto Sans KR을 우선합니다.

```sh
npm ci
python prepare.py
npm run studio
```

`prepare.py`는 타임라인, 편집용 클립, 스테레오 믹스, SRT를 만듭니다. 경로에 FFmpeg가 없으면 `FFMPEG`에 실행 파일의 경로를 지정합니다. 로컬 Chromium을 사용하려면 `CHROME_FOR_RENDER`에 실행 파일의 경로를 지정합니다.

```sh
node render.mjs --proof
node render.mjs
```

첫 명령은 장면별 검수 이미지를 만들고, 두 번째 명령은 [대표 시연 MP4](../../../산출물/02_시연영상/플레오더_대표시연.mp4)를 출력합니다. 설명 음성 8개와 문장별 타임코드를 포함해 재편집 시 ElevenLabs를 다시 호출할 필요가 없습니다.

## 영상과 소리의 출처

- 설명 음성은 ElevenLabs의 한국어 Chaerin과 `eleven_multilingual_v2`로 제작했습니다. 한국어 자막은 API의 문자별 타이밍을 문장별로 묶었습니다. [ElevenLabs 타임코드 문서](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps)
- 주문·승인·현황 장면은 11월 12일 debug 에뮬레이터의 합성 시험 발화와 공개 Pleos SDK의 스피커 응답입니다. 원음 사이의 대기 시간과 반복 안내를 편집했고, 발화 순서를 보존했습니다. 주행 화면은 11월 13일 release 0.2.1에서 촬영했습니다.
- 정체 장면은 시험용 도착 시각과 시계 가속을 사용했습니다. 내비게이션은 경유지 전송 확인창까지 촬영했습니다. 문 앞 사진과 음식 이미지는 앱의 시뮬레이션 자산입니다. 코드로 만든 네 음의 음악은 SDK 원음 구간에서 멈춥니다.
- Motion Canvas의 시간 기반 트윈과 경로 그리기를 참고했고, Remotion에서 장면 프레임·자막·오디오 파형을 동기화했습니다. [Motion Canvas](https://github.com/motion-canvas/motion-canvas) · [트윈 문서](https://motioncanvas.io/docs/tweening/) · [Remotion 영상 제작 스킬](https://github.com/remotion-dev/skills)

<details>
<summary>도입 사진의 제작 정보</summary>

[서울 퇴근길 도입 사진](art/drive-home.jpg)은 내장 ImageGen으로 생성한 연출 이미지입니다. 에뮬레이터 기능 시연은 다음 탐색 장면부터 시작합니다.

```text
Create a cinematic 16:9 landscape photographic establishing still for a Korean automotive product film, from the front passenger seat of a contemporary unbranded car moving slowly through Seoul at blue hour just after rain. View is out the windshield. On the RIGHT two thirds a sweeping city road bends gently towards a distant line of red tail lights, warm lantern-like apartment windows and a hazy Korean hillside. Low near-black blue dashboard edge at the bottom right, subtle believable glass reflections, cool petrol blue shadows, warm amber highlights, human evening atmosphere. Keep the LEFT third particularly low-light, quiet and organically shadowed for later white Korean title typography. Natural high-end editorial car photography, 35mm lens, selective soft blur and fine film grain, realistic exposure, understated premium color grade. Establishing photograph only. No screens, interface, map overlays, people, logos, signage with readable words, graphic elements, typography or watermarks.
```

</details>
