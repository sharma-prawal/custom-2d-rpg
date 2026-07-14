export interface MemoryTheme {
  primary: number;
  secondary: number;
  accent: number;
  glow: number;
  textPrimary: string;
  textSecondary: string;
  button: number;
  buttonHover: number;
  border: number;
  shadow: number;
  particleColor: number;
  tooltipBackground: number;
  panelBackground: number;
  progressColor: number;
  highlightColor: number;
  crosswordTile: number;
  journalAccent: number;
  memoryGlow: number;
}

export const DEFAULT_MEMORY_THEME: MemoryTheme = {
  primary: 0xffd9a0,
  secondary: 0xd8b98d,
  accent: 0xffd27d,
  glow: 0xffe4a8,
  textPrimary: '#f5ecd8',
  textSecondary: '#d9d0bf',
  button: 0x2b1c16,
  buttonHover: 0x3a251d,
  border: 0xffd9a0,
  shadow: 0x090911,
  particleColor: 0xffe5b5,
  tooltipBackground: 0xf3dfbd,
  panelBackground: 0x090911,
  progressColor: 0xffd27d,
  highlightColor: 0xfff3d8,
  crosswordTile: 0xf3dfbd,
  journalAccent: 0xb77b48,
  memoryGlow: 0xffd27d,
};

export const MEMORY_THEMES: Record<number, MemoryTheme> = {
  1: {
    ...DEFAULT_MEMORY_THEME,
    primary: 0xffb66e,
    secondary: 0xd88a68,
    accent: 0xffc078,
    glow: 0xffdd9a,
    particleColor: 0xffc878,
    journalAccent: 0xc67845,
    memoryGlow: 0xffa85f,
  },
  2: {
    ...DEFAULT_MEMORY_THEME,
    primary: 0xc7b982,
    secondary: 0x8e9368,
    accent: 0xd0ad6b,
    glow: 0xe6d6a2,
    button: 0x24251b,
    buttonHover: 0x343723,
    border: 0xbda667,
    particleColor: 0xd9c989,
    progressColor: 0xcba85f,
    highlightColor: 0xe9d9aa,
    crosswordTile: 0xe7d8b8,
    journalAccent: 0x7e844f,
    memoryGlow: 0xd6bf77,
  },
  3: {
    ...DEFAULT_MEMORY_THEME,
    primary: 0x9fb6ff,
    secondary: 0x5c6fa5,
    accent: 0xd8b86a,
    glow: 0x86a8ff,
    button: 0x10172e,
    buttonHover: 0x172249,
    border: 0xd8b86a,
    particleColor: 0x9fb6ff,
    progressColor: 0xd8b86a,
    highlightColor: 0xc8d5ff,
    crosswordTile: 0xd9def0,
    journalAccent: 0x27396f,
    memoryGlow: 0x83a6ff,
  },
  4: {
    ...DEFAULT_MEMORY_THEME,
    primary: 0xf2b6b8,
    secondary: 0xe0c4aa,
    accent: 0xe8a0a8,
    glow: 0xffd7c9,
    particleColor: 0xffc7c7,
    progressColor: 0xe8a0a8,
    highlightColor: 0xffe1d6,
    crosswordTile: 0xf4dfd2,
    journalAccent: 0xd9899a,
    memoryGlow: 0xf0a8ae,
  },
  5: {
    ...DEFAULT_MEMORY_THEME,
    primary: 0xaec5d6,
    secondary: 0x7f93a5,
    accent: 0xb8c7d7,
    glow: 0xd8e3ec,
    button: 0x18222d,
    buttonHover: 0x223142,
    border: 0xa9b8c7,
    particleColor: 0xc8d4de,
    progressColor: 0xb8c7d7,
    highlightColor: 0xe0e7ed,
    crosswordTile: 0xd7d9d4,
    journalAccent: 0x6f8294,
    memoryGlow: 0xb8c7d7,
  },
  6: {
    ...DEFAULT_MEMORY_THEME,
    primary: 0xd89a62,
    secondary: 0x9e6a42,
    accent: 0xc77b43,
    glow: 0xf0c28a,
    border: 0xc8915a,
    particleColor: 0xe8b26f,
    progressColor: 0xc77b43,
    highlightColor: 0xf0d0a0,
    crosswordTile: 0xe5c7a0,
    journalAccent: 0xaa6538,
    memoryGlow: 0xd88a4c,
  },
  7: {
    ...DEFAULT_MEMORY_THEME,
    primary: 0xb8c4ff,
    secondary: 0x314585,
    accent: 0xe4c66f,
    glow: 0xd5ddff,
    button: 0x111832,
    buttonHover: 0x1d2954,
    border: 0xe4c66f,
    particleColor: 0xd5ddff,
    progressColor: 0xe4c66f,
    highlightColor: 0xf1e2a8,
    crosswordTile: 0xe6e2cf,
    journalAccent: 0x253b87,
    memoryGlow: 0xb8c4ff,
  },
};

export function getMemoryTheme(memoryIndex?: number): MemoryTheme {
  return MEMORY_THEMES[memoryIndex ?? 0] ?? DEFAULT_MEMORY_THEME;
}
