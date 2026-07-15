import { MEMORIES } from './memories';

export interface ImageAsset {
  key: string;
  path: string;
}

export interface AudioAsset {
  key: string;
  path: string;
}

const outfits = new Set<string>();
MEMORIES.forEach((m) => {
  outfits.add(m.herOutfit);
  outfits.add(m.hisOutfit);
});
outfits.add('everyday'); // hub default
outfits.add('warm-layered'); // finale garden

const propKeys = new Set<string>();
MEMORIES.forEach((m) => m.props.forEach((p) => propKeys.add(p.key)));
propKeys.add('prop-letter-bench');

export const CHARACTER_IMAGES: ImageAsset[] = [];
outfits.forEach((outfit) => {
  CHARACTER_IMAGES.push({ key: `char-her-${outfit}`, path: `assets/images/characters/her-${outfit}.png` });
  CHARACTER_IMAGES.push({ key: `char-him-${outfit}`, path: `assets/images/characters/him-${outfit}.png` });
});

export const PROP_IMAGES: ImageAsset[] = Array.from(propKeys).map((key) => ({
  key,
  path: `assets/images/props/${key}.png`,
}));

export const BACKGROUND_IMAGES: ImageAsset[] = [
  { key: 'hub-bg', path: 'assets/images/backgrounds/hub.png' },
  { key: 'bts-bg', path: 'assets/images/backgrounds/bts.png' },
  { key: 'garden-bg', path: 'assets/images/backgrounds/garden.png' },
  ...MEMORIES.map((m) => ({ key: m.backgroundKey, path: `assets/images/backgrounds/${m.id}.png` })),
  { key: 'bg-memory-4-changed', path: 'assets/images/backgrounds/memory-4-changed-v2.png' },
  { key: 'bg-memory-5-album', path: 'assets/images/backgrounds/memory-5-album.jpg' },
  { key: 'bg-memory-5-support-1', path: 'assets/images/backgrounds/memory-5-support-1.jpg' },
  { key: 'bg-memory-5-support-2', path: 'assets/images/backgrounds/memory-5-support-2.jpg' },
  { key: 'bg-memory-5-support-3', path: 'assets/images/backgrounds/memory-5-support-3.jpg' },
];

// Real per-chapter journal photos (one per memory) — HD personal photos, not
// AI-generated art, dropped in to replace the `{{MEMORY_N_PHOTO}}` template
// placeholders that used to leave every chapter's journal page photo-less.
export const JOURNAL_IMAGES: ImageAsset[] = MEMORIES.map((m) => ({
  key: `journal-${m.id}`,
  path: `assets/images/backgrounds/journal-${m.id}.jpg`,
}));

export const UI_IMAGES: ImageAsset[] = [
  { key: 'portal-locked', path: 'assets/images/ui/portal-locked.png' },
  { key: 'portal-unlocked', path: 'assets/images/ui/portal-unlocked.png' },
  { key: 'bts-door', path: 'assets/images/ui/bts-door.png' },
  { key: 'hub-plaque-01', path: 'assets/images/ui/hub-plaque-01.png' },
  { key: 'hub-plaque-02', path: 'assets/images/ui/hub-plaque-02.png' },
  { key: 'hub-plaque-03', path: 'assets/images/ui/hub-plaque-03.png' },
  { key: 'hub-plaque-04', path: 'assets/images/ui/hub-plaque-04.png' },
  { key: 'hub-plaque-05', path: 'assets/images/ui/hub-plaque-05.png' },
  { key: 'hub-plaque-06', path: 'assets/images/ui/hub-plaque-06.png' },
  { key: 'hub-plaque-07', path: 'assets/images/ui/hub-plaque-07.png' },
  { key: 'hub-sign-wide', path: 'assets/images/ui/hub-sign-wide.png' },
  { key: 'vault-plaque', path: 'assets/images/ui/vault-plaque.png' },
  { key: 'audio-hud-plaque', path: 'assets/images/ui/audio-hud-plaque.png' },
  { key: 'settings-cog', path: 'assets/images/ui/settings-cog.png' },
  { key: 'photo-album-bg', path: 'assets/images/ui/photo-album-bg.png' },
  { key: 'final-letter-paper', path: 'assets/images/ui/final-letter-paper.png' },
  { key: 'final-letter-portal', path: 'assets/images/ui/final-letter-portal.png' },
];

export const ALL_IMAGES: ImageAsset[] = [
  ...CHARACTER_IMAGES,
  ...PROP_IMAGES,
  ...BACKGROUND_IMAGES,
  ...JOURNAL_IMAGES,
  ...UI_IMAGES,
];

export const MUSIC_TRACKS: AudioAsset[] = [
  { key: 'music-hub', path: 'assets/audio/music/hub.mp3' },
  { key: 'music-bts', path: 'assets/audio/music/bts.mp3' },
  { key: 'music-letter', path: 'assets/audio/music/letter.mp3' },
  ...MEMORIES.map((m) => ({ key: m.musicKey, path: `assets/audio/music/${m.id}.mp3` })),
];

export const SFX_TRACKS: AudioAsset[] = [
  { key: 'sfx-interact', path: 'assets/audio/sfx/interact.mp3' },
  { key: 'sfx-footstep', path: 'assets/audio/sfx/footstep.mp3' },
  { key: 'sfx-page-turn', path: 'assets/audio/sfx/page-turn.mp3' },
  { key: 'sfx-portal', path: 'assets/audio/sfx/portal.mp3' },
  { key: 'sfx-paper-rustle', path: 'assets/audio/sfx/paper-rustle.mp3' },
  { key: 'sfx-fountain-pen', path: 'assets/audio/sfx/fountain-pen.mp3' },
  { key: 'sfx-sparkle', path: 'assets/audio/sfx/sparkle.mp3' },
];

export const ALL_AUDIO: AudioAsset[] = [...MUSIC_TRACKS, ...SFX_TRACKS];
