/** Rolling fps monitor used to degrade quality on weak phones. */
export interface FpsMonitor {
  tick(dtSeconds: number): void;
  fps: number;
  /** true once the average stayed under `threshold` for `holdSeconds` */
  isSlow(threshold: number, holdSeconds: number): boolean;
}

export function createFpsMonitor(): FpsMonitor {
  let acc = 0;
  let frames = 0;
  let slowFor = 0;
  const mon: FpsMonitor = {
    fps: 60,
    tick(dt) {
      acc += dt;
      frames++;
      if (acc >= 0.5) {
        mon.fps = frames / acc;
        acc = 0;
        frames = 0;
      }
    },
    isSlow(threshold, holdSeconds) {
      // called once per frame
      if (mon.fps < threshold) slowFor += 1 / Math.max(1, mon.fps);
      else slowFor = 0;
      return slowFor >= holdSeconds;
    },
  };
  return mon;
}
