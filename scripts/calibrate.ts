/**
 * Calibration harness: simulates N matches between random NPC clubs and prints the realism stats.
 * Run: npm run calibrate
 */
import { createRng } from '../src/engine/rng';
import { generateClub, type CityRef } from '../src/engine/generate';
import { toMatchTeam } from '../src/engine/matchup';
import { simulateMatch } from '../src/engine/simulate';
import { FORMATION_LIST, STYLE_LIST } from '../src/engine/formations';

const N = Number(process.argv[2] ?? 10000);
const rng = createRng('calibrate');
let goals = 0, hw = 0, d = 0, aw = 0, shots = 0, onT = 0, cards = 0, reds = 0, fouls = 0;
const t0 = performance.now();
for (let i = 0; i < N; i++) {
  const cityA: CityRef = { id: 1000 + rng.int(0, 5000), name: 'Cidade A', uf: 'XX' };
  const cityB: CityRef = { id: 1000 + rng.int(0, 5000), name: 'Cidade B', uf: 'XX' };
  const tac = () => ({ formation: rng.pick(FORMATION_LIST), style: rng.pick(STYLE_LIST) });
  const home = toMatchTeam(generateClub(cityA, rng.int(0, 3)), tac());
  const away = toMatchTeam(generateClub(cityB, rng.int(0, 3)), tac());
  const r = simulateMatch(i, home, away);
  goals += r.score.home + r.score.away;
  if (r.score.home > r.score.away) hw++;
  else if (r.score.home === r.score.away) d++;
  else aw++;
  shots += r.stats.shots.home + r.stats.shots.away;
  onT += r.stats.onTarget.home + r.stats.onTarget.away;
  cards += r.stats.cards.home + r.stats.cards.away;
  fouls += r.stats.fouls.home + r.stats.fouls.away;
  reds += r.events.filter((e) => e.type === 'red').length;
}
const ms = performance.now() - t0;
console.log({
  matches: N,
  avgGoals: +(goals / N).toFixed(2),
  homeWin: +(hw / N).toFixed(3),
  draw: +(d / N).toFixed(3),
  awayWin: +(aw / N).toFixed(3),
  shotsPerMatch: +(shots / N).toFixed(1),
  onTargetPerMatch: +(onT / N).toFixed(1),
  foulsPerMatch: +(fouls / N).toFixed(1),
  cardsPerMatch: +(cards / N).toFixed(2),
  redsPerMatch: +(reds / N).toFixed(3),
  msPerMatch: +(ms / N).toFixed(3),
});
