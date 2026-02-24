import { createRenderer } from './core/render.js?v=20260223-2';

const canvas = document.getElementById('world');
const renderer = createRenderer(canvas);
const tickLabel = document.getElementById('tickLabel');
const seedValue = document.getElementById('seedValue');
const perfLabel = document.getElementById('perfLabel');

let running = true;
let latestWorld = null;
let rafId = null;

const worker = new Worker(new URL('./sim.worker.js?v=20260223-3', import.meta.url), { type: 'module' });

function mapFromList(list, shape = (v) => v) {
  const m = new Map();
  for (const item of list || []) {
    const { id } = item;
    m.set(id, shape(item));
  }
  return m;
}

function worldFromSnapshot(s) {
  const position = new Map();
  const velocity = new Map();

  const pushPosVel = (list) => {
    for (const e of list || []) {
      position.set(e.id, { x: e.x, y: e.y });
      velocity.set(e.id, { vx: e.vx ?? 0, vy: e.vy ?? 0 });
    }
  };

  pushPosVel(s.components.agent);
  pushPosVel(s.components.predator);
  pushPosVel(s.components.apex);
  pushPosVel(s.components.coral);
  pushPosVel(s.components.titan);
  pushPosVel(s.components.burst);
  pushPosVel(s.components.resource);
  pushPosVel(s.components.forceField);

  return {
    tick: s.tick,
    width: s.width,
    height: s.height,
    regime: s.regime,
    camera: { ...s.camera },
    ecs: {
      components: {
        position,
        velocity,
        agent: mapFromList(s.components.agent, (e) => ({ colorHue: e.colorHue, energy: e.energy, age: e.age, dna: e.dna, evolved: e.evolved, caste: e.caste })),
        predator: mapFromList(s.components.predator, (e) => ({ colorHue: e.colorHue, energy: e.energy, age: e.age, rest: e.rest, dna: e.dna })),
        apex: mapFromList(s.components.apex, (e) => ({ colorHue: e.colorHue, energy: e.energy, age: e.age, rest: e.rest, dna: e.dna })),
        coral: mapFromList(s.components.coral, (e) => ({ colorHue: e.colorHue, energy: e.energy, age: e.age, rest: e.rest, dna: e.dna })),
        titan: mapFromList(s.components.titan, (e) => ({ colorHue: e.colorHue, energy: e.energy, age: e.age, rest: e.rest, dna: e.dna })),
        burst: mapFromList(s.components.burst, (e) => ({ life: e.life, hue: e.hue })),
        resource: mapFromList(s.components.resource, (e) => ({ kind: e.kind, amount: e.amount, age: e.age, cycles: e.cycles, dna: e.dna })),
        forceField: mapFromList(s.components.forceField, (e) => ({ strength: e.strength, radius: e.radius })),
      },
    },
  };
}

worker.onmessage = (e) => {
  if (e.data?.type !== 'snapshot') return;
  const s = e.data.snapshot;
  latestWorld = worldFromSnapshot(s);
  tickLabel.textContent = `Tick: ${s.tick}`;
  seedValue.textContent = s.seed;
  perfLabel.textContent = `FPS: ${s.perf.fps.toFixed(0)} | Step: ${s.perf.avgStepMs.toFixed(2)}ms | Q: ${Math.round((s.perf.effectQuality ?? 1) * 100)}%`;
};

function drawLoop() {
  if (latestWorld) renderer.render(latestWorld);
  rafId = requestAnimationFrame(drawLoop);
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
  const min = Math.max(0.3, fitMin);
  const max = 4;
  const nextZoom = Math.max(min, Math.min(max, latestWorld.camera.zoom - delta * step));
  latestWorld.camera.zoom = nextZoom;
  worker.postMessage({ type: 'setZoom', zoom: nextZoom });
}, { passive: false });

rafId = requestAnimationFrame(drawLoop);
