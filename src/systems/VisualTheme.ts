import Phaser from 'phaser';
import { DEFAULT_MEMORY_THEME, getMemoryTheme, MemoryTheme } from '../data/memoryThemes';

export const Fonts = {
  title: 'Georgia, "Times New Roman", serif',
  body: 'Georgia, "Times New Roman", serif',
  ui: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

export const Colors = {
  ink: '#f7ecd2',
  muted: '#b9ad9c',
  gold: '#ffd9a0',
  rose: '#e7b6a2',
  dark: 0x090911,
  panel: 0x101019,
};

let activeTheme: MemoryTheme = DEFAULT_MEMORY_THEME;

export function setActiveMemoryTheme(memoryIndex?: number): MemoryTheme {
  activeTheme = getMemoryTheme(memoryIndex);
  return activeTheme;
}

export function getActiveMemoryTheme(): MemoryTheme {
  return activeTheme;
}

function expandedSize(scene: Phaser.Scene, width: number, height: number): { width: number; height: number } {
  return {
    width: Math.max(width, scene.scale.gameSize.width),
    height: Math.max(height, scene.scale.gameSize.height),
  };
}

export function addCinematicVignette(
  scene: Phaser.Scene,
  width: number,
  height: number,
  alpha = 0.34,
  depth = 900,
): Phaser.GameObjects.Container {
  ({ width, height } = expandedSize(scene, width, height));
  const graphics = scene.add.graphics();
  const topHeight = Math.min(210, height * 0.26);
  const sideWidth = Math.min(130, width * 0.1);
  const steps = 90;

  for (let i = 0; i < steps; i++) {
    const t = 1 - i / steps;
    const bandAlpha = alpha * t * t;
    const nextY = (topHeight / steps) * (i + 1);
    graphics.fillStyle(0x000000, bandAlpha);
    graphics.fillRect(0, (topHeight / steps) * i, width, topHeight / steps + 1);
    graphics.fillRect(0, height - nextY, width, topHeight / steps + 1);
  }

  for (let i = 0; i < steps; i++) {
    const t = 1 - i / steps;
    const bandAlpha = alpha * 0.72 * t * t;
    const band = sideWidth / steps;
    graphics.fillStyle(0x000000, bandAlpha);
    graphics.fillRect(band * i, 0, band + 1, height);
    graphics.fillRect(width - band * (i + 1), 0, band + 1, height);
  }

  const container = scene.add.container(0, 0, [graphics]);
  container.setDepth(depth);
  container.setScrollFactor(0);
  return container;
}

export function addSoftPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  depth: number,
  fill = 0x0b0b12,
  alpha = 0.78,
  withGlass = false,
): Phaser.GameObjects.Container {
  const theme = getActiveMemoryTheme();
  const border = theme.border;
  fill = fill === 0x0b0b12 || fill === 0x090911 || fill === 0x101019 ? theme.panelBackground : fill;
  const shadow = scene.add.rectangle(x + 8, y + 10, width, height, 0x000000, 0.35);
  const panel = scene.add.rectangle(x, y, width, height, fill, alpha);
  panel.setStrokeStyle(2, border, 0.28);
  const hairline = scene.add.rectangle(x, y - height / 2 + 2, width - 20, 2, border, 0.22);
  const corner = 18;
  const inset = 12;
  const corners = [
    scene.add.rectangle(x - width / 2 + inset, y - height / 2 + inset, corner, 2, border, 0.32).setOrigin(0, 0.5),
    scene.add.rectangle(x - width / 2 + inset, y - height / 2 + inset, 2, corner, border, 0.32).setOrigin(0.5, 0),
    scene.add.rectangle(x + width / 2 - inset, y - height / 2 + inset, corner, 2, border, 0.32).setOrigin(1, 0.5),
    scene.add.rectangle(x + width / 2 - inset, y - height / 2 + inset, 2, corner, border, 0.32).setOrigin(0.5, 0),
    scene.add.rectangle(x - width / 2 + inset, y + height / 2 - inset, corner, 2, border, 0.32).setOrigin(0, 0.5),
    scene.add.rectangle(x - width / 2 + inset, y + height / 2 - inset, 2, corner, border, 0.32).setOrigin(0.5, 1),
    scene.add.rectangle(x + width / 2 - inset, y + height / 2 - inset, corner, 2, border, 0.32).setOrigin(1, 0.5),
    scene.add.rectangle(x + width / 2 - inset, y + height / 2 - inset, 2, corner, border, 0.32).setOrigin(0.5, 1),
  ];
  const children: Phaser.GameObjects.GameObject[] = [shadow, panel, hairline, ...corners];

  // Glass shimmer: a thin diagonal highlight across the top-left of the panel
  if (withGlass) {
    const shimmer = scene.add.graphics();
    shimmer.lineStyle(1.2, 0xffffff, 0.18);
    shimmer.beginPath();
    shimmer.moveTo(x - width / 2 + 18, y - height / 2);
    shimmer.lineTo(x - width / 2, y - height / 2 + 18);
    shimmer.strokePath();
    // Soft inner glow along the top edge
    const innerGlow = scene.add.rectangle(x, y - height / 2 + 6, width - 40, 4, theme.memoryGlow, 0.07);
    children.push(shimmer, innerGlow);
  }

  const container = scene.add.container(0, 0, children);
  container.setDepth(depth);
  container.setScrollFactor(0);
  return container;
}

/**
 * Paints a one-off glass shimmer sweep across an existing panel container.
 * Call with the panel returned from addSoftPanel to animate a light-streak
 * that plays once and fades out — useful for hover highlights or on-snap FX.
 */
export function addGlassShimmer(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  depth: number,
): void {
  const streak = scene.add.graphics().setDepth(depth).setScrollFactor(0);
  streak.lineStyle(width * 0.6, 0xffffff, 0.0);
  streak.beginPath();
  streak.moveTo(x - width / 2, y - height / 2);
  streak.lineTo(x + width / 2, y + height / 2);
  streak.strokePath();
  // Animate the streak alpha across then destroy
  scene.tweens.add({
    targets: streak,
    alpha: { from: 0, to: 0.07 },
    duration: 180,
    yoyo: true,
    ease: 'Sine.easeOut',
    onComplete: () => streak.destroy(),
  });
}

export function addToast(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  depth = 950,
): Phaser.GameObjects.Container {
  const theme = getActiveMemoryTheme();
  const bg = scene.add.rectangle(x, y, 360, 42, 0x090911, 0.54);
  bg.setStrokeStyle(1, theme.border, 0.18);
  const top = scene.add.rectangle(x, y - 20, 310, 1, theme.border, 0.18);
  const label = scene.add
    .text(x, y - 12, text, {
      fontFamily: Fonts.ui,
      fontSize: '18px',
      color: '#d9d0bf',
    })
    .setOrigin(0.5, 0);
  const container = scene.add.container(0, 0, [bg, top, label]);
  container.setDepth(depth).setScrollFactor(0);
  return container;
}

export function gradeCharacter(sprite: Phaser.GameObjects.Sprite, sceneTint: number, alpha = 0.94): void {
  const color = Phaser.Display.Color.IntegerToColor(sceneTint);
  const softened = Phaser.Display.Color.GetColor(
    Math.min(255, Math.round(235 + color.red * 0.08)),
    Math.min(255, Math.round(225 + color.green * 0.08)),
    Math.min(255, Math.round(215 + color.blue * 0.08)),
  );
  sprite.setTint(softened);
  sprite.setAlpha(alpha);
}

export function addSceneGrain(scene: Phaser.Scene, width: number, height: number, depth = 901): void {
  ({ width, height } = expandedSize(scene, width, height));
  const key = 'vfx-subtle-grain';
  if (!scene.textures.exists(key)) {
    const canvas = scene.textures.createCanvas(key, 128, 128);
    const ctx = canvas?.getContext();
    if (canvas && ctx) {
      const image = ctx.createImageData(128, 128);
      for (let i = 0; i < image.data.length; i += 4) {
        const value = Math.random() > 0.5 ? 255 : 0;
        image.data[i] = value;
        image.data[i + 1] = value;
        image.data[i + 2] = value;
        image.data[i + 3] = Math.random() > 0.55 ? 10 : 0;
      }
      ctx.putImageData(image, 0, 0);
      canvas.refresh();
    }
  }
  const grain = scene.add.tileSprite(0, 0, width, height, key).setOrigin(0, 0).setAlpha(0.22);
  grain.setDepth(depth);
  grain.setScrollFactor(0);
}
