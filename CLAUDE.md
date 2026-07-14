# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Chapters of Us" — a personalized 2D walking-RPG built with Phaser 3 + TypeScript + Vite. The player walks a hub world, enters 7 data-driven memory scenes, visits a BTS/stats room, and ends at a letter in a garden. It ships with placeholder art/audio by design — see `docs/ASSET_PROMPTS.md` and `docs/AUDIO_SOURCES.md` for how real assets get generated/sourced and dropped in.

## Commands

- `npm run dev` — start the Vite dev server (localhost:5173)
- `npm run build` — typecheck (`tsc -b`, src only) then production build to `dist/`
- `npm run preview` — serve the production build locally
- `npm run stats` — run `scripts/aggregate-stats.ts`, regenerating `public/stats.json` from `docs/dev-log.jsonl` (powers the in-game Stats Terminal)
- `npx tsc -b --noEmit` — typecheck `src/` only (uses `tsconfig.json`)
- `npx tsc -p tsconfig.scripts.json --noEmit` — typecheck `scripts/` only

There is no test suite or linter configured in this project.

Two separate tsconfigs exist on purpose: `tsconfig.json` covers `src/` (DOM libs, used by `npm run build`), and `tsconfig.scripts.json` covers `scripts/` (Node libs/types). They're split because `scripts/aggregate-stats.ts` needs `node:fs`/`node:path` and mixing Node + DOM lib types in one config causes conflicts.

## Architecture

### Scene flow

`Boot` → `Preload` → `MainMenu` → `Hub` ⇄ `Memory` (×7, data-driven) / `BTS` / `Letter`. All scenes are registered in `src/main.ts`. `HubScene` is a horizontally-scrolling world with a portal per memory plus a BTS door; walking within 14px of an unlocked portal's zone center (Arcade `Zone` overlap, checked by distance in `update()`) triggers the scene transition — there's no explicit "enter" key for hub portals.

### Memory data is the single source of truth

`src/data/memories.ts` exports `MEMORIES: MemoryData[]` — title, setting, time-of-day/season, outfits, ambient tint, intro/closing narration, and prop positions/narration for each of the 7 memories. `src/scenes/MemoryScene.ts` is **one reusable class**, not seven — it reads whichever memory via `scene.start('Memory', { memoryIndex })` and renders it entirely from data. To add or edit a memory, edit `memories.ts`; don't add scene code.

### Asset pipeline (placeholder-first)

`src/data/assetManifest.ts` derives every expected image/audio key+path *from* `memories.ts` (character outfits, prop keys, backgrounds, music). `PreloadScene` tries to load all of them for real; anything that 404s gets silently backfilled by `src/systems/PlaceholderArt.ts` with a generated placeholder texture (deterministic color from a hash of the key, so it's stable across reloads). This means:
- The game always runs, with zero real art.
- Dropping a real file into `src/assets/images/...` or `src/assets/audio/...` at the exact manifest path upgrades it automatically — no code changes, no key registration.

### Size normalization

Because real art (ChatGPT-generated) will arrive at arbitrary, non-placeholder resolutions, nothing relies on native texture pixel dimensions. `src/systems/ImageFit.ts` (`fitHeight`, `fitExact`, `fitTileHeight`) scales every sprite/background/tile to a fixed on-screen size regardless of source resolution. `Player`/`NPC` also derive their Arcade physics body size/offset as a *proportion* of the native frame rather than absolute pixels, so collision boxes stay correct at any art resolution. When adding new visual elements, use `ImageFit` rather than raw `setDisplaySize`/native sizing.

### Save state & progression

`src/systems/SaveState.ts` wraps `localStorage` (key `chapters-of-us-save-v1`): `visitedMemories`, `reachedLetter`, `unlockedBts`. `HubScene` calls `SaveState.isUnlocked(index)` (memory N unlocks once N-1 is visited) and only adds unlocked portals to the overlap-check list — locked portals are visible but not enterable. The finale/letter portal only appears once all 7 are visited.

### Dialogue & input

`src/systems/DialogueBox.ts` is a bottom-anchored typewriter dialogue box shared by memory/BTS scenes; `LetterScene` has its own larger full-screen variant inline (different enough visual context that it isn't factored out). Interact input (`E` or `Space`) is polled each frame via `Phaser.Input.Keyboard.JustDown()`. Note for automated/synthetic testing: `JustDown` needs a real frame gap between a dispatched `keydown` and `keyup` — firing both synchronously in the same tick won't register.

### Dev-log / stats terminal

`.claude/settings.json` has `SessionStart`/`UserPromptSubmit`/`Stop` hooks that auto-append JSON lines to `docs/dev-log.jsonl` (format documented in `docs/DEV_LOG.md`; also describes the manual convention for other AI tools like Codex/Antigravity). `npm run stats` aggregates that log into `public/stats.json`; `BTSScene` fetches it at runtime to render the in-game "Stats Terminal" prop. `scripts/aggregate-stats.ts` treats `session_end` entries as "latest end before the next session_start" rather than pairing greedily, because the `Stop` hook fires at the end of every turn, not just when a session truly ends.

### Debug handle

In dev mode (`import.meta.env.DEV`), `src/main.ts` exposes the live `Phaser.Game` instance as `window.game` for console/automated inspection (e.g. `window.game.scene.getScene('Hub')`).
