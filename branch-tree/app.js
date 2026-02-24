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

  occW = w;
  occH = h;
  occupancy = new Uint8Array(occW * occH);
}

function occIndex(x, y) {
  const xi = Math.max(0, Math.min(occW - 1, Math.round(x))); 
  const yi = Math.max(0, Math.min(occH - 1, Math.round(y)));
  return yi * occW + xi;
}

function createBaseGenes() {
  return {
    branchBias: 1 + (Math.random() * 2 - 1) * 0.22,
    stopBias: 1 + (Math.random() * 2 - 1) * 0.22,
    jitter: 0.035 + (Math.random() * 2 - 1) * 0.015,
    turnBias: (Math.random() * 2 - 1) * 0.02,
    curl: 0.012 + Math.random() * 0.035,
    vigor: 1 + (Math.random() * 2 - 1) * 0.24,
    hue: 120 + (Math.random() * 2 - 1) * 18,
    glow: 1 + (Math.random() * 2 - 1) * 0.2,
  };
}

function mutateGenes(parent, m = 0.1) {
  return {
    branchBias: clamp(parent.branchBias + (Math.random() * 2 - 1) * m, 0.45, 1.95),
    stopBias: clamp(parent.stopBias + (Math.random() * 2 - 1) * m, 0.4, 2.0),
    jitter: clamp(parent.jitter + (Math.random() * 2 - 1) * m * 0.09, 0.006, 0.09),
    turnBias: clamp(parent.turnBias + (Math.random() * 2 - 1) * m * 0.035, -0.08, 0.08),
    curl: clamp(parent.curl + (Math.random() * 2 - 1) * m * 0.05, 0.004, 0.07),
    vigor: clamp(parent.vigor + (Math.random() * 2 - 1) * m * 1.25, 0.5, 1.9),
    hue: clamp(parent.hue + (Math.random() * 2 - 1) * m * 24, 85, 150),
    glow: clamp(parent.glow + (Math.random() * 2 - 1) * m * 0.7, 0.65, 1.45),
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
    this.grazed = 0;
    this.alive = true;
  }
}

let tips = [];
let segments = 0;
let grazers = [];
let predators = [];
let occupancy = null;
let occW = 0;
let occH = 0;

function spawnTree(x, y, scale = 1, inheritedGenes = null) {
  const angle = Math.random() * Math.PI * 2;
  const genes = inheritedGenes ? mutateGenes(inheritedGenes, 0.13) : createBaseGenes();
  const width = (2.1 + Math.random() * 0.9) * scale * genes.vigor;
  const energy = (420 + Math.random() * 260) * scale * genes.vigor;
  tips.push(new Tip(x, y, angle, width, energy, genes));
  if (occupancy) occupancy[occIndex(x, y)] = 1;
}

function reset() {
  resize();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight);

  tips = [];
  grazers = [];
  predators = [];
  if (occupancy) occupancy.fill(0);
  segments = 0;
}

function drawSegment(x1, y1, x2, y2, width, genes, glow = 1, grazed = 0) {
  const h = genes?.hue ?? 120;
  const g = genes?.glow ?? 1;
  const grazeMix = clamp(grazed, 0, 1);
  const hue = h * (1 - grazeMix) + 52 * grazeMix;
  const sat = 100 - grazeMix * 20;
  const lightA = 72 * (1 - grazeMix) + 58 * grazeMix;
  const lightB = 60 * (1 - grazeMix) + 47 * grazeMix;

  ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${lightA}%, ${0.1 * glow * g})`;
  ctx.lineWidth = width * 3;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${lightB}%, ${(0.82 + grazeMix * 0.12) * glow * g})`;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function maybeSpawnGrazersFromDensity() {
  if (tips.length < 70) return;

  const cell = 90;
  const counts = new Map();
  for (const t of tips) {
    const cx = Math.floor(t.x / cell);
    const cy = Math.floor(t.y / cell);
    const key = `${cx},${cy}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  for (const [key, count] of counts.entries()) {
    if (count < 18 || Math.random() > 0.06) continue;
    const [cx, cy] = key.split(',').map(Number);
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.35 + Math.random() * 0.7;
    grazers.push({
      x: (cx + 0.5) * cell,
      y: (cy + 0.5) * cell,
      px: (cx + 0.5) * cell,
      py: (cy + 0.5) * cell,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 11,
      maxR: 52 + Math.random() * 24,
      life: 1,
      growRate: 0.2 + Math.random() * 0.28,
      fadeRate: 0.0018 + Math.random() * 0.0022,
      turniness: 0.03 + Math.random() * 0.06,
      breedCooldown: 220 + Math.random() * 180,
    });
    break;
  }
}

function updateGrazers() {
  const newborn = [];

  for (const z of grazers) {
    z.r = Math.min(z.maxR, z.r + z.growRate);
    z.life -= z.fadeRate;

    // Wander movement
    z.vx += (Math.random() * 2 - 1) * z.turniness;
    z.vy += (Math.random() * 2 - 1) * z.turniness;
    const vMag = Math.hypot(z.vx, z.vy) || 1;
    const targetSpeed = 0.22 + z.life * 0.5;
    z.vx = (z.vx / vMag) * targetSpeed;
    z.vy = (z.vy / vMag) * targetSpeed;

    // Erase prior grazer body so it doesn't leave trails.
    if (Number.isFinite(z.px) && Number.isFinite(z.py)) {
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.beginPath();
      ctx.arc(z.px, z.py, 4.2, 0, Math.PI * 2);
      ctx.fill();
    }

    z.x += z.vx;
    z.y += z.vy;

    // bounce off bounds
    if (z.x < 0 || z.x > window.innerWidth) z.vx *= -1;
    if (z.y < 0 || z.y > window.innerHeight) z.vy *= -1;
    z.x = clamp(z.x, 0, window.innerWidth);
    z.y = clamp(z.y, 0, window.innerHeight);

    // Grazer reproduction: occasionally bud a child near rich tree areas
    z.breedCooldown -= 1;
    if (z.breedCooldown <= 0 && z.life > 0.25) {
      let nearbyTips = 0;
      const rr = 42;
      for (const t of tips) {
        const dx = t.x - z.x;
        const dy = t.y - z.y;
        if (dx * dx + dy * dy < rr * rr) nearbyTips++;
      }
      if (nearbyTips > 8 && Math.random() < 0.28) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 0.18 + Math.random() * 0.35;
        newborn.push({
          x: z.x + Math.cos(ang) * 8,
          y: z.y + Math.sin(ang) * 8,
          px: z.x + Math.cos(ang) * 8,
          py: z.y + Math.sin(ang) * 8,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          r: 7,
          maxR: 30 + Math.random() * 14,
          life: 0.75,
          growRate: 0.1 + Math.random() * 0.15,
          fadeRate: z.fadeRate * (1.05 + Math.random() * 0.3),
          turniness: z.turniness,
          breedCooldown: 130 + Math.random() * 130,
        });
      }
      z.breedCooldown = 95 + Math.random() * 110;
    }

    // Grazer body (small circular unit)
    const bodyR = 1.6 + z.life * 0.8;
    ctx.fillStyle = `rgba(245,230,165,${0.55 * z.life + 0.18})`;
    ctx.beginPath();
    ctx.arc(z.x, z.y, bodyR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(120,95,36,${0.35 * z.life + 0.2})`;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.arc(z.x, z.y, bodyR, 0, Math.PI * 2);
    ctx.stroke();

    z.px = z.x;
    z.py = z.y;
  }

  grazers.push(...newborn);
  grazers = grazers.filter((z) => z.life > 0.02);
}

function updatePredators() {
  // Spawn predators when grazer population gets dense
  if (grazers.length > 18 && Math.random() < 0.03) {
    const g = grazers[(Math.random() * grazers.length) | 0];
    if (g) {
      const a = Math.random() * Math.PI * 2;
      predators.push({
        x: g.x + Math.cos(a) * 14,
        y: g.y + Math.sin(a) * 14,
        vx: Math.cos(a) * (0.45 + Math.random() * 0.45),
        vy: Math.sin(a) * (0.45 + Math.random() * 0.45),
        life: 1,
        fadeRate: 0.0018 + Math.random() * 0.0025,
        turniness: 0.025 + Math.random() * 0.05,
        hunger: 0,
      });
    }
  }

  for (const p of predators) {
    p.life -= p.fadeRate;
    p.hunger += 0.004;

    // Seek nearby grazers
    let target = null;
    let bestD2 = Infinity;
    for (const g of grazers) {
      const dx = g.x - p.x;
      const dy = g.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2 && d2 < 120 * 120) {
        bestD2 = d2;
        target = g;
      }
    }

    if (target) {
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      p.vx += (dx / d) * 0.08;
      p.vy += (dy / d) * 0.08;

      if (d < 8) {
        // eat grazer
        target.life -= 0.22;
        p.hunger = Math.max(0, p.hunger - 0.45);
        p.life = Math.min(1.2, p.life + 0.04);
      }
    }

    p.vx += (Math.random() * 2 - 1) * p.turniness;
    p.vy += (Math.random() * 2 - 1) * p.turniness;

    const sp = Math.hypot(p.vx, p.vy) || 1;
    const targetSpeed = 0.6 + p.hunger * 0.55;
    p.vx = (p.vx / sp) * targetSpeed;
    p.vy = (p.vy / sp) * targetSpeed;

    p.x += p.vx;
    p.y += p.vy;

    if (p.x < 0 || p.x > window.innerWidth) p.vx *= -1;
    if (p.y < 0 || p.y > window.innerHeight) p.vy *= -1;
    p.x = clamp(p.x, 0, window.innerWidth);
    p.y = clamp(p.y, 0, window.innerHeight);

    // Predator render (small red-orange dot)
    const r = 1.8 + p.life * 0.9;
    ctx.fillStyle = `rgba(255,120,90,${0.55 * p.life + 0.15})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(120,35,20,${0.4 * p.life + 0.2})`;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  predators = predators.filter((p) => p.life > 0.02);
}

function step() {
  const branchChance = Number(ui.branchChance.value);
  const stopChance = Number(ui.stopChance.value);
  const wind = Number(ui.wind.value);

  maybeSpawnGrazersFromDensity();
  updateGrazers();
  updatePredators();

  // Competition pressure: local crowding raises stress and limits runaway growth.
  const cell = 70;
  const density = new Map();
  for (const t of tips) {
    const cx = Math.floor(t.x / cell);
    const cy = Math.floor(t.y / cell);
    const key = `${cx},${cy}`;
    density.set(key, (density.get(key) || 0) + 1);
  }

  const newTips = [];

  for (const t of tips) {
    if (!t.alive) continue;

    const g = t.genes;

    let grazeExposure = 0;
    for (const z of grazers) {
      const dx = t.x - z.x;
      const dy = t.y - z.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > z.r * z.r) continue;
      const d = Math.sqrt(d2) || 1;
      grazeExposure += (1 - d / z.r) * z.life;
    }

    const cx = Math.floor(t.x / cell);
    const cy = Math.floor(t.y / cell);
    const localN = density.get(`${cx},${cy}`) || 0;
    const competition = Math.max(0, (localN - 7) * 0.03);

    t.grazed = Math.max(0, t.grazed * 0.88 + grazeExposure * 1.05);
    if (t.grazed > 0.05) {
      t.energy -= 1.25 * t.grazed;
      t.width *= 1 - 0.0052 * t.grazed;
    }

    if (competition > 0) {
      t.energy -= 0.55 * competition;
      t.width *= 1 - 0.0022 * competition;
    }

    const ageStop = (1 - Math.min(1, t.energy / (320 * g.vigor))) * 0.028;
    const thinStop = t.width < 0.9 ? 0.03 : 0;
    const grazeStop = t.grazed * 0.042;
    const compStop = competition * 0.08;
    const effectiveStop = (stopChance + ageStop + thinStop + grazeStop + compStop) * g.stopBias;
    if (Math.random() < effectiveStop || t.energy <= 0 || t.width <= 0.25) {
      t.alive = false;
      continue;
    }

    const jitter = (Math.random() * 2 - 1) * g.jitter;
    const curlDir = Math.sin((t.x + t.y) * 0.01) >= 0 ? 1 : -1;
    t.angle += jitter + wind * 0.55 + g.turnBias + curlDir * g.curl;

    const stepLen = (0.8 + Math.random() * 0.65) * (0.85 + 0.18 * g.vigor);
    const nx = t.x + Math.cos(t.angle) * stepLen;
    const ny = t.y + Math.sin(t.angle) * stepLen;

    // One-branch-per-pixel rule: if target pixel already occupied, stop this tip.
    const idx = occIndex(nx, ny);
    if (occupancy[idx] === 1) {
      t.alive = false;
      continue;
    }

    drawSegment(t.x, t.y, nx, ny, t.width, g, 1, t.grazed);
    occupancy[idx] = 1;
    segments++;

    if (Math.random() < 0.008 && t.width < 1.2) {
      ctx.fillStyle = 'rgba(120,255,120,0.45)';
      ctx.beginPath();
      ctx.arc(nx, ny, 1 + Math.random() * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    t.x = nx;
    t.y = ny;
    t.energy -= 0.72;
    t.width *= 0.9983;

    const crowdingFactor = 1 / (1 + competition * 3.5);
    const bChance = branchChance * 0.88 * (0.6 + Math.min(1, t.energy / 220)) * g.branchBias * crowdingFactor;
    if (Math.random() < bChance && t.width > 0.45 && t.energy > 15) {
      // maze-like splits: mostly orthogonal-ish branch turns
      const split = (Math.PI * 0.5) * (0.75 + Math.random() * 0.35);
      const childGenesA = mutateGenes(g, 0.08);
      const childGenesB = mutateGenes(g, 0.08);
      const childA = new Tip(t.x, t.y, t.angle - split, t.width * (0.72 + Math.random() * 0.12), t.energy * 0.63, childGenesA);
      const childB = new Tip(t.x, t.y, t.angle + split, t.width * (0.72 + Math.random() * 0.12), t.energy * 0.63, childGenesB);
      t.energy *= 0.72;
      t.width *= 0.9;
      newTips.push(childA, childB);
    }

    const canReproduce = t.energy > 45 && t.width > 0.55;
    if (canReproduce && Math.random() < 0.0038 * crowdingFactor) {
      const sx = t.x + (Math.random() * 2 - 1) * 14;
      const sy = t.y + (Math.random() * 2 - 1) * 14;
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

  ui.stats.textContent = `active tips: ${tips.length} | segments: ${segments} | grazers:${grazers.length} | predators:${predators.length} | vigor:${avgVigor.toFixed(2)} | branch:${avgBranch.toFixed(2)}`;
}

function loop() {
  // Much slower fade so branches persist visually instead of washing out quickly.
  ctx.fillStyle = 'rgba(0,0,0,0.006)';
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  if (tips.length > 0) {
    step();
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