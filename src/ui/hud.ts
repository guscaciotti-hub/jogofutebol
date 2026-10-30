import { gsap } from 'gsap';
import type { MatchEvent, MatchResult, Side } from '../engine/types';
import { formatClock, type ReplayState } from '../render/timeline';
import { crestDataUrl } from './crest';

export interface HudCallbacks {
  onToggle(): void;
  onSpeed(speed: number): void;
  onMute(muted: boolean): void;
  onNewMatch(): void;
  onTags(visible: boolean): void;
  onSeek(t: number): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export class Hud {
  root: HTMLElement;
  private score = { home: el('span', 'score', '0'), away: el('span', 'score', '0') };
  private clock = el('span', 'clock', "0'");
  private ticker = el('div', 'ticker');
  private banner = el('div', 'banner');
  private playBtn = el('button', 'btn btn-yellow', '▶');
  private speedBtn = el('button', 'btn', '1x');
  private muteBtn = el('button', 'btn', '🔊');
  private tagsBtn = el('button', 'btn', '🏷️');
  private progress = el('div', 'progress');
  private progressFill = el('div', 'progress-fill');
  private quality = el('div', 'quality-note', 'modo leve ativado');
  private speed = 1;
  private muted = false;
  private tags = true;
  private duration = 1;
  private playerNames = new Map<string, string>();

  constructor(parent: HTMLElement, private result: MatchResult, cb: HudCallbacks) {
    this.root = el('div', 'hud');
    parent.appendChild(this.root);
    for (const side of ['home', 'away'] as Side[]) {
      for (const p of result[side].lineup) this.playerNames.set(p.id, p.isHuman ? `@${p.handle ?? p.name}` : p.name);
    }

    const bar = el('div', 'scoreboard card');
    const team = (side: Side) => {
      const c = result[side].club;
      const wrap = el('div', `team ${side}`);
      const img = el('img', 'crest');
      img.src = crestDataUrl(c.crest, c.colors, 96);
      img.alt = c.name;
      const name = el('div', 'team-name', `<strong>${c.shortName}</strong><small>${c.cityName}</small>`);
      wrap.append(img, name);
      return wrap;
    };
    const mid = el('div', 'mid');
    mid.append(this.score.home, this.clock, this.score.away);
    bar.append(team('home'), mid, team('away'));
    this.root.append(bar);

    this.banner.style.opacity = '0';
    this.root.append(this.banner);
    const bottom = el('div', 'bottom');

    const controls = el('div', 'controls card');
    this.progress.append(this.progressFill);
    this.progress.addEventListener('pointerdown', (ev) => {
      const r = this.progress.getBoundingClientRect();
      const u = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
      cb.onSeek(u * this.duration);
    });
    const row = el('div', 'row');
    this.playBtn.addEventListener('click', () => cb.onToggle());
    this.speedBtn.addEventListener('click', () => {
      this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 4 : 1;
      this.speedBtn.textContent = `${this.speed}x`;
      cb.onSpeed(this.speed);
    });
    this.muteBtn.addEventListener('click', () => {
      this.muted = !this.muted;
      this.muteBtn.textContent = this.muted ? '🔇' : '🔊';
      cb.onMute(this.muted);
    });
    this.tagsBtn.addEventListener('click', () => {
      this.tags = !this.tags;
      this.tagsBtn.style.opacity = this.tags ? '1' : '0.5';
      cb.onTags(this.tags);
    });
    const newBtn = el('button', 'btn', '🎲 nova');
    newBtn.addEventListener('click', () => cb.onNewMatch());
    row.append(this.playBtn, this.speedBtn, this.muteBtn, this.tagsBtn, newBtn);
    controls.append(this.progress, row);
    bottom.append(this.ticker, controls);
    this.root.append(bottom);
    this.quality.style.display = 'none';
    this.root.append(this.quality);
  }

  setDuration(d: number): void {
    this.duration = d;
  }

  setPlaying(p: boolean): void {
    this.playBtn.textContent = p ? '❚❚' : '▶';
  }

  showQualityNote(): void {
    this.quality.style.display = 'block';
    gsap.fromTo(this.quality, { opacity: 0 }, { opacity: 1, duration: 0.3, yoyo: true, repeat: 1, repeatDelay: 2.5 });
  }

  tick(st: ReplayState): void {
    this.clock.textContent = st.segment.kind === 'fulltime' ? 'FIM' : st.segment.kind === 'halftime' ? 'INT' : formatClock(st.minute, st.half);
    this.progressFill.style.width = `${(st.t / this.duration) * 100}%`;
  }

  private name(id?: string): string {
    return id ? this.playerNames.get(id) ?? '' : '';
  }

  private pop(elm: HTMLElement): void {
    gsap.fromTo(elm, { scale: 1.6 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' });
  }

  private showBanner(html: string, cls: string, seconds: number): void {
    this.banner.className = `banner ${cls}`;
    this.banner.innerHTML = html;
    gsap.killTweensOf(this.banner);
    gsap.fromTo(
      this.banner,
      { opacity: 0, y: 30, scale: 0.8 },
      { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'back.out(2)' },
    );
    gsap.to(this.banner, { opacity: 0, y: -20, duration: 0.4, delay: seconds, ease: 'power2.in' });
  }

  private setTicker(text: string): void {
    this.ticker.textContent = text;
    gsap.fromTo(this.ticker, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3 });
  }

  onEvent(ev: MatchEvent, st: ReplayState): void {
    const club = this.result[ev.team].club;
    switch (ev.type) {
      case 'goal': {
        this.score[ev.team].textContent = String(st.score[ev.team] + (st.score[ev.team] < ev.score[ev.team] ? 1 : 0));
        this.score.home.textContent = String(ev.score.home);
        this.score.away.textContent = String(ev.score.away);
        this.pop(this.score[ev.team]);
        this.showBanner(
          `<div class="big">GOL!</div><div class="who">${this.name(ev.playerId)}</div><div class="sub">${club.name} · assistência de ${this.name(ev.secondaryId)}</div>`,
          'goal',
          3.6,
        );
        this.setTicker(ev.text);
        break;
      }
      case 'yellow':
        this.showBanner(`<div class="cardicon yellow"></div><div class="who">${this.name(ev.playerId)}</div>`, 'card', 1.8);
        this.setTicker(ev.text);
        break;
      case 'red':
        this.showBanner(`<div class="cardicon red"></div><div class="who">${this.name(ev.playerId)}</div><div class="sub">expulso</div>`, 'card', 2.4);
        this.setTicker(ev.text);
        break;
      case 'halftime':
        this.showBanner(`<div class="big small">INTERVALO</div><div class="sub">${this.statsLine()}</div>`, 'info', 2.4);
        this.setTicker(ev.text);
        break;
      case 'fulltime':
        this.showBanner(`<div class="big small">FIM DE JOGO</div><div class="who">${ev.score.home} × ${ev.score.away}</div><div class="sub">${this.statsLine()}</div>`, 'info', 6);
        this.setTicker(ev.text);
        break;
      case 'kickoff':
        this.setTicker(ev.text);
        break;
      case 'foul':
        break;
      default:
        this.setTicker(ev.text);
    }
  }

  private statsLine(): string {
    const s = this.result.stats;
    return `posse ${s.possession.home}% · ${s.possession.away}% &nbsp;|&nbsp; finalizações ${s.shots.home} · ${s.shots.away}`;
  }
}
