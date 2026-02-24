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
let snapshotMs = 50; // adaptive snapshot cadence
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

function toList(map, position, pick) {
  const out = [];
  for (const [id, data] of map.entries()) {
    const pos = position.get(id);
    if (!pos) continue;
    out.push({ id, x: pos.x, y: pos.y, ...(pick ? pick(data) : {}) });
  }
  return out;
}

function toListWithVelocity(map, position, velocity, pick) {
  const out = [];
  for (const [id, data] of map.entries()) {
    const pos = position.get(id);
    if (!pos) continue;
    const vel = velocity.get(id);
    out.push({ id, x: pos.x, y: pos.y, vx: vel?.vx ?? 0, vy: vel?.vy ?? 0, ...(pick ? pick(data) : {}) });
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
    perf: { fps, avgStepMs, effectQuality: world.globals.effectQuality ?? 1, updateStride: world.globals.updateStride ?? 1, snapshotMs },
    components: {
      agent: toListWithVelocity(c.agent, c.position, c.velocity, (d) => ({ colorHue: d.colorHue, energy: d.energy, age: d.age, evolved: d.evolved, caste: d.caste })),
      predator: toListWithVelocity(c.predator, c.position, c.velocity, (d) => ({ colorHue: d.colorHue, energy: d.energy, age: d.age })),
      apex: toListWithVelocity(c.apex, c.position, c.velocity, (d) => ({ colorHue: d.colorHue, energy: d.energy, age: d.age })),
      coral: toListWithVelocity(c.coral, c.position, c.velocity, (d) => ({ colorHue: d.colorHue, energy: d.energy, age: d.age, dna: d.dna ? { venom: d.dna.venom } : undefined })),
      titan: toListWithVelocity(c.titan, c.position, c.velocity, (d) => ({ colorHue: d.colorHue, energy: d.energy, age: d.age })),
      burst: toList(c.burst, c.position, (d) => ({ life: d.life, hue: d.hue })),
      resource: toList(c.resource, c.position, (d) => ({ kind: d.kind, amount: d.amount, age: d.age, cycles: d.cycles, dna: d.dna })),
      forceField: toList(c.forceField, c.position, (d) => ({ strength: d.strength, radius: d.radius })),
    },
  };
}

const DELTA_COMPONENTS = ['agent', 'predator', 'apex', 'coral', 'titan', 'burst', 'resource', 'forceField'];
let prevSnapshot = null;
let lastFullAt = 0;
const FULL_SNAPSHOT_MS = 2000;

function listToMap(list) {
  const m = new Map();
  for (const e of list || []) m.set(e.id, e);
  return m;
}

function diffLists(prevList, nextList) {
  const prev = listToMap(prevList);
  const next = listToMap(nextList);
  const upserts = [];
  const removes = [];

  for (const [id, cur] of next.entries()) {
    const old = prev.get(id);
    if (!old || JSON.stringify(old) !== JSON.stringify(cur)) upserts.push(cur);
  }
  for (const id of prev.keys()) {
    if (!next.has(id)) removes.push(id);
  }

  return { upserts, removes };
}

function postSnapshot(now, force = false) {
  if (!force && now - lastSnapshotAt < snapshotMs) return;
  lastSnapshotAt = now;

  const full = buildSnapshot();
  const shouldSendFull = force || !prevSnapshot || (now - lastFullAt > FULL_SNAPSHOT_MS);

  if (shouldSendFull) {
    postMessage({ type: 'snapshot', mode: 'full', snapshot: full });
    prevSnapshot = full;
    lastFullAt = now;
    return;
  }

  const deltaComponents = {};
  for (const key of DELTA_COMPONENTS) {
    deltaComponents[key] = diffLists(prevSnapshot.components[key], full.components[key]);
  }

  postMessage({
    type: 'snapshot',
    mode: 'delta',
    snapshot: {
      tick: full.tick,
      seed: full.seed,
      width: full.width,
      height: full.height,
      regime: full.regime,
      camera: full.camera,
      perf: full.perf,
      components: deltaComponents,
    },
  });

  prevSnapshot = full;
}

function getCreatureCount() {
  const c = world.ecs.components;
  return c.agent.size + c.predator.size + c.apex.size + c.coral.size + c.titan.size;
}

function updateLodControls() {
  const n = getCreatureCount();
  if (n > 9000) world.globals.updateStride = 3;
  else if (n > 3500) world.globals.updateStride = 2;
  else world.globals.updateStride = 1;

  // Also reduce snapshot frequency under heavy load to cut worker->main traffic.
  if (n > 9000 || avgStepMs > 10) snapshotMs = 120;      // ~8Hz
  else if (n > 3500 || avgStepMs > 7) snapshotMs = 80;   // ~12.5Hz
  else snapshotMs = 50;                                   // ~20Hz
}

function stepFrame(now) {
  const elapsed = now - lastTime;
  lastTime = now;

  if (running) {
    updateLodControls();
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
    // Keep minimum zoom at fit-like floor from UI side to avoid empty margins.
    world.camera.zoom = Math.max(0.3, Math.min(8, zoom));
  }
};

postSnapshot(performance.now(), true);
setInterval(() => stepFrame(performance.now()), 16);
