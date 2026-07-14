# Asset Fixes — Chapters of Us

A focused punch list of asset regeneration work, separate from
`docs/ASSET_PROMPTS.md` (original prompts) and `docs/ASSET_PROMPTS_HD.md`
(resolution upgrade). Give this file to Codex directly.

## 1. Fix: locked vs. unlocked portal art (highest priority)

**Problem:** `assets/images/ui/portal-locked.png` and
`assets/images/ui/portal-unlocked.png` currently render as the *same*
glowing golden archway. In the hub, a locked chapter (not yet reachable)
and an unlocked one are visually indistinguishable — a player can't tell
what's available just by looking, which undermines the sense of
progression.

A code-side fix is already in place as a stopgap (the locked portal is
tinted dark and dimmed with a 🔒 glyph on top, regardless of the art), but
proper distinct art would look much better.

**What to generate** — regenerate `portal-locked.png` only, keeping
`portal-unlocked.png` as-is:

> Detailed modern pixel art, 32-bit RPG style like Eastward or Sea of Stars,
> rich color palette, soft dramatic lighting, clean readable silhouette, no
> text or watermarks, transparent background, high resolution, sharp fine
> detail, no visible pixelation or blur, suitable for large-screen display.
> A small stone archway portal, **closed and locked** — no light or magic
> glow coming through the doorway, just cool shadow and dim stone, a rusted
> chain or wooden boards across the opening, overgrown with dead ivy
> instead of the healthy green ivy on the unlocked version, muted
> desaturated colors, clearly reads as "not yet open" next to a warm
> glowing counterpart. Output at least 384×512px, transparent background.

Save as `assets/images/ui/portal-locked.png` (same filename, overwrite).

## 2. No longer needed: prop icons as in-scene overlays

**Context:** Early builds rendered each memory's prop (`prop-cake`,
`prop-clock-tower`, `prop-wall-calendar-tuesday`, `prop-notebook`,
`prop-phone-call`, `prop-letter-bench`, etc.) as a small floating icon
sprite directly on top of the background art. Once backgrounds became
full painted scenes that already depict those exact objects (a cake, a
calendar, a bench...), the floating icon created a jarring duplicate —
like a sticker pasted on a painting.

**This has been fixed in code**, not art: `src/scenes/MemoryScene.ts` no
longer renders the prop image sprites at all. Interactable points are now
marked with a small ambient sparkle (`src/systems/InteractionMarker.ts`)
instead of a literal picture of the object.

**Action needed: none for the game itself.** The existing 16 prop PNGs and
3 UI PNGs are **not wasted** — they're now shown in the new in-game Asset
Gallery (Behind the Scenes room → `[ GALLERY ]` marker), which pages
through every image/audio asset for review. Keep them as-is; no
regeneration required for this fix. Just know that if you regenerate any
prop image going forward, it no longer needs to precisely match the
background's existing depiction of that object (pixel alignment, exact
angle, etc.) — it's a standalone gallery thumbnail now, not an overlay.

## 3. Optional: dedicated title screen art

**Context:** The main menu previously had no background at all (solid
black). It now reuses `garden-bg` (the finale garden art) dimmed behind
the title text, which looks good and required no new asset.

**Optional upgrade:** if you want a bespoke title screen instead of the
reused garden art, generate a new key-art image and let me know — I'll
wire in a dedicated `title-bg` manifest key so it drops in the same way
everything else does. Not blocking; the current reused background is a
solid look on its own.

## 4. Text content changed — no art impact

All in-game copy (title, chapter titles/subtitles, narration, the closing
letter) was rewritten in this pass for wording reasons unrelated to art.
The *meaning*, *setting*, *mood*, and *emotional content* of every scene
is unchanged, so **no background, character, or prop descriptions need to
change** — everything in `docs/ASSET_PROMPTS.md` and
`docs/ASSET_PROMPTS_HD.md` still describes the same visuals correctly.

## 5. Audio — still pending (unrelated to this pass)

No audio has been added yet. See `docs/AUDIO_SOURCES.md` for sourcing —
unaffected by anything in this document.
