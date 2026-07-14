# Audio Sources — Chapters of Us

All sources below are free for personal/non-commercial use. Save files to
the paths listed so the [asset manifest](../src/data/assetManifest.ts) picks
them up automatically (no code changes needed) — the game already falls
back gracefully to silence if a file is missing.

## Where to look

| Source | Best for | License notes |
|---|---|---|
| [incompetech.com](https://incompetech.com/music/royalty-free/) (Kevin MacLeod) | Ambient/emotional background music | CC-BY — credit "Kevin MacLeod (incompetech.com)" somewhere (e.g. the BTS scene or a credits note) |
| [Pixabay Music](https://pixabay.com/music/) | Warm acoustic/piano loops, no attribution required | Pixabay License — free, no attribution needed |
| [Kenney.nl — Game Assets](https://kenney.nl/assets?q=audio) | UI sounds, footsteps, interface "blips" | CC0 — fully free, no attribution needed. Also has matching UI sprite packs if you want ready-made portal/button art instead of generating it |
| [Freesound.org](https://freesound.org/) | One-off SFX (page turns, chimes) | Check each sound's license (mostly CC0 or CC-BY) |
| [FreePD.com](https://freepd.com/) | Public-domain backup music | Public domain — no restrictions |

## Recommended picks per scene

| Key | File | Mood to search for |
|---|---|---|
| `music-hub` | `assets/audio/music/hub.mp3` | Gentle, wistful, walking/exploration music — search "peaceful reflection" or "memory lane" on Pixabay Music |
| `music-memory-1` | `assets/audio/music/memory-1.mp3` | Warm, quiet, daytime — "gentle afternoon" |
| `music-memory-2` | `assets/audio/music/memory-2.mp3` | Soft, tender, caring — "soft piano comfort" |
| `music-memory-3` | `assets/audio/music/memory-3.mp3` | Intimate, dusk, conversational — "heartfelt acoustic" |
| `music-memory-4` | `assets/audio/music/memory-4.mp3` | Light, nostalgic — "music box" or "nostalgic memories" |
| `music-memory-5` | `assets/audio/music/memory-5.mp3` | Sparkling, celebratory but tender — "birthday magic" (avoid generic party/EDM — keep it soft) |
| `music-memory-6` | `assets/audio/music/memory-6.mp3` | Warm, golden, unhurried — "golden hour" |
| `music-memory-7` | `assets/audio/music/memory-7.mp3` | Cozy, present, warm — "cozy evening" |
| `music-letter` | `assets/audio/music/letter.mp3` | Emotional swell, piano/strings — "emotional piano" or "heartfelt finale" |
| `music-bts` | `assets/audio/music/bts.mp3` | Playful, quirky, light — "quirky ukulele" or "playful comedy" |
| `sfx-interact` | `assets/audio/sfx/interact.mp3` | Short UI "blip"/confirm — Kenney's "Interface Sounds" pack |
| `sfx-footstep` | `assets/audio/sfx/footstep.mp3` | Soft grass/carpet footstep loop — Kenney or Freesound "footstep soft" |
| `sfx-page-turn` | `assets/audio/sfx/page-turn.mp3` | Paper page turn — Freesound "paper page turn" |
| `sfx-portal` | `assets/audio/sfx/portal.mp3` | Gentle chime/shimmer — Kenney "Interface Sounds" (magic/notification chime) |

## Quick start

1. Grab Kenney's **"Interface Sounds"** and **"RPG Audio"** packs (CC0,
   zero attribution needed) for all four SFX in one download:
   https://kenney.nl/assets/interface-sounds and
   https://kenney.nl/assets/rpg-audio
2. Grab 10 ambient/piano tracks from Pixabay Music (no attribution needed)
   matching the moods above for the 10 music keys.
3. Drop everything into `src/assets/audio/music/` and
   `src/assets/audio/sfx/` using the exact filenames in the table — the game
   picks them up automatically on next reload.
