// audio.js — all sound is synthesized with WebAudio. No audio files, no
// network. A tiny synth: tones, filtered noise, and short envelopes.
// The game starts muted until the first user gesture (browser autoplay
// policy); M toggles mute at any time.

let ctx = null;
let muted = false;
let drillNodes = null;

export function ensureAudio() {
  if (!ctx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    } catch {
      ctx = null;
    }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  if (muted) stopDrill();
  return muted;
}

function tone(freq, dur, type, vol, slideTo) {
  if (muted || !ensureAudio()) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(vol || 0.12, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noiseBurst(dur, vol, lowpass) {
  if (muted || !ensureAudio()) return;
  const t0 = ctx.currentTime;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpass || 1200;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol || 0.1, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(t0);
}

export const sfx = {
  step(sneak) {
    noiseBurst(0.05, sneak ? 0.02 : 0.045, sneak ? 500 : 900);
  },
  pickup() {
    tone(880, 0.12, 'sine', 0.12);
    setTimeout(() => tone(1318, 0.18, 'sine', 0.1), 70);
  },
  coin() {
    tone(1046, 0.08, 'triangle', 0.1);
    setTimeout(() => tone(1568, 0.14, 'triangle', 0.09), 60);
  },
  lockTick() {
    tone(1400, 0.05, 'square', 0.06);
  },
  lockGood() {
    tone(660, 0.1, 'sine', 0.12);
    setTimeout(() => tone(990, 0.16, 'sine', 0.12), 80);
  },
  lockBad() {
    tone(220, 0.25, 'sawtooth', 0.1, 110);
  },
  unlock() {
    tone(523, 0.1, 'triangle', 0.12);
    setTimeout(() => tone(784, 0.12, 'triangle', 0.12), 90);
    setTimeout(() => tone(1046, 0.2, 'triangle', 0.1), 180);
  },
  alarm() {
    tone(440, 0.35, 'sawtooth', 0.09, 880);
    setTimeout(() => tone(440, 0.35, 'sawtooth', 0.09, 880), 380);
  },
  cameraBeep() {
    tone(1800, 0.09, 'square', 0.05);
  },
  spotted() {
    tone(980, 0.15, 'square', 0.09);
    setTimeout(() => tone(1240, 0.2, 'square', 0.09), 130);
  },
  busted() {
    tone(330, 0.5, 'sawtooth', 0.12, 110);
    setTimeout(() => tone(220, 0.7, 'sawtooth', 0.12, 70), 300);
  },
  jingle() {
    const notes = [523, 659, 784, 1046, 1318];
    notes.forEach((f, i) => setTimeout(() => tone(f, 0.25, 'triangle', 0.11), i * 110));
  },
  click() {
    tone(700, 0.05, 'square', 0.05);
  },
  gadget() {
    noiseBurst(0.4, 0.12, 2400);
    tone(300, 0.35, 'sine', 0.08, 900);
  },
  laserZap() {
    tone(1600, 0.18, 'sawtooth', 0.08, 300);
  },
};

export function startDrill() {
  if (muted || !ensureAudio() || drillNodes) return;
  const src = ctx.createBufferSource();
  const len = ctx.sampleRate;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  src.buffer = buf;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 900;
  filter.Q.value = 2;
  const gain = ctx.createGain();
  gain.gain.value = 0.05;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 11;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.025;
  lfo.connect(lfoGain).connect(gain.gain);
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start();
  lfo.start();
  drillNodes = { src, lfo, gain };
}

export function stopDrill() {
  if (!drillNodes) return;
  try {
    drillNodes.src.stop();
    drillNodes.lfo.stop();
    drillNodes.gain.disconnect();
  } catch { /* already stopped */ }
  drillNodes = null;
}
