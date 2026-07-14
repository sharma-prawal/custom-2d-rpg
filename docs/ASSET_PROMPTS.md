# Asset Prompts — Chapters of Us

Every prompt below targets **detailed modern pixel art** (Eastward / Sea of
Stars / Chrono Trigger-tier — rich detail, dramatic directional lighting,
readable silhouettes, NOT flat 8-bit). Ask for a **transparent background**
on anything that isn't a full-frame background image.

You do not need to hit exact pixel dimensions — the game auto-scales every
image to its on-screen size (see [`src/systems/ImageFit.ts`](../src/systems/ImageFit.ts)),
so generate at whatever resolution ChatGPT gives you and drop it straight in.

## Consistency technique (read this first)

ChatGPT image generation does **not** guarantee the same character across
separate prompts. To keep "her" and "him" recognizable across all 9 outfit
variants each:

1. Generate the **Character Model Sheet** prompt below first for each
   character. This becomes your reference image.
2. For every subsequent outfit variant, **upload that reference image back
   into the chat** and ask ChatGPT to redraw the same character in the new
   outfit/pose, explicitly saying "keep the same face, hair, and proportions
   as the attached reference." Edit-in-place (image editing within the same
   conversation thread) is far more consistent than a fresh prompt in a new
   chat.
3. Keep a running conversation per character (one long ChatGPT thread for
   "her," one for "him") rather than starting over each time.

## Global style prefix

Prepend this to every prompt:

> Detailed modern pixel art, 32-bit RPG style like Eastward or Sea of Stars,
> rich color palette, soft dramatic lighting, clean readable silhouette,
> no text or watermarks, transparent background (unless a full scene
> background is requested).

---

## Characters

Both characters wear a small matching **"PS" monogram patch** — a subtle
embroidered emblem (collar pin, cufflink, or chest patch) — visible in every
outfit. It should read as a couple's shared emblem, not a corporate logo.

### Character Model Sheet — Her (generate first, use as reference)

> [global style prefix] Character reference sheet of a young woman, front
> view, 3/4 view, and back view, neutral standing pose, warm brown eyes,
> shoulder-length dark hair, soft friendly expression. Wearing simple office
> formals (blazer, fitted trousers). A small embroidered "PS" monogram patch
> on the blazer's left chest pocket. Full body, clean silhouette, T-pose
> reference sheet layout on a plain light background.

### Character Model Sheet — Him (generate first, use as reference)

> [global style prefix] Character reference sheet of a young man, front
> view, 3/4 view, and back view, neutral standing pose, short dark hair,
> warm calm expression. Wearing simple office formals (shirt, trousers). A
> small embroidered "PS" monogram patch on the shirt's left cuff. Full body,
> clean silhouette, T-pose reference sheet layout on a plain light
> background.

### Outfit variants (repeat for both "her" and "him", using the reference image each time)

For each row, the prompt pattern is:

> [global style prefix] Using the attached reference image, redraw the same
> character — same face, hair, and proportions — in a relaxed standing/idle
> pose, three-quarter view, wearing: **{outfit description}**. Keep the "PS"
> monogram patch visible on the outfit. Transparent background.

| Outfit key | Used in | Outfit description |
|---|---|---|
| `office-formals` | Memory I, II | Same office formals as the reference sheet |
| `casual-comfortable` | Memory II | Soft cardigan/sweater over a simple top, relaxed trousers |
| `casual-light-jacket` | Memory III | Light autumn jacket over a casual top, scarf, jeans |
| `home-casual` | Memory IV | Cozy homewear — oversized hoodie or soft shirt, comfortable pants |
| `party-outfit` | Memory V | Festive birthday-party outfit, slightly dressed up, warm winter layer |
| `smart-casual` | Memory VI | Smart-casual office wear, blazer-less, rolled sleeves, relaxed collar |
| `cozy-date-night` | Memory VII | Comfortable evening homewear, soft cardigan, warm tones |
| `everyday` | Hub world | Simple everyday outfit — jeans/casual trousers and a plain top, walking pose |
| `warm-layered` | Finale garden | Warm layered spring outfit — light cardigan, soft scarf |

Save each as `her-{outfit-key}.png` / `him-{outfit-key}.png` into
`src/assets/images/characters/` (e.g. `her-office-formals.png`).

---

## Backgrounds (one full-scene image each, 16:9 aspect — e.g. 1536×864)

Each should be a **single full scene illustration**, no characters in it
(characters render separately on top).

| Key | File | Prompt |
|---|---|---|
| `bg-memory-1` | `assets/images/backgrounds/memory-1.png` | [prefix] A fifth-floor office terrace at golden-hour afternoon, early autumn, city skyline in the distance, potted plants along a railing, warm sunlight, empty of people, wide establishing shot |
| `bg-memory-2` | `assets/images/backgrounds/memory-2.png` | [prefix] A cozy small office break room, soft overcast daylight through a window, late autumn, a desk with a calendar and a small medicine bottle, warm muted tones |
| `bg-memory-3` | `assets/images/backgrounds/memory-3.png` | [prefix] A rooftop terrace at dusk, string lights overhead, a wooden bench, autumn evening sky in purple and orange, city lights beginning to twinkle below |
| `bg-memory-4` | `assets/images/backgrounds/memory-4.png` | [prefix] A cozy room filled with small treasured objects — a shirt on a hanger, shoes by the door, a pinboard covered in small handwritten notes, soft afternoon light, warm and intimate |
| `bg-memory-5` | `assets/images/backgrounds/memory-5.png` | [prefix] An outdoor birthday spot at midnight in winter, string lights, a table with a cake and candles, a distant clock tower glowing, deep blue night sky with stars |
| `bg-memory-6` | `assets/images/backgrounds/memory-6.png` | [prefix] A row of office desks lit by golden-hour light through blinds, late winter, a warm coffee cup on a desk, a wall calendar with Tuesday circled, quiet and warm |
| `bg-memory-7` | `assets/images/backgrounds/memory-7.png` | [prefix] A cozy home table in the evening, present day, warm lamp light, two phone screens glowing softly, a small gift box on the table, intimate and warm |
| `hub-bg` | `assets/images/backgrounds/hub.png` | [prefix] A seamless tileable path pattern — soft twilight garden path, cobblestones, small lanterns, designed to tile horizontally without visible seams |
| `bts-bg` | `assets/images/backgrounds/bts.png` | [prefix] A cozy backstage/workshop room, string lights, corkboard with sketches pinned up, playful and warm purple lighting, empty of people |
| `garden-bg` | `assets/images/backgrounds/garden.png` | [prefix] A quiet blooming garden at golden sunset, spring flowers, a wooden bench under a tree, warm pink-orange sky, peaceful and intimate, wide establishing shot |

Note: `hub-bg` specifically needs to **tile horizontally** — ask ChatGPT
explicitly for "a seamless repeating tileable pattern" and check the left
and right edges line up before using it.

---

## Props (small icon-style objects, transparent background, square-ish crop)

Prompt pattern: `[global style prefix] A small pixel-art icon of {object}, isolated, transparent background, slight glow or highlight, game prop icon style.`

| Key | Object | Memory |
|---|---|---|
| `prop-terrace-railing` | An office terrace railing with a potted plant | I |
| `prop-office-clock` | A round office wall clock showing lunchtime | I |
| `prop-desk-medicine` | A small medicine bottle and glass of water on a desk | II |
| `prop-calendar` | A desk calendar with days crossed off | II |
| `prop-bench` | A wooden rooftop bench | III |
| `prop-string-lights` | A string of warm fairy lights | III |
| `prop-shirt-hanger` | A shirt on a wooden hanger | IV |
| `prop-pinboard` | A corkboard pinned with small handwritten notes | IV |
| `prop-cake` | A birthday cake with lit candles | V |
| `prop-clock-tower` | A distant glowing clock tower at midnight | V |
| `prop-desk-coffee` | A warm cup of coffee on a desk | VI |
| `prop-wall-calendar-tuesday` | A wall calendar with "Tuesday" circled in red | VI |
| `prop-petha-box` | A traditional Indian sweet box (Petha), tied with string | VII |
| `prop-phone-call` | A smartphone mid-video-call, glowing screen | VII |
| `prop-notebook` | A half-finished handmade gift / open notebook with a sketch | VII |
| `prop-letter-bench` | A garden bench with a sealed handwritten letter resting on it | Finale |

Save as `assets/images/props/{key}.png` (e.g. `assets/images/props/prop-cake.png`).

---

## UI elements (optional — Kenney's free packs cover these well, see AUDIO_SOURCES.md sibling doc for the UI pack link)

| Key | Prompt |
|---|---|
| `portal-locked` | [prefix] A small dim stone archway portal icon, closed/locked, muted colors, game UI icon |
| `portal-unlocked` | [prefix] A small glowing warm archway portal icon, open/unlocked, inviting light, game UI icon |
| `bts-door` | [prefix] A small whimsical purple door icon with a "?" carved into it, playful, game UI icon |
| `final-letter-portal` | [prefix] An ornate golden garden archway wrapped in blooming roses and soft climbing vines, warm light spilling through like a doorway to somewhere precious, a small sealed wax-stamped envelope motif subtly carved into the stonework at the top, delicate filigree detailing, romantic and reverent — noticeably more elaborate and premium than a standard memory portal, since this is the finale destination, game UI icon |

Save as `assets/images/ui/final-letter-portal.png` — this replaces the reused
`portal-unlocked` icon that the finale previously borrowed from the seven
numbered memory portals, so it reads as its own distinct, climactic doorway
rather than "just another portal."

---

## Post-processing tips

- If an image comes back busier than expected, ask ChatGPT to "simplify and
  increase pixel size for a cleaner retro-modern look."
- For characters, always double check the "PS" patch is legible at small
  size — if it's too detailed, ask for "a simpler, bolder monogram."
- PNG with transparency only where noted (props, characters, UI). Full-scene
  backgrounds should be opaque.
