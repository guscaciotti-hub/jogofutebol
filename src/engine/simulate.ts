import { createRng, clamp, toSeed, type Rng } from './rng';
import { FORMATIONS, FORMATION_MODS, STYLE_MODS } from './formations';
import { commentary } from './commentary';
import type { MatchEvent, MatchEventType, MatchResult, MatchStats, MatchTeam, PitchPos, Player, Side } from './types';

/**
 * Pure match simulation. Same seed + same teams + same tactics => identical events.
 * One iteration per minute: possession (midfield), danger (attack vs defense), finish (shot vs keeper).
 */

// ---- tunables (calibrated with scripts/calibrate.ts, verified by simulate.test.ts) ----
export const TUNING = {
  baseChance: 0.19, // chances per possession-minute at equal strength
  homeCreate: 1.14, // home advantage on chance creation
  awayCreate: 0.93,
  homeMid: 1.04,
  blockRate: 0.17,
  onTarget: { box: 0.5, edge: 0.4, long: 0.3 },
  goalQuality: { box: 0.44, edge: 0.27, long: 0.15 },
  foulRate: 0.2,
  yellowPerFoul: 0.12,
  redPerFoul: 0.003,
  redPenalty: 0.84,
  supporterMaxBonus: 0.04,
};

type ShotZone = 'box' | 'edge' | 'long';

interface TeamState {
  side: Side;
  team: MatchTeam;
  players: Player[]; // lineup (slot order)
  active: boolean[]; // false after a red card
  yellows: Set<string>;
  mid: number;
  att: number;
  def: number;
  gk: number;
  create: number; // multiplier on own chance creation
  concede: number; // multiplier on opponent chance creation
  fouls: number;
  reds: number;
  /** external multipliers (home advantage) applied on every recompute */
  extMid: number;
  extCreate: number;
}

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 50;
}

function roleOf(team: MatchTeam, index: number) {
  return FORMATIONS[team.tactics.formation][index].position;
}

function computeStrength(state: TeamState): void {
  const { team, players, active } = state;
  const fm = FORMATION_MODS[team.tactics.formation];
  const sm = STYLE_MODS[team.tactics.style];
  const by = (role: string) =>
    players.filter((_, i) => active[i] && roleOf(team, i) === role);
  const def = by('DEF');
  const mid = by('MID');
  const att = by('ATT');
  const gk = players[0];

  const midfield =
    0.6 * avg(mid.map((p) => p.attrs.pass * 0.5 + p.attrs.speed * 0.3 + p.attrs.defense * 0.2)) +
    0.2 * avg(def.map((p) => p.attrs.pass)) +
    0.2 * avg(att.map((p) => p.attrs.pass));
  const attack =
    0.7 * avg(att.map((p) => p.attrs.shot * 0.55 + p.attrs.speed * 0.3 + p.attrs.pass * 0.15)) +
    0.3 * avg(mid.map((p) => p.attrs.shot * 0.5 + p.attrs.speed * 0.5));
  const defense =
    0.7 * avg(def.map((p) => p.attrs.defense * 0.7 + p.attrs.speed * 0.3)) +
    0.3 * avg(mid.map((p) => p.attrs.defense));

  const redMul = Math.pow(TUNING.redPenalty, state.reds);
  const supporters = clamp(team.supporters ?? 0, 0, 50) / 50;

  state.mid = midfield * fm.mid * sm.mid * redMul * state.extMid;
  state.att = attack * fm.att * redMul;
  state.def = defense * fm.def * redMul;
  state.gk = active[0] ? gk.attrs.goalkeeping : 30;
  state.create = sm.create * (1 + supporters * TUNING.supporterMaxBonus) * state.extCreate;
  state.concede = sm.concede;
}

function makeState(side: Side, team: MatchTeam): TeamState {
  if (team.lineup.length !== 11) throw new Error(`${side} lineup must have 11 players`);
  const state: TeamState = {
    side,
    team,
    players: team.lineup,
    active: team.lineup.map(() => true),
    yellows: new Set(),
    mid: 0,
    att: 0,
    def: 0,
    gk: 0,
    create: 1,
    concede: 1,
    fouls: 0,
    reds: 0,
    extMid: side === 'home' ? TUNING.homeMid : 1,
    extCreate: side === 'home' ? TUNING.homeCreate : TUNING.awayCreate,
  };
  computeStrength(state);
  return state;
}

/** weighted pick of an active outfield player; weight = attr-based */
function pickPlayer(rng: Rng, s: TeamState, weight: (p: Player, role: string) => number, exclude?: string): number {
  const weights = s.players.map((p, i) => {
    if (!s.active[i] || i === 0 || p.id === exclude) return 0;
    return Math.max(0.01, weight(p, roleOf(s.team, i)));
  });
  return rng.weighted(weights);
}

const ROLE_SHOT_W: Record<string, number> = { DEF: 0.35, MID: 1.4, ATT: 3.2 };
const ROLE_PASS_W: Record<string, number> = { DEF: 0.8, MID: 2.0, ATT: 1.4 };

function dirOf(side: Side): number {
  return side === 'home' ? 1 : -1;
}

function labelMinute(minute: number, half: 1 | 2): string {
  if (half === 1 && minute > 45) return `45+${minute - 45}'`;
  if (half === 2 && minute > 90) return `90+${minute - 90}'`;
  return `${minute}'`;
}

export function simulateMatch(
  seed: string | number,
  homeTeam: MatchTeam,
  awayTeam: MatchTeam,
  tactics?: { home?: Partial<MatchTeam['tactics']>; away?: Partial<MatchTeam['tactics']> },
): MatchResult {
  const numericSeed = toSeed(seed);
  const rng = createRng(numericSeed);
  const home = makeState('home', tactics?.home ? { ...homeTeam, tactics: { ...homeTeam.tactics, ...tactics.home } } : homeTeam);
  const away = makeState('away', tactics?.away ? { ...awayTeam, tactics: { ...awayTeam.tactics, ...tactics.away } } : awayTeam);

  const events: MatchEvent[] = [];
  const score = { home: 0, away: 0 };
  const stats: MatchStats = {
    possession: { home: 0, away: 0 },
    shots: { home: 0, away: 0 },
    onTarget: { home: 0, away: 0 },
    fouls: { home: 0, away: 0 },
    cards: { home: 0, away: 0 },
  };
  let nextId = 0;
  let order = 0;
  let currentMinute = 0;
  const push = (
    type: MatchEventType,
    side: Side,
    minute: number,
    half: 1 | 2,
    pos: PitchPos,
    text: string,
    extra: Partial<MatchEvent> = {},
  ): MatchEvent => {
    if (minute !== currentMinute) {
      currentMinute = minute;
      order = 0;
    }
    const ev: MatchEvent = {
      id: nextId++,
      minute,
      half,
      order: order++,
      type,
      team: side,
      pos,
      text,
      score: { ...score },
      ...extra,
    };
    events.push(ev);
    return ev;
  };

  const firstEnd = 45 + 1 + rng.int(0, 2);
  const secondEnd = 90 + 2 + rng.int(0, 3);

  push('kickoff', 'home', 0, 1, { x: 0, y: 0 }, commentary(rng, 'kickoff', {}));

  const playMinute = (minute: number, half: 1 | 2) => {
    const pHome = home.mid / (home.mid + away.mid);
    const attacking = rng.chance(pHome) ? home : away;
    const defending = attacking === home ? away : home;
    stats.possession[attacking.side]++;
    const dir = dirOf(attacking.side);
    const teamName = attacking.team.club.name;

    // --- danger ---
    const ratio = Math.pow(attacking.att / defending.def, 1.4);
    const pChance = clamp(TUNING.baseChance * ratio * attacking.create * defending.concede, 0.02, 0.7);
    if (rng.chance(pChance)) {
      const shooterIdx = pickPlayer(rng, attacking, (p, role) => p.attrs.shot * ROLE_SHOT_W[role]);
      const shooter = attacking.players[shooterIdx];
      const creatorIdx = pickPlayer(rng, attacking, (p, role) => p.attrs.pass * ROLE_PASS_W[role], shooter.id);
      const creator = attacking.players[creatorIdx];
      const zone: ShotZone = (['box', 'edge', 'long'] as const)[rng.weighted([0.6, 0.3, 0.1])];
      const dist = zone === 'box' ? rng.range(0.04, 0.16) : zone === 'edge' ? rng.range(0.16, 0.27) : rng.range(0.27, 0.42);
      const spread = zone === 'box' ? 0.35 : zone === 'edge' ? 0.45 : 0.55;
      const pos: PitchPos = { x: dir * (1 - dist), y: rng.range(-spread, spread) };
      const from: PitchPos = { x: dir * (1 - dist - rng.range(0.15, 0.35)), y: clamp(pos.y + rng.range(-0.5, 0.5), -0.85, 0.85) };
      push('chance', attacking.side, minute, half, pos, commentary(rng, 'chance', { p: shooter.name, s: creator.name, t: teamName }), {
        playerId: shooter.id,
        secondaryId: creator.id,
        from,
      });
      stats.shots[attacking.side]++;

      if (rng.chance(TUNING.blockRate)) {
        const blockerIdx = pickPlayer(rng, defending, (p, role) => p.attrs.defense * (role === 'DEF' ? 3 : role === 'MID' ? 1 : 0.2));
        const blocker = defending.players[blockerIdx];
        push('block', attacking.side, minute, half, pos, commentary(rng, 'block', { p: shooter.name, s: blocker.name }), {
          playerId: shooter.id,
          secondaryId: blocker.id,
        });
        return;
      }
      const onTarget = clamp(TUNING.onTarget[zone] + (shooter.attrs.shot - 50) / 300, 0.1, 0.9);
      if (!rng.chance(onTarget)) {
        push('miss', attacking.side, minute, half, pos, commentary(rng, 'miss', { p: shooter.name }), { playerId: shooter.id });
        return;
      }
      stats.onTarget[attacking.side]++;
      const keeper = defending.players[0];
      const pGoal = clamp(TUNING.goalQuality[zone] * (1 + (shooter.attrs.shot - defending.gk) / 120), 0.05, 0.9);
      if (rng.chance(pGoal)) {
        score[attacking.side]++;
        push('goal', attacking.side, minute, half, pos, commentary(rng, 'goal', { p: shooter.name, s: creator.name, t: teamName }), {
          playerId: shooter.id,
          secondaryId: creator.id,
          from,
        });
      } else {
        push('save', attacking.side, minute, half, pos, commentary(rng, 'save', { p: shooter.name, s: keeper.name }), {
          playerId: shooter.id,
          secondaryId: keeper.id,
        });
      }
      return;
    }

    // --- fouls & cards (committed by the defending team) ---
    const pFoul = TUNING.foulRate * STYLE_MODS[defending.team.tactics.style].fouls;
    if (rng.chance(pFoul)) {
      const foulerIdx = pickPlayer(rng, defending, (_p, role) => (role === 'DEF' ? 2 : role === 'MID' ? 1.5 : 0.6));
      const fouler = defending.players[foulerIdx];
      const fouledIdx = pickPlayer(rng, attacking, (p) => p.attrs.speed);
      const fouled = attacking.players[fouledIdx];
      const pos: PitchPos = { x: dir * rng.range(-0.3, 0.75), y: rng.range(-0.8, 0.8) };
      defending.fouls++;
      stats.fouls[defending.side]++;
      push('foul', defending.side, minute, half, pos, commentary(rng, 'foul', { p: fouler.name, s: fouled.name }), {
        playerId: fouler.id,
        secondaryId: fouled.id,
      });
      const r = rng.next();
      if (r < TUNING.redPerFoul) {
        sendOff(defending, foulerIdx, minute, half, pos);
      } else if (r < TUNING.redPerFoul + TUNING.yellowPerFoul) {
        stats.cards[defending.side]++;
        if (defending.yellows.has(fouler.id)) {
          push('yellow', defending.side, minute, half, pos, 'Segundo amarelo!', { playerId: fouler.id });
          sendOff(defending, foulerIdx, minute, half, pos);
        } else {
          defending.yellows.add(fouler.id);
          push('yellow', defending.side, minute, half, pos, commentary(rng, 'yellow', { p: fouler.name }), { playerId: fouler.id });
        }
      }
    }
  };

  const sendOff = (s: TeamState, idx: number, minute: number, half: 1 | 2, pos: PitchPos) => {
    s.active[idx] = false;
    s.reds++;
    stats.cards[s.side]++;
    computeStrength(s);
    push('red', s.side, minute, half, pos, commentary(rng, 'red', { p: s.players[idx].name, t: s.team.club.name }), {
      playerId: s.players[idx].id,
    });
  };

  for (let m = 1; m <= firstEnd; m++) playMinute(m, 1);
  push('halftime', 'home', firstEnd, 1, { x: 0, y: 0 }, commentary(rng, 'halftime', {}));
  for (let m = 46; m <= secondEnd; m++) playMinute(m, 2);
  push('fulltime', 'home', secondEnd, 2, { x: 0, y: 0 }, commentary(rng, 'fulltime', {}));

  const totalPoss = stats.possession.home + stats.possession.away;
  const homePct = Math.round((stats.possession.home / totalPoss) * 100);
  stats.possession = { home: homePct, away: 100 - homePct };

  return {
    seed: numericSeed,
    home: homeTeam,
    away: awayTeam,
    events,
    score,
    stats,
    halves: { firstEnd, secondEnd },
  };
}

export { labelMinute };
