import { describe, expect, it } from 'vitest';
import { simulateMatch } from '../simulate';
import { generateClub } from '../generate';
import { toMatchTeam } from '../matchup';
import { createRng } from '../rng';
import { FORMATION_LIST, STYLE_LIST } from '../formations';
import type { Tactics } from '../types';

const cityA = { id: 3304557, name: 'Rio de Janeiro', uf: 'RJ' };
const cityB = { id: 4106902, name: 'Curitiba', uf: 'PR' };

const home = () => toMatchTeam(generateClub(cityA, 0));
const away = () => toMatchTeam(generateClub(cityB, 1));

describe('simulateMatch', () => {
  it('is deterministic for the same seed and lineups', () => {
    const a = simulateMatch('rodada-1', home(), away());
    const b = simulateMatch('rodada-1', home(), away());
    expect(a.events).toEqual(b.events);
    expect(a.score).toEqual(b.score);
    expect(a.stats).toEqual(b.stats);
  });

  it('changes with the seed', () => {
    const a = simulateMatch('seed-a', home(), away());
    const b = simulateMatch('seed-b', home(), away());
    expect(a.events).not.toEqual(b.events);
  });

  it('events are well formed and ordered', () => {
    const r = simulateMatch(7, home(), away());
    expect(r.events[0].type).toBe('kickoff');
    expect(r.events.at(-1)!.type).toBe('fulltime');
    expect(r.events.some((e) => e.type === 'halftime')).toBe(true);
    let lastMinute = -1;
    for (const e of r.events) {
      expect(e.minute).toBeGreaterThanOrEqual(lastMinute);
      lastMinute = e.minute;
      expect(Math.abs(e.pos.x)).toBeLessThanOrEqual(1.0001);
      expect(Math.abs(e.pos.y)).toBeLessThanOrEqual(1.0001);
      if (e.type === 'goal' || e.type === 'chance') {
        expect(e.playerId).toBeDefined();
        expect(e.secondaryId).toBeDefined();
      }
    }
    const goals = r.events.filter((e) => e.type === 'goal');
    expect(goals.length).toBe(r.score.home + r.score.away);
    // every goal is preceded by a chance of the same team in the same minute
    for (const g of goals) {
      const prev = r.events[r.events.findIndex((e) => e.id === g.id) - 1];
      expect(prev.type).toBe('chance');
      expect(prev.team).toBe(g.team);
    }
    expect(r.stats.possession.home + r.stats.possession.away).toBe(100);
  });

  it('10,000 matches: 2–3.5 goals per game and ~45% home wins', () => {
    const rng = createRng('realism');
    const N = 10000;
    let goals = 0;
    let homeWins = 0;
    for (let i = 0; i < N; i++) {
      const ca = { id: 1000 + rng.int(0, 5000), name: 'A', uf: 'XX' };
      const cb = { id: 1000 + rng.int(0, 5000), name: 'B', uf: 'XX' };
      const tac = (): Tactics => ({ formation: rng.pick(FORMATION_LIST), style: rng.pick(STYLE_LIST) });
      const r = simulateMatch(i, toMatchTeam(generateClub(ca, rng.int(0, 3)), tac()), toMatchTeam(generateClub(cb, rng.int(0, 3)), tac()));
      goals += r.score.home + r.score.away;
      if (r.score.home > r.score.away) homeWins++;
    }
    const avgGoals = goals / N;
    const homeRate = homeWins / N;
    expect(avgGoals).toBeGreaterThanOrEqual(2);
    expect(avgGoals).toBeLessThanOrEqual(3.5);
    expect(homeRate).toBeGreaterThanOrEqual(0.4);
    expect(homeRate).toBeLessThanOrEqual(0.5);
  });

  it('pressão creates more shots than retranca; retranca concedes fewer', () => {
    let shotsPress = 0;
    let shotsBunker = 0;
    let concededPress = 0;
    let concededBunker = 0;
    for (let i = 0; i < 1500; i++) {
      const p = simulateMatch(i, toMatchTeam(generateClub(cityA, 0), { formation: '4-4-2', style: 'pressao' }), away());
      const b = simulateMatch(i, toMatchTeam(generateClub(cityA, 0), { formation: '4-4-2', style: 'retranca' }), away());
      shotsPress += p.stats.shots.home;
      shotsBunker += b.stats.shots.home;
      concededPress += p.score.away;
      concededBunker += b.score.away;
    }
    expect(shotsPress).toBeGreaterThan(shotsBunker * 1.2);
    expect(concededBunker).toBeLessThan(concededPress);
  });

  it('a stronger team wins more often', () => {
    const strong = toMatchTeam(generateClub(cityA, 0));
    strong.lineup = strong.lineup.map((p) => ({ ...p, attrs: Object.fromEntries(Object.entries(p.attrs).map(([k, v]) => [k, Math.min(99, v + 25)])) as typeof p.attrs }));
    let wins = 0;
    for (let i = 0; i < 1000; i++) if (simulateMatch(i, away(), strong).score.away > simulateMatch(i, away(), strong).score.home) wins++;
    expect(wins / 1000).toBeGreaterThan(0.6);
  });

  it('supporters bonus is small and capped', () => {
    let base = 0;
    let boosted = 0;
    for (let i = 0; i < 2000; i++) {
      base += simulateMatch(i, { ...home(), supporters: 0 }, away()).score.home;
      boosted += simulateMatch(i, { ...home(), supporters: 5000 }, away()).score.home;
    }
    expect(boosted).toBeGreaterThanOrEqual(base * 0.98);
    expect(boosted).toBeLessThan(base * 1.1);
  });
});
