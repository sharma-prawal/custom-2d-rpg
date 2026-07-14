import Phaser from 'phaser';
import { Fonts } from './VisualTheme';

/** A floating diegetic action label for the nearest interactable. */
export class InteractionPrompt {
  private container: Phaser.GameObjects.Container;
  private scaleTween?: Phaser.Tweens.Tween;
  private fadeTween?: Phaser.Tweens.Tween;
  private isShowing = false;

  constructor(scene: Phaser.Scene) {
    const glow = scene.add.circle(0, 0, 14, 0xffd9a0, 0.1);
    const glintV = scene.add.rectangle(0, 0, 2, 20, 0xffd9a0, 0.28);
    const glintH = scene.add.rectangle(0, 0, 20, 2, 0xffd9a0, 0.18);
    const panel = scene.add.rectangle(0, -38, 104, 30, 0x090911, 0.76);
    panel.setStrokeStyle(1, 0xffd9a0, 0.28);
    const label = scene.add
      .text(0, -39, 'Inspect', {
        fontFamily: Fonts.ui,
        fontSize: '15px',
        color: '#f5ecd8',
      })
      .setOrigin(0.5);

    this.container = scene.add.container(0, 0, [glow, glintV, glintH, panel, label]);
    this.container.setDepth(950);
    this.container.setVisible(false);
    this.container.setAlpha(0);
    this.container.setScale(0.7);

    scene.tweens.add({
      targets: glow,
      alpha: 0.24,
      scale: 1.28,
      duration: 720,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  showAt(x: number, y: number): void {
    if (this.isShowing) {
      // Already visible — just reposition smoothly
      this.container.setPosition(x, y);
      return;
    }

    this.isShowing = true;
    this.container.setPosition(x, y);
    this.container.setVisible(true);

    this.scaleTween?.remove();
    this.fadeTween?.remove();

    this.container.setScale(0.7);
    this.container.setAlpha(0);

    this.scaleTween = this.container.scene.tweens.add({
      targets: this.container,
      scaleX: 1,
      scaleY: 1,
      duration: 140,
      ease: 'Back.easeOut',
    });
    this.fadeTween = this.container.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 110,
      ease: 'Cubic.easeOut',
    });
  }

  hide(): void {
    if (!this.isShowing) return;
    this.isShowing = false;

    this.scaleTween?.remove();
    this.fadeTween?.remove();

    this.scaleTween = this.container.scene.tweens.add({
      targets: this.container,
      scaleX: 0.7,
      scaleY: 0.7,
      duration: 100,
      ease: 'Cubic.easeIn',
    });
    this.fadeTween = this.container.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 90,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.container.setVisible(false);
      },
    });
  }
}
