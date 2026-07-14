import Phaser from 'phaser';

/**
 * Real generated art won't share the placeholder textures' tiny native pixel
 * dimensions, so every visual is normalized to a fixed on-screen size by
 * scale rather than assumed native size. Drop in art of any resolution and
 * layout stays intact.
 */

/** Uniformly scales a sprite/image so its height matches targetHeight, preserving aspect ratio. */
export function fitHeight(obj: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite, targetHeight: number): void {
  const scale = targetHeight / obj.height;
  obj.setScale(scale);
}

/** Stretches an image to exactly fill the given box (used for full-frame backgrounds). */
export function fitExact(obj: Phaser.GameObjects.Image, width: number, height: number): void {
  obj.setDisplaySize(width, height);
}

/** Cover-scales a full-frame image across the current canvas-visible game area. */
export function fitViewportCover(
  scene: Phaser.Scene,
  obj: Phaser.GameObjects.Image,
  designWidth: number,
  designHeight: number,
): void {
  const width = Math.max(designWidth, scene.scale.gameSize.width);
  const height = Math.max(designHeight, scene.scale.gameSize.height);
  const scale = Math.max(width / obj.width, height / obj.height);
  obj.setPosition(width / 2, height / 2);
  obj.setScale(scale);
}

/** Scales a sprite/image to fit entirely within a box (both dimensions), preserving aspect ratio. */
export function fitWithin(obj: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite, maxWidth: number, maxHeight: number): void {
  const scale = Math.min(maxWidth / obj.width, maxHeight / obj.height);
  obj.setScale(scale);
}

/** Scales a TileSprite's texture so one tile is exactly targetHeight tall, keeping aspect ratio. */
export function fitTileHeight(tile: Phaser.GameObjects.TileSprite, targetHeight: number): void {
  const source = tile.texture.getSourceImage() as { height: number };
  const scale = targetHeight / source.height;
  tile.setTileScale(scale, scale);
}

/**
 * Real generated character art comes back from image generators at large,
 * non-power-of-two portrait resolutions (e.g. ~1024x1536), but every sprite
 * on screen is normalized down to CHAR_HEIGHT (200px, see Player.ts/NPC.ts)
 * — a ~7.5x reduction. WebGL only bilinear-filters on minification (NPOT
 * textures can't get a mipmap chain), so that big a reduction looks soft/
 * aliased no matter how sharp the source is. A one-time high-quality canvas
 * downsample at load time (2D canvas `drawImage` uses proper area averaging,
 * not single-sample bilinear) fixes this without touching the source files
 * or any rendering code downstream — every existing `scene.add.sprite(key)`
 * call just gets a crisper texture under the same key.
 *
 * Safe to call on any texture: placeholders and already-reasonably-sized
 * images are well under `maxHeight` and are left untouched.
 */
export function sharpenOversizedTexture(scene: Phaser.Scene, key: string, maxHeight: number): void {
  if (!scene.textures.exists(key)) return;
  const source = scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const srcW = source.width;
  const srcH = source.height;
  if (!srcW || !srcH || srcH <= maxHeight * 1.2) return;

  const { targetW, targetH } = downsampleDimensions(srcW, srcH, maxHeight);
  scene.textures.remove(key);
  drawResampledCanvas(scene, key, source, targetW, targetH);
}

/**
 * Same high-quality downsample as `sharpenOversizedTexture`, but for assets
 * shown at more than one very different size in different places — e.g. a
 * memory background shown both full-screen (MemoryScene) and shrunk to a
 * small comparison-panel thumbnail (a "spot the difference" mini-game).
 * Mutating the original key in place would fix one use and blur the other,
 * so this instead creates a second, separate texture key sized for the
 * small use case and leaves the original untouched for its full-size uses.
 * Idempotent — safe to call every time the small view is rendered; the
 * variant is only generated once and reused after that. Returns whichever
 * key should actually be used for the small display (the new variant, or
 * the original key unchanged if it wasn't oversized to begin with).
 */
export function sharpVariantKey(scene: Phaser.Scene, sourceKey: string, maxHeight: number): string {
  if (!scene.textures.exists(sourceKey)) return sourceKey;
  const variantKey = `${sourceKey}@sharp${maxHeight}`;
  if (scene.textures.exists(variantKey)) return variantKey;

  const source = scene.textures.get(sourceKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const srcW = source.width;
  const srcH = source.height;
  if (!srcW || !srcH || srcH <= maxHeight * 1.2) return sourceKey;

  const { targetW, targetH } = downsampleDimensions(srcW, srcH, maxHeight);
  drawResampledCanvas(scene, variantKey, source, targetW, targetH);
  return scene.textures.exists(variantKey) ? variantKey : sourceKey;
}

function downsampleDimensions(srcW: number, srcH: number, maxHeight: number): { targetW: number; targetH: number } {
  const scale = maxHeight / srcH;
  return { targetW: Math.max(1, Math.round(srcW * scale)), targetH: Math.max(1, Math.round(srcH * scale)) };
}

function drawResampledCanvas(
  scene: Phaser.Scene,
  key: string,
  source: HTMLImageElement | HTMLCanvasElement,
  targetW: number,
  targetH: number,
): void {
  const canvasTexture = scene.textures.createCanvas(key, targetW, targetH);
  if (!canvasTexture) return;
  const ctx = canvasTexture.getContext();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source as CanvasImageSource, 0, 0, targetW, targetH);
  canvasTexture.refresh();
}
