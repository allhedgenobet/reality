import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const ui = {
  resetBtn: document.getElementById('resetBtn'),
  branchChance: document.getElementById('branchChance'),
  stopChance: document.getElementById('stopChance'),
  wind: document.getElementById('wind'),
  stats: document.getElementById('stats'),
};

const canvas = document.getElementById('c');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.Fog(0x000000, 40, 260);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 40, 90);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 18, 0);
controls.enableDamping = true;

const hemi = new THREE.HemisphereLight(0x88ff88, 0x001100, 0.75);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0x99ff99, 0.65);
dir.position.set(30, 80, 20);
scene.add(dir);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  new THREE.MeshStandardMaterial({ color: 0x021002, roughness: 0.95, metalness: 0.02 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0;
scene.add(ground);

const grid = new THREE.GridHelper(400, 40, 0x103510, 0x071707);
grid.position.y = 0.02;
scene.add(grid);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

class Tip {
  constructor(pos, dir, width, energy, treeId) {
    this.pos = pos.clone();
    this.dir = dir.clone().normalize();
    this.width = width;
    this.energy = energy;
    this.alive = true;
    this.treeId = treeId;
  }
}

const mat = new THREE.LineBasicMaterial({ color: 0x68ff68, transparent: true, opacity: 0.78 });
const branchGroup = new THREE.Group();
scene.add(branchGroup);

let tips = [];
let segments = 0;
let treeIdCounter = 1;

function drawSegment(a, b, width) {
  const geom = new THREE.BufferGeometry().setFromPoints([a, b]);
  const line = new THREE.Line(geom, mat);
  line.userData.life = 1;
  line.userData.base = Math.min(1, width / 3);
  branchGroup.add(line);
}

function spawnTree(x, z, scale = 1) {
  const trunkDir = new THREE.Vector3((Math.random() * 2 - 1) * 0.06, 1, (Math.random() * 2 - 1) * 0.06).normalize();
  const tip = new Tip(new THREE.Vector3(x, 0.2, z), trunkDir, (0.33 + Math.random() * 0.25) * scale, (170 + Math.random() * 120) * scale, treeIdCounter++);
  tips.push(tip);
}

function seedForest() {
  tips = [];
  segments = 0;
  treeIdCounter = 1;
  while (branchGroup.children.length) {
    const child = branchGroup.children.pop();
    child.geometry.dispose();
  }

  const count = 6;
  for (let i = 0; i < count; i++) {
    const x = -80 + i * 30 + (Math.random() * 2 - 1) * 8;
    const z = (Math.random() * 2 - 1) * 35;
    spawnTree(x, z, 0.9 + Math.random() * 0.45);
  }
}

function randomCone(base, spread = 0.35) {
  const v = base.clone();
  v.x += (Math.random() * 2 - 1) * spread;
  v.y += (Math.random() * 2 - 1) * spread * 0.5;
  v.z += (Math.random() * 2 - 1) * spread;
  return v.normalize();
}

function step() {
  const branchChance = Number(ui.branchChance.value);
  const stopChance = Number(ui.stopChance.value);
  const wind = Number(ui.wind.value);

  const newborn = [];

  for (const t of tips) {
    if (!t.alive) continue;

    const ageStop = (1 - Math.min(1, t.energy / 220)) * 0.03;
    const thinStop = t.width < 0.11 ? 0.03 : 0;
    if (Math.random() < stopChance + ageStop + thinStop || t.energy <= 0 || t.width <= 0.03) {
      t.alive = false;
      continue;
    }

    t.dir.x += wind + (Math.random() * 2 - 1) * 0.01;
    t.dir.z += (Math.random() * 2 - 1) * 0.01;
    t.dir.y = Math.max(0.25, t.dir.y + (Math.random() * 2 - 1) * 0.02);
    t.dir.normalize();

    const len = 0.9 + Math.random() * 0.85;
    const next = t.pos.clone().addScaledVector(t.dir, len);

    drawSegment(t.pos, next, t.width * 10);
    segments++;

    t.pos.copy(next);
    t.energy -= 1;
    t.width *= 0.997;

    const bChance = branchChance * (0.6 + Math.min(1, t.energy / 220));
    if (Math.random() < bChance && t.width > 0.05 && t.energy > 12) {
      const d1 = randomCone(t.dir, 0.55);
      const d2 = randomCone(t.dir, 0.55);
      d1.x -= 0.22; d2.x += 0.22;
      d1.normalize(); d2.normalize();
      newborn.push(new Tip(t.pos, d1, t.width * (0.7 + Math.random() * 0.15), t.energy * 0.62, t.treeId));
      newborn.push(new Tip(t.pos, d2, t.width * (0.7 + Math.random() * 0.15), t.energy * 0.62, t.treeId));
      t.energy *= 0.73;
    }

    // Reproduction: mature branches drop a seed to nearby ground
    if (t.energy > 55 && t.width > 0.09 && Math.random() < 0.0012) {
      const sx = t.pos.x + (Math.random() * 2 - 1) * 14;
      const sz = t.pos.z + (Math.random() * 2 - 1) * 14;
      spawnTree(sx, sz, 0.62 + Math.random() * 0.35);
    }

    if (Math.abs(t.pos.x) > 200 || Math.abs(t.pos.z) > 200 || t.pos.y > 160) t.alive = false;
  }

  tips.push(...newborn);
  tips = tips.filter((t) => t.alive);
  ui.stats.textContent = `active tips: ${tips.length} | segments: ${segments}`;
}

function animate() {
  requestAnimationFrame(animate);

  if (segments < 220000 && tips.length > 0) {
    for (let i = 0; i < 2; i++) step();
  }

  // subtle fade on old segments for depth
  for (let i = 0; i < branchGroup.children.length; i++) {
    const line = branchGroup.children[i];
    line.userData.life *= 0.99985;
    line.material.opacity = Math.max(0.12, line.userData.life * 0.9 * line.userData.base);
  }

  controls.update();
  renderer.render(scene, camera);
}

canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hit = raycaster.intersectObject(ground)[0];
  if (hit) spawnTree(hit.point.x, hit.point.z, 0.85 + Math.random() * 0.35);
});

ui.resetBtn.addEventListener('click', seedForest);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

seedForest();
animate();
