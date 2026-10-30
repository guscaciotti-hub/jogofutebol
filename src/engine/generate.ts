import { combineSeed, createRng, clamp, type Rng } from './rng';
import { CLUB_PREFIXES, generateName } from './names';
import { FORMATIONS } from './formations';
import type { Attributes, Club, ClubInfo, Crest, CrestIcon, CrestShape, Formation, Player, Position } from './types';

/**
 * Procedural, deterministic NPC generation.
 * generateClub(cityId, slot) and generatePlayer(clubSeed, index) always return the same output,
 * so NPCs are never stored in a database.
 */

export const ROSTER_SIZE = 16;
/** roster composition: 2 GK, 5 DEF, 5 MID, 4 ATT */
export const ROSTER_POSITIONS: Position[] = [
  'GK', 'GK',
  'DEF', 'DEF', 'DEF', 'DEF', 'DEF',
  'MID', 'MID', 'MID', 'MID', 'MID',
  'ATT', 'ATT', 'ATT', 'ATT',
];

/** Bright flat palette, no real club colours. */
export const PALETTE = [
  '#e63946', '#f4a261', '#ffd166', '#2a9d8f', '#118ab2', '#073b4c', '#06d6a0', '#8338ec',
  '#ff6b6b', '#4ecdc4', '#ff9f1c', '#2ec4b6', '#e71d36', '#3a86ff', '#fb5607', '#ffbe0b',
  '#06a77d', '#005f73', '#9b2226', '#bb3e03', '#ae2012', '#6a4c93', '#1982c4', '#8ac926',
  '#ffffff', '#1d1d1d', '#f1faee', '#a8dadc',
];

const SHAPES: CrestShape[] = ['shield', 'circle', 'diamond', 'hex'];
const ICONS: CrestIcon[] = ['star', 'ball', 'bolt', 'sun', 'wave', 'tree', 'bird', 'anchor'];
const SPLITS: Crest['split'][] = ['solid', 'half', 'stripes', 'band'];

export interface CityRef {
  id: number;
  name: string;
  uf: string;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** perceptual-ish distance so two club colours always contrast */
function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return Math.sqrt((r1 - r2) ** 2 * 0.3 + (g1 - g2) ** 2 * 0.59 + (b1 - b2) ** 2 * 0.11);
}

export function pickColors(rng: Rng): [string, string] {
  const primary = rng.pick(PALETTE);
  let secondary = rng.pick(PALETTE);
  let guard = 0;
  while (colorDistance(primary, secondary) < 90 && guard++ < 20) secondary = rng.pick(PALETTE);
  return [primary, secondary];
}

export function generateCrest(rng: Rng): Crest {
  return { shape: rng.pick(SHAPES), icon: rng.pick(ICONS), split: rng.pick(SPLITS) };
}

/**
 * Attribute profile per position. mean/sd around a base level (1..99).
 * NPC overall level is balanced (~50) with mild variation per club.
 */
function rollAttributes(rng: Rng, position: Position, level: number): Attributes {
  const main = (bonus: number) => clamp(Math.round(rng.gauss(level + bonus, 7)), 20, 95);
  const off = (bonus: number) => clamp(Math.round(rng.gauss(level + bonus, 9)), 5, 90);
  switch (position) {
    case 'GK':
      return { speed: off(-15), pass: off(-12), shot: off(-30), defense: off(-5), goalkeeping: main(12) };
    case 'DEF':
      return { speed: off(-2), pass: off(-6), shot: off(-18), defense: main(12), goalkeeping: off(-40) };
    case 'MID':
      return { speed: off(0), pass: main(12), shot: off(-4), defense: off(-2), goalkeeping: off(-40) };
    case 'ATT':
      return { speed: main(6), pass: off(-4), shot: main(12), defense: off(-18), goalkeeping: off(-40) };
  }
}

export function generatePlayer(clubSeed: number, index: number, level = 50): Player {
  const rng = createRng(combineSeed(clubSeed, 'player', index));
  const position = ROSTER_POSITIONS[index % ROSTER_SIZE];
  return {
    id: `${clubSeed.toString(36)}-${index}`,
    name: generateName(rng),
    isHuman: false,
    position,
    attrs: rollAttributes(rng, position, level),
  };
}

export function clubSeedFor(cityId: number, slot: number): number {
  return combineSeed('club', cityId, slot);
}

export function npcClubId(cityId: number, slot: number): string {
  return `npc-${cityId}-${slot}`;
}

/** Generates the NPC club in `slot` (0..3) for a city. Pure and deterministic. */
export function generateClub(city: CityRef, slot: number): Club {
  const seed = clubSeedFor(city.id, slot);
  const rng = createRng(seed);
  // the first 4 slots use distinct name patterns so a city never repeats a pattern
  const prefix = CLUB_PREFIXES[slot % CLUB_PREFIXES.length];
  const name = prefix.pattern.replace('{city}', city.name);
  const colors = pickColors(rng);
  const crest = generateCrest(rng);
  // club level: NPC clubs are balanced, small town-to-town variation
  const level = clamp(Math.round(rng.gauss(50, 4)), 40, 60);
  const players: Player[] = [];
  for (let i = 0; i < ROSTER_SIZE; i++) players.push(generatePlayer(seed, i, level));
  return {
    id: npcClubId(city.id, slot),
    name,
    shortName: prefix.short,
    cityId: city.id,
    cityName: city.name,
    stateUf: city.uf,
    colors,
    crest,
    isNpc: true,
    players,
  };
}

export function clubInfo(club: Club): ClubInfo {
  const { players: _players, ...info } = club;
  return info;
}

/** Rating of a player for a given position role. */
export function roleRating(p: Player, role: Position): number {
  const a = p.attrs;
  switch (role) {
    case 'GK':
      return a.goalkeeping;
    case 'DEF':
      return a.defense * 0.6 + a.speed * 0.2 + a.pass * 0.2;
    case 'MID':
      return a.pass * 0.5 + a.speed * 0.25 + a.defense * 0.25;
    case 'ATT':
      return a.shot * 0.55 + a.speed * 0.3 + a.pass * 0.15;
  }
}

/**
 * Picks the 11 starters for a formation. Output order matches FORMATIONS[formation] slots
 * (index 0 is the goalkeeper). Humans have priority over NPCs when ratings are close (within 5 points).
 */
export function pickLineup(roster: Player[], formation: Formation): Player[] {
  const slots = FORMATIONS[formation];
  const used = new Set<string>();
  const lineup: Player[] = [];
  for (const slot of slots) {
    let best: Player | undefined;
    let bestScore = -Infinity;
    for (const p of roster) {
      if (used.has(p.id)) continue;
      let score = roleRating(p, slot.position);
      if (p.position !== slot.position) score -= slot.position === 'GK' || p.position === 'GK' ? 40 : 12;
      if (p.isHuman) score += 5;
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (!best) throw new Error('roster too small for formation');
    used.add(best.id);
    lineup.push(best);
  }
  return lineup;
}
