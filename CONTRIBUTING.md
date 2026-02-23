# Contributing to Reality Sandbox

Thank you for your interest in contributing! Below are the guidelines for reporting issues, proposing features, and submitting code changes.

## Code of Conduct

By participating, you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Bugs

1. Search [existing issues](../../issues) to avoid duplicates.
2. Open a new issue using the **Bug Report** template and fill in all sections.
3. Attach a reproducible seed value whenever possible — the seed is shown in the UI status bar.

### Suggesting Features

1. Search existing issues for similar ideas.
2. Open a new issue using the **Feature Request** template.
3. Describe the motivation and how the feature fits the ECS-lite architecture.

### Submitting Pull Requests

1. **Fork** the repository and create a branch from `main`:
   ```bash
   git checkout -b feature/my-change
   ```
2. Keep changes focused — one logical change per PR.
3. Follow the existing code style (see `.editorconfig` and `.eslintrc.json`).
4. Test in at least one modern browser (`npx serve .`).
5. Fill in the Pull Request template completely.
6. Open the PR against the `main` branch.

## Development Setup

```bash
# No build step required — just serve the static files:
npx serve .
```

Open the URL printed by `serve` (usually `http://localhost:3000`) and use the browser's DevTools console to debug.

## Code Style

- **Indentation:** 2 spaces (see `.editorconfig`)
- **Quotes:** single quotes for JavaScript strings
- **Semicolons:** always
- **Line length:** ≤ 100 characters where practical
- Run `npx eslint .` to check for lint errors before opening a PR

## Project Structure Primer

See [ARCHITECTURE.md](ARCHITECTURE.md) for an explanation of the ECS-lite design and each simulation system.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
