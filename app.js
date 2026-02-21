import { createRng } from './core/rng.js';
import { createWorld } from './core/world.js';
import { createRenderer } from './core/render.js';
import { createInspector } from './core/inspector.js';

const FIXED_DT = 0.06; // 60 ms in seconds, fixed sim step

let seed = null;
let rng = null;
let world = null;
let renderer = null;
let inspector = null;

let running = false;
let accumulator = 0;
let lastTime = 0;
let brushActive = false;

function updateLabels() {
  const tickLabel = document.getElementById('tickLabel');
  const seedValue = document.getElementById('seedValue');
  if (tickLabel) tickLabel.textContent = `Tick: ${world.tick}`;
  if (seedValue) seedValue.textContent = seed;
}

function mainLoop(timestamp) {
  if (!running) return;

  if (!lastTime) lastTime = timestamp;
  const deltaMs = timestamp - lastTime;
  lastTime = timestamp;

  accumulator += deltaMs / 1000; // seconds

  while (accumulator >= FIXED_DT) {
    world.step(FIXED_DT);
    accumulator -= FIXED_DT;
  }

  renderer.render(world);
  updateLabels();

  requestAnimationFrame(mainLoop);
}

function start() {
  if (running) return;
  running = true;
  lastTime = 0;
  accumulator = 0;
  document.getElementById('startButton').disabled = true;
  document.getElementById('pauseButton').disabled = false;
  document.getElementById('stepButton').disabled = true;
  requestAnimationFrame(mainLoop);
}

function pause() {
  running = false;
  document.getElementById('startButton').disabled = false;
  document.getElementById('pauseButton').disabled = true;
  document.getElementById('stepButton').disabled = false;
}

function stepOnce() {
  if (!world) return;
  world.step(FIXED_DT);
  renderer.render(world);
  updateLabels();
}

function worldToCanvas(evt, canvas, world) {
  const rect = canvas.getBoundingClientRect();
  const x = evt.clientX - rect.left;
  const y = evt.clientY - rect.top;
  // Assume world units ~ canvas CSS size
  const sx = world.width / rect.width;
  const sy = world.height / rect.height;
  return { x: x * sx, y: y * sy };
}

function init() {
  // Seeded RNG: use current timestamp, but allow deterministic replay by copying the value.
  seed = Date.now().toString(36);
  rng = createRng(seed);
  world = createWorld(rng);
  const canvas = document.getElementById('world');
  renderer = createRenderer(canvas);
  inspector = createInspector(world);

  updateLabels();

  const startBtn = document.getElementById('startButton');
  const pauseBtn = document.getElementById('pauseButton');
  const stepBtn = document.getElementById('stepButton');
  const spawnAgentBtn = document.getElementById('spawnAgentButton');
  const spawnResourceBtn = document.getElementById('spawnResourceButton');
  const forceBrushBtn = document.getElementById('forceBrushButton');

  startBtn.addEventListener('click', start);
  pauseBtn.addEventListener('click', pause);
  stepBtn.addEventListener('click', stepOnce);

  spawnAgentBtn.addEventListener('click', () => {
    const pos = { x: world.width * 0.5, y: world.height * 0.5 };
    world.spawnAgent?.(pos);
  });

  spawnResourceBtn.addEventListener('click', () => {
    const pos = { x: world.width * 0.5, y: world.height * 0.5 };
    world.spawnResource?.(pos);
  });

  forceBrushBtn.addEventListener('click', () => {
    brushActive = !brushActive;
    forceBrushBtn.classList.toggle('active', brushActive);
  });

  // ForceField brush on canvas (mouse + touch)
  let drawing = false;

  function brushAtClient(x, y, polarity) {
    const p = worldToCanvas({ clientX: x, clientY: y }, canvas, world);
    world.paintForceField?.(p, polarity);
  }

  canvas.addEventListener('mousedown', (evt) => {
    if (!brushActive) return;
    drawing = true;
    brushAtClient(evt.clientX, evt.clientY, evt.shiftKey ? -1 : 1);
  });
  canvas.addEventListener('mousemove', (evt) => {
    if (!brushActive || !drawing) return;
    brushAtClient(evt.clientX, evt.clientY, evt.shiftKey ? -1 : 1);
  });
  window.addEventListener('mouseup', () => {
    drawing = false;
  });

  canvas.addEventListener('touchstart', (evt) => {
    if (!brushActive) return;
    const t = evt.touches[0];
    if (!t) return;
    evt.preventDefault();
    drawing = true;
    // On mobile, use two-finger tap as repulsor (if more than one touch)
    const polarity = evt.touches.length > 1 ? -1 : 1;
    brushAtClient(t.clientX, t.clientY, polarity);
  }, { passive: false });

  canvas.addEventListener('touchmove', (evt) => {
    if (!brushActive || !drawing) return;
    const t = evt.touches[0];
    if (!t) return;
    evt.preventDefault();
    const polarity = evt.touches.length > 1 ? -1 : 1;
    brushAtClient(t.clientX, t.clientY, polarity);
  }, { passive: false });

  window.addEventListener('touchend', () => {
    drawing = false;
  });

  // Entity click for inspector (mouse only; touch uses tap when brush off)
  canvas.addEventListener('click', (evt) => {
    if (brushActive) return; // brush mode ignores click select
    const p = worldToCanvas(evt, canvas, world);
    world.inspectAt?.(p);
  });

  canvas.addEventListener('touchstart', (evt) => {
    if (brushActive) return; // in brush mode, touch handled above
    const t = evt.touches[0];
    if (!t) return;
    // Treat quick single touch as selection
    const p = worldToCanvas({ clientX: t.clientX, clientY: t.clientY }, canvas, world);
    world.inspectAt?.(p);
  }, { passive: true });

  // Wire world callbacks for inspector & tools
  world.inspectAt = (p) => {
    inspector.inspectAt(p);
    renderer.render(world);
  };
  world.refreshInspector = () => inspector.refresh();

  // Tool spawn helpers
  world.spawnAgent = (pos) => {
    if (world.makeAgentAt) {
      world.makeAgentAt(pos.x, pos.y);
      renderer.render(world);
      inspector.refresh();
    }
  };
  world.spawnResource = (pos) => {
    if (world.makeResourceAt) {
      world.makeResourceAt(pos.x, pos.y);
      renderer.render(world);
      inspector.refresh();
    }
  };

  // Initial render (paused)
  renderer.render(world);
}

window.addEventListener('DOMContentLoaded', init);
