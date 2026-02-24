const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');

const ui = {
  stepBtn: document.getElementById('stepBtn'),
  runBtn: document.getElementById('runBtn'),
  resetBtn: document.getElementById('resetBtn'),
  stimA: document.getElementById('stimA'),
  stimB: document.getElementById('stimB'),
  noise: document.getElementById('noise'),
  eta: document.getElementById('eta'),
  inhib: document.getElementById('inhib'),
  rewardTargetA: document.getElementById('rewardTargetA'),
  tickLabel: document.getElementById('tickLabel'),
  choiceLabel: document.getElementById('choiceLabel'),
  rewardLabel: document.getElementById('rewardLabel'),
  accLabel: document.getElementById('accLabel'),
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const TYPES = {
  INPUT: 'input',
  EXC: 'exc',
  INH: 'inh',
  OUTPUT: 'output',
};

function createNeuron(id, type, pathway, x, y) {
  return {
    id,
    type,
    pathway, // 'A' | 'B' | 'shared'
    x,
    y,
    v: -65,
    vRest: -65,
    vReset: -68,
    vThresh: type === TYPES.OUTPUT ? -51 : -50,
    tauM: type === TYPES.INH ? 14 : 18,
    refSteps: type === TYPES.INH ? 2 : 3,
    refLeft: 0,
    inputCurrent: 0,
    spike: false,
    trace: 0,
  };
}

function createModel() {
  const neurons = [];
  let id = 0;

  // Inputs
  const inA = createNeuron(id++, TYPES.INPUT, 'A', 120, 180);
  const inB = createNeuron(id++, TYPES.INPUT, 'B', 120, 450);
  inA.vThresh = -58;
  inB.vThresh = -58;
  neurons.push(inA, inB);

  // L2/3-like pathway pools
  const excA = [];
  const excB = [];
  for (let i = 0; i < 8; i++) {
    excA.push(createNeuron(id++, TYPES.EXC, 'A', 320 + (i % 2) * 45, 120 + i * 32));
    excB.push(createNeuron(id++, TYPES.EXC, 'B', 320 + (i % 2) * 45, 390 + i * 32));
  }
  neurons.push(...excA, ...excB);

  // Shared interneurons (PV/SST-ish proxy)
  const inh = [];
  for (let i = 0; i < 6; i++) inh.push(createNeuron(id++, TYPES.INH, 'shared', 560 + (i % 2) * 45, 180 + i * 45));
  neurons.push(...inh);

  // Output populations (L5-ish decision readout)
  const outA = [];
  const outB = [];
  for (let i = 0; i < 3; i++) {
    outA.push(createNeuron(id++, TYPES.OUTPUT, 'A', 820, 150 + i * 70));
    outB.push(createNeuron(id++, TYPES.OUTPUT, 'B', 820, 380 + i * 70));
  }
  neurons.push(...outA, ...outB);

  const edges = [];
  const byId = new Map(neurons.map((n) => [n.id, n]));

  const addEdge = (pre, post, w, delay = 1, plastic = false) => {
    edges.push({ pre, post, w, delay, plastic, preType: byId.get(pre).type });
  };

  const connectDense = (pres, posts, wMin, wMax, delay, plastic = false) => {
    for (const p of pres) for (const q of posts) addEdge(p.id, q.id, wMin + Math.random() * (wMax - wMin), delay, plastic);
  };

  // Inputs -> pathway excitatory populations
  connectDense([inA], excA, 1.0, 1.3, 1, true);
  connectDense([inB], excB, 1.0, 1.3, 1, true);

  // Recurrent local excitation
  connectDense(excA, excA, 0.05, 0.18, 1, true);
  connectDense(excB, excB, 0.05, 0.18, 1, true);

  // Pathway -> output
  connectDense(excA, outA, 0.8, 1.2, 2, true);
  connectDense(excB, outB, 0.8, 1.2, 2, true);

  // Weak cross-talk
  connectDense(excA, outB, 0.05, 0.15, 2, true);
  connectDense(excB, outA, 0.05, 0.15, 2, true);

  // Exc -> interneuron
  connectDense(excA, inh, 0.35, 0.65, 1, false);
  connectDense(excB, inh, 0.35, 0.65, 1, false);

  // Interneuron -> output inhibition
  connectDense(inh, outA, -1.2, -0.8, 1, false);
  connectDense(inh, outB, -1.2, -0.8, 1, false);

  // Add simple delay buffer (fixed horizon)
  const maxDelay = 3;
  const delayBuffer = Array.from({ length: maxDelay + 1 }, () => []);

  return {
    tick: 0,
    running: true,
    reward: 0,
    history: [],
    neurons,
    edges,
    byId,
    groups: { inA, inB, excA, excB, inh, outA, outB },
    delayBuffer,
    bufferIndex: 0,
    dopamine: 0,
    lastChoice: '-',
    rasterA: [],
    rasterB: [],
  };
}

let M = createModel();

function poissonSpike(probPerStep) {
  return Math.random() < probPerStep;
}

function emitSpike(neuron) {
  neuron.spike = true;
  neuron.v = neuron.vReset;
  neuron.refLeft = neuron.refSteps;
  neuron.trace = 1;
}

function updateTraces() {
  for (const n of M.neurons) n.trace *= 0.92;
}

function scheduleSynapticEvents(spikingNeuronIds) {
  for (const edge of M.edges) {
    if (!spikingNeuronIds.has(edge.pre)) continue;
    const slot = (M.bufferIndex + edge.delay) % M.delayBuffer.length;
    M.delayBuffer[slot].push({ post: edge.post, w: edge.w });
  }
}

function applyScheduledCurrents() {
  const slot = M.delayBuffer[M.bufferIndex];
  for (const ev of slot) {
    const n = M.byId.get(ev.post);
    if (!n) continue;
    n.inputCurrent += ev.w;
  }
  slot.length = 0;
}

function applyExternalStimulus() {
  const stimA = Number(ui.stimA.value);
  const stimB = Number(ui.stimB.value);
  const noise = Number(ui.noise.value);

  const baseRate = 0.06;
  const rateA = clamp(baseRate + stimA * 0.18 + (Math.random() * 2 - 1) * noise * 0.03, 0, 0.5);
  const rateB = clamp(baseRate + stimB * 0.18 + (Math.random() * 2 - 1) * noise * 0.03, 0, 0.5);

  if (poissonSpike(rateA)) emitSpike(M.groups.inA);
  if (poissonSpike(rateB)) emitSpike(M.groups.inB);
}

function integrateNeurons() {
  const noise = Number(ui.noise.value);
  const inhibScale = Number(ui.inhib.value);

  const spiking = new Set();

  for (const n of M.neurons) {
    if (n.type === TYPES.INPUT) {
      if (n.spike) spiking.add(n.id);
      n.inputCurrent = 0;
      continue;
    }

    if (n.refLeft > 0) {
      n.refLeft -= 1;
      n.v = n.vReset;
      n.spike = false;
      n.inputCurrent = 0;
      continue;
    }

    let iSyn = n.inputCurrent;
    if (n.type === TYPES.INH) iSyn *= inhibScale;

    const dv = ((n.vRest - n.v) + iSyn * 8 + (Math.random() * 2 - 1) * noise * 1.2) / n.tauM;
    n.v += dv;

    if (n.v >= n.vThresh) {
      emitSpike(n);
      spiking.add(n.id);
    } else {
      n.spike = false;
    }

    n.inputCurrent = 0;
  }

  return spiking;
}

function outputPopulationSpikeRate(pop) {
  let s = 0;
  for (const n of pop) if (n.spike) s++;
  return s / pop.length;
}

function computeChoiceAndReward() {
  const rA = outputPopulationSpikeRate(M.groups.outA);
  const rB = outputPopulationSpikeRate(M.groups.outB);

  let choice = '-';
  if (rA > 0 || rB > 0) choice = rA >= rB ? 'A' : 'B';

  const rewardA = ui.rewardTargetA.checked;
  const reward = choice === '-' ? 0 : ((choice === 'A') === rewardA ? 1 : -1);

  M.dopamine = reward * 0.6 + M.dopamine * 0.4;
  M.reward += reward;
  M.lastChoice = choice;
  M.history.push(choice);
  if (M.history.length > 100) M.history.shift();

  M.rasterA.push(rA);
  M.rasterB.push(rB);
  if (M.rasterA.length > 180) {
    M.rasterA.shift();
    M.rasterB.shift();
  }

  return { choice };
}

function stdpRewardUpdate() {
  const eta = Number(ui.eta.value);
  const mod = M.dopamine;

  for (const e of M.edges) {
    if (!e.plastic) continue;
    const pre = M.byId.get(e.pre);
    const post = M.byId.get(e.post);
    if (!pre || !post) continue;

    // Simple pair-based STDP proxy with eligibility traces.
    const hebb = pre.trace * post.trace;
    const dw = eta * hebb * mod * 0.06;
    e.w = clamp(e.w + dw, e.w < 0 ? -2.0 : 0.01, 2.4);
  }
}

function step() {
  // Reset input spikes from previous step
  M.groups.inA.spike = false;
  M.groups.inB.spike = false;

  applyExternalStimulus();
  applyScheduledCurrents();

  const spikingIds = integrateNeurons();
  scheduleSynapticEvents(spikingIds);

  const { choice } = computeChoiceAndReward();
  stdpRewardUpdate();
  updateTraces();

  M.bufferIndex = (M.bufferIndex + 1) % M.delayBuffer.length;
  M.tick += 1;

  const aWins = M.history.filter((c) => c === 'A').length;
  const valid = M.history.filter((c) => c !== '-').length || 1;

  ui.tickLabel.textContent = `Tick: ${M.tick}`;
  ui.choiceLabel.textContent = `Choice: ${choice}`;
  ui.rewardLabel.textContent = `Reward: ${M.reward}`;
  ui.accLabel.textContent = `A-win rate (100): ${Math.round((aWins / valid) * 100)}%`;
}

function drawEdge(pre, post, w) {
  const mag = Math.min(1, Math.abs(w) / 1.4);
  ctx.strokeStyle = w >= 0 ? `rgba(110,190,255,${0.16 + mag * 0.6})` : `rgba(255,120,120,${0.16 + mag * 0.6})`;
  ctx.lineWidth = 0.6 + mag * 2.2;
  ctx.beginPath();
  ctx.moveTo(pre.x, pre.y);
  ctx.lineTo(post.x, post.y);
  ctx.stroke();
}

function drawNode(n) {
  const byType = {
    [TYPES.INPUT]: '#67b6ff',
    [TYPES.EXC]: '#8f7cff',
    [TYPES.INH]: '#ff9a9a',
    [TYPES.OUTPUT]: n.pathway === 'A' ? '#82ffa7' : '#ffd083',
  };

  const base = n.type === TYPES.OUTPUT ? 8 : 6;
  const spikeGlow = n.spike ? 1 : 0;
  const r = base + spikeGlow * 4;

  ctx.fillStyle = byType[n.type];
  ctx.globalAlpha = 0.35 + spikeGlow * 0.65;
  ctx.beginPath();
  ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(235,240,255,0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
  ctx.stroke();
}

function drawLabels() {
  ctx.fillStyle = '#cfdbff';
  ctx.font = '12px sans-serif';
  ctx.fillText('Input A', 86, 154);
  ctx.fillText('Input B', 86, 424);
  ctx.fillText('Excitatory pool A (L2/3-ish)', 265, 90);
  ctx.fillText('Excitatory pool B (L2/3-ish)', 265, 360);
  ctx.fillText('Interneurons (shared)', 540, 145);
  ctx.fillText('Output A', 790, 120);
  ctx.fillText('Output B', 790, 350);
}

function drawRaster() {
  const x0 = 30;
  const y0 = 520;
  const w = 940;
  const h = 80;

  ctx.strokeStyle = 'rgba(180,200,255,0.25)';
  ctx.strokeRect(x0, y0, w, h);

  const n = M.rasterA.length;
  if (!n) return;
  const dx = w / Math.max(1, n - 1);

  ctx.beginPath();
  ctx.strokeStyle = 'rgba(130,255,170,0.95)';
  for (let i = 0; i < n; i++) {
    const y = y0 + h - M.rasterA[i] * h;
    const x = x0 + i * dx;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = 'rgba(255,205,135,0.95)';
  for (let i = 0; i < n; i++) {
    const y = y0 + h - M.rasterB[i] * h;
    const x = x0 + i * dx;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.fillStyle = '#d4deff';
  ctx.font = '11px monospace';
  ctx.fillText('Output spike-rate trace (A=green, B=amber)', x0 + 8, y0 - 8);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const e of M.edges) drawEdge(M.byId.get(e.pre), M.byId.get(e.post), e.w);
  for (const n of M.neurons) drawNode(n);

  drawLabels();
  drawRaster();

  const wAA = M.edges.filter((e) => e.plastic && M.byId.get(e.pre).pathway === 'A' && M.byId.get(e.post).pathway === 'A');
  const wBB = M.edges.filter((e) => e.plastic && M.byId.get(e.pre).pathway === 'B' && M.byId.get(e.post).pathway === 'B');
  const avg = (arr) => arr.reduce((s, x) => s + x.w, 0) / Math.max(1, arr.length);

  ctx.fillStyle = '#b7c7ff';
  ctx.font = '12px monospace';
  ctx.fillText(`Dopamine(mod): ${M.dopamine.toFixed(3)}`, 20, 26);
  ctx.fillText(`Avg plastic w(A): ${avg(wAA).toFixed(3)}`, 20, 44);
  ctx.fillText(`Avg plastic w(B): ${avg(wBB).toFixed(3)}`, 20, 62);
  ctx.fillText(`Last choice: ${M.lastChoice}`, 20, 80);
}

ui.stepBtn.addEventListener('click', () => {
  step();
  render();
});

ui.runBtn.addEventListener('click', () => {
  M.running = !M.running;
  ui.runBtn.textContent = M.running ? 'Pause' : 'Run';
});

ui.resetBtn.addEventListener('click', () => {
  M = createModel();
  ui.runBtn.textContent = 'Pause';
  ui.tickLabel.textContent = 'Tick: 0';
  ui.choiceLabel.textContent = 'Choice: -';
  ui.rewardLabel.textContent = 'Reward: 0';
  ui.accLabel.textContent = 'A-win rate (100): 0%';
  render();
});

function loop() {
  if (M.running) step();
  render();
  requestAnimationFrame(loop);
}

render();
requestAnimationFrame(loop);
