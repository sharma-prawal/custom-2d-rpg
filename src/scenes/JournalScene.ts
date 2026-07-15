import Phaser from 'phaser';
import { MINI_GAMES, MiniGameConfig } from '../data/miniGames';
import { AudioManager } from '../systems/AudioManager';
import { SaveState } from '../systems/SaveState';
import { addCinematicVignette, addSceneGrain, Fonts, setActiveMemoryTheme } from '../systems/VisualTheme';
import { sharpVariantKey } from '../systems/ImageFit';

const VIEW_W = 1280;
const VIEW_H = 720;

// Journal book boundaries (book image = 900×560, centred at 640,370)
const BOOK_L = 190;
const BOOK_T = 90;
const BOOK_B = 650;
const BOOK_MID_X = 640; // spine x

interface JournalStartData {
  memoryIndex?: number;
  mode?: 'update' | 'browse';
}

export class JournalScene extends Phaser.Scene {
  private pageIndex = 0;
  private mode: 'update' | 'browse' = 'browse';
  private pageObjects: Phaser.GameObjects.GameObject[] = [];
  private controls: Phaser.GameObjects.GameObject[] = [];
  private progressObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Journal');
  }

  create(data: JournalStartData): void {
    this.mode = data.mode ?? 'browse';
    this.controls = [];
    this.progressObjects = [];
    this.pageObjects = [];

    const save = SaveState.get();
    const unlockedPages = save.journalPages; // array of completed memory IDs

    // In browse mode: open to the last unlocked page, or page 0 if none unlocked.
    // In update mode: open to the specific memory being updated.
    if (this.mode === 'update' && data.memoryIndex) {
      // Clamp to the specific memory's index (0-based)
      this.pageIndex = Math.max(0, data.memoryIndex - 1);
    } else {
      // Browse mode — start on the latest unlocked page
      this.pageIndex = unlockedPages.length > 0 ? unlockedPages.length - 1 : 0;
    }

    setActiveMemoryTheme(this.pageIndex + 1);

    // Dark overlay background
    this.add.rectangle(
      VIEW_W / 2, VIEW_H / 2,
      Math.max(VIEW_W, this.scale.gameSize.width),
      Math.max(VIEW_H, this.scale.gameSize.height),
      0x090911, 0.92
    );
    addCinematicVignette(this, VIEW_W, VIEW_H, 0.36, 2);
    addSceneGrain(this, VIEW_W, VIEW_H, 3);

    const book = this.add.image(VIEW_W / 2, VIEW_H / 2 + 10, 'memory-journal-bg-clean').setDepth(5).setAlpha(0);
    book.setScale(0.94, 0.9);
    this.tweens.add({ targets: book, alpha: 0.96, scaleX: 1, scaleY: 1, duration: 420, ease: 'Sine.easeOut' });

    this.addControls(unlockedPages);
    this.renderPage(this.mode === 'update');
    this.cameras.main.fadeIn(260, 0, 0, 0);
  }

  private renderPage(animated = false): void {
    this.pageObjects.forEach((obj) => obj.destroy());
    this.pageObjects = [];

    const save = SaveState.get();
    const config = MINI_GAMES[this.pageIndex];
    setActiveMemoryTheme(config.id);
    const unlocked = save.journalPages.includes(config.id);
    this.drawProgress(save.journalPages.length);

    if (!unlocked) {
      this.renderLockedPage(config);
      return;
    }

    const leftX = 282;
    const rightX = 800;

    const chapter = this.add.text(leftX, 150, `Chapter ${config.id}`, {
      fontFamily: Fonts.ui,
      fontSize: '16px',
      color: '#4e4238',
    }).setDepth(12).setAlpha(animated ? 0 : 1);

    const titleText = this.cleanText(config.journal.title);
    const titleFontSize = titleText.length > 22 ? '22px' : '26px';
    const title = this.add.text(leftX, 168, '', {
      fontFamily: Fonts.title,
      fontSize: titleFontSize,
      color: '#2b2320',
      wordWrap: { width: 292 },
      maxLines: 2,
    }).setDepth(12).setAlpha(animated ? 0 : 1);

    const photoGroup = this.drawPhotoMount(config, animated);
    const rightPageCenterX = rightX + 48;

    const entry = this.add.text(rightPageCenterX, 150, animated ? '' : this.cleanText(config.journal.entry), {
      fontFamily: '"Bradley Hand", "Snell Roundhand", cursive',
      fontSize: '16px',
      color: '#3b2a20',
      align: 'center',
      wordWrap: { width: 322 },
      lineSpacing: 3,
      maxLines: 4,
    }).setOrigin(0.5, 0).setDepth(16).setAlpha(animated ? 0 : 1);
    this.addScrapbookDetails(leftX, 390);

    const artifact = this.drawArtifact(config, animated);
    const recovered = this.add.text(BOOK_MID_X, 572, 'Recovered', {
      fontFamily: Fonts.ui,
      fontSize: '16px',
      color: '#4f3a28',
      align: 'center',
      stroke: '#e7c58f',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(16).setAlpha(animated ? 0 : 1);

    const checkmark = this.drawCheckmark(BOOK_MID_X, 548, setActiveMemoryTheme(config.id).journalAccent);
    checkmark.setAlpha(animated ? 0 : 1);

    this.pageObjects.push(chapter, title, entry, recovered, checkmark, ...photoGroup, ...artifact);

    // Completing a mini-game is otherwise a one-time thing — once a chapter
    // is unlocked here, its puzzle is guaranteed already solved (journalPages
    // only gets a chapter after markMiniGameCompleted), so there's no path
    // back to it without this. Browse mode only: mid-reveal ('update' mode,
    // right after just finishing it) isn't the moment to offer replaying it.
    if (this.mode !== 'update') {
      this.pageObjects.push(...this.addReplayButton(rightPageCenterX, 510, config.id));
    }

    if (animated) {
      this.playUpdateSequence(chapter, title, config, photoGroup, entry, artifact, recovered, checkmark);
    } else {
      title.setText(this.cleanText(config.journal.title));
    }
  }

  private drawCheckmark(x: number, y: number, color: number): Phaser.GameObjects.Graphics {
    const graphics = this.add.graphics({ x, y }).setDepth(17);
    graphics.lineStyle(3, color, 1);
    graphics.beginPath();
    graphics.moveTo(-9, 0);
    graphics.lineTo(-3, 6);
    graphics.lineTo(9, -8);
    graphics.strokePath();
    return graphics;
  }

  private renderLockedPage(config: MiniGameConfig): void {
    // Draw a soft-padded area on the left page that naturally blends with the
    // parchment — no hard rectangle borders, just a subtle wash.
    const leftPageCoverX = BOOK_MID_X / 2 + BOOK_L / 2; // ~415
    const leftPageCoverY = (BOOK_T + BOOK_B) / 2; // ~370

    // Feathered parchment overlay to hide baked-in book art template lines
    const wash = this.add.graphics().setDepth(10);
    wash.fillStyle(0xc8b898, 0.88);
    wash.fillRoundedRect(BOOK_L + 8, BOOK_T + 60, BOOK_MID_X - BOOK_L - 16, BOOK_B - BOOK_T - 100, 6);

    // Horizontal rulings to look like a blank journal page
    wash.lineStyle(1, 0x9a8a72, 0.22);
    for (let lineY = BOOK_T + 160; lineY < BOOK_B - 80; lineY += 26) {
      wash.lineBetween(BOOK_L + 28, lineY, BOOK_MID_X - 18, lineY);
    }

    // Chapter number — small, top-left of left page
    const chTitle = this.add.text(BOOK_L + 28, BOOK_T + 72, `Chapter ${config.id}`, {
      fontFamily: Fonts.title,
      fontSize: '20px',
      color: '#4b3c33',
    }).setDepth(13);

    // Subtle "not yet" message in handwriting style
    const msg = this.add.text(BOOK_L + 28, BOOK_T + 108, 'This chapter\nis still unwritten…', {
      fontFamily: '"Bradley Hand", "Snell Roundhand", cursive',
      fontSize: '22px',
      color: '#6e5e54',
      lineSpacing: 6,
    }).setDepth(13).setAlpha(0.72);

    // Right page: faint question mark
    const questionMark = this.add.text(BOOK_MID_X + 130, VIEW_H / 2 - 30, '?', {
      fontFamily: Fonts.title,
      fontSize: '72px',
      color: '#8b7a6b',
    }).setDepth(13).setAlpha(0.18);

    void leftPageCoverX;
    void leftPageCoverY;

    this.pageObjects.push(wash, chTitle, msg, questionMark);
  }

  private drawPhotoMount(config: MiniGameConfig, animated: boolean): Phaser.GameObjects.GameObject[] {
    const theme = setActiveMemoryTheme(config.id);
    const x = 410;
    const y = 392;
    const objects: Phaser.GameObjects.GameObject[] = [];
    const hasPhoto = this.hasRealImage(config.journal.image) && this.textures.exists(config.journal.image);

    // The book art has a large sample polaroid baked into the page. Keep the
    // real portrait mount smaller and inside the left page so it reads as an
    // intentional scrapbook layer rather than a sheet spilling out of the book.
    const angle = -2.4;
    const matW = 238;
    const matH = 304;
    const photoW = 190;
    const photoH = 242;
    const shadow = this.add.rectangle(x + 8, y + 10, matW, matH, 0x2d1b12, 0.18).setDepth(11).setAngle(angle);
    const mat = this.add.rectangle(x, y, matW, matH, 0xf6ead3, 0.98).setDepth(12).setAngle(angle);
    mat.setStrokeStyle(1.5, 0x8f6a43, 0.32);
    const innerPlate = this.add.rectangle(x, y - 14, photoW + 16, photoH + 16, 0xfff7e8, 0.86).setDepth(13).setAngle(angle);
    innerPlate.setStrokeStyle(1, 0xc09760, 0.25);
    objects.push(shadow, mat, innerPlate);

    if (!hasPhoto) {
      const pendingLabel = this.add.text(x, y - 14, 'a photo will\nfind its place here', {
        fontFamily: '"Bradley Hand", "Snell Roundhand", cursive',
        fontSize: '15px',
        color: '#8a7860',
        align: 'center',
        lineSpacing: 4,
      }).setOrigin(0.5).setDepth(14).setAlpha(0.65).setAngle(angle);
      objects.push(pendingLabel);
    }
    if (hasPhoto) {
      // Sharpen first. These show far below native size and otherwise become
      // soft in the journal. Keep the real phone-photo portrait shape instead
      // of forcing it into the old landscape mockup.
      const photoKey = sharpVariantKey(this, config.journal.image, 380);
      const srcImg = this.textures.get(photoKey).getSourceImage() as HTMLImageElement;
      const natW = srcImg?.width || photoW;
      const natH = srcImg?.height || photoH;
      const coverScale = Math.max(photoW / natW, photoH / natH);

      const photo = this.add.image(x, y - 14, photoKey).setDepth(14).setAngle(angle);
      photo.setDisplaySize(natW * coverScale, natH * coverScale);

      const photoMask = this.add.graphics().setVisible(false);
      photoMask.fillStyle(0xffffff, 1);
      photoMask.fillRect(-photoW / 2, -photoH / 2, photoW, photoH);
      photoMask.setPosition(x, y - 14).setAngle(angle);
      photo.setMask(photoMask.createGeometryMask());

      objects.push(photo, photoMask);

      // Tape only appears when it is visibly holding a real photo.
      objects.push(...this.addTapeStrip(x - 84, y - 154, 62, -8));
      objects.push(...this.addTapeStrip(x + 82, y - 154, 60, 8));
      objects.push(...this.addTapeStrip(x, y + 139, 48, 1));
    }
    const seal = this.add.circle(x + 82, y + 122, 8, theme.journalAccent, 0.4).setDepth(16);
    objects.push(seal);
    if (animated) objects.forEach((obj) => this.setObjectAlpha(obj, 0));
    return objects;
  }

  /** A washi-tape strip: soft drop shadow + tinted paper + a thin highlight sheen, angled together. */
  private addTapeStrip(x: number, y: number, width: number, angle: number): Phaser.GameObjects.GameObject[] {
    const shadow = this.add.rectangle(x + 1.5, y + 2, width, 18, 0x000000, 0.12).setDepth(15).setAngle(angle);
    const strip = this.add.rectangle(x, y, width, 18, 0xf3e9d2, 0.5).setDepth(16).setAngle(angle);
    strip.setStrokeStyle(1, 0xfffbe8, 0.32);
    const sheen = this.add.rectangle(x, y - 4, width * 0.68, 4, 0xffffff, 0.16).setDepth(16).setAngle(angle);
    return [shadow, strip, sheen];
  }

  private drawArtifact(config: MiniGameConfig, animated: boolean): Phaser.GameObjects.GameObject[] {
    const theme = setActiveMemoryTheme(config.id);
    const objects: Phaser.GameObjects.GameObject[] = [];
    const x = 848;
    const panel = this.add.rectangle(x, 344, 278, 210, 0xf4dfb8, 0.04).setDepth(12);
    const label = this.add.text(x, 260, 'Memory Artifact', {
      fontFamily: Fonts.ui,
      fontSize: '17px',
      color: Phaser.Display.Color.IntegerToColor(theme.secondary).rgba,
    }).setOrigin(0.5).setDepth(13);
    const keepsake = this.add.image(x, 314, config.journal.keepsake).setDepth(14).setDisplaySize(82, 82);
    const flower = this.add.ellipse(x - 76, 410, 26, 68, theme.journalAccent, 0.1).setDepth(13).setAngle(-26);
    const name = this.add.text(x, 384, this.cleanText(config.journal.artifactTitle ?? 'Memory Keepsake'), {
      fontFamily: Fonts.title,
      fontSize: '22px',
      color: '#2b2320',
      align: 'center',
      wordWrap: { width: 240 },
    }).setOrigin(0.5).setDepth(14);
    const caption = this.add.text(x, 426, `"${this.cleanText(config.journal.artifactCaption ?? config.journal.entry)}"`, {
      fontFamily: '"Bradley Hand", "Snell Roundhand", cursive',
      fontSize: '15px',
      color: '#4b3224',
      align: 'center',
      wordWrap: { width: 248 },
      maxLines: 2,
    }).setOrigin(0.5, 0).setDepth(14);
    objects.push(panel, label, keepsake, flower, name, caption);
    if (animated) objects.forEach((obj) => this.setObjectAlpha(obj, 0));
    return objects;
  }

  private addReplayButton(x: number, y: number, memoryIndex: number): Phaser.GameObjects.GameObject[] {
    const width = 182;
    const height = 34;
    const shadow = this.add.rectangle(x + 3, y + 4, width, height, 0x28170e, 0.18).setDepth(17);
    const bg = this.add.graphics().setDepth(18);
    const drawBg = (fillAlpha: number, borderAlpha: number): void => {
      bg.clear();
      bg.fillStyle(0xf4dfb8, fillAlpha);
      bg.fillRoundedRect(x - width / 2, y - height / 2, width, height, 5);
      bg.lineStyle(1.5, 0x7a5434, borderAlpha);
      bg.strokeRoundedRect(x - width / 2, y - height / 2, width, height, 5);
      bg.lineStyle(1, 0xfff0cf, 0.34);
      bg.lineBetween(x - width / 2 + 12, y - height / 2 + 5, x + width / 2 - 12, y - height / 2 + 5);
    };
    drawBg(0.68, 0.72);
    const label = this.add.text(x, y, '↻  Replay Puzzle', {
      fontFamily: Fonts.ui,
      fontSize: '14px',
      color: '#3f2d1c',
      stroke: '#f7e8c7',
      strokeThickness: 1,
    }).setOrigin(0.5).setDepth(19);
    const zone = this.add.rectangle(x, y, width, height, 0xffffff, 0)
      .setDepth(20)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerover', () => {
      drawBg(0.86, 0.9);
      label.setColor('#24160e');
    });
    zone.on('pointerout', () => {
      drawBg(0.68, 0.72);
      label.setColor('#3f2d1c');
    });
    zone.on('pointerdown', () => {
      AudioManager.playSfx(this, 'sfx-page-turn');
      this.scene.start('MiniGame', { memoryIndex });
    });

    return [shadow, bg, label, zone];
  }

  private addScrapbookDetails(x: number, y: number): void {
    const clip = this.add.rectangle(x + 306, y - 260, 14, 52, 0x6b5b52, 0.34).setDepth(15).setAngle(10);
    this.pageObjects.push(clip);
  }

  private drawProgress(count: number): void {
    const theme = setActiveMemoryTheme(this.pageIndex + 1);
    this.progressObjects.forEach((obj) => obj.destroy());
    this.progressObjects = [];

    // Progress dots — bottom-centre, BELOW the book in the dark margin
    const dotRowY = VIEW_H - 18; // ~702
    const dotRowCentreX = VIEW_W / 2; // 640

    const label = this.add.text(dotRowCentreX, dotRowY - 14, `${count} / 7`, {
      fontFamily: Fonts.ui,
      fontSize: '12px',
      color: '#8b6240',
    }).setOrigin(0.5).setDepth(30);

    this.progressObjects.push(label);

    const totalDots = MINI_GAMES.length;
    const spacing = 14;
    const startX = dotRowCentreX - ((totalDots - 1) * spacing) / 2;
    for (let i = 0; i < totalDots; i++) {
      const filled = i < count;
      const dot = this.add
        .circle(startX + i * spacing, dotRowY, 3.5, filled ? theme.journalAccent : theme.shadow, filled ? 0.9 : 0.28)
        .setDepth(30);
      dot.setStrokeStyle(1, theme.border, filled ? 0.8 : 0.2);
      this.progressObjects.push(dot);
    }
  }

  private addControls(unlockedPages: number[]): void {
    const hasAny = unlockedPages.length > 0;

    // ─── Close button — top-right dark margin, outside the book ──────────
    this.addCloseButton();

    if (this.mode !== 'update') {
      // ─── Prev / Next — bottom dark margin, outside the book ─────────────
      // Left: bottom-left corner outside book   Right: bottom-right corner
      const prevBtn = this.addNavButton(110, VIEW_H - 36, '◀  Previous', () => this.turn(-1));
      const nextBtn = this.addNavButton(VIEW_W - 110, VIEW_H - 36, 'Next  ▶', () => this.turn(1));

      // Dim prev if on first page
      if (this.pageIndex === 0) {
        prevBtn.forEach((o) => (o as { setAlpha?: (a: number) => void }).setAlpha?.(0.28));
      }
      // Dim next if on last unlocked page
      if (!hasAny || this.pageIndex >= unlockedPages.length - 1) {
        nextBtn.forEach((o) => (o as { setAlpha?: (a: number) => void }).setAlpha?.(0.28));
      }

      // Keyboard shortcuts
      const left = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
      const right = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
      left.on('down', () => this.turn(-1));
      right.on('down', () => this.turn(1));
    }
  }

  private addCloseButton(): void {
    // Top-right dark margin, clearly outside the book frame
    const x = VIEW_W - 58;  // 1222
    const y = 32;
    const bg = this.add.rectangle(x, y, 96, 34, 0x1a0e08, 0.82).setDepth(35);
    bg.setStrokeStyle(1, 0xd4a96a, 0.56);
    const text = this.add.text(x, y, 'Close ✕', {
      fontFamily: Fonts.ui,
      fontSize: '15px',
      color: '#ffd9a0',
    }).setOrigin(0.5).setDepth(36);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => { bg.setFillStyle(0x7a5438, 0.96); });
    bg.on('pointerout', () => { bg.setFillStyle(0x1a0e08, 0.82); });
    bg.on('pointerdown', () => this.close());
    this.controls.push(bg, text);
  }

  private addNavButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.GameObject[] {
    const bg = this.add.rectangle(x, y, 136, 34, 0x1a0e08, 0.78).setDepth(31);
    bg.setStrokeStyle(1, 0xd4a96a, 0.44);
    const text = this.add.text(x, y, label, {
      fontFamily: Fonts.ui,
      fontSize: '15px',
      color: '#ffd9a0',
    }).setOrigin(0.5).setDepth(32).setInteractive({ useHandCursor: true });
    text.on('pointerover', () => { bg.setFillStyle(0x7a5438, 0.92); text.setColor('#fff5dc'); });
    text.on('pointerout', () => { bg.setFillStyle(0x1a0e08, 0.78); text.setColor('#ffd9a0'); });
    text.on('pointerdown', onClick);
    this.controls.push(bg, text);
    return [bg, text];
  }

  private playUpdateSequence(
    chapter: Phaser.GameObjects.Text,
    title: Phaser.GameObjects.Text,
    config: MiniGameConfig,
    photoGroup: Phaser.GameObjects.GameObject[],
    entry: Phaser.GameObjects.Text,
    artifact: Phaser.GameObjects.GameObject[],
    recovered: Phaser.GameObjects.Text,
    checkmark: Phaser.GameObjects.Graphics,
  ): void {
    AudioManager.playSfx(this, 'sfx-page-turn');
    this.tweens.add({ targets: chapter, alpha: 1, duration: 240, delay: 240 });
    this.time.delayedCall(560, () => this.writeText(title, this.cleanText(config.journal.title), 34));
    this.time.delayedCall(980, () => {
      photoGroup.forEach((obj) => {
        this.nudgeObjectY(obj, -8);
        this.tweens.add({
          targets: obj,
          alpha: obj instanceof Phaser.GameObjects.Text ? 0.42 : 1,
          y: '+=8',
          duration: 360,
          ease: 'Back.easeOut',
        });
      });
      AudioManager.playSfx(this, 'sfx-page-turn');
    });
    this.time.delayedCall(1420, () => {
      entry.setAlpha(1);
      this.writeText(entry, this.cleanText(config.journal.entry), 24);
    });
    this.time.delayedCall(2140, () => {
      artifact.forEach((obj, index) => {
        this.nudgeObjectY(obj, -10);
        this.tweens.add({
          targets: obj,
          alpha: 1,
          y: '+=10',
          duration: 420,
          delay: index * 35,
          ease: 'Back.easeOut',
        });
      });
      this.emitJournalSparkle(848, 314);
    });
    this.time.delayedCall(2760, () => this.tweens.add({ targets: [recovered, checkmark], alpha: 1, duration: 360 }));
    this.time.delayedCall(4300, () => this.close());
  }

  private writeText(target: Phaser.GameObjects.Text, text: string, delay: number): void {
    target.setAlpha(1).setText('');
    let i = 0;
    this.time.addEvent({
      delay,
      repeat: Math.max(0, text.length - 1),
      callback: () => {
        i++;
        target.setText(text.slice(0, i));
      },
    });
  }

  private nudgeObjectY(obj: Phaser.GameObjects.GameObject, delta: number): void {
    const movable = obj as Phaser.GameObjects.GameObject & { y?: number };
    if (typeof movable.y === 'number') movable.y += delta;
  }

  private emitJournalSparkle(x: number, y: number): void {
    const theme = setActiveMemoryTheme(this.pageIndex + 1);
    for (let i = 0; i < 12; i++) {
      const sparkle = this.add
        .star(x + Phaser.Math.Between(-48, 48), y + Phaser.Math.Between(-36, 36), 4, 2, 7, theme.particleColor, 0.58)
        .setDepth(40);
      this.tweens.add({ targets: sparkle, scale: 1.8, alpha: 0, duration: 640, delay: i * 28, onComplete: () => sparkle.destroy() });
    }
  }

  private turn(delta: number): void {
    if (this.mode === 'update') return;

    const save = SaveState.get();
    const nextIndex = this.pageIndex + delta;

    // Clamp: can never go below 0, and can never go past the last unlocked page
    const maxIndex = Math.max(0, save.journalPages.length - 1);
    if (nextIndex < 0 || nextIndex > maxIndex) return;

    AudioManager.playSfx(this, 'sfx-page-turn');
    this.pageIndex = nextIndex;

    // Rebuild controls with updated dim state
    this.controls.forEach((obj) => obj.destroy());
    this.controls = [];
    this.addControls(save.journalPages);

    this.renderPage(false);
  }

  private close(): void {
    this.cameras.main.fadeOut(260, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      // Return to hub, passing the memory index that was being viewed so the
      // hub can place the player near the right portal.
      const fromIndex = this.pageIndex + 1;
      this.scene.start('Hub', { fromIndex });
    });
  }

  private hasRealImage(value: string): boolean {
    return Boolean(value && !value.includes('{{') && !value.includes('}}'));
  }

  private cleanText(value: string): string {
    return value?.includes('{{') ? '' : value;
  }

  private setObjectAlpha(obj: Phaser.GameObjects.GameObject, alpha: number): void {
    const alphaObject = obj as Phaser.GameObjects.GameObject & { setAlpha?: (value: number) => Phaser.GameObjects.GameObject };
    alphaObject.setAlpha?.(alpha);
  }
}
