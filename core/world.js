// World state for M2: ECS-lite with Agent and Resource entities and physics integration.

import { createEcs } from './ecs.js';

export function createWorld(rng) {
  const width = 2400;
  const height = 1440;

  const ecs = createEcs();

  const world = {
    tick: 0,
    width,
    height,
    ecs,
    regime: 'calm',
    camera: {
      zoom: 1,
      x: width * 0.5,
      y: height * 0.5,
    },
    globals: {
      fertility: 0.6,
      metabolism: 1.0,
      storminess: 0.0,
      reproductionThreshold: 1.6,
      chaosLevel: 0.35,
      effectQuality: 1,
      updateStride: 1,
    },
  };

  // Spawn some initial agents and resources
  const AGENT_COUNT = 88;
  const PREDATOR_COUNT = 28;
  const APEX_COUNT = 12;
  const CORAL_COUNT = 16;
  const TITAN_COUNT = 4;
  const RESOURCE_COUNT = 280;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  const burstPool = [];

  function getBurstBudget() {
    const q = world.globals.effectQuality ?? 1;
    return Math.max(60, Math.round(420 * q));
  }

  function acquireBurstEntity() {
    return burstPool.pop() ?? ecs.createEntity();
  }

  function recycleBurstEntity(id) {
    ecs.components.burst.delete(id);
    ecs.components.position.delete(id);
    burstPool.push(id);
  }

  function canSpawnBursts(requested = 1) {
    const active = ecs.components.burst.size;
    return active + requested <= getBurstBudget();
  }

  function makeAgent(x, y, baseHue = 200, parentDna) {
    const id = ecs.createEntity();
    ecs.components.position.set(id, { x, y });

    const dna = parentDna
      ? {
          speed: clamp(parentDna.speed + (rng.float() - 0.5) * 0.1, 0.6, 1.4),
          sense: clamp(parentDna.sense + (rng.float() - 0.5) * 0.1, 0.6, 1.4),
          metabolism: clamp(parentDna.metabolism + (rng.float() - 0.5) * 0.1, 0.6, 1.6),
          hueShift: clamp(parentDna.hueShift + rng.int(-4, 4), -60, 60),
        }
      : {
          speed: 0.8 + rng.float() * 0.4,
          sense: 0.8 + rng.float() * 0.4,
          metabolism: 0.8 + rng.float() * 0.4,
          hueShift: rng.int(-40, 40),
        };

    const speed = 40 * dna.speed;

    ecs.components.velocity.set(id, {
      vx: (rng.float() - 0.5) * speed,
      vy: (rng.float() - 0.5) * speed,
    });
    const evolvedScore = dna.speed + dna.sense + (2 - dna.metabolism);
    const evolved = evolvedScore > 3.5; // simple heuristic for "advanced" forms

    // Assign a simple "caste" based on DNA traits
    let caste = 'balanced';
    if (dna.sense > dna.speed && dna.sense > 1.1) caste = 'scout';
    else if (dna.speed > dna.sense && dna.speed > 1.1) caste = 'runner';
    else if (dna.metabolism < 0.9) caste = 'saver';

    ecs.components.agent.set(id, {
      colorHue: baseHue + dna.hueShift,
      energy: 1.0,
      age: 0,
      dna,
      evolved,
      caste,
    });
    return id;
  }

  function makePredator(x, y, parentDna) {
    const id = ecs.createEntity();
    ecs.components.position.set(id, { x, y });

    const dna = parentDna
      ? {
          speed:      clamp(parentDna.speed      + (rng.float() - 0.5) * 0.22, 0.45, 2.0),
          sense:      clamp(parentDna.sense      + (rng.float() - 0.5) * 0.22, 0.35, 2.1),
          metabolism: clamp(parentDna.metabolism + (rng.float() - 0.5) * 0.22, 0.4, 2.2),
          hueShift:   clamp(parentDna.hueShift   + rng.int(-8, 8), -80, 80),
        }
      : {
          speed:      0.6 + rng.float() * 0.9,      // 0.6–1.5
          sense:      0.6 + rng.float() * 0.9,      // 0.6–1.5
          metabolism: 0.6 + rng.float() * 1.0,      // 0.6–1.6
          hueShift:   rng.int(-45, 45),
        };

    const speed = 55 * dna.speed;

    ecs.components.velocity.set(id, {
      vx: (rng.float() - 0.5) * speed,
      vy: (rng.float() - 0.5) * speed,
    });
    ecs.components.predator.set(id, {
      colorHue: 5 + dna.hueShift,
      energy: 2.0,
      age: 0,
      dna,
    });
    return id;
  }

  function makeApex(x, y, parentDna) {
    const id = ecs.createEntity();
    ecs.components.position.set(id, { x, y });

    const dna = parentDna
      ? {
          speed: clamp(parentDna.speed + (rng.float() - 0.5) * 0.08, 0.5, 1.4),
          sense: clamp(parentDna.sense + (rng.float() - 0.5) * 0.08, 0.7, 1.8),
          metabolism: clamp(parentDna.metabolism + (rng.float() - 0.5) * 0.08, 0.5, 1.6),
          hueShift: clamp(parentDna.hueShift + rng.int(-3, 3), -30, 30),
        }
      : {
          speed: 0.8 + rng.float() * 0.3,
          sense: 1.1 + rng.float() * 0.4,
          metabolism: 0.8 + rng.float() * 0.3,
          hueShift: rng.int(-15, 15),
        };

    const speed = 35 * dna.speed;

    ecs.components.velocity.set(id, {
      vx: (rng.float() - 0.5) * speed,
      vy: (rng.float() - 0.5) * speed,
    });
    ecs.components.apex.set(id, {
      colorHue: 200 + dna.hueShift,
      energy: 3.0,
      age: 0,
      rest: 0,
      dna,
    });
    return id;
  }

  function makeCoral(x, y, parentDna) {
    const id = ecs.createEntity();
    ecs.components.position.set(id, { x, y });

    const dna = parentDna
      ? {
          speed:      clamp(parentDna.speed      + (rng.float() - 0.5) * 0.18, 0.4, 1.8),
          sense:      clamp(parentDna.sense      + (rng.float() - 0.5) * 0.18, 0.5, 1.8),
          metabolism: clamp(parentDna.metabolism + (rng.float() - 0.5) * 0.18, 0.4, 1.8),
          hueShift:   clamp(parentDna.hueShift   + rng.int(-6, 6), -40, 40),
          venom:      clamp(parentDna.venom      + (rng.float() - 0.5) * 0.12, 0, 0.9),
        }
      : {
          speed:      0.5 + rng.float() * 0.8,
          sense:      0.7 + rng.float() * 0.8,
          metabolism: 0.5 + rng.float() * 0.8,
          hueShift:   rng.int(-20, 20),
          venom:      rng.float() * 0.6, // unique: reduces energy gained by apex when eaten
        };

    const speed = 45 * dna.speed;

    ecs.components.velocity.set(id, {
      vx: (rng.float() - 0.5) * speed,
      vy: (rng.float() - 0.5) * speed,
    });
    ecs.components.coral.set(id, {
      colorHue: 340 + dna.hueShift,
      energy: 1.5,
      age: 0,
      rest: 0,
      dna,
    });
    return id;
  }

  function makeTitan(x, y, parentDna) {
    const id = ecs.createEntity();
    ecs.components.position.set(id, { x, y });

    const dna = parentDna
      ? {
          speed: clamp(parentDna.speed + (rng.float() - 0.5) * 0.1, 0.5, 1.5),
          sense: clamp(parentDna.sense + (rng.float() - 0.5) * 0.1, 0.8, 1.8),
          metabolism: clamp(parentDna.metabolism + (rng.float() - 0.5) * 0.1, 0.5, 1.6),
          hueShift: clamp(parentDna.hueShift + rng.int(-3, 3), -20, 20),
        }
      : {
          speed: 0.8 + rng.float() * 0.4,
          sense: 1.0 + rng.float() * 0.5,
          metabolism: 0.8 + rng.float() * 0.4,
          hueShift: rng.int(-10, 10),
        };

    const speed = 28 * dna.speed;

    ecs.components.velocity.set(id, {
      vx: (rng.float() - 0.5) * speed,
      vy: (rng.float() - 0.5) * speed,
    });
    ecs.components.titan.set(id, {
      colorHue: 260 + dna.hueShift,
      energy: 4.0,
      age: 0,
      rest: 0,
      dna,
    });
    return id;
  }

  function makeResource(x, y, kind = 'plant') {
    const id = ecs.createEntity();
    ecs.components.position.set(id, { x, y });

    let dna = null;
    if (kind === 'plant') {
      // Per-plant "genetics" including pseudo-3D depth traits
      dna = {
        branchCount: 2 + rng.int(0, 4),                 // 2–6 primary arms
        branchAngle: 0.4 + rng.float() * 0.8,           // spread of branches
        curvature:  0.2 + rng.float() * 0.6,            // how much arms bend
        segmentLength: 10 + rng.float() * 12,           // base step length
        thickness: 0.6 + rng.float() * 0.8,             // line width factor
        depth: 0.2 + rng.float() * 0.7,                 // 0.2–0.9 depth layer
        lean: (rng.float() - 0.5) * 0.6,                // slight tilt left/right
      };
    }

    ecs.components.resource.set(id, {
      kind, // 'plant' or 'pod'
      amount: 1,
      regenTimer: rng.float() * 5,
      age: 0,
      cycles: 0, // growth cycles completed
      seedTimer: kind === 'pod' ? 10 + rng.float() * 12 : null,
      dna,
    });
    return id;
  }

  function makePlant(x, y) {
    return makeResource(x, y, 'plant');
  }

  function makeSeedPod(x, y) {
    return makeResource(x, y, 'pod');
  }

  function spawnApexBurst(x, y, baseHue, count, energy) {
    const { position, burst } = ecs.components;
    const q = world.globals.effectQuality ?? 1;
    const requested = Math.max(1, Math.round((count || 8) * q));
    const remaining = Math.max(0, getBurstBudget() - burst.size);
    const particles = Math.min(requested, remaining);
    if (particles <= 0) return;

    const speedBase = 40 + energy * 12;
    for (let i = 0; i < particles; i++) {
      const id = acquireBurstEntity();
      const angle = rng.float() * Math.PI * 2;
      const speed = speedBase * (0.6 + rng.float() * 0.8);
      position.set(id, { x, y });
      burst.set(id, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.4 + rng.float() * 0.6,
        hue: baseHue,
      });
    }
  }

  for (let i = 0; i < AGENT_COUNT; i++) {
    makeAgent(rng.float() * width, rng.float() * height);
  }

  for (let i = 0; i < PREDATOR_COUNT; i++) {
    makePredator(rng.float() * width, rng.float() * height);
  }

  for (let i = 0; i < APEX_COUNT; i++) {
    makeApex(rng.float() * width, rng.float() * height);
  }

  for (let i = 0; i < CORAL_COUNT; i++) {
    makeCoral(rng.float() * width, rng.float() * height);
  }

  for (let i = 0; i < TITAN_COUNT; i++) {
    makeTitan(rng.float() * width, rng.float() * height);
  }

  for (let i = 0; i < RESOURCE_COUNT; i++) {
    const kind = rng.float() < 0.2 ? 'pod' : 'plant';
    makeResource(rng.float() * width, rng.float() * height, kind);
  }

  function physicsSystem(dt) {
    const { position, velocity, burst } = ecs.components;
    const w = world.width;
    const h = world.height;

    for (const [id, vel] of velocity.entries()) {
      const pos = position.get(id);
      if (!pos) continue;
      pos.x += vel.vx * dt;
      pos.y += vel.vy * dt;

      // Wrap bounds
      if (pos.x < 0) pos.x += w;
      if (pos.x >= w) pos.x -= w;
      if (pos.y < 0) pos.y += h;
      if (pos.y >= h) pos.y -= h;
    }

    // Integrate burst particles and wrap them as well
    for (const [id, p] of burst.entries()) {
      const pos = position.get(id);
      if (!pos) continue;
      pos.x += p.vx * dt;
      pos.y += p.vy * dt;
      if (pos.x < 0) pos.x += w;
      if (pos.x >= w) pos.x -= w;
      if (pos.y < 0) pos.y += h;
      if (pos.y >= h) pos.y -= h;
    }
  }

  const SPATIAL_CELL = 48;

  function cellKey(cx, cy) {
    return `${cx},${cy}`;
  }

  function buildSpatialIndex(entries, radius = 0) {
    const grid = new Map();
    for (const item of entries) {
      const minCx = Math.floor((item.pos.x - radius) / SPATIAL_CELL);
      const maxCx = Math.floor((item.pos.x + radius) / SPATIAL_CELL);
      const minCy = Math.floor((item.pos.y - radius) / SPATIAL_CELL);
      const maxCy = Math.floor((item.pos.y + radius) / SPATIAL_CELL);

      for (let cx = minCx; cx <= maxCx; cx++) {
        for (let cy = minCy; cy <= maxCy; cy++) {
          const key = cellKey(cx, cy);
          let bucket = grid.get(key);
          if (!bucket) {
            bucket = [];
            grid.set(key, bucket);
          }
          bucket.push(item);
        }
      }
    }
    return grid;
  }

  function querySpatial(grid, x, y, radius) {
    const out = [];
    const minCx = Math.floor((x - radius) / SPATIAL_CELL);
    const maxCx = Math.floor((x + radius) / SPATIAL_CELL);
    const minCy = Math.floor((y - radius) / SPATIAL_CELL);
    const maxCy = Math.floor((y + radius) / SPATIAL_CELL);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const bucket = grid.get(cellKey(cx, cy));
        if (!bucket) continue;
        out.push(...bucket);
      }
    }
    return out;
  }

  // Simple soft-body collisions using typed lanes (phase 5 foundation).
  function collisionSystem(dt) {
    const { position, velocity, agent, predator, apex, coral, titan } = ecs.components;

    const total = agent.size + predator.size + apex.size + coral.size + titan.size;
    if (total <= 1) return;

    const ids = new Uint32Array(total);
    const xs = new Float32Array(total);
    const ys = new Float32Array(total);
    const rs = new Float32Array(total);
    const vels = new Array(total);

    let n = 0;
    const push = (id, radius) => {
      const pos = position.get(id);
      const vel = velocity.get(id);
      if (!pos || !vel) return;
      ids[n] = id;
      xs[n] = pos.x;
      ys[n] = pos.y;
      rs[n] = radius;
      vels[n] = vel;
      n += 1;
    };

    for (const [id, ag] of agent.entries()) push(id, 4 + (ag.energy ?? 1) * 2);
    for (const [id, pred] of predator.entries()) push(id, 6 + (pred.energy ?? 1.5) * 2.5);
    for (const [id, ap] of apex.entries()) push(id, 9 + (ap.energy ?? 3) * 2);
    for (const [id, cr] of coral.entries()) push(id, 5 + (cr.energy ?? 1.5) * 2);
    for (const [id, tt] of titan.entries()) push(id, 10 + (tt.energy ?? 4) * 2.2);

    if (n <= 1) return;

    const strength = 40;
    const cell = SPATIAL_CELL;
    const grid = new Map();

    for (let i = 0; i < n; i++) {
      const cx = Math.floor(xs[i] / cell);
      const cy = Math.floor(ys[i] / cell);
      const key = `${cx},${cy}`;
      let bucket = grid.get(key);
      if (!bucket) {
        bucket = [];
        grid.set(key, bucket);
      }
      bucket.push(i);
    }

    for (let i = 0; i < n; i++) {
      const cx = Math.floor(xs[i] / cell);
      const cy = Math.floor(ys[i] / cell);

      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const bucket = grid.get(`${cx + ox},${cy + oy}`);
          if (!bucket) continue;

          for (const j of bucket) {
            if (j <= i) continue;

            const dx = xs[j] - xs[i];
            const dy = ys[j] - ys[i];
            const dist2 = dx * dx + dy * dy;
            if (dist2 <= 0) continue;

            const minDist = rs[i] + rs[j];
            if (dist2 >= minDist * minDist) continue;

            const dist = Math.sqrt(dist2) || 1;
            const overlap = (minDist - dist) / minDist;
            const nx = dx / dist;
            const ny = dy / dist;
            const impulse = strength * overlap;

            const va = vels[i];
            const vb = vels[j];
            va.vx -= nx * impulse * dt;
            va.vy -= ny * impulse * dt;
            vb.vx += nx * impulse * dt;
            vb.vy += ny * impulse * dt;
          }
        }
      }
    }
  }

  // Steering: agents seek nearest resource and gently adjust velocity.
  function steeringSystem(dt) {
    const { position, velocity, agent, predator, apex, coral, titan, resource } = ecs.components;
    const avoidRadius = 18;

    // Build spatial indexes once per tick for local neighbor queries
    const resourceList = [];
    for (const [id, res] of resource.entries()) {
      if (res.amount <= 0) continue;
      const pos = position.get(id);
      if (!pos) continue;
      resourceList.push({ id, pos, data: res });
    }
    const resourceGrid = buildSpatialIndex(resourceList, 0);

    const agentList = [];
    for (const [id, ag] of agent.entries()) {
      const pos = position.get(id);
      if (!pos) continue;
      agentList.push({ id, pos, data: ag });
    }
    const agentGrid = buildSpatialIndex(agentList, 0);

    const predatorList = [];
    for (const [id, pred] of predator.entries()) {
      const pos = position.get(id);
      if (!pos) continue;
      predatorList.push({ id, pos, data: pred });
    }
    const predatorGrid = buildSpatialIndex(predatorList, 0);

    const coralList = [];
    for (const [id, cr] of coral.entries()) {
      const pos = position.get(id);
      if (!pos) continue;
      coralList.push({ id, pos, data: cr });
    }
    const coralGrid = buildSpatialIndex(coralList, 0);

    const apexList = [];
    for (const [id, ap] of apex.entries()) {
      const pos = position.get(id);
      if (!pos) continue;
      apexList.push({ id, pos, data: ap });
    }
    const apexGrid = buildSpatialIndex(apexList, 0);

    // Phase 5 typed lanes for mover species (reduces iterator/object churn in hot steering loops)
    const predatorPos = new Array(predator.size);
    const predatorVel = new Array(predator.size);
    const predatorDna = new Array(predator.size);
    const predatorRest = new Float32Array(predator.size);
    let predatorN = 0;
    for (const [id, pred] of predator.entries()) {
      const pos = position.get(id);
      const vel = velocity.get(id);
      if (!pos || !vel) continue;
      predatorPos[predatorN] = pos;
      predatorVel[predatorN] = vel;
      predatorDna[predatorN] = pred.dna || { speed: 1, sense: 1, metabolism: 1, hueShift: 0 };
      predatorRest[predatorN] = pred.rest || 0;
      predatorN++;
    }

    const apexPos = new Array(apex.size);
    const apexVel = new Array(apex.size);
    const apexDna = new Array(apex.size);
    const apexRest = new Float32Array(apex.size);
    let apexN = 0;
    for (const [id, ap] of apex.entries()) {
      const pos = position.get(id);
      const vel = velocity.get(id);
      if (!pos || !vel) continue;
      apexPos[apexN] = pos;
      apexVel[apexN] = vel;
      apexDna[apexN] = ap.dna || { speed: 1, sense: 1, metabolism: 1, hueShift: 0 };
      apexRest[apexN] = ap.rest || 0;
      apexN++;
    }

    const coralPos = new Array(coral.size);
    const coralVel = new Array(coral.size);
    const coralDna = new Array(coral.size);
    const coralRest = new Float32Array(coral.size);
    let coralN = 0;
    for (const [id, cr] of coral.entries()) {
      const pos = position.get(id);
      const vel = velocity.get(id);
      if (!pos || !vel) continue;
      coralPos[coralN] = pos;
      coralVel[coralN] = vel;
      coralDna[coralN] = cr.dna || { speed: 1, sense: 1, metabolism: 1, hueShift: 0, venom: 0 };
      coralRest[coralN] = cr.rest || 0;
      coralN++;
    }

    const titanPos = new Array(titan.size);
    const titanVel = new Array(titan.size);
    const titanDna = new Array(titan.size);
    const titanRest = new Float32Array(titan.size);
    let titanN = 0;
    for (const [id, tt] of titan.entries()) {
      const pos = position.get(id);
      const vel = velocity.get(id);
      if (!pos || !vel) continue;
      titanPos[titanN] = pos;
      titanVel[titanN] = vel;
      titanDna[titanN] = tt.dna || { speed: 1, sense: 1, metabolism: 1, hueShift: 0 };
      titanRest[titanN] = tt.rest || 0;
      titanN++;
    }

    for (const [id, ag] of agent.entries()) {
      const pos = position.get(id);
      const vel = velocity.get(id);
      if (!pos || !vel) continue;

      const dna = ag.dna || { speed: 1, sense: 1, metabolism: 1, hueShift: 0 };
      const seekRadius = 140 * dna.sense;

      let target = null;
      let targetDist2 = Infinity;

      const nearbyResources = querySpatial(resourceGrid, pos.x, pos.y, seekRadius);
      for (const r of nearbyResources) {
        const dx = r.pos.x - pos.x;
        const dy = r.pos.y - pos.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < targetDist2 && d2 < seekRadius * seekRadius) {
          targetDist2 = d2;
          target = r.pos;
        }
      }

      // Seek resource
      if (target) {
        const dx = target.x - pos.x;
        const dy = target.y - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const desiredSpeed = 40 * dna.speed;
        const desiredVx = (dx / dist) * desiredSpeed;
        const desiredVy = (dy / dist) * desiredSpeed;
        // Blend current velocity toward desired
        const blend = 0.8;
        vel.vx = vel.vx * blend + desiredVx * (1 - blend);
        vel.vy = vel.vy * blend + desiredVy * (1 - blend);
      }

      // Simple separation: avoid crowding other agents
      let ax = 0;
      let ay = 0;
      const nearbyAgents = querySpatial(agentGrid, pos.x, pos.y, avoidRadius);
      for (const other of nearbyAgents) {
        if (other.id === id) continue;
        const p2 = other.pos;
        const dx = pos.x - p2.x;
        const dy = pos.y - p2.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0 && d2 < avoidRadius * avoidRadius) {
          const dist = Math.sqrt(d2) || 1;
          const strength = (avoidRadius - dist) / avoidRadius;
          ax += (dx / dist) * strength * 30;
          ay += (dy / dist) * strength * 30;
        }
      }
      vel.vx += ax * dt;
      vel.vy += ay * dt;
    }

    // Predators seek nearest agents (typed-lane iteration)
    const predatorSeekRadius = 200;
    for (let pi = 0; pi < predatorN; pi++) {
      if (predatorRest[pi] > 0) continue;

      const pos = predatorPos[pi];
      const vel = predatorVel[pi];
      const dna = predatorDna[pi];
      const seekRadius = predatorSeekRadius * dna.sense;

      // Aggression index: how hard they commit to targets
      const aggression = Math.max(0.2, Math.min(1.4, dna.speed + dna.sense - dna.metabolism));

      let target = null;
      let targetDist2 = Infinity;
      const nearbyAgents = querySpatial(agentGrid, pos.x, pos.y, seekRadius);
      for (const prey of nearbyAgents) {
        const apos = prey.pos;
        const dx = apos.x - pos.x;
        const dy = apos.y - pos.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < targetDist2 && d2 < seekRadius * seekRadius) {
          targetDist2 = d2;
          target = apos;
        }
      }

      if (target) {
        const dx = target.x - pos.x;
        const dy = target.y - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const desiredSpeed = 60 * dna.speed * (0.8 + aggression * 0.25);
        const desiredVx = (dx / dist) * desiredSpeed;
        const desiredVy = (dy / dist) * desiredSpeed;
        const blend = 0.65 + aggression * 0.1;
        vel.vx = vel.vx * blend + desiredVx * (1 - blend);
        vel.vy = vel.vy * blend + desiredVy * (1 - blend);
      }
    }

    // Apex hunters seek predators and coral (typed-lane iteration)
    const apexSeekRadius = 260;
    for (let ai = 0; ai < apexN; ai++) {
      if (apexRest[ai] > 0) continue;

      const pos = apexPos[ai];
      const vel = apexVel[ai];
      const dna = apexDna[ai];
      const seekRadius = apexSeekRadius * dna.sense;

      let target = null;
      let targetDist2 = Infinity;
      const nearbyPredators = querySpatial(predatorGrid, pos.x, pos.y, seekRadius);
      for (const prey of nearbyPredators) {
        const ppos = prey.pos;
        const dx = ppos.x - pos.x;
        const dy = ppos.y - pos.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < targetDist2 && d2 < seekRadius * seekRadius) {
          targetDist2 = d2;
          target = ppos;
        }
      }
      const nearbyCoral = querySpatial(coralGrid, pos.x, pos.y, seekRadius);
      for (const prey of nearbyCoral) {
        const cpos = prey.pos;
        const dx = cpos.x - pos.x;
        const dy = cpos.y - pos.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < targetDist2 && d2 < seekRadius * seekRadius) {
          targetDist2 = d2;
          target = cpos;
        }
      }

      if (target) {
        const dx = target.x - pos.x;
        const dy = target.y - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const desiredSpeed = 55 * dna.speed;
        const desiredVx = (dx / dist) * desiredSpeed;
        const desiredVy = (dy / dist) * desiredSpeed;
        const blend = 0.8;
        vel.vx = vel.vx * blend + desiredVx * (1 - blend);
        vel.vy = vel.vy * blend + desiredVy * (1 - blend);
      }
    }

    // Coral hunters seek agents (typed-lane iteration)
    const coralSeekRadius = 180;
    for (let ci = 0; ci < coralN; ci++) {
      if (coralRest[ci] > 0) continue;

      const pos = coralPos[ci];
      const vel = coralVel[ci];
      const dna = coralDna[ci];
      const seekRadius = coralSeekRadius * dna.sense;

      let target = null;
      let targetDist2 = Infinity;
      const nearbyAgents = querySpatial(agentGrid, pos.x, pos.y, seekRadius);
      for (const prey of nearbyAgents) {
        const apos = prey.pos;
        const dx = apos.x - pos.x;
        const dy = apos.y - pos.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < targetDist2 && d2 < seekRadius * seekRadius) {
          targetDist2 = d2;
          target = apos;
        }
      }

      if (target) {
        const dx = target.x - pos.x;
        const dy = target.y - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const desiredSpeed = 50 * dna.speed;
        const desiredVx = (dx / dist) * desiredSpeed;
        const desiredVy = (dy / dist) * desiredSpeed;
        const blend = 0.7;
        vel.vx = vel.vx * blend + desiredVx * (1 - blend);
        vel.vy = vel.vy * blend + desiredVy * (1 - blend);
      }
    }

    // Titans hunt apex hexagons (typed-lane iteration)
    const titanSeekRadius = 300;
    for (let ti = 0; ti < titanN; ti++) {
      if (titanRest[ti] > 0) continue;

      const pos = titanPos[ti];
      const vel = titanVel[ti];
      const dna = titanDna[ti];
      const seekRadius = titanSeekRadius * dna.sense;

      let target = null;
      let targetDist2 = Infinity;
      const nearbyApex = querySpatial(apexGrid, pos.x, pos.y, seekRadius);
      for (const prey of nearbyApex) {
        const apos = prey.pos;
        const dx = apos.x - pos.x;
        const dy = apos.y - pos.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < targetDist2 && d2 < seekRadius * seekRadius) {
          targetDist2 = d2;
          target = apos;
        }
      }

      if (target) {
        const dx = target.x - pos.x;
        const dy = target.y - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const desiredSpeed = 44 * dna.speed;
        const desiredVx = (dx / dist) * desiredSpeed;
        const desiredVy = (dy / dist) * desiredSpeed;
        const blend = 0.72;
        vel.vx = vel.vx * blend + desiredVx * (1 - blend);
        vel.vy = vel.vy * blend + desiredVy * (1 - blend);
      }
    }

  }

  // Metabolism & eating: agents lose energy over time, gain by consuming resources.
  function metabolismSystem(dt) {
    const { position, agent, predator, apex, coral, titan, resource, burst } = ecs.components;
    const eatRadius = 10;
    const baseDrain = 0.03 * world.globals.metabolism; // per second, modulated by regime

    const resourceList = [];
    for (const [id, res] of resource.entries()) {
      if (res.amount <= 0) continue;
      const pos = position.get(id);
      if (!pos) continue;
      resourceList.push({ id, pos, data: res });
    }
    const resourceGrid = buildSpatialIndex(resourceList, eatRadius);

    const agentList = [];
    for (const [id, ag] of agent.entries()) {
      const pos = position.get(id);
      if (!pos) continue;
      agentList.push({ id, pos, data: ag });
    }
    const agentGrid = buildSpatialIndex(agentList, 12);

    const predatorList = [];
    for (const [id, pred] of predator.entries()) {
      const pos = position.get(id);
      if (!pos) continue;
      predatorList.push({ id, pos, data: pred });
    }
    const predatorGrid = buildSpatialIndex(predatorList, 14);

    const coralList = [];
    for (const [id, cr] of coral.entries()) {
      const pos = position.get(id);
      if (!pos) continue;
      coralList.push({ id, pos, data: cr });
    }
    const coralGrid = buildSpatialIndex(coralList, 14);

    const apexList = [];
    for (const [id, ap] of apex.entries()) {
      const pos = position.get(id);
      if (!pos) continue;
      apexList.push({ id, pos, data: ap });
    }
    const apexGrid = buildSpatialIndex(apexList, 14);

    // Phase 5 typed lanes for metabolism/predation loops
    const predatorLane = [];
    for (const [id, pred] of predator.entries()) {
      const pos = position.get(id);
      if (!pos) continue;
      predatorLane.push({ id, pred, pos });
    }

    const apexLane = [];
    for (const [id, ap] of apex.entries()) {
      const pos = position.get(id);
      if (!pos) continue;
      apexLane.push({ id, ap, pos });
    }

    const coralLane = [];
    for (const [id, cr] of coral.entries()) {
      const pos = position.get(id);
      if (!pos) continue;
      coralLane.push({ id, cr, pos });
    }

    const titanLane = [];
    for (const [id, tt] of titan.entries()) {
      const pos = position.get(id);
      if (!pos) continue;
      titanLane.push({ id, tt, pos });
    }

    for (const [id, ag] of agent.entries()) {
      const dna = ag.dna || { speed: 1, sense: 1, metabolism: 1, hueShift: 0 };
      ag.energy -= baseDrain * dna.metabolism * dt;
      if (ag.energy < 0) ag.energy = 0;

      const pos = position.get(id);
      if (!pos) continue;

      const nearbyResources = querySpatial(resourceGrid, pos.x, pos.y, eatRadius);
      for (const r of nearbyResources) {
        const res = r.data;
        if (res.amount <= 0) continue;
        const rpos = r.pos;
        const dx = rpos.x - pos.x;
        const dy = rpos.y - pos.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < eatRadius * eatRadius) {
          const bite = Math.min(0.6, res.amount);
          res.amount -= bite;
          ag.energy = Math.min(2.0, ag.energy + bite); // allow some over-fullness
        }
      }
    }

    // Predators eat agents
    const predEatRadius = 9;
    const predDrain = baseDrain * 1.9;
    for (const lane of predatorLane) {
      const pid = lane.id;
      const pred = lane.pred;
      const ppos = lane.pos;
      const dna = pred.dna || { speed: 1, sense: 1, metabolism: 1, hueShift: 0 };
      const aggression = Math.max(0.2, Math.min(1.4, dna.speed + dna.sense - dna.metabolism));

      // Rest timer after a successful hunt
      pred.rest = Math.max(0, (pred.rest || 0) - dt);

      // Only drain energy when not resting as much
      const restFactor = pred.rest > 0 ? 0.4 : 1.0;
      pred.energy -= predDrain * dna.metabolism * (0.7 + aggression * 0.4) * dt * restFactor;
      if (pred.energy < 0) pred.energy = 0;

      // Skip hunting if still resting from a previous kill
      if (pred.rest > 0) continue;

      const nearbyAgents = querySpatial(agentGrid, ppos.x, ppos.y, predEatRadius);
      for (const prey of nearbyAgents) {
        const aid = prey.id;
        const ag = prey.data;
        if (!agent.has(aid)) continue;
        const apos = prey.pos;
        const dx = apos.x - ppos.x;
        const dy = apos.y - ppos.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < predEatRadius * predEatRadius) {
          // Spawn small "absorption" particles from prey toward predator
          const requested = Math.max(1, Math.round(4 * (world.globals.effectQuality ?? 1)));
          const particles = Math.min(requested, Math.max(0, getBurstBudget() - burst.size));
          const hue = pred.colorHue ?? 30;
          const baseSpeed = 70;
          for (let i = 0; i < particles; i++) {
            const id = acquireBurstEntity();
            position.set(id, { x: apos.x, y: apos.y });
            const vx = (ppos.x - apos.x) * (0.8 + rng.float() * 0.5);
            const vy = (ppos.y - apos.y) * (0.8 + rng.float() * 0.5);
            burst.set(id, {
              vx: vx * (baseSpeed / (Math.hypot(vx, vy) || 1)),
              vy: vy * (baseSpeed / (Math.hypot(vx, vy) || 1)),
              life: 0.5 + rng.float() * 0.3,
              hue,
            });
          }

          ecs.destroyEntity(aid);
          pred.energy = Math.min(3.5, pred.energy + 1.0);
          pred.rest = 4 + rng.float() * 3; // 4–7s rest after a kill
          break;
        }
      }
    }

    // Apex metabolism and eating predators and coral
    const apexEatRadius = 12;
    const apexDrain = baseDrain * 1.1;
    const VENOM_ENERGY_PENALTY = 0.5; // fraction by which high-venom coral reduces apex energy gain
    for (const lane of apexLane) {
      const aid = lane.id;
      const ap = lane.ap;
      const apos = lane.pos;
      const dna = ap.dna || { speed: 1, sense: 1, metabolism: 1, hueShift: 0 };
      ap.rest = Math.max(0, (ap.rest || 0) - dt);
      ap.age = (ap.age || 0) + dt;

      const restFactor = ap.rest > 0 ? 0.3 : 1.0;
      ap.energy -= apexDrain * dna.metabolism * dt * restFactor;
      if (ap.energy < 0) ap.energy = 0;

      // Skip hunting while resting
      if (ap.rest > 0) continue;

      let eaten = false;
      const nearbyPredators = querySpatial(predatorGrid, apos.x, apos.y, apexEatRadius);
      for (const prey of nearbyPredators) {
        const pid = prey.id;
        if (!predator.has(pid)) continue;
        const ppos = prey.pos;
        const dx = ppos.x - apos.x;
        const dy = ppos.y - apos.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < apexEatRadius * apexEatRadius) {
          ecs.destroyEntity(pid);
          ap.energy = Math.min(5.0, ap.energy + 1.5);
          eaten = true;

          // Apex no longer explodes/supernovas; it just keeps hunting and resting.
          ap.rest = 4 + rng.float() * 2; // 4–6s rest after eating a predator
          break;
        }
      }
      if (eaten) continue;

      // Also eat coral
      const nearbyCoral = querySpatial(coralGrid, apos.x, apos.y, apexEatRadius);
      for (const prey of nearbyCoral) {
        const cid = prey.id;
        if (!coral.has(cid)) continue;
        const cr = prey.data;
        const cpos = prey.pos;
        const dx = cpos.x - apos.x;
        const dy = cpos.y - apos.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < apexEatRadius * apexEatRadius) {
          const venom = cr.dna?.venom ?? 0;
          ecs.destroyEntity(cid);
          ap.energy = Math.min(5.0, ap.energy + 1.0 * (1 - venom * VENOM_ENERGY_PENALTY));
          ap.rest = 3 + rng.float() * 2; // slightly shorter rest after eating coral
          break;
        }
      }
    }

    // Titans metabolize and eat apex
    const titanEatRadius = 13;
    const titanDrain = baseDrain * 1.25;
    for (const lane of titanLane) {
      const tid = lane.id;
      const tt = lane.tt;
      const tpos = lane.pos;
      const dna = tt.dna || { speed: 1, sense: 1, metabolism: 1, hueShift: 0 };
      tt.rest = Math.max(0, (tt.rest || 0) - dt);
      tt.age = (tt.age || 0) + dt;

      const restFactor = tt.rest > 0 ? 0.35 : 1.0;
      tt.energy -= titanDrain * dna.metabolism * dt * restFactor;
      if (tt.energy < 0) tt.energy = 0;

      if (tt.rest > 0) continue;

      const nearbyApex = querySpatial(apexGrid, tpos.x, tpos.y, titanEatRadius);
      for (const prey of nearbyApex) {
        const aid = prey.id;
        if (!apex.has(aid)) continue;
        const apos = prey.pos;
        const dx = apos.x - tpos.x;
        const dy = apos.y - tpos.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < titanEatRadius * titanEatRadius) {
          ecs.destroyEntity(aid);
          tt.energy = Math.min(6.0, tt.energy + 1.6);
          tt.rest = 5 + rng.float() * 3;
          break;
        }
      }
    }

    // Coral metabolism and eating agents
    const coralEatRadius = 8;
    const coralDrain = baseDrain * 1.5;
    for (const lane of coralLane) {
      const cid = lane.id;
      const cr = lane.cr;
      const cpos = lane.pos;
      const dna = cr.dna || { speed: 1, sense: 1, metabolism: 1, hueShift: 0, venom: 0 };
      cr.rest = Math.max(0, (cr.rest || 0) - dt);
      cr.age = (cr.age || 0) + dt;

      const restFactor = cr.rest > 0 ? 0.4 : 1.0;
      cr.energy -= coralDrain * dna.metabolism * dt * restFactor;
      if (cr.energy < 0) cr.energy = 0;

      if (cr.rest > 0) continue;

      const nearbyAgents = querySpatial(agentGrid, cpos.x, cpos.y, coralEatRadius);
      for (const prey of nearbyAgents) {
        const aid = prey.id;
        const ag = prey.data;
        if (!agent.has(aid)) continue;
        const apos = prey.pos;
        const dx = apos.x - cpos.x;
        const dy = apos.y - cpos.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < coralEatRadius * coralEatRadius) {
          // Spawn absorption particles
          const requested = Math.max(1, Math.round(3 * (world.globals.effectQuality ?? 1)));
          const particles = Math.min(requested, Math.max(0, getBurstBudget() - burst.size));
          const hue = cr.colorHue ?? 340;
          const baseSpeed = 60;
          for (let i = 0; i < particles; i++) {
            const pid = acquireBurstEntity();
            position.set(pid, { x: apos.x, y: apos.y });
            const vx = (cpos.x - apos.x) * (0.8 + rng.float() * 0.5);
            const vy = (cpos.y - apos.y) * (0.8 + rng.float() * 0.5);
            burst.set(pid, {
              vx: vx * (baseSpeed / (Math.hypot(vx, vy) || 1)),
              vy: vy * (baseSpeed / (Math.hypot(vx, vy) || 1)),
              life: 0.4 + rng.float() * 0.3,
              hue,
            });
          }
          ecs.destroyEntity(aid);
          cr.energy = Math.min(3.0, cr.energy + 0.9);
          cr.rest = 3 + rng.float() * 2; // 3–5s rest after a kill
          break;
        }
      }
    }
  }

  // Ecology: resources regrow over time when depleted and pods seed new plants.
  function ecologySystem(dt) {
    const { resource, position } = ecs.components;
    const fertility = world.globals.fertility;

    // Global pod count for limiting explosive growth
    let podCount = 0;
    for (const res of resource.values()) {
      if (res.kind === 'pod') podCount++;
    }

    const MAX_PODS = 80;          // soft global cap
    const MAX_POD_CYCLES = 3;     // per-pod explosion limit

    for (const [id, res] of resource.entries()) {
      // Age tracks time since last regrowth
      res.age = (res.age || 0) + dt;

      // Seed pod explosion: when mature and still fairly full, within limits
      if (
        res.kind === 'pod' &&
        res.seedTimer != null &&
        res.age > res.seedTimer &&
        res.amount > 0.6 &&
        (res.cycles || 0) < MAX_POD_CYCLES &&
        podCount < MAX_PODS
      ) {
        const pos = position.get(id);
        if (pos) {
          const seeds = 4 + (id % 4); // 4–7 new plants
          const baseAngle = (id * 0.6) % (Math.PI * 2);
          const baseDist = 18 + res.amount * 10;

          for (let i = 0; i < seeds; i++) {
            const angle = baseAngle + (i * (Math.PI * 2 / seeds)) + (rng.float() - 0.5) * 0.3;
            const dist = baseDist * (0.7 + rng.float() * 0.6);
            let nx = pos.x + Math.cos(angle) * dist;
            let ny = pos.y + Math.sin(angle) * dist;

            // Wrap positions into world bounds
            if (nx < 0) nx += width;
            if (nx >= width) nx -= width;
            if (ny < 0) ny += height;
            if (ny >= height) ny -= height;

            // Seed pods create more pods, forming clustered groves
            makeSeedPod(nx, ny);
          }
        }
        // Pod partially depletes and starts a new seed timer; count a new cycle
        res.amount = 0.3;
        res.cycles = (res.cycles || 0) + 1;
        res.age = 0; // reset per-cycle animation
        res.seedTimer = 10 + rng.float() * 12;
        podCount++; // track new pod
      }

      if (res.amount > 0.99) continue;
      res.regenTimer -= dt * (0.8 + fertility * 1.2);
      if (res.regenTimer <= 0) {
        res.amount = 1;
        res.regenTimer = 6 + Math.random() * 4; // slightly faster, staggered regrowth
        res.cycles = (res.cycles || 0) + 1;
        res.age = 0; // new visible growth cycle
      }
    }
  }

  // Reproduction & growth.
  function lifeCycleSystem(dt) {
    const { position, velocity, agent, predator, apex, coral, titan, burst } = ecs.components;

    // Herbivore lifecycle
    for (const [id, ag] of Array.from(agent.entries())) {
      // Age grows slowly over time
      ag.age = (ag.age || 0) + dt;

      // Clamp energy at zero but do not kill agents
      if (ag.energy <= 0) {
        ag.energy = 0;
      }

      // Reproduction
      if (ag.energy >= world.globals.reproductionThreshold && ag.age > 8) {
        const parentPos = position.get(id);
        const parentVel = velocity.get(id);
        if (!parentPos || !parentVel) continue;

        const jitter = () => (rng.float() - 0.5) * 8;
        const childId = makeAgent(
          parentPos.x + jitter(),
          parentPos.y + jitter(),
          ag.colorHue,
          ag.dna,
        );
        const childVel = velocity.get(childId);
        childVel.vx = parentVel.vx + jitter();
        childVel.vy = parentVel.vy + jitter();
        const childAgent = agent.get(childId);
        childAgent.energy = ag.energy * 0.5;

        ag.energy *= 0.5;
      }
    }

    // Predator lifecycle: age + reproduction + death when fully starved
    for (const [pid, pred] of Array.from(predator.entries())) {
      pred.age = (pred.age || 0) + dt;

      if (pred.energy >= 2.8 && pred.age > 10) {
        const pos = position.get(pid);
        const vel = velocity.get(pid);
        if (pos && vel) {
          const jitter = () => (rng.float() - 0.5) * 10;
          const childId = makePredator(
            pos.x + jitter(),
            pos.y + jitter(),
            pred.dna,
          );
          const childVel = velocity.get(childId);
          childVel.vx = vel.vx + jitter();
          childVel.vy = vel.vy + jitter();
          pred.energy *= 0.5;
        }
      }

      if (pred.energy <= 0) {
        ecs.destroyEntity(pid);
      }
    }

    // Apex lifecycle: reproduce more readily than predators + death when fully starved
    for (const [id, ap] of Array.from(apex.entries())) {
      if (ap.energy >= 3.2 && ap.age > 14) {
        const pos = position.get(id);
        const vel = velocity.get(id);
        if (pos && vel) {
          const jitter = () => (rng.float() - 0.5) * 12;
          const childId = makeApex(
            pos.x + jitter(),
            pos.y + jitter(),
            ap.dna,
          );
          const childVel = velocity.get(childId);
          childVel.vx = vel.vx + jitter();
          childVel.vy = vel.vy + jitter();
          ap.energy *= 0.55; // keep a bit more energy post-reproduction
        }
      }

      if (ap.energy <= 0) {
        ecs.destroyEntity(id);
      }
    }

    // Coral lifecycle: reproduce + death when starved
    for (const [id, cr] of Array.from(coral.entries())) {
      if (cr.energy >= 2.5 && cr.age > 12) {
        const pos = position.get(id);
        const vel = velocity.get(id);
        if (pos && vel) {
          const jitter = () => (rng.float() - 0.5) * 10;
          const childId = makeCoral(
            pos.x + jitter(),
            pos.y + jitter(),
            cr.dna,
          );
          const childVel = velocity.get(childId);
          childVel.vx = vel.vx + jitter();
          childVel.vy = vel.vy + jitter();
          cr.energy *= 0.5;
        }
      }

      if (cr.energy <= 0) {
        ecs.destroyEntity(id);
      }
    }

    // Titan lifecycle
    for (const [id, tt] of Array.from(titan.entries())) {
      if (tt.energy >= 4.8 && tt.age > 20 && rng.float() < 0.06) {
        const pos = position.get(id);
        const vel = velocity.get(id);
        if (pos && vel) {
          const jitter = () => (rng.float() - 0.5) * 14;
          const childId = makeTitan(pos.x + jitter(), pos.y + jitter(), tt.dna);
          const childVel = velocity.get(childId);
          childVel.vx = vel.vx + jitter();
          childVel.vy = vel.vy + jitter();
          tt.energy *= 0.6;
        }
      }

      if (tt.energy <= 0) {
        ecs.destroyEntity(id);
      }
    }

    // Fade and clean up burst particles (recycle IDs via pool)
    for (const [id, p] of Array.from(burst.entries())) {
      p.life -= dt;
      if (p.life <= 0) {
        recycleBurstEntity(id);
      }
    }

    // Dynamic baseline threshold with chaos influence (higher chaos => slightly easier breeding)
    world.globals.reproductionThreshold = 1.6 - world.globals.chaosLevel * 0.15;
  }

  // Apply force fields (attractors/repulsors painted by user).
  function forceFieldSystem(dt) {
    const { position, velocity, forceField } = ecs.components;
    if (forceField.size === 0) return;
    for (const [fid, field] of forceField.entries()) {
      const fpos = position.get(fid);
      if (!fpos) continue;
      const radius2 = field.radius * field.radius;
      for (const [id, vel] of velocity.entries()) {
        const pos = position.get(id);
        if (!pos || pos === fpos) continue;
        const dx = fpos.x - pos.x;
        const dy = fpos.y - pos.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > radius2 || d2 === 0) continue;
        const dist = Math.sqrt(d2) || 1;
        const dir = field.strength >= 0 ? 1 : -1;
        const strength = (1 - dist / field.radius) * Math.abs(field.strength);
        const ax = (dx / dist) * dir * strength;
        const ay = (dy / dist) * dir * strength;
        vel.vx += ax * dt;
        vel.vy += ay * dt;
      }
    }
  }

  // Regime system: calm vs storm based on population & resource scarcity.
  function regimeSystem(dt) {
    const { agent, resource } = ecs.components;
    const pop = agent.size;
    let totalRes = 0;
    for (const r of resource.values()) totalRes += r.amount;
    const avgRes = resource.size ? totalRes / resource.size : 0;

    // Simple heuristic: low resources + high population increases storminess.
    const scarcity = avgRes < 0.5 ? (0.5 - avgRes) * 2 : 0;
    const pressure = pop / 80;
    const chaosBias = world.globals.chaosLevel * 0.45;
    const targetStorm = Math.max(0, Math.min(1, scarcity * 0.6 + pressure * 0.25 + chaosBias));

    // Smooth toward target.
    world.globals.storminess += (targetStorm - world.globals.storminess) * 0.05;

    // Map storminess to metabolism and regime label.
    const s = world.globals.storminess;
    world.globals.metabolism = 1 + s * 1.5 + world.globals.chaosLevel * 0.25; // faster drain with chaos/storm
    world.regime = s > 0.55 ? 'storm' : 'calm';
  }

  function step(dt) {
    world.tick++;
    const stride = Math.max(1, world.globals.updateStride || 1);
    const doHeavy = (world.tick % stride) === 0;

    if (doHeavy) {
      steeringSystem(dt * stride);
      forceFieldSystem(dt * stride);
      collisionSystem(dt * stride);
    }

    physicsSystem(dt);
    metabolismSystem(dt);
    ecologySystem(dt);
    lifeCycleSystem(dt);
    regimeSystem(dt);
  }

  // Paint/update force fields at a point with a given polarity.
  world.paintForceField = (point, polarity) => {
    const { position, forceField } = ecs.components;
    const radius = 80;
    const strength = polarity * 50; // positive = attract, negative = repel

    // Try to reuse a nearby field instead of spamming new ones
    let targetId = null;
    for (const [id, field] of forceField.entries()) {
      const pos = position.get(id);
      if (!pos) continue;
      const dx = pos.x - point.x;
      const dy = pos.y - point.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < (radius * 0.6) * (radius * 0.6)) {
        targetId = id;
        break;
      }
    }

    if (targetId == null) {
      targetId = ecs.createEntity();
      position.set(targetId, { x: point.x, y: point.y });
    } else {
      const pos = position.get(targetId);
      pos.x = point.x;
      pos.y = point.y;
    }

    forceField.set(targetId, { strength, radius });
  };

  world.step = step;
  return world;
}
