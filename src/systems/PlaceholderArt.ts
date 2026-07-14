import Phaser from 'phaser';

/** Deterministic hue from a string key, so placeholder colors stay stable across reloads. */
function hashHue(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return hash % 360;
}

function hslToHex(h: number, s: number, l: number): number {
  const color = Phaser.Display.Color.HSLToColor(h / 360, s, l);
  return color.color;
}

/** Solid-color background placeholder, sized to the game view, with a faint border. */
export function makePlaceholderBackground(scene: Phaser.Scene, key: string, width: number, height: number): void {
  if (scene.textures.exists(key)) return;
  const hue = hashHue(key);
  const fill = hslToHex(hue, 0.28, 0.22);
  const g = scene.add.graphics();
  g.fillStyle(fill, 1);
  g.fillRect(0, 0, width, height);
  g.lineStyle(2, hslToHex(hue, 0.4, 0.4), 0.6);
  g.strokeRect(1, 1, width - 2, height - 2);
  g.generateTexture(key, width, height);
  g.destroy();
}

/**
 * Small humanoid placeholder (body + head + a tiny "PS" monogram accent) so the two
 * leads read as distinct silhouettes even before real sprites exist.
 */
export function makePlaceholderCharacter(scene: Phaser.Scene, key: string, who: 'her' | 'him'): void {
  if (scene.textures.exists(key)) return;
  const w = 16;
  const h = 24;
  const bodyColor = who === 'her' ? 0xdd6b8e : 0x4b7bab;
  const headColor = who === 'her' ? 0xf2c9a0 : 0xe8b98c;
  const g = scene.add.graphics();
  g.fillStyle(bodyColor, 1);
  g.fillRoundedRect(2, 8, w - 4, h - 9, 2);
  g.fillStyle(headColor, 1);
  g.fillCircle(w / 2, 6, 5);
  // PS monogram patch
  g.fillStyle(0xffd9a0, 1);
  g.fillRect(w / 2 - 1, 12, 2, 2);
  g.generateTexture(key, w, h);
  g.destroy();
}

/** Small icon placeholder for interactable props. */
export function makePlaceholderProp(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) return;
  const size = 14;
  const hue = hashHue(key);
  const g = scene.add.graphics();
  g.fillStyle(hslToHex(hue, 0.35, 0.45), 1);
  g.fillRoundedRect(1, 1, size - 2, size - 2, 3);
  g.lineStyle(1, 0xffffff, 0.5);
  g.strokeRoundedRect(1, 1, size - 2, size - 2, 3);
  g.generateTexture(key, size, size);
  g.destroy();
}

/** Generic tinted-rectangle placeholder for UI elements (portals, doors). */
export function makePlaceholderUi(scene: Phaser.Scene, key: string, w: number, h: number, color: number): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  g.fillStyle(color, 1);
  g.fillRoundedRect(0, 0, w, h, 4);
  g.lineStyle(1, 0xffffff, 0.7);
  g.strokeRoundedRect(0, 0, w, h, 4);
  g.generateTexture(key, w, h);
  g.destroy();
}
