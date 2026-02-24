# Branch Tree

A minimalist 2D generative branching tree on a black background.

- Green neon branches
- Random branching
- Random branch termination (some branches stop growing)
- No auto-spawn/reseed; click to drop a seed and germinate a tree
- Slow self-reproduction via occasional seed drops
- Heritable growth traits with small mutations each generation
- Grazer mechanic: dense clusters attract wandering grazers (small circular units) that eat branches
- Grazers can reproduce in dense feeding zones
- Added a higher trophic predator level that hunts grazers
- Tree competition/crowding pressure reduces branching + reproduction in dense patches

## Run

From repo root:

```bash
npx serve .
```

Open:

- `http://localhost:3000/branch-tree/`
