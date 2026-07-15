import Phaser from 'phaser';
import { SaveState } from '../systems/SaveState';
import { AudioManager } from '../systems/AudioManager';
import { addAudioHud, wasAudioHudClick } from '../systems/AudioHud';
import { fitViewportCover } from '../systems/ImageFit';
import { addCinematicVignette, addSceneGrain, Fonts } from '../systems/VisualTheme';

const VIEW_W = 1280;
const VIEW_H = 720;

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenu');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0b0b12');
    AudioManager.playMusic(this, 'music-hub');
    addAudioHud(this, VIEW_W);

    // Reuse the garden finale art as key art — a title screen shouldn't be
    // the one screen in the game with no illustration behind it.
    const bg = this.add.image(VIEW_W / 2, VIEW_H / 2, 'garden-bg').setDepth(0);
    fitViewportCover(this, bg, VIEW_W, VIEW_H);
    // EXPAND mode can make the real viewport wider/taller than the 1280x720
    // design size. This scene's camera is never panned or bounded, so world
    // coordinates map 1:1 to screen pixels — every centered element below
    // must use the *actual* viewport center (cx, cy), not VIEW_W/2, or it
    // drifts off-center on anything wider than 16:9.
    const frameW = Math.max(VIEW_W, this.scale.gameSize.width);
    const frameH = Math.max(VIEW_H, this.scale.gameSize.height);
    const cx = frameW / 2;
    const cy = frameH / 2;
    this.add.rectangle(cx, cy, frameW, frameH, 0x0b0b12, 0.38).setDepth(1);
    addCinematicVignette(this, frameW, frameH, 0.42, 2);
    addSceneGrain(this, frameW, frameH, 3);

    const titleY = cy - 128;
    const titleShadow = this.add
      .text(cx + 4, titleY + 4, 'Chapters of Us', {
        fontFamily: Fonts.title,
        fontSize: '86px',
        color: '#000000',
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(4);

    const title = this.add
      .text(cx, titleY, 'Chapters of Us', {
        fontFamily: Fonts.title,
        fontSize: '86px',
        color: '#ffd9a0',
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(5);

    const ruleY = titleY + 66;
    const ruleLeft = this.add.rectangle(cx - 286, ruleY, 132, 1, 0xffd9a0, 0.34).setDepth(5).setAlpha(0);
    const ruleRight = this.add.rectangle(cx + 286, ruleY, 132, 1, 0xffd9a0, 0.34).setDepth(5).setAlpha(0);
    const jewel = this.add.circle(cx, ruleY, 5, 0xffd9a0, 0.7).setDepth(5).setAlpha(0);

    const subtitle = this.add
      .text(cx, ruleY + 32, 'a quiet walk through everything I noticed', {
        fontFamily: Fonts.body,
        fontSize: '34px',
        color: '#f5ecd8',
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(5);

    const hasSave = SaveState.get().visitedMemories.length > 0;

    const ctaY = titleY + 286;
    const ctaShadow = this.add.rectangle(cx + 8, ctaY + 8, 286, 72, 0x000000, 0.34).setDepth(4).setAlpha(0);
    const ctaPanel = this.add.rectangle(cx, ctaY, 286, 72, 0x090911, 0.62).setDepth(5).setAlpha(0);
    ctaPanel.setStrokeStyle(1, 0xffd9a0, 0.34);
    const ctaTop = this.add.rectangle(cx, ctaY - 34, 246, 1, 0xffd9a0, 0.28).setDepth(6).setAlpha(0);
    const ctaAccent = this.add.graphics().setDepth(6).setAlpha(0);
    ctaAccent.lineStyle(2, 0xffd9a0, 0.28);
    const left = cx - 132;
    const right = cx + 132;
    const top = ctaY - 32;
    const bottom = ctaY + 32;
    const len = 18;
    ctaAccent.lineBetween(left, top + len, left, top);
    ctaAccent.lineBetween(left, top, left + len, top);
    ctaAccent.lineBetween(right - len, top, right, top);
    ctaAccent.lineBetween(right, top, right, top + len);
    ctaAccent.lineBetween(left, bottom - len, left, bottom);
    ctaAccent.lineBetween(left, bottom, left + len, bottom);
    ctaAccent.lineBetween(right - len, bottom, right, bottom);
    ctaAccent.lineBetween(right, bottom, right, bottom - len);
    const prompt = this.add
      .text(cx, ctaY - 9, hasSave ? 'CONTINUE' : 'BEGIN', {
        fontFamily: Fonts.ui,
        fontSize: '22px',
        color: '#ffd9a0',
      })
      .setOrigin(0.5, 0.5)
      .setDepth(6)
      .setAlpha(0);
    const promptSub = this.add
      .text(cx, ctaY + 17, 'tap, click, or press enter', {
        fontFamily: Fonts.ui,
        fontSize: '15px',
        color: '#b9ad9c',
      })
      .setOrigin(0.5, 0.5)
      .setDepth(6)
      .setAlpha(0);
    // A bare emoji speaker glyph renders inconsistently across platforms
    // (fuzzy/wrong glyph on some systems) and reads as an afterthought
    // dropped onto the background. Same pill treatment as the "resets the
    // walk" hint below it, with a small hand-drawn speaker icon instead of
    // relying on emoji font support.
    const audioY = ctaY + 56;
    const audioPillW = 296;
    const audioPillH = 32;
    const audioPill = this.add.rectangle(cx, audioY, audioPillW, audioPillH, 0x0a0810, 0.5).setDepth(5).setAlpha(0);
    audioPill.setStrokeStyle(1, 0xffd9a0, 0.16);

    const audioIconX = cx - audioPillW / 2 + 24;
    const audioIcon = this.add.graphics().setDepth(6).setAlpha(0);
    audioIcon.fillStyle(0xffd9a0, 0.85);
    audioIcon.beginPath();
    audioIcon.moveTo(audioIconX - 7, audioY - 4);
    audioIcon.lineTo(audioIconX - 3, audioY - 4);
    audioIcon.lineTo(audioIconX + 2, audioY - 8);
    audioIcon.lineTo(audioIconX + 2, audioY + 8);
    audioIcon.lineTo(audioIconX - 3, audioY + 4);
    audioIcon.lineTo(audioIconX - 7, audioY + 4);
    audioIcon.closePath();
    audioIcon.fillPath();
    audioIcon.lineStyle(1.4, 0xffd9a0, 0.7);
    audioIcon.beginPath();
    audioIcon.arc(audioIconX + 2, audioY, 6, Phaser.Math.DegToRad(-40), Phaser.Math.DegToRad(40));
    audioIcon.strokePath();
    audioIcon.beginPath();
    audioIcon.arc(audioIconX + 2, audioY, 10, Phaser.Math.DegToRad(-40), Phaser.Math.DegToRad(40));
    audioIcon.strokePath();

    const audioHint = this.add
      .text(audioIconX + 18, audioY, 'best experienced with audio on', {
        fontFamily: Fonts.ui,
        fontSize: '14px',
        color: '#d8cabb',
      })
      .setOrigin(0, 0.5)
      .setDepth(6)
      .setAlpha(0);

    // Staggered entrance: title → rule → subtitle → CTA, 120ms apart each
    const STAGGER = 120;
    const FADE_DUR = 420;
    const SLIDE = 18; // px to rise from

    const revealAt = (targets: Phaser.GameObjects.GameObject[], delay: number, fromY?: number) => {
      targets.forEach((t) => {
        if (fromY !== undefined && 'y' in t) {
          (t as Phaser.GameObjects.Text).y += fromY;
        }
      });
      this.tweens.add({
        targets,
        alpha: 1,
        y: fromY !== undefined ? `-=${fromY}` : undefined,
        duration: FADE_DUR,
        delay,
        ease: 'Cubic.easeOut',
      });
    };

    revealAt([title, titleShadow], STAGGER * 0, SLIDE);
    revealAt([ruleLeft, ruleRight, jewel], STAGGER * 1, 0);
    revealAt([subtitle], STAGGER * 2, SLIDE * 0.6);
    revealAt(
      [ctaShadow, ctaPanel, ctaTop, ctaAccent, prompt, promptSub, audioPill, audioIcon, audioHint],
      STAGGER * 3,
      SLIDE * 0.5,
    );

    // Start idle animations AFTER the entrance — delay by roughly when CTA appears
    const LOOP_DELAY = STAGGER * 3 + FADE_DUR;
    this.time.delayedCall(LOOP_DELAY, () => {
      this.tweens.add({
        targets: [ctaPanel, ctaTop, prompt],
        alpha: { from: 0.72, to: 1 },
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.tweens.add({
        targets: [title, titleShadow, subtitle, ruleLeft, ruleRight, jewel],
        y: '+=4',
        duration: 2200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });

    if (hasSave) {
      const resetY = ctaY + 98;
      // A bare text label directly on the busy floral background reads as a
      // stray color cast (simultaneous-contrast illusion) rather than the
      // intended muted gray — give the whole hint a backing pill so it reads
      // as one deliberate chip, same visual family as the CTA panel above it.
      const pillW = 178;
      const pillH = 30;
      const pill = this.add.rectangle(cx, resetY, pillW, pillH, 0x0a0810, 0.5).setDepth(5).setAlpha(0);
      pill.setStrokeStyle(1, 0xffd9a0, 0.16);
      const keyCap = this.add.rectangle(cx - pillW / 2 + 22, resetY, 22, 22, 0x0a0810, 0.7).setDepth(6).setAlpha(0);
      keyCap.setStrokeStyle(1, 0xffd9a0, 0.28);
      const keyLabel = this.add
        .text(cx - pillW / 2 + 22, resetY, 'R', {
          fontFamily: Fonts.ui,
          fontSize: '13px',
          color: '#ffd9a0',
        })
        .setOrigin(0.5)
        .setDepth(7)
        .setAlpha(0);
      const resetLabel = this.add
        .text(cx - pillW / 2 + 40, resetY, 'resets the walk', {
          fontFamily: Fonts.ui,
          fontSize: '15px',
          color: '#b9ad9c',
        })
        .setOrigin(0, 0.5)
        .setDepth(6)
        .setAlpha(0);
      revealAt([pill, keyCap, keyLabel, resetLabel], STAGGER * 4, 0);
    }

    // Clicking the audio HUD also fires this scene-wide pointerdown listener
    // (stopPropagation only blocks native DOM bubbling, not Phaser's own
    // listener dispatch) — a `.once()` guard would consume the listener
    // without starting the game, permanently breaking "click to begin".
    // Re-register instead of returning so a swallowed HUD click doesn't
    // eat the player's next genuine click.
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start('Hub');
      });
    };
    const onPointerDown = () => {
      if (wasAudioHudClick(this)) return;
      start();
    };

    this.input.keyboard!.once('keydown-SPACE', start);
    this.input.keyboard!.once('keydown-ENTER', start);
    this.input.on('pointerdown', onPointerDown);
    ctaPanel.setInteractive({ useHandCursor: true });
    ctaPanel.on('pointerover', () => {
      ctaPanel.setFillStyle(0x151021, 0.78);
      promptSub.setColor('#f5ecd8');
    });
    ctaPanel.on('pointerout', () => {
      ctaPanel.setFillStyle(0x090911, 0.62);
      promptSub.setColor('#b9ad9c');
    });
    this.input.keyboard!.on('keydown-R', () => {
      SaveState.reset();
      this.scene.restart();
    });

    void ctaShadow;

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }
}
