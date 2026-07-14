import Phaser from 'phaser';
import { Fonts } from './VisualTheme';

interface ChapterPlaqueOptions {
  index: number;
  title: string;
  caption?: string;
  unlocked: boolean;
  visited: boolean;
}

interface DestinationSignOptions {
  text: string;
  subtitle?: string;
  width?: number;
  accent?: number;
  locked?: boolean;
  icon?: 'reel';
}

interface SceneTitleOptions {
  title: string;
  subtitle?: string;
  accent?: number;
  width?: number;
  depth?: number;
}

interface SpotTagOptions {
  text: string;
  accent?: number;
  width?: number;
  depth?: number;
}

function titleFontSize(text: string, width: number, base: number, min: number): string {
  const estimated = Math.floor((width - 62) / Math.max(1, text.length) * 1.9);
  return `${Phaser.Math.Clamp(Math.min(base, estimated), min, base)}px`;
}

export function addChapterPlaque(
  scene: Phaser.Scene,
  x: number,
  y: number,
  { index, title, caption, unlocked, visited }: ChapterPlaqueOptions,
): Phaser.GameObjects.Container {
  const accent = unlocked ? 0xffd98f : 0x8d8178;
  const highlight = visited ? 0xc8ffd8 : unlocked ? 0xfff0c6 : 0xb0a39a;
  const container = scene.add.container(x, y).setDepth(8);

  const glow = scene.add.graphics();
  glow.fillStyle(unlocked ? accent : 0x000000, unlocked ? 0.08 : 0.12);
  glow.fillEllipse(0, -15, unlocked ? 88 : 70, unlocked ? 38 : 30);

  const numberShadow = scene.add.text(2, -35, String(index).padStart(2, '0'), {
    fontFamily: Fonts.title,
    fontSize: '31px',
    color: '#050407',
  }).setOrigin(0.5, 0).setAlpha(0.78);
  const number = scene.add.text(0, -38, String(index).padStart(2, '0'), {
    fontFamily: Fonts.title,
    fontSize: '31px',
    color: Phaser.Display.Color.IntegerToColor(highlight).rgba,
    stroke: '#5a3516',
    strokeThickness: unlocked ? 2 : 1,
  }).setOrigin(0.5, 0);

  const ornament = scene.add.graphics();
  ornament.lineStyle(1, accent, unlocked ? 0.72 : 0.34);
  ornament.lineBetween(-34, 5, -10, 5);
  ornament.lineBetween(10, 5, 34, 5);
  ornament.fillStyle(accent, unlocked ? 0.82 : 0.38);
  ornament.fillCircle(0, 5, 2);

  const labelShadow = scene.add.text(1, 13, unlocked ? caption ?? title : 'SEALED', {
    fontFamily: Fonts.ui,
    fontSize: '9px',
    color: '#050407',
    align: 'center',
    fixedWidth: 96,
    wordWrap: { width: 96 },
    maxLines: 2,
  }).setOrigin(0.5, 0).setAlpha(0.72);
  const label = scene.add.text(0, 12, unlocked ? caption ?? title : 'SEALED', {
    fontFamily: Fonts.ui,
    fontSize: '9px',
    color: unlocked ? '#fff0c6' : '#c8bbb1',
    align: 'center',
    fixedWidth: 96,
    wordWrap: { width: 96 },
    maxLines: 2,
  }).setOrigin(0.5, 0).setAlpha(unlocked ? 0.94 : 0.78);
  const jewel = scene.add.circle(33, -30, 3.2, visited ? 0xb6ffd0 : accent, visited ? 0.9 : unlocked ? 0.54 : 0.2);
  jewel.setStrokeStyle(1, 0xfff3d8, visited ? 0.42 : 0.12);

  container.add([glow, numberShadow, number, ornament, labelShadow, label, jewel]);
  if (unlocked) {
    scene.tweens.add({ targets: [glow, jewel], alpha: visited ? 0.62 : 0.3, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  return container;
}

export function addDestinationSign(
  scene: Phaser.Scene,
  x: number,
  y: number,
  { text, subtitle, width = 210, accent = 0xffd9a0, locked = false, icon }: DestinationSignOptions,
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y).setDepth(7);
  const titleColor = locked ? '#c8bbb1' : Phaser.Display.Color.IntegerToColor(accent).rgba;
  const subtitleColor = locked ? '#a79a91' : '#f1dfbd';
  const glow = scene.add.graphics();
  glow.fillStyle(locked ? 0x090911 : accent, locked ? 0.06 : 0.08);
  glow.fillEllipse(0, -6, width * 0.82, subtitle ? 50 : 42);

  const titleShadow = scene.add.text(2, -28, text, {
    fontFamily: Fonts.title,
    fontSize: titleFontSize(text, width, 34, 23),
    color: '#07050a',
    align: 'center',
    fixedWidth: width - 20,
    wordWrap: { width: width - 20 },
  }).setOrigin(0.5, 0).setAlpha(locked ? 0.82 : 0.64);
  const label = scene.add.text(0, -31, text, {
    fontFamily: Fonts.title,
    fontSize: titleFontSize(text, width, 34, 23),
    color: titleColor,
    align: 'center',
    fixedWidth: width - 20,
    wordWrap: { width: width - 20 },
    stroke: locked ? '#2a2324' : '#5a3516',
    strokeThickness: locked ? 1 : 2,
  }).setOrigin(0.5, 0);

  const rule = scene.add.graphics();
  rule.lineStyle(1, accent, locked ? 0.26 : 0.7);
  rule.lineBetween(-width * 0.22, 7, -12, 7);
  rule.lineBetween(12, 7, width * 0.22, 7);
  rule.fillStyle(accent, locked ? 0.28 : 0.78);
  rule.fillCircle(0, 7, 2);

  const sub = subtitle
    ? scene.add.text(0, 11, subtitle, {
        fontFamily: Fonts.ui,
        fontSize: '10px',
        color: subtitleColor,
        align: 'center',
        fixedWidth: width - 34,
        wordWrap: { width: width - 34 },
      }).setOrigin(0.5, 0).setAlpha(locked ? 0.76 : 0.9)
    : undefined;

  const children: Phaser.GameObjects.GameObject[] = sub ? [glow, titleShadow, label, rule, sub] : [glow, titleShadow, label, rule];

  if (icon === 'reel') {
    const reel = scene.add.graphics();
    const reelColor = locked ? 0x857a73 : accent;
    reel.lineStyle(1, reelColor, locked ? 0.34 : 0.74);
    reel.strokeCircle(0, -39, 9);
    reel.fillStyle(reelColor, locked ? 0.24 : 0.62);
    reel.fillCircle(0, -39, 2.4);
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI / 2) * i + Math.PI / 4;
      reel.fillStyle(0x090911, locked ? 0.46 : 0.78);
      reel.fillCircle(Math.cos(angle) * 5.3, -39 + Math.sin(angle) * 5.3, 1.9);
    }
    children.push(reel);
  }

  container.add(children);
  container.setAlpha(locked ? 0.72 : 1);
  return container;
}

export function addSceneTitlePlaque(
  scene: Phaser.Scene,
  x: number,
  y: number,
  { title, subtitle, accent = 0xffd9a0, width = 560, depth = 950 }: SceneTitleOptions,
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y).setDepth(depth).setScrollFactor(0);
  const height = subtitle ? 72 : 56;
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x090911, 0.5);
  graphics.fillRoundedRect(-width / 2, -height / 2, width, height, 12);
  graphics.lineStyle(2, accent, 0.26);
  graphics.strokeRoundedRect(-width / 2, -height / 2, width, height, 12);
  graphics.lineStyle(1, 0xffffff, 0.07);
  graphics.strokeRoundedRect(-width / 2 + 10, -height / 2 + 8, width - 20, height - 16, 10);
  graphics.fillStyle(accent, 0.2);
  graphics.fillRect(-width / 2 + 30, -height / 2 + 12, width - 60, 1);
  graphics.fillRect(-width / 2 + 54, height / 2 - 12, width - 108, 1);

  const label = scene.add.text(0, subtitle ? -27 : -20, title, {
    fontFamily: Fonts.title,
    fontSize: titleFontSize(title, width, 34, 24),
    color: Phaser.Display.Color.IntegerToColor(accent).rgba,
    align: 'center',
    fixedWidth: width - 54,
    wordWrap: { width: width - 54 },
  }).setOrigin(0.5, 0);
  const sub = subtitle
    ? scene.add.text(0, 15, subtitle, {
        fontFamily: Fonts.ui,
        fontSize: '12px',
        color: '#d8cabb',
        align: 'center',
        fixedWidth: width - 70,
        wordWrap: { width: width - 70 },
      }).setOrigin(0.5, 0).setAlpha(0.82)
    : undefined;

  container.add(sub ? [graphics, label, sub] : [graphics, label]);
  return container;
}

export function addSpotTag(
  scene: Phaser.Scene,
  x: number,
  y: number,
  { text, accent = 0xffd9a0, width = 154, depth = 7 }: SpotTagOptions,
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y).setDepth(depth);
  const height = 34;
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x090911, 0.42);
  graphics.fillRoundedRect(-width / 2, -height / 2, width, height, 7);
  graphics.lineStyle(1, accent, 0.28);
  graphics.strokeRoundedRect(-width / 2, -height / 2, width, height, 7);
  graphics.fillStyle(accent, 0.16);
  graphics.fillRect(-width / 2 + 10, -height / 2 + 7, width - 20, 1);
  const leftPin = scene.add.circle(-width / 2 + 10, 0, 3, accent, 0.42);
  const rightPin = scene.add.circle(width / 2 - 10, 0, 3, accent, 0.42);
  const label = scene.add.text(0, -9, text, {
    fontFamily: Fonts.ui,
    fontSize: text.length > 18 ? '11px' : '12px',
    color: '#f5ecd8',
    align: 'center',
    fixedWidth: width - 30,
    wordWrap: { width: width - 30 },
  }).setOrigin(0.5, 0).setAlpha(0.92);
  container.add([graphics, leftPin, rightPin, label]);
  return container;
}

export function addHubFocusPlate(scene: Phaser.Scene, x: number, y: number, width: number): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y).setDepth(30).setVisible(false).setScrollFactor(0);
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x090911, 0.62);
  graphics.fillRoundedRect(-width / 2, -27, width, 54, 11);
  graphics.lineStyle(2, 0xffd9a0, 0.22);
  graphics.strokeRoundedRect(-width / 2, -27, width, 54, 11);
  graphics.lineStyle(1, 0xffffff, 0.06);
  graphics.strokeRoundedRect(-width / 2 + 10, -18, width - 20, 36, 7);
  graphics.fillStyle(0xffd9a0, 0.14);
  graphics.fillRect(-width / 2 + 42, -20, width - 84, 1);
  container.add(graphics);
  return container;
}
