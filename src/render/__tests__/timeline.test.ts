import { describe, expect, it } from 'vitest';
import { buildReplay, getReplayState, ballAt } from '../timeline';
import { simulateMatch, generateClub, toMatchTeam } from '../../engine';

const cityA = { id: 3550308, name: 'São Paulo', uf: 'SP' };
const cityB = { id: 2927408, name: 'Salvador', uf: 'BA' };

function match(seed: number) {
  return simulateMatch(seed, toMatchTeam(generateClub(cityA, 0)), toMatchTeam(generateClub(cityB, 2)));
}

describe('replay timeline', () => {
  it('is deterministic and about 3 minutes long', () => {
    const r = match(1);
    const a = buildReplay(r);
    const b = buildReplay(r);
    expect(a.ballKeys).toEqual(b.ballKeys);
    expect(a.duration).toBeGreaterThan(120);
    expect(a.duration).toBeLessThan(260);
  });

  it('ball keys are time-ordered and segments are contiguous', () => {
    const rep = buildReplay(match(2));
    for (let i = 1; i < rep.ballKeys.length; i++) expect(rep.ballKeys[i].t).toBeGreaterThanOrEqual(rep.ballKeys[i - 1].t - 1e-9);
    for (let i = 1; i < rep.segments.length; i++) expect(rep.segments[i].start).toBeCloseTo(rep.segments[i - 1].end, 6);
    expect(rep.segments[0].start).toBe(0);
    expect(rep.segments.at(-1)!.end).toBeCloseTo(rep.duration, 6);
  });

  it('final sampled score matches the simulation and states have no NaN', () => {
    for (const seed of [3, 4, 5]) {
      const r = match(seed);
      const rep = buildReplay(r);
      const end = getReplayState(rep, rep.duration);
      expect(end.score).toEqual(r.score);
      expect(end.ended).toBe(true);
      for (let t = 0; t <= rep.duration; t += 0.37) {
        const st = getReplayState(rep, t);
        expect(st.players).toHaveLength(22);
        for (const p of st.players) {
          expect(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)).toBe(true);
          expect(Math.abs(p.x)).toBeLessThanOrEqual(1.3);
        }
        const b = ballAt(rep, t);
        expect(Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.z)).toBe(true);
        expect(st.score.home).toBeLessThanOrEqual(r.score.home);
      }
    }
  });

  it('every goal and card event gets a timestamp inside the replay', () => {
    const r = match(6);
    const rep = buildReplay(r);
    for (const e of r.events) {
      if (e.type === 'goal' || e.type === 'yellow' || e.type === 'red' || e.type === 'chance') {
        const t = rep.eventTimes.get(e.id);
        expect(t).toBeDefined();
        expect(t!).toBeLessThanOrEqual(rep.duration);
      }
    }
  });
});
