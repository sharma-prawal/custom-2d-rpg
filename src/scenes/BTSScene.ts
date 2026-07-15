import Phaser from 'phaser';
import { BTS_NOTES } from '../data/btsContent';
import { MINI_GAMES } from '../data/miniGames';
import { Player } from '../entities/Player';
import { DialogueBox } from '../systems/DialogueBox';
import { InteractionPrompt } from '../systems/InteractionPrompt';
import { SceneFade } from '../systems/SceneFade';
import { AudioManager } from '../systems/AudioManager';
import { addAudioHud } from '../systems/AudioHud';
import { addMobileControls, consumeMobileAction } from '../systems/MobileControls';
import { fitViewportCover } from '../systems/ImageFit';
import { InteractionMarker } from '../systems/InteractionMarker';
import { AssetViewer } from '../systems/AssetViewer';
import { PhotoLightbox, LightboxPhoto } from '../systems/PhotoLightbox';
import { addSceneTitlePlaque, addSpotTag } from '../systems/EnvironmentalSignage';
import { addCinematicVignette, addSceneGrain, gradeCharacter } from '../systems/VisualTheme';

// The real HD photos behind the scrapbook restore (Memory 5) and every
// journal chapter — shown here at full resolution, uncropped, so they can
// actually be "properly opened" rather than only glimpsed cropped/small.
const PHOTO_WALL_PHOTOS: LightboxPhoto[] = [
  { key: 'bg-memory-5-album', caption: 'Scrapbook — The Photo, Restored' },
  { key: 'bg-memory-5-support-1', caption: 'Scrapbook — Among the Pines' },
  { key: 'bg-memory-5-support-2', caption: 'Scrapbook — On the Bridge' },
  { key: 'bg-memory-5-support-3', caption: 'Scrapbook — The Flying Dutchman' },
  ...MINI_GAMES.map((g) => ({ key: `journal-memory-${g.id}`, caption: `Chapter ${g.id} — ${g.journal.title}` })),
];

const VIEW_W = 1280;
const VIEW_H = 720;
const INTERACT_RANGE = 80;

interface DevStats {
  totalHours: number;
  totalPrompts: number;
  byTool: Record<string, { hours: number; prompts: number }>;
  codeFiles?: number;
  codeLines?: number;
  lastUpdated: string;
}

const DEFAULT_STATS: DevStats = {
  totalHours: 0,
  totalPrompts: 0,
  byTool: {},
  lastUpdated: 'not generated yet',
};

interface BtsSpot {
  x: number;
  y: number;
  key: string;
  label: string;
  narration: string[];
}

export class BTSScene extends Phaser.Scene {
  private player!: Player;
  private dialogue!: DialogueBox;
  private prompt!: InteractionPrompt;
  private viewer!: AssetViewer;
  private photoWall!: PhotoLightbox;
  private spots: BtsSpot[] = [];
  private markers = new Map<string, InteractionMarker>();
  private nearest: BtsSpot | null = null;
  private stats: DevStats = DEFAULT_STATS;
  private interactKeys!: Phaser.Input.Keyboard.Key[];
  private suppressTrigger = false;
  private consumedPointerTime = 0;
  /** Tracks whether the photo wall was open LAST frame so we can detect the
   * close transition and suppress the triggering click (same pattern used for
   * dialogue via the dialogueClosed event). Without this, interactJustDown()
   * detects the click that closed the lightbox within its 48-ms window and
   * immediately re-opens the photo wall. */
  private photoWallWasOpen = false;
  private leftKey!: Phaser.Input.Keyboard.Key;
  private rightKey!: Phaser.Input.Keyboard.Key;
  private upKey!: Phaser.Input.Keyboard.Key;
  private downKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('BTS');
  }

  create(): void {
    this.physics.world.setBounds(0, 0, VIEW_W, VIEW_H);
    fitViewportCover(this, this.add.image(VIEW_W / 2, VIEW_H / 2, 'bts-bg').setDepth(0), VIEW_W, VIEW_H);
    SceneFade.addAmbientTint(this, VIEW_W, VIEW_H, 0x7a5ea8, 0.18);
    addCinematicVignette(this, VIEW_W, VIEW_H, 0.24, 2);
    addSceneGrain(this, VIEW_W, VIEW_H, 3);

    addSceneTitlePlaque(this, VIEW_W / 2, 72, {
      title: 'Behind the Scenes',
      subtitle: 'archive room',
      accent: 0xc9a8ff,
      width: 500,
    });

    const cols = 3;
    const spacingX = 360;
    const spacingY = 220;
    const startX = 200;
    const startY = 220;

    this.spots = BTS_NOTES.map((note, i) => ({
      x: startX + (i % cols) * spacingX,
      y: startY + Math.floor(i / cols) * spacingY,
      key: `bts-note-${i}`,
      label: note.title,
      narration: [note.title, note.body],
    }));

    this.spots.push({ x: VIEW_W / 2 - 160, y: 620, key: 'stats-terminal', label: 'Stats Terminal', narration: [] });
    this.spots.push({ x: VIEW_W / 2 + 160, y: 620, key: 'asset-gallery', label: 'Asset Gallery', narration: [] });
    this.spots.push({ x: VIEW_W - 200, y: 380, key: 'photo-wall', label: 'Photo Wall', narration: [] });
    // EXIT spot — bottom-centre of the room, below the stats-terminal/asset-gallery
    // row so it reads as the natural "leave this room" destination.  INTERACT_RANGE=80
    // means the player triggers it when they reach the lower edge of the viewport.
    this.spots.push({ x: VIEW_W / 2, y: 648, key: 'exit-hub', label: '← Return to Hub', narration: [] });

    this.spots.forEach((spot) => {
      const color = spot.key === 'stats-terminal' ? 0x8fd9ff
        : spot.key === 'asset-gallery' ? 0xc9a8ff
        : spot.key === 'photo-wall' ? 0xffb6c9
        : spot.key === 'exit-hub' ? 0xc8f0c8   // soft mint-green — distinct "exit" colour
        : 0xffd9a0;
      this.markers.set(spot.key, new InteractionMarker(this, spot.x, spot.y, 4, color));
      // The exit-hub tag is placed manually below (see next block) to avoid
      // horizontal overlap with the stats-terminal and asset-gallery tags that
      // sit at the same y level when drawn at spot.y - 56.
      if (spot.key !== 'exit-hub') {
        addSpotTag(this, spot.x, spot.y - 56, {
          text: spot.label,
          width: spot.key.startsWith('bts-note') ? 178 : 182,
          accent: color,
        });
      }
    });

    // Exit tag drawn separately — placed BELOW its marker (spot.y + 52) so it
    // sits beneath the stats-terminal / asset-gallery row rather than between them.
    addSpotTag(this, VIEW_W / 2, 648 + 52, {
      text: '← Return to Hub',
      width: 182,
      accent: 0xc8f0c8,
    });


    // No walk-down toast — exit is now an explicit interactable spot.

    this.player = new Player(this, VIEW_W / 2, VIEW_H / 2, 'char-her-everyday');
    gradeCharacter(this.player.sprite, 0x7a5ea8, 0.94);
    this.dialogue = new DialogueBox(this, VIEW_W, VIEW_H);
    this.events.on('dialogueClosed', () => {
      this.suppressTrigger = true;
      if (this.input.activePointer.isDown) {
        this.consumedPointerTime = this.input.activePointer.downTime;
      }
    });
    this.prompt = new InteractionPrompt(this);
    this.viewer = new AssetViewer(this, VIEW_W, VIEW_H);
    this.photoWall = new PhotoLightbox(this, VIEW_W, VIEW_H);
    addMobileControls(this);

    this.interactKeys = [
      this.input.keyboard!.addKey('E'),
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
    ];
    this.leftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.rightKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.upKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.downKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);

    AudioManager.playMusic(this, 'music-bts');
    addAudioHud(this, VIEW_W);
    this.cameras.main.fadeIn(300, 0, 0, 0);

    this.loadStats();
  }

  private async loadStats(): Promise<void> {
    try {
      const res = await fetch('./stats.json');
      if (res.ok) {
        this.stats = await res.json();
      }
    } catch {
      // stats.json not generated yet — DEFAULT_STATS covers it.
    }
  }

  update(): void {
    // Detect photo-wall just-closed transition and suppress the triggering
    // pointer click from being treated as a fresh "open" interaction.
    const photoWallJustClosed = this.photoWallWasOpen && !this.photoWall.isOpen;
    this.photoWallWasOpen = this.photoWall.isOpen;

    if (this.photoWall.isOpen) {
      this.photoWall.update();
      return;
    }

    if (photoWallJustClosed) {
      // Same as suppressTrigger after dialogue: eat the closing click so it
      // doesn't immediately re-open the photo wall in the very next frame.
      this.suppressTrigger = true;
      if (this.input.activePointer.isDown) {
        this.consumedPointerTime = this.input.activePointer.downTime;
      }
    }

    if (this.viewer.isOpen) {
      this.updateViewer();
      return;
    }

    const moving = this.player.update(this.dialogue.isActive);
    void moving; // movement handled by physics; hub exit is now via the EXIT spot

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
      if (this.nearest) {
        AudioManager.playSfx(this, 'sfx-interact');
        if (this.nearest.key === 'stats-terminal') {
          this.dialogue.show(this.formatStats());
        } else if (this.nearest.key === 'asset-gallery') {
          this.viewer.open();
        } else if (this.nearest.key === 'photo-wall') {
          this.photoWall.open(PHOTO_WALL_PHOTOS);
        } else if (this.nearest.key === 'exit-hub') {
          this.returnToHub();
        } else {
          this.dialogue.show(this.nearest.narration);
        }
        return;
      }
    }

    if (this.dialogue.isActive) {
      this.prompt.hide();
      return;
    }

    this.updateNearest();
  }

  private updateViewer(): void {
    if (Phaser.Input.Keyboard.JustDown(this.rightKey)) this.viewer.next();
    if (Phaser.Input.Keyboard.JustDown(this.leftKey)) this.viewer.prev();
    if (Phaser.Input.Keyboard.JustDown(this.downKey)) this.viewer.nextCategory();
    if (Phaser.Input.Keyboard.JustDown(this.upKey)) this.viewer.prevCategory();
    if (Phaser.Input.Keyboard.JustDown(this.interactKeys[0]) || Phaser.Input.Keyboard.JustDown(this.interactKeys[2])) {
      this.viewer.togglePreview();
    }
    const pointer = this.input.activePointer;
    if (Phaser.Input.Keyboard.JustDown(this.interactKeys[1]) || (pointer.isDown && pointer.downTime >= this.time.now - 48)) {
      this.viewer.close();
    }
  }

  private updateNearest(): void {
    let nearest: BtsSpot | null = null;
    let nearestDist = Infinity;
    for (const spot of this.spots) {
      const dist = Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, spot.x, spot.y);
      if (dist < INTERACT_RANGE && dist < nearestDist) {
        nearest = spot;
        nearestDist = dist;
      }
    }

    if (nearest?.key !== this.nearest?.key) {
      // Same overlapping-glow issue as MemoryScene: InteractionMarker's
      // ambient ring sits at the spot itself, InteractionPrompt draws its
      // own ring ~40px above once in range — leaving both on stacks two
      // rings around the same spot right as "Inspect" appears.
      if (this.nearest) this.markers.get(this.nearest.key)?.setVisible(true);
      if (nearest) this.markers.get(nearest.key)?.setVisible(false);
    }
    this.nearest = nearest;

    if (nearest) {
      this.prompt.showAt(nearest.x, nearest.y - 40);
    } else {
      this.prompt.hide();
    }
  }

  private formatStats(): string[] {
    const toolLines = Object.entries(this.stats.byTool).map(
      ([tool, s]) => `${tool}: ${s.hours.toFixed(1)}h / ${s.prompts} prompts`,
    );
    const codeLine = this.stats.codeLines
      ? `${this.stats.codeLines.toLocaleString()} lines of code across ${this.stats.codeFiles} source files`
      : undefined;
    return [
      `Total build time: ${this.stats.totalHours.toFixed(1)} hours`,
      `Total prompts across every AI tool: ${this.stats.totalPrompts}`,
      ...(codeLine ? [codeLine] : []),
      ...(toolLines.length ? toolLines : ['(run "npm run stats" to generate this from docs/dev-log.jsonl)']),
    ];
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

  private returnToHub(): void {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('Hub');
    });
  }
}
