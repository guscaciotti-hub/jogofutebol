import { describe, expect, it } from 'vitest';
import { generateClub, generatePlayer, pickLineup, ROSTER_SIZE, clubSeedFor } from '../generate';
import { FORMATIONS, FORMATION_LIST } from '../formations';

const city = { id: 3550308, name: 'São Paulo', uf: 'SP' };

describe('procedural generation', () => {
  it('generateClub is deterministic', () => {
    const a = generateClub(city, 0);
    const b = generateClub(city, 0);
    expect(a).toEqual(b);
    expect(a.players).toHaveLength(ROSTER_SIZE);
    expect(a.name).toBe('Esporte Clube São Paulo');
  });
  it('different slots give different clubs and colours contrast', () => {
    const clubs = [0, 1, 2, 3].map((s) => generateClub(city, s));
    const names = new Set(clubs.map((c) => c.name));
    expect(names.size).toBe(4);
    for (const c of clubs) expect(c.colors[0]).not.toBe(c.colors[1]);
  });
  it('generatePlayer is deterministic and attributes are within 1..99', () => {
    const seed = clubSeedFor(city.id, 1);
    for (let i = 0; i < ROSTER_SIZE; i++) {
      const p = generatePlayer(seed, i);
      expect(p).toEqual(generatePlayer(seed, i));
      for (const v of Object.values(p.attrs)) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(99);
      }
    }
  });
  it('pickLineup returns 11 players in slot order with a GK first', () => {
    const club = generateClub(city, 2);
    for (const f of FORMATION_LIST) {
      const lineup = pickLineup(club.players, f);
      expect(lineup).toHaveLength(11);
      expect(new Set(lineup.map((p) => p.id)).size).toBe(11);
      expect(lineup[0].position).toBe('GK');
      const slots = FORMATIONS[f];
      // most slots should be filled by natural position players
      const natural = lineup.filter((p, i) => p.position === slots[i].position).length;
      expect(natural).toBeGreaterThanOrEqual(10);
    }
  });
  it('humans get priority when rating is close', () => {
    const club = generateClub(city, 3);
    const roster = club.players.map((p) => ({ ...p }));
    const npcAtt = roster.find((p) => p.position === 'ATT')!;
    const human = { ...npcAtt, id: 'human-1', name: '@gustavo', handle: 'gustavo', isHuman: true, attrs: { ...npcAtt.attrs, shot: npcAtt.attrs.shot - 3 } };
    roster.push(human);
    const lineup = pickLineup(roster, '4-4-2');
    expect(lineup.some((p) => p.id === 'human-1')).toBe(true);
  });
});
