"""Prepare replayable media for the Remotion cut from the original contest recordings."""
import concurrent.futures
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import wave

import numpy as np

FILM = Path(__file__).resolve().parent
ROOT = FILM.parents[2]
CACHE = ROOT / ".cache/submission"
PUBLIC = FILM / "public"
OUT = ROOT / "산출물/02_시연영상"
ORIGINAL = OUT / "플레오더_전체기능시연.mp4"
PLAN = json.loads((FILM / "edit.json").read_text(encoding="utf-8"))
FPS = PLAN["fps"]
RATE = 48000
LEAD = 0.33
TAIL = 0.62
FF = os.environ.get("FFMPEG") or shutil.which("ffmpeg") or next(
    (CACHE / "media-deps/imageio_ffmpeg/binaries").glob("*.exe"), None
)
if not FF:
    raise SystemExit("Set FFMPEG to the ffmpeg executable.")


def ffmpeg(*args):
    return subprocess.run([str(FF), "-v", "error", "-nostdin", "-y", *map(str, args)],
                          capture_output=True, check=True).stdout


def source(record, offset, audio=False):
    path = CACHE / ("edit/speech-mixed.wav" if audio else f"recordings/{record}.mp4")
    if path.exists():
        return path, offset, ""
    if not ORIGINAL.is_file():
        raise FileNotFoundError(ORIGINAL)
    # The full 1080p film uses this exact viewport inside its caption bars.
    return ORIGINAL, PLAN["chapterOffsets"][record] + offset, "crop=1664:936:128:70,"


def samples(path, start=0, seconds=None):
    trim = ["-t", seconds] if seconds is not None else []
    data = ffmpeg("-ss", start, "-i", path, *trim, "-vn", "-ac", 1,
                  "-ar", RATE, "-f", "f32le", "-")
    return np.frombuffer(data, dtype="<f4").copy()


def make_clip(job):
    path, pos, prefix = source(job["record"], job["sourceStart"])
    crop = job["crop"]
    target = "1600:900" if crop == [0, 0, 1920, 1080] else "1200:750"
    fingerprint = json.dumps([path.name, path.stat().st_size, pos, crop, job.get("hold",False), job["frames"], target, FPS])
    file = hashlib.sha256(fingerprint.encode()).hexdigest()[:16] + ".mp4"
    target_path = PUBLIC / file
    if not target_path.exists():
        x, y, width, height = crop
        hold = f"trim=end_frame=1,tpad=stop_mode=clone:stop_duration={job['frames']/FPS+1}," if job.get("hold") else ""
        vf = (f"{prefix}scale=1920:1080:flags=lanczos,crop={width}:{height}:{x}:{y},"
              f"scale={target}:flags=lanczos,setsar=1,fps={FPS},{hold}tpad=stop_mode=clone:stop_duration=1")
        temp = target_path.with_suffix(".part.mp4")
        ffmpeg("-ss", pos, "-i", path, "-an", "-vf", vf, "-frames:v", job["frames"],
               "-threads", 2, "-c:v", "libx264", "-preset", "veryfast", "-crf", 17,
               "-pix_fmt", "yuv420p", "-g", FPS, "-movflags", "+faststart", temp)
        temp.replace(target_path)
    job["file"] = file


def level(signal):
    """Match dialogue levels without lifting the room tone in the recorded pauses."""
    if not signal.size:
        raise ValueError("Empty audio take")
    audible = signal[np.abs(signal) > .013]
    rms = np.sqrt(np.mean(audible**2)) if len(audible) else .09
    gain = min(.145 / max(.001, rms), .84 / max(.001, np.max(np.abs(signal))))
    return signal * gain


def stamp(seconds):
    ms = round(seconds * 1000)
    return f"{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}"


def pluck(score, when, note, strength, pan=0, length=1.3):
    freq = 440 * 2 ** ((note - 69) / 12)
    start = round(when * RATE)
    count = min(round(length * RATE), len(score) - start)
    if count <= 0:
        return
    t = np.arange(count) / RATE
    body = (np.sin(2*np.pi*freq*t) + .28*np.sin(4*np.pi*freq*t)*np.exp(-4*t)
            + .10*np.sin(6*np.pi*freq*t)*np.exp(-7*t))
    envelope = (1-np.exp(-t*40))*np.exp(-t*3.2)*(1-np.minimum(1, t/length)**5)
    tone = strength*body*envelope
    score[start:start+count, 0] += tone*(1-.32*pan)
    score[start:start+count, 1] += tone*(1+.32*pan)


def build():
    PUBLIC.mkdir(exist_ok=True)
    shutil.copyfile(FILM / "art/drive-home.jpg", PUBLIC / "drive-home.jpg")
    for name in ["images/bibimbap.png", "images/chicken.png", "images/delivery-proof.png"]:
        shutil.copyfile(ROOT / "app/src/main/assets/web" / name, PUBLIC / Path(name).name)

    jobs = []
    scenes = []
    dialogue = []
    subtitles = []
    offset = 0
    for s in PLAN["scenes"]:
        scene = {"id": s["id"], "title": s["title"], "from": offset, "shots": [], "cues": []}
        if "takes" in s:
            frames = 0
            fragments = []
            for take in s["takes"]:
                count = round((take["to"] - take["from"]) * FPS)
                item = {"record": "09-speech", "sourceStart": take["from"], "crop": take["crop"],
                        "at": frames, "frames": count, "turn": take["turn"], "speaker": take["speaker"]}
                scene["shots"].append(item)
                audio, pos, _ = source("09-speech", take["from"], audio=True)
                data = samples(audio, pos, count/FPS)
                size = count * RATE//FPS
                fragment = np.zeros(size, dtype=np.float32)
                used = min(size, data.size)
                fragment[:used] = data[:used]
                # Cuts fall in recorded silence. A 10 ms edge ramp also removes possible pops.
                ramp = np.linspace(0, 1, int(RATE*.01))
                fragment[:len(ramp)] *= ramp
                fragment[-len(ramp):] *= ramp[::-1]
                fragments.append(fragment)
                for a, b, txt in take.get("subtitles", [[0, count/FPS, take.get("caption", "")]]):
                    if txt:
                        scene["cues"].append({"text": txt, "startMs": round((frames/FPS + a)*1000),
                                              "endMs": round((frames/FPS + min(b,count/FPS))*1000)})
                frames += count
            signal = level(np.concatenate(fragments))
            scene["envelope"] = [round(float(np.sqrt(np.mean(x*x))), 3)
                                 for x in np.array_split(signal, frames)]
        else:
            VO = FILM / "narration"
            cues = json.loads((VO / f'{s["id"]}.json').read_text(encoding="utf-8"))
            data = level(samples(VO / f'{s["id"]}.mp3'))
            frames = math.ceil((max(len(data)/RATE, cues[-1]["endMs"]/1000) + LEAD + TAIL)*FPS)
            scene["cues"] = [dict(c, startMs=c["startMs"]+round(LEAD*1000),
                                  endMs=c["endMs"]+round(LEAD*1000)) for c in cues]
            signal = np.zeros(frames * RATE//FPS, np.float32)
            signal[round(LEAD*RATE):round(LEAD*RATE)+len(data)] = data
            shots = s.get("shots", [])
            for i, shot in enumerate(shots):
                at = round(shot["at"]*FPS)
                end = round(shots[i+1]["at"]*FPS) if i+1 < len(shots) else frames
                scene["shots"].append({"record":shot["record"], "sourceStart":shot["from"],
                                       "crop":shot["crop"], "frames":end-at, "at":at, "hold":shot.get("hold",False)})
        scene["frames"] = frames
        for item in scene["cues"]:
            subtitles.append((offset/FPS + item["startMs"]/1000, offset/FPS + item["endMs"]/1000, item["text"]))
        scenes.append(scene)
        jobs.extend(scene["shots"])
        dialogue.append(signal)
        offset += frames

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(make_clip, jobs))

    # An original, sparse four-note motif. Leave the entire SDK field recording unscored.
    voice = np.concatenate(dialogue)
    mix = np.column_stack([voice,voice])
    for s in scenes:
        if s["id"] == "voice":
            continue
        start, duration = s["from"]/FPS, s["frames"]/FPS
        section = mix[round(start*RATE):round((start+duration)*RATE)]
        tones = [50, 57, 62, 66] if s["id"] != "decline" else [47,54,59,62]
        if s["id"] in ("intro","outro"):
            for t, pitch in [(0.04,62),(.27,69),(.66,74),(duration-1.15,69)]:
                pluck(section,t,pitch,.035,.2)
        else:
            pluck(section, .06, tones[2], .021, -.2)
        for j, t in enumerate(np.arange(0.8,duration-1.4,2.25)):
            pluck(section,float(t),tones[j%4],.015,(-1)**j*.4,1.6)
            if j%3 == 0:
                pluck(section,float(t)+.34,tones[(j+1)%4]+12,.008,.3,.9)
    wav = PUBLIC / "mix.wav"
    with wave.open(str(wav),"wb") as w:
        w.setparams((2,2,RATE,0,"NONE","not compressed"))
        w.writeframes((np.clip(mix,-.99,.99)*32767).astype("<i2").tobytes())
    ffmpeg("-i", wav, "-af","loudnorm=I=-16:TP=-1.8:LRA=8", "-ar", RATE, "-b:a","192k",
           "-c:a","aac", "-movflags","+faststart", PUBLIC/"master.m4a")
    wav.unlink()
    timeline = {"fps":FPS,"frames":offset,"scenes":scenes}
    (PUBLIC/"cut.json").write_text(json.dumps(timeline,ensure_ascii=False),encoding="utf-8")
    srt = "\n\n".join(f"{i}\n{stamp(a)} --> {stamp(b)}\n{txt}" for i,(a,b,txt) in enumerate(subtitles,1))
    (OUT/"플레오더_대표시연.srt").write_text(srt+"\n",encoding="utf-8-sig")
    print(f"{offset} frames, {offset/FPS:.2f}s, {len(jobs)} editorial shots, {len(subtitles)} subtitles")


if __name__ == "__main__":
    build()
