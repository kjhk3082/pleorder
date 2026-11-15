"""Edit recorded emulator footage and speaker audio alongside the exact injected utterances."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / ".cache" / "submission"
MOVIES = ROOT / "산출물" / "02_시연영상"
FF = os.environ.get("FFMPEG") or shutil.which("ffmpeg") or next((CACHE / "media-deps/imageio_ffmpeg/binaries").glob("*.exe"))
parser = argparse.ArgumentParser()
parser.add_argument("session", type=Path, help="Recording, speaker.wav and timings.json from the same microphone run")
parser.add_argument("fixtures", type=Path, help="WAVs corresponding to the actual injected PCM")
parser.add_argument("--chapter", action="store_true", help="Produce the 20-second entry in the full film")
parser.add_argument("--order", default="order")
parser.add_argument("--approval", default="confirm")
parser.add_argument("--status", default="status")
parser.add_argument("--approval-caption", default="운전자가 말로 승인하면 현대카드 M으로 모의 결제가 진행됩니다.")
parser.add_argument("--status-caption", default="차량 설정 화면에서 같은 주문의 진행 상태를 확인합니다.")
parser.add_argument("--lengths", nargs=3, type=float, metavar=("ORDER", "APPROVAL", "STATUS"), default=(22, 21, 20),
                    help="Seconds retained from each selected microphone turn")
parser.add_argument("--driving-session", type=Path, help="Optional separate D-gear microphone run")
parser.add_argument("--driving-start", type=float, default=14.0)
parser.add_argument("--driving-length", type=float, default=34.0)
args = parser.parse_args()
session = args.session.resolve()
video = session / "system-voice.mp4"
timings = dict(json.loads((session / "timings.json").read_text(encoding="utf-8")))
edit = CACHE / "edit"
edit.mkdir(parents=True, exist_ok=True)

def ff(*cmd):
    subprocess.run([str(FF), "-hide_banner", "-loglevel", "error", "-y", *map(str, cmd)], check=True, cwd=ROOT)

def stamp(t, ass=False):
    ms = round(t * 1000)
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h}:{m:02}:{s:02}.{ms//10:02}" if ass else f"{h:02}:{m:02}:{s:02},{ms:03}"

# The emulator speaker excludes the injected microphone. Align the exact fixtures with their original turns.
def mix_session(source, turns):
    mix = edit / (source.name + "-gleo-mix.wav")
    inputs = ["-i", source / "speaker.wav"]
    filters = ["[0:a]volume=3.0[spk]"]
    tracks = ["[spk]"]
    for i, (name, start) in enumerate(turns.items(), 1):
        inputs += ["-i", args.fixtures / (name + ".wav")]
        filters.append(f"[{i}:a]volume=0.82,adelay={round((start+0.8)*1000)}:all=1[u{i}]")
        tracks.append(f"[u{i}]")
    filters.append("".join(tracks) + f"amix=inputs={len(tracks)}:normalize=0,alimiter=limit=0.91[mix]")
    ff(*inputs, "-filter_complex", ";".join(filters), "-map", "[mix]", "-ar", 24000, mix)
    return mix

mix = mix_session(session, timings)
if args.chapter:
    dest = CACHE / "recordings" / "18-gleo-release"
    # Cut the cold WebView startup pause, keeping the spoken request and the visible quote.
    clip = "[0:v]trim=start=0:end=9,setpts=PTS-STARTPTS[v1];[1:a]atrim=start=0:end=9,asetpts=PTS-STARTPTS[a1];[0:v]trim=start=20:end=31,setpts=PTS-STARTPTS[v2];[1:a]atrim=start=20:end=31,asetpts=PTS-STARTPTS[a2];[v1][a1][v2][a2]concat=n=2:v=1:a=1[v][a]"
    ff("-i", video, "-i", mix, "-filter_complex", clip, "-map", "[v]", "-map", "[a]", "-t", 20, "-c:v", "libx264", "-threads", "3", "-preset", "fast", "-crf", "20", "-c:a", "aac", dest.with_suffix(".mp4"))
    ff("-i", dest.with_suffix(".mp4"), "-vn", "-ar", 24000, dest.with_suffix(".wav"))
    raise SystemExit(0)

segments = [
    (args.order, args.lengths[0], "차량 Gleo에서 주문 시작", "차량 설정에서 치킨 배달을 요청하면 플레오더가 결제 전 견적을 엽니다."),
    (args.approval, args.lengths[1], "총액과 카드를 듣고 승인", args.approval_caption),
    (args.status, args.lengths[2], "다른 화면에서 주문 현황 듣기", args.status_caption),
]
# ASS overlays are outside the application image, so labels never cover actual controls.
style = """[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Heading,Malgun Gothic,25,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,7,50,50,14,1
Style: Build,Malgun Gothic,16,&H00D9EAB4,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,9,50,50,20,1
Style: Subtitle,Malgun Gothic,21,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,2,34,34,12,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
parts = []
captions = []
offset = 0
shots = [(video, mix, timings[name], length, title, caption) for name, length, title, caption in segments]
if args.driving_session:
    drive = args.driving_session.resolve()
    turns = dict(json.loads((drive / "timings.json").read_text(encoding="utf-8")))
    shots.append((drive / "system-voice.mp4", mix_session(drive, turns), args.driving_start, args.driving_length,
                  "D단에서 주문하고 승인하기", "별도 주행 시험 · 시속 30km 신호에서 강남구청 배달, 현대카드 M 26,000원을 음성으로 승인했습니다."))
for number, (source_video, source_mix, start, duration, title, caption) in enumerate(shots, 1):
    subtitle = edit / f"gleo-cut-{number}.ass"
    label = f"{number:02}   {title}"
    text = "".join(f"Dialogue: 0,0:00:00.00,{stamp(duration,True)},{kind},,0,0,0,,{line}\n" for kind,line in [
        ("Heading",label), ("Build","Pleos Connect   /   release 0.2.2"), ("Subtitle",caption)])
    subtitle.write_text(style + text, encoding="utf-8-sig")
    vf = f"scale=1104:621:flags=lanczos,pad=1280:720:88:53:color=0x082636,ass={subtitle.relative_to(ROOT).as_posix()},fps=30,setsar=1"
    part = edit / f"gleo-cut-{number}.mp4"
    ff("-ss", start, "-i", source_video, "-ss", start, "-i", source_mix, "-t", duration, "-map", "0:v", "-map", "1:a",
       "-vf", vf, "-af", "apad,afade=t=in:d=0.08,afade=t=out:st="+str(duration-.15)+":d=0.15", "-c:v", "libx264", "-crf", "23", "-preset", "fast", "-threads", "3",
       "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-ar", "48000", part)
    parts.append(part)
    captions.append(f"{number}\n{stamp(offset)} --> {stamp(offset+duration)}\n{title}. {caption}")
    offset += duration
manifest = edit / "gleo-cuts.txt"
manifest.write_text("".join(f"file '{p.as_posix()}'\n" for p in parts), encoding="utf-8")
out = MOVIES / "플레오더_Gleo_실기시연.mp4"
ff("-f", "concat", "-safe", "0", "-i", manifest, "-c", "copy", "-movflags", "+faststart", out)
out.with_suffix(".srt").write_text("\n\n".join(captions)+"\n", encoding="utf-8-sig")
print(out.name, offset, out.stat().st_size)
