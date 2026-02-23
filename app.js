import { createRng } from './core/rng.js?v=20260223-2';
import { createWorld } from './core/world.js?v=20260223-2';
import { createRenderer } from './core/render.js?v=20260223-2';

let seedStr = String(Date.now());
let rng = createRng(seedStr);
let world = createWorld(rng);

const canvas = document.getElementById('world');
const renderer = createRenderer(canvas);
const tickLabel = document.getElementById('tickLabel');
const seedValue = document.getElementById('seedValue');

seedValue.textContent = seedStr;

const DT = 0.06;
const MS_PER_TICK = DT * 1000;
let running = false;
let lastTime = 0;
let accum = 0;
let rafId = null;

function isExtinct(currentWorld) {
  const { agent, predator, apex, coral } = currentWorld.ecs.components;
  return agent.size === 0 && predator.size === 0 && apex.size === 0 && coral.size === 0;
}

function resetWorld() {
  seedStr = String(Date.now());
  rng = createRng(seedStr);
  world = createWorld(rng);
  seedValue.textContent = seedStr;
  tickLabel.textContent = `Tick: ${world.tick}`;
  renderer.render(world);
}

function loop(now) {
  if (!running) return;

  const elapsed = now - lastTime;
  lastTime = now;
  accum += Math.min(elapsed, 200);

  while (accum >= MS_PER_TICK) {
    world.step(DT);
    accum -= MS_PER_TICK;

    if (isExtinct(world)) {
      resetWorld();
      accum = 0;
      break;
    }
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
  rafId = requestAnimationFrame(loop);
}

function pause() {
  if (!running) return;
  running = false;
  cancelAnimationFrame(rafId);
}

// Minimal controls: space toggles pause/play, wheel zooms.
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space') return;
  e.preventDefault();
  if (running) pause(); else start();
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const delta = Math.sign(e.deltaY);
  const step = 0.1;
  const fitMin = Math.max(
    canvas.clientWidth / world.width,
    canvas.clientHeight / world.height,
  );
  const min = Math.max(0.3, fitMin);
  const max = 4;
  world.camera.zoom = Math.max(min, Math.min(max, world.camera.zoom - delta * step));
  if (!running) renderer.render(world);
}, { passive: false });

requestAnimationFrame(() => {
  renderer.render(world);
  start();
});
