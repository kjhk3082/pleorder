"""Original instrumental score for the three Pleorder films."""
from functools import lru_cache
import math
import numpy as np

RATE = 24000
BPM = 112
BEAT = 60 / BPM
# Fmaj9, Am7/E, Dm9 and Bbmaj9. Common upper notes connect the changes.
VOICINGS = ((41, (57, 60, 64, 67)), (40, (55, 57, 60, 64)),
            (38, (53, 57, 60, 64)), (34, (53, 57, 60, 62)))


@lru_cache(maxsize=160)
def tone(note, duration, instrument):
    t = np.arange(round(duration * RATE)) / RATE
    phase = 2 * np.pi * 440 * 2 ** ((note - 69) / 12) * t
    if instrument == "bass":
        signal = np.sin(phase) + .28 * np.sin(2 * phase) + .10 * np.sin(3 * phase)
        shape = (1 - np.exp(-60*t)) * np.exp(-2.4*t)
    elif instrument == "pluck":
        signal = np.sin(phase + 1.18*np.exp(-15*t)*np.sin(2*phase)) + .18*np.sin(2.003*phase)
        shape = (1 - np.exp(-125*t)) * np.exp(-6.2*t)
    else:
        signal = .58*np.sin(phase) + .26*np.sin(phase*1.003) + .16*np.sin(2*phase)
        shape = (1 - np.exp(-8*t)) * np.exp(-.9*t)
    release = np.minimum(1, (duration-t) / min(duration/3, .18))
    return (signal * shape * release**2).astype(np.float32)


def percussion(rng):
    t = np.arange(round(.24*RATE)) / RATE
    kick = np.sin(2*np.pi*(51*t + 2.75*(1-np.exp(-t*29)))) * np.exp(-18*t)
    kick *= (1-np.exp(-220*t))*np.minimum(1,(.24-t)/.03)
    t = np.arange(round(.105*RATE)) / RATE
    brush = np.diff(rng.uniform(-1,1,len(t)),prepend=0)
    tick = (np.sin(2*np.pi*810*t)+.48*np.sin(2*np.pi*1270*t)) * np.exp(-92*t)
    rim = (tick+.28*brush*np.exp(-55*t))*(1-np.exp(-420*t))
    shakers = []
    for duration in (.043,.075,.091):
        t = np.arange(round(duration*RATE)) / RATE
        sand = np.diff(rng.uniform(-1,1,len(t)),prepend=0)
        shakers.append(sand*np.sin(np.pi*t/duration)**1.4*np.exp(-19*t))
    return kick, rim, shakers


def speech_envelope(dialogue):
    hop = RATE // 50
    padding = (-len(dialogue)) % hop
    frames = np.pad(dialogue, (0, padding)).reshape(-1, hop)
    levels = np.sqrt(np.mean(frames**2, axis=1))
    speech = np.clip((levels-.006)/.043, 0, 1)
    anticipation = np.maximum(speech, np.pad(speech, (0,3))[3:])
    strength = np.empty_like(anticipation)
    level = 0.
    for idx, target in enumerate(anticipation):
        level += (.65 if target > level else .076) * (target-level)
        strength[idx] = level
    return np.interp(np.arange(len(dialogue))/hop, np.arange(len(strength)), strength)


def score(seconds, dialogue, mood=0):
    length = round(seconds*RATE)
    output = np.zeros((length, 2), np.float32)
    rng = np.random.default_rng(1126 + mood)
    kick, rim, shakers = percussion(rng)
    voice_film = mood == 1

    def place(start, signal, gain, pan=0):
        offset = round(start*RATE)
        n = min(len(signal), length-offset)
        if n > 0:
            output[offset:offset+n,0] += signal[:n]*gain*math.sqrt((1-pan)/2)
            output[offset:offset+n,1] += signal[:n]*gain*math.sqrt((1+pan)/2)

    for bar in range(math.ceil(seconds/(BEAT*4))):
        start = bar*4*BEAT
        root, chord = VOICINGS[bar % 4]
        phrase = bar % 8
        for i, note in enumerate(chord):
            place(start+.011*i, tone(note, 3.7*BEAT, "pad"), .036, (i-1.5)*.38)

        # The soft offbeat guitar-like stabs answer the bass, leaving the centre for voices.
        stabs = ((.5,.11),(1.75,.07),(3.25,.09)) if bar % 2 else ((.5,.12),(2.25,.105))
        for off, gain in stabs:
            for i,note in enumerate(chord[1:]):
                pluck = tone(note, .64, "pluck")
                place(start+off*BEAT+.012*i, pluck, gain*.57, (i-1)*.44)
                place(start+(off+.75)*BEAT+.012*i, pluck, gain*.095, (1-i)*.53)

        bassline = ((0, root, .8), (1.5,root+12,.32), (2.5,root+7,.5))
        if phrase in (3,7):
            bassline += ((3.5,VOICINGS[(bar+1)%4][0]+7,.3),)
        for off,note,hold in bassline:
            place(start+off*BEAT, tone(note, hold*BEAT, "bass"), .19)

        # Four bars breathe before the little three-note answer returns.
        if not voice_film and phrase in (1,5):
            for step, note, pan in ((.75,chord[3]+12,-.22),(1.5,chord[2]+12,.25),(3,chord[1]+12,.12)):
                place(start+step*BEAT, tone(note,.59,"pluck"), .063, pan)
        for off in ((0,2.5) if phrase % 2 else (0,2)):
            place(start+off*BEAT, kick, .16 if voice_film else .215)
        for off in (1,3):
            place(start+off*BEAT+.011, rim, .045 if voice_film else .07, .14)
        for tick in range(1,8,2):
            if voice_film and tick in (3,7):
                continue
            off = tick*.5*BEAT + (.018 if tick in (3,7) else .009)
            place(start+off, shakers[(tick+bar)%3], .038 if tick in (1,5) else .024, -.43 if tick<4 else .43)

    t = np.arange(length) / RATE
    fade = np.minimum(1,t/.32) * np.clip((seconds-t)/1.15,0,1)
    # A quieter arrangement and deeper duck on the field recording keep the car speaker clear.
    duck = 1 - (.76 if voice_film else .70)*speech_envelope(dialogue)
    output *= (fade*duck*(.83 if voice_film else .96)).astype(np.float32)[:, None]
    return output
