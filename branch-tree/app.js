const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

const ui = {
  resetBtn: document.getElementById('resetBtn'),
  branchChance: document.getElementById('branchChance'),
  stopChance: document.getElementById('stopChance'),
  wind: document.getElementById('wind'),
  stats: document.getElementById('stats'),
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function createBaseGenes() {
  return {
    branchBias: 1 + (Math.random() * 2 - 1) * 0.18,
    stopBias: 1 + (Math.random() * 2 - 1) * 0.18,
    jitter: 0.045 + (Math.random() * 2 - 1) * 0.015,
    upwardBias: 0.014 + (Math.random() * 2 - 1) * 0.005,
    vigor: 1 + (Math.random() * 2 - 1) * 0.2,
  };
}

function mutateGenes(parent, m = 0.06) {
  return {
    branchBias: clamp(parent.branchBias + (Math.random() * 2 - 1) * m, 0.55, 1.7),
    stopBias: clamp(parent.stopBias + (Math.random() * 2 - 1) * m, 0.5, 1.8),
    jitter: clamp(parent.jitter + (Math.random() * 2 - 1) * m * 0.08, 0.01, 0.09),
    upwardBias: clamp(parent.upwardBias + (Math.random() * 2 - 1) * m * 0.02, 0.004, 0.03),
    vigor: clamp(parent.vigor + (Math.random() * 2 - 1) * m * 1.1, 0.6, 1.6),
  };
}

class Tip {
  constructor(x, y, angle, width, energy, genes) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.width = width;
    this.energy = energy;
    this.genes = genes;
    this.alive = true;
  }
}

let tips = [];
let segments = 0;

function spawnTree(x, y, scale = 1, inheritedGenes = null) {
  const angle = -Math.PI / 2 + (Math.random() * 2 - 1) * 0.07;
  const genes = inheritedGenes ? mutateGenes(inheritedGenes, 0.08) : createBaseGenes();
  const width = (2.1 + Math.random() * 0.9) * scale * genes.vigor;
  const energy = (280 + Math.random() * 170) * scale * genes.vigor;
  tips.push(new Tip(x, y, angle, width, energy, genes));
}

function reset() {
  resize();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight);

  tips = [];
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

    const g = t.genes;

    const ageStop = (1 - Math.min(1, t.energy / (320 * g.vigor))) * 0.028;
    const thinStop = t.width < 0.9 ? 0.03 : 0;
    const effectiveStop = (stopChance + ageStop + thinStop) * g.stopBias;
    if (Math.random() < effectiveStop || t.energy <= 0 || t.width <= 0.25) {
      t.alive = false;
      continue;
    }

    const jitter = (Math.random() * 2 - 1) * g.jitter;
    const upwardBias = (-Math.PI / 2 - t.angle) * g.upwardBias;
    t.angle += jitter + wind + upwardBias;

    const stepLen = (2.1 + Math.random() * 1.5) * (0.9 + 0.25 * g.vigor);
    const nx = t.x + Math.cos(t.angle) * stepLen;
    const ny = t.y + Math.sin(t.angle) * stepLen;

    drawSegment(t.x, t.y, nx, ny, t.width, 1);
    segments++;

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

    const bChance = branchChance * (0.6 + Math.min(1, t.energy / 220)) * g.branchBias;
    if (Math.random() < bChance && t.width > 0.45 && t.energy > 15) {
      const split = 0.2 + Math.random() * 0.55;
      const childGenesA = mutateGenes(g, 0.02);
      const childGenesB = mutateGenes(g, 0.02);
      const childA = new Tip(t.x, t.y, t.angle - split, t.width * (0.72 + Math.random() * 0.12), t.energy * 0.63, childGenesA);
      const childB = new Tip(t.x, t.y, t.angle + split, t.width * (0.72 + Math.random() * 0.12), t.energy * 0.63, childGenesB);
      t.energy *= 0.72;
      t.width *= 0.9;
      newTips.push(childA, childB);
    }

    const canReproduce = t.energy > 45 && t.width > 0.55;
    if (canReproduce && Math.random() < 0.0015) {
      const sx = t.x + (Math.random() * 2 - 1) * 90;
      const sy = window.innerHeight - (6 + Math.random() * 16);
      spawnTree(sx, sy, 0.62 + Math.random() * 0.35, g);
    }

    if (t.x < -50 || t.x > window.innerWidth + 50 || t.y < -50 || t.y > window.innerHeight + 50) {
      t.alive = false;
    }
  }

  tips.push(...newTips);
  tips = tips.filter((t) => t.alive);

  let avgVigor = 0;
  let avgBranch = 0;
  for (const t of tips) {
    avgVigor += t.genes.vigor;
    avgBranch += t.genes.branchBias;
  }
  const n = Math.max(1, tips.length);
  avgVigor /= n;
  avgBranch /= n;

  ui.stats.textContent = `active tips: ${tips.length} | segments: ${segments} | vigor:${avgVigor.toFixed(2)} | branch:${avgBranch.toFixed(2)}`;
}

function loop() {
  ctx.fillStyle = 'rgba(0,0,0,0.02)';
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  if (tips.length > 0) {
    for (let i = 0; i < 3; i++) step();
  }

  requestAnimationFrame(loop);
}

ui.resetBtn.addEventListener('click', reset);
window.addEventListener('resize', reset);

canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Drop a visible seed, then germinate.
  ctx.fillStyle = 'rgba(150,255,150,0.85)';
  ctx.beginPath();
  ctx.arc(x, y, 2.2, 0, Math.PI * 2);
  ctx.fill();

  setTimeout(() => {
    spawnTree(x, y, 0.85 + Math.random() * 0.35);
  }, 110);
});

reset();
requestAnimationFrame(loop);
