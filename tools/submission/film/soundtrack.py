"""Original stereo score. All instruments are synthesized here; no stock loops or samples."""
import math
import numpy as np

RATE = 24000

def score(seconds, dialogue, mood=0):
    length = round(seconds * RATE)
    out = np.zeros((length,2),np.float32)
    beat = 60/106
    chords = [(50,57,61,64,66),(47,54,57,61,64),(43,50,54,57,59),(45,52,55,59,62)]
    rng = np.random.default_rng(405+mood)
    def place(t, mono, gain, pan=0):
        start=round(t*RATE)
        n=min(len(mono),length-start)
        if n<=0:return
        out[start:start+n,0]+=mono[:n]*gain*math.sqrt((1-pan)/2)
        out[start:start+n,1]+=mono[:n]*gain*math.sqrt((1+pan)/2)
    def keys(t,note,duration,gain,pan,kind):
        x=np.arange(round(duration*RATE))/RATE
        f=440*2**((note-69)/12)
        phi=2*np.pi*f*x
        if kind=="bass":
            env=(1-np.exp(-x*35))*np.exp(-2.9*x)*(1-np.minimum(1,x/duration)**5)
            signal=np.sin(phi)+.26*np.sin(2*phi)+.09*np.sin(3*phi)
        else:
            env=(1-np.exp(-x*90))*np.exp(-2.3*x)*(1-np.minimum(1,x/duration)**3)
            signal=np.sin(phi+.77*np.exp(-x*4)*np.sin(2*phi))+.15*np.sin(2.004*phi)
        place(t,signal*env,gain,pan)
        if kind=="bell":
            place(t+beat*.75,signal*env,gain*.23,-pan)
    measures=math.ceil(seconds/(4*beat))
    for bar in range(measures):
        c=chords[(bar+mood)%4]
        t=bar*4*beat
        for delay,vol in [(0,.073),(1.5,.047),(2.75,.058)]:
            for j,note in enumerate(c[1:]):
                keys(t+delay*beat+j*.010,note+12,1.4,vol*.58,(j-1.5)*.30,"keys")
        for delay,pitch in [(0,c[0]-12),(1.75,c[0]-12),(2.6,c[1]-12)]:
            keys(t+delay*beat,pitch,.70,.13,0,"bass")
        if bar%2==0:
            for i,(delay,n) in enumerate([(.5,c[3]+12),(1.25,c[2]+12),(3.25,c[4]+12)]):
                keys(t+delay*beat,n,.96,.062,(-1)**i*.33,"bell")
        for tick in range(8):
            tm=t+tick*beat*.5
            if tick%4==0:
                x=np.arange(int(.22*RATE))/RATE
                place(tm,np.sin(2*np.pi*(48*x+3.4*(1-np.exp(-x*23))))*np.exp(-21*x)*(1-np.exp(-x*160)),.212)
            if tick in (2,6):
                x=np.arange(int(.083*RATE))/RATE
                noise=rng.standard_normal(len(x));hp=np.diff(noise,prepend=0)*.27
                place(tm+.008,(hp+.32*np.sin(2*np.pi*1730*x))*np.exp(-x*71)*(1-np.exp(-x*550)),.075,.17)
            if tick%2:
                x=np.arange(int(.068*RATE))/RATE
                noise=rng.standard_normal(len(x))
                place(tm+.014,np.diff(noise,prepend=0)*np.exp(-78*x)*(1-np.exp(-550*x)),.024,-.32 if tick%4==1 else .36)
    # Follow the actual three speech stems so the rhythm rises into pauses and recedes under words.
    hop=round(RATE*.025)
    rms=np.array([np.sqrt(np.mean(dialogue[i:i+hop]**2)) for i in range(0,length,hop)])
    target=np.clip((rms-.006)/.040,0,1)
    anticipation=np.maximum(target,np.r_[target[2:],np.zeros(min(2,len(target)))][:len(target)])
    env=[];last=0.
    for value in anticipation:
        coeff=.58 if value>last else .079
        last+=coeff*(value-last);env.append(last)
    duck=np.interp(np.arange(length)/hop,np.arange(len(env)),env)
    out*=((1-.60*duck)*.97)[:,None].astype(np.float32)
    fade=np.minimum(1,np.arange(length)/(RATE*.12))*np.minimum(1,(length-1-np.arange(length))/(RATE*1.05))
    out*=fade[:,None].astype(np.float32)
    return out
