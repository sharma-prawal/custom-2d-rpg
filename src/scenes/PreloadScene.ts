import Phaser from 'phaser';
import { MEMORIES } from '../data/memories';
import { ALL_IMAGES, ALL_AUDIO, CHARACTER_IMAGES, PROP_IMAGES, BACKGROUND_IMAGES } from '../data/assetManifest';
import {
  makePlaceholderBackground,
  makePlaceholderCharacter,
  makePlaceholderProp,
  makePlaceholderUi,
} from '../systems/PlaceholderArt';
import { addCinematicVignette, addSceneGrain, Fonts } from '../systems/VisualTheme';
import { makePuzzlePlaceholderAssets, PUZZLE_ASSET_KEYS } from '../systems/PuzzleArt';
import { fitViewportCover, sharpenOversizedTexture } from '../systems/ImageFit';

const VIEW_W = 1280;
const VIEW_H = 720;

const MIN_DISPLAY_MS = 900;

export class PreloadScene extends Phaser.Scene {
  private startedAt = 0;

  constructor() {
    super('Preload');
  }

  preload(): void {
    this.startedAt = Date.now();
    this.drawLoadingBar();

    // Try to load real assets if they exist. Any that 404 are silently
    // backfilled with placeholders once loading completes below.
    ALL_IMAGES.forEach(({ key, path }) => this.load.image(key, path));
    PUZZLE_ASSET_KEYS.forEach((key) => this.load.image(key, `assets/images/ui/${key}.png`));
    ALL_AUDIO.forEach(({ key, path }) => this.load.audio(key, path));

    this.load.on('loaderror', () => {
      // Expected until real assets are dropped in — placeholders cover the gap.
    });
  }

  create(): void {
    CHARACTER_IMAGES.forEach(({ key }) => {
      const who = key.startsWith('char-her-') ? 'her' : 'him';
      makePlaceholderCharacter(this, key, who);
      // Real character art loads at large portrait resolutions (~1024x1536)
      // but every sprite renders at a fixed 200px tall on screen — WebGL's
      // bilinear-only minification (no mipmaps on NPOT textures) makes that
      // big a downscale look soft. Pre-sharpen with a high-quality canvas
      // resize once at load, well above the display size for zoom/DPI
      // headroom. No-ops on placeholders, which are already tiny.
      sharpenOversizedTexture(this, key, 640);
    });

    PROP_IMAGES.forEach(({ key }) => makePlaceholderProp(this, key));

    BACKGROUND_IMAGES.forEach(({ key }) => makePlaceholderBackground(this, key, VIEW_W, VIEW_H));

    makePlaceholderUi(this, 'portal-locked', 80, 112, 0x3a3a4a);
    makePlaceholderUi(this, 'portal-unlocked', 80, 112, 0xffd9a0);
    makePlaceholderUi(this, 'bts-door', 72, 96, 0x7a5ea8);
    makePlaceholderUi(this, 'final-letter-portal', 100, 140, 0xffe9c2);
    makePuzzlePlaceholderAssets(this);

    // bts-door is the one UI icon with a single, small, fixed display size
    // (fitHeight 150 in HubScene) but a real-art native resolution several
    // times larger — same softening-on-minification issue as character
    // sprites. Other UI/background keys are used at multiple, very
    // different sizes in different scenes (e.g. a memory background shown
    // both full-screen and as a small comparison thumbnail) and deliberately
    // aren't touched here, since sharpening for one use would blur the other.
    sharpenOversizedTexture(this, 'bts-door', 320);

    void MEMORIES; // referenced for clarity that memory data drives the manifest above

    const debugParams = new URLSearchParams(window.location.search);
    if (debugParams.get('debugComplete') === '1') {
      localStorage.setItem(
        'chapters-of-us-save-v1',
        JSON.stringify({
          visitedMemories: [1, 2, 3, 4, 5, 6, 7],
          completedMiniGames: [1, 2, 3, 4, 5, 6, 7],
          journalPages: [1, 2, 3, 4, 5, 6, 7],
          reachedLetter: true,
          unlockedBts: true,
        }),
      );
    }

    const debugScene = debugParams.get('debugScene');
    if (debugScene === 'Hub') {
      this.goTo('Hub');
      return;
    }
    if (debugScene === 'Letter') {
      this.goTo('Letter');
      return;
    }
    if (debugScene === 'BTS') {
      this.goTo('BTS');
      return;
    }
    if (debugScene === 'MiniGame') {
      const memoryIndex = Number(debugParams.get('memory') ?? 1);
      this.goTo('MiniGame', { memoryIndex: Phaser.Math.Clamp(memoryIndex, 1, 7) });
      return;
    }

    this.goTo('MainMenu');
  }

  /**
   * On a fast connection (or once assets are browser-cached), the real load
   * can finish in under a frame — faster than a player can even register
   * the title/tagline this screen was just redesigned to show. Hold on
   * screen for a minimum stretch so the reveal is actually seen once, not
   * just theoretically correct.
   */
  private goTo(key: string, data?: Record<string, unknown>): void {
    const elapsed = Date.now() - this.startedAt;
    const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);
    this.time.delayedCall(remaining, () => this.scene.start(key, data));
  }

  private drawLoadingBar(): void {
    // No real background art is loaded yet at this point (that's the very
    // thing this screen is waiting on), so everything here is drawn with
    // primitives — but it should still read as "this game," not a generic
    // dark tech loading screen. The old version leaned on a graphite/brown
    // gradient, a bare "VII" roman numeral, "opening the memory archive"
    // copy, and a 7-node dot chain — all of which read as a build tool
    // counting chapters, not a love story. Warm dusk palette (matching the
    // memory art), a soft two-circle "us" motif instead of a chapter count,
    // and the same tagline used on the main menu.
    this.cameras.main.setBackgroundColor('#1a1024');

    const frameW = Math.max(VIEW_W, this.scale.gameSize.width);
    const frameH = Math.max(VIEW_H, this.scale.gameSize.height);
    const cx = frameW / 2;
    const cy = frameH / 2;

    // Boot preloads this one image ahead of everything else specifically so
    // it's ready here. Fall back to the plain gradient if it's ever missing
    // rather than leaving a blank frame.
    if (this.textures.exists('loading-bg')) {
      const art = this.add.image(cx, cy, 'loading-bg').setDepth(0);
      fitViewportCover(this, art, frameW, frameH);
      // The painted scene alone doesn't have enough contrast for the title
      // and loading bar sitting on top of it — darken it the same way every
      // in-game scene darkens its background art for its own text overlays.
      this.add.rectangle(cx, cy, frameW, frameH, 0x140d18, 0.42).setDepth(1);
    } else {
      const bg = this.add.graphics();
      bg.fillGradientStyle(0x2b1a3a, 0x35203a, 0x1f1420, 0x140d18, 1);
      bg.fillRect(0, 0, frameW, frameH);
    }
    // A soft warm glow low in the frame, like a sunset behind the title —
    // ties this screen's palette to the memory scenes' golden-hour art.
    const glow = this.add.graphics().setDepth(1);
    glow.fillStyle(0xff9d6c, 0.08);
    glow.fillEllipse(cx, cy + 260, frameW * 0.9, 320);

    addCinematicVignette(this, frameW, frameH, 0.4, 2);
    addSceneGrain(this, frameW, frameH, 3);

    // Two soft overlapping rings — "us" — instead of a numeral crest that
    // gave away the chapter count before the player ever meets the story.
    const ringA = this.add.circle(cx - 14, cy - 156, 30, 0x000000, 0).setDepth(5);
    ringA.setStrokeStyle(1.5, 0xffd9a0, 0.4);
    const ringB = this.add.circle(cx + 14, cy - 156, 30, 0x000000, 0).setDepth(5);
    ringB.setStrokeStyle(1.5, 0xffb6c9, 0.4);
    const spark = this.add.circle(cx, cy - 156, 3, 0xfff3d8, 0.9).setDepth(6);

    const titleShadow = this.add
      .text(cx + 3, cy - 78, 'Chapters of Us', {
        fontFamily: Fonts.title,
        fontSize: '54px',
        color: '#000000',
      })
      .setOrigin(0.5)
      .setAlpha(0.42)
      .setDepth(5);
    this.add
      .text(cx, cy - 82, 'Chapters of Us', {
        fontFamily: Fonts.title,
        fontSize: '54px',
        color: '#f7ecd2',
      })
      .setOrigin(0.5)
      .setDepth(5);

    // Deliberately not reusing the main menu's "a quiet walk through
    // everything I noticed" tagline here — seeing the identical line twice
    // in a row (loading screen, then main menu a second later) read as
    // repeated copy rather than a deliberate echo.
    this.add
      .text(cx, cy - 26, 'every small thing, kept safe', {
        fontFamily: Fonts.body,
        fontSize: '18px',
        color: '#e3c9b8',
      })
      .setOrigin(0.5)
      .setDepth(5);

    const rail = this.add.rectangle(cx, cy + 66, 420, 3, 0xfff1ce, 0.14).setDepth(6);
    rail.setStrokeStyle(1, 0xffd9a0, 0.16);
    const fill = this.add.rectangle(cx - 210, cy + 66, 4, 3, 0xd9b982, 0.95).setOrigin(0, 0.5).setDepth(7);
    const glint = this.add.rectangle(cx - 210, cy + 66, 28, 3, 0xffffff, 0.32).setOrigin(0, 0.5).setDepth(8);
    const loadingLabel = this.add
      .text(cx, cy + 94, 'gathering the little things…', {
        fontFamily: Fonts.ui,
        fontSize: '14px',
        color: '#b9ad9c',
      })
      .setOrigin(0.5)
      .setDepth(5);

    this.tweens.add({
      targets: [ringA, ringB, spark],
      alpha: 0.55,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.load.on('progress', (value: number) => {
      const width = Math.max(4, 420 * value);
      fill.setDisplaySize(width, 3);
      glint.setX(cx - 210 + Math.max(0, width - 28));
    });

    void titleShadow;
    void loadingLabel;
    void glow;
  }
}
