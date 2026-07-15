import Phaser from 'phaser';
import { LETTER, LETTER_TITLE } from '../data/letter';
import { Player } from '../entities/Player';
import { NPC } from '../entities/NPC';
import { InteractionPrompt } from '../systems/InteractionPrompt';
import { SceneFade } from '../systems/SceneFade';
import { SaveState } from '../systems/SaveState';
import { AudioManager } from '../systems/AudioManager';
import { addAudioHud } from '../systems/AudioHud';
import { addMobileControls, consumeMobileAction } from '../systems/MobileControls';
import { fitViewportCover } from '../systems/ImageFit';
import { InteractionMarker } from '../systems/InteractionMarker';
import { addCinematicVignette, addSceneGrain, addToast, Fonts, gradeCharacter } from '../systems/VisualTheme';

const VIEW_W = 1280;
const VIEW_H = 720;
// Aligned with the bench already painted into garden-bg (under the tree,
// left of center) — a separate bench sprite there used to read as a second,
// disconnected piece of furniture floating next to the real one.
const BENCH_X = 330;
const BENCH_Y = 470;

export class LetterScene extends Phaser.Scene {
  private player!: Player;
  private prompt!: InteractionPrompt;
  private interactKeys!: Phaser.Input.Keyboard.Key[];
  private letterOpen = false;
  private letterFinished = false;
  private pages: string[] = [];
  private pageIndex = 0;
  private letterContainer?: Phaser.GameObjects.Container;
  private letterText?: Phaser.GameObjects.Text;
  private charIndex = 0;
  private currentPage = '';
  private typeTimer?: Phaser.Time.TimerEvent;
  private hintText?: Phaser.GameObjects.Container;
  private consumedPointerTime = 0;

  constructor() {
    super('Letter');
  }

  create(): void {
    this.letterOpen = false;
    this.letterFinished = false;
    this.pageIndex = 0;

    this.physics.world.setBounds(0, 0, VIEW_W, VIEW_H);
    fitViewportCover(this, this.add.image(VIEW_W / 2, VIEW_H / 2, 'garden-bg').setDepth(0), VIEW_W, VIEW_H);
    SceneFade.addAmbientTint(this, VIEW_W, VIEW_H, 0xffb488, 0.07);
    addCinematicVignette(this, VIEW_W, VIEW_H, 0.12, 2);
    addSceneGrain(this, VIEW_W, VIEW_H, 3);

    this.spawnPetals();

    const npc = new NPC(this, BENCH_X + 90, BENCH_Y - 10, 'char-him-warm-layered', true);
    this.player = new Player(this, 900, 560, 'char-her-warm-layered');
    gradeCharacter(npc.sprite, 0xffb488, 0.98);
    gradeCharacter(this.player.sprite, 0xffb488, 0.98);
    new InteractionMarker(this, BENCH_X, BENCH_Y - 30);

    this.prompt = new InteractionPrompt(this);
    addMobileControls(this);
    this.interactKeys = [
      this.input.keyboard!.addKey('E'),
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
    ];

    this.hintText = addToast(this, VIEW_W / 2, 58, 'walk to the bench');

    AudioManager.playMusic(this, 'music-letter');
    addAudioHud(this, VIEW_W);
    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  update(): void {
    if (this.letterOpen) {
      if (this.interactJustDown()) this.advancePage();
      return;
    }

    this.player.update();

    const dist = Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, BENCH_X, BENCH_Y);
    if (dist < 80 && !this.letterFinished) {
      this.prompt.showAt(BENCH_X, BENCH_Y - 70);
      if (this.interactJustDown()) this.openLetter();
    } else {
      this.prompt.hide();
    }
  }

  private interactJustDown(): boolean {
    const pointer = this.input.activePointer;
    const pointerDown =
      pointer.isDown &&
      pointer.downTime >= this.time.now - 48 &&
      pointer.downTime !== this.consumedPointerTime;
    if (
      this.interactKeys.some((k) => Phaser.Input.Keyboard.JustDown(k)) ||
      consumeMobileAction(this) ||
      pointerDown
    ) {
      if (pointerDown) {
        this.consumedPointerTime = pointer.downTime;
      }
      return true;
    }
    return false;
  }

  private spawnPetals(): void {
    // Draw a soft petal shape (small rotated ellipse) procedurally
    if (!this.textures.exists('vfx-petal')) {
      const g = this.add.graphics();
      // Ellipse petal: wider than tall, soft warm gold
      g.fillStyle(0xffc8a0, 1);
      g.fillEllipse(6, 4, 12, 8);
      g.fillStyle(0xffd9b0, 0.7);
      g.fillEllipse(6, 3.5, 8, 5);
      g.generateTexture('vfx-petal', 12, 8);
      g.destroy();
    }

    const PETAL_COUNT = 18;
    for (let i = 0; i < PETAL_COUNT; i++) {
      const x = Phaser.Math.Between(0, VIEW_W);
      const startY = Phaser.Math.Between(-VIEW_H, 0);
      const alpha = Phaser.Math.FloatBetween(0.36, 0.88);
      const scale = Phaser.Math.FloatBetween(0.7, 1.4);
      const duration = Phaser.Math.Between(7000, 13000);
      const drift = Phaser.Math.Between(-120, 120);
      const startAngle = Phaser.Math.FloatBetween(0, Math.PI * 2);

      const petal = this.add
        .image(x, startY, 'vfx-petal')
        .setDepth(3)
        .setAlpha(alpha)
        .setScale(scale)
        .setRotation(startAngle);

      // Gentle fall
      this.tweens.add({
        targets: petal,
        y: VIEW_H + 40,
        x: x + drift,
        duration,
        repeat: -1,
        delay: Phaser.Math.Between(0, 5000),
        ease: 'Sine.easeInOut',
        onRepeat: () => {
          petal.y = -20;
          petal.x = Phaser.Math.Between(0, VIEW_W);
        },
      });

      // Slow rotation — each petal spins at its own rate
      this.tweens.add({
        targets: petal,
        rotation: startAngle + Phaser.Math.FloatBetween(-Math.PI * 1.5, Math.PI * 1.5),
        duration: Phaser.Math.Between(4000, 9000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Phaser.Math.Between(0, 2000),
      });

      // Gentle alpha sway for depth illusion
      this.tweens.add({
        targets: petal,
        alpha: alpha * 0.45,
        duration: Phaser.Math.Between(2200, 4000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Phaser.Math.Between(0, 1500),
      });
    }
  }

  private openLetter(): void {
    AudioManager.playSfx(this, 'sfx-page-turn');
    this.letterOpen = true;
    this.prompt.hide();
    this.hintText?.setVisible(false);
    this.pages = [LETTER_TITLE, ...LETTER];
    this.pageIndex = 0;

    const paperW = 1110;
    const paperH = 650;
    const paperX = VIEW_W / 2;
    const paperY = VIEW_H / 2 + 10;
    // The painted letter asset has a transparent outer margin and floral
    // detail on the upper-right, so the readable writing area is narrower
    // than the displayed image bounds.
    const textX = paperX - 382;
    const textY = paperY - 214;
    const textWidth = 630;

    const shadow = this.add.rectangle(paperX + 10, paperY + 12, paperW - 56, paperH - 42, 0x000000, 0.22);
    const panel = this.textures.exists('final-letter-paper')
      ? this.add.image(paperX, paperY, 'final-letter-paper').setDisplaySize(paperW, paperH)
      : this.add.rectangle(paperX, paperY, paperW, paperH, 0xf5ecd8, 0.96);
    if (panel instanceof Phaser.GameObjects.Rectangle) {
      panel.setStrokeStyle(3, 0x7a5a3a, 0.35);
    }
    const inner = this.add.rectangle(paperX, paperY, paperW - 154, paperH - 132, 0xfff4dc, 0.05);
    inner.setStrokeStyle(1, 0x8f6a43, 0.08);

    this.letterText = this.add.text(textX, textY, '', {
      fontFamily: Fonts.body,
      fontSize: '23px',
      color: '#2a211d',
      wordWrap: { width: textWidth },
      lineSpacing: 10,
    });
    this.letterText.setShadow(0, 1, '#f7dfb3', 1, false, true);

    const hint = this.add
      .text(paperX + paperW / 2 - 92, paperY + paperH / 2 - 76, '▼', {
        fontFamily: Fonts.ui,
        fontSize: '24px',
        color: '#62452f',
      })
      .setOrigin(1, 1);

    this.letterContainer = this.add.container(0, 0, [shadow, panel, inner, this.letterText, hint]).setDepth(1000);

    // Scale + fade open animation for a premium "letter unfolding" feel
    this.letterContainer.setAlpha(0);
    this.letterContainer.setScale(0.92);
    this.tweens.add({
      targets: this.letterContainer,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 260,
      ease: 'Back.easeOut',
    });

    this.showPage();
  }

  private showPage(): void {
    if (!this.letterText) return;
    this.currentPage = this.pages[this.pageIndex];
    this.charIndex = 0;
    this.letterText.setText('');

    this.typeTimer = this.time.addEvent({
      delay: 24,
      repeat: this.currentPage.length - 1,
      callback: () => {
        this.charIndex++;
        this.letterText?.setText(this.currentPage.slice(0, this.charIndex));
      },
    });
  }

  private advancePage(): void {
    AudioManager.playSfx(this, 'sfx-page-turn');
    if (this.typeTimer && this.charIndex < this.currentPage.length) {
      this.typeTimer.remove();
      this.charIndex = this.currentPage.length;
      this.letterText?.setText(this.currentPage);
      return;
    }

    this.pageIndex++;
    if (this.pageIndex >= this.pages.length) {
      this.closeLetter();
      return;
    }
    this.showPage();
  }

  private closeLetter(): void {
    this.letterContainer?.destroy();
    this.letterOpen = false;
    this.letterFinished = true;
    SaveState.markLetterReached();

    const endPanel = this.add
      .rectangle(VIEW_W / 2, VIEW_H / 2, 760, 180, 0x0b0b12, 0.72)
      .setDepth(999);
    const end = this.add
      .text(VIEW_W / 2, VIEW_H / 2, 'thank you for walking through us\n\nreturn', {
        fontFamily: Fonts.body,
        fontSize: '32px',
        color: '#ffd9a0',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(1000);
    this.tweens.add({ targets: [endPanel, end], alpha: 0.5, duration: 900, yoyo: true, repeat: -1 });

    const finish = () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start('MainMenu');
      });
    };

    this.input.keyboard!.once('keydown-SPACE', finish);
    this.input.keyboard!.once('keydown-ENTER', finish);
    this.input.once('pointerdown', finish);
  }
}
