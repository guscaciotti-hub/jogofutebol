export type Position = 'GK' | 'DEF' | 'MID' | 'ATT';

export interface Attributes {
  speed: number; // 1..99
  pass: number;
  shot: number;
  defense: number;
  goalkeeping: number;
}

export interface Player {
  id: string;
  name: string; // display name (NPC: "Nome Sobrenome"; human: "@handle")
  handle?: string; // instagram handle without @, humans only
  isHuman: boolean;
  position: Position;
  attrs: Attributes;
}

export type Formation = '4-4-2' | '4-3-3' | '3-5-2';
export type Style = 'retranca' | 'equilibrado' | 'pressao';

export interface Tactics {
  formation: Formation;
  style: Style;
}

export type CrestShape = 'shield' | 'circle' | 'diamond' | 'hex';
export type CrestIcon = 'star' | 'ball' | 'bolt' | 'sun' | 'wave' | 'tree' | 'bird' | 'anchor';

export interface Crest {
  shape: CrestShape;
  icon: CrestIcon;
  split: 'solid' | 'half' | 'stripes' | 'band';
}

export interface Club {
  id: string;
  name: string;
  shortName: string; // up to 3 letters for scoreboard
  cityId: number;
  cityName: string;
  stateUf: string;
  colors: [string, string]; // hex, primary + secondary
  crest: Crest;
  isNpc: boolean;
  players: Player[]; // full roster (16)
}

/** Reduced club info embedded into match results (no roster). */
export type ClubInfo = Omit<Club, 'players'>;

export interface MatchTeam {
  club: ClubInfo;
  lineup: Player[]; // exactly 11, index 0 is GK
  tactics: Tactics;
  /** number of human members watching (0..n). Gives a small capped bonus. */
  supporters?: number;
}

export type Side = 'home' | 'away';

export type MatchEventType =
  | 'kickoff'
  | 'chance'
  | 'goal'
  | 'save'
  | 'miss'
  | 'block'
  | 'foul'
  | 'yellow'
  | 'red'
  | 'halftime'
  | 'fulltime';

/** Normalized pitch coordinates. x: -1 (home goal) .. +1 (away goal). y: -1 .. +1 across width. */
export interface PitchPos {
  x: number;
  y: number;
}

export interface MatchEvent {
  /** sequential id inside the match */
  id: number;
  minute: number; // 1..90+ (continuous, see `half` for stoppage display)
  half: 1 | 2;
  /** ordering key inside the same minute */
  order: number;
  type: MatchEventType;
  team: Side;
  /** main actor (shooter, fouler, carded player) */
  playerId?: string;
  /** secondary actor (assist, goalkeeper on save, blocking defender, fouled player) */
  secondaryId?: string;
  pos: PitchPos;
  /** for 'chance': where the buildup pass came from */
  from?: PitchPos;
  text: string;
  score: { home: number; away: number };
}

export interface MatchStats {
  possession: { home: number; away: number }; // percentages, sum 100
  shots: { home: number; away: number };
  onTarget: { home: number; away: number };
  fouls: { home: number; away: number };
  cards: { home: number; away: number };
}

export interface MatchResult {
  seed: number;
  home: MatchTeam;
  away: MatchTeam;
  events: MatchEvent[];
  score: { home: number; away: number };
  stats: MatchStats;
  /** last minute played in each half (45+x / 90+x) */
  halves: { firstEnd: number; secondEnd: number };
}
