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
from edition import CACHE, FILM, OUT, PUBLIC, RATE, FPS, STEP, captured_voice, clip, run, tc, voice_meta
from soundtrack import percussion, speech_envelope, tone

WORK = CACHE / "film" / "shortform"
NAME = "플레오더_세로숏폼"
SCENES = [
    ("hook", [("shortform", "hook")]),
    ("idea", [("shortform", "idea")]),
    ("order", [("driver", "order")]),
    ("quote", [("system", "amount"), ("shortform", "quote")]),
    ("status", [("shortform", "ask"), ("system", "cooking")]),
    ("traffic", [("shortform", "traffic")]),
    ("pickup", [("shortform", "pickup")]),
    ("finish", [("shortform", "finish")]),
]


def wav(path, pcm):
    with wave.open(str(path), "wb") as target:
        target.setparams((1 if pcm.ndim == 1 else pcm.shape[1], 2, RATE, 0, "NONE", ""))
        target.writeframes((np.clip(pcm, -.99, .99)*32767).astype("<i2").tobytes())


def prepare_footage():
    target = PUBLIC / "reel"
    target.mkdir(parents=True, exist_ok=True)
    for name in ("door", "traffic", "wheel", "bite", "dash"):
        shutil.copyfile(FILM/"reel-assets"/(name+".jpg"), target/(name+".jpg"))
    for name, original, start in (("seoul", "seoul-night-26690701.mp4", .8),
                                  ("sauce", "chicken-sauce-31707113.mp4", .3)):
        dest = target/(name+".mp4")
        if dest.exists():
            continue
        tmp = dest.with_suffix(".part.mp4")
        run("-ss",start,"-i",WORK/original,"-t",11,"-an","-vf",
            "fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1",
            "-c:v","libx264","-threads","4","-crf","18","-preset","veryfast","-g","30","-pix_fmt","yuv420p",tmp)
        tmp.replace(dest)


def reel_score(dialogue, scenes):
    # Short, dry bass and rim on the offbeat leave space for the car speaker.
    out = np.zeros((len(dialogue),2),np.float32)
    rng = np.random.default_rng(309)
    kick, rim, shakers = percussion(rng)
    beat = 60/118
    def add(sec, samples, gain, pan=0):
        offset = round(sec*RATE)
        n = min(len(samples),len(out)-offset)
        if n > 0:
            out[offset:offset+n] += (samples[:n]*gain)[:,None]*np.sqrt([(1-pan)/2,(1+pan)/2])
    for bar in range(math.ceil(len(out)/RATE/4/beat)):
        at = bar*4*beat
        root,upper = [(43,(62,65,69)),(41,(60,64,67)),(38,(60,65,69)),(40,(59,64,67))][bar%4]
        for off,note,length in ((0,root,.42),(1.5,root+12,.31),(2.75,root+7,.23)):
            add(at+off*beat,tone(note,length,"bass"),.22)
        for off in (.75,2.25,3.5):
            for j,note in enumerate(upper):
                add(at+off*beat+.009*j,tone(note,.26,"pluck"),.063 if off==.75 else .043,(j-1)*.48)
        for off in (0,2.5):
            add(at+off*beat,kick,.19)
        for off in (1,3):
            add(at+off*beat+.012,rim,.086,.1)
        for j,off in enumerate((.5,1.5,2.5,3.5)):
            add(at+off*beat+.01,shakers[(j+bar)%3],.054 if j==3 else .031,(-1)**j*.4)
    duck = 1-.67*speech_envelope(dialogue)
    t = np.arange(len(out))/RATE
    out *= (duck*np.minimum(1,t/.045)*np.clip((len(out)/RATE-t)/.35,0,1))[:,None]
    starts = {s["id"]:s["from"]/FPS for s in scenes}
    # An apartment bell, steering-wheel switch and soft approval sound connect the hard cuts.
    for when,note,gain in ((.54,83,.13),(.80,78,.115),(starts["quote"]+.06,79,.081),
                           (starts["finish"]+2.24,78,.095),(starts["finish"]+2.45,83,.075)):
        add(when,tone(note,.46,"pluck"),gain,-.12)
    add(starts["order"]-.05,rim,.14,.12)
    return out


def prepare():
    WORK.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(exist_ok=True)
    prepare_footage()
    timeline = []
    subtitles = []
    speech = []
    offset = 0
    for name, lines in SCENES:
        cursor = round(RATE * (.035 if name == "hook" else .09))
        cues = []
        parts = []
        for role, line in lines:
            if role == "system" and line == "amount":
                pcm = captured_voice(CACHE/"film/park-status-take/speaker.wav",13.80,1.77,"short-quote")
                timed = [{"text":"합계 26,000원이에요.","startMs":0,"endMs":1770}]
            elif role == "system":
                pcm = captured_voice(CACHE/"film/park-status-take/speaker.wav", 51.85, 4.55, "short-cooking")
                timed = [{"text":"매장에서 조리 중이고,", "startMs":0, "endMs":1740},
                         {"text":"배달 도착까지 약 27분 남았어요.", "startMs":1740, "endMs":4550}]
            else:
                pcm, timed = voice_meta(role, line)
                if role == "driver":
                    timed = [{"text":"플레오더에서 치킨 한 마리를","startMs":0,"endMs":1540},
                             {"text":"우리 집으로 배달해 주세요.","startMs":1540,"endMs":2972}]
            parts.append((cursor, pcm))
            for cue in timed:
                cues.append({"text":cue["text"], "role":role,
                             "startMs":round(cursor/RATE*1000)+cue["startMs"],
                             "endMs":round(cursor/RATE*1000)+cue["endMs"]})
            cursor += len(pcm) + round(RATE*.11)
        frames = math.ceil((cursor/RATE + .19)*FPS)
        if name == "finish":
            frames = 45*FPS-offset
            if not cursor <= frames*STEP <= cursor+2.3*RATE:
                raise ValueError(f"End beat does not fit the recorded speech: {frames/FPS:.2f}s for {cursor/RATE:.2f}s")
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
        if name == "traffic":
            scene["beforeDelay"] = clip(CACHE/"recordings/14-traffic.mp4",11.8,60,"tracking")
        timeline.append(scene)
        subtitles.extend((offset/FPS+c["startMs"]/1000,offset/FPS+c["endMs"]/1000,c["text"]) for c in cues)
        speech.append(track)
        offset += frames
    if not 30*FPS <= offset <= 60*FPS:
        raise ValueError("Outside the contest's 30–60 second window")
    dialogue = np.concatenate(speech)
    wav(WORK/"music.wav",reel_score(dialogue,timeline))
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
            "-metadata","title=플레오더 · 치킨이 저보다 먼저 퇴근했어요",ready)
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
