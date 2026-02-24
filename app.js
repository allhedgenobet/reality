import { createRenderer } from './core/render.js?v=20260223-2';

const canvas = document.getElementById('world');
const renderer = createRenderer(canvas);
const tickLabel = document.getElementById('tickLabel');
const seedValue = document.getElementById('seedValue');
const perfLabel = document.getElementById('perfLabel');

let running = true;
let latestWorld = null;
let hasFreshFrame = false;

const worker = new Worker(new URL('./sim.worker.js?v=20260223-8', import.meta.url), { type: 'module' });

const state = {
  tick: 0,
  seed: '',
  width: 1200,
  height: 720,
  regime: 'calm',
  camera: { zoom: 1, x: 600, y: 360 },
  perf: { fps: 0, avgStepMs: 0, effectQuality: 1 },
  components: {
    agent: new Map(),
    predator: new Map(),
    apex: new Map(),
    coral: new Map(),
    titan: new Map(),
    burst: new Map(),
    resource: new Map(),
    forceField: new Map(),
  },
};

function setFull(listMap, list) {
  listMap.clear();
  for (const e of list || []) listMap.set(e.id, e);
}

function applyDelta(listMap, patch) {
  for (const e of patch?.upserts || []) listMap.set(e.id, e);
  for (const id of patch?.removes || []) listMap.delete(id);
}

function applySnapshot(msg) {
  const s = msg.snapshot;
  state.tick = s.tick;
  state.seed = s.seed;
  state.width = s.width;
  state.height = s.height;
  state.regime = s.regime;
  state.camera = { ...s.camera };
  state.perf = { ...s.perf };

  const mode = msg.mode || 'full';
  const names = ['agent', 'predator', 'apex', 'coral', 'titan', 'burst', 'resource', 'forceField'];

  if (mode === 'full') {
    for (const n of names) setFull(state.components[n], s.components[n]);
  } else {
    for (const n of names) applyDelta(state.components[n], s.components[n]);
  }
}

function mapFromEntries(src, pick) {
  const m = new Map();
  for (const [id, e] of src.entries()) m.set(id, pick(e));
  return m;
}

function buildRenderWorld() {
  const position = new Map();
  const velocity = new Map();

  const addPos = (comp) => {
    for (const [id, e] of comp.entries()) {
      position.set(id, { x: e.x, y: e.y });
      velocity.set(id, { vx: e.vx ?? 0, vy: e.vy ?? 0 });
    }
  };

  addPos(state.components.agent);
  addPos(state.components.predator);
  addPos(state.components.apex);
  addPos(state.components.coral);
  addPos(state.components.titan);
  addPos(state.components.burst);
  addPos(state.components.resource);
  addPos(state.components.forceField);

  latestWorld = {
    tick: state.tick,
    width: state.width,
    height: state.height,
    regime: state.regime,
    camera: { ...state.camera },
    ecs: {
      components: {
        position,
        velocity,
        agent: mapFromEntries(state.components.agent, (e) => ({ colorHue: e.colorHue, energy: e.energy, age: e.age, evolved: e.evolved, caste: e.caste })),
        predator: mapFromEntries(state.components.predator, (e) => ({ colorHue: e.colorHue, energy: e.energy, age: e.age })),
        apex: mapFromEntries(state.components.apex, (e) => ({ colorHue: e.colorHue, energy: e.energy, age: e.age })),
        coral: mapFromEntries(state.components.coral, (e) => ({ colorHue: e.colorHue, energy: e.energy, age: e.age, dna: e.dna })),
        titan: mapFromEntries(state.components.titan, (e) => ({ colorHue: e.colorHue, energy: e.energy, age: e.age })),
        burst: mapFromEntries(state.components.burst, (e) => ({ life: e.life, hue: e.hue })),
        resource: mapFromEntries(state.components.resource, (e) => ({ kind: e.kind, amount: e.amount, age: e.age, cycles: e.cycles, dna: e.dna })),
        forceField: mapFromEntries(state.components.forceField, (e) => ({ strength: e.strength, radius: e.radius })),
      },
    },
  };
}

worker.onmessage = (e) => {
  if (e.data?.type !== 'snapshot') return;
  applySnapshot(e.data);
  buildRenderWorld();
  hasFreshFrame = true;
  tickLabel.textContent = `Tick: ${state.tick}`;
  seedValue.textContent = state.seed;
  perfLabel.textContent = `FPS: ${state.perf.fps.toFixed(0)} | Step: ${state.perf.avgStepMs.toFixed(2)}ms | Q: ${Math.round((state.perf.effectQuality ?? 1) * 100)}% | S:${state.perf.updateStride ?? 1} | Snap:${state.perf.snapshotMs ?? 50}ms`;
};

function drawLoop() {
  if (latestWorld && hasFreshFrame) {
    renderer.render(latestWorld);
    hasFreshFrame = false;
  }
  requestAnimationFrame(drawLoop);
}

function toggleRun() {
  running = !running;
  worker.postMessage({ type: running ? 'resume' : 'pause' });
}

window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space') return;
  e.preventDefault();
  toggleRun();
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
  const min = Math.max(0.3, fitMin); // keep viewport fully populated
  const max = 8;
  const nextZoom = Math.max(min, Math.min(max, latestWorld.camera.zoom - delta * step));
  latestWorld.camera.zoom = nextZoom;
  worker.postMessage({ type: 'setZoom', zoom: nextZoom });
}, { passive: false });

requestAnimationFrame(drawLoop);
