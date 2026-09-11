import wave, math, random
from pathlib import Path
import numpy as np

SR=44100
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets'/'audio'
OUT.mkdir(parents=True,exist_ok=True)
rng=np.random.default_rng(9102026)
random.seed(9102026)

def readwav(name):
    p=OUT/name
    with wave.open(str(p),'rb') as w:
        assert w.getnchannels()==1 and w.getsampwidth()==2
        sr=w.getframerate(); x=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').astype(np.float64)/32768.0
    if sr!=SR:
        old=np.arange(len(x))/sr
        new=np.arange(int(round(len(x)*SR/sr)))/SR
        x=np.interp(new,old,x)
    return x

def write(name,x):
    x=np.nan_to_num(np.asarray(x,dtype=np.float64))
    x=np.clip(x,-.985,.985)
    pcm=(x*32767).astype('<i2')
    p=OUT/name
    with wave.open(str(p),'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    rms=float(np.sqrt(np.mean(x*x))) if len(x) else 0
    print(f'{name:30} {len(x)/SR:4.2f}s rms={rms:.4f} peak={np.max(np.abs(x)):.3f}')

def normalize(x,target_rms,peak=.92):
    x=np.asarray(x,dtype=np.float64)
    rms=float(np.sqrt(np.mean(x*x))) or 1e-9
    x=x*(target_rms/rms)
    # Gentle saturation catches transient peaks without flattening the body.
    p=float(np.max(np.abs(x))) or 1e-9
    if p>peak:
        drive=max(1.0,p/peak)
        x=np.tanh(x*drive)/(np.tanh(drive)+1e-12)*peak
        rms=float(np.sqrt(np.mean(x*x))) or 1e-9
        x*=min(1.18,target_rms/rms)
    p=float(np.max(np.abs(x))) or 1e-9
    if p>peak: x*=peak/p
    return x

def fade(x,a=.01,r=.2):
    n=len(x); aa=min(n,max(1,int(a*SR))); rr=min(n,max(1,int(r*SR)))
    y=x.copy(); y[:aa]*=np.linspace(0,1,aa); y[-rr:]*=np.linspace(1,0,rr); return y

def smooth(z,width):
    return np.convolve(z,np.ones(max(1,width))/max(1,width),mode='same')

def noise(n,width=1):
    z=rng.normal(0,1,n)
    return smooth(z,width) if width>1 else z

def sine(freq,dur,amp=.1,phase=0,glide=None):
    n=int(SR*dur); t=np.arange(n)/SR
    if glide:
        f=np.linspace(glide[0],glide[1],n); ph=2*np.pi*np.cumsum(f)/SR+phase
        return amp*np.sin(ph)
    return amp*np.sin(2*np.pi*freq*t+phase)

def chirp(f0,f1,dur,amp=.1):
    n=int(SR*dur); f=np.linspace(f0,f1,n); ph=2*np.pi*np.cumsum(f)/SR
    return amp*np.sin(ph)

def add(dst,src,at=0):
    i=max(0,int(at*SR)); j=min(len(dst),i+len(src))
    if j>i: dst[i:j]+=src[:j-i]

def burst(dst,at,dur=.05,amp=.2,decay=8):
    n=max(1,int(dur*SR)); z=rng.normal(0,1,n)*np.exp(-np.linspace(0,decay,n))*amp; add(dst,z,at)

def pulse_train(dst,start,count,gap,freq,amp=.1,dur=.055):
    for i in range(count):
        z=sine(freq,dur,amp,glide=(freq*1.25,freq*.75)); z=fade(z,.001,dur*.7); add(dst,z,start+i*gap)

# Remaster the V9 environmental layer into fresh URLs. The old files varied by
# >7x in RMS, which made random discoveries feel inconsistently rewarded.
world_targets={
 'sea':.075,'rain':.060,'lightning':.090,'storm':.095,'volcano':.105,'quake':.100,'life':.090,'forest':.055,
 'city':.065,'engine':.080,'electricity':.080,'space':.070,'fire':.070,'wind':.058,'ice':.065,
}
for key,target in world_targets.items():
    src=readwav(f'world-{key}-v9.wav')
    # Add phone-audible upper bass to effects that were weighted too heavily below 60 Hz.
    if key in {'volcano','quake','space'}:
        dur=len(src)/SR; t=np.arange(len(src))/SR
        body=(np.sin(2*np.pi*92*t)+.45*np.sin(2*np.pi*138*t))*({'volcano':.028,'quake':.024,'space':.012}[key])
        body*=np.sin(np.pi*np.clip(t/dur,0,1))**.55
        src=src+body
    write(f'world-{key}-v10.wav', normalize(src,target,.92))

# Bring alternate reward samples into the same perceived family. They stay
# texturally different; they no longer randomly disappear in the mix.
alt_targets={
 'found2.wav':('found2-v10.wav',.160,.92), 'found3.wav':('found3-v10.wav',.160,.92),
 'found4-v9.wav':('found4-v10.wav',.160,.92), 'found5-v9.wav':('found5-v10.wav',.160,.92),
 'impact2.wav':('impact2-v10.wav',.270,.94), 'fail2.wav':('fail2-v10.wav',.250,.92),
 'chain2.wav':('chain2-v10.wav',.130,.90), 'tap3.wav':('tap3-v10.wav',.100,.84),
}
for src,(dst,target,pk) in alt_targets.items(): write(dst,normalize(readwav(src),target,pk))

# New selective physical cues. These fill obvious sensory holes without trying
# to turn all 406 nouns into novelty sound buttons.
def steam():
    d=1.85;n=int(d*SR);t=np.arange(n)/SR
    x=noise(n,18)*(.045+.025*np.sin(np.pi*t/d)); x-=smooth(x,700)*.65
    add(x,chirp(520,920,.75,.035),.18); add(x,chirp(780,420,.55,.02),.82)
    return fade(x,.01,.38)

def lava():
    d=2.55;n=int(d*SR);t=np.arange(n)/SR; x=noise(n,700)*.20+sine(74,d,.055)+sine(111,d,.025)
    for st in [.18,.55,.96,1.52,2.02]:
        burst(x,st,.08,.18); add(x,sine(82,.18,.08,glide=(130,55)),st)
    return fade(x,.02,.5)

def spark():
    d=.75;n=int(d*SR);x=np.zeros(n)
    for st,a in [(0,.34),(.055,.20),(.18,.14),(.33,.10)]: burst(x,st,.035,a,10)
    add(x,chirp(2600,540,.24,.12),.015); add(x,sine(980,.28,.04),.16)
    return fade(x,.001,.16)

def crystal():
    d=1.5;n=int(d*SR);x=np.zeros(n)
    for st,f,a in [(0,1760,.14),(.07,2640,.09),(.18,1320,.08),(.34,3520,.055)]:
        z=sine(f,.78,a)+sine(f*1.006,.78,a*.45); add(x,fade(z,.002,.62),st)
    return fade(x,.001,.32)

def river():
    d=2.35;n=int(d*SR);t=np.arange(n)/SR
    x=noise(n,120)*.08+noise(n,650)*.14; x*=.55+.18*np.sin(2*np.pi*.72*t)+.10*np.sin(2*np.pi*1.31*t)
    return fade(x,.05,.45)

def waterfall():
    d=2.55;n=int(d*SR);t=np.arange(n)/SR
    x=noise(n,44)*.070+noise(n,360)*.16; x*=.72+.15*np.sin(2*np.pi*.42*t)
    add(x,chirp(260,110,.7,.03),.15); add(x,chirp(310,130,.65,.03),1.15)
    return fade(x,.04,.5)

def broth():
    d=2.7;n=int(d*SR);x=noise(n,850)*.05+sine(88,d,.025)
    for st,f in [(.18,150),(.54,185),(.93,132),(1.34,210),(1.84,165),(2.22,120)]:
        add(x,chirp(f*1.5,f,.15,.07),st); burst(x,st+.02,.055,.08)
    add(x,chirp(260,410,1.3,.025),.62)
    return fade(x,.02,.48)

def bird():
    d=1.85;n=int(d*SR);x=noise(n,900)*.012
    for st,f in [(.10,1250),(.29,1560),(.72,1120),(1.04,1700),(1.38,1350)]:
        add(x,chirp(f,f*1.38,.10,.07),st); add(x,chirp(f*1.22,f*.92,.11,.05),st+.11)
    return fade(x,.01,.30)

def crowd():
    d=2.2;n=int(d*SR);t=np.arange(n)/SR
    x=noise(n,420)*.11 + noise(n,90)*.018
    for f,p in [(180,.012),(240,.010),(315,.009),(420,.007)]: x += np.sin(2*np.pi*f*t+rng.random()*6.28)*p*(.4+.6*np.sin(np.pi*t/d))
    return fade(x,.08,.45)

def glass():
    d=1.35;n=int(d*SR);x=np.zeros(n)
    for st,f,a in [(0,2380,.15),(.035,3570,.08),(.16,1780,.07),(.31,4750,.035)]: add(x,fade(sine(f,.66,a),.001,.54),st)
    burst(x,.015,.018,.11)
    return fade(x,.001,.3)

def metal():
    d=1.25;n=int(d*SR);x=np.zeros(n)
    burst(x,0,.028,.18); add(x,fade(sine(720,.9,.13)+sine(1090,.9,.08)+sine(1520,.9,.045),.001,.75),.01)
    return fade(x,.001,.28)

def drum():
    d=1.4;n=int(d*SR);x=np.zeros(n)
    for st,f,a in [(0,88,.22),(.31,110,.17),(.61,88,.22),(.92,132,.16)]:
        add(x,fade(sine(f,.18,a,glide=(f*1.25,f*.62)),.001,.14),st); burst(x,st,.03,a*.45)
    return fade(x,.001,.28)

def train():
    d=2.45;n=int(d*SR);x=sine(74,d,.035)+noise(n,500)*.035
    pulse_train(x,.12,8,.25,185,.09,.07); add(x,chirp(420,350,.42,.055),1.35)
    return fade(x,.02,.42)

def car():
    d=1.8;n=int(d*SR);t=np.arange(n)/SR
    f=np.linspace(78,146,n);ph=2*np.pi*np.cumsum(f)/SR; x=.07*np.sin(ph)+.025*np.sin(2*ph)+noise(n,300)*.035
    add(x,chirp(420,620,.35,.045),.88); return fade(x,.02,.32)

def plane():
    d=2.25;n=int(d*SR);t=np.arange(n)/SR
    x=.055*np.sin(2*np.pi*118*t)+.025*np.sin(2*np.pi*236*t)+noise(n,180)*.055
    x*=.55+.45*np.sin(np.pi*t/d); add(x,chirp(180,420,.9,.025),.55); return fade(x,.05,.45)

def rocket():
    d=2.65;n=int(d*SR);t=np.arange(n)/SR
    x=noise(n,26)*.075+noise(n,250)*.12+sine(86,d,.055)+sine(129,d,.025)
    x*=np.clip(t/.18,0,1)*(1-.20*t/d); add(x,chirp(160,560,1.2,.045),.45); return fade(x,.01,.55)

def clock():
    d=1.65;n=int(d*SR);x=np.zeros(n)
    for st in [0,.42,.84,1.26]:
        add(x,fade(sine(1860,.06,.11),.001,.045),st); add(x,fade(sine(930,.08,.05),.001,.065),st+.014)
    return fade(x,.001,.25)

def radio():
    d=1.8;n=int(d*SR);t=np.arange(n)/SR
    x=noise(n,6)*.035; x*=.55+.45*np.sin(2*np.pi*7.2*t)
    add(x,chirp(420,960,.4,.045),.28); add(x,chirp(1060,520,.38,.04),.92); return fade(x,.01,.35)

def camera():
    d=.9;n=int(d*SR);x=np.zeros(n)
    burst(x,.04,.018,.24); add(x,fade(sine(260,.06,.12,glide=(340,150)),.001,.05),.05)
    burst(x,.17,.028,.13); add(x,fade(sine(1550,.22,.055),.001,.18),.22); return fade(x,.001,.16)

def bigbang():
    d=3.1;n=int(d*SR);t=np.arange(n)/SR; x=np.zeros(n)
    burst(x,0,.24,.55,5); add(x,sine(92,1.25,.22,glide=(190,38)),.02); add(x,sine(138,1.0,.10,glide=(230,60)),.03)
    tail=noise(int(2.8*SR),95)*.14*np.exp(-np.linspace(0,2.2,int(2.8*SR))); add(x,tail,.18)
    add(x,chirp(900,90,2.1,.055),.10); return fade(x,.001,.75)

def blackhole():
    d=3.0;n=int(d*SR);t=np.arange(n)/SR
    f=np.linspace(155,34,n); ph=2*np.pi*np.cumsum(f)/SR; x=.09*np.sin(ph)+.035*np.sin(2*ph)+noise(n,900)*.06
    x*=np.sin(np.pi*np.clip(t/d,0,1))**.45; add(x,chirp(680,72,2.4,.04),.2); return fade(x,.10,.65)


def human():
    d=2.25;n=int(d*SR);t=np.arange(n)/SR
    # breath-like filtered air + a restrained body pulse; recognisable without becoming literal voice acting
    air=noise(n,45)*.055
    shape=np.zeros(n)
    a0,a1=int(.10*SR),int(.92*SR); shape[a0:a1]=np.sin(np.linspace(0,np.pi,a1-a0))**1.5
    b0,b1=int(1.06*SR),int(2.02*SR); shape[b0:b1]=np.sin(np.linspace(0,np.pi,b1-b0))**1.25
    x=air*shape
    add(x,fade(sine(63,.18,.08,glide=(80,44)),.001,.14),.22)
    add(x,fade(sine(58,.18,.07,glide=(76,41)),.001,.14),1.20)
    return fade(x,.02,.30)

def death():
    d=2.35;n=int(d*SR);x=np.zeros(n)
    # one last paired pulse, then a narrow tone that falls out rather than a stock hospital beep
    add(x,fade(sine(62,.16,.18,glide=(84,40)),.001,.13),.05)
    add(x,fade(sine(46,.20,.13,glide=(62,31)),.001,.17),.23)
    add(x,fade(sine(410,.82,.055,glide=(410,205)),.002,.72),.55)
    tail=noise(int(1.15*SR),520)*.055*np.linspace(1,0,int(1.15*SR)); add(x,tail,1.0)
    return fade(x,.001,.42)

def computer():
    d=1.9;n=int(d*SR);x=np.zeros(n)
    burst(x,.02,.025,.16); add(x,fade(sine(92,.24,.08,glide=(70,116)),.002,.18),.02)
    for st,f in [(.34,740),(.56,1110),(.88,1480)]: add(x,fade(sine(f,.18,.07),.002,.14),st)
    add(x,sine(120,d,.018),0); add(x,sine(240,d,.009),0)
    return fade(x,.001,.32)

def chaosfx():
    d=2.25;n=int(d*SR);t=np.arange(n)/SR
    x=noise(n,9)*.04
    # discontinuous pitch shards and dropouts, but still controlled enough not to sound like a broken speaker
    gate=((np.sin(2*np.pi*6.7*t)>-.2).astype(float)*.65+.15)
    x*=gate
    for st,f0,f1,a in [(.08,1900,180,.10),(.44,330,2100,.08),(.92,2400,120,.10),(1.42,520,3100,.07)]: add(x,chirp(f0,f1,.22,a),st)
    add(x,sine(73,.95,.07,glide=(105,38)),.80)
    return fade(x,.001,.38)

new={
 'world-steam-v10.wav':(steam(),.072),'world-lava-v10.wav':(lava(),.088),'world-spark-v10.wav':(spark(),.082),
 'world-crystal-v10.wav':(crystal(),.070),'world-river-v10.wav':(river(),.064),'world-waterfall-v10.wav':(waterfall(),.078),
 'world-broth-v10.wav':(broth(),.078),'world-bird-v10.wav':(bird(),.058),'world-crowd-v10.wav':(crowd(),.060),
 'world-glass-v10.wav':(glass(),.070),'world-metal-v10.wav':(metal(),.082),'world-drum-v10.wav':(drum(),.085),
 'world-train-v10.wav':(train(),.080),'world-car-v10.wav':(car(),.076),'world-plane-v10.wav':(plane(),.074),
 'world-rocket-v10.wav':(rocket(),.105),'world-clock-v10.wav':(clock(),.070),'world-radio-v10.wav':(radio(),.065),
 'world-camera-v10.wav':(camera(),.080),'world-bigbang-v10.wav':(bigbang(),.115),'world-blackhole-v10.wav':(blackhole(),.085),
 'world-human-v10.wav':(human(),.062),'world-death-v10.wav':(death(),.070),'world-computer-v10.wav':(computer(),.075),'world-chaos-v10.wav':(chaosfx(),.085),
}
for name,(x,target) in new.items(): write(name,normalize(x,target,.92))
