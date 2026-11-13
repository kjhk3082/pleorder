"""Edit real ADB recordings; never synthesize UI states or successful SDK results."""
import json,pathlib,subprocess,wave,sys
ROOT=pathlib.Path(__file__).resolve().parents[2]
CACHE=ROOT/'.cache/submission';EDIT=CACHE/'edit';EDIT.mkdir(exist_ok=True)
OUT=ROOT/'산출물/02_시연영상';OUT.mkdir(parents=True,exist_ok=True)
FF=next((CACHE/'media-deps/imageio_ffmpeg/binaries').glob('*.exe'))
plan=json.loads((ROOT/'tools/submission/video-plan.json').read_text(encoding='utf-8-sig'))
def run(args):
    p=subprocess.run([str(FF),'-y','-hide_banner','-loglevel','error',*map(str,args)],cwd=ROOT,capture_output=True)
    if p.returncode:raise RuntimeError(p.stderr.decode('utf-8',errors='replace')[-2400:])
def tc(t,ass=False):
    h=int(t//3600);m=int(t//60)%60;s=t%60
    return f'{h}:{m:02}:{s:05.2f}' if ass else f'{h:02}:{m:02}:{int(s):02},{round((s%1)*1000):03}'
def assfile(name,title,seconds,captions,card=False):
    header='''[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Header,Malgun Gothic,29,&H00F8F8F5,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,7,128,80,23,1
Style: Meta,Malgun Gothic,19,&H00B4CBCE,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,9,80,128,29,1
Style: Caption,Malgun Gothic,27,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,2,110,110,27,1
Style: Title,Malgun Gothic,76,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,5,160,160,0,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
'''
    lines=[f'Dialogue: 0,0:00:00.00,{tc(seconds,True)},{"Title" if card else "Header"},,0,0,0,,{title}']
    if not card:lines.append(f'Dialogue: 0,0:00:00.00,{tc(seconds,True)},Meta,,0,0,0,,PLEORDER   ·   실제 청구 없는 시뮬레이션')
    for start,end,text in captions:lines.append(f'Dialogue: 0,{tc(start,True)},{tc(end,True)},Caption,,0,0,0,,{text}')
    p=EDIT/(name+'.ass');p.write_text(header+'\n'.join(lines)+'\n',encoding='utf-8-sig');return p.relative_to(ROOT).as_posix()
def encode(source,dest,seconds,subtitles,audio=None,card=False,pace=1):
    if '--reuse' in sys.argv and pathlib.Path(dest).exists():return
    ins=['-f','lavfi','-i',f'color=c=0x102e43:s=1920x1080:r=30:d={seconds}'] if card else ['-i',source]
    ins+=['-i',audio] if audio else ['-f','lavfi','-i','anullsrc=r=48000:cl=stereo']
    vf='' if card else 'scale=1664:936:flags=lanczos,pad=1920:1080:128:70:color=0x102e43,'
    vf+=f'ass={subtitles},fps=30,setsar=1,fade=t=in:d=0.2,fade=t=out:st={seconds-.25}:d=0.25'
    af=f'atempo={pace:.5f},loudnorm=I=-18:TP=-1.5:LRA=11,apad,atrim=duration={seconds}'
    run([*ins,'-map','0:v','-map','1:a','-vf',vf,'-af',af,'-t',seconds,'-c:v','libx264','-preset','fast','-crf','25','-pix_fmt','yuv420p','-threads','3','-c:a','aac','-b:a','96k','-ar','48000','-ac','2','-movflags','+faststart',dest])
parts=[];offset=6;all_captions=[];chapters=[('00:00','소개')]
intro=EDIT/'intro.mp4'
encode(None,intro,6,assfile('intro','플레오더\\N가는 길에 준비하는 한 끼',6,[[0,6,'Pleos Connect · 배달과 픽업 · 실제 에뮬레이터 시연']],True),card=True);parts.append(intro)
for index,c in enumerate(plan):
    audio=CACHE/'narration'/(c['id']+'.wav');pace=1
    if c['id']=='09-speech':
        inputs=json.loads((CACHE/'recordings/09-inputs.json').read_text())
        args=['-i',CACHE/'recordings/09-speech.wav'];filters=['[0:a]volume=1[speaker]'];names=['[speaker]']
        for i,item in enumerate(inputs,1):
            args+=['-i',CACHE/'voice'/(item['name']+'.wav')]
            filters.append(f'[{i}:a]adelay={int(item["time"]*1000)}:all=1[input{i}]');names.append(f'[input{i}]')
        filters.append(''.join(names)+f'amix=inputs={len(names)}:normalize=0,atrim=duration={c["seconds"]}[mixed]')
        audio=EDIT/'speech-mixed.wav';run([*args,'-filter_complex',';'.join(filters),'-map','[mixed]','-ar','24000',audio])
    elif audio.exists():
        with wave.open(str(audio),'rb') as w:duration=w.getnframes()/w.getframerate()
        pace=max(1,duration/(c['seconds']-1))
    else:audio=None
    captions=c['captions'];sub=assfile(c['id'],c.get('cardTitle',c['title']),c['seconds'],captions,c.get('concept',False))
    dest=EDIT/(c['id']+'.mp4');encode(CACHE/'recordings'/(c['id']+'.mp4'),dest,c['seconds'],sub,audio,pace=pace,card=c.get('concept',False));parts.append(dest)
    chapters.append((f'{offset//60:02}:{offset%60:02}',c['title']))
    all_captions += [(a+offset,b+offset,t) for a,b,t in captions]
    offset+=c['seconds'];print('Rendered',c['id'],flush=True)
outro=EDIT/'outro.mp4';encode(None,outro,8,assfile('outro','목적지부터 식사까지\\N플레오더',8,[[0,8,'공개 SDK · 주문·결제 시뮬레이션 | 소스·실행 APK·검증 범위는 저장소 참고']],True),card=True);parts.append(outro)
manifest=EDIT/'concat.txt';manifest.write_text(''.join("file '"+p.as_posix()+"'\n" for p in parts),encoding='utf-8')
final=OUT/'플레오더_전체기능시연.mp4'
run(['-f','concat','-safe','0','-i',manifest,'-c','copy','-movflags','+faststart',final])
(OUT/'플레오더_전체기능시연.srt').write_text('\n\n'.join(f'{i}\n{tc(a)} --> {tc(b)}\n{t}' for i,(a,b,t) in enumerate(all_captions,1))+'\n',encoding='utf-8-sig')
(OUT/'장면별_설명.md').write_text('# 실제 기능 시연 영상\n\n'+f'길이: 약 {(offset+8)//60}분 {(offset+8)%60}초 · 1920×1080 · 30fps\n\n'+'\n'.join(f'- {t} {name}' for t,name in chapters)+'\n\n## 녹화와 편집 범위\n\n실제 Pleos 에뮬레이터를 ADB로 녹화했습니다. 설명 자막과 Windows 한국어 합성 내레이션을 추가했습니다. 음성 SDK 장면은 가상 마이크에 주입한 합성 시험 음성과 실제 에뮬레이터 스피커의 TTS 응답을 함께 담았습니다. 사람 목소리·실차 테스트가 아닙니다. 시간 가속과 목적지 상태 이벤트 주입을 해당 장면에 표시했습니다. 내비게이션 장면은 전송 확인창까지입니다. 정체 장면은 독립된 도착정보 시험 입력과 시계 가속을 사용합니다. Gleo 연결 카드는 향후 기획이며 실제 연동 화면이 아닙니다. 음성 장면은 11월 12일 debug 기록이며 새 release의 반복 검증을 의미하지 않습니다. 주문·결제·라이더·문 앞 사진은 시뮬레이션입니다.\n\n메뉴·설정 장면은 주차 상태이며, 주행 제한과 Gleo 승인 범위는 검증 문서를 참고하세요. 모든 예외 상황이 영상에 포함되어 있지는 않습니다. 예외·개인화·다중 주문 등은 회귀 검사와 별도 검증 문서에서 확인할 수 있습니다.\n\n## 내레이션\n\n'+'\n\n'.join('### '+c['title']+'\n\n'+(c['narration'] or '별도 내레이션 없이 시험 입력과 실제 SDK 음성 응답을 재생합니다.') for c in plan)+'\n',encoding='utf-8')
print('VIDEO_READY',final.stat().st_size,'bytes',offset+8,'seconds',flush=True)
