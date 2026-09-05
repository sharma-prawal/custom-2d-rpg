import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { HubScene } from './scenes/HubScene';
import { MemoryScene } from './scenes/MemoryScene';
import { MiniGameScene } from './scenes/MiniGameScene';
import { JournalScene } from './scenes/JournalScene';
import { BTSScene } from './scenes/BTSScene';
import { LetterScene } from './scenes/LetterScene';
import ensureUnlocked from './gate';

// Gate first: React must not mount, and the app's own fetches and audio must
// not start, while the lock screen is up. Deliberately .then() rather than a
// top-level await — TLA exceeds the browser target these apps build for.
void ensureUnlocked().then(() => {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'app',
    width: 1280,
    height: 720,
    // The art is detailed painterly/pixel-art at native HD resolution, not
    // authentic low-res 8-bit — nearest-neighbor filtering plus a tiny internal
    // canvas is what made everything look like a blurry, blocky mess. Render
    // at a real HD resolution with smooth (bilinear) filtering instead.
    pixelArt: false,
    roundPixels: false,
    backgroundColor: '#0b0b12',
    scale: {
      mode: Phaser.Scale.EXPAND,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1280,
      height: 720,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    dom: {
      createContainer: true,
    },
    scene: [BootScene, PreloadScene, MainMenuScene, HubScene, MemoryScene, MiniGameScene, JournalScene, BTSScene, LetterScene],
  };

  // Phaser removed whole-canvas resolution/DPR scaling from the public API
  // somewhere before 3.90 — `game.config.resolution` no longer exists, and
  // nothing in the engine reads `window.devicePixelRatio` except its own
  // internal device-detection log. Left alone, every dynamically-created Text
  // object renders its glyphs into a 1x-density internal canvas texture, then
  // that texture gets upscaled by the browser to match the display's real
  // pixel density — soft, mushy text on any HiDPI screen (most laptops,
  // phones, external monitors today), which is the single most
  // blur-sensitive thing in this game (dialogue, UI labels, titles).
  //
  // The properly-supported per-object fix is `Text#setResolution()` (still
  // public, still documented as "much clearer text on High DPI devices").
  // Wrapping the factory once here applies it to every `this.add.text(...)`
  // call across the whole codebase without touching each of the dozens of
  // call sites individually.
  //
  // Deliberately NOT attempting the equivalent for the painted background
  // art: that would require manually resizing the renderer's raw pixel
  // buffer beyond the scale manager's EXPAND-computed size, then compensating
  // with a matching zoom on every scene's camera so game-object positions
  // don't shift — and this codebase already has extensive per-scene camera
  // pan/zoom effects (breathing zooms, cinematic pans, portal cutscenes) all
  // written assuming a zoom baseline of 1. Layering a global DPR-zoom
  // underneath those would mean auditing and adjusting every one of them,
  // for a comparatively small visual gain on already-soft painterly art —
  // a bad risk/reward trade Phaser's own maintainers evidently agreed with
  // when they removed built-in support for it.
  // Capped at 2 originally; several phones and higher-density laptop panels
  // report devicePixelRatio 2.5-3, so a hard cap of 2 under-resolved their
  // text glyphs specifically (the softness this whole patch exists to avoid).
  // Text textures are tiny relative to the background art this file already
  // declines to upscale, so the memory cost of going up to 3 is negligible.
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const originalTextFactory = Phaser.GameObjects.GameObjectFactory.prototype.text;
  Phaser.GameObjects.GameObjectFactory.prototype.text = function (
    this: Phaser.GameObjects.GameObjectFactory,
    x: number,
    y: number,
    text: string | string[],
    style?: Phaser.Types.GameObjects.Text.TextStyle,
  ) {
    const textObject = originalTextFactory.call(this, x, y, text, style);
    textObject.setResolution(dpr);
    return textObject;
  };

  function setupViewportRefresh(game: Phaser.Game): void {
    const refreshGameScale = () => {
      game.scale.refresh();
      window.setTimeout(() => game.scale.refresh(), 80);
    };

    window.addEventListener('resize', refreshGameScale);
    document.addEventListener('fullscreenchange', refreshGameScale);

    // The 80ms retry above is a guess at how long the fullscreen transition
    // takes to actually settle — on some platforms/browsers `#app`'s
    // getBoundingClientRect() is still reporting the pre-transition (small,
    // windowed) size at that point, so ScaleManager.refresh() recomputes the
    // canvas using stale bounds and the game gets stuck rendered at its old
    // size, letterboxed by black bars inside the now-fullscreen window.
    // ResizeObserver sidesteps the guesswork entirely: it fires exactly when
    // the browser has actually finished laying out `#app` at its new size,
    // whatever that took, on every platform.
    const app = document.getElementById('app');
    if (app && 'ResizeObserver' in window) {
      const observer = new ResizeObserver(() => game.scale.refresh());
      observer.observe(app);
    }
  }

  const game = new Phaser.Game(config);
  setupViewportRefresh(game);
  if (import.meta.env.DEV) {
    (window as unknown as { game: Phaser.Game }).game = game;
  }
});
