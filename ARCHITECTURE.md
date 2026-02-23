# Architecture

This document describes the internal design of Reality Sandbox.

## Overview

Reality Sandbox is a **static ES-module web app** with no build step. The simulation runs in a fixed-timestep loop driven by `requestAnimationFrame`, drawing onto an HTML `<canvas>` element.

```
index.html  →  app.js  →  core/world.js  →  core/ecs.js
                       →  core/render.js
                       →  core/inspector.js
                       →  core/rng.js
```

---

## ECS-lite

The ECS (Entity-Component-System) implementation lives in `core/ecs.js` and is intentionally minimal.

### Entities

Entities are plain **integer IDs** allocated by a global counter:

```js
let nextId = 1;
function createEntity() { return nextId++; }
```

### Components

Each component type is a `Map<entityId, data>`:

| Component | Data shape |
|---|---|
| `position` | `{ x, y }` |
| `velocity` | `{ vx, vy }` |
| `agent` | `{ colorHue, energy, age, dna, evolved, caste }` |
| `predator` | `{ colorHue, energy, age, dna, rest }` |
| `apex` | `{ colorHue, energy, age, rest, dna }` |
| `burst` | `{ vx, vy, life, hue }` — transient particles |
| `resource` | `{ kind, amount, regenTimer, age, cycles, seedTimer, dna }` |
| `forceField` | `{ strength, radius }` |

### Systems

Systems are **pure functions** called once per tick in a fixed order inside `world.step(dt)`:

```
steeringSystem → forceFieldSystem → collisionSystem → physicsSystem
→ metabolismSystem → ecologySystem → lifeCycleSystem → regimeSystem
```

The `view(...keys)` generator on the ECS object yields entities that have all listed components, but most systems iterate component maps directly for performance.

---

## Core Modules

### `core/rng.js` — Deterministic PRNG

Implements the **Mulberry32** algorithm. A string seed (e.g. `Date.now()`) is hashed to a 32-bit integer via FNV-1a, producing a reproducible sequence.

```js
const rng = createRng('my-seed');
rng.float()        // → [0, 1)
rng.int(min, max)  // → integer in [min, max]
rng.choice(arr)    // → random element
```

### `core/world.js` — Simulation State and Systems

Creates the world object and wires up all eight simulation systems. Notable design choices:

- **Toroidal wrapping** – entities that leave the world boundary re-enter on the opposite side.
- **DNA traits** – each creature has `{ speed, sense, metabolism, hueShift }` traits that influence speed caps, seek radius, energy drain, and color.
- **Calm / Storm regime** – the `regimeSystem` monitors average resource level and population to smoothly ramp `globals.storminess`, which increases metabolism drain and shifts the visual hue.

### `core/render.js` — Canvas Renderer

Applies a camera transform (`translate + scale + translate`) so the world can be zoomed and panned. On the first render, the camera zoom is auto-fitted to show the entire world.

Rendering order (back to front):
1. Trail fade (semi-transparent black fill)
2. Radial fog gradient
3. Resources (circuitboard-style plant branches, seed pod outlines)
4. Burst particles
5. Force field overlays
6. Predators (velocity-facing triangles)
7. Apex hunters (wobbly hexagonal blobs)
8. Agents (colored circles, caste-styled)

### `core/inspector.js` — Entity Inspector

Detects a click within `hitRadius = 8` world-units of any entity with `position + (agent | predator | resource)` components and renders an editable form panel. Live edits are written directly back to the ECS component maps.

---

## Fixed-Timestep Loop (`app.js`)

```
dt = 0.06 s   (60 ticks per 3.6 real seconds)
```

`requestAnimationFrame` accumulates elapsed wall-clock time. When the accumulator exceeds `MS_PER_TICK`, one or more `world.step(dt)` calls drain it. This decouples simulation rate from frame rate and ensures determinism.

---

## GitHub Pages Deployment

The repository is a self-contained static site. The `.github/workflows/pages.yml` workflow deploys the repo root to GitHub Pages on every push to `main`.
