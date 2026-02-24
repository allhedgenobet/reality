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

function createModel() {
  return {
    tick: 0,
    running: true,
    reward: 0,
    history: [],
    act: {
      inA: 0,
      inB: 0,
      hidA: 0,
      hidB: 0,
      outA: 0,
      outB: 0,
      inh: 0,
    },
    w: {
      inA_hidA: 0.9,
      inB_hidB: 0.9,
      hidA_outA: 1.0,
      hidB_outB: 1.0,
      hidA_outB: 0.15,
      hidB_outA: 0.15,
      outA_inh: 0.7,
      outB_inh: 0.7,
      inh_outA: 0.9,
      inh_outB: 0.9,
    },
  };
}

let M = createModel();

function step() {
  const stimA = Number(ui.stimA.value);
  const stimB = Number(ui.stimB.value);
  const noise = Number(ui.noise.value);
  const eta = Number(ui.eta.value);
  const inhib = Number(ui.inhib.value);
  const rewardA = ui.rewardTargetA.checked;

  const n = () => (Math.random() * 2 - 1) * noise;
  const a = M.act;
  const w = M.w;

  a.inA = clamp(stimA + n(), 0, 1.4);
  a.inB = clamp(stimB + n(), 0, 1.4);

  const hidALeak = a.hidA * 0.8;
  const hidBLeak = a.hidB * 0.8;
  a.hidA = clamp(hidALeak + a.inA * w.inA_hidA + n(), 0, 2.5);
  a.hidB = clamp(hidBLeak + a.inB * w.inB_hidB + n(), 0, 2.5);

  a.inh = clamp(a.inh * 0.75 + (a.outA * w.outA_inh + a.outB * w.outB_inh) * 0.4 + n(), 0, 2.8);

  const rawOutA = a.outA * 0.72 + a.hidA * w.hidA_outA + a.hidB * w.hidB_outA - a.inh * w.inh_outA * inhib + n();
  const rawOutB = a.outB * 0.72 + a.hidB * w.hidB_outB + a.hidA * w.hidA_outB - a.inh * w.inh_outB * inhib + n();

  a.outA = clamp(rawOutA, 0, 3.2);
  a.outB = clamp(rawOutB, 0, 3.2);

  let choice = '-';
  if (a.outA > 0.75 || a.outB > 0.75) {
    choice = a.outA >= a.outB ? 'A' : 'B';
  }

  const reward = choice === '-' ? 0 : ((choice === 'A') === rewardA ? 1 : -1);
  M.reward += reward;

  // Reward-modulated Hebbian updates on decision pathways.
  // Potentiate winning route if rewarded, depress otherwise.
  if (choice !== '-') {
    const sign = reward >= 0 ? 1 : -1;
    const prePostA = a.hidA * a.outA;
    const prePostB = a.hidB * a.outB;

    if (choice === 'A') {
      w.hidA_outA = clamp(w.hidA_outA + eta * sign * prePostA * 0.05, 0.2, 2.2);
      w.hidA_outB = clamp(w.hidA_outB - eta * sign * prePostA * 0.03, 0.02, 1.4);
    } else {
      w.hidB_outB = clamp(w.hidB_outB + eta * sign * prePostB * 0.05, 0.2, 2.2);
      w.hidB_outA = clamp(w.hidB_outA - eta * sign * prePostB * 0.03, 0.02, 1.4);
    }
  }

  M.tick += 1;
  M.history.push(choice);
  if (M.history.length > 100) M.history.shift();

  const aWins = M.history.filter((c) => c === 'A').length;
  const valid = M.history.filter((c) => c !== '-').length || 1;

  ui.tickLabel.textContent = `Tick: ${M.tick}`;
  ui.choiceLabel.textContent = `Choice: ${choice}`;
  ui.rewardLabel.textContent = `Reward: ${M.reward}`;
  ui.accLabel.textContent = `A-win rate (100): ${Math.round((aWins / valid) * 100)}%`;
}

const NODES = {
  inA: { x: 130, y: 170, label: 'Input A', key: 'inA', c: '#5fb8ff' },
  inB: { x: 130, y: 440, label: 'Input B', key: 'inB', c: '#5fb8ff' },
  hidA: { x: 410, y: 170, label: 'Pathway A', key: 'hidA', c: '#a08bff' },
  hidB: { x: 410, y: 440, label: 'Pathway B', key: 'hidB', c: '#a08bff' },
  inh: { x: 560, y: 310, label: 'Inhibitory', key: 'inh', c: '#ff8f8f' },
  outA: { x: 810, y: 170, label: 'Choice A', key: 'outA', c: '#83ffa9' },
  outB: { x: 810, y: 440, label: 'Choice B', key: 'outB', c: '#ffd37e' },
};

function drawEdge(a, b, w, polarity = 1) {
  const A = NODES[a];
  const B = NODES[b];
  const mag = Math.min(1, Math.abs(w) / 1.4);
  const alpha = 0.2 + mag * 0.8;
  const width = 1 + mag * 5;
  const col = polarity >= 0 ? `rgba(120,190,255,${alpha})` : `rgba(255,120,120,${alpha})`;

  ctx.strokeStyle = col;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(A.x, A.y);
  ctx.lineTo(B.x, B.y);
  ctx.stroke();
}

function drawNode(node) {
  const val = M.act[node.key];
  const r = 24 + Math.min(1, val / 2.5) * 16;
  const glow = 0.2 + Math.min(1, val / 2.5) * 0.8;

  ctx.fillStyle = `rgba(255,255,255,0.08)`;
  ctx.beginPath();
  ctx.arc(node.x, node.y, r + 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = node.c;
  ctx.globalAlpha = glow;
  ctx.beginPath();
  ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = 'rgba(230,240,255,0.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#eaf0ff';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(node.label, node.x, node.y - r - 10);
  ctx.fillText(val.toFixed(2), node.x, node.y + 4);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawEdge('inA', 'hidA', M.w.inA_hidA, +1);
  drawEdge('inB', 'hidB', M.w.inB_hidB, +1);
  drawEdge('hidA', 'outA', M.w.hidA_outA, +1);
  drawEdge('hidB', 'outB', M.w.hidB_outB, +1);
  drawEdge('hidA', 'outB', M.w.hidA_outB, +1);
  drawEdge('hidB', 'outA', M.w.hidB_outA, +1);
  drawEdge('outA', 'inh', M.w.outA_inh, +1);
  drawEdge('outB', 'inh', M.w.outB_inh, +1);
  drawEdge('inh', 'outA', -M.w.inh_outA, -1);
  drawEdge('inh', 'outB', -M.w.inh_outB, -1);

  Object.values(NODES).forEach(drawNode);

  ctx.fillStyle = '#b7c7ff';
  ctx.font = '13px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`w(hA→oA): ${M.w.hidA_outA.toFixed(3)}`, 20, 28);
  ctx.fillText(`w(hB→oB): ${M.w.hidB_outB.toFixed(3)}`, 20, 48);
  ctx.fillText(`w(hA→oB): ${M.w.hidA_outB.toFixed(3)}`, 20, 68);
  ctx.fillText(`w(hB→oA): ${M.w.hidB_outA.toFixed(3)}`, 20, 88);
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
