import { gsap } from 'gsap';
import { Vector3, type Scene } from 'three';
import type { MatchEvent, MatchResult } from '../engine/types';
import { shortName } from '../engine/names';
import { buildField } from './field';
import { buildStadium, type Crowd } from './stadium';
import { createPlayerFigure, type PlayerFigure } from './players';
import { createBall, type BallFigure } from './ball';
import { createFpsMonitor } from './perf';
import type { SceneHandle } from './scene';
import { buildReplay, getReplayState, type Replay, type ReplayState } from './timeline';

function smoothstep(u: number): number {
  const x = Math.min(1, Math.max(0, u));
  return x * x * (3 - 2 * x);
}

export interface DirectorCallbacks {
  onEvent?(event: MatchEvent, state: ReplayState): void;
  onTick?(state: ReplayState): void;
  onEnd?(state: ReplayState): void;
  onQualityChange?(low: boolean): void;
}

/**
 * Drives the 3D scene from the replay timeline. Time is owned by a paused GSAP timeline,
 * so play/pause/seek/speed are trivial and the same frame can always be reproduced from `t`.
 */
export class Director {
  readonly replay: Replay;
  readonly clock = { t: 0 };
  readonly master: gsap.core.Timeline;
  private figures: PlayerFigure[] = [];
  private ball: BallFigure;
  private crowd: Crowd;
  private root: Scene;
  private fired = 0; // index into sorted event times
  private sortedEvents: { t: number; ev: MatchEvent }[];
  private camTarget = new Vector3();
  private camPos = new Vector3();
  private fps = createFpsMonitor();
  private ended = false;
  private disposed = false;
  private shake = 0;

  constructor(private scene: SceneHandle, public result: MatchResult, private cb: DirectorCallbacks = {}) {
    this.root = scene.scene;
    this.replay = buildReplay(result);
    this.sortedEvents = [...this.replay.eventTimes.entries()]
      .map(([id, t]) => ({ t, ev: result.events.find((e) => e.id === id)! }))
      .sort((a, b) => a.t - b.t || a.ev.id - b.ev.id);

    this.root.add(buildField());
    const stadium = buildStadium(result.home.club.colors, result.away.club.colors, scene.lowQuality);
    this.root.add(stadium.group);
    this.crowd = stadium.crowd;

    for (const side of ['home', 'away'] as const) {
      const team = side === 'home' ? result.home : result.away;
      const [c1, c2] = team.club.colors;
      team.lineup.forEach((p, i) => {
        const label = p.isHuman ? `@${p.handle ?? p.name.replace('@', '')}` : shortName(p.name);
        const fig = createPlayerFigure({ shirt: c1, shorts: side === 'home' ? c2 : c1, socks: c2 }, label, i + (side === 'away' ? 2 : 0), p.isHuman, i === 0);
        this.figures.push(fig);
        this.root.add(fig.group);
      });
    }
    this.ball = createBall();
    this.root.add(this.ball.group);

    this.master = gsap.timeline({ paused: true });
    this.master.to(this.clock, { t: this.replay.duration, duration: this.replay.duration, ease: 'none' });

    // initial camera
    const st = getReplayState(this.replay, 0);
    this.applyState(st, 0, true);
    gsap.ticker.add(this.tick);
    gsap.ticker.fps(60);
  }

  get time(): number {
    return this.clock.t;
  }
  get duration(): number {
    return this.replay.duration;
  }
  get playing(): boolean {
    return this.master.isActive();
  }

  play(): void {
    if (this.clock.t >= this.replay.duration - 0.01) this.seek(0);
    this.master.play();
  }
  pause(): void {
    this.master.pause();
  }
  toggle(): void {
    if (this.playing) this.pause();
    else this.play();
  }
  setSpeed(s: number): void {
    this.master.timeScale(s);
  }
  seek(t: number): void {
    this.master.pause();
    this.master.seek(t, false);
    this.clock.t = t;
    // re-sync event cursor without firing
    this.fired = this.sortedEvents.findIndex((e) => e.t > t);
    if (this.fired < 0) this.fired = this.sortedEvents.length;
    this.ended = t >= this.replay.duration - 0.01;
  }
  setTagsVisible(v: boolean): void {
    for (const f of this.figures) f.setTagVisible(v);
  }
  kick(intensity = 1): void {
    this.shake = Math.max(this.shake, intensity);
  }

  private tick = (_time: number, deltaMs: number) => {
    if (this.disposed) return;
    const dt = Math.min(0.1, deltaMs / 1000);
    this.fps.tick(dt);
    if (!this.scene.lowQuality && this.fps.isSlow(28, 3)) {
      this.scene.setLowQuality(true);
      this.cb.onQualityChange?.(true);
    }
    const t = this.clock.t;
    const st = getReplayState(this.replay, t);
    // fire events crossed since last frame (in order)
    while (this.fired < this.sortedEvents.length && this.sortedEvents[this.fired].t <= t) {
      this.cb.onEvent?.(this.sortedEvents[this.fired].ev, st);
      this.fired++;
    }
    this.applyState(st, dt, false);
    this.cb.onTick?.(st);
    if (st.ended && !this.ended) {
      this.ended = true;
      this.master.pause();
      this.cb.onEnd?.(st);
    }
    this.scene.renderer.render(this.scene.scene, this.scene.camera);
  };

  private applyState(st: ReplayState, dt: number, snap: boolean): void {
    const t = st.t;
    for (let i = 0; i < this.figures.length; i++) this.figures[i].apply(st.players[i], t);
    this.ball.apply(st.ball.x, st.ball.y, st.ball.z, t);
    this.crowd.update(t, st.celebrating ? 1 : 0);

    // --- camera: isometric-ish 45° follow with zoom ---
    const aspect = this.scene.aspect();
    const portrait = aspect < 1 ? Math.pow(1 / aspect, 0.7) : 1;
    const zoom = st.zoom * portrait;
    const bx = st.focus.x * 52.5;
    const bz = st.focus.y * 34;
    // keep the camera target inside the pitch so the frame never shows only sky
    const tx = Math.max(-48, Math.min(48, bx));
    const tz = Math.max(-18, Math.min(22, bz));
    const target = new Vector3(tx, 0, tz);
    // 45° yaw around midfield; swings side-on near the goal lines so the end stands never block the goal
    const f = Math.min(1, Math.abs(bx) / 52.5);
    const endMix = smoothstep((f - 0.45) / 0.45);
    const offset = new Vector3(-34 * (1 - endMix) - 4, 44, 34 + 14 * endMix).multiplyScalar(zoom);
    const pos = target.clone().add(offset);
    if (snap) {
      this.camTarget.copy(target);
      this.camPos.copy(pos);
    } else {
      const k = 1 - Math.exp(-dt * 3.2);
      this.camTarget.lerp(target, k);
      this.camPos.lerp(pos, k);
    }
    const cam = this.scene.camera;
    cam.position.copy(this.camPos);
    if (this.shake > 0.01) {
      cam.position.x += (Math.random() - 0.5) * this.shake * 1.2; // cosmetic only, not part of the deterministic state
      cam.position.y += (Math.random() - 0.5) * this.shake * 0.8;
      this.shake *= Math.exp(-dt * 6);
    }
    cam.lookAt(this.camTarget);
  }

  dispose(): void {
    this.disposed = true;
    gsap.ticker.remove(this.tick);
    this.master.kill();
    for (const f of this.figures) {
      this.root.remove(f.group);
      f.dispose();
    }
    this.root.clear();
  }
}
