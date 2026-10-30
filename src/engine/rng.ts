/**
 * Deterministic pseudo-random helpers.
 * Everything in the engine must draw randomness from here, never from Math.random.
 */

/** cyrb53-style 53-bit string hash, returns a 32-bit unsigned seed. */
export function hashString(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 >>> 0) ^ (h2 >>> 0);
}

export function toSeed(seed: string | number): number {
  if (typeof seed === 'number') return seed >>> 0;
  return hashString(seed);
}

/** Combine several seed parts into one (order matters). */
export function combineSeed(...parts: Array<string | number>): number {
  return hashString(parts.map(String).join('|'));
}

export interface Rng {
  /** float in [0, 1) */
  next(): number;
  /** integer in [min, max] inclusive */
  int(min: number, max: number): number;
  /** float in [min, max) */
  range(min: number, max: number): number;
  /** true with probability p */
  chance(p: number): boolean;
  pick<T>(arr: readonly T[]): T;
  /** approx normal distribution (mean, sd) via sum of uniforms */
  gauss(mean: number, sd: number): number;
  /** pick index with weights */
  weighted(weights: readonly number[]): number;
}

/** mulberry32 */
export function createRng(seed: string | number): Rng {
  let a = toSeed(seed) || 0x9e3779b9;
  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    range: (min, max) => min + next() * (max - min),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    gauss: (mean, sd) => {
      let s = 0;
      for (let i = 0; i < 6; i++) s += next();
      return mean + ((s - 3) / 1.2247) * sd; // var of sum of 6 uniforms = 0.5
    },
    weighted: (weights) => {
      let total = 0;
      for (const w of weights) total += w;
      let r = next() * total;
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r < 0) return i;
      }
      return weights.length - 1;
    },
  };
}

export const clamp = (v: number, min: number, max: number): number => (v < min ? min : v > max ? max : v);
