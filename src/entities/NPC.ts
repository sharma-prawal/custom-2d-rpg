import Phaser from 'phaser';
import { fitHeight } from '../systems/ImageFit';

const CHAR_HEIGHT = 200;

/** A static character with a gentle idle bob — used for "him" waiting inside each memory. */
export class NPC {
  readonly sprite: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Ellipse;

  constructor(scene: Phaser.Scene, x: number, y: number, textureKey: string, facesLeft = false) {
    this.shadow = scene.add.ellipse(x, y + 74, 72, 18, 0x000000, 0.24);
    this.shadow.setDepth(8);
    this.sprite = scene.add.sprite(x, y, textureKey);
    fitHeight(this.sprite, CHAR_HEIGHT);
    this.sprite.setFlipX(facesLeft);
    this.sprite.setDepth(9);

    scene.tweens.add({
      targets: this.sprite,
      y: y - 2,
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  setTexture(key: string): void {
    this.sprite.setTexture(key);
    fitHeight(this.sprite, CHAR_HEIGHT);
  }
}
