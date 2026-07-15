import Phaser from 'phaser';
import { MEMORIES } from '../data/memories';
import { Player } from '../entities/Player';
import { SaveState } from '../systems/SaveState';
import { AudioManager } from '../systems/AudioManager';
import { addAudioHud } from '../systems/AudioHud';
import { addMobileControls } from '../systems/MobileControls';
import { fitHeight, fitTileHeight } from '../systems/ImageFit';
import { addChapterPlaque, addDestinationSign, addHubFocusPlate } from '../systems/EnvironmentalSignage';
import { addCinematicVignette, addSceneGrain, Fonts } from '../systems/VisualTheme';

const VIEW_W = 1280;
const VIEW_H = 720;
// hub-bg tiles horizontally (one seamless painted scene repeating), so this
// world is really "the same garden, a bit further along" — not a series of
// separate rooms. WORLD_W only needs to reach a little past the last portal
// for BTS and the finale; it previously jumped a full extra 1280px tile
// past portal 7, which read as a whole second, disconnected hub bolted onto
// the end rather than a continuation of the one the player's already in.
const WORLD_W = 2680;

const PORTAL_POSITIONS: Record<number, { x: number; y: number; labelY: number; markerX?: number; markerY?: number }> = {
  1: { x: 230, y: 430, labelY: 246 },
  2: { x: 520, y: 350, labelY: 166 },
  3: { x: 810, y: 435, labelY: 252 },
  4: { x: 1100, y: 350, labelY: 166 },
  5: { x: 1390, y: 435, labelY: 252 },
  6: { x: 1680, y: 350, labelY: 166 },
  7: { x: 1970, y: 435, labelY: 252 },
};

// FINALE sits at the same elevated height as the numbered portal arches,
// a modest walk past portal 7 — not a whole separate area. BTS sits lower
// (out of the portal "spine" line, per feedback) and closer in, between
// portal 7 and the finale, so the whole epilogue reads as one continuous
// clearing rather than two.
const FINALE = { x: 2460, y: 350 };
const BTS = { x: 2200, y: 610 };
const CHAPTER_SIGNALS: Record<number, string> = {
  1: 'FIRST GLANCE',
  2: 'CARE',
  3: 'HOME',
  4: 'DETAILS',
  5: 'MIDNIGHT',
  6: 'TUESDAY',
  7: 'RIGHT NOW',
};

interface HubStartData {
  fromIndex?: number;
}

export class HubScene extends Phaser.Scene {
  private player!: Player;
  private portalZones: { zone: Phaser.GameObjects.Zone; index: number }[] = [];
  private portalSpots: { x: number; y: number; index: number; label: string; enterable: boolean }[] = [];
  private focusText!: Phaser.GameObjects.Text;
  private focusBg!: Phaser.GameObjects.Container;
  private hasEntered = false;
  /** Tracks whether the focus label is currently visible to avoid re-animating on every frame. */
  private focusVisible = false;
  private focusLabelTween?: Phaser.Tweens.Tween;
  private isPlayingUnlockSequence = false;

  constructor() {
    super('Hub');
  }

  create(data: HubStartData): void {
    const worldH = Math.max(VIEW_H, this.scale.gameSize.height);
    this.hasEntered = false;
    this.focusVisible = false;
    this.portalZones = [];
    this.portalSpots = [];
    this.physics.world.setBounds(0, 0, WORLD_W, worldH);
    this.cameras.main.setBackgroundColor('#12121c');

    const bg = this.add.tileSprite(WORLD_W / 2, worldH / 2, WORLD_W, worldH, 'hub-bg').setDepth(0);
    fitTileHeight(bg, worldH);
    this.cameras.main.setBounds(0, 0, WORLD_W, worldH);
    addCinematicVignette(this, VIEW_W, VIEW_H, 0.28, 20);
    addSceneGrain(this, VIEW_W, VIEW_H, 21);
    // Subtle dark-indigo wash over the tile BG — removes the flat "washed-out"
    // look by deepening midtones. Depth 1 keeps it under portals (depth 5)
    // and the vignette (depth 20). scrollFactor 0 so it covers the camera
    // viewport regardless of horizontal scroll position.
    const sw = Math.max(VIEW_W, this.scale.width);
    const sh = Math.max(VIEW_H, this.scale.height);
    this.add.rectangle(sw / 2, sh / 2, sw + 200, sh + 200, 0x050818, 0.22)
      .setDepth(1).setScrollFactor(0);

    const save = SaveState.get();
    MEMORIES.forEach((memory) => this.addMemoryPortal(memory.index, save.visitedMemories.includes(memory.index)));

    let finalePortal: Phaser.GameObjects.Image | undefined;
    let finaleLabelSign: Phaser.GameObjects.Container | undefined;

    if (save.completedMiniGames.length >= MEMORIES.length) {
      // The finale deserves its own bespoke doorway rather than the same
      // generic archway icon every numbered memory portal reuses — see
      // docs/ASSET_PROMPTS.md for the "final-letter-portal" generation
      // prompt. Falls back to the shared placeholder texture until that
      // real art is dropped in.
      finalePortal = this.add.image(FINALE.x, FINALE.y, 'final-letter-portal').setDepth(5);
      fitHeight(finalePortal, 240);
      
      const shouldPlayUnlock = data?.fromIndex === 7 && !localStorage.getItem('played-finale-sequence-v1');
      if (shouldPlayUnlock) {
        this.isPlayingUnlockSequence = true;
        this.hasEntered = true;
        finalePortal.setAlpha(0).setScale(0);
      } else {
        // Pulse between 0.82 and 1.0 — same visual language as chapter portals
        // (which go 0.72–1.0) but slightly more visible since this is the climax door.
        this.tweens.add({ targets: finalePortal, alpha: 0.82, duration: 800, yoyo: true, repeat: -1 });
      }

      finaleLabelSign = addDestinationSign(this, FINALE.x, FINALE.y - 230, {
        text: 'The Letter',
        subtitle: 'final garden',
        width: 214,
        accent: 0xffe9c2,
      });

      if (shouldPlayUnlock) {
        finaleLabelSign.setAlpha(0);
      }

      const finaleZone = this.add.zone(FINALE.x, FINALE.y, 120, 160);
      this.physics.add.existing(finaleZone, true);
      this.portalZones.push({ zone: finaleZone, index: -1 });
      this.portalSpots.push({ x: FINALE.x, y: FINALE.y, index: -1, label: 'The Letter', enterable: true });
    }

    const btsUnlocked = save.unlockedBts || save.reachedLetter;
    const btsDoor = this.add.image(BTS.x, BTS.y, 'bts-door').setDepth(5);
    fitHeight(btsDoor, 150);
    if (btsUnlocked) {
      // Unlocked: gentle pulse matching the chapter portal style
      this.tweens.add({ targets: btsDoor, alpha: 0.72, duration: 850, yoyo: true, repeat: -1 });
    } else {
      // Locked: same alpha as locked chapter portals (0.88, not 0.58)
      btsDoor.setAlpha(0.88);
    }
    addDestinationSign(this, BTS.x, BTS.y - 92, {
      text: btsUnlocked ? 'BTS' : 'BTS Locked',
      subtitle: btsUnlocked ? 'atelier archive' : 'finish the letter',
      width: 178,
      accent: 0xc9a8ff,
      locked: !btsUnlocked,
      icon: 'reel',
    });
    const btsZone = this.add.zone(BTS.x, BTS.y, 96, 132);
    this.physics.add.existing(btsZone, true);
    if (btsUnlocked) this.portalZones.push({ zone: btsZone, index: -2 });
    this.portalSpots.push({
      x: BTS.x,
      y: BTS.y,
      index: -2,
      label: btsUnlocked ? 'Behind the Scenes' : 'Behind the Scenes - finish the letter first',
      enterable: btsUnlocked,
    });

    this.focusBg = addHubFocusPlate(this, VIEW_W / 2, VIEW_H - 54, 660);
    this.focusText = this.add
      .text(VIEW_W / 2, VIEW_H - 70, '', {
        fontFamily: Fonts.body,
        fontSize: '24px',
        color: '#f5ecd8',
        align: 'center',
      })
      .setOrigin(0.5, 0)
      .setDepth(31)
      .setScrollFactor(0)
      .setVisible(false);

    this.addJournalButton(save.journalPages.length);

    const start = data?.fromIndex ? PORTAL_POSITIONS[data.fromIndex] : undefined;
    this.player = new Player(this, start ? start.x : 120, start ? start.y + 105 : 575, 'char-her-everyday');
    this.cameras.main.startFollow(this.player.sprite, true, 0.08, 0.08);
    // Spawn entrance: player fades + scales in from slightly smaller.
    // Capture natural scale first, then reduce it for the start state.
    const naturalScaleX = this.player.sprite.scaleX;
    const naturalScaleY = this.player.sprite.scaleY;
    this.player.sprite.setAlpha(0);
    this.player.sprite.setScale(naturalScaleX * 0.88, naturalScaleY * 0.88);
    this.tweens.add({
      targets: this.player.sprite,
      alpha: 1,
      scaleX: naturalScaleX,
      scaleY: naturalScaleY,
      duration: 320,
      ease: 'Back.easeOut',
      delay: 180,
    });
    addMobileControls(this);

    AudioManager.playMusic(this, 'music-hub');
    addAudioHud(this, VIEW_W);
    this.cameras.main.fadeIn(300, 0, 0, 0);

    if (this.isPlayingUnlockSequence) {
      this.player.sprite.setPosition(PORTAL_POSITIONS[7].x, PORTAL_POSITIONS[7].y + 105);
      this.time.delayedCall(1000, () => {
        this.triggerFinalPortalCutscene(finalePortal!, finaleLabelSign!);
      });
    }
  }

  update(): void {
    this.player.update();
    if (this.hasEntered) return;

    this.updateFocusLabel();

    for (const { zone, index } of this.portalZones) {
      const dist = Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, zone.x, zone.y);
      if (dist < 58) {
        this.enterPortal(index);
        break;
      }
    }
  }

  private addMemoryPortal(index: number, visited: boolean): void {
    const memory = MEMORIES[index - 1];
    const { x, y, labelY, markerX, markerY } = PORTAL_POSITIONS[index];
    const unlocked = SaveState.isUnlocked(index);
    const portal = this.add.image(x, y, unlocked ? 'portal-unlocked' : 'portal-locked').setDepth(5);
    fitHeight(portal, 180);
    if (unlocked) {
      this.tweens.add({ targets: portal, alpha: 0.72, duration: 850, yoyo: true, repeat: -1 });
    } else {
      portal.setAlpha(0.88);
    }

    const label = unlocked ? `${index}. ${memory.title}` : `${index}. locked`;
    addChapterPlaque(this, markerX ?? x, markerY ?? labelY + 22, {
      index,
      title: memory.title,
      caption: CHAPTER_SIGNALS[index],
      unlocked,
      visited,
    });
    this.portalSpots.push({ x, y, index, label, enterable: unlocked });

    const zone = this.add.zone(x, y, 118, 158);
    this.physics.add.existing(zone, true);
    if (unlocked) this.portalZones.push({ zone, index });
  }

  private addJournalButton(pageCount: number): void {
    const x = 132;
    const y = 72;
    const hasPages = pageCount > 0;
    const borderColor = hasPages ? 0xffd9a0 : 0x6a6070;
    const textColor = hasPages ? '#ffd9a0' : '#6a6070';
    const fillAlpha = hasPages ? 0.7 : 0.44;

    const bg = this.add.graphics().setDepth(100).setScrollFactor(0);
    bg.fillStyle(0x090911, fillAlpha);
    bg.fillRoundedRect(x - 96, y - 25, 192, 50, 10);
    bg.lineStyle(1, borderColor, hasPages ? 0.32 : 0.18);
    bg.strokeRoundedRect(x - 96, y - 25, 192, 50, 10);
    if (hasPages) {
      bg.lineStyle(1, 0xffffff, 0.07);
      bg.strokeRoundedRect(x - 86, y - 17, 172, 34, 7);
      bg.fillStyle(0xffd9a0, 0.18);
      bg.fillCircle(x - 74, y, 4);
      bg.fillCircle(x + 74, y, 4);
    }
    const label = hasPages ? `Journal  ${pageCount}/7` : 'Journal  \u{1F512}';
    const text = this.add
      .text(x, y, label, {
        fontFamily: Fonts.ui,
        fontSize: '17px',
        color: textColor,
        align: 'center',
        fixedWidth: 154,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(101);

    if (hasPages) {
      const hit = this.add.zone(x, y, 192, 50).setDepth(102).setScrollFactor(0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        pointer.event.stopPropagation();
        this.scene.start('Journal', { mode: 'browse' });
      });
    }
    void text;
  }

  private updateFocusLabel(): void {
    let nearest: { label: string; enterable: boolean; index: number } | null = null;
    let nearestDist = Infinity;
    for (const spot of this.portalSpots) {
      const dist = Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, spot.x, spot.y);
      if (dist < 132 && dist < nearestDist) {
        nearest = spot;
        nearestDist = dist;
      }
    }

    if (!nearest) {
      if (this.focusVisible) {
        this.focusVisible = false;
        this.focusLabelTween?.remove();
        this.focusLabelTween = this.tweens.add({
          targets: [this.focusBg, this.focusText],
          y: `+=${36}`,
          alpha: 0,
          duration: 160,
          ease: 'Cubic.easeIn',
          onComplete: () => {
            this.focusBg.setVisible(false);
            this.focusText.setVisible(false);
          },
        });
      }
      return;
    }

    if (!this.focusVisible) {
      this.focusVisible = true;
      // Reset to off-screen position
      this.focusBg.setPosition(VIEW_W / 2, VIEW_H - 54 + 36);
      this.focusText.setPosition(VIEW_W / 2, VIEW_H - 70 + 36);
      this.focusBg.setAlpha(0);
      this.focusText.setAlpha(0);
      this.focusBg.setVisible(true);
      this.focusText.setVisible(true);
      this.focusLabelTween?.remove();
      this.focusLabelTween = this.tweens.add({
        targets: [this.focusBg, this.focusText],
        y: `-=${36}`,
        alpha: 1,
        duration: 220,
        ease: 'Cubic.easeOut',
      });
    }

    // Only the numbered memory portals rely on this generic suffix — BTS and
    // the finale door (negative index) already bake their own full reason
    // into `label` (e.g. "Behind the Scenes - finish the letter first"), so
    // appending it again produced a doubled, contradictory message.
    const showGenericReason = !nearest.enterable && nearest.index > 0;
    this.focusText.setText(showGenericReason ? `${nearest.label} - visit the previous chapter first` : nearest.label);
  }

  private enterPortal(index: number): void {
    this.hasEntered = true;
    AudioManager.playSfx(this, 'sfx-portal');

    // Find the portal's screen position for the flash burst
    const portalZone = this.portalZones.find((p) => p.index === index);
    if (portalZone) {
      this.emitPortalFlash(portalZone.zone.x, portalZone.zone.y);
    }

    // Slight delay so the flash is visible before the fade-to-black
    this.time.delayedCall(80, () => {
      this.cameras.main.fadeOut(280, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        if (index === -1) {
          this.scene.start('Letter');
        } else if (index === -2) {
          this.scene.start('BTS');
        } else {
          this.scene.start('Memory', { memoryIndex: index });
        }
      });
    });
  }

  /**
   * A radial burst of soft circles emanating from the portal position,
   * simulating a light/magic entry effect before the scene fades.
   */
  private emitPortalFlash(x: number, y: number): void {
    const BURST_COUNT = 8;
    for (let i = 0; i < BURST_COUNT; i++) {
      const angle = (i / BURST_COUNT) * Math.PI * 2;
      const dist = Phaser.Math.Between(24, 64);
      const dot = this.add.circle(x, y, Phaser.Math.Between(4, 9), 0xfff3d8, 0.88).setDepth(20);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: 340,
        ease: 'Cubic.easeOut',
        delay: i * 18,
        onComplete: () => dot.destroy(),
      });
    }
    // Central white pulse
    const core = this.add.circle(x, y, 38, 0xffffff, 0.46).setDepth(21);
    this.tweens.add({
      targets: core,
      alpha: 0,
      scale: 2.8,
      duration: 300,
      ease: 'Cubic.easeOut',
      onComplete: () => core.destroy(),
    });
  }

  private triggerFinalPortalCutscene(
    finalePortal: Phaser.GameObjects.Image,
    labelSign: Phaser.GameObjects.Container
  ): void {
    this.cameras.main.pan(VIEW_W / 2, VIEW_H / 2 - 80, 1000, 'Cubic.easeInOut');
    this.cameras.main.zoomTo(1.15, 1000, 'Cubic.easeInOut');

    const count = 7;
    for (let index = 1; index <= count; index++) {
      this.time.delayedCall((index - 1) * 380, () => {
        const { x, y } = PORTAL_POSITIONS[index];
        AudioManager.playSfx(this, 'sfx-page-turn');

        const dot = this.add.circle(x, y, 6, 0xffd9a0, 0.95).setDepth(20);
        
        const trailTimer = this.time.addEvent({
          delay: 40,
          loop: true,
          callback: () => {
            if (dot.active) {
              const t = this.add.circle(dot.x, dot.y, Phaser.Math.Between(2, 4), 0xfff3d8, 0.6).setDepth(19);
              this.tweens.add({
                targets: t,
                alpha: 0,
                scale: 0.1,
                duration: 400,
                onComplete: () => t.destroy()
              });
            }
          }
        });

        this.tweens.add({
          targets: dot,
          x: FINALE.x,
          y: FINALE.y,
          scale: 0.3,
          duration: 900,
          ease: 'Cubic.easeIn',
          onComplete: () => {
            trailTimer.destroy();
            dot.destroy();
            
            this.emitPortalFlash(FINALE.x, FINALE.y);
            AudioManager.playSfx(this, 'sfx-portal');

            if (index === count) {
              this.time.delayedCall(400, () => {
                AudioManager.playSfx(this, 'sfx-portal');
                
                this.tweens.add({
                  targets: finalePortal,
                  scale: 1,
                  alpha: 0.72,
                  duration: 1600,
                  ease: 'Back.easeOut',
                  onComplete: () => {
                    this.tweens.add({ targets: finalePortal, alpha: 0.62, duration: 600, yoyo: true, repeat: -1 });
                  }
                });

                this.tweens.add({
                  targets: labelSign,
                  alpha: 1,
                  duration: 800
                });

                this.cameras.main.pan(VIEW_W / 2, VIEW_H / 2, 1000, 'Cubic.easeInOut');
                this.cameras.main.zoomTo(1.0, 1000, 'Cubic.easeInOut');

                this.time.delayedCall(1000, () => {
                  this.isPlayingUnlockSequence = false;
                  this.hasEntered = false;
                  localStorage.setItem('played-finale-sequence-v1', 'true');
                  
                  this.focusBg.setPosition(VIEW_W / 2, VIEW_H - 54);
                  this.focusText.setPosition(VIEW_W / 2, VIEW_H - 70);
                  this.focusBg.setAlpha(1).setVisible(true);
                  this.focusText.setText('The final portal is now unlocked').setAlpha(1).setVisible(true);

                  this.time.delayedCall(3000, () => {
                    this.tweens.add({
                      targets: [this.focusBg, this.focusText],
                      alpha: 0,
                      duration: 400,
                      onComplete: () => {
                        this.focusBg.setVisible(false);
                        this.focusText.setVisible(false);
                      }
                    });
                  });
                });
              });
            }
          }
        });
      });
    }
  }
}
