import { createRng } from './core/rng.js?v=20260223-2';
import { createWorld } from './core/world.js?v=20260223-2';

const DT = 0.06;
const MS_PER_TICK = DT * 1000;

let seedStr = String(Date.now());
let rng = createRng(seedStr);
let world = createWorld(rng);
let running = true;

let lastTime = performance.now();
let accum = 0;
let avgStepMs = 0;
let fps = 0;
let frameCounter = 0;
let fpsWindowStart = performance.now();
const SNAPSHOT_MS = 50; // ~20Hz snapshot stream to reduce postMessage overhead
let lastSnapshotAt = 0;

function isExtinct(currentWorld) {
  const { agent, predator, apex, coral, titan } = currentWorld.ecs.components;
  return agent.size === 0 && predator.size === 0 && apex.size === 0 && coral.size === 0 && titan.size === 0;
}

function resetWorld() {
  seedStr = String(Date.now());
  rng = createRng(seedStr);
  world = createWorld(rng);
}

function toList(map, position, velocity, extra = null) {
  const out = [];
  for (const [id, data] of map.entries()) {
    const pos = position.get(id);
    if (!pos) continue;
    const v = velocity?.get(id) || null;
    out.push({ id, x: pos.x, y: pos.y, vx: v?.vx ?? 0, vy: v?.vy ?? 0, ...(data || {}), ...(extra ? extra(data) : {}) });
  }
  return out;
}

function buildSnapshot() {
  const c = world.ecs.components;
  return {
    tick: world.tick,
    seed: seedStr,
    width: world.width,
    height: world.height,
    regime: world.regime,
    camera: world.camera,
    perf: { fps, avgStepMs, effectQuality: world.globals.effectQuality ?? 1 },
    components: {
      agent: toList(c.agent, c.position, c.velocity),
      predator: toList(c.predator, c.position, c.velocity),
      apex: toList(c.apex, c.position, c.velocity),
      coral: toList(c.coral, c.position, c.velocity),
      titan: toList(c.titan, c.position, c.velocity),
      burst: toList(c.burst, c.position, null),
      resource: toList(c.resource, c.position, null),
      forceField: toList(c.forceField, c.position, null),
    },
  };
}

function postSnapshot(now, force = false) {
  if (!force && now - lastSnapshotAt < SNAPSHOT_MS) return;
  lastSnapshotAt = now;
  postMessage({ type: 'snapshot', snapshot: buildSnapshot() });
}

function stepFrame(now) {
  const elapsed = now - lastTime;
  lastTime = now;

  if (running) {
    accum += Math.min(elapsed, 200);
    let steps = 0;
    while (accum >= MS_PER_TICK && steps < 8) {
      const t0 = performance.now();
      world.step(DT);
      avgStepMs = avgStepMs * 0.9 + (performance.now() - t0) * 0.1;
      accum -= MS_PER_TICK;
      steps += 1;
      if (isExtinct(world)) {
        resetWorld();
        accum = 0;
        postSnapshot(now, true);
        break;
      }
    }
  }

  frameCounter += 1;
  if (now - fpsWindowStart >= 500) {
    fps = (frameCounter * 1000) / (now - fpsWindowStart);
    frameCounter = 0;
    fpsWindowStart = now;
  }

  postSnapshot(now);
}

onmessage = (e) => {
  const { type, zoom } = e.data || {};
  if (type === 'toggle') running = !running;
  if (type === 'pause') running = false;
  if (type === 'resume') running = true;
  if (type === 'setZoom' && Number.isFinite(zoom)) {
    world.camera.zoom = Math.max(0.3, Math.min(4, zoom));
  }
};

postSnapshot(performance.now(), true);
setInterval(() => stepFrame(performance.now()), 16);
