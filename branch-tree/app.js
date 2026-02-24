const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

const ui = {
  resetBtn: document.getElementById('resetBtn'),
  branchChance: document.getElementById('branchChance'),
  stopChance: document.getElementById('stopChance'),
  wind: document.getElementById('wind'),
  stats: document.getElementById('stats'),
};

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

class Tip {
  constructor(x, y, angle, width, energy) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.width = width;
    this.energy = energy;
    this.alive = true;
  }
}

let tips = [];
let segments = 0;

function spawnTree(x, y, scale = 1) {
  const angle = -Math.PI / 2 + (Math.random() * 2 - 1) * 0.12;
  const width = (2.1 + Math.random() * 0.9) * scale;
  const energy = (170 + Math.random() * 110) * scale;
  tips.push(new Tip(x, y, angle, width, energy));
}

function reset() {
  resize();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight);

  const w = window.innerWidth;
  const h = window.innerHeight;
  tips = [];

  spawnTree(w * 0.5, h - 14, 1.0);

  segments = 0;
}

function drawSegment(x1, y1, x2, y2, width, glow = 1) {
  ctx.strokeStyle = `rgba(120, 255, 120, ${0.08 * glow})`;
  ctx.lineWidth = width * 3;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.strokeStyle = `rgba(90, 255, 90, ${0.7 * glow})`;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function step() {
  const branchChance = Number(ui.branchChance.value);
  const stopChance = Number(ui.stopChance.value);
  const wind = Number(ui.wind.value);

  const newTips = [];

  for (const t of tips) {
    if (!t.alive) continue;

    // Stochastic stopping behavior: older/thinner branches stop more often
    const ageStop = (1 - Math.min(1, t.energy / 220)) * 0.04;
    const thinStop = t.width < 0.9 ? 0.03 : 0;
    if (Math.random() < stopChance + ageStop + thinStop || t.energy <= 0 || t.width <= 0.25) {
      t.alive = false;
      continue;
    }

    const jitter = (Math.random() * 2 - 1) * 0.08;
    t.angle += jitter + wind;

    const stepLen = 2.1 + Math.random() * 1.5;
    const nx = t.x + Math.cos(t.angle) * stepLen;
    const ny = t.y + Math.sin(t.angle) * stepLen;

    drawSegment(t.x, t.y, nx, ny, t.width, 1);
    segments++;

    // occasional little leaf sparks
    if (Math.random() < 0.008 && t.width < 1.2) {
      ctx.fillStyle = 'rgba(120,255,120,0.45)';
      ctx.beginPath();
      ctx.arc(nx, ny, 1 + Math.random() * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    t.x = nx;
    t.y = ny;
    t.energy -= 1;
    t.width *= 0.997;

    // Branching event
    const bChance = branchChance * (0.6 + Math.min(1, t.energy / 220));
    if (Math.random() < bChance && t.width > 0.45 && t.energy > 15) {
      const split = 0.2 + Math.random() * 0.55;
      const childA = new Tip(t.x, t.y, t.angle - split, t.width * (0.72 + Math.random() * 0.12), t.energy * 0.63);
      const childB = new Tip(t.x, t.y, t.angle + split, t.width * (0.72 + Math.random() * 0.12), t.energy * 0.63);
      t.energy *= 0.72;
      t.width *= 0.9;
      newTips.push(childA, childB);
    }

    // Reproduction: mature branches can drop a nearby seed that starts a new tree.
    const canReproduce = t.energy > 45 && t.width > 0.55;
    if (canReproduce && Math.random() < 0.0015) {
      const sx = t.x + (Math.random() * 2 - 1) * 90;
      const sy = window.innerHeight - (6 + Math.random() * 16);
      spawnTree(sx, sy, 0.62 + Math.random() * 0.35);
    }

    if (t.x < -50 || t.x > window.innerWidth + 50 || t.y < -50 || t.y > window.innerHeight + 50) {
      t.alive = false;
    }
  }

  tips.push(...newTips);
  tips = tips.filter((t) => t.alive);

  ui.stats.textContent = `active tips: ${tips.length} | segments: ${segments}`;
}

function loop() {
  // keep slight trails instead of full clear
  ctx.fillStyle = 'rgba(0,0,0,0.02)';
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  if (tips.length > 0) {
    // multiple simulation ticks per frame for faster growth
    for (let i = 0; i < 3; i++) step();
  } else {
    // Keep it alive forever: reseed when everything has died out.
    spawnTree(window.innerWidth * 0.5, window.innerHeight - 14, 1.0);
  }

  requestAnimationFrame(loop);
}

ui.resetBtn.addEventListener('click', reset);
window.addEventListener('resize', reset);

canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  spawnTree(x, y, 0.85 + Math.random() * 0.35);
});

reset();
requestAnimationFrame(loop);
