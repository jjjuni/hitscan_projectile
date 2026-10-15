import * as THREE from 'three';

// All sounds are synthesized once into AudioBuffers at load: no sound files.
export const listener = new THREE.AudioListener();
const ctx = listener.context;
const SR = ctx.sampleRate;

const rand = (a, b) => a + Math.random() * (b - a);
const noise = () => Math.random() * 2 - 1;
function lowpass(cut) {
  let y = 0;
  const a = 1 - Math.exp(-2 * Math.PI * cut / SR);
  return x => (y += a * (x - y));
}
function highpass(cut) {
  const lp = lowpass(cut);
  return x => x - lp(x);
}
// Render fn(t) into a buffer, add feedback echoes (room/terrain slap), normalize.
function render(dur, fn, echo = 0, echoDelay = 0.1) {
  const buf = ctx.createBuffer(1, Math.ceil(dur * SR), SR);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = fn(i / SR);
  const lag = Math.round(echoDelay * SR);
  if (echo) for (let i = lag; i < d.length; i++) d[i] += d[i - lag] * echo;
  let peak = 0;
  for (const v of d) peak = Math.max(peak, Math.abs(v));
  for (let i = 0; i < d.length; i++) d[i] /= peak * 1.1;
  return buf;
}

// Gunshot = sharp crack (supersonic snap) + pitched-down boom (muzzle blast) + filtered tail.
function gunshot({ crack, crackMs, crackCut, crackHp = 400, boom, boomAmp, boomMs, tail, tailMs, tailCut, echo, echoDelay }) {
  const lpCrack = lowpass(crackCut), hp = highpass(crackHp), lpTail = lowpass(tailCut);
  let phase = 0;
  return render(0.05 + tailMs / 1000 * 5 + echoDelay * 3, t => {
    const n = noise();
    phase += 2 * Math.PI * boom * (1 + 2.5 * Math.exp(-t / 0.012)) / SR;
    return hp(lpCrack(n)) * crack * Math.exp(-t * 1000 / crackMs)
      + Math.sin(phase) * boomAmp * Math.exp(-t * 1000 / boomMs)
      + lpTail(n) * tail * Math.exp(-t * 1000 / tailMs);
  }, echo, echoDelay);
}
// Metal-on-metal click: ringing partials plus a short noise tick.
function click(at, freq, amp = 1) {
  const hp = highpass(1500);
  return t => {
    const u = t - at;
    if (u < 0) return 0;
    const env = Math.exp(-u / 0.006);
    return amp * env * (hp(noise()) * 0.8 + Math.sin(2 * Math.PI * freq * u) * 0.5 + Math.sin(2 * Math.PI * freq * 1.7 * u) * 0.3);
  };
}
function slide(from, to, amp = 0.3) { // metal sliding along metal
  const lp = lowpass(3000), hp = highpass(800);
  return t => (t < from || t > to ? 0 : hp(lp(noise())) * amp * Math.sin(Math.PI * (t - from) / (to - from)));
}
// Low body thump under a click: the weight of steel parts seating.
function thunk(at, freq, amp = 1) {
  const lp = lowpass(400);
  return t => {
    const u = t - at;
    if (u < 0) return 0;
    return amp * Math.exp(-u / 0.03) * (Math.sin(2 * Math.PI * freq * u) * 0.8 + lp(noise()) * 1.5);
  };
}
const mix = (dur, ...parts) => render(dur, t => parts.reduce((s, p) => s + p(t), 0));

export const SOUNDS = {
  shot: {
    rifle: gunshot({ crack: 1, crackMs: 12, crackCut: 7000, boom: 110, boomAmp: 0.8, boomMs: 50, tail: 0.35, tailMs: 120, tailCut: 1800, echo: 0.25, echoDelay: 0.09 }),
    smg: gunshot({ crack: 0.8, crackMs: 8, crackCut: 6000, boom: 170, boomAmp: 0.5, boomMs: 35, tail: 0.25, tailMs: 80, tailCut: 2500, echo: 0.2, echoDelay: 0.07 }),
    shotgun: gunshot({ crack: 0.9, crackMs: 20, crackCut: 4500, boom: 62, boomAmp: 1.3, boomMs: 120, tail: 0.6, tailMs: 250, tailCut: 1200, echo: 0.3, echoDelay: 0.12 }),
    // sharper than before: brighter, faster crack with less low boom masking it
    sniper: gunshot({ crack: 1.8, crackMs: 9, crackCut: 14000, crackHp: 1200, boom: 55, boomAmp: 1.0, boomMs: 130, tail: 0.5, tailMs: 380, tailCut: 1400, echo: 0.35, echoDelay: 0.18 }),
  },
  clack: mix(0.35, click(0, 1300, 0.8), thunk(0, 150, 0.7), slide(0.015, 0.08, 0.15),
    click(0.1, 900, 1), thunk(0.1, 110, 1.2)), // reload "철-커덕", lower and heavier
  dry: mix(0.1, click(0, 3200, 0.8)),
};
// Buffers are all normalized to the same peak; loudness per gun lives here.
export const SHOT_VOLUME = { rifle: 0.5, smg: 0.45, shotgun: 0.8, sniper: 0.65 };

export function unlockAudio() {
  if (ctx.state !== 'running') ctx.resume();
}

// Own sounds: straight to the ears.
export function playLocal(buf, volume = 0.5) {
  const src = new AudioBufferSourceNode(ctx, { buffer: buf, playbackRate: rand(0.95, 1.05) });
  const gain = new GainNode(ctx, { gain: volume });
  src.connect(gain).connect(listener.getInput());
  src.onended = () => gain.disconnect();
  src.start();
}

// Other players' sounds: 3D-panned from their muzzle, quieter and duller with distance.
export function playAt(buf, pos, volume = 1) {
  const src = new AudioBufferSourceNode(ctx, { buffer: buf, playbackRate: rand(0.95, 1.05) });
  const dist = pos.distanceTo(listener.getWorldPosition(new THREE.Vector3()));
  const muffle = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: Math.max(1200, 20000 * Math.exp(-dist / 40)) });
  const panner = new PannerNode(ctx, {
    panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 4, rolloffFactor: 1, maxDistance: 400,
    positionX: pos.x, positionY: pos.y, positionZ: pos.z,
  });
  const gain = new GainNode(ctx, { gain: volume });
  src.connect(muffle).connect(gain).connect(panner).connect(listener.getInput());
  src.onended = () => panner.disconnect();
  src.start();
}
