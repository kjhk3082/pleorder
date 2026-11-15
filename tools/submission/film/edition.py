"""Prepare three cuts from the original emulator captures and their recorded speaker tracks."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import wave
import numpy as np
from soundtrack import RATE, score

FILM=Path(__file__).resolve().parent
ROOT=FILM.parents[2]
CACHE=ROOT/".cache/submission"
PUBLIC=FILM/"public"
OUT=ROOT/"산출물/02_시연영상"
FF=os.environ.get("FFMPEG") or shutil.which("ffmpeg") or next((CACHE/"media-deps/imageio_ffmpeg/binaries").glob("*.exe"))
FPS=30
STEP=RATE//FPS
NAMES={"Film":"플레오더_대표시연","Gleo":"플레오더_Gleo_실기시연","Full":"플레오더_전체기능시연"}
CROPS={"wide":(0,0,1,1),"app":(.331,.051,.661,.848),"quote":(.37,.10,.58,.72),
       "amount":(.473,.184,.397,.57),"route":(.38,.17,.55,.62),"tracking":(.56,.17,.42,.57),
       "menu":(.337,.11,.485,.69),"dash":(0,.014,.99,.789),"assistant":(.325,0,.668,.67),
       "listOnly":(.015,.18,.414,.53),"routeList":(.018,.438,.555,.335),
       "mapOnly":(.426,.12,.551,.68),"picker":(.237,.037,.528,.923),"proof":(.385,.106,.554,.732)}

def run(*args):
    p=subprocess.run([str(FF),"-v","error","-nostdin","-y",*map(str,args)],capture_output=True)
    if p.returncode:raise RuntimeError(p.stderr.decode("utf8","replace")[-1800:])
    return p.stdout

def audio(file,start=0,length=None,system=False):
    trim=["-t",length] if length is not None else []
    filt="highpass=f=85,lowpass=f=9400" if system else "highpass=f=60"
    raw=run("-ss",start,"-i",file,*trim,"-vn","-af",filt,"-ar",RATE,"-ac",1,"-f","f32le","-")
    sig=np.frombuffer(raw,"<f4").copy()
    if not sig.size:raise ValueError(f"Empty audio clip {file} at {start}")
    voiced=np.abs(sig)>max(.0015,np.quantile(np.abs(sig),.82)*.14)
    if not np.any(voiced):raise ValueError(f"No audible speech in {file} at {start}")
    gain=.147/max(.001,np.sqrt(np.mean(sig[voiced]**2)))
    sig*=min(gain,.91/max(.001,np.max(abs(sig))))
    ramp=min(round(.014*RATE),len(sig)//2)
    if ramp:
        edge=np.linspace(0,1,ramp);sig[:ramp]*=edge;sig[-ramp:]*=edge[::-1]
    return sig

def tc(seconds):
    n=round(seconds*1000)
    return f"{n//3600000:02}:{n//60000%60:02}:{n//1000%60:02},{n%1000:03}"

def clip(source,at,frames,crop):
    spec=json.dumps([source.name,source.stat().st_size,at,frames,crop,FPS,4],sort_keys=True)
    name="ed-"+hashlib.sha256(spec.encode()).hexdigest()[:19]+".mp4"
    target=PUBLIC/name
    if not target.exists():
        x,y,w,h=CROPS[crop] if isinstance(crop,str) else crop
        vf=(f"crop=trunc(iw*{w}/2)*2:trunc(ih*{h}/2)*2:trunc(iw*{x}/2)*2:trunc(ih*{y}/2)*2,"
            "scale=1440:810:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos,"
            "setsar=1,fps=30:start_time=0,"
            f"tpad=stop_mode=clone:stop_duration={frames/FPS:.3f}")
        temp=target.with_suffix(".part.mp4")
        run("-ss",at,"-i",source,"-an","-vf",vf,"-frames:v",frames,"-c:v","libx264","-threads","2",
            "-preset","veryfast","-crf","17","-g","30","-pix_fmt","yuv420p","-movflags","+faststart",temp)
        if temp.stat().st_size<1200:raise RuntimeError(f"No recorded picture at {source}:{at}")
        temp.replace(target)
    return name

def voice_meta(role,id):
    base=FILM/"narration"/role
    return audio(base/(id+".mp3")),json.loads((base/(id+".json")).read_text(encoding="utf8"))["cues"]

def captured_voice(source_file,start,seconds,name,keep_length=True):
    with wave.open(str(source_file),"rb") as source:
        rate=source.getframerate()
        source.setpos(round(start*rate))
        pcm=np.frombuffer(source.readframes(round(seconds*rate)),"<i2").copy()
    original_samples=len(pcm)
    edges=np.diff(np.r_[False,pcm==0,False].astype(np.int8))
    flank=round(.009*rate)
    for first,end in reversed(list(zip(np.where(edges==1)[0],np.where(edges==-1)[0]))):
        if not (.002*rate<end-first<.045*rate and first>flank and end+flank<len(pcm)):continue
        if min(np.max(np.abs(pcm[first-flank:first])),np.max(np.abs(pcm[end:end+flank])))<650:continue
        # Remove empty capture packets only when speech is present on both sides.
        edge=round(.002*rate)
        blend=np.linspace(0,1,edge)
        join=(pcm[first-edge:first]*(1-blend)+pcm[end:end+edge]*blend).astype("<i2")
        pcm=np.concatenate([pcm[:first-edge],join,pcm[end+edge:]])
    if keep_length and len(pcm)<original_samples:
        pcm=np.pad(pcm,(0,original_samples-len(pcm)))
    path=CACHE/"film"/(name+".wav")
    with wave.open(str(path),"wb") as w:
        w.setparams((1,2,rate,0,"NONE","not compressed"));w.writeframes(pcm.tobytes())
    return audio(path,system=True)

def prepare_scene(s,captures):
    scene={k:v for k,v in s.items() if k in ("layout","title","titleSize","label","note","theme")}
    scene.setdefault("layout","product")
    cues=[];jobs=[];chunks=[]
    if "turns" in s:
        position=0
        for t in s["turns"]:
            folder=captures/t["capture"]
            if "driver" in t:
                sample,lines=voice_meta("driver",t["driver"])
                role="driver"
            else:
                sample=captured_voice(folder/"speaker.wav",t["sound"],t["duration"],f'{folder.name}-{t["sound"]}')
                lines=[{"text":line[2],"startMs":round(line[0]*1000),"endMs":round(line[1]*1000)} for line in t["lines"]]
                role="system"
            lead=.12 if position else .23
            n=math.ceil((lead+len(sample)/RATE+.24)*FPS)
            track=np.zeros(n*STEP,np.float32);start=round(lead*RATE)
            track[start:start+len(sample)]=sample;chunks.append(track)
            for c in lines:
                cues.append({"role":role,"text":c["text"],"startMs":round((position/FPS+lead)*1000)+c["startMs"],
                             "endMs":min(round((position+n)/FPS*1000),round((position/FPS+lead)*1000)+c["endMs"])})
            jobs.append((folder/"screen.mp4",max(0,t["screen"]-lead),n,t["crop"]))
            position+=n
        dialogue=np.concatenate(chunks)
    else:
        sample,lines=voice_meta("narrator",s["voice"])
        lead=s.get("lead",.30)
        frames=math.ceil(max(s.get("seconds",0),lead+len(sample)/RATE+.67)*FPS)
        jobspec=s.get("shots",[])
        if s.get("sdk"):
            extra=captured_voice(CACHE/"recordings/09-speech.wav",37.08,4.44,"archived-receipt",keep_length=False)
            moment=math.ceil((lead+len(sample)/RATE+.3)*FPS)
            frames=max(frames,moment+math.ceil((len(extra)/RATE+.6)*FPS))
        dialogue=np.zeros(frames*STEP,np.float32)
        offset=round(lead*RATE);dialogue[offset:offset+len(sample)]=sample
        for c in lines:cues.append({"role":"narrator","text":c["text"],"startMs":c["startMs"]+round(lead*1000),"endMs":c["endMs"]+round(lead*1000)})
        if s.get("sdk"):
            dialogue[moment*STEP:moment*STEP+len(extra)]=extra
            cues.append({"role":"system","text":"현대카드 M 끝번호 1234로 총 12,500원 모의 결제됐어요.","startMs":round(moment/FPS*1000),"endMs":round((moment/FPS+len(extra)/RATE)*1000)})
        if jobspec:
            weights=np.cumsum([0]+[j[1] for j in jobspec],dtype=float)
            cuts=np.rint(frames*weights/weights[-1]).astype(int)
            for idx,(start,weight,crop) in enumerate(jobspec):
                source=captures/s["capture"]/"screen.mp4" if "capture" in s else CACHE/"recordings"/(s["record"]+".mp4")
                jobs.append((source,start,int(cuts[idx+1]-cuts[idx]),crop))
        if scene["layout"]=="pickup":scene["reveal"]=int(frames*.33)
    scene["frames"]=len(dialogue)//STEP
    scene["cues"]=cues
    scene["env"]=[round(float(v),3) for v in np.sqrt(np.mean(dialogue.reshape(-1,STEP)**2,axis=1))] if scene["layout"]=="field" else []
    scene["clips"]=[];position=0
    for job in jobs:
        scene["clips"].append({"at":position,"frames":job[2],"job":job});position+=job[2]
    return scene,dialogue

def master(id,cut,speech):
    v=np.concatenate(speech)
    music=score(len(v)/RATE,v,{"Film":0,"Gleo":1,"Full":2}[id])
    mix=music+v[:,None]
    tmp=CACHE/"film"/(id+"-stereo.wav")
    with wave.open(str(tmp),"wb") as w:
        w.setparams((2,2,RATE,0,"NONE","not compressed"))
        w.writeframes((np.clip(mix,-.99,.99)*32767).astype("<i2").tobytes())
    name=id.lower()+"-studio.m4a"
    run("-i",tmp,"-af","loudnorm=I=-15.5:TP=-1.7:LRA=8","-ar","48000","-ac","2","-b:a","192k","-c:a","aac","-movflags","+faststart",PUBLIC/name)
    cut["master"]=name
    tmp.unlink()

def build():
    parser=argparse.ArgumentParser()
    parser.add_argument("--captures",type=Path,default=CACHE/"film")
    args=parser.parse_args()
    PUBLIC.mkdir(exist_ok=True);OUT.mkdir(exist_ok=True,parents=True)
    for src,name in [(FILM/"art/drive-home.jpg","drive-home.jpg"),(ROOT/"app/src/main/assets/web/logo-mark.png","brand.png"),(ROOT/"docs/design/pleorder-lockup.png","lockup.png"),(ROOT/"app/src/main/assets/web/fonts/PretendardVariable.woff2","PretendardVariable.woff2")]:
        shutil.copyfile(src,PUBLIC/name)
    for name in ("bibimbap","chicken","delivery-proof"):
        shutil.copyfile(ROOT/"app/src/main/assets/web/images"/(name+".png"),PUBLIC/(name+".png"))
    book=json.loads((FILM/"storyboards.json").read_text(encoding="utf8"))
    used={k for entries in book["editions"].values() for k in entries}
    prepared={k:prepare_scene(book["scenes"][k],args.captures) for k in sorted(used)}
    jobs={tuple(c["job"][:3])+(json.dumps(c["job"][3]),):c["job"] for s,_ in prepared.values() for c in s["clips"]}
    with ThreadPoolExecutor(max_workers=3) as pool:
        files=dict(zip(jobs,pool.map(lambda j:clip(*j),jobs.values())))
    for s,_ in prepared.values():
        for c in s["clips"]:
            j=c.pop("job");c["file"]=files[tuple(j[:3])+(json.dumps(j[3]),)]
            region=CROPS[j[3]] if isinstance(j[3],str) else j[3]
            c["aspect"]=16/9*region[2]/region[3]
    cuts={}
    for id,entries in book["editions"].items():
        offset=0;subs=[];scenes=[];speech=[]
        for sceneid in entries:
            s,pcm=prepared[sceneid]
            scenes.append(dict(s,id=sceneid,**{"from":offset}));speech.append(pcm)
            subs.extend((offset/FPS+c["startMs"]/1000,offset/FPS+c["endMs"]/1000,c["text"]) for c in s["cues"])
            offset+=s["frames"]
        cut={"frames":offset,"scenes":scenes};master(id,cut,speech);cuts[id]=cut
        srt="\n\n".join(f"{i}\n{tc(a)} --> {tc(b)}\n{v}" for i,(a,b,v) in enumerate(subs,1))
        (OUT/(NAMES[id]+".srt")).write_text(srt+"\n",encoding="utf-8-sig")
        print(id,round(offset/FPS,2),len(subs),"captions",flush=True)
    (PUBLIC/"editions.json").write_text(json.dumps(cuts,ensure_ascii=False),encoding="utf8")

if __name__=="__main__":build()
