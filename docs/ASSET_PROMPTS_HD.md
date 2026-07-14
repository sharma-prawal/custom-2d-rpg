# HD Asset Regeneration — Chapters of Us

## Why this doc exists

The game looked like a blurry mess because it was rendering internally at a
tiny 320×180 canvas and then upscaling ~4-6x to fill the screen with
nearest-neighbor ("pixel art") filtering — that pipeline mismatch, not the
art itself, was most of the blur. **That's already fixed**: the game now
renders at a real 1280×720 HD canvas with smooth filtering
(`src/main.ts`), and every sprite/background auto-scales to fit regardless
of its source resolution (`src/systems/ImageFit.ts`).

What's left is making sure the *source* images have enough native
resolution to stay sharp at that bigger canvas size (and sharper still if
someone plays in a maximized browser window, since the whole canvas scales
up to fill it). This doc replaces `docs/ASSET_PROMPTS.md` for
**resolution** guidance only — the style direction, character consistency
technique, and per-memory content are unchanged; re-read that file for the
"what" (which memory, which outfit, which prop). This file is just the
"how big."

## Global style prefix (unchanged)

> Detailed modern pixel art, 32-bit RPG style like Eastward or Sea of
> Stars, rich color palette, soft dramatic lighting, clean readable
> silhouette, no text or watermarks, transparent background (unless a full
> scene background is requested).

Add explicitly to every prompt now: **"high resolution, sharp fine detail,
no visible pixelation or blur, suitable for large-screen display."**

## Target resolutions (regenerate at these sizes)

| Asset type | Old ask | New target | Why |
|---|---|---|---|
| Backgrounds (full scene) | 1536×864 | **1920×1080** (16:9) | Canvas is 1280×720; a maximized/large browser window scales the whole game up, so headroom above native canvas size keeps edges crisp. Most of your existing backgrounds (~2.3MB files) are likely already close to this — check before regenerating. |
| Characters (each outfit) | unspecified | **800×1200** (2:3 portrait), transparent bg | Displayed at 112px tall in-game but that's just the *display* size — source needs real resolution or it goes soft the moment it's scaled up. This is the category most likely to look soft right now (existing character files are only ~90-100KB, suggesting fairly low native resolution). |
| Props (icons) | unspecified | **512×512**, transparent bg | Displayed at 64px tall; same logic as characters. |
| UI (portals, BTS door) | unspecified | **384×512**, transparent bg | Displayed at 96-128px tall. |
| Hub background (tileable) | unspecified | **960×1080** tile, seamless horizontal repeat | Tile height is scaled to fill 720px canvas height; extra native resolution avoids softness. |

## Priority order

1. **Characters first** — all 18 outfit images (9 per character), since
   these are both the smallest source files today and the ones players
   look at most closely.
2. **Two files to specifically re-check/regenerate**: `her-cozy-date-night.png`
   and `him-cozy-date-night.png` are byte-identical in size to
   `her-outfits-sheet.png` / `him-outfits-sheet.png` — likely the reference
   sheet got saved under the wrong filename instead of a real
   cozy-date-night outfit render. Regenerate these two properly.
3. **Props** — 16 icons, quick batch.
4. **Backgrounds** — only regenerate ones that look soft up close in-game;
   many may already be sufficient at ~1536×864.
5. **UI** (portal-locked/unlocked, bts-door) — smallest category, do last.

## Regeneration prompt pattern

Reuse the consistency technique from `docs/ASSET_PROMPTS.md` (character
model sheet as a reference image, redraw in each outfit keeping the same
face/proportions). Just raise the requested output size:

> [global style prefix + "high resolution, sharp fine detail, no visible
> pixelation or blur, suitable for large-screen display"] Using the
> attached reference image, redraw the same character — same face, hair,
> and proportions — in a relaxed standing/idle pose, three-quarter view,
> wearing: **{outfit description}**. Keep the "PS" monogram patch visible.
> Transparent background. Output at least 800×1200px.

For backgrounds:

> [global style prefix + sharpness clause] {existing per-memory background
> description from docs/ASSET_PROMPTS.md}. Output at least 1920×1080px,
> full-frame illustration, no characters.

For props/UI:

> [global style prefix + sharpness clause] A pixel-art icon of {object},
> isolated, transparent background, slight glow or highlight, game prop
> icon style. Output at least 512×512px.

## After regenerating

Drop files in at the same paths/filenames listed in
`docs/ASSET_PROMPTS.md` — no code changes needed, the game picks them up
automatically on next reload (see `src/data/assetManifest.ts`).
