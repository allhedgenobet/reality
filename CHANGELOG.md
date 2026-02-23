# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [M1] — Initial Release

### Added
- Static site structure suitable for GitHub Pages deployment
- Deterministic PRNG using Mulberry32 algorithm with string-to-int seed hashing (FNV-1a)
- Fixed-timestep simulation loop (`dt = 0.06 s`) driven by `requestAnimationFrame`
- **Start / Pause / Step** transport controls
- ECS-lite core (`core/ecs.js`): entity IDs, component `Map`s, `view()` generator helper
- World state (`core/world.js`) with three-tier food chain: Agents, Predators, Apex hunters
- Eight simulation systems: physics, collision, steering, metabolism, ecology, lifecycle, force-field, regime
- DNA trait system: `{ speed, sense, metabolism, hueShift }` with per-reproduction mutation
- Calm ↔ Storm regime transitions driven by population pressure and resource scarcity
- Seed pod explosion mechanic: pods spawn clustered groves of new plants
- Canvas renderer (`core/render.js`) with camera zoom/pan, trail fade, radial fog, and regime hue shifts
- Circuitboard-style plant rendering with depth, lean, and growth-cycle branching
- Predator triangles with velocity-facing and DNA-driven shape variation
- Apex hunter wobbly-blob rendering with orbiting prey dots
- Burst particle system for apex explosions and predator kill absorptions
- Force field rendering as pulsing translucent circles
- Entity inspector panel (`core/inspector.js`) with live-editable component fields
- Interactive tools: Spawn Agent, Spawn Resource, Force Brush, Zoom In/Out
- Canvas-to-world coordinate mapping accounting for camera zoom and pan
- Comprehensive documentation: README, ARCHITECTURE, CONTRIBUTING, CODE_OF_CONDUCT
- GitHub Actions workflows: lint, build validation, GitHub Pages deployment
- GitHub issue and pull request templates
- `.editorconfig`, `.eslintrc.json`, `.prettierrc`, `package.json`
- `.github/dependabot.yml` for automated dependency updates
