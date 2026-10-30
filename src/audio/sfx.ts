import { Howl, Howler } from 'howler';
import { createRng } from '../engine/rng';

/**
 * All sounds are synthesized in code (short 16 kHz WAVs as data URIs):
 * royalty-free by construction, zero network, well under 300 KB in total.
 */
const SR = 16000;

function encodeWav(samples: Float32Array): string {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, SR, true);
  v.setUint32(28, SR * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return 'data:audio/wav;base64,' + btoa(bin);
}

const rng = createRng('sfx');
const noise = () => rng.next() * 2 - 1;

function whistle(seconds: number, blasts = 1): Float32Array {
  const n = Math.floor(SR * seconds);
  const out = new Float32Array(n);
  const blastLen = n / blasts;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const local = (i % blastLen) / blastLen;
    const env = Math.min(1, local * 40) * Math.min(1, (1 - local) * 12);
    const vib = 1 + 0.015 * Math.sin(2 * Math.PI * 38 * t);
    const trill = 0.5 + 0.5 * Math.sin(2 * Math.PI * 42 * t); // referee pea whistle
    out[i] = env * (0.6 * Math.sin(2 * Math.PI * 2350 * vib * t) + 0.25 * Math.sin(2 * Math.PI * 2950 * t)) * (0.6 + 0.4 * trill) * 0.5;
  }
  return out;
}

function kick(): Float32Array {
  const n = Math.floor(SR * 0.16);
  const out = new Float32Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    lp += (noise() - lp) * 0.25;
    const env = Math.exp(-t * 45);
    out[i] = (lp * 0.9 + Math.sin(2 * Math.PI * 110 * t) * 0.5) * env;
  }
  return out;
}

function crowdLoop(): Float32Array {
  const n = Math.floor(SR * 3.0);
  const out = new Float32Array(n);
  let b = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    b += (noise() - b) * 0.08; // brownish murmur
    const swell = 0.75 + 0.25 * Math.sin(2 * Math.PI * 0.33 * t);
    // fade edges so the loop is seamless
    const edge = Math.min(1, i / (SR * 0.15), (n - i) / (SR * 0.15));
    out[i] = b * swell * edge * 1.6;
  }
  return out;
}

function cheer(seconds: number): Float32Array {
  const n = Math.floor(SR * seconds);
  const out = new Float32Array(n);
  let b = 0;
  let h = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const w = noise();
    b += (w - b) * 0.12;
    h += (w - h) * 0.5;
    const env = Math.min(1, t / 0.25) * Math.exp(-Math.max(0, t - 0.8) * 1.1);
    const roar = (b * 1.2 + (h - b) * 0.4) * env;
    out[i] = roar * 1.4;
  }
  return out;
}

function groan(): Float32Array {
  const n = Math.floor(SR * 1.2);
  const out = new Float32Array(n);
  let b = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    b += (noise() - b) * 0.06;
    const env = Math.min(1, t / 0.1) * Math.exp(-t * 2.5);
    out[i] = b * env * 1.5 * (1 + 0.3 * Math.sin(2 * Math.PI * 180 * t));
  }
  return out;
}

export interface Sfx {
  whistle(): void;
  whistleLong(): void;
  kick(): void;
  goal(): void;
  save(): void;
  miss(): void;
  card(): void;
  crowdStart(): void;
  crowdStop(): void;
  setMuted(m: boolean): void;
  muted: boolean;
  /** approximate bytes of generated audio (for the perf budget) */
  bytes: number;
}

export function createSfx(): Sfx {
  const make = (samples: Float32Array, extra: Partial<ConstructorParameters<typeof Howl>[0]> = {}) => {
    const src = encodeWav(samples);
    bytes += samples.length * 2;
    return new Howl({ src: [src], format: ['wav'], ...extra });
  };
  let bytes = 0;
  const hWhistle = make(whistle(0.45), { volume: 0.5 });
  const hWhistleLong = make(whistle(1.8, 3), { volume: 0.5 });
  const hKick = make(kick(), { volume: 0.8 });
  const hCheer = make(cheer(2.8), { volume: 0.9 });
  const hShort = make(cheer(1.0), { volume: 0.5 });
  const hGroan = make(groan(), { volume: 0.6 });
  const hCrowd = make(crowdLoop(), { loop: true, volume: 0.22 });
  const sfx: Sfx = {
    muted: false,
    bytes,
    whistle: () => void hWhistle.play(),
    whistleLong: () => void hWhistleLong.play(),
    kick: () => void hKick.play(),
    goal: () => void hCheer.play(),
    save: () => void hShort.play(),
    miss: () => void hGroan.play(),
    card: () => void hWhistle.play(),
    crowdStart: () => {
      if (!hCrowd.playing()) hCrowd.play();
    },
    crowdStop: () => hCrowd.stop(),
    setMuted(m) {
      sfx.muted = m;
      Howler.mute(m);
    },
  };
  return sfx;
}
