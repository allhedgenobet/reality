# Neuro Pathways Sandbox

A lightweight, browser-based simulation of **brain-inspired decision pathways**.

## What this models (and what it doesn't)

- ✅ Competing neural populations (Choice A vs Choice B)
- ✅ Spiking LIF-like neurons with refractory periods
- ✅ Excitatory + inhibitory dynamics with synaptic delays
- ✅ Reward-modulated STDP-style plasticity (simplified)
- ✅ Noisy decision process over time
- ❌ Full biological realism (ion channels, detailed spiking physiology, etc.)

This is a conceptual sandbox for decision circuitry, not a medical/neuroscience model.

## Run

From repo root:

```bash
npx serve .
```

Then open:

- `http://localhost:3000/neuro-pathways/`

## Controls

- **Stimulus A/B**: external evidence input to each pathway
- **Noise**: random perturbation each tick
- **Learning rate**: reward-driven update strength
- **Inhibition**: strength of mutual suppression between choices
- **Reward Choice A**: if enabled, reward signal reinforces A-winning pathway; otherwise B

## Notes

- The system includes 2 input nodes, 2 hidden pathway pools, and 2 output decision nodes.
- Winner-take-all is soft (via inhibition + thresholding), so oscillations are possible.
