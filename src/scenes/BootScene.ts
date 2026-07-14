import Phaser from 'phaser';

/**
 * The loading screen's own backdrop has to be loaded before PreloadScene
 * (which is where every other real asset loads) — otherwise the screen
 * whose entire job is "cover for assets still loading" would itself be
 * waiting on an unloaded asset. Boot loads this one image, nothing else.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.image('loading-bg', 'assets/images/backgrounds/loading.png');
  }

  create(): void {
    this.scene.start('Preload');
  }
}
