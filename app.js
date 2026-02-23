import { createRng } from './core/rng.js';
import { createWorld } from './core/world.js';
import { createRenderer } from './core/render.js';

// --- Seed & world setup ---
const seedStr = String(Date.now());
const rng = createRng(seedStr);
const world = createWorld(rng);
const canvas = document.getElementById('world');
const renderer = createRenderer(canvas);

// --- UI elements ---
const startButton = document.getElementById('startButton');
const pauseButton = document.getElementById('pauseButton');
const stepButton = document.getElementById('stepButton');
const spawnAgentButton = document.getElementById('spawnAgentButton');
const spawnResourceButton = document.getElementById('spawnResourceButton');
const spawnCoralButton = document.getElementById('spawnCoralButton');
const forceBrushButton = document.getElementById('forceBrushButton');
const zoomInButton = document.getElementById('zoomInButton');
const zoomOutButton = document.getElementById('zoomOutButton');
const tickLabel = document.getElementById('tickLabel');
const seedValue = document.getElementById('seedValue');

seedValue.textContent = seedStr;

// --- Fixed-timestep loop ---
const DT = 0.06;
const MS_PER_TICK = DT * 1000;
let running = false;
let lastTime = 0;
let accum = 0;
let rafId = null;

function loop(now) {
  if (!running) return;
  const elapsed = now - lastTime;
  lastTime = now;
  accum += Math.min(elapsed, 200);
  while (accum >= MS_PER_TICK) {
    world.step(DT);
    accum -= MS_PER_TICK;
  }
  tickLabel.textContent = `Tick: ${world.tick}`;
  renderer.render(world);
  rafId = requestAnimationFrame(loop);
}

function start() {
  if (running) return;
  running = true;
  lastTime = performance.now();
  accum = 0;
  startButton.disabled = true;
  pauseButton.disabled = false;
  stepButton.disabled = false;
  rafId = requestAnimationFrame(loop);
}

function pause() {
  if (!running) return;
  running = false;
  cancelAnimationFrame(rafId);
  startButton.disabled = false;
  pauseButton.disabled = true;
}

function step() {
  if (running) return;
  world.step(DT);
  tickLabel.textContent = `Tick: ${world.tick}`;
  renderer.render(world);
}

startButton.addEventListener('click', start);
pauseButton.addEventListener('click', pause);
stepButton.addEventListener('click', step);

// --- Tool modes ---
let toolMode = null; // 'spawn-agent' | 'spawn-resource' | 'force' | null

function setToolMode(mode) {
  toolMode = toolMode === mode ? null : mode;
  spawnAgentButton.classList.toggle('active', toolMode === 'spawn-agent');
  spawnResourceButton.classList.toggle('active', toolMode === 'spawn-resource');
  spawnCoralButton.classList.toggle('active', toolMode === 'spawn-coral');
  forceBrushButton.classList.toggle('active', toolMode === 'force');
}

spawnAgentButton.addEventListener('click', () => setToolMode('spawn-agent'));
spawnResourceButton.addEventListener('click', () => setToolMode('spawn-resource'));
spawnCoralButton.addEventListener('click', () => setToolMode('spawn-coral'));
forceBrushButton.addEventListener('click', () => setToolMode('force'));

// --- Zoom ---
const ZOOM_STEP = 0.15;
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 4.0;

zoomInButton.addEventListener('click', () => {
  world.camera.zoom = Math.min(ZOOM_MAX, world.camera.zoom + ZOOM_STEP);
  if (!running) renderer.render(world);
});

zoomOutButton.addEventListener('click', () => {
  world.camera.zoom = Math.max(ZOOM_MIN, world.camera.zoom - ZOOM_STEP);
  if (!running) renderer.render(world);
});

// --- Canvas coordinate mapping ---
// Inverse of the camera transform applied in render.js:
//   ctx.translate(canvasW * 0.5, canvasH * 0.5)
//   ctx.scale(cam.zoom, cam.zoom)
//   ctx.translate(-cam.x, -cam.y)
function canvasToWorld(e) {
  const rect = canvas.getBoundingClientRect();
  const cssX = e.clientX - rect.left;
  const cssY = e.clientY - rect.top;
  const cam = world.camera;
  const wx = (cssX - rect.width * 0.5) / cam.zoom + cam.x;
  const wy = (cssY - rect.height * 0.5) / cam.zoom + cam.y;
  return { x: wx, y: wy };
}

// --- Canvas interaction ---
let pointerDown = false;

canvas.addEventListener('mousedown', (e) => {
  pointerDown = true;
  const wp = canvasToWorld(e);
  handleInteract(wp, e, true);
});

canvas.addEventListener('mousemove', (e) => {
  if (!pointerDown) return;
  const wp = canvasToWorld(e);
  handleInteract(wp, e, false);
});

canvas.addEventListener('mouseup', () => { pointerDown = false; });
canvas.addEventListener('mouseleave', () => { pointerDown = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function handleInteract(wp, e, isDown) {
  if (toolMode === 'force') {
    const polarity = (e.buttons & 2) ? -1 : 1;
    world.paintForceField(wp, polarity);
  } else if (isDown && toolMode === 'spawn-agent') {
    spawnAgent(wp);
  } else if (isDown && toolMode === 'spawn-resource') {
    spawnResource(wp);
  } else if (isDown && toolMode === 'spawn-coral') {
    spawnCoral(wp);
  }
}

function spawnAgent(pos) {
  const { ecs } = world;
  const id = ecs.createEntity();
  const hueShift = rng.int(-40, 40);
  ecs.components.position.set(id, { x: pos.x, y: pos.y });
  ecs.components.velocity.set(id, {
    vx: (rng.float() - 0.5) * 40,
    vy: (rng.float() - 0.5) * 40,
  });
  ecs.components.agent.set(id, {
    colorHue: 200 + hueShift,
    energy: 1.0,
    age: 0,
    dna: {
      speed: 0.8 + rng.float() * 0.4,
      sense: 0.8 + rng.float() * 0.4,
      metabolism: 0.8 + rng.float() * 0.4,
      hueShift,
    },
    evolved: false,
    caste: 'balanced',
  });
}

function spawnResource(pos) {
  const { ecs } = world;
  const id = ecs.createEntity();
  ecs.components.position.set(id, { x: pos.x, y: pos.y });
  ecs.components.resource.set(id, {
    kind: 'plant',
    amount: 1,
    regenTimer: 5,
    age: 0,
    cycles: 0,
    seedTimer: null,
    dna: {
      branchCount: 2 + rng.int(0, 4),
      branchAngle: 0.4 + rng.float() * 0.8,
      curvature: 0.2 + rng.float() * 0.6,
      segmentLength: 10 + rng.float() * 12,
      thickness: 0.6 + rng.float() * 0.8,
      depth: 0.2 + rng.float() * 0.7,
      lean: (rng.float() - 0.5) * 0.6,
    },
  });
}

function spawnCoral(pos) {
  const { ecs } = world;
  const id = ecs.createEntity();
  const hueShift = rng.int(-20, 20);
  ecs.components.position.set(id, { x: pos.x, y: pos.y });
  ecs.components.velocity.set(id, {
    vx: (rng.float() - 0.5) * 40,
    vy: (rng.float() - 0.5) * 40,
  });
  ecs.components.coral.set(id, {
    colorHue: 340 + hueShift,
    energy: 1.5,
    age: 0,
    rest: 0,
    dna: {
      speed: 0.5 + rng.float() * 0.8,
      sense: 0.7 + rng.float() * 0.8,
      metabolism: 0.5 + rng.float() * 0.8,
      hueShift,
      venom: rng.float() * 0.6,
    },
  });
}

// --- Initial render (deferred to ensure canvas is laid out) ---
requestAnimationFrame(() => renderer.render(world));
