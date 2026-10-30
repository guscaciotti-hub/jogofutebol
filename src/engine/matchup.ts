import { clubInfo, generateClub, pickLineup, type CityRef } from './generate';
import { DEFAULT_TACTICS } from './formations';
import type { Club, MatchTeam, Tactics } from './types';

/** Builds a MatchTeam from a full club (lineup chosen for the formation). */
export function toMatchTeam(club: Club, tactics: Tactics = DEFAULT_TACTICS, supporters = 0): MatchTeam {
  return { club: clubInfo(club), lineup: pickLineup(club.players, tactics.formation), tactics, supporters };
}

/** Convenience for NPC vs NPC: generates both clubs on the fly. */
export function npcMatchTeam(city: CityRef, slot: number, tactics: Tactics = DEFAULT_TACTICS): MatchTeam {
  return toMatchTeam(generateClub(city, slot), tactics);
}
