# Reality Sandbox

A deterministic 2D browser-based ecosystem sandbox with agents, resources, force fields, and emergent food-chain dynamics — all running as a static site with zero build step.

[![Pages](https://github.com/allhedgenobet/reality/actions/workflows/pages.yml/badge.svg)](https://github.com/allhedgenobet/reality/actions/workflows/pages.yml)
[![Lint](https://github.com/allhedgenobet/reality/actions/workflows/lint.yml/badge.svg)](https://github.com/allhedgenobet/reality/actions/workflows/lint.yml)

## Features

- **Deterministic simulation** – Mulberry32 PRNG seeded from a timestamp; every run is reproducible.
- **ECS-lite architecture** – entities are plain integer IDs; components are `Map`s; systems are pure functions.
- **Three-tier food chain** – herbivore Agents → Predators → Apex hunters, each with DNA-driven traits.
- **Emergent ecology** – plants regrow, seed pods explode into groves, and storminess ramps up under scarcity.
- **Interactive tools** – spawn agents/resources, paint attractor/repulsor force fields, and zoom/pan.
- **Entity inspector** – click any entity to view and live-edit its component data.
- **No build step** – pure ES modules; runs directly in any modern browser.
- **GitHub Pages ready** – deploy by pointing Pages at the repo root.

## Quick Start

```bash
# Serve locally (requires Node.js)
npx serve .
# Then open http://localhost:3000
```

Use the **Start / Pause / Step** buttons to drive the simulation, and the tool buttons to interact with the world.

## Project Structure

```text
reality/
├── index.html          # Main HTML shell
├── style.css           # UI and canvas styles
├── app.js              # UI wiring, fixed-timestep loop, tool modes
├── core/
│   ├── ecs.js          # ECS-lite: entity IDs, component Maps, view() helper
│   ├── rng.js          # Deterministic PRNG (Mulberry32) with string seed
│   ├── world.js        # World state, all simulation systems
│   ├── render.js       # Canvas renderer (camera, agents, resources, particles)
│   └── inspector.js    # Entity inspector panel
└── .github/
    ├── workflows/      # CI/CD: lint, build, pages deployment
    └── ISSUE_TEMPLATE/ # Bug report and feature request templates
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for a detailed breakdown of the ECS-lite design and each system.

## Simulation Systems

| System | Description |
|---|---|
| `physicsSystem` | Euler integration + toroidal wrapping |
| `collisionSystem` | Soft-body overlap pushes between creatures |
| `steeringSystem` | Seek nearest food/prey; separation from peers |
| `metabolismSystem` | Energy drain, eating, kill bursts |
| `ecologySystem` | Resource regen, seed pod explosions |
| `lifeCycleSystem` | Reproduction with DNA mutation, death, burst decay |
| `forceFieldSystem` | User-painted attractor/repulsor fields |
| `regimeSystem` | Calm ↔ Storm transitions driven by population pressure |

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request, and follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

MIT — see [LICENSE](LICENSE).
