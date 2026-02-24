import { createRenderer } from './core/render.js?v=20260224-1';

const canvas = document.getElementById('world');
const renderer = createRenderer(canvas);
const tickLabel = document.getElementById('tickLabel');
const seedValue = document.getElementById('seedValue');
const perfLabel = document.getElementById('perfLabel');

let running = true;
let latestWorld = null;
let hasFreshFrame = false;
let cameraSendTimer = null;
let lastRenderAt = 0;

const worker = new Worker(new URL('./sim.worker.js?v=20260224-1', import.meta.url), { type: 'module' });

const COMPONENT_NAMES = ['agent', 'predator', 'apex', 'coral', 'titan', 'decomposer', 'burst', 'resource', 'forceField'];

const state = {
  tick: 0,
  seed: '',
  width: 1200,
  height: 720,
  regime: 'calm',
  camera: { zoom: 1, x: 600, y: 360 },
  perf: { fps: 0, avgStepMs: 0, effectQuality: 1 },
  components: Object.fromEntries(COMPONENT_NAMES.map((n) => [n, new Map()])),
};

function ensureRenderWorld() {
  if (latestWorld) return;
  latestWorld = {
    tick: state.tick,
    width: state.width,
    height: state.height,
    regime: state.regime,
    camera: { ...state.camera },
    ecs: {
      components: {
        position: new Map(),
        velocity: new Map(),
        agent: new Map(),
        predator: new Map(),
        apex: new Map(),
        coral: new Map(),
        titan: new Map(),
        decomposer: new Map(),
        burst: new Map(),
        resource: new Map(),
        forceField: new Map(),
      },
    },
  };
}

function toRenderData(name, e) {
  if (name === 'agent') return { colorHue: e.colorHue, energy: e.energy, age: e.age, evolved: e.evolved, caste: e.caste };
  if (name === 'predator') return { colorHue: e.colorHue, energy: e.energy, age: e.age };
  if (name === 'apex') return { colorHue: e.colorHue, energy: e.energy, age: e.age };
  if (name === 'coral') return { colorHue: e.colorHue, energy: e.energy, age: e.age, dna: e.dna };
  if (name === 'titan') return { colorHue: e.colorHue, energy: e.energy, age: e.age };
  if (name === 'decomposer') return { colorHue: e.colorHue, energy: e.energy, age: e.age };
  if (name === 'burst') return { life: e.life, hue: e.hue };
  if (name === 'resource') return { kind: e.kind, amount: e.amount, age: e.age, cycles: e.cycles, dna: e.dna };
  if (name === 'forceField') return { strength: e.strength, radius: e.radius };
  return {};
}

function upsertRenderEntity(name, e) {
  const comp = latestWorld.ecs.components;
  comp.position.set(e.id, { x: e.x, y: e.y });
  comp.velocity.set(e.id, { vx: e.vx ?? 0, vy: e.vy ?? 0 });
  comp[name].set(e.id, toRenderData(name, e));
}

function removeRenderEntity(name, id) {
  const comp = latestWorld.ecs.components;
  comp[name].delete(id);
  comp.position.delete(id);
  comp.velocity.delete(id);
}

function setFull(listMap, list) {
  listMap.clear();
  for (const e of list || []) listMap.set(e.id, e);
}

function applyDelta(listMap, patch) {
  for (const e of patch?.upserts || []) listMap.set(e.id, e);
  for (const id of patch?.removes || []) listMap.delete(id);
}

function applySnapshot(msg) {
  ensureRenderWorld();

  const s = msg.snapshot;
  state.tick = s.tick;
  state.seed = s.seed;
  state.width = s.width;
  state.height = s.height;
  state.regime = s.regime;
  state.camera = { ...s.camera };
  state.perf = { ...s.perf };

  latestWorld.tick = state.tick;
  latestWorld.width = state.width;
  latestWorld.height = state.height;
  latestWorld.regime = state.regime;
  latestWorld.camera = { ...state.camera };

  const mode = msg.mode || 'full';
  if (mode === 'full') {
    for (const n of COMPONENT_NAMES) {
      setFull(state.components[n], s.components[n]);
      latestWorld.ecs.components[n].clear();
    }
    latestWorld.ecs.components.position.clear();
    latestWorld.ecs.components.velocity.clear();

    for (const n of COMPONENT_NAMES) {
      for (const e of state.components[n].values()) upsertRenderEntity(n, e);
    }
  } else {
    for (const n of COMPONENT_NAMES) {
      applyDelta(state.components[n], s.components[n]);
      for (const e of s.components[n]?.upserts || []) upsertRenderEntity(n, e);
      for (const id of s.components[n]?.removes || []) removeRenderEntity(n, id);
    }
  }
}

worker.onmessage = (e) => {
  if (e.data?.type !== 'snapshot') return;
  applySnapshot(e.data);
  hasFreshFrame = true;
  tickLabel.textContent = `Tick: ${state.tick}`;
  seedValue.textContent = state.seed;
  perfLabel.textContent = `FPS: ${state.perf.fps.toFixed(0)} | Step: ${state.perf.avgStepMs.toFixed(2)}ms | Q: ${Math.round((state.perf.effectQuality ?? 1) * 100)}% | S:${state.perf.updateStride ?? 1} | Snap:${state.perf.snapshotMs ?? 50}ms`;
};

function drawLoop(now) {
  if (latestWorld && hasFreshFrame) {
    const totalEntities =
      state.components.agent.size +
      state.components.predator.size +
      state.components.apex.size +
      state.components.coral.size +
      state.components.titan.size +
      state.components.resource.size;

    const minRenderMs = totalEntities > 4000 ? 50 : totalEntities > 2500 ? 33 : 0;

    if (now - lastRenderAt >= minRenderMs) {
      renderer.render(latestWorld);
      hasFreshFrame = false;
      lastRenderAt = now;
    }
  }
  requestAnimationFrame(drawLoop);
}

function toggleRun() {
  running = !running;
  worker.postMessage({ type: running ? 'resume' : 'pause' });
}

function sendCamera() {
  if (!latestWorld || cameraSendTimer) return;

  cameraSendTimer = setTimeout(() => {
    worker.postMessage({
      type: 'setCamera',
      x: latestWorld.camera.x,
      y: latestWorld.camera.y,
    });
    cameraSendTimer = null;
  }, 33);
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    toggleRun();
    return;
  }

  if (!latestWorld) return;

  const panStep = 80 / Math.max(0.2, latestWorld.camera.zoom);
  let moved = false;

  if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    latestWorld.camera.x -= panStep;
    moved = true;
  } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    latestWorld.camera.x += panStep;
    moved = true;
  } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
    latestWorld.camera.y -= panStep;
    moved = true;
  } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
    latestWorld.camera.y += panStep;
    moved = true;
  }

  if (moved) {
    e.preventDefault();
    sendCamera();
    hasFreshFrame = true;
  }
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (!latestWorld) return;
  const delta = Math.sign(e.deltaY);
  const step = 0.1;
  const fitMin = Math.max(
    canvas.clientWidth / (latestWorld.width || 1200),
    canvas.clientHeight / (latestWorld.height || 720),
  );
  const min = Math.max(0.3, fitMin);
  const max = 8;
  const nextZoom = Math.max(min, Math.min(max, latestWorld.camera.zoom - delta * step));
  latestWorld.camera.zoom = nextZoom;
  worker.postMessage({ type: 'setZoom', zoom: nextZoom });
}, { passive: false });

let dragging = false;
let lastDragX = 0;
let lastDragY = 0;

canvas.addEventListener('mousedown', (e) => {
  dragging = true;
  lastDragX = e.clientX;
  lastDragY = e.clientY;
});

window.addEventListener('mouseup', () => {
  dragging = false;
});

canvas.addEventListener('mousemove', (e) => {
  if (!dragging || !latestWorld) return;
  const dx = e.clientX - lastDragX;
  const dy = e.clientY - lastDragY;
  lastDragX = e.clientX;
  lastDragY = e.clientY;

  latestWorld.camera.x -= dx / Math.max(0.2, latestWorld.camera.zoom);
  latestWorld.camera.y -= dy / Math.max(0.2, latestWorld.camera.zoom);
  hasFreshFrame = true;
  sendCamera();
});

requestAnimationFrame(drawLoop);
