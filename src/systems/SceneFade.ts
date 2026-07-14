import Phaser from 'phaser';

/** Camera fade helpers shared by every scene, plus an ambient time-of-day/season tint overlay. */
export class SceneFade {
  static fadeIn(scene: Phaser.Scene, duration = 400, color: [number, number, number] = [0, 0, 0]): void {
    scene.cameras.main.fadeIn(duration, ...color);
  }

  static fadeOutThen(
    scene: Phaser.Scene,
    onComplete: () => void,
    duration = 400,
    color: [number, number, number] = [0, 0, 0],
  ): void {
    scene.cameras.main.fadeOut(duration, ...color);
    scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, onComplete);
  }

  /** Adds a full-viewport tinted rectangle above the scene to sell time-of-day/season mood. */
  static addAmbientTint(
    scene: Phaser.Scene,
    width: number,
    height: number,
    tint: number,
    alpha: number,
  ): Phaser.GameObjects.Rectangle {
    width = Math.max(width, scene.scale.gameSize.width);
    height = Math.max(height, scene.scale.gameSize.height);
    const overlay = scene.add.rectangle(width / 2, height / 2, width, height, tint, alpha);
    overlay.setDepth(900);
    overlay.setScrollFactor(0);
    return overlay;
  }
}
