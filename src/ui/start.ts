import type { MatchResult, Side } from '../engine/types';
import { STYLE_LABEL } from '../engine/formations';
import { crestDataUrl } from './crest';
import { goToSeed } from '../seed';

/** Pre-match card. The tap also unlocks audio on iOS. */
export function showStartCard(parent: HTMLElement, result: MatchResult, seed: string, onStart: () => void): () => void {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  const team = (side: Side) => {
    const c = result[side].club;
    const t = result[side].tactics;
    return `<div class="start-team"><img class="crest big" src="${crestDataUrl(c.crest, c.colors, 128)}" alt=""><div class="start-name">${c.name}</div><div class="start-city">${c.cityName} · ${c.stateUf}</div><div class="start-tac">${t.formation} · ${STYLE_LABEL[t.style]}</div></div>`;
  };
  overlay.innerHTML = `
    <div class="card start-card">
      <div class="kicker">AMISTOSO · PROTÓTIPO</div>
      <div class="start-teams">${team('home')}<div class="vs">×</div>${team('away')}</div>
      <button class="btn btn-yellow btn-big" id="start-btn">▶ Assistir ao jogo</button>
      <div class="seed-row"><label for="seed-input">seed</label><input id="seed-input" value="${seed}" spellcheck="false"><button class="btn" id="seed-btn">ir</button></div>
      <div class="fine">Mesma seed, mesmo jogo. Compartilhe o link para todo mundo ver a mesma partida.</div>
    </div>`;
  parent.appendChild(overlay);
  overlay.querySelector<HTMLButtonElement>('#start-btn')!.addEventListener('click', () => {
    overlay.remove();
    onStart();
  });
  const input = overlay.querySelector<HTMLInputElement>('#seed-input')!;
  const go = () => goToSeed(input.value.trim() || 'varzea');
  overlay.querySelector<HTMLButtonElement>('#seed-btn')!.addEventListener('click', go);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') go();
  });
  return () => overlay.remove();
}
