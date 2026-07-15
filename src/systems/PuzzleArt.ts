import Phaser from 'phaser';

export const PUZZLE_ASSET_KEYS = [
  'memory-journal-bg',
  'memory-journal-bg-clean',
  'parchment-panel',
  'crossword-tile',
  'sticky-note',
  'photo-album-bg',
  'lock-panel',
  'hidden-object-glow',
  'difference-marker',
  'completion-sparkle',
  'keepsake-01',
  'keepsake-02',
  'keepsake-03',
  'keepsake-04',
  'keepsake-05',
  'keepsake-06',
  'keepsake-07',
] as const;

export function makePuzzlePlaceholderAssets(scene: Phaser.Scene): void {
  makePanel(scene, 'memory-journal-bg', 900, 560, 0x5b3d28, 0xf5ecd8);
  makePanel(scene, 'memory-journal-bg-clean', 900, 560, 0x5b3d28, 0xf5ecd8);
  makePanel(scene, 'parchment-panel', 720, 420, 0xf5ecd8, 0x7a5a3a);
  makePanel(scene, 'crossword-tile', 64, 64, 0xfff5df, 0x7a5a3a);
  makePanel(scene, 'sticky-note', 260, 118, 0xffdca8, 0x9a7650);
  makePanel(scene, 'photo-album-bg', 900, 560, 0x39261f, 0xd8b98d);
  makePanel(scene, 'lock-panel', 380, 300, 0x14141c, 0xffd9a0);
  makeGlow(scene, 'hidden-object-glow', 72, 0xffd9a0);
  makeGlow(scene, 'difference-marker', 86, 0x8fd9ff);
  makeGlow(scene, 'completion-sparkle', 92, 0xfff3d8);
  for (let i = 1; i <= 7; i++) makeKeepsake(scene, `keepsake-0${i}`, i);
}

function makePanel(scene: Phaser.Scene, key: string, width: number, height: number, fill: number, stroke: number): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  g.fillStyle(fill, 1);
  g.fillRoundedRect(0, 0, width, height, 18);
  g.lineStyle(4, stroke, 0.65);
  g.strokeRoundedRect(6, 6, width - 12, height - 12, 14);
  g.generateTexture(key, width, height);
  g.destroy();
}

function makeGlow(scene: Phaser.Scene, key: string, size: number, color: number): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  for (let r = size / 2; r > 4; r -= 6) {
    g.fillStyle(color, 0.04);
    g.fillCircle(size / 2, size / 2, r);
  }
  g.fillStyle(0xfff3d8, 0.9);
  g.fillCircle(size / 2, size / 2, 5);
  g.generateTexture(key, size, size);
  g.destroy();
}

function makeKeepsake(scene: Phaser.Scene, key: string, index: number): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  g.fillStyle(0x090911, 0.78);
  g.fillCircle(48, 48, 42);
  g.lineStyle(3, 0xffd9a0, 0.75);
  g.strokeCircle(48, 48, 38);
  g.fillStyle(0xffd9a0, 1);
  g.fillCircle(48, 48, 8 + index);
  g.generateTexture(key, 96, 96);
  g.destroy();
}
