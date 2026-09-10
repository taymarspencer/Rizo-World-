/* RIZO ORIGIN — sound.
   Everything is synthesised at runtime through WebAudio. No samples, no
   licences, no loading. Muted state is remembered by the save file. */
(function(){
  let ctx = null, master = null, on = true, ready = false;

  function boot(){
    if (ctx || !window.AudioContext && !window.webkitAudioContext) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    ready = true;
  }
  function resume(){ if (ctx && ctx.state === 'suspended') ctx.resume(); }

  function env(node, t0, a, d, peak){
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    node.connect(g); g.connect(master);
    return g;
  }

  function tone(freq, t0, dur, type, peak, glideTo){
    const o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    env(o, t0, Math.min(0.012, dur*0.3), dur, peak == null ? 0.16 : peak);
    o.start(t0); o.stop(t0 + dur + 0.06);
  }

  let noiseBuf = null;
  function noise(t0, dur, peak, hz, q){
    if (!noiseBuf){
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i=0;i<d.length;i++) d[i] = (Math.random()*2-1) * (1 - i/d.length);
    }
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = hz || 1200; f.Q.value = q || 1;
    s.connect(f);
    env(f, t0, 0.004, dur, peak == null ? 0.1 : peak);
    s.start(t0); s.stop(t0 + dur + 0.05);
  }

  const N = { c3:130.8, e3:164.8, g3:196, a3:220, c4:261.6, d4:293.7, e4:329.6, f4:349.2,
              g4:392, a4:440, b4:493.9, c5:523.3, d5:587.3, e5:659.3, g5:784, a5:880, c6:1046.5 };

  const SFX = {
    tap(t){ tone(660, t, 0.045, 'sine', 0.075); noise(t, 0.02, 0.03, 3000, 2); },
    untap(t){ tone(400, t, 0.05, 'sine', 0.06); },
    fail(t){
      tone(150, t, 0.12, 'sine', 0.12, 96);
      noise(t, 0.09, 0.055, 420, 0.7);
    },
    known(t){
      tone(N.e4, t, 0.09, 'triangle', 0.1);
      tone(N.a4, t+0.055, 0.12, 'triangle', 0.09);
    },
    found(t){
      noise(t, 0.05, 0.05, 2600, 1.4);
      tone(N.c5, t, 0.16, 'triangle', 0.14);
      tone(N.e5, t+0.06, 0.18, 'triangle', 0.12);
      tone(N.g5, t+0.12, 0.30, 'sine', 0.11);
    },
    major(t){
      noise(t, 0.10, 0.07, 1800, 0.9);
      tone(N.c4, t, 0.5, 'sawtooth', 0.05);
      tone(N.c5, t+0.02, 0.22, 'triangle', 0.14);
      tone(N.g5, t+0.11, 0.24, 'triangle', 0.12);
      tone(N.c6, t+0.20, 0.45, 'sine', 0.12);
    },
    domain(t){
      tone(65, t, 0.7, 'sine', 0.22);
      noise(t, 0.35, 0.09, 700, 0.6);
      tone(N.a3, t+0.05, 0.9, 'sawtooth', 0.035, N.a4);
      tone(N.e5, t+0.26, 0.5, 'triangle', 0.1);
      tone(N.a5, t+0.40, 0.7, 'sine', 0.1);
    },
    secret(t){
      tone(N.a4*0.997, t, 1.1, 'sine', 0.09);
      tone(N.a4*1.004, t, 1.1, 'sine', 0.09);
      tone(N.d5, t+0.14, 0.9, 'sine', 0.07);
      tone(N.f4, t+0.3, 1.2, 'sine', 0.05);
    },
    ach(t){
      tone(N.g4, t, 0.11, 'square', 0.055);
      tone(N.c5, t+0.08, 0.11, 'square', 0.055);
      tone(N.e5, t+0.16, 0.3, 'square', 0.05);
    },
    reveal(t){
      tone(48, t, 1.4, 'sine', 0.26);
      tone(N.c3, t, 1.5, 'sawtooth', 0.045, N.c4);
      noise(t+0.1, 0.9, 0.05, 400, 0.4);
      tone(N.c5, t+0.7, 0.8, 'triangle', 0.09);
    },
    hint(t){ tone(N.d5, t, 0.08, 'sine', 0.07); tone(N.g5, t+0.06, 0.14, 'sine', 0.06); },
    ending(t){
      const seq=[N.c4,N.e4,N.g4,N.c5,N.e5,N.g5,N.c6];
      tone(52, t, 3.4, 'sine', 0.24);
      seq.forEach((f,i)=>tone(f, t+0.16*i, 1.3, 'triangle', 0.085));
      tone(N.c5, t+1.5, 2.4, 'sine', 0.08);
      tone(N.g5, t+1.7, 2.2, 'sine', 0.06);
    },
    open(t){ tone(520, t, 0.06, 'sine', 0.05); },
    close(t){ tone(340, t, 0.06, 'sine', 0.05); }
  };

  function play(name){
    if (!on) return;
    if (!ready) boot();
    if (!ready) return;
    resume();
    const f = SFX[name];
    if (f) { try { f(ctx.currentTime + 0.005); } catch(e){} }
  }

  window.RizoAudio = {
    play,
    unlock(){ boot(); resume(); },
    set muted(v){ on = !v; },
    get muted(){ return !on; }
  };
})();
