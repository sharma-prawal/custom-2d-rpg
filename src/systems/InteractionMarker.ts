import Phaser from 'phaser';

/**
 * A soft pulsing sparkle used to mark an interactable point without literally
 * drawing the object — the painted backgrounds already depict these objects
 * (a cake, a calendar, a bench...), so stamping a second icon sprite on top
 * created a jarring "sticker on a painting" duplicate. A marker only signals
 * "there's something to look at here."
 */
export class InteractionMarker {
  readonly container: Phaser.GameObjects.Container;
  private core: Phaser.GameObjects.Arc;
  private glow: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, x: number, y: number, depth = 6, color = 0xffd9a0) {
    this.glow = scene.add.circle(0, 0, 13, color, 0.12);
    const glintA = scene.add.rectangle(0, -10, 2, 8, color, 0.34);
    const glintB = scene.add.rectangle(0, 10, 2, 8, color, 0.18);
    const glintC = scene.add.rectangle(-10, 0, 8, 2, color, 0.18);
    const glintD = scene.add.rectangle(10, 0, 8, 2, color, 0.18);
    this.core = scene.add.circle(0, 0, 2.5, 0xfff3d8, 0.72);

    this.container = scene.add.container(x, y, [this.glow, glintA, glintB, glintC, glintD, this.core]);
    this.container.setDepth(depth);

    scene.tweens.add({
      targets: this.glow,
      scale: 1.45,
      alpha: 0.04,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    scene.tweens.add({
      targets: this.container,
      y: y - 4,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  destroy(): void {
    this.container.destroy();
  }
}
