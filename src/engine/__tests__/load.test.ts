import { describe, expect, it } from 'vitest';
import { generateClub } from '../generate';
import { toMatchTeam } from '../matchup';
import { simulateMatch } from '../simulate';
import { combineSeed } from '../rng';

/**
 * National round load test (synthetic cities until the IBGE seed lands in Phase 2):
 * ~5,570 municipalities x 4 NPC clubs = ~22k clubs, paired into ~11k matches, nothing stored.
 */
describe('national round load', () => {
  it('generates and simulates a full national round in under 5 seconds', () => {
    const CITIES = 5570;
    const t0 = performance.now();
    const teams = [];
    for (let c = 0; c < CITIES; c++) {
      for (let slot = 0; slot < 4; slot++) {
        teams.push(toMatchTeam(generateClub({ id: 1100015 + c * 7, name: `Cidade ${c}`, uf: 'BR' }, slot)));
      }
    }
    let goals = 0;
    const season = 1;
    const round = 1;
    for (let i = 0; i + 1 < teams.length; i += 2) {
      const h = teams[i];
      const a = teams[i + 1];
      const seed = combineSeed(season, round, h.club.id, a.club.id);
      goals += simulateMatch(seed, h, a).score.home;
    }
    const ms = performance.now() - t0;
    expect(teams.length).toBe(CITIES * 4);
    expect(goals).toBeGreaterThan(0);
    expect(ms).toBeLessThan(5000);
  });
});
