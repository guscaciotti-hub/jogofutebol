import {
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';

export interface SceneHandle {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  /** call on resize or at start */
  resize(): void;
  /** aspect ratio of the viewport (w/h) */
  aspect(): number;
  setLowQuality(low: boolean): void;
  lowQuality: boolean;
  dispose(): void;
}

export const SKY = 0xbfe6ff;

export function createScene(canvas: HTMLCanvasElement): SceneHandle {
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  const scene = new Scene();
  scene.background = new Color(SKY);
  scene.fog = new Fog(SKY, 140, 300);

  const camera = new PerspectiveCamera(32, 1, 1, 600);
  camera.position.set(-40, 50, 40);
  camera.lookAt(0, 0, 0);

  const hemi = new HemisphereLight(0xdff3ff, 0x6aa84f, 1.1);
  scene.add(hemi);
  const sun = new DirectionalLight(0xfff4d6, 1.6);
  sun.position.set(60, 90, 30);
  scene.add(sun);

  const handle: SceneHandle = {
    renderer,
    scene,
    camera,
    lowQuality: false,
    resize() {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    aspect() {
      return camera.aspect;
    },
    setLowQuality(low) {
      handle.lowQuality = low;
      renderer.setPixelRatio(low ? 1 : Math.min(window.devicePixelRatio || 1, 1.75));
      handle.resize();
    },
    dispose() {
      renderer.dispose();
    },
  };
  handle.resize();
  return handle;
}
