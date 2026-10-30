import type { Formation, PitchPos, Position, Style, Tactics } from './types';

export interface FormationSlot {
  position: Position;
  /** base position for the HOME side (attacking +x). Away is mirrored. */
  pos: PitchPos;
}

const GK: FormationSlot = { position: 'GK', pos: { x: -0.93, y: 0 } };
const DEF4: FormationSlot[] = [
  { position: 'DEF', pos: { x: -0.62, y: -0.62 } },
  { position: 'DEF', pos: { x: -0.7, y: -0.22 } },
  { position: 'DEF', pos: { x: -0.7, y: 0.22 } },
  { position: 'DEF', pos: { x: -0.62, y: 0.62 } },
];
const DEF3: FormationSlot[] = [
  { position: 'DEF', pos: { x: -0.66, y: -0.42 } },
  { position: 'DEF', pos: { x: -0.72, y: 0 } },
  { position: 'DEF', pos: { x: -0.66, y: 0.42 } },
];

export const FORMATIONS: Record<Formation, FormationSlot[]> = {
  '4-4-2': [
    GK,
    ...DEF4,
    { position: 'MID', pos: { x: -0.22, y: -0.68 } },
    { position: 'MID', pos: { x: -0.3, y: -0.22 } },
    { position: 'MID', pos: { x: -0.3, y: 0.22 } },
    { position: 'MID', pos: { x: -0.22, y: 0.68 } },
    { position: 'ATT', pos: { x: 0.18, y: -0.25 } },
    { position: 'ATT', pos: { x: 0.18, y: 0.25 } },
  ],
  '4-3-3': [
    GK,
    ...DEF4,
    { position: 'MID', pos: { x: -0.28, y: -0.42 } },
    { position: 'MID', pos: { x: -0.36, y: 0 } },
    { position: 'MID', pos: { x: -0.28, y: 0.42 } },
    { position: 'ATT', pos: { x: 0.14, y: -0.62 } },
    { position: 'ATT', pos: { x: 0.26, y: 0 } },
    { position: 'ATT', pos: { x: 0.14, y: 0.62 } },
  ],
  '3-5-2': [
    GK,
    ...DEF3,
    { position: 'MID', pos: { x: -0.26, y: -0.78 } },
    { position: 'MID', pos: { x: -0.34, y: -0.32 } },
    { position: 'MID', pos: { x: -0.42, y: 0 } },
    { position: 'MID', pos: { x: -0.34, y: 0.32 } },
    { position: 'MID', pos: { x: -0.26, y: 0.78 } },
    { position: 'ATT', pos: { x: 0.18, y: -0.25 } },
    { position: 'ATT', pos: { x: 0.18, y: 0.25 } },
  ],
};

export const FORMATION_LIST: Formation[] = ['4-4-2', '4-3-3', '3-5-2'];
export const STYLE_LIST: Style[] = ['retranca', 'equilibrado', 'pressao'];

export const DEFAULT_TACTICS: Tactics = { formation: '4-4-2', style: 'equilibrado' };

/** Multipliers applied to team strength by formation. */
export const FORMATION_MODS: Record<Formation, { mid: number; att: number; def: number }> = {
  '4-4-2': { mid: 1.0, att: 1.0, def: 1.0 },
  '4-3-3': { mid: 0.98, att: 1.05, def: 0.96 },
  '3-5-2': { mid: 1.05, att: 1.0, def: 0.95 },
};

/** Multipliers applied by style: own chance creation, opponent chance creation, midfield. */
export const STYLE_MODS: Record<Style, { create: number; concede: number; mid: number; fouls: number }> = {
  retranca: { create: 0.78, concede: 0.82, mid: 0.96, fouls: 1.1 },
  equilibrado: { create: 1.0, concede: 1.0, mid: 1.0, fouls: 1.0 },
  pressao: { create: 1.18, concede: 1.16, mid: 1.07, fouls: 1.2 },
};

export const STYLE_LABEL: Record<Style, string> = {
  retranca: 'Retranca',
  equilibrado: 'Equilibrado',
  pressao: 'Pressão',
};
