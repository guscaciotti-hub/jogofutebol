import { BoxGeometry, CircleGeometry, Group, Mesh, MeshLambertMaterial, RingGeometry, CylinderGeometry, MeshBasicMaterial, DoubleSide, PlaneGeometry } from 'three';

export const PITCH_L = 105; // x
export const PITCH_W = 68; // z
export const HALF_L = PITCH_L / 2;
export const HALF_W = PITCH_W / 2;
export const GOAL_W = 7.32;
export const GOAL_H = 2.44;

export const matGrassA = new MeshLambertMaterial({ color: 0x5fbf4a });
export const matGrassB = new MeshLambertMaterial({ color: 0x55b142 });
export const matLine = new MeshBasicMaterial({ color: 0xffffff });
export const matPost = new MeshLambertMaterial({ color: 0xffffff });
export const matNet = new MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, side: DoubleSide });
export const matDirt = new MeshLambertMaterial({ color: 0xd9c9a3 });
export const matGround = new MeshLambertMaterial({ color: 0x8fcf6d });

/** Converts normalized pitch coords to world (x, z). */
export function toWorld(nx: number, ny: number): [number, number] {
  return [nx * HALF_L, ny * HALF_W];
}

function line(group: Group, x: number, z: number, lx: number, lz: number): void {
  const m = new Mesh(new BoxGeometry(lx, 0.06, lz), matLine);
  m.position.set(x, 0.03, z);
  group.add(m);
}

export function buildField(): Group {
  const g = new Group();

  // stripes (procedural "mown" look)
  const stripes = 10;
  const sw = PITCH_L / stripes;
  for (let i = 0; i < stripes; i++) {
    const m = new Mesh(new BoxGeometry(sw, 0.5, PITCH_W + 6), i % 2 ? matGrassA : matGrassB);
    m.position.set(-HALF_L + sw * (i + 0.5), -0.25, 0);
    g.add(m);
  }
  // surrounding ground slab (the "maquete" base)
  const base = new Mesh(new BoxGeometry(PITCH_L + 60, 1.4, PITCH_W + 64), matGround);
  base.position.y = -0.95;
  g.add(base);
  // running track / dirt strip
  const track = new Mesh(new PlaneGeometry(PITCH_L + 14, PITCH_W + 14), matDirt);
  track.rotation.x = -Math.PI / 2;
  track.position.y = -0.24;
  g.add(track);

  // lines
  const lw = 0.3;
  line(g, 0, -HALF_W, PITCH_L, lw);
  line(g, 0, HALF_W, PITCH_L, lw);
  line(g, -HALF_L, 0, lw, PITCH_W);
  line(g, HALF_L, 0, lw, PITCH_W);
  line(g, 0, 0, lw, PITCH_W);
  const circle = new Mesh(new RingGeometry(9.15 - lw / 2, 9.15 + lw / 2, 48), matLine);
  circle.rotation.x = -Math.PI / 2;
  circle.position.y = 0.03;
  g.add(circle);
  const spot = new Mesh(new CircleGeometry(0.4, 12), matLine);
  spot.rotation.x = -Math.PI / 2;
  spot.position.y = 0.03;
  g.add(spot);
  for (const s of [-1, 1]) {
    // penalty area 16.5 x 40.3
    line(g, s * (HALF_L - 16.5), 0, lw, 40.3);
    line(g, s * (HALF_L - 8.25), -20.15, 16.5, lw);
    line(g, s * (HALF_L - 8.25), 20.15, 16.5, lw);
    // goal area 5.5 x 18.3
    line(g, s * (HALF_L - 5.5), 0, lw, 18.3);
    line(g, s * (HALF_L - 2.75), -9.15, 5.5, lw);
    line(g, s * (HALF_L - 2.75), 9.15, 5.5, lw);
    const ps = new Mesh(new CircleGeometry(0.35, 10), matLine);
    ps.rotation.x = -Math.PI / 2;
    ps.position.set(s * (HALF_L - 11), 0.03, 0);
    g.add(ps);
    g.add(buildGoal(s));
  }
  return g;
}

function buildGoal(side: number): Group {
  const g = new Group();
  const r = 0.14;
  const postGeo = new CylinderGeometry(r, r, GOAL_H, 8);
  for (const z of [-GOAL_W / 2, GOAL_W / 2]) {
    const p = new Mesh(postGeo, matPost);
    p.position.set(side * HALF_L, GOAL_H / 2, z);
    g.add(p);
  }
  const bar = new Mesh(new CylinderGeometry(r, r, GOAL_W + r * 2, 8), matPost);
  bar.rotation.x = Math.PI / 2;
  bar.position.set(side * HALF_L, GOAL_H, 0);
  g.add(bar);
  const depth = 2.0;
  // net: back, top and sides as translucent panels
  const back = new Mesh(new PlaneGeometry(GOAL_W, GOAL_H), matNet);
  back.rotation.y = Math.PI / 2;
  back.position.set(side * (HALF_L + depth), GOAL_H / 2, 0);
  g.add(back);
  const top = new Mesh(new PlaneGeometry(depth, GOAL_W), matNet);
  top.rotation.x = -Math.PI / 2;
  top.rotation.z = Math.PI / 2;
  top.position.set(side * (HALF_L + depth / 2), GOAL_H, 0);
  g.add(top);
  for (const z of [-GOAL_W / 2, GOAL_W / 2]) {
    const sideNet = new Mesh(new PlaneGeometry(depth, GOAL_H), matNet);
    sideNet.position.set(side * (HALF_L + depth / 2), GOAL_H / 2, z);
    g.add(sideNet);
  }
  return g;
}
