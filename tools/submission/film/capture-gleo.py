"""Capture the release through the emulator microphone, paired with the exact caller WAV."""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import threading
import time
import urllib.request

film = Path(__file__).resolve().parent
root = film.parents[2]
parser = argparse.ArgumentParser()
parser.add_argument("case", choices=["park", "drive"])
parser.add_argument("output", type=Path)
parser.add_argument("--serial", default="emulator-5554")
args = parser.parse_args()
out = args.output.resolve()
out.mkdir(parents=True, exist_ok=False)
adb = [shutil.which("adb") or "adb", "-s", args.serial]
ff = os.environ.get("FFMPEG") or shutil.which("ffmpeg") or next((root/".cache/submission/media-deps/imageio_ffmpeg/binaries").glob("*.exe"))
stop = threading.Event()

def device(*cmd):
    return subprocess.check_output([*adb,*cmd],timeout=25)

def console(route, method):
    with urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:18088"+route, method=method), timeout=5) as response:
        return json.load(response)

def heartbeat():
    while not stop.is_set():
        try: console("/browser/session?client=pleorder-film", "POST")
        except OSError: pass
        stop.wait(.7)

def save_session():
    (out/"session.json").write_text(json.dumps(session,ensure_ascii=False,indent=2),encoding="utf8")

def app_log():
    for raw in logger.stdout:
        line = raw.decode("utf8","replace")
        match = re.search(r"(?:BACKGROUND_)?CALLBACK (\w+) status=(\w+)", line)
        if match:
            callbacks.append((time.monotonic()-start, *match.groups()))

def game():
    for action,expected,names in [
        ("order","PREPARE_FOOD_ORDER",["order","order2"]),
        ("approve","CONFIRM_FOOD_ORDER",["explicit","approve2"]),
        ("status","GET_FOOD_ORDER_STATUS",["statuslatest","status2"])
    ]:
        if action=="status":
            device("shell","input","keyevent","KEYCODE_HOME")
            time.sleep(1.2)
        for name in names:
            if action!="order" or name!=names[0]:
                device("shell","cmd","voiceinteraction","hide")
                time.sleep(.7)
            when=time.monotonic()-start
            if when>139: raise RuntimeError("Capture window expired before "+action)
            fixture=film/"narration/driver"/(name+".mp3")
            pcm=out/(name+".pcm")
            subprocess.run([str(ff),"-v","error","-y","-i",str(fixture),"-ac","1","-ar","16000","-f","s16le",str(pcm)],check=True)
            before=len(callbacks)
            subprocess.run([sys.executable,str(root/"tools/emulator-audio-test.py"),str(pcm),"--target","gleo","--serial",args.serial,"--lead-ms","1900"],check=True,stdout=subprocess.DEVNULL,timeout=50)
            deadline=time.monotonic()+20
            while time.monotonic()<deadline and not any(row[1]==expected for row in callbacks[before:]):
                time.sleep(.25)
            hit=next((row for row in callbacks[before:] if row[1]==expected and row[2]==("asking" if action=="order" else "success")),None)
            turn={"action":action,"fixture":name,"input":round(when+1.9,3),"callback":round(hit[0],3) if hit else None}
            session["turns"].append(turn)
            print(action,name,turn["callback"],flush=True)
            save_session()
            if hit:
                time.sleep({"order":10,"approve":12,"status":32}[action])
                (out/(action+".png")).write_bytes(device("exec-out","screencap","-p"))
                break
        else: raise RuntimeError("No successful release callback for "+action)

if "versionName=0.2.2" not in device("shell","dumpsys","package","dev.pleorder.app").decode():
    raise SystemExit("Expected public release 0.2.2")
if args.case=="drive":
    device("forward","tcp:18088","tcp:8088")
    threading.Thread(target=heartbeat,daemon=True).start()
    time.sleep(1.2)
    console("/vehicle/gear?gear=Drive","PUT")
    console("/vehicle/controls?speed=30&accelerator=0&brake=0&steering=0","PUT")
    time.sleep(3)
session={"case":args.case,"lead":1.9,"turns":[]}
remote="/sdcard/Download/pleorder-film-"+str(time.time_ns())+".mp4"
try:
    device("shell","am","start","--user","current","-W","-n","dev.pleorder.app/.DrivingActivity")
    time.sleep(3)
    device("shell","input","keyevent","KEYCODE_HOME")
    time.sleep(1.5)
    start=time.monotonic()
    logger=subprocess.Popen([*adb,"logcat","-T","1","PleorderGleo:I","*:S"],stdout=subprocess.PIPE)
    callbacks=[]
    threading.Thread(target=app_log,daemon=True).start()
    rec=subprocess.Popen([*adb,"shell","screenrecord","--size","1440x810","--bit-rate","9000000","--time-limit","179",remote])
    sound=subprocess.Popen([sys.executable,str(root/"tools/submission/capture-audio.py"),str(out/"speaker.wav"),"--rate","44100","--seconds","172","--serial",args.serial.split("-")[-1],"--stop-file",str(out/"stop")])
    try:
        time.sleep(2.5)
        game()
    finally:
        end=time.monotonic()-start
        session["end"]=round(end,3)
        save_session()
        (out/"stop").touch()
        device("shell","pkill","-INT","-x","screenrecord")
        rec.wait(timeout=12)
        device("pull",remote,str(out/"screen.mp4"))
        logger.terminate()
        sound.wait(timeout=176)
finally:
    if args.case=="drive":
        try:
            console("/vehicle/controls?speed=0&accelerator=0&brake=0&steering=0","PUT")
            console("/vehicle/gear?gear=Park","PUT")
        finally:
            stop.set()
            console("/browser/session?client=pleorder-film&closing=1","POST")
