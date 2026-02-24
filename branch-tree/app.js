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

let occupancy, occW, occH;
let nutrients;

let tips = [];
let segments = 0;
let grazers = [];
let predators = [];

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;

  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  occW = w;
  occH = h;

  occupancy = new Uint8Array(w * h);
  nutrients = new Float32Array(w * h);

  for (let i = 0; i < nutrients.length; i++) {
    nutrients[i] = Math.random() * 0.8 + 0.2;
  }
}

function occIndex(x, y) {
  const xi = Math.max(0, Math.min(occW - 1, Math.round(x)));
  const yi = Math.max(0, Math.min(occH - 1, Math.round(y)));
  return yi * occW + xi;
}

function updateNutrients() {
  for (let i = 0; i < nutrients.length; i++) {
    nutrients[i] = Math.min(1, nutrients[i] + 0.0008);
  }
}

/* =========================
   GENETICS + HERITAGE COLOR
========================= */

function createBaseGenes() {
  const baseHue = 120 + (Math.random() * 2 - 1) * 18;

  return {
    heritageHue: baseHue,
    hueDrift: 0,
    hue: baseHue,

    branchBias: 1 + (Math.random() * 2 - 1) * 0.22,
    stopBias: 1 + (Math.random() * 2 - 1) * 0.22,
    jitter: 0.035,
    turnBias: (Math.random() * 2 - 1) * 0.02,
    curl: 0.02,
    vigor: 1 + (Math.random() * 2 - 1) * 0.24,
    glow: 1,
  };
}

function mutateGenes(p, m = 0.1) {

  let heritageHue = p.heritageHue;
  let drift = clamp(
    p.hueDrift + (Math.random() * 2 - 1) * m * 3,
    -35,
    35
  );

  // 👽 SPECIES EVENT (alien civilization moment)
  if (Math.random() < 0.0005) {
    heritageHue = (heritageHue + 50 + Math.random() * 80) % 360;
    drift = 0;
  }

  const finalHue = clamp(heritageHue + drift, 40, 340);

  return {
    ...p,
    heritageHue,
    hueDrift: drift,
    hue: finalHue,

    branchBias: clamp(p.branchBias + (Math.random()*2-1)*m,0.45,1.95),
    stopBias: clamp(p.stopBias + (Math.random()*2-1)*m,0.4,2),
    jitter: clamp(p.jitter + (Math.random()*2-1)*m*0.09,0.006,0.09),
    turnBias: clamp(p.turnBias + (Math.random()*2-1)*m*0.035,-0.08,0.08),
    curl: clamp(p.curl + (Math.random()*2-1)*m*0.05,0.004,0.07),
    vigor: clamp(p.vigor + (Math.random()*2-1)*m*1.25,0.5,1.9),
    glow: clamp(p.glow + (Math.random()*2-1)*m*0.7,0.65,1.45),
  };
}

/* ========================= */

class Tip {
  constructor(x,y,a,w,e,g){
    this.x=x;
    this.y=y;
    this.angle=a;
    this.width=w;
    this.energy=e;
    this.genes=g;
    this.grazed=0;
    this.alive=true;
  }
}

function spawnTree(x,y,scale=1,genes=null){
  const g = genes ? mutateGenes(genes,0.13) : createBaseGenes();

  tips.push(new Tip(
    x,y,
    Math.random()*Math.PI*2,
    (2+Math.random())*scale*g.vigor,
    (420+Math.random()*260)*scale*g.vigor,
    g
  ));
}

function reset(){
  resize();
  ctx.fillStyle='#000';
  ctx.fillRect(0,0,window.innerWidth,window.innerHeight);
  tips=[];
  grazers=[];
  predators=[];
  segments=0;
}

/* =========================
        RENDERING
========================= */

function drawSegment(x1,y1,x2,y2,w,g,graze=0){

  // lineage dominates color
  const hue =
    g.heritageHue * 0.7 +
    g.hue * 0.3;

  ctx.strokeStyle =
    `hsla(${hue},100%,65%,0.78)`;

  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x1,y1);
  ctx.lineTo(x2,y2);
  ctx.stroke();
}

/* ========================= */

function step(){

  updateNutrients();

  const branchChance = Number(ui.branchChance.value);
  const stopChance = Number(ui.stopChance.value);
  const wind = Number(ui.wind.value);

  const newTips=[];

  for(const t of tips){
    if(!t.alive) continue;

    const g = t.genes;

    const idx = occIndex(t.x,t.y);

    // ENERGY FROM ENVIRONMENT
    const food = nutrients[idx];
    t.energy += 0.18 * food;
    nutrients[idx] *= 0.92;

    const ageStop =
      (1 - Math.min(1,t.energy/320))*0.028;

    const effectiveStop =
      (stopChance + ageStop) * g.stopBias;

    if(Math.random()<effectiveStop || t.energy<=0){

      t.alive=false;

      // reseed after death
      if(Math.random()<0.02){
        spawnTree(t.x,t.y,0.45,g);
      }

      continue;
    }

    t.angle +=
      (Math.random()*2-1)*g.jitter +
      wind*0.55 +
      g.turnBias +
      g.curl*Math.sin((t.x+t.y)*0.01);

    const stepLen = 1.2;

    const nx = t.x + Math.cos(t.angle)*stepLen;
    const ny = t.y + Math.sin(t.angle)*stepLen;

    const nidx = occIndex(nx,ny);

    // SOFT OCCUPANCY
    if(occupancy[nidx] >= 3){
      t.angle += (Math.random()*2-1)*1.2;
      t.energy *= 0.97;
      continue;
    }

    drawSegment(t.x,t.y,nx,ny,t.width,g,t.grazed);

    occupancy[nidx]++;
    segments++;

    t.x = nx;
    t.y = ny;

    t.energy -= 0.65;
    t.width *= 0.999;

    // evolutionary pressure
    if(Math.random()<0.01){
      g.branchBias *= 1.001;
    }

    if(Math.random()<branchChance*0.88*g.branchBias && t.energy>15){
      const split = Math.PI*0.5*(0.75+Math.random()*0.35);

      newTips.push(
        new Tip(t.x,t.y,
          t.angle-split,
          t.width*0.75,
          t.energy*0.63,
          mutateGenes(g,0.08)
        )
      );

      newTips.push(
        new Tip(t.x,t.y,
          t.angle+split,
          t.width*0.75,
          t.energy*0.63,
          mutateGenes(g,0.08)
        )
      );

      t.energy *= 0.72;
    }
  }

  tips.push(...newTips);
  tips = tips.filter(t=>t.alive);

  ui.stats.textContent =
    `tips:${tips.length}  segments:${segments}`;
}

function loop(){

  // SUPER SLOW FADE (history preserved)
  ctx.fillStyle='rgba(0,0,0,0.002)';
  ctx.fillRect(0,0,window.innerWidth,window.innerHeight);

  if(tips.length>0){
    step();
  }

  requestAnimationFrame(loop);
}

ui.resetBtn.addEventListener('click',reset);
window.addEventListener('resize',reset);

canvas.addEventListener('pointerdown',(e)=>{
  const r = canvas.getBoundingClientRect();
  const x = e.clientX - r.left;
  const y = e.clientY - r.top;

  ctx.fillStyle='rgba(150,255,150,0.85)';
  ctx.beginPath();
  ctx.arc(x,y,2.2,0,Math.PI*2);
  ctx.fill();

  setTimeout(()=>spawnTree(x,y,1),110);
});

reset();
requestAnimationFrame(loop);
