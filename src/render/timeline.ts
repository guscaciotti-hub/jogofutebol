/**
 * Replay timeline: turns a MatchResult into a seekable, deterministic function of time.
 * No Three.js here — this module is pure so it can be unit-tested and reused by the HyperFrames
 * video renderer (any frame can be computed from `t` alone).
 *
 * Coordinates: pitch-normalized x in [-1, 1] (home goal at -1, away goal at +1), y in [-1, 1],
 * z in metres (ball height / jump).
 */
import { FORMATIONS } from '../engine/formations';
import { createRng, clamp, combineSeed } from '../engine/rng';
import type { MatchEvent, MatchResult, Side } from '../engine/types';

export interface BallKey {
  t: number;
  x: number;
  y: number;
  z: number;
  /** arc peak height added with a sine bump between this key and the next */
  arc?: number;
  /** if true, jump instantly to the next key (cut) */
  cut?: boolean;
}

export type SegmentKind = 'kickoff' | 'play' | 'chance' | 'goal' | 'card' | 'halftime' | 'fulltime';

export interface Segment {
  kind: SegmentKind;
  start: number;
  end: number;
  minuteStart: number;
  minuteEnd: number;
  half: 1 | 2;
  side: Side;
  /** events shown in this segment (chance + outcome, foul + card...) */
  events: MatchEvent[];
  /** timing marks inside the segment (absolute seconds) */
  marks: { pass1?: number; pass2?: number; shot?: number; impact?: number; celebrate?: number; reset?: number };
}

export interface PlayerState {
  side: Side;
  index: number; // lineup index (0 = GK)
  x: number;
  y: number;
  z: number; // jump height (m)
  /** facing angle in pitch plane (radians; 0 = +x) */
  facing: number;
  speed: number; // 0..1 run intensity for leg animation
  active: boolean; // false after red card
  hasBall: boolean;
}

export interface ReplayState {
  t: number;
  minute: number;
  half: 1 | 2;
  score: { home: number; away: number };
  ball: { x: number; y: number; z: number };
  /** what the camera should look at (the scorer while celebrating, the ball otherwise) */
  focus: { x: number; y: number };
  players: PlayerState[]; // 22, home 0..10 then away 11..21
  segment: Segment;
  /** 0..1 fraction inside the segment */
  u: number;
  zoom: number; // camera zoom factor (1 = wide, <1 = closer)
  celebrating?: Side;
  ended: boolean;
}

export interface Replay {
  duration: number;
  segments: Segment[];
  ballKeys: BallKey[];
  result: MatchResult;
  /** absolute times at which each event becomes "current" (for HUD / sound triggers) */
  eventTimes: Map<number, number>;
}

export interface ReplayOptions {
  /** desired total duration in seconds (approximate). Default 180. */
  targetDuration?: number;
}

const D = {
  kickoff: 2.0,
  goal: 11.0,
  chance: 7.0,
  card: 4.5,
  halftime: 3.0,
  fulltime: 3.0,
  play: 0,
  minFillerPerMinute: 0.22,
  maxFillerPerMinute: 1.4,
};

const GOAL_HALF_WIDTH = 3.66 / 34; // normalized y

function dirOf(side: Side): number {
  return side === 'home' ? 1 : -1;
}

/** Group raw events into displayable moments. */
function groupEvents(events: MatchEvent[]): { kind: SegmentKind; events: MatchEvent[] }[] {
  const groups: { kind: SegmentKind; events: MatchEvent[] }[] = [];
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    switch (e.type) {
      case 'kickoff':
        groups.push({ kind: 'kickoff', events: [e] });
        break;
      case 'halftime':
        groups.push({ kind: 'halftime', events: [e] });
        break;
      case 'fulltime':
        groups.push({ kind: 'fulltime', events: [e] });
        break;
      case 'chance': {
        const outcome = events[i + 1];
        const isGoal = outcome?.type === 'goal';
        groups.push({ kind: isGoal ? 'goal' : 'chance', events: [e, outcome] });
        i++;
        break;
      }
      case 'foul': {
        const next = events[i + 1];
        if (next && (next.type === 'yellow' || next.type === 'red') && next.minute === e.minute) {
          const evs = [e, next];
          i++;
          // second yellow followed by red
          const after = events[i + 1];
          if (after && after.type === 'red' && after.minute === e.minute && after.playerId === next.playerId) {
            evs.push(after);
            i++;
          }
          groups.push({ kind: 'card', events: evs });
        }
        // plain fouls are not shown in the replay
        break;
      }
      default:
        break; // stray outcome/card events already consumed
    }
  }
  return groups;
}

export function buildReplay(result: MatchResult, opts: ReplayOptions = {}): Replay {
  const target = opts.targetDuration ?? 180;
  const rng = createRng(combineSeed(result.seed, 'replay'));
  const groups = groupEvents(result.events);

  // --- time allocation ---
  let keyTotal = 0;
  let gapMinutes = 0;
  let lastMinute = 0;
  for (const g of groups) {
    keyTotal += D[g.kind];
    const m = g.events[0].minute;
    gapMinutes += Math.max(0, m - lastMinute);
    lastMinute = m;
  }
  const fillerPerMinute = clamp((target - keyTotal) / Math.max(1, gapMinutes), D.minFillerPerMinute, D.maxFillerPerMinute);

  const segments: Segment[] = [];
  const ballKeys: BallKey[] = [];
  const eventTimes = new Map<number, number>();
  let t = 0;
  let minute = 0;
  let half: 1 | 2 = 1;
  let ball = { x: 0, y: 0 };
  let possession: Side = 'home';

  const key = (k: Omit<BallKey, 't'> & { t?: number }) => {
    const bk: BallKey = { t: k.t ?? t, x: k.x, y: k.y, z: k.z, arc: k.arc, cut: k.cut };
    ballKeys.push(bk);
    ball = { x: bk.x, y: bk.y };
    return bk;
  };

  key({ x: 0, y: 0, z: 0 });

  const filler = (toMinute: number, toHalf: 1 | 2) => {
    const minutes = Math.max(0, toMinute - minute);
    if (minutes <= 0) return;
    const dur = minutes * fillerPerMinute;
    const seg: Segment = {
      kind: 'play',
      start: t,
      end: t + dur,
      minuteStart: minute,
      minuteEnd: toMinute,
      half: toHalf,
      side: possession,
      events: [],
      marks: {},
    };
    // ball wanders around midfield with keys every ~2.5s; possession flips now and then
    let tt = t;
    while (tt + 1.2 < t + dur) {
      const step = rng.range(1.8, 3.2);
      tt = Math.min(tt + step, t + dur);
      if (rng.chance(0.35)) possession = possession === 'home' ? 'away' : 'home';
      const dir = dirOf(possession);
      const nx = clamp(ball.x + dir * rng.range(-0.1, 0.35), -0.6, 0.6);
      const ny = clamp(ball.y + rng.range(-0.45, 0.45), -0.75, 0.75);
      key({ t: tt, x: nx, y: ny, z: 0, arc: rng.chance(0.3) ? rng.range(0.6, 1.8) : 0 });
    }
    t += dur;
    minute = toMinute;
    segments.push(seg);
  };

  for (const g of groups) {
    const first = g.events[0];
    const side = first.team;
    const dir = dirOf(side);
    if (g.kind !== 'kickoff') filler(first.minute, first.half);
    half = first.half;
    const start = t;
    const dur = D[g.kind];
    const seg: Segment = {
      kind: g.kind,
      start,
      end: start + dur,
      minuteStart: first.minute,
      minuteEnd: first.minute,
      half,
      side,
      events: g.events,
      marks: {},
    };
    for (const e of g.events) eventTimes.set(e.id, start);

    switch (g.kind) {
      case 'kickoff': {
        key({ t: start, x: 0, y: 0, z: 0 });
        key({ t: start + dur, x: 0, y: 0, z: 0 });
        possession = 'home';
        break;
      }
      case 'halftime': {
        key({ t: start, x: ball.x, y: ball.y, z: 0, cut: true });
        key({ t: start + 0.01, x: 0, y: 0, z: 0 });
        key({ t: start + dur, x: 0, y: 0, z: 0 });
        possession = 'away';
        half = 2;
        break;
      }
      case 'fulltime': {
        key({ t: start, x: ball.x, y: ball.y, z: 0 });
        key({ t: start + dur, x: ball.x, y: ball.y, z: 0 });
        break;
      }
      case 'card': {
        const foul = g.events[0];
        const red = g.events.some((e) => e.type === 'red');
        key({ t: start, x: ball.x, y: ball.y, z: 0 });
        key({ t: start + 1.0, x: foul.pos.x, y: foul.pos.y, z: 0 });
        key({ t: start + dur - 0.3, x: foul.pos.x, y: foul.pos.y, z: 0 });
        seg.marks.impact = start + 1.0;
        seg.marks.celebrate = start + 1.6; // card shown
        eventTimes.set(g.events[1].id, start + 1.6);
        if (red && g.events[2]) eventTimes.set(g.events[2].id, start + 1.6);
        // free kick: ball goes forward for the fouled team
        possession = foul.team === 'home' ? 'away' : 'home';
        key({ t: start + dur, x: clamp(foul.pos.x + dirOf(possession) * 0.25, -0.7, 0.7), y: foul.pos.y * 0.6, z: 0, arc: 1.5 });
        break;
      }
      case 'chance':
      case 'goal': {
        const chance = g.events[0];
        const outcome = g.events[1];
        const from = chance.from ?? { x: chance.pos.x - dir * 0.25, y: chance.pos.y * 0.5 };
        const pos = chance.pos;
        possession = side;
        // buildup
        const p1 = start + 1.2;
        const p2 = start + 2.6;
        const settle = start + 3.5;
        const shot = start + 4.0;
        seg.marks.pass1 = p1;
        seg.marks.pass2 = p2;
        seg.marks.shot = shot;
        key({ t: start, x: ball.x, y: ball.y, z: 0 });
        const d1 = Math.hypot((from.x - ball.x) * 52.5, (from.y - ball.y) * 34);
        key({ t: p1, x: from.x, y: from.y, z: 0, arc: d1 > 18 ? 2.0 : 0 });
        // carry a few metres
        key({ t: p1 + 0.9, x: from.x + dir * 0.04, y: from.y, z: 0 });
        const d2 = Math.hypot((pos.x - from.x) * 52.5, (pos.y - from.y) * 34);
        key({ t: p2, x: pos.x, y: pos.y, z: 0, arc: d2 > 20 ? 1.6 : 0 });
        key({ t: settle, x: pos.x + dir * 0.01, y: pos.y, z: 0 });
        key({ t: shot, x: pos.x + dir * 0.015, y: pos.y, z: 0 });
        // flight
        const goalX = dir * 1.0;
        const goalY = clamp(rng.gauss(0, 0.06), -GOAL_HALF_WIDTH * 0.9, GOAL_HALF_WIDTH * 0.9);
        const distM = Math.hypot((goalX - pos.x) * 52.5, (goalY - pos.y) * 34);
        const flight = clamp(distM / 24, 0.35, 1.1);
        const impact = shot + flight;
        seg.marks.impact = impact;
        eventTimes.set(outcome.id, impact);
        switch (outcome.type) {
          case 'goal': {
            const high = rng.chance(0.4);
            key({ t: impact, x: goalX, y: goalY, z: high ? 1.9 : 0.3, arc: high ? 0.4 : 0.6 });
            key({ t: impact + 0.25, x: goalX + dir * 0.035, y: goalY * 0.9, z: 0.2 });
            seg.marks.celebrate = impact + 0.4;
            seg.marks.reset = start + dur - 0.4;
            key({ t: start + dur - 0.4, x: goalX + dir * 0.035, y: goalY * 0.9, z: 0, cut: true });
            key({ t: start + dur - 0.39, x: 0, y: 0, z: 0 });
            key({ t: start + dur, x: 0, y: 0, z: 0 });
            possession = side === 'home' ? 'away' : 'home';
            break;
          }
          case 'save': {
            const kx = dir * 0.965;
            key({ t: impact, x: kx, y: goalY, z: rng.range(0.5, 1.6), arc: 0.8 });
            key({ t: impact + 1.0, x: kx, y: goalY, z: 0.4 });
            // keeper launches to midfield
            const outY = rng.pick([-0.55, 0.55]);
            key({ t: start + dur, x: dir * 0.2, y: outY, z: 0, arc: 3.0 });
            possession = side === 'home' ? 'away' : 'home';
            break;
          }
          case 'miss': {
            const over = rng.chance(0.4);
            const my = over ? goalY : (goalY >= 0 ? 1 : -1) * rng.range(GOAL_HALF_WIDTH + 0.05, GOAL_HALF_WIDTH + 0.25);
            key({ t: impact, x: dir * 1.08, y: my, z: over ? 3.2 : 0.8, arc: over ? 0.8 : 0.5 });
            key({ t: impact + 0.5, x: dir * 1.12, y: my, z: 0 });
            // goal kick
            key({ t: impact + 1.4, x: dir * 0.9, y: 0.18 * (my >= 0 ? 1 : -1), z: 0, cut: true });
            key({ t: start + dur, x: dir * 0.15, y: rng.range(-0.4, 0.4), z: 0, arc: 3.5 });
            possession = side === 'home' ? 'away' : 'home';
            break;
          }
          case 'block':
          default: {
            const bx = pos.x + (goalX - pos.x) * 0.3;
            const by = pos.y + (goalY - pos.y) * 0.3;
            key({ t: shot + flight * 0.3, x: bx, y: by, z: 0.6 });
            key({ t: shot + flight * 0.3 + 0.6, x: bx - dir * 0.12, y: clamp(by + rng.range(-0.3, 0.3), -0.8, 0.8), z: 0, arc: 1.2 });
            key({ t: start + dur, x: bx - dir * 0.2, y: ball.y, z: 0 });
            possession = rng.chance(0.5) ? side : side === 'home' ? 'away' : 'home';
            break;
          }
        }
        break;
      }
    }
    t = start + dur;
    segments.push(seg);
  }

  return { duration: t, segments, ballKeys, result, eventTimes };
}

// ---------------------------------------------------------------------------
// State sampling
// ---------------------------------------------------------------------------

function smooth(u: number): number {
  const x = clamp(u, 0, 1);
  return x * x * (3 - 2 * x);
}

function findIndex<T extends { start?: number; t?: number }>(arr: T[], t: number, keyOf: (v: T) => number): number {
  let lo = 0;
  let hi = arr.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (keyOf(arr[mid]) <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function ballAt(replay: Replay, t: number): { x: number; y: number; z: number } {
  const keys = replay.ballKeys;
  if (t <= keys[0].t) return { x: keys[0].x, y: keys[0].y, z: keys[0].z };
  const i = findIndex(keys, t, (k) => k.t);
  const a = keys[i];
  const b = keys[i + 1];
  if (!b) return { x: a.x, y: a.y, z: a.z };
  if (a.cut) return { x: b.x, y: b.y, z: b.z };
  const span = Math.max(1e-6, b.t - a.t);
  const u = clamp((t - a.t) / span, 0, 1);
  const arc = a.arc ? Math.sin(u * Math.PI) * a.arc : 0;
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z + (b.z - a.z) * u + arc };
}

function scoreAt(replay: Replay, t: number): { home: number; away: number } {
  let h = 0;
  let a = 0;
  for (const e of replay.result.events) {
    if (e.type !== 'goal') continue;
    const et = replay.eventTimes.get(e.id) ?? Infinity;
    if (et <= t) {
      if (e.team === 'home') h++;
      else a++;
    }
  }
  return { home: h, away: a };
}

function lineupIndexOf(replay: Replay, side: Side, playerId?: string): number {
  if (!playerId) return -1;
  const team = side === 'home' ? replay.result.home : replay.result.away;
  return team.lineup.findIndex((p) => p.id === playerId);
}

/** Lineup index of players sent off before time t (per side). */
function redsBefore(replay: Replay, t: number): { home: Set<number>; away: Set<number> } {
  const out = { home: new Set<number>(), away: new Set<number>() };
  for (const e of replay.result.events) {
    if (e.type !== 'red') continue;
    const et = replay.eventTimes.get(e.id) ?? Infinity;
    if (et <= t) out[e.team].add(lineupIndexOf(replay, e.team, e.playerId));
  }
  return out;
}


/** Player positions at time t (no facing/speed). */
function computePlayers(replay: Replay, t: number, seg: Segment, u: number, ball: { x: number; y: number; z: number }, reds: { home: Set<number>; away: Set<number> }): PlayerState[] {
  const players: PlayerState[] = [];
  const chance = seg.events.find((e) => e.type === 'chance');
  const outcome = seg.events[1];
  const foul = seg.events.find((e) => e.type === 'foul');
  const dirSeg = dirOf(seg.side);

  for (const side of ['home', 'away'] as Side[]) {
    const team = side === 'home' ? replay.result.home : replay.result.away;
    const slots = FORMATIONS[team.tactics.formation];
    const dir = dirOf(side);
    const defending = side !== seg.side;
    for (let i = 0; i < 11; i++) {
      const slot = slots[i].pos;
      const active = !reds[side].has(i);
      // formation base, mirrored for away, compacted toward the ball
      let bx = dir * slot.x;
      let by = slot.y;
      if (i === 0) {
        bx = dir * -0.93;
        by = clamp(ball.y * 0.3, -0.14, 0.14);
      } else {
        bx = clamp(bx * 0.88 + ball.x * 0.32 + dir * 0.03, -0.95, 0.95);
        by = clamp(by * 0.82 + ball.y * 0.3, -0.92, 0.92);
        // alive wobble
        const ph = i * 1.7 + (side === 'away' ? 3 : 0);
        bx += Math.sin(t * 0.9 + ph) * 0.012;
        by += Math.cos(t * 0.7 + ph * 1.3) * 0.015;
      }
      let x = bx;
      let y = by;
      let z = 0;
      let hasBall = false;

      // involvement overrides
      if ((seg.kind === 'chance' || seg.kind === 'goal') && chance) {
        const shooterIdx = lineupIndexOf(replay, seg.side, chance.playerId);
        const creatorIdx = lineupIndexOf(replay, seg.side, chance.secondaryId);
        const m = seg.marks;
        const from = chance.from ?? { x: chance.pos.x - dirSeg * 0.25, y: chance.pos.y * 0.5 };
        if (!defending && i === creatorIdx) {
          // creator meets the ball at pass1, carries, passes at pass2, then jogs forward
          const w = smooth((t - seg.start) / 1.2);
          const tx = from.x + dirSeg * 0.04 * smooth((t - m.pass1!) / 0.9) + dirSeg * 0.1 * smooth((t - m.pass2!) / 2);
          const ty = from.y - 0.02;
          x = bx + (tx - bx) * w;
          y = by + (ty - by) * w;
          hasBall = t >= m.pass1! && t < m.pass2!;
        } else if (!defending && i === shooterIdx) {
          const w = smooth((t - (seg.start + 0.6)) / 2.0);
          let tx = chance.pos.x - dirSeg * 0.015;
          let ty = chance.pos.y;
          if (outcome?.type === 'goal' && m.celebrate !== undefined && t >= m.celebrate) {
            // run to the corner to celebrate
            const cw = smooth((t - m.celebrate) / 2.2);
            const cornerY = -0.62; // far side (away from the camera), so the celebration stays on screen
            tx = tx + (dirSeg * 0.78 - tx) * cw;
            ty = ty + (cornerY - ty) * cw;
            z = Math.abs(Math.sin((t - m.celebrate) * 6)) * 0.35 * (1 - cw * 0.5);
          }
          x = bx + (tx - bx) * w;
          y = by + (ty - by) * w;
          hasBall = t >= m.pass2! && t < m.shot!;
        } else if (!defending && outcome?.type === 'goal' && m.celebrate !== undefined && t >= m.celebrate) {
          // teammates converge a bit and jump
          const cw = smooth((t - m.celebrate) / 2.5);
          const cornerY = -0.5;
          x = bx + (dirSeg * 0.6 - bx) * cw * 0.6;
          y = by + (cornerY - by) * cw * 0.5;
          z = Math.abs(Math.sin((t - m.celebrate) * 5 + i)) * 0.3;
        } else if (defending && i === 0) {
          // keeper tracks the ball, dives on save
          const kx = -dirSeg * 0.955;
          y = clamp(ball.y * 0.6, -GOAL_HALF_WIDTH * 1.4, GOAL_HALF_WIDTH * 1.4);
          x = kx;
          if (outcome?.type === 'save' && m.impact !== undefined && t >= m.impact - 0.15) {
            const dw = smooth((t - (m.impact - 0.15)) / 0.3);
            y = y + (ball.y - y) * dw;
            z = Math.sin(clamp((t - (m.impact - 0.15)) / 0.9, 0, 1) * Math.PI) * 0.6;
            hasBall = t >= m.impact;
          }
          if (outcome?.type === 'goal' && m.impact !== undefined && t >= m.impact - 0.1) {
            const dw = smooth((t - (m.impact - 0.1)) / 0.3);
            y = y + (-Math.sign(ball.y || 1) * 0.08 - y) * dw; // wrong way
            z = Math.sin(clamp((t - (m.impact - 0.1)) / 0.8, 0, 1) * Math.PI) * 0.5;
          }
        } else if (defending && outcome?.type === 'block' && lineupIndexOf(replay, side, outcome.secondaryId) === i) {
          const w = smooth((t - (seg.start + 1.0)) / 2.0);
          const tx = chance.pos.x + dirSeg * 0.06;
          const ty = chance.pos.y;
          x = bx + (tx - bx) * w;
          y = by + (ty - by) * w;
        } else if (defending && i !== 0 && slots[i].position === 'DEF') {
          // defenders retreat toward their box as the attack develops
          const w = smooth((t - seg.start) / 2.5) * (1 - smooth((t - (seg.end - 1.5)) / 1.5));
          x = bx + (-dirSeg * 0.72 - bx) * 0.5 * w;
          y = by + (chance.pos.y * 0.6 - by) * 0.35 * w;
        }
      } else if (seg.kind === 'card' && foul) {
        const foulerIdx = lineupIndexOf(replay, foul.team, foul.playerId);
        const fouledSide: Side = foul.team === 'home' ? 'away' : 'home';
        const fouledIdx = lineupIndexOf(replay, fouledSide, foul.secondaryId);
        const w = smooth((t - seg.start) / 1.0) * (1 - smooth((t - (seg.end - 0.8)) / 0.8));
        if (side === foul.team && i === foulerIdx) {
          x = bx + (foul.pos.x - 0.03 * dir - bx) * w;
          y = by + (foul.pos.y - by) * w;
        } else if (side === fouledSide && i === fouledIdx) {
          x = bx + (foul.pos.x + 0.02 * dir - bx) * w;
          y = by + (foul.pos.y + 0.03 - by) * w;
          // on the ground
          z = -0.5 * Math.sin(clamp((t - seg.start - 0.8) / (seg.end - seg.start - 1.5), 0, 1) * Math.PI);
        }
      }

      if (!active) {
        // sent-off player sits by the sideline
        x = dir * -0.55;
        y = -1.12;
        z = 0;
      }
      if (seg.kind === 'halftime' || seg.kind === 'fulltime') {
        // walk toward the tunnel side
        const w = smooth(u);
        x = x + (dir * -0.15 - x) * w * 0.3;
      }

      players.push({ side, index: i, x, y, z, facing: 0, speed: 0, active, hasBall });
    }
  }

  return players;
}

export function getReplayState(replay: Replay, time: number): ReplayState {
  const t = clamp(time, 0, replay.duration);
  const segIdx = findIndex(replay.segments, t, (s) => s.start);
  const seg = replay.segments[segIdx];
  const u = clamp((t - seg.start) / Math.max(1e-6, seg.end - seg.start), 0, 1);
  const minute = seg.kind === 'play' ? seg.minuteStart + (seg.minuteEnd - seg.minuteStart) * u : seg.minuteStart;
  const ball = ballAt(replay, t);
  const score = scoreAt(replay, t);
  const reds = redsBefore(replay, t);
  const ended = t >= replay.duration - 1e-6;

  const celebrating: Side | undefined =
    seg.kind === 'goal' && seg.marks.celebrate !== undefined && t >= seg.marks.celebrate && t < (seg.marks.reset ?? seg.end) ? seg.side : undefined;

  // --- zoom (camera) ---
  let zoom = 1;
  if (seg.kind === 'chance' || seg.kind === 'goal') {
    const inU = smooth((t - seg.start) / 1.5);
    const target = celebrating ? 0.62 : 0.78;
    const outU = seg.marks.reset !== undefined ? smooth((t - (seg.marks.reset - 0.8)) / 0.8) : smooth((t - (seg.end - 1.2)) / 1.2);
    zoom = 1 + (target - 1) * inU;
    zoom = zoom + (1 - zoom) * outU;
  } else if (seg.kind === 'card') {
    zoom = 1 + (0.8 - 1) * smooth((t - seg.start) / 1.2) * (1 - smooth((t - (seg.end - 1)) / 1));
  }

  const players = computePlayers(replay, t, seg, u, ball, reds);

  // facing & running intensity from a small finite difference
  const dt = 0.1;
  if (t + dt <= replay.duration) {
    const t2 = t + dt;
    const seg2 = replay.segments[findIndex(replay.segments, t2, (s) => s.start)];
    const u2 = clamp((t2 - seg2.start) / Math.max(1e-6, seg2.end - seg2.start), 0, 1);
    const next = computePlayers(replay, t2, seg2, u2, ballAt(replay, t2), redsBefore(replay, t2));
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const n = next[i];
      const dx = (n.x - p.x) * 52.5;
      const dy = (n.y - p.y) * 34;
      const sp = Math.hypot(dx, dy) / dt; // m/s
      p.speed = clamp(sp / 7, 0, 1);
      if (sp > 0.4) p.facing = Math.atan2(dy, dx);
      else p.facing = Math.atan2((ball.y - p.y) * 34, (ball.x - p.x) * 52.5);
    }
  }

  let focus = { x: ball.x, y: ball.y };
  if (celebrating) {
    const chanceEv = seg.events[0];
    const idx = lineupIndexOf(replay, seg.side, chanceEv.playerId);
    if (idx >= 0) {
      const p = players[(seg.side === 'home' ? 0 : 11) + idx];
      focus = { x: p.x, y: p.y };
    }
  }

  return {
    t,
    minute,
    half: seg.half,
    score,
    ball,
    focus,
    players,
    segment: seg,
    u,
    zoom,
    celebrating,
    ended,
  };
}

/** Human-readable clock for the HUD. */
export function formatClock(minute: number, half: 1 | 2): string {
  const m = Math.floor(minute);
  if (half === 1 && m > 45) return `45+${m - 45}'`;
  if (half === 2 && m > 90) return `90+${m - 90}'`;
  return `${m}'`;
}
