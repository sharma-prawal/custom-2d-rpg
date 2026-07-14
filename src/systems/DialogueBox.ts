import Phaser from 'phaser';
import { addSoftPanel, Colors, Fonts, getActiveMemoryTheme } from './VisualTheme';
import { wasAudioHudClick } from './AudioHud';

/**
 * A bottom-anchored narration box with a typewriter reveal. Queue lines with
 * `show(lines, onDone)`; advance with keyboard or a click/tap.
 */
export class DialogueBox {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private text: Phaser.GameObjects.Text;
  private continueHint: Phaser.GameObjects.Text;

  private queue: string[] = [];
  private currentLine = '';
  private charIndex = 0;
  private typeTimer?: Phaser.Time.TimerEvent;
  private onComplete?: () => void;
  private active = false;

  /** The resting Y of the container when fully visible. */
  private restY: number;
  /** Y the container slides in from (off-screen below). */
  private offscreenY: number;
  private slideInTween?: Phaser.Tweens.Tween;
  private closeTween?: Phaser.Tweens.Tween;
  private hintPulseTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, viewWidth: number, viewHeight: number) {
    this.scene = scene;

    const boxHeight = 148;
    const boxY = viewHeight - boxHeight / 2 - 28;
    this.restY = 0;
    // Container slides up from this far below its resting position.
    this.offscreenY = boxHeight + 40;
    const theme = getActiveMemoryTheme();

    const panel = addSoftPanel(scene, viewWidth / 2, boxY, viewWidth - 96, boxHeight, 1000, Colors.dark, 0.78);

    this.text = scene.add.text(76, boxY - boxHeight / 2 + 28, '', {
      fontFamily: Fonts.body,
      fontSize: '31px',
      color: theme.textPrimary,
      wordWrap: { width: viewWidth - 152 },
      lineSpacing: 12,
    });

    this.continueHint = scene.add
      .text(viewWidth - 78, boxY + boxHeight / 2 - 38, 'click / enter / esc', {
        fontFamily: Fonts.ui,
        fontSize: '18px',
        color: Phaser.Display.Color.IntegerToColor(theme.accent).rgba,
      })
      .setOrigin(1, 0.5)
      .setAlpha(0);

    this.container = scene.add.container(0, this.offscreenY, [panel, this.text, this.continueHint]);
    this.container.setDepth(1000);
    this.container.setScrollFactor(0);
    this.container.setVisible(false);

    scene.input.on('pointerdown', this.advanceFromPointer, this);
    scene.input.keyboard!.on('keydown-E', this.advanceFromKeyboard, this);
    scene.input.keyboard!.on('keydown-ENTER', this.advanceFromKeyboard, this);
    scene.input.keyboard!.on('keydown-SPACE', this.advanceFromKeyboard, this);
    scene.input.keyboard!.on('keydown-ESC', this.forceClose, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.off('pointerdown', this.advanceFromPointer, this);
      scene.input.keyboard!.off('keydown-E', this.advanceFromKeyboard, this);
      scene.input.keyboard!.off('keydown-ENTER', this.advanceFromKeyboard, this);
      scene.input.keyboard!.off('keydown-SPACE', this.advanceFromKeyboard, this);
      scene.input.keyboard!.off('keydown-ESC', this.forceClose, this);
    });
  }

  get isActive(): boolean {
    return this.active;
  }

  show(lines: string[], onComplete?: () => void): void {
    this.queue = [...lines];
    this.onComplete = onComplete;
    this.active = true;

    // A caller's onComplete can call show() again synchronously (every
    // chapter does this: the last prop's narration closes and immediately
    // opens the closing line) — if the previous close()'s slide-out tween
    // is still in flight, its onComplete fires ~140ms later and force-hides
    // this new dialogue out from under it, leaving it logically active but
    // invisible. Cancel it before it can do that.
    this.closeTween?.remove();

    // Slide up from off-screen
    this.container.setY(this.offscreenY);
    this.container.setVisible(true);
    this.container.setAlpha(0);

    this.slideInTween?.remove();
    this.slideInTween = this.scene.tweens.add({
      targets: this.container,
      y: this.restY,
      alpha: 1,
      duration: 180,
      ease: 'Cubic.easeOut',
    });

    this.advance();
  }

  /** Called on interact-key press; either fast-forwards the current line or advances the queue. */
  advance(): void {
    if (this.typeTimer && this.charIndex < this.currentLine.length) {
      this.typeTimer.remove();
      this.text.setText(this.currentLine);
      this.charIndex = this.currentLine.length;
      this.showHintWithPulse();
      return;
    }

    const next = this.queue.shift();
    if (next === undefined) {
      this.close();
      return;
    }

    this.currentLine = next;
    this.charIndex = 0;
    this.text.setText('');
    this.hideHint();

    this.typeTimer = this.scene.time.addEvent({
      delay: 22,
      repeat: this.currentLine.length - 1,
      callback: () => {
        this.charIndex++;
        this.text.setText(this.currentLine.slice(0, this.charIndex));
        if (this.charIndex >= this.currentLine.length) {
          this.showHintWithPulse();
        }
      },
    });
  }

  private showHintWithPulse(): void {
    this.continueHint.setVisible(true);
    this.continueHint.setAlpha(1);
    this.hintPulseTween?.remove();
    this.hintPulseTween = this.scene.tweens.add({
      targets: this.continueHint,
      alpha: 0.38,
      duration: 640,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private hideHint(): void {
    this.hintPulseTween?.remove();
    this.continueHint.setVisible(false);
    this.continueHint.setAlpha(0);
  }

  private advanceFromPointer(pointer: Phaser.Input.Pointer): void {
    if (!this.active) return;
    if (wasAudioHudClick(this.scene)) return;
    pointer.event.stopPropagation();
    this.advance();
  }

  private advanceFromKeyboard(): void {
    if (!this.active) return;
    this.advance();
  }

  forceClose(): void {
    if (!this.active) return;
    this.typeTimer?.remove();
    this.queue = [];
    this.close();
  }

  private close(): void {
    this.active = false;
    this.hintPulseTween?.remove();
    // Slide back down before hiding
    this.slideInTween?.remove();
    this.closeTween = this.scene.tweens.add({
      targets: this.container,
      y: this.offscreenY,
      alpha: 0,
      duration: 140,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.container.setVisible(false);
        this.container.setY(this.offscreenY);
      },
    });
    // DialogueBox advances/closes itself in direct response to the raw
    // keydown/pointerdown event — which fires *before* the scene's next
    // update(). A scene that separately polls the same interact keys each
    // frame to open new dialogue would otherwise see "dialogue just went
    // inactive" and "interact key still reads as just-pressed" in the same
    // frame, and mistake this exact keypress for a fresh trigger — reopening
    // whatever was just closed, forever. Emitting this lets scenes swallow
    // that one frame instead.
    this.scene.events.emit('dialogueClosed');
    const callback = this.onComplete;
    this.onComplete = undefined;
    callback?.();
  }
}
