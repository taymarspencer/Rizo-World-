import wave, math, random
from array import array
from pathlib import Path
SR=22050
ROOT=Path(__file__).resolve().parents[1]/'assets'/'audio'
random.seed(8026)

def write(name, samples):
    peak=max(1e-9,max(abs(x) for x in samples))
    scale=min(.94/peak,1.0)
    pcm=array('h',(int(max(-1,min(1,x*scale))*32767) for x in samples))
    with wave.open(str(ROOT/name),'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())

def add_glide(buf,start,dur,f0,f1,amp=.1,decay=0,kind='sine'):
    a=int(start*SR); n=int(dur*SR)
    for i in range(n):
        j=a+i
        if not (0<=j<len(buf)): continue
        t=i/SR; u=min(1,t/max(dur,1e-6))
        f=f0*((f1/f0)**u)
        env=min(1,t/.012) * (math.exp(-decay*t) if decay else 1)
        phase=2*math.pi*f*t
        v=math.sin(phase)
        if kind=='triangle': v=2/math.pi*math.asin(math.sin(phase))
        buf[j]+=amp*env*v

def add_sine(buf,start,dur,freq,amp=.1,decay=0):
    add_glide(buf,start,dur,freq,freq,amp,decay)

def add_noise(buf,start,dur,amp=.03,decay=12):
    a=int(start*SR); n=int(dur*SR); y=0.0
    for i in range(n):
        j=a+i
        if not (0<=j<len(buf)): continue
        x=random.uniform(-1,1); y += .18*(x-y)
        buf[j]+=amp*y*math.exp(-decay*i/SR)

# Two separate voices approach one pitch; the low note only appears when they meet.
# It is intentionally recognisable but short enough not to interrupt the play loop.
dur=1.24
b=[0.0]*int(dur*SR)
add_glide(b,.00,.48,293.66,246.94,.085,2.0,'triangle')
add_glide(b,.00,.48,174.61,220.00,.085,2.0,'triangle')
add_sine(b,.36,.62,220.00,.13,2.9)
add_sine(b,.40,.54,440.00,.045,3.4)
add_sine(b,.50,.48,110.00,.09,3.8)
add_noise(b,.36,.13,.045,18)
# tiny resolved click at the point of confluence
add_glide(b,.43,.07,1450,620,.025,24)
write('confluence-v8.wav',b)
print('made',ROOT/'confluence-v8.wav')
