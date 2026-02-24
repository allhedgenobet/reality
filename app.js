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
const perfLabel = document.getElementById('perfLabel');

seedValue.textContent = seedStr;

const DT = 0.06;
const MS_PER_TICK = DT * 1000;
let running = false;
let lastTime = 0;
let accum = 0;
let rafId = null;
let fps = 0;
let frameCounter = 0;
let fpsWindowStart = performance.now();
let avgStepMs = 0;

function isExtinct(currentWorld) {
  const { agent, predator, apex, coral, titan } = currentWorld.ecs.components;
  return agent.size === 0 && predator.size === 0 && apex.size === 0 && coral.size === 0 && titan.size === 0;
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
    const t0 = performance.now();
    world.step(DT);
    const stepMs = performance.now() - t0;
    avgStepMs = avgStepMs * 0.9 + stepMs * 0.1;
    accum -= MS_PER_TICK;

    if (isExtinct(world)) {
      resetWorld();
      accum = 0;
      break;
    }
  }

  frameCounter += 1;
  if (now - fpsWindowStart >= 500) {
    fps = (frameCounter * 1000) / (now - fpsWindowStart);
    frameCounter = 0;
    fpsWindowStart = now;
  }

  tickLabel.textContent = `Tick: ${world.tick}`;
  // Adaptive quality: lower effects when sim step cost rises.
  if (avgStepMs > 10 || fps < 30) world.globals.effectQuality = 0.35;
  else if (avgStepMs > 7 || fps < 45) world.globals.effectQuality = 0.6;
  else if (avgStepMs > 5 || fps < 55) world.globals.effectQuality = 0.8;
  else world.globals.effectQuality = 1;

  perfLabel.textContent = `FPS: ${fps.toFixed(0)} | Step: ${avgStepMs.toFixed(2)}ms | Q: ${Math.round(world.globals.effectQuality * 100)}%`;
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
