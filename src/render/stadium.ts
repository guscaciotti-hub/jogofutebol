import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  Object3D,
} from 'three';
import { createRng } from '../engine/rng';
import { HALF_L, HALF_W } from './field';

export interface Crowd {
  mesh: InstancedMesh;
  count: number;
  /** animate the crowd: intensity 0 = seated, 1 = full jump */
  update(t: number, intensity: number): void;
}

const matConcrete = new MeshLambertMaterial({ color: 0xd8d4cc });
const matRoof = new MeshLambertMaterial({ color: 0xf5f1e8 });
const matPole = new MeshLambertMaterial({ color: 0x8a8f99 });
const matLamp = new MeshLambertMaterial({ color: 0xfff8d0, emissive: 0xfff2b0 });
const matTrunk = new MeshLambertMaterial({ color: 0x8b5a2b });
const matLeaf = new MeshLambertMaterial({ color: 0x3f9b3f });
const matLeafB = new MeshLambertMaterial({ color: 0x5bb75b });
const matRoofTile = new MeshLambertMaterial({ color: 0xc8553d });

const HOUSE_COLORS = [0xfff1c1, 0xffd6e0, 0xcde7ff, 0xe6ffd0, 0xfde2c0, 0xf4e3ff];

/** stepped stand along one side */
function buildStand(group: Group, lengthAlongX: boolean, offset: number, rows: number, length: number): void {
  const rowDepth = 1.3;
  const rowHeight = 0.9;
  for (let r = 0; r < rows; r++) {
    const geo = lengthAlongX ? new BoxGeometry(length, rowHeight * (r + 1), rowDepth) : new BoxGeometry(rowDepth, rowHeight * (r + 1), length);
    const m = new Mesh(geo, matConcrete);
    const d = offset + r * rowDepth;
    const h = (rowHeight * (r + 1)) / 2;
    if (lengthAlongX) m.position.set(0, h, Math.sign(offset) * (Math.abs(d) + rowDepth / 2));
    else m.position.set(Math.sign(offset) * (Math.abs(d) + rowDepth / 2), h, 0);
    group.add(m);
  }
  // roof on the long sides only
  if (lengthAlongX) {
    const depth = rows * rowDepth + 2;
    const roof = new Mesh(new BoxGeometry(length + 2, 0.4, depth), matRoof);
    roof.position.set(0, rows * rowHeight + 5.5, Math.sign(offset) * (Math.abs(offset) + depth / 2 - 0.5));
    group.add(roof);
    for (const x of [-length / 2 + 2, 0, length / 2 - 2]) {
      const pole = new Mesh(new CylinderGeometry(0.25, 0.25, rows * rowHeight + 5.5, 6), matPole);
      pole.position.set(x, (rows * rowHeight + 5.5) / 2, Math.sign(offset) * (Math.abs(offset) + depth - 1.2));
      group.add(pole);
    }
  }
}

export function buildStadium(homeColors: [string, string], awayColors: [string, string], lowCrowd = false): { group: Group; crowd: Crowd } {
  const g = new Group();
  const rowsLong = 8;
  const rowsShort = 5;
  const longOffset = HALF_W + 6;
  const shortOffset = HALF_L + 7;
  buildStand(g, true, longOffset, rowsLong, 104);
  buildStand(g, true, -longOffset, rowsLong, 104);
  buildStand(g, false, shortOffset, rowsShort, 64);
  buildStand(g, false, -shortOffset, rowsShort, 64);

  // floodlights
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pole = new Mesh(new CylinderGeometry(0.4, 0.5, 28, 6), matPole);
      pole.position.set(sx * (HALF_L + 16), 14, sz * (HALF_W + 18));
      g.add(pole);
      const lamp = new Mesh(new BoxGeometry(3, 2, 1.2), matLamp);
      lamp.position.set(sx * (HALF_L + 16), 28, sz * (HALF_W + 18));
      lamp.lookAt(0, 0, 0);
      g.add(lamp);
    }
  }

  // --- crowd (instanced) ---
  const rng = createRng('crowd');
  const positions: number[] = [];
  const colors: Color[] = [];
  const cHome = [new Color(homeColors[0]), new Color(homeColors[1])];
  const cAway = [new Color(awayColors[0]), new Color(awayColors[1])];
  const neutral = [new Color(0xf2d6b3), new Color(0xffffff), new Color(0x333333), new Color(0x9ad0ff)];
  const spacing = lowCrowd ? 2.2 : 1.1;
  const addSeat = (x: number, y: number, z: number) => {
    if (rng.chance(0.08)) return; // empty seats
    positions.push(x, y, z);
    const r = rng.next();
    colors.push(r < 0.55 ? rng.pick(cHome) : r < 0.72 ? rng.pick(cAway) : rng.pick(neutral));
  };
  for (let r = 0; r < rowsLong; r++) {
    const z = longOffset + r * 1.3 + 0.65;
    const y = 0.9 * (r + 1) + 0.5;
    for (let x = -51; x <= 51; x += spacing) {
      addSeat(x + rng.range(-0.2, 0.2), y, z);
      addSeat(x + rng.range(-0.2, 0.2), y, -z);
    }
  }
  for (let r = 0; r < rowsShort; r++) {
    const x = shortOffset + r * 1.3 + 0.65;
    const y = 0.9 * (r + 1) + 0.5;
    for (let z = -31; z <= 31; z += spacing) {
      addSeat(x, y, z + rng.range(-0.2, 0.2));
      addSeat(-x, y, z + rng.range(-0.2, 0.2));
    }
  }
  const count = positions.length / 3;
  const crowdGeo = new BoxGeometry(0.7, 1.1, 0.6);
  crowdGeo.translate(0, 0.55, 0);
  const crowdMat = new MeshLambertMaterial({ color: 0xffffff });
  const mesh = new InstancedMesh(crowdGeo, crowdMat, count);
  const dummy = new Object3D();
  const base = new Float32Array(positions);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    dummy.position.set(base[i * 3], base[i * 3 + 1], base[i * 3 + 2]);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, colors[i]);
    phase[i] = rng.range(0, Math.PI * 2);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  g.add(mesh);

  let lastIntensity = -1;
  const m4 = new Matrix4();
  const crowd: Crowd = {
    mesh,
    count,
    update(t, intensity) {
      if (intensity <= 0 && lastIntensity <= 0) return; // static when nothing happens
      for (let i = 0; i < count; i++) {
        const jump = intensity > 0 ? Math.max(0, Math.sin(t * 7 + phase[i])) * 0.6 * intensity : 0;
        m4.makeTranslation(base[i * 3], base[i * 3 + 1] + jump, base[i * 3 + 2]);
        mesh.setMatrixAt(i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
      lastIntensity = intensity;
    },
  };

  // --- scenery: trees and houses around the ground ---
  const sc = createRng('scenery');
  const treeCount = 90;
  const trunks = new InstancedMesh(new CylinderGeometry(0.3, 0.4, 2.2, 5), matTrunk, treeCount);
  const leavesA = new InstancedMesh(new ConeGeometry(2.2, 5, 6), matLeaf, treeCount);
  const leavesB = new InstancedMesh(new ConeGeometry(1.6, 3.5, 6), matLeafB, treeCount);
  for (let i = 0; i < treeCount; i++) {
    const ang = sc.range(0, Math.PI * 2);
    const rx = HALF_L + 24 + sc.range(0, 10);
    const rz = HALF_W + 26 + sc.range(0, 8);
    const x = Math.cos(ang) * rx;
    const z = Math.sin(ang) * rz;
    const s = sc.range(0.8, 1.3);
    dummy.position.set(x, 1.1 * s, z);
    dummy.scale.set(s, s, s);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 2.2 * s + 2.5 * s, z);
    dummy.updateMatrix();
    leavesA.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 2.2 * s + 5.2 * s, z);
    dummy.updateMatrix();
    leavesB.setMatrixAt(i, dummy.matrix);
  }
  g.add(trunks, leavesA, leavesB);

  for (let i = 0; i < 18; i++) {
    const ang = sc.range(0, Math.PI * 2);
    const x = Math.cos(ang) * (HALF_L + 40 + sc.range(0, 8));
    const z = Math.sin(ang) * (HALF_W + 42 + sc.range(0, 6));
    const w = sc.range(5, 9);
    const d = sc.range(5, 8);
    const h = sc.range(3.5, 6);
    const house = new Mesh(new BoxGeometry(w, h, d), new MeshLambertMaterial({ color: sc.pick(HOUSE_COLORS) }));
    house.position.set(x, h / 2 - 0.2, z);
    house.rotation.y = sc.range(0, Math.PI);
    g.add(house);
    const roof = new Mesh(new ConeGeometry(Math.max(w, d) * 0.78, 2.6, 4), matRoofTile);
    roof.position.set(x, h + 1.1, z);
    roof.rotation.y = house.rotation.y + Math.PI / 4;
    g.add(roof);
  }

  return { group: g, crowd };
}
