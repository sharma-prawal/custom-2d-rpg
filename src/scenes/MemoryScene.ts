import Phaser from 'phaser';
import { getMemoryByIndex, MemoryData } from '../data/memories';
import { Player } from '../entities/Player';
import { NPC } from '../entities/NPC';
import { DialogueBox } from '../systems/DialogueBox';
import { InteractionPrompt } from '../systems/InteractionPrompt';
import { SceneFade } from '../systems/SceneFade';
import { SaveState } from '../systems/SaveState';
import { AudioManager } from '../systems/AudioManager';
import { addAudioHud } from '../systems/AudioHud';
import { addMobileControls, consumeMobileAction } from '../systems/MobileControls';
import { fitViewportCover } from '../systems/ImageFit';
import { InteractionMarker } from '../systems/InteractionMarker';
import { addCinematicVignette, addSceneGrain, addSoftPanel, Fonts, gradeCharacter, setActiveMemoryTheme } from '../systems/VisualTheme';

const VIEW_W = 1280;
const VIEW_H = 720;
const INTERACT_RANGE = 96;
// Location card slide-in (360) + hold (2800) + fade-out (600) — the intro
// dialogue used to start at the same moment as the card, so both sat on
// screen together for ~3.7s before the card cleared. Read by both
// showLocationCard() (its own fade-out delay) and create() (when the intro
// dialogue is allowed to start), so the two can't drift out of sync.
const LOCATION_CARD_LIFETIME_MS = 360 + 2800 + 600;
const CHARACTER_PLACEMENTS: Record<number, { her: [number, number]; him: [number, number] }> = {
  1: { her: [250, 590], him: [940, 540] },
  2: { her: [1000, 590], him: [830, 575] },
  3: { her: [420, 585], him: [790, 555] },
  4: { her: [900, 590], him: [420, 575] },
  5: { her: [920, 580], him: [1030, 565] },
  6: { her: [1020, 590], him: [780, 575] },
  7: { her: [1020, 590], him: [700, 570] },
};

interface MemoryStartData {
  memoryIndex: number;
}

export class MemoryScene extends Phaser.Scene {
  private memory!: MemoryData;
  private player!: Player;
  private dialogue!: DialogueBox;
  private prompt!: InteractionPrompt;
  private propSprites: { key: string; marker: InteractionMarker; x: number; y: number; narration: string[] }[] = [];
  private visited = new Set<string>();
  private interactKeys!: Phaser.Input.Keyboard.Key[];
  private locked = true;
  private nearestPropKey: string | null = null;
  private finished = false;
  private suppressTrigger = false;
  private consumedPointerTime = 0;

  constructor() {
    super('Memory');
  }

  create(data: MemoryStartData): void {
    const memory = getMemoryByIndex(data.memoryIndex);
    if (!memory) {
      this.scene.start('Hub');
      return;
    }
    this.memory = memory;
    // Still needed for its side effect: it sets the module-level "active"
    // theme that MiniGameScene/JournalScene/DialogueBox read from when this
    // memory's mini-game or journal page opens next — just not used here
    // for the scene's own ambient tint (see the note below).
    setActiveMemoryTheme(memory.index);
    this.visited = new Set();
    this.locked = true;
    this.finished = false;

    this.physics.world.setBounds(0, 0, VIEW_W, VIEW_H);
    const bg = this.add.image(VIEW_W / 2, VIEW_H / 2, memory.backgroundKey).setDepth(0);
    fitViewportCover(this, bg, VIEW_W, VIEW_H);
    // Cover-fit sizes the background to exactly match the viewport with zero
    // margin, so any camera pan/offset — including the small cinematic nudge
    // below — can push the view past its edge and reveal empty space. Bound
    // the camera to the background's own rect so Phaser clamps that for us.
    this.cameras.main.setBounds(
      bg.x - bg.displayWidth / 2,
      bg.y - bg.displayHeight / 2,
      bg.displayWidth,
      bg.displayHeight,
    );
    // Each memory has its own hand-tuned ambient tint matched to its
    // background art (memories.ts). The mini-game theme system's
    // `memoryGlow` is a puzzle-UI accent color (crossword tiles, journal
    // decoration) — not a substitute for that per-scene color grade.
    SceneFade.addAmbientTint(this, VIEW_W, VIEW_H, memory.ambientTint, memory.ambientAlpha);
    addCinematicVignette(this, VIEW_W, VIEW_H, 0.17, 2);
    addSceneGrain(this, VIEW_W, VIEW_H, 3);

    // The backgrounds already paint these objects in place (a cake, a
    // calendar, a bench...) — a marker just signals "look here" rather than
    // stamping a second icon on top of the illustration.
    this.propSprites = memory.props.map((prop) => {
      const marker = new InteractionMarker(this, prop.x, prop.y);
      return { key: prop.key, marker, x: prop.x, y: prop.y, narration: prop.narration };
    });

    const placement = CHARACTER_PLACEMENTS[memory.index] ?? { her: [224, 600], him: [920, 512] };
    const npc = new NPC(this, placement.him[0], placement.him[1], `char-him-${memory.hisOutfit}`, true);
    this.player = new Player(this, placement.her[0], placement.her[1], `char-her-${memory.herOutfit}`);
    gradeCharacter(npc.sprite, memory.ambientTint, 0.92);
    gradeCharacter(this.player.sprite, memory.ambientTint, 0.94);

    this.dialogue = new DialogueBox(this, VIEW_W, VIEW_H);
    this.events.on('dialogueClosed', () => {
      this.suppressTrigger = true;
      if (this.input.activePointer.isDown) {
        this.consumedPointerTime = this.input.activePointer.downTime;
      }
    });
    this.prompt = new InteractionPrompt(this);
    addMobileControls(this);

    this.interactKeys = [
      this.input.keyboard!.addKey('E'),
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
    ];

    this.showLocationCard();
    AudioManager.playMusic(this, memory.musicKey);
    addAudioHud(this, VIEW_W);
    // Pan target must track the actual (possibly EXPAND-scaled) viewport
    // center, not the fixed 1280x720 design size — panning to a design-space
    // point while the cover-scaled background is centered on the real
    // viewport opens a gap at the trailing edge on wider-than-16:9 windows.
    const centerX = Math.max(VIEW_W, this.scale.gameSize.width) / 2;
    const centerY = Math.max(VIEW_H, this.scale.gameSize.height) / 2;
    this.cameras.main.pan(centerX + 22, centerY, 1600, 'Sine.easeInOut', false);

    // Wait for the location card to fully clear before showing the intro
    // dialogue — the two used to start together and sit on screen at once.
    this.time.delayedCall(LOCATION_CARD_LIFETIME_MS, () => {
      this.dialogue.show(memory.intro, () => {
        this.locked = false;
      });
    });

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  update(): void {
    this.player.update(this.locked || this.finished);

    if (this.suppressTrigger) {
      if (!this.interactJustDown() && !this.input.activePointer.isDown) {
        this.suppressTrigger = false;
      }
      return;
    }

    if (this.interactJustDown()) {
      if (this.dialogue.isActive) {
        return;
      }
      if (this.nearestPropKey && !this.finished) {
        this.triggerProp(this.nearestPropKey);
        return;
      }
    }

    if (this.dialogue.isActive || this.finished) {
      this.prompt.hide();
      return;
    }

    this.updateNearestProp();
  }

  private updateNearestProp(): void {
    let nearest: (typeof this.propSprites)[number] | null = null;
    let nearestDist = Infinity;

    for (const prop of this.propSprites) {
      // Once read, a prop shouldn't keep re-triggering just because the
      // player is still standing near it and presses the interact key
      // again — that reads as the dialogue being "stuck in a loop" even
      // though each open is technically a fresh, correct interaction.
      if (this.visited.has(prop.key)) continue;
      const dist = Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, prop.x, prop.y);
      if (dist < INTERACT_RANGE && dist < nearestDist) {
        nearest = prop;
        nearestDist = dist;
      }
    }

    const newNearestKey = nearest?.key ?? null;
    if (newNearestKey !== this.nearestPropKey) {
      // InteractionMarker's ambient glow sits at the prop's own position to
      // catch the eye from a distance; InteractionPrompt draws its own glow
      // ~34px above that once in range. Left both on at once, they read as
      // two overlapping rings around the same spot the moment the player
      // gets close enough to see "Inspect." Hand off between them instead.
      const previous = this.propSprites.find((p) => p.key === this.nearestPropKey);
      previous?.marker.setVisible(true);
      nearest?.marker.setVisible(false);
    }
    this.nearestPropKey = newNearestKey;

    if (nearest) {
      this.prompt.showAt(nearest.x, nearest.y - 34);
    } else {
      this.prompt.hide();
    }
  }

  private triggerProp(key: string): void {
    const prop = this.propSprites.find((p) => p.key === key);
    if (!prop) return;

    AudioManager.playSfx(this, 'sfx-interact');
    this.visited.add(key);
    prop.marker.setVisible(false);
    this.prompt.hide();
    this.dialogue.show(prop.narration, () => {
      if (this.visited.size >= this.propSprites.length) {
        this.finished = true;
        this.emitSparkle(this.player.sprite.x, this.player.sprite.y);
        this.dialogue.show(this.memory.closing, () => this.completeMemory());
      }
    });
  }

  /**
   * A brief particle-like sparkle burst at (x, y) to celebrate visiting the
   * last prop in a memory. Uses a small set of tweened circles to avoid
   * needing the Phaser particle system (which requires a texture key).
   */
  private emitSparkle(x: number, y: number): void {
    const count = 10;
    const color = Phaser.Display.Color.IntegerToColor(this.memory.ambientTint).color;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = Phaser.Math.Between(18, 52);
      const dot = this.add.circle(x, y, Phaser.Math.Between(3, 6), color, 0.9).setDepth(15);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * radius,
        y: y + Math.sin(angle) * radius,
        alpha: 0,
        scaleX: 0.3,
        scaleY: 0.3,
        duration: Phaser.Math.Between(420, 720),
        ease: 'Cubic.easeOut',
        delay: i * 28,
        onComplete: () => dot.destroy(),
      });
    }
    // Central flash
    const flash = this.add.circle(x, y, 28, 0xffffff, 0.36).setDepth(16);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2.2,
      duration: 340,
      ease: 'Cubic.easeOut',
      onComplete: () => flash.destroy(),
    });
  }

  private completeMemory(): void {
    AudioManager.playSfx(this, 'sfx-portal');
    // Warm dark tint on exit — slightly purple-warm rather than pure black,
    // makes the cut to the mini-game feel intentional and cinematic.
    this.cameras.main.fadeOut(400, 8, 4, 10);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      if (SaveState.hasCompletedMiniGame(this.memory.index)) {
        this.scene.start('Hub', { fromIndex: this.memory.index });
      } else {
        this.scene.start('MiniGame', { memoryIndex: this.memory.index });
      }
    });
  }

  private interactJustDown(): boolean {
    const pointer = this.input.activePointer;
    const pointerDown =
      pointer.isDown &&
      pointer.downTime >= this.time.now - 48 &&
      pointer.downTime !== this.consumedPointerTime;
    if (
      this.interactKeys.some((k) => Phaser.Input.Keyboard.JustDown(k)) ||
      consumeMobileAction(this) ||
      pointerDown
    ) {
      if (pointerDown) {
        this.consumedPointerTime = pointer.downTime;
      }
      return true;
    }
    return false;
  }

  private showLocationCard(): void {
    // Slide in from slightly left, then fade out after the player has had time to read.
    const CARD_X = 410;
    const CARD_Y = 92;
    const SLIDE_OFFSET = 32;

    const panel = addSoftPanel(this, CARD_X, CARD_Y, 680, 116, 950, 0x090911, 0.58);
    const title = this.add
      .text(
        102,
        CARD_Y - 44,
        this.memory.title,
        {
          fontFamily: Fonts.body,
          fontSize: '25px',
          color: '#f5ecd8',
          align: 'left',
          wordWrap: { width: 600 },
          maxLines: 1,
        },
      )
      .setOrigin(0, 0)
      .setDepth(950)
      .setScrollFactor(0);
    const subtitle = this.add
      .text(103, CARD_Y - 6, `${this.memory.setting}\n${this.memory.timeOfDay}, ${this.memory.season}`, {
        fontFamily: Fonts.ui,
        fontSize: '15px',
        color: '#d8cabb',
        align: 'left',
        wordWrap: { width: 596 },
        lineSpacing: 5,
        maxLines: 2,
      })
      .setOrigin(0, 0)
      .setDepth(950)
      .setScrollFactor(0)
      .setAlpha(0.88);

    // Start invisible and offset left
    [panel, title, subtitle].forEach((obj) => {
      obj.setAlpha(0);
      // shift the container/text left by SLIDE_OFFSET
      if ('x' in obj) (obj as { x: number }).x -= SLIDE_OFFSET;
    });

    // Slide + fade in
    this.tweens.add({
      targets: [panel, title, subtitle],
      alpha: 1,
      x: `+=${SLIDE_OFFSET}`,
      duration: 360,
      ease: 'Cubic.easeOut',
    });

    // Hold, then slide slightly right and fade out
    this.tweens.add({
      targets: [panel, title, subtitle],
      alpha: 0,
      x: `+=${SLIDE_OFFSET * 0.5}`,
      delay: LOCATION_CARD_LIFETIME_MS - 600,
      duration: 600,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        title.destroy();
        subtitle.destroy();
        panel.destroy();
      },
    });
  }
}
