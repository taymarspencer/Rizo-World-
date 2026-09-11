import wave, math, random, os
from pathlib import Path
import numpy as np

SR=44100
OUT=Path(__file__).resolve().parents[1]/'assets'/'audio'
OUT.mkdir(parents=True,exist_ok=True)
rng=np.random.default_rng(91703)

def env(n, a=.02, r=.12):
    x=np.ones(n)
    aa=min(n,max(1,int(a*SR))); rr=min(n,max(1,int(r*SR)))
    x[:aa]=np.linspace(0,1,aa)
    x[-rr:]*=np.linspace(1,0,rr)
    return x

def smooth_noise(n, width=120):
    z=rng.normal(0,1,n)
    if width<=1:return z
    k=np.ones(width)/width
    return np.convolve(z,k,mode='same')

def hp_noise(n, width=80):
    z=rng.normal(0,1,n)
    return z-smooth_noise_from(z,width)

def smooth_noise_from(z,width):
    return np.convolve(z,np.ones(width)/width,mode='same')

def sine(freq,dur,amp=.2,phase=0,glide=None):
    n=int(SR*dur); t=np.arange(n)/SR
    if glide:
        f0,f1=glide
        phase_arr=2*np.pi*np.cumsum(np.linspace(f0,f1,n))/SR+phase
        return amp*np.sin(phase_arr)
    return amp*np.sin(2*np.pi*freq*t+phase)

def chirp(f0,f1,dur,amp=.15):
    n=int(SR*dur); f=np.linspace(f0,f1,n); ph=2*np.pi*np.cumsum(f)/SR
    return amp*np.sin(ph)

def add(dst,src,start=0):
    i=int(start*SR); j=min(len(dst),i+len(src));
    if j>i: dst[i:j]+=src[:j-i]

def crackle(dst,start,end,count=24,amp=.12):
    for _ in range(count):
        t=random.uniform(start,end); dur=random.uniform(.008,.045)
        n=max(1,int(dur*SR)); z=rng.normal(0,1,n)*np.linspace(1,0,n)*amp*random.uniform(.5,1.2)
        add(dst,z,t)

def write(name,x):
    x=np.nan_to_num(x)
    m=max(.001,float(np.max(np.abs(x))))
    if m>.96: x=x*(.96/m)
    pcm=(np.clip(x,-1,1)*32767).astype('<i2')
    p=OUT/name
    with wave.open(str(p),'wb') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes(pcm.tobytes())
    print(name, f'{len(x)/SR:.2f}s', p.stat().st_size)

def ocean():
    dur=2.8;n=int(SR*dur);t=np.arange(n)/SR
    low=smooth_noise(n,560)*3.2; mid=smooth_noise(n,55)*.55
    swell=(.35+.65*(np.sin(2*np.pi*.42*t-1.1)*.5+.5))
    x=(low*.13+mid*.035)*swell
    add(x,chirp(180,90,.8,.035),.25);add(x,chirp(140,70,.9,.03),1.3)
    return x*env(n,.06,.5)

def rain():
    dur=2.3;n=int(SR*dur); x=rng.normal(0,1,n)*.018
    for _ in range(90):
        st=random.uniform(0,dur-.03); ln=random.randint(80,480); z=rng.normal(0,1,ln)*np.exp(-np.linspace(0,7,ln))*random.uniform(.02,.10)
        add(x,z,st)
    return x*env(n,.03,.3)

def lightning():
    dur=1.25;n=int(SR*dur);x=np.zeros(n)
    for st,a in [(0,.65),(.035,.44),(.095,.28)]:
        ln=int(.09*SR);z=rng.normal(0,1,ln)*np.exp(-np.linspace(0,9,ln))*a;add(x,z,st)
    add(x,chirp(2200,120,.36,.16),.01);add(x,sine(54,.65,.17,glide=(70,34)),.12)
    return x*env(n,.001,.28)

def storm():
    dur=3.0;n=int(SR*dur);t=np.arange(n)/SR
    wind=smooth_noise(n,260)*.34 + smooth_noise(n,35)*.025
    wind*=.45+.25*np.sin(2*np.pi*.3*t)+.12*np.sin(2*np.pi*.73*t)
    x=wind
    boom=sine(46,1.35,.28,glide=(70,30))*env(int(1.35*SR),.005,.65);add(x,boom,1.0)
    return x*env(n,.08,.55)

def volcano():
    dur=3.25;n=int(SR*dur);t=np.arange(n)/SR
    rum=(sine(34,dur,.23)+sine(47,dur,.10)+smooth_noise(n,900)*1.0*.22)
    rum*=np.clip(t/.22,0,1)*np.exp(-t*.22)
    blast=rng.normal(0,1,int(.85*SR))*np.exp(-np.linspace(0,7,int(.85*SR)))*.30;add(rum,blast,.24)
    crackle(rum,.28,2.65,38,.11)
    add(rum,chirp(260,58,1.5,.055),.32)
    return rum*env(n,.01,.5)

def quake():
    dur=2.4;n=int(SR*dur);t=np.arange(n)/SR
    x=(sine(29,dur,.22)+sine(41,dur,.14)+smooth_noise(n,420)*.20)
    x*=.75+.25*np.sin(2*np.pi*7*t+np.sin(2*np.pi*1.1*t))
    return x*env(n,.03,.55)

def life():
    dur=2.65;n=int(SR*dur);x=np.zeros(n)
    def beat(st,amp=1):
        add(x,sine(62,.16,.33*amp,glide=(85,42))*env(int(.16*SR),.002,.12),st)
        add(x,sine(47,.22,.24*amp,glide=(63,34))*env(int(.22*SR),.002,.18),st+.18)
    beat(.12,1);beat(1.12,.88)
    add(x,chirp(310,690,.85,.055),.55);add(x,chirp(470,940,.7,.035),1.48)
    return x*env(n,.005,.45)

def forest():
    dur=2.7;n=int(SR*dur);t=np.arange(n)/SR
    x=smooth_noise(n,600)*.10 + smooth_noise(n,90)*.022
    for st,f in [(.32,1180),(.58,1510),(1.32,980),(1.55,1320),(2.05,1720)]:
        add(x,chirp(f,f*1.22,.12,.035),st);add(x,chirp(f*1.15,f*.92,.13,.028),st+.13)
    return x*env(n,.06,.5)

def city():
    dur=2.8;n=int(SR*dur);t=np.arange(n)/SR
    x=sine(58,dur,.07)+sine(117,dur,.025)+smooth_noise(n,180)*.035
    for st in [.25,.72,1.13,1.68,2.16]:
        add(x,sine(random.choice([310,370,440]),.055,.055)*env(int(.055*SR),.001,.035),st)
    add(x,chirp(520,430,.28,.035),1.42)
    return x*env(n,.08,.55)

def engine():
    dur=2.2;n=int(SR*dur);x=np.zeros(n)
    for i in range(12):
        st=.08+i*.16
        add(x,sine(68,.08,.13,glide=(92,46))*env(int(.08*SR),.001,.055),st)
        if i%2==0:add(x,rng.normal(0,1,int(.018*SR))*np.linspace(1,0,int(.018*SR))*.11,st+.025)
    add(x,sine(136,dur,.035),0)
    return x*env(n,.02,.35)

def electricity():
    dur=1.7;n=int(SR*dur);x=sine(120,dur,.025)+sine(240,dur,.012)
    crackle(x,.05,1.55,35,.16)
    for st in [.15,.63,1.08]:add(x,chirp(1800,240,.16,.095),st)
    return x*env(n,.002,.28)

def space():
    dur=3.1;n=int(SR*dur);t=np.arange(n)/SR
    x=sine(42,dur,.08)+sine(63,dur,.035,phase=.7)
    x+=smooth_noise(n,1300)*.08
    add(x,chirp(210,820,1.8,.04),.48);add(x,chirp(620,190,1.2,.025),1.42)
    return x*env(n,.2,.7)

def fire():
    dur=1.9;n=int(SR*dur);x=smooth_noise(n,220)*.06
    crackle(x,.05,1.65,42,.12)
    add(x,chirp(190,520,.42,.08),.03)
    return x*env(n,.01,.35)

def wind():
    dur=2.0;n=int(SR*dur);t=np.arange(n)/SR
    x=smooth_noise(n,170)*.18 + smooth_noise(n,850)*.16
    x*=.35+.65*np.sin(np.pi*np.clip(t/dur,0,1))
    add(x,chirp(480,220,1.1,.025),.38)
    return x*env(n,.08,.4)

def ice():
    dur=1.55;n=int(SR*dur);x=np.zeros(n)
    for st,f,a in [(0,2100,.13),(.08,3150,.09),(.21,1480,.08),(.36,4200,.055)]:
        add(x,chirp(f,f*.62,.19,a)*env(int(.19*SR),.001,.16),st)
    add(x,sine(390,.8,.035),.27)
    return x*env(n,.001,.32)

def found_variant(root,third,top):
    dur=.92;n=int(SR*dur);x=np.zeros(n)
    add(x,sine(root,.15,.16,glide=(root*1.12,root*.72))*env(int(.15*SR),.001,.11),0)
    for st,f,a in [(.06,root*2,.07),(.17,third,.08),(.31,top,.075)]:add(x,sine(f,.35,a)*env(int(.35*SR),.005,.24),st)
    add(x,rng.normal(0,1,int(.035*SR))*np.linspace(1,0,int(.035*SR))*.07,.025)
    return x*env(n,.001,.25)

sounds={
 'world-sea-v9.wav':ocean(),'world-rain-v9.wav':rain(),'world-lightning-v9.wav':lightning(),
 'world-storm-v9.wav':storm(),'world-volcano-v9.wav':volcano(),'world-quake-v9.wav':quake(),
 'world-life-v9.wav':life(),'world-forest-v9.wav':forest(),'world-city-v9.wav':city(),
 'world-engine-v9.wav':engine(),'world-electricity-v9.wav':electricity(),'world-space-v9.wav':space(),
 'world-fire-v9.wav':fire(),'world-wind-v9.wav':wind(),'world-ice-v9.wav':ice(),
 'found4-v9.wav':found_variant(96,323,646),'found5-v9.wav':found_variant(112,377,754),
}
for name,x in sounds.items():write(name,x)
