import Phaser from 'phaser';
import { Fonts } from './VisualTheme';

export interface LightboxPhoto {
  key: string;
  caption: string;
}

/**
 * A full-screen, gold-framed photo viewer with prev/next paging — the
 * "properly opened" counterpart to the small mounted/cropped thumbnails
 * used elsewhere (journal page, scrapbook puzzle). Shows each photo at its
 * true aspect ratio, uncropped, using its full native resolution.
 */
export class PhotoLightbox {
  private scene: Phaser.Scene;
  private photos: LightboxPhoto[] = [];
  private index = 0;
  private opened = false;
  private objects: Phaser.GameObjects.GameObject[] = [];
  private escKey?: Phaser.Input.Keyboard.Key;
  private leftKey?: Phaser.Input.Keyboard.Key;
  private rightKey?: Phaser.Input.Keyboard.Key;

  constructor(scene: Phaser.Scene, _viewW: number, _viewH: number) {
    this.scene = scene;
    // viewW and viewH are no longer stored — render() reads scale.width/height
    // live so the lightbox is always correctly sized for the EXPAND-mode canvas.
  }

  get isOpen(): boolean {
    return this.opened;
  }

  open(photos: LightboxPhoto[], startIndex = 0): void {
    if (!photos.length) return;
    this.photos = photos;
    this.index = Phaser.Math.Clamp(startIndex, 0, photos.length - 1);
    this.opened = true;

    this.escKey = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.leftKey = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.rightKey = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);

    this.render();
  }

  close(): void {
    if (!this.opened) return;
    this.opened = false;
    // Only remove ESC — it's unique to the lightbox.
    // LEFT and RIGHT are the SAME Key objects that Player.createCursorKeys()
    // already registered in the scene.  Calling removeKey() on them calls
    // key.destroy() under the hood, which silently kills player horizontal
    // movement for the rest of the scene.  Just null the refs so we stop
    // polling them; the keyboard manager keeps the keys alive for the player.
    this.escKey && this.scene.input.keyboard?.removeKey(this.escKey);
    this.escKey = undefined;
    this.leftKey = undefined;
    this.rightKey = undefined;
    this.teardown();
  }

  /** Call once per frame while `isOpen` is true, e.g. from the host scene's update(). */
  update(): void {
    if (!this.opened) return;
    if (this.escKey && Phaser.Input.Keyboard.JustDown(this.escKey)) {
      this.close();
      return;
    }
    if (this.rightKey && Phaser.Input.Keyboard.JustDown(this.rightKey)) this.next();
    if (this.leftKey && Phaser.Input.Keyboard.JustDown(this.leftKey)) this.prev();
  }

  next(): void {
    this.index = (this.index + 1) % this.photos.length;
    this.render();
  }

  prev(): void {
    this.index = (this.index - 1 + this.photos.length) % this.photos.length;
    this.render();
  }

  private teardown(): void {
    this.objects.forEach((o) => o.active && o.destroy());
    this.objects = [];
  }

  private render(): void {
    this.teardown();
    // Always use the LIVE canvas dimensions rather than the design constants
    // (1280 × 720) stored in this.viewW/viewH — in Phaser.Scale.EXPAND mode
    // the canvas equals the actual browser viewport, so hard-coding 640/360
    // as the centre puts every hit-area in the wrong place and leaves the
    // right portion of the screen uncovered (showing the hub behind).
    const VIEW_W = this.scene.scale.width;
    const VIEW_H = this.scene.scale.height;
    const photo = this.photos[this.index];
    const cx = VIEW_W / 2;
    const cy = VIEW_H / 2;

    const scrim = this.scene.add.rectangle(cx, cy, VIEW_W, VIEW_H, 0x03020a, 0.9)
      .setDepth(2100).setScrollFactor(0).setInteractive();
    scrim.on('pointerdown', () => this.close());
    this.objects.push(scrim);

    let natW = 800;
    let natH = 1000;
    if (this.scene.textures.exists(photo.key)) {
      const src = this.scene.textures.get(photo.key).getSourceImage() as HTMLImageElement;
      if (src?.naturalWidth) {
        natW = src.naturalWidth;
        natH = src.naturalHeight;
      }
    }
    const maxW = VIEW_W * 0.56;
    const maxH = VIEW_H * 0.78;
    const scale = Math.min(maxW / natW, maxH / natH);
    const dispW = natW * scale;
    const dispH = natH * scale;

    const frame = this.scene.add.graphics().setDepth(2101).setScrollFactor(0);
    frame.lineStyle(3, 0xc9a8ff, 0.7);
    frame.strokeRect(cx - dispW / 2 - 4, cy - dispH / 2 - 4, dispW + 8, dispH + 8);
    frame.lineStyle(1, 0xffffff, 0.12);
    frame.strokeRect(cx - dispW / 2 + 1, cy - dispH / 2 + 1, dispW - 2, dispH - 2);
    this.objects.push(frame);

    const img = this.scene.add.image(cx, cy, photo.key)
      .setDisplaySize(dispW, dispH)
      .setDepth(2100.5).setScrollFactor(0).setAlpha(0);
    this.scene.tweens.add({ targets: img, alpha: 1, duration: 260, ease: 'Sine.easeOut' });
    this.objects.push(img);

    const captionBg = this.scene.add.rectangle(cx, cy + dispH / 2 + 34, Math.min(VIEW_W - 200, dispW + 160), 44, 0x14101c, 0.85)
      .setDepth(2102).setScrollFactor(0);
    captionBg.setStrokeStyle(1, 0xc9a8ff, 0.4);
    this.objects.push(captionBg);
    const captionTxt = this.scene.add.text(cx, cy + dispH / 2 + 34, photo.caption, {
      fontFamily: Fonts.title, fontSize: '18px', color: '#f5ecd8',
    }).setOrigin(0.5).setDepth(2103).setScrollFactor(0);
    this.objects.push(captionTxt);

    const counter = this.scene.add.text(cx, cy - dispH / 2 - 26, `${this.index + 1} / ${this.photos.length}`, {
      fontFamily: Fonts.ui, fontSize: '14px', color: '#8a8a9c',
    }).setOrigin(0.5).setDepth(2103).setScrollFactor(0);
    this.objects.push(counter);

    const closeCx = cx + dispW / 2 + 20;
    const closeCy = cy - dispH / 2 - 20;
    const closeBg = this.scene.add.circle(closeCx, closeCy, 18, 0x1a1424, 0.95)
      .setDepth(2104).setScrollFactor(0).setInteractive({ useHandCursor: true });
    closeBg.setStrokeStyle(2, 0xc9a8ff, 0.85);
    closeBg.on('pointerdown', () => this.close());
    closeBg.on('pointerover', () => closeBg.setFillStyle(0xc9a8ff, 0.28));
    closeBg.on('pointerout', () => closeBg.setFillStyle(0x1a1424, 0.95));
    this.objects.push(closeBg);
    const closeIcon = this.scene.add.text(closeCx, closeCy, '✕', {
      fontFamily: Fonts.ui, fontSize: '15px', color: '#f0e6ff',
    }).setOrigin(0.5).setDepth(2105).setScrollFactor(0);
    this.objects.push(closeIcon);

    if (this.photos.length > 1) {
      const arrow = (dx: number, onClick: () => void) => {
        const ax = cx + dx * (dispW / 2 + 46);
        const bg = this.scene.add.circle(ax, cy, 20, 0x1a1424, 0.85)
          .setDepth(2104).setScrollFactor(0).setInteractive({ useHandCursor: true });
        bg.setStrokeStyle(1.5, 0xc9a8ff, 0.5);
        bg.on('pointerdown', onClick);
        bg.on('pointerover', () => bg.setFillStyle(0xc9a8ff, 0.24));
        bg.on('pointerout', () => bg.setFillStyle(0x1a1424, 0.85));
        this.objects.push(bg);
        const arrowTxt = this.scene.add.text(ax, cy, dx < 0 ? '‹' : '›', {
          fontFamily: Fonts.ui, fontSize: '22px', color: '#f0e6ff',
        }).setOrigin(0.5).setDepth(2105).setScrollFactor(0);
        this.objects.push(arrowTxt);
      };
      arrow(-1, () => this.prev());
      arrow(1, () => this.next());
    }

    const hint = this.scene.add.text(cx, VIEW_H - 34, '←/→ browse   Esc or click outside to close', {
      fontFamily: Fonts.ui, fontSize: '13px', color: '#8a8a9c',
    }).setOrigin(0.5).setDepth(2103).setScrollFactor(0).setAlpha(0);
    this.scene.tweens.add({ targets: hint, alpha: 0.8, duration: 340, delay: 200 });
    this.objects.push(hint);
  }
}
