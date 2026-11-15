"""Build the Korean vertical film from prepared voice, screen captures and an original score."""
import argparse
import json
import math
from pathlib import Path
import shutil
import sys
import tempfile
import wave
import numpy as np
from edition import CACHE, OUT, PUBLIC, RATE, FPS, STEP, captured_voice, clip, run, tc, voice_meta
from soundtrack import score

WORK = CACHE / "film" / "shortform"
NAME = "플레오더_세로숏폼"
SCENES = [
    ("hook", [("shortform", "hook")]),
    ("idea", [("shortform", "idea")]),
    ("order", [("driver", "order")]),
    ("quote", [("shortform", "quote")]),
    ("status", [("shortform", "ask"), ("system", "cooking")]),
    ("traffic", [("shortform", "traffic")]),
    ("pickup", [("shortform", "pickup")]),
    ("finish", [("shortform", "finish")]),
]


def wav(path, pcm):
    with wave.open(str(path), "wb") as target:
        target.setparams((1 if pcm.ndim == 1 else pcm.shape[1], 2, RATE, 0, "NONE", ""))
        target.writeframes((np.clip(pcm, -.99, .99)*32767).astype("<i2").tobytes())


def prepare():
    WORK.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(exist_ok=True)
    timeline = []
    subtitles = []
    speech = []
    offset = 0
    for name, lines in SCENES:
        cursor = round(RATE * (.07 if name == "hook" else .16))
        cues = []
        parts = []
        for role, line in lines:
            if role == "system":
                pcm = captured_voice(CACHE/"film/park-status-take/speaker.wav", 51.85, 4.55, "short-cooking")
                timed = [{"text":"매장에서 조리 중이고,", "startMs":0, "endMs":1740},
                         {"text":"배달 도착까지 약 27분 남았어요.", "startMs":1740, "endMs":4550}]
            else:
                pcm, timed = voice_meta(role, line)
            parts.append((cursor, pcm))
            for cue in timed:
                cues.append({"text":cue["text"], "role":role,
                             "startMs":round(cursor/RATE*1000)+cue["startMs"],
                             "endMs":round(cursor/RATE*1000)+cue["endMs"]})
            cursor += len(pcm) + round(RATE*.16)
        frames = math.ceil((cursor/RATE + (.52 if name == "finish" else .17))*FPS)
        track = np.zeros(frames*STEP, np.float32)
        for at, samples in parts:
            track[at:at+len(samples)] = samples
        wav(WORK/(name+".wav"), track)
        scene = {"id":name, "from":offset, "frames":frames, "cues":cues}
        shots = {
            "idea":(CACHE/"recordings/01-discover.mp4",1.2,"mapOnly"),
            "quote":(CACHE/"film/park-status-take/screen.mp4",34.15,"amount"),
            "traffic":(CACHE/"recordings/14-traffic.mp4",24.4,"tracking"),
            "pickup":(CACHE/"recordings/13-pickup-complete.mp4",14.2,"route"),
        }
        if name in shots:
            src, start, crop = shots[name]
            scene["clip"] = clip(src, start, frames, crop)
        if name == "quote":
            scene["estimate"] = clip(CACHE/"film/park-status-take/screen.mp4",21,frames,"quote")
        timeline.append(scene)
        subtitles.extend((offset/FPS+c["startMs"]/1000,offset/FPS+c["endMs"]/1000,c["text"]) for c in cues)
        speech.append(track)
        offset += frames
    if not 30*FPS <= offset <= 60*FPS:
        raise ValueError("Outside the contest's 30–60 second window")
    dialogue = np.concatenate(speech)
    wav(WORK/"music.wav",score(offset/FPS,dialogue,mood=3))
    data = {"frames":offset, "scenes":timeline}
    (PUBLIC/"shortform.json").write_text(json.dumps(data,ensure_ascii=False),encoding="utf8")
    text = "\n\n".join(f"{i}\n{tc(a)} --> {tc(b)}\n{line}" for i,(a,b,line) in enumerate(subtitles,1))
    (OUT/(NAME+".srt")).write_text(text+"\n",encoding="utf-8-sig")
    print(f"{offset} frames, {offset/FPS:.2f}s, {len(subtitles)} cues")


def assemble(upstream):
    sys.path.insert(0, str(upstream.resolve()))
    from app.services.video_project import VideoProject
    cut = json.loads((PUBLIC/"shortform.json").read_text(encoding="utf8"))
    spec = {"project_id":"pleorder-vertical", "settings":{"width":1080,"height":1920,"fps":30,"bgm_volume":1.0},
            "bgm":str(WORK/"music.wav"), "scenes":[]}
    for s in cut["scenes"]:
        name = s["id"]
        spec["scenes"].append({"id":name,"narration":" ".join(c["text"] for c in s["cues"]),
                               "audio":str(WORK/(name+".wav")), "footage":str(WORK/(name+"-picture.mp4"))})
    if not shutil.which("ffprobe") or not shutil.which("ffmpeg"):
        raise SystemExit("Put FFmpeg and ffprobe on PATH before running MoneyPrinterTurbo")
    # A fresh local project avoids Windows sync locks when upstream replaces immutable artifacts.
    with tempfile.TemporaryDirectory(prefix="pleorder-short-") as folder:
        project = VideoProject(folder)
        revision = project.create_revision(spec)
        result = project.render(revision["revision_id"],on_stage=lambda s,cached:print(s.key,flush=True))
        master = Path(result["export"]["path"])
        ready = WORK/"shortform-final.mp4"
        run("-i",master,"-map","0:v:0","-map","0:a:0","-c:v","copy","-af","loudnorm=I=-15.5:TP=-1.7:LRA=8",
            "-ar","48000","-c:a","aac","-b:a","192k","-t",cut["frames"]/FPS,"-movflags","+faststart",
            "-metadata","title=플레오더 · 치킨은 벌써 문 앞인데",ready)
        ready.replace(OUT/(NAME+".mp4"))
        print("MoneyPrinterTurbo export",result["export"]["sha256"],flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("action",choices=["prepare","assemble"])
    parser.add_argument("--mpt",type=Path,default=CACHE/"MoneyPrinterTurbo")
    args = parser.parse_args()
    if args.action == "prepare":
        prepare()
    else:
        assemble(args.mpt)
