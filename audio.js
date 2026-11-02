/* ============================================================
   Звук: синтез через WebAudio (без внешних файлов)
   ============================================================ */
window.Sound = (function () {
  'use strict';
  let ctx = null, master = null, enabled = true;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.45;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  function tone({ f = 440, f2 = null, type = 'sine', dur = 0.15, vol = 0.25, delay = 0, attack = 0.005 }) {
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function noise({ dur = 0.2, vol = 0.3, delay = 0, freq = 1200, q = 0.8, type = 'lowpass' }) {
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const fl = ctx.createBiquadFilter();
    fl.type = type; fl.frequency.value = freq; fl.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(fl); fl.connect(g); g.connect(master);
    src.start(t0);
  }

  const S = {
    click() { tone({ f: 900, type: 'triangle', dur: 0.05, vol: 0.12 }); },
    key() { tone({ f: 1300, type: 'square', dur: 0.03, vol: 0.05 }); },
    select() { tone({ f: 520, f2: 780, type: 'triangle', dur: 0.09, vol: 0.16 }); },
    move() { noise({ dur: 0.12, vol: 0.25, freq: 900 }); tone({ f: 220, f2: 160, type: 'sine', dur: 0.12, vol: 0.18 }); },
    turn() { tone({ f: 660, type: 'sine', dur: 0.18, vol: 0.1 }); tone({ f: 990, type: 'sine', dur: 0.25, vol: 0.08, delay: 0.08 }); },
    clash() {
      noise({ dur: 0.35, vol: 0.5, freq: 3000, type: 'bandpass', q: 0.6 });
      tone({ f: 140, f2: 50, type: 'sawtooth', dur: 0.35, vol: 0.25 });
      tone({ f: 1800, f2: 900, type: 'square', dur: 0.12, vol: 0.06, delay: 0.02 });
    },
    count() { tone({ f: 440, type: 'square', dur: 0.12, vol: 0.1 }); },
    go() { tone({ f: 880, type: 'square', dur: 0.3, vol: 0.12 }); tone({ f: 1320, type: 'triangle', dur: 0.35, vol: 0.1, delay: 0.05 }); },
    tick() { tone({ f: 1500, type: 'square', dur: 0.04, vol: 0.06 }); },
    tickUrgent() { tone({ f: 1900, type: 'square', dur: 0.06, vol: 0.1 }); },
    correct() { [660, 880, 1320].forEach((f, i) => tone({ f, type: 'triangle', dur: 0.18, vol: 0.18, delay: i * 0.07 })); },
    wrong() { tone({ f: 180, f2: 120, type: 'sawtooth', dur: 0.28, vol: 0.18 }); },
    hit() { noise({ dur: 0.25, vol: 0.55, freq: 700 }); tone({ f: 110, f2: 45, type: 'sine', dur: 0.3, vol: 0.4 }); },
    kill() {
      noise({ dur: 0.6, vol: 0.45, freq: 500 });
      [523, 392, 262, 196].forEach((f, i) => tone({ f, type: 'sawtooth', dur: 0.2, vol: 0.09, delay: i * 0.09 }));
    },
    timeout() { tone({ f: 330, f2: 220, type: 'triangle', dur: 0.5, vol: 0.18 }); },
    win() {
      const seq = [523, 659, 784, 1047, 784, 1047];
      seq.forEach((f, i) => tone({ f, type: 'triangle', dur: 0.28, vol: 0.18, delay: i * 0.13 }));
      tone({ f: 262, type: 'sine', dur: 1.2, vol: 0.15, delay: 0.5 });
    }
  };

  return {
    play(name) {
      if (!enabled) return;
      try { if (ensure() && S[name]) S[name](); } catch (e) { /* звук не критичен */ }
    },
    unlock() { try { ensure(); } catch (e) {} },
    get enabled() { return enabled; },
    set enabled(v) { enabled = !!v; }
  };
})();
