import { describe, expect, it } from 'vitest';
import { combineSeed, createRng, hashString } from '../rng';

describe('rng', () => {
  it('same seed gives same sequence', () => {
    const a = createRng('abc');
    const b = createRng('abc');
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
  it('different seeds differ', () => {
    const a = createRng('abc');
    const b = createRng('abd');
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });
  it('hashString is stable and 32-bit', () => {
    expect(hashString('varzea')).toBe(hashString('varzea'));
    expect(hashString('varzea')).toBeLessThan(2 ** 32);
    expect(combineSeed('a', 1)).not.toBe(combineSeed('a', 2));
  });
  it('int stays in range and is roughly uniform', () => {
    const r = createRng(42);
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 40000; i++) counts[r.int(0, 3)]++;
    for (const c of counts) expect(c).toBeGreaterThan(9000);
  });
});
