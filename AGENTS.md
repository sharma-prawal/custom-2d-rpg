# Repository Guidelines

## Project Structure & Module Organization

This is a Vite + TypeScript Phaser game. The main entry point is `src/main.ts`, which configures Phaser and registers scenes. Game screens live in `src/scenes/`, reusable game objects in `src/entities/`, shared helpers in `src/systems/`, and authored content or manifests in `src/data/`. Static runtime files are served from `public/`; generated play stats are written to `public/stats.json`. Project notes and source references belong in `docs/`, and maintenance utilities live in `scripts/`.

## Build, Test, and Development Commands

- `npm run dev`: starts the Vite dev server for local playtesting.
- `npm run build`: runs TypeScript project checks with `tsc -b`, then creates a production build in `dist/`.
- `npm run preview`: serves the production build locally for verification.
- `npm run stats`: runs `scripts/aggregate-stats.ts` and updates `public/stats.json` from `docs/dev-log.jsonl`.

Run commands from the repository root. Commit source files, docs, and intentional public assets; do not commit `node_modules/` or regenerated build output unless explicitly required.

## Coding Style & Naming Conventions

Use strict TypeScript and ES modules. The compiler enforces `strict`, `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch`, so keep imports and variables tidy. Follow the existing style: two-space indentation, single quotes, semicolons, PascalCase class and scene names such as `HubScene`, and camelCase functions, variables, and data fields. Keep Phaser-specific logic inside scenes or systems rather than expanding `main.ts`.

## Testing Guidelines

No automated test framework is currently configured. Treat `npm run build` as the required baseline check before submitting changes. For gameplay changes, also run `npm run dev` and manually verify the affected scene, player interaction, asset loading, and save-state behavior. If adding tests later, prefer colocated `*.test.ts` files or a top-level `tests/` directory, and document the new test command here.

## Commit & Pull Request Guidelines

This working directory does not include Git history, so no repository-specific commit convention can be inferred. Use concise imperative commit messages, for example `Add memory scene transition`. Pull requests should describe the gameplay or tooling change, list verification commands run, mention affected scenes/assets, and include screenshots or short recordings for visible UI or game-state changes.

## Agent-Specific Instructions

Before editing, check for existing local changes and avoid overwriting user work. Prefer `rg` for searching. Follow the repository’s existing structure and keep changes scoped to the requested behavior.

For Codex sessions, keep the BTS stats current the same way prior Codex CLI work did: append `session_start`, each user `prompt`, and `session_end` JSONL entries with `"tool":"codex"` to `docs/dev-log.jsonl`, then run `npm run stats` so `public/stats.json` reflects the new prompt count and hours.
