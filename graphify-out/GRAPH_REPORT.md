# Graph Report - .  (2026-07-10)

## Corpus Check
- 38 files · ~34,023 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 354 nodes · 937 edges · 13 communities (9 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Core Game Data & Types
- Minigame Scene Logic
- Asset Manifest & Preloading
- Hub World & NPC
- Player & BTS Scene
- Asset Documentation & Prompts
- Journal & Minigame UI
- Minigame Data Types
- Memory Scene Rendering
- Asset Viewer System
- Dev Log & Stats Pipeline
- Boot Scene

## God Nodes (most connected - your core abstractions)
1. `MiniGameScene` - 52 edges
2. `AudioManager` - 48 edges
3. `setActiveMemoryTheme()` - 29 edges
4. `addSoftPanel()` - 24 edges
5. `JournalScene` - 22 edges
6. `addCinematicVignette()` - 18 edges
7. `addSceneGrain()` - 18 edges
8. `AssetViewer` - 17 edges
9. `MemoryScene` - 16 edges
10. `BTSScene` - 15 edges

## Surprising Connections (you probably didn't know these)
- `HD Asset Regeneration — Chapters of Us` --references--> `Memory Background Images`  [INFERRED]
  docs/ASSET_PROMPTS_HD.md → docs/ASSET_PROMPTS.md
- `HD Asset Regeneration — Chapters of Us` --references--> `Prop Icon Assets`  [INFERRED]
  docs/ASSET_PROMPTS_HD.md → docs/ASSET_PROMPTS.md
- `MemoryScene` --references--> `MemoryData`  [EXTRACTED]
  src/scenes/MemoryScene.ts → src/data/memories.ts
- `setActiveMemoryTheme()` --calls--> `getMemoryTheme()`  [EXTRACTED]
  src/systems/VisualTheme.ts → src/data/memoryThemes.ts
- `MiniGameScene` --references--> `MiniGameConfig`  [EXTRACTED]
  src/scenes/MiniGameScene.ts → src/data/miniGames.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Asset Pipeline Documentation Cluster** — docs_asset_fixes_asset_fixes, docs_asset_prompts_asset_prompts, docs_asset_prompts_hd_asset_prompts_hd, docs_audio_sources_audio_sources [INFERRED 0.85]
- **Dev Log Data Pipeline** — docs_dev_log_dev_log_jsonl, docs_dev_log_aggregate_stats_script, docs_dev_log_stats_json, docs_dev_log_stats_terminal [EXTRACTED 1.00]
- **Character Asset Generation Workflow** — docs_asset_prompts_character_model_sheet_her, docs_asset_prompts_character_model_sheet_him, docs_asset_prompts_outfit_variants, docs_asset_prompts_character_consistency_technique [EXTRACTED 1.00]

## Communities (13 total, 4 thin omitted)

### Community 0 - "Core Game Data & Types"
Cohesion: 0.06
Nodes (47): BTS_NOTES, BtsNote, LETTER, DEFAULT_MEMORY_THEME, getMemoryTheme(), MEMORY_THEMES, MemoryTheme, getMiniGameByMemory() (+39 more)

### Community 1 - "Minigame Scene Logic"
Cohesion: 0.14
Nodes (4): MiniGameScene, AudioManager, addSoftPanel(), setActiveMemoryTheme()

### Community 2 - "Asset Manifest & Preloading"
Cohesion: 0.10
Nodes (30): ALL_AUDIO, ALL_IMAGES, AudioAsset, BACKGROUND_IMAGES, CHARACTER_IMAGES, ImageAsset, MUSIC_TRACKS, outfits (+22 more)

### Community 3 - "Hub World & NPC"
Cohesion: 0.10
Nodes (19): NPC, BTS, CHAPTER_SIGNALS, FINALE, HubScene, HubStartData, PORTAL_POSITIONS, addChapterPlaque() (+11 more)

### Community 4 - "Player & BTS Scene"
Cohesion: 0.11
Nodes (4): Player, BTSScene, LetterScene, InteractionPrompt

### Community 5 - "Asset Documentation & Prompts"
Cohesion: 0.11
Nodes (26): Asset Fixes — Chapters of Us, Asset Gallery (BTS Room), InteractionMarker System, Portal Locked Art Fix, Prop Icon Removal Rationale, Optional Title Screen Art, Asset Prompts — Chapters of Us, Memory Background Images (+18 more)

### Community 7 - "Minigame Data Types"
Cohesion: 0.10
Nodes (19): AlbumFragment, BaseMiniGameConfig, byIndex, ConversationPuzzleConfig, ConversationPuzzleWord, CrosswordEntry, DialogueCard, DifferenceSpot (+11 more)

### Community 10 - "Dev Log & Stats Pipeline"
Cohesion: 0.48
Nodes (7): npm run stats / aggregate-stats.ts, Claude Code Hooks (SessionStart/Stop/UserPromptSubmit), dev-log.jsonl, Dev Log — Chapters of Us, Dev Log JSONL Session Format, public/stats.json, Stats Terminal (BTS Room)

## Knowledge Gaps
- **60 isolated node(s):** `ImageAsset`, `AudioAsset`, `outfits`, `propKeys`, `BtsNote` (+55 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AudioManager` connect `Minigame Scene Logic` to `Core Game Data & Types`, `Asset Manifest & Preloading`, `Hub World & NPC`, `Player & BTS Scene`, `Journal & Minigame UI`, `Memory Scene Rendering`, `Asset Viewer System`?**
  _High betweenness centrality (0.150) - this node is a cross-community bridge._
- **Why does `MiniGameScene` connect `Minigame Scene Logic` to `Core Game Data & Types`, `Journal & Minigame UI`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Why does `setActiveMemoryTheme()` connect `Minigame Scene Logic` to `Core Game Data & Types`, `Journal & Minigame UI`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **What connects `ImageAsset`, `AudioAsset`, `outfits` to the rest of the system?**
  _64 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Core Game Data & Types` be split into smaller, more focused modules?**
  _Cohesion score 0.06167527251864601 - nodes in this community are weakly interconnected._
- **Should `Minigame Scene Logic` be split into smaller, more focused modules?**
  _Cohesion score 0.14296081277213352 - nodes in this community are weakly interconnected._
- **Should `Asset Manifest & Preloading` be split into smaller, more focused modules?**
  _Cohesion score 0.10128205128205128 - nodes in this community are weakly interconnected._