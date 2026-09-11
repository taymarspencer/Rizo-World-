import wave, math, random, os
from array import array
SR=22050
ROOT='/mnt/data/rizo_v7/assets/audio'
os.makedirs(ROOT, exist_ok=True)
random.seed(7317)

def write(name, samples):
    peak=max(1e-9,max(abs(x) for x in samples))
    scale=min(.96/peak,1.0)
    pcm=array('h',(int(max(-1,min(1,x*scale))*32767) for x in samples))
    with wave.open(os.path.join(ROOT,name),'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())

def add_sine(buf,start,dur,freq,amp=.1,phase=0,decay=0,glide=None):
    a=int(start*SR); n=int(dur*SR)
    for i in range(max(0,n)):
        j=a+i
        if j<0 or j>=len(buf): continue
        t=i/SR
        f=freq if glide is None else freq+(glide-freq)*(t/dur)
        env=(math.sin(min(1,t/.02)*math.pi/2) if t<.02 else 1)
        if decay: env*=math.exp(-decay*t)
        buf[j]+=amp*env*math.sin(2*math.pi*f*t+phase)

def add_noise(buf,start,dur,amp=.05,decay=8,lp=0.12):
    a=int(start*SR); n=int(dur*SR); y=0
    for i in range(n):
        j=a+i
        if j<0 or j>=len(buf): continue
        x=random.uniform(-1,1); y += lp*(x-y)
        env=math.exp(-decay*i/SR)
        buf[j]+=amp*y*env

def add_click(buf,start,amp=.08,f=1800):
    add_sine(buf,start,.055,f,amp,decay=38,glide=f*.42)
    add_noise(buf,start,.035,amp*.45,decay=55,lp=.4)

# ---- darker second score: 32 beats @ 1.6 sec = 51.2 sec seamless phrase ----
DUR=51.2; N=int(DUR*SR); b=[0.0]*N; beat=1.6
# low continuous drones, frequencies chosen to create uneasy minor-second/tritone interaction
for f,a,ph in [(36.708,.055,0),(55.0,.026,1.2),(77.782,.018,2.3)]:
    for i in range(N):
        t=i/SR
        slow=.72+.28*math.sin(2*math.pi*t/DUR*2 + ph)
        b[i]+=a*slow*math.sin(2*math.pi*f*t+ph)
# sub sequence and kick-like pulses
seq=[36.708,36.708,43.654,34.648,36.708,41.203,32.703,34.648]
for k in range(32):
    t0=k*beat; f=seq[k%len(seq)]
    add_sine(b,t0,.75,f,.21,decay=3.0,glide=f*.72)
    add_sine(b,t0,.22,f*2,.072,decay=9)
    add_sine(b,t0,.18,f*3,.026,decay=11)
    add_noise(b,t0,.08,.055,decay=28,lp=.10)
    # off-beat machine relay
    if k%2==0: add_click(b,t0+.8,.028,1450+(k%5)*90)
# ominous three-note response every 4 beats
for block in range(8):
    base=block*beat*4
    notes=[146.83,155.56,110.0] if block%2==0 else [138.59,146.83,103.83]
    for i,f in enumerate(notes):
        add_sine(b,base+1.05+i*.44,.48,f,.032,decay=3.2)
        add_sine(b,base+1.05+i*.44,.42,f*2.01,.012,decay=4.2)
# sparse high electrical shards, deterministic phrase
for t0,f in [(7.2,2330),(12.8,1810),(20.0,2570),(25.6,2040),(33.4,2220),(40.2,1690),(47.1,2440)]:
    add_sine(b,t0,.09,f,.018,decay=25,glide=f*.72); add_noise(b,t0,.11,.022,decay=20,lp=.35)
# late phrase gets denser so loop restart feels like release
for t0 in [38.4,41.6,44.8,48.0,49.6]: add_click(b,t0,.038,980)
write('below-v7.wav',[v*1.65 for v in b])

# ---- Alternate cue bank ----
def cue(dur): return [0.0]*int(dur*SR)

x=cue(.62); add_sine(x,0,.22,104,.22,decay=9,glide=47); add_noise(x,.01,.13,.09,decay=15,lp=.18); add_click(x,.035,.045,940); write('impact2.wav',x)
x=cue(.72); add_sine(x,0,.31,98,.19,decay=6,glide=39); add_sine(x,.06,.34,147,.05,decay=6,glide=73); add_noise(x,.02,.26,.08,decay=9,lp=.12); write('fail2.wav',x)
x=cue(1.05); add_sine(x,0,.48,261.63,.085,decay=2.4); add_sine(x,.075,.48,392,.07,decay=2.2); add_sine(x,.19,.62,659.25,.055,decay=2.0); add_click(x,.01,.025,1700); write('found2.wav',x)
x=cue(1.18); add_sine(x,0,.46,329.63,.065,decay=2.2); add_sine(x,.12,.54,523.25,.072,decay=2.0); add_sine(x,.29,.72,783.99,.05,decay=1.9); add_noise(x,0,.10,.025,decay=18,lp=.22); write('found3.wav',x)
x=cue(.48); add_sine(x,0,.16,523.25,.06,decay=8); add_sine(x,.075,.2,783.99,.048,decay=7); add_click(x,0,.022,1280); write('chain2.wav',x)
x=cue(.18); add_click(x,0,.045,2050); add_sine(x,0,.10,720,.045,decay=12,glide=910); write('tap3.wav',x)
print('made v7 audio')
