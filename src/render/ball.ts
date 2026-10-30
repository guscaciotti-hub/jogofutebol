import { BufferAttribute, CircleGeometry, Group, IcosahedronGeometry, Mesh, MeshBasicMaterial, MeshLambertMaterial } from 'three';
import { toWorld } from './field';

export interface BallFigure {
  group: Group;
  apply(x: number, y: number, z: number, time: number): void;
}

export function createBall(): BallFigure {
  const group = new Group();
  // low-poly ball: 20 faces, every third one painted dark (classic patches), via vertex colours
  const geo = new IcosahedronGeometry(0.55, 0); // already non-indexed
  const colors = new Float32Array(geo.attributes.position.count * 3);
  for (let face = 0; face < geo.attributes.position.count / 3; face++) {
    const dark = face % 3 === 0;
    for (let v = 0; v < 3; v++) {
      const i = (face * 3 + v) * 3;
      colors[i] = colors[i + 1] = colors[i + 2] = dark ? 0.12 : 1;
    }
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3));
  const ball = new Mesh(geo, new MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  ball.position.y = 0.55;
  group.add(ball);
  const shadow = new Mesh(new CircleGeometry(0.55, 10), new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.05;
  group.add(shadow);
  let lx = 0;
  let lz = 0;
  return {
    group,
    apply(x, y, z, time) {
      const [wx, wz] = toWorld(x, y);
      group.position.set(wx, 0, wz);
      ball.position.y = 0.55 + Math.max(0, z);
      const moved = Math.hypot(wx - lx, wz - lz);
      lx = wx;
      lz = wz;
      ball.rotation.z -= moved * 1.4;
      ball.rotation.x += Math.sin(time) * 0.01;
      const s = 1 - Math.min(0.6, z * 0.12);
      shadow.scale.set(s, s, s);
    },
  };
}
