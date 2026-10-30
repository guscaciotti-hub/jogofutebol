import './style.css';
import {
  FORMATION_LIST,
  SAMPLE_CITIES,
  STYLE_LIST,
  createRng,
  generateClub,
  simulateMatch,
  toMatchTeam,
  type Tactics,
} from './engine';
import { createScene } from './render/scene';
import { Director } from './render/director';
import { Hud } from './ui/hud';
import { showStartCard } from './ui/start';
import { createSfx, type Sfx } from './audio/sfx';
import { goToSeed, readSeed, seedUrl } from './seed';

/**
 * Phase 1 entry: NPC vs NPC friendly between two random Brazilian cities, chosen from the seed.
 * ?seed=anything reproduces the exact same match on every device.
 */
function pickMatch(seed: string) {
  const rng = createRng(`match:${seed}`);
  const cityA = rng.pick(SAMPLE_CITIES);
  let cityB = rng.pick(SAMPLE_CITIES);
  if (cityB.id === cityA.id) cityB = SAMPLE_CITIES[(SAMPLE_CITIES.indexOf(cityA) + 1) % SAMPLE_CITIES.length];
  const tac = (): Tactics => ({ formation: rng.pick(FORMATION_LIST), style: rng.pick(STYLE_LIST) });
  const home = toMatchTeam(generateClub(cityA, rng.int(0, 3)), tac());
  const away = toMatchTeam(generateClub(cityB, rng.int(0, 3)), tac());
  return simulateMatch(seed, home, away);
}

function randomSeed(): string {
  const words = ['bola', 'trave', 'gol', 'várzea', 'campinho', 'pelada', 'chuteira', 'escanteio', 'zaga', 'meia'];
  const r = createRng(`${Date.now()}:${Math.random()}`); // only used to pick a NEW seed, never inside the simulation
  return `${r.pick(words)}-${r.int(100, 999)}`;
}

function boot() {
  const app = document.getElementById('app')!;
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  const seed = readSeed() ?? randomSeed();
  if (!readSeed()) {
    try {
      history.replaceState(null, '', seedUrl(seed));
    } catch {
      /* some embedded viewers forbid history changes */
    }
  }

  const result = pickMatch(seed);
  const scene = createScene(canvas);
  let sfx: Sfx | undefined;
  let director: Director | undefined;

  const hud = new Hud(app, result, {
    onToggle: () => {
      director?.toggle();
      hud.setPlaying(!!director?.playing);
    },
    onSpeed: (s) => director?.setSpeed(s),
    onMute: (m) => sfx?.setMuted(m),
    onNewMatch: () => goToSeed(randomSeed()),
    onTags: (v) => director?.setTagsVisible(v),
    onSeek: (t) => {
      director?.seek(t);
      director?.play();
      hud.setPlaying(true);
    },
  });
  hud.root.style.visibility = 'hidden';

  const privacy = document.createElement('div');
  privacy.className = 'privacy';
  privacy.textContent = 'protótipo · nenhum dado é coletado';
  app.appendChild(privacy);

  director = new Director(scene, result, {
    onEvent: (ev, st) => {
      hud.onEvent(ev, st);
      if (!sfx) return;
      switch (ev.type) {
        case 'kickoff':
          sfx.whistle();
          break;
        case 'goal':
          sfx.goal();
          director?.kick(1);
          break;
        case 'save':
          sfx.save();
          break;
        case 'miss':
        case 'block':
          sfx.miss();
          break;
        case 'yellow':
        case 'red':
          sfx.card();
          break;
        case 'halftime':
          sfx.whistleLong();
          break;
        case 'fulltime':
          sfx.whistleLong();
          break;
        case 'chance':
          break;
      }
    },
    onTick: (st) => hud.tick(st),
    onEnd: () => {
      hud.setPlaying(false);
      sfx?.crowdStop();
    },
    onQualityChange: () => hud.showQualityNote(),
  });
  hud.setDuration(director.duration);

  // shot sound: fire when the ball leaves the shooter (segment mark), independent of event list
  let lastShotSeg: unknown = null;
  const shotWatcher = () => {
    if (!director || !sfx) return;
    const seg = director.replay.segments.find((s) => s.start <= director!.time && director!.time < s.end);
    if (seg && seg.marks.shot !== undefined && director.time >= seg.marks.shot && lastShotSeg !== seg) {
      lastShotSeg = seg;
      sfx.kick();
    }
    requestAnimationFrame(shotWatcher);
  };

  window.addEventListener('resize', () => scene.resize());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      director?.pause();
      hud.setPlaying(false);
    }
  });

  showStartCard(app, result, seed, () => {
    sfx = createSfx();
    sfx.crowdStart();
    hud.root.style.visibility = 'visible';
    director!.play();
    hud.setPlaying(true);
    shotWatcher();
  });

  // expose for manual testing in the console
  (window as unknown as { varzea: unknown }).varzea = { result, director, seed };
}

boot();
