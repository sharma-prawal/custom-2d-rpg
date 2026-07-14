import Phaser from 'phaser';
import { Fonts } from './VisualTheme';

interface TouchState {
  vector: Phaser.Math.Vector2;
  actionUntil: number;
}

const states = new WeakMap<Phaser.Scene, TouchState>();

function isTouchDevice(): boolean {
  return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}

export function addMobileControls(scene: Phaser.Scene): void {
  if (!isTouchDevice()) return;
  if (states.has(scene)) return;

  const state: TouchState = { vector: new Phaser.Math.Vector2(0, 0), actionUntil: 0 };
  states.set(scene, state);

  const depth = 1200;
  const baseX = 128;
  const baseY = scene.scale.gameSize.height - 118;
  const radius = 58;

  const base = scene.add.circle(baseX, baseY, radius, 0x090911, 0.42);
  base.setStrokeStyle(1, 0xffd9a0, 0.22);
  const inner = scene.add.circle(baseX, baseY, 22, 0xffd9a0, 0.22);
  const label = scene.add
    .text(baseX, baseY + 76, 'move', {
      fontFamily: Fonts.ui,
      fontSize: '14px',
      color: '#b9ad9c',
    })
    .setOrigin(0.5);

  const actionX = scene.scale.gameSize.width - 112;
  const actionY = scene.scale.gameSize.height - 118;
  const action = scene.add.circle(actionX, actionY, 52, 0x090911, 0.48);
  action.setStrokeStyle(1, 0xffd9a0, 0.34);
  const actionText = scene.add
    .text(actionX, actionY, 'Inspect', {
      fontFamily: Fonts.ui,
      fontSize: '18px',
      color: '#f5ecd8',
    })
    .setOrigin(0.5);

  const controls = scene.add.container(0, 0, [base, inner, label, action, actionText]);
  controls.setDepth(depth).setScrollFactor(0).setAlpha(0.82);

  let stickPointer: number | null = null;

  scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    const distToAction = Phaser.Math.Distance.Between(pointer.x, pointer.y, actionX, actionY);
    if (distToAction < 68) {
      pointer.event.stopPropagation();
      state.actionUntil = scene.time.now + 180;
      scene.tweens.add({ targets: [action, actionText], alpha: 0.55, duration: 90, yoyo: true });
      return;
    }

    if (pointer.x < scene.scale.gameSize.width * 0.46 && stickPointer === null) {
      stickPointer = pointer.id;
      updateStick(pointer);
    }
  });

  scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
    if (pointer.id === stickPointer) updateStick(pointer);
  });

  scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
    if (pointer.id !== stickPointer) return;
    stickPointer = null;
    state.vector.set(0, 0);
    inner.setPosition(baseX, baseY);
  });

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    states.delete(scene);
  });

  function updateStick(pointer: Phaser.Input.Pointer): void {
    const local = new Phaser.Math.Vector2(pointer.x - baseX, pointer.y - baseY);
    if (local.length() > radius) local.setLength(radius);
    inner.setPosition(baseX + local.x, baseY + local.y);
    state.vector.copy(local).scale(1 / radius);
  }
}

export function getMobileMoveVector(scene: Phaser.Scene): Phaser.Math.Vector2 | undefined {
  return states.get(scene)?.vector;
}

export function consumeMobileAction(scene: Phaser.Scene): boolean {
  const state = states.get(scene);
  if (!state || scene.time.now > state.actionUntil) return false;
  state.actionUntil = 0;
  return true;
}
