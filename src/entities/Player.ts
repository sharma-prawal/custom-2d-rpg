import Phaser from 'phaser';
import { getMobileMoveVector } from '../systems/MobileControls';

export type Facing = 'up' | 'down' | 'left' | 'right';

/** On-screen height (world px) every character sprite is normalized to. */
const CHAR_HEIGHT = 200;

/** Arrow-key/WASD 4-directional top-down movement controller. */
export class Player {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  private shadow: Phaser.GameObjects.Ellipse;
  private scene: Phaser.Scene;
  private nextFootstepAt = 0;
  facing: Facing = 'down';
  private speed = 240;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };

  constructor(scene: Phaser.Scene, x: number, y: number, textureKey: string) {
    this.scene = scene;
    this.shadow = scene.add.ellipse(x, y + 74, 72, 18, 0x000000, 0.28);
    this.shadow.setDepth(8);
    this.sprite = scene.physics.add.sprite(x, y, textureKey);
    this.sprite.setCollideWorldBounds(true);
    this.normalizeSize();
    this.sprite.setDepth(10);

    this.cursors = scene.input.keyboard!.createCursorKeys();
    this.wasd = scene.input.keyboard!.addKeys('W,A,S,D') as typeof this.wasd;
  }

  setTexture(key: string): void {
    this.sprite.setTexture(key);
    this.normalizeSize();
  }

  /**
   * Scales the sprite to CHAR_HEIGHT regardless of the source texture's native
   * resolution, and sizes the physics body as a proportion of the native frame
   * so real art (any resolution) drops in without retuning collision boxes.
   */
  private normalizeSize(): void {
    const frameW = this.sprite.width;
    const frameH = this.sprite.height;
    this.sprite.setScale(CHAR_HEIGHT / frameH);
    this.sprite.setSize(frameW * 0.55, frameH * 0.32);
    this.sprite.setOffset(frameW * 0.22, frameH * 0.6);
  }

  /** Call once per frame. Returns true if the player moved this frame. */
  update(locked = false): boolean {
    if (locked) {
      this.sprite.setVelocity(0, 0);
      return false;
    }

    const mobile = getMobileMoveVector(this.scene);
    const left = this.cursors.left?.isDown || this.wasd.A.isDown || (mobile?.x ?? 0) < -0.18;
    const right = this.cursors.right?.isDown || this.wasd.D.isDown || (mobile?.x ?? 0) > 0.18;
    const up = this.cursors.up?.isDown || this.wasd.W.isDown || (mobile?.y ?? 0) < -0.18;
    const down = this.cursors.down?.isDown || this.wasd.S.isDown || (mobile?.y ?? 0) > 0.18;

    let vx = 0;
    let vy = 0;
    if (left) vx -= 1;
    if (right) vx += 1;
    if (up) vy -= 1;
    if (down) vy += 1;

    const moving = vx !== 0 || vy !== 0;

    if (moving) {
      const len = Math.hypot(vx, vy);
      vx = (vx / len) * this.speed;
      vy = (vy / len) * this.speed;

      if (Math.abs(vx) > Math.abs(vy)) {
        this.facing = vx > 0 ? 'right' : 'left';
      } else {
        this.facing = vy > 0 ? 'down' : 'up';
      }
      this.sprite.setFlipX(this.facing === 'left');
      if (this.scene.time.now >= this.nextFootstepAt && this.scene.cache.audio.exists('sfx-footstep')) {
        this.scene.sound.play('sfx-footstep', { volume: 0.18 });
        this.nextFootstepAt = this.scene.time.now + 360;
      }
    }

    this.sprite.setVelocity(vx, vy);
    this.shadow.setPosition(this.sprite.x, this.sprite.y + 74);
    this.shadow.setScale(this.sprite.scaleX < 0 ? -1 : 1, 1);
    return moving;
  }
}
