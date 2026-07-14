import Phaser from 'phaser';
import { AudioManager } from './AudioManager';
import { Fonts } from './VisualTheme';

const DEPTH = 1100;
const MARGIN = 22;
const COG_SIZE = 46;

// `pointer.event.stopPropagation()` only stops the native DOM event from
// bubbling. Scene-wide Phaser listeners still need a direct signal that this
// exact click was consumed by the settings UI.
let lastHudInteractionAt = -1000;

/** True if a settings control was pressed within the last ~80ms. */
export function wasAudioHudClick(scene: Phaser.Scene): boolean {
  return scene.time.now - lastHudInteractionAt < 80;
}

function markHudClick(scene: Phaser.Scene, pointer?: Phaser.Input.Pointer): void {
  pointer?.event?.stopPropagation();
  lastHudInteractionAt = scene.time.now;
}

function addRoundedPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  fill = 0x090911,
  alpha = 0.9,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(fill, alpha);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  g.lineStyle(1, 0xffd9a0, 0.34);
  g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  g.lineStyle(1, 0xffffff, 0.08);
  g.strokeRoundedRect(x - w / 2 + 6, y - h / 2 + 6, w - 12, h - 12, Math.max(2, radius - 4));
  return g;
}

function makeTextButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
): { container: Phaser.GameObjects.Container; label: Phaser.GameObjects.Text; setLabel: (value: string) => void; setDisabled: (disabled: boolean) => void } {
  const bg = addRoundedPanel(scene, 0, 0, w, h, Math.min(8, h / 2), 0x15101c, 0.74);
  const txt = scene.add.text(0, 0, label, {
    fontFamily: Fonts.ui,
    fontSize: '15px',
    color: '#ffd9a0',
    align: 'center',
  }).setOrigin(0.5);
  const hit = scene.add.rectangle(0, 0, w, h, 0x000000, 0);
  const container = scene.add.container(x, y, [bg, txt, hit]).setDepth(DEPTH + 5).setScrollFactor(0);
  hit.setInteractive({ useHandCursor: true });

  let disabled = false;
  hit.on('pointerover', () => {
    if (disabled) return;
    bg.clear();
    bg.fillStyle(0x24182a, 0.86);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, Math.min(8, h / 2));
    bg.lineStyle(1, 0xffd9a0, 0.62);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, Math.min(8, h / 2));
    txt.setColor('#fff2d6');
  });
  hit.on('pointerout', () => {
    bg.clear();
    bg.fillStyle(0x15101c, disabled ? 0.32 : 0.74);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, Math.min(8, h / 2));
    bg.lineStyle(1, 0xffd9a0, disabled ? 0.12 : 0.34);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, Math.min(8, h / 2));
    txt.setColor(disabled ? '#746a62' : '#ffd9a0');
  });
  hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    markHudClick(scene, pointer);
    if (!disabled) onClick();
  });

  return {
    container,
    label: txt,
    setLabel: (value: string) => txt.setText(value),
    setDisabled: (value: boolean) => {
      disabled = value;
      hit.disableInteractive();
      if (!value) hit.setInteractive({ useHandCursor: true });
      hit.emit('pointerout');
    },
  };
}

/**
 * Settings cog anchored to the real viewport. The historical name stays so
 * existing scenes can keep calling `addAudioHud`, but the visible UI is now a
 * modal settings hub: mute, volume down/up, and fullscreen toggle.
 */
export function addAudioHud(scene: Phaser.Scene, designWidth: number): void {
  AudioManager.apply(scene);

  // Use the logical game width (Phaser design coordinates), NOT gameSize which
  // returns physical CSS pixels and grows huge in fullscreen.
  const getLogicalW = () => Math.max(designWidth, scene.scale.width);
  const getLogicalH = () => Math.max(720, scene.scale.height);

  let viewWidth  = getLogicalW();
  let viewHeight = getLogicalH();
  let x = viewWidth - MARGIN - COG_SIZE / 2;
  const y = MARGIN + COG_SIZE / 2;

  let modal: Phaser.GameObjects.Container | undefined;
  let removeFullscreenListener: (() => void) | undefined;

  const halo = scene.add.circle(x, y, COG_SIZE / 2, 0x090911, 0.76)
    .setDepth(DEPTH)
    .setScrollFactor(0);
  halo.setStrokeStyle(1, 0xffd9a0, 0.34);

  const innerGlow = scene.add.circle(x, y, COG_SIZE / 2 - 5, 0xffd9a0, 0.08)
    .setDepth(DEPTH + 1)
    .setScrollFactor(0);

  const cog = scene.textures.exists('settings-cog')
    ? scene.add.image(x, y, 'settings-cog').setDisplaySize(35, 35)
    : scene.add.text(x, y, '⚙', { fontFamily: Fonts.ui, fontSize: '26px', color: '#ffd9a0' }).setOrigin(0.5);
  cog.setDepth(DEPTH + 2).setScrollFactor(0);
  const cogBaseScaleX = cog.scaleX;
  const cogBaseScaleY = cog.scaleY;

  const hit = scene.add.rectangle(x, y, COG_SIZE, COG_SIZE, 0x000000, 0)
    .setDepth(DEPTH + 3)
    .setScrollFactor(0)
    .setInteractive({ useHandCursor: true });

  // Reposition cog on resize/fullscreen change
  const onResize = () => {
    viewWidth  = getLogicalW();
    viewHeight = getLogicalH();
    x = viewWidth - MARGIN - COG_SIZE / 2;
    [halo, innerGlow, cog, hit].forEach(obj => { obj.setPosition(x, y); });
    if (modal) { closeModal(); }
  };
  scene.scale.on('resize', onResize);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off('resize', onResize));

  const closeModal = () => {
    removeFullscreenListener?.();
    removeFullscreenListener = undefined;
    modal?.destroy();
    modal = undefined;
  };

  const openModal = () => {
    if (modal) {
      closeModal();
      return;
    }

    const panelW = 372;
    const panelH = 284;
    const panelX = Math.min(viewWidth - panelW / 2 - 18, Math.max(panelW / 2 + 18, x - panelW / 2 + 32));
    const panelY = y + panelH / 2 + 34;

    const overlay = scene.add.rectangle(viewWidth / 2, viewHeight / 2, viewWidth * 2, viewHeight * 2, 0x05040a, 0.72)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: false })
      .setDepth(DEPTH + 3);
    const shadow = scene.add.rectangle(panelX + 8, panelY + 10, panelW, panelH, 0x000000, 0.46).setScrollFactor(0).setDepth(DEPTH + 3);
    const panel = addRoundedPanel(scene, panelX, panelY, panelW, panelH, 10, 0x0a0710, 0.96).setScrollFactor(0).setDepth(DEPTH + 3);
    const title = scene.add.text(panelX - panelW / 2 + 28, panelY - panelH / 2 + 26, 'Settings', {
      fontFamily: Fonts.title,
      fontSize: '30px',
      color: '#f7ecd2',
    }).setScrollFactor(0);
    const subtitle = scene.add.text(panelX - panelW / 2 + 30, panelY - panelH / 2 + 60, 'sound and screen', {
      fontFamily: Fonts.ui,
      fontSize: '13px',
      color: '#b9ad9c',
    }).setScrollFactor(0);

    // Named row positions — shared by labels, buttons, and the slider
    const ROW1_Y   = panelY - 52;   // Audio toggle row
    const ROW2_Y   = panelY + 14;   // Volume label + % row
    const SLIDER_Y = panelY + 52;   // − / slider / + row
    const FS_Y     = panelY + 104;  // Fullscreen button

    const close = makeTextButton(scene, panelX + panelW / 2 - 34, panelY - panelH / 2 + 34, 38, 30, '×', closeModal);
    const mute = makeTextButton(scene, panelX + panelW / 2 - 92, ROW1_Y, 126, 34, '', () => {
      AudioManager.toggleMute(scene);
      refresh();
    });
    const minus = makeTextButton(scene, panelX - panelW / 2 + 62, SLIDER_Y, 38, 34, '−', () => {
      AudioManager.changeVolume(scene, -0.1);
      refresh();
    });
    const plus = makeTextButton(scene, panelX + panelW / 2 - 62, SLIDER_Y, 38, 34, '+', () => {
      AudioManager.changeVolume(scene, 0.1);
      refresh();
    });
    const fullscreen = makeTextButton(scene, panelX, FS_Y, 260, 38, '', () => {
      void toggleFullscreen().then(refresh).catch(refresh);
    });

    const soundLabel = scene.add.text(panelX - panelW / 2 + 34, ROW1_Y, 'Audio', {
      fontFamily: Fonts.ui,
      fontSize: '15px',
      color: '#d9d0bf',
    }).setOrigin(0, 0.5).setScrollFactor(0);
    const volumeLabel = scene.add.text(panelX - panelW / 2 + 34, ROW2_Y, 'Volume', {
      fontFamily: Fonts.ui,
      fontSize: '15px',
      color: '#d9d0bf',
    }).setOrigin(0, 0.5).setScrollFactor(0);
    const volumePct = scene.add.text(panelX, ROW2_Y, '', {
      fontFamily: Fonts.ui,
      fontSize: '14px',
      color: '#b9ad9c',
      align: 'center',
    }).setOrigin(0.5, 0.5).setScrollFactor(0);
    const meterBack = scene.add.rectangle(panelX - 80, SLIDER_Y, 160, 5, 0xffffff, 0.14)
      .setOrigin(0, 0.5)
      .setScrollFactor(0);
    const meterFill = scene.add.rectangle(panelX - 80, SLIDER_Y, 160, 5, 0xffd9a0, 0.9)
      .setOrigin(0, 0.5)
      .setScrollFactor(0);

    modal = scene.add.container(0, 0, [
      overlay,
      shadow,
      panel,
      title,
      subtitle,
      soundLabel,
      volumeLabel,
      volumePct,
      meterBack,
      meterFill,
      close.container,
      mute.container,
      minus.container,
      plus.container,
      fullscreen.container,
    ]).setDepth(DEPTH + 4).setScrollFactor(0);
    modal.setAlpha(0).setScale(0.97);
    scene.tweens.add({ targets: modal, alpha: 1, scaleX: 1, scaleY: 1, duration: 160, ease: 'Sine.easeOut' });

    overlay.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      markHudClick(scene, pointer);
      closeModal();
    });

    const fullscreenListener = () => refresh();
    document.addEventListener('fullscreenchange', fullscreenListener);
    removeFullscreenListener = () => document.removeEventListener('fullscreenchange', fullscreenListener);

    function refresh() {
      const volume = AudioManager.getVolume();
      const muted = AudioManager.isMuted();
      mute.setLabel(muted ? 'Muted' : 'Sound on');
      volumePct.setText(`${Math.round(volume * 100)}%`);
      meterFill.setDisplaySize(Math.max(4, 184 * volume), 5);
      meterFill.setAlpha(muted ? 0.28 : 0.9);

      const canFullscreen = Boolean(document.fullscreenEnabled);
      fullscreen.setDisabled(!canFullscreen);
      fullscreen.setLabel(document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen');
    }

    async function toggleFullscreen() {
      if (!document.fullscreenEnabled) return;
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        const app = document.getElementById('app');
        await app?.requestFullscreen({ navigationUI: 'hide' });
      }
      scene.scale.refresh();
      window.setTimeout(() => scene.scale.refresh(), 80);
    }

    refresh();
  };

  hit.on('pointerover', () => {
    halo.setFillStyle(0x1a1220, 0.88).setStrokeStyle(1, 0xffd9a0, 0.68);
    innerGlow.setAlpha(0.16);
    scene.tweens.add({
      targets: cog,
      scaleX: cogBaseScaleX * 1.08,
      scaleY: cogBaseScaleY * 1.08,
      duration: 120,
      ease: 'Sine.easeOut',
    });
  });
  hit.on('pointerout', () => {
    halo.setFillStyle(0x090911, 0.76).setStrokeStyle(1, 0xffd9a0, 0.34);
    innerGlow.setAlpha(1);
    scene.tweens.add({
      targets: cog,
      scaleX: cogBaseScaleX,
      scaleY: cogBaseScaleY,
      duration: 120,
      ease: 'Sine.easeOut',
    });
  });
  hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    markHudClick(scene, pointer);
    openModal();
  });

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, closeModal);
}
