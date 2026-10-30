import {
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Sprite,
  SpriteMaterial,
} from 'three';
import type { PlayerState } from './timeline';
import { toWorld } from './field';

/** Scale factor: players are exaggerated like figurines on a maquete. */
const S = 1.35;

const geoHead = new BoxGeometry(0.55 * S, 0.55 * S, 0.55 * S);
const geoTorso = new BoxGeometry(0.72 * S, 0.8 * S, 0.42 * S);
const geoLeg = new BoxGeometry(0.26 * S, 0.7 * S, 0.3 * S);
const geoArm = new BoxGeometry(0.2 * S, 0.7 * S, 0.22 * S);
const geoShadow = new CircleGeometry(0.6 * S, 12);
const matShadow = new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false });
const matHair = new MeshLambertMaterial({ color: 0x2b1b12 });
const SKIN_TONES = [0xf5d0b0, 0xe0ac7e, 0xc68b5b, 0x8d5a3b, 0x5c3a21];

const materialCache = new Map<string, MeshLambertMaterial>();
function mat(color: string | number): MeshLambertMaterial {
  const key = String(color);
  let m = materialCache.get(key);
  if (!m) {
    m = new MeshLambertMaterial({ color: new Color(color) });
    materialCache.set(key, m);
  }
  return m;
}

export interface PlayerKit {
  shirt: string;
  shorts: string;
  socks: string;
}

export interface PlayerFigure {
  group: Group;
  tag: Sprite;
  apply(state: PlayerState, time: number): void;
  setTagVisible(v: boolean): void;
  dispose(): void;
}

function makeTag(text: string, highlight: boolean): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 72;
  const ctx = canvas.getContext('2d')!;
  ctx.font = '700 34px Nunito, "Baloo 2", system-ui, sans-serif';
  const w = Math.min(240, ctx.measureText(text).width + 36);
  const x = (256 - w) / 2;
  ctx.fillStyle = highlight ? '#ffd23f' : '#ffffff';
  ctx.strokeStyle = '#1d1d1d';
  ctx.lineWidth = 5;
  const r = 22;
  ctx.beginPath();
  ctx.roundRect(x, 8, w, 56, r);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1d1d1d';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 37);
  const tex = new CanvasTexture(canvas);
  tex.anisotropy = 2;
  const sprite = new Sprite(new SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set(5.2, 1.46, 1);
  sprite.renderOrder = 10;
  return sprite;
}

export function createPlayerFigure(kit: PlayerKit, label: string, skinIndex: number, isHuman: boolean, isKeeper: boolean): PlayerFigure {
  const group = new Group();
  const skin = mat(SKIN_TONES[skinIndex % SKIN_TONES.length]);
  const shirt = mat(isKeeper ? '#2b2b2b' : kit.shirt);
  const shorts = mat(isKeeper ? '#2b2b2b' : kit.shorts);
  const socks = mat(kit.socks);

  const legL = new Mesh(geoLeg, socks);
  const legR = new Mesh(geoLeg, socks);
  legL.position.set(0, 0.35 * S, -0.18 * S);
  legR.position.set(0, 0.35 * S, 0.18 * S);
  const hips = new Mesh(new BoxGeometry(0.74 * S, 0.3 * S, 0.76 * S), shorts);
  hips.position.y = 0.78 * S;
  const torso = new Mesh(geoTorso, shirt);
  torso.position.y = 1.3 * S;
  const armL = new Mesh(geoArm, shirt);
  const armR = new Mesh(geoArm, shirt);
  armL.position.set(0, 1.3 * S, -0.5 * S);
  armR.position.set(0, 1.3 * S, 0.5 * S);
  const handL = new Mesh(new BoxGeometry(0.2 * S, 0.2 * S, 0.22 * S), skin);
  const handR = handL.clone();
  handL.position.set(0, 0.85 * S, -0.5 * S);
  handR.position.set(0, 0.85 * S, 0.5 * S);
  const head = new Mesh(geoHead, skin);
  head.position.y = 2.0 * S;
  const hair = new Mesh(new BoxGeometry(0.58 * S, 0.18 * S, 0.58 * S), matHair);
  hair.position.y = 2.27 * S;
  // eyes on the +x face (facing direction)
  const eyeGeo = new BoxGeometry(0.06 * S, 0.1 * S, 0.1 * S);
  const eyeMat = mat(0x1d1d1d);
  const eyeL = new Mesh(eyeGeo, eyeMat);
  const eyeR = new Mesh(eyeGeo, eyeMat);
  eyeL.position.set(0.28 * S, 2.02 * S, -0.13 * S);
  eyeR.position.set(0.28 * S, 2.02 * S, 0.13 * S);

  const body = new Group();
  body.add(legL, legR, hips, torso, armL, armR, handL, handR, head, hair, eyeL, eyeR);
  group.add(body);

  const shadow = new Mesh(geoShadow, matShadow);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.04;
  group.add(shadow);

  const tag = makeTag(label, isHuman);
  tag.position.y = 3.4 * S;
  group.add(tag);

  let tagVisible = true;
  return {
    group,
    tag,
    apply(st, time) {
      const [wx, wz] = toWorld(st.x, st.y);
      group.position.set(wx, 0, wz);
      body.position.y = Math.max(0, st.z);
      body.rotation.y = -st.facing;
      // fouled player lying down (negative z encodes "on the ground")
      body.rotation.z = st.z < 0 ? Math.PI / 2 * Math.min(1, -st.z * 2) : 0;
      const swing = st.speed > 0.02 ? Math.sin(time * (8 + st.speed * 8)) * 0.6 * st.speed : 0;
      legL.rotation.z = swing;
      legR.rotation.z = -swing;
      armL.rotation.z = -swing * 0.8;
      armR.rotation.z = swing * 0.8;
      // celebrate: arms up
      if (st.z > 0.05 && st.speed < 0.3) {
        armL.rotation.z = Math.PI * 0.9;
        armR.rotation.z = -Math.PI * 0.9;
      }
      const sh = 1 - Math.min(0.5, Math.max(0, st.z) * 0.3);
      shadow.scale.set(sh, sh, sh);
      group.visible = st.active || st.y < -1.05; // sent-off players sit by the sideline
      tag.visible = tagVisible && st.active;
    },
    setTagVisible(v) {
      tagVisible = v;
    },
    dispose() {
      (tag.material as SpriteMaterial).map?.dispose();
      (tag.material as SpriteMaterial).dispose();
    },
  };
}
