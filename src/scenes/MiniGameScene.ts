import Phaser from 'phaser';
import { getMiniGameByMemory, MiniGameConfig } from '../data/miniGames';
import { AudioManager } from '../systems/AudioManager';
import { addAudioHud } from '../systems/AudioHud';
import { fitViewportCover, sharpVariantKey } from '../systems/ImageFit';
import { SaveState } from '../systems/SaveState';
import { addCinematicVignette, addGlassShimmer, addSceneGrain, addSoftPanel, Fonts, getActiveMemoryTheme, setActiveMemoryTheme } from '../systems/VisualTheme';

const VIEW_W = 1280;
const VIEW_H = 720;

interface MiniGameStartData {
  memoryIndex: number;
}

export class MiniGameScene extends Phaser.Scene {
  private configData!: MiniGameConfig;
  private completed = false;
  private progressText?: Phaser.GameObjects.Text;
  private progressPlate?: Phaser.GameObjects.Container;
  private progressBarFill?: Phaser.GameObjects.Rectangle;
  private progressBarGlow?: Phaser.GameObjects.Rectangle;

  // Spot the Difference state
  private diffSolved = new Set<string>();
  private diffHintActive = false;
  private diffImgLeft?: Phaser.GameObjects.Image;
  private diffImgRight?: Phaser.GameObjects.Image;
  private diffContainerLeft?: Phaser.GameObjects.Container;
  private diffContainerRight?: Phaser.GameObjects.Container;
  private diffGems: Phaser.GameObjects.Arc[] = [];
  private diffSparkleTimer?: Phaser.Time.TimerEvent;
  private diffIsMobile = false;
  private diffActiveSide: 'original' | 'changed' = 'original';
  private diffCaptionPanel?: Phaser.GameObjects.Container;
  private diffCaptionText?: Phaser.GameObjects.Text;

  // Scrapbook state
  private scrapSolved = new Set<string>();
  private scrapPiecesPlaced = 0;
  private scrapHeroContainer?: Phaser.GameObjects.Container;
  private scrapDevelopedImg?: Phaser.GameObjects.Image;
  private scrapNoteContainer?: Phaser.GameObjects.Container;
  private scrapIsMobile = false;
  private scrapMasks: Phaser.GameObjects.Graphics[] = [];

  // Office Escape state
  private escapeDiscovered = new Set<string>();
  private escapeActiveHotspotKey?: string;
  private escapeNotebookContainer?: Phaser.GameObjects.Container;
  private notebookRowElements: Phaser.GameObjects.GameObject[] = [];
  private escapeLockContainer?: Phaser.GameObjects.Container;
  private escapeLockDrawn = false;
  private escapeAmbientGlow?: Phaser.GameObjects.Rectangle;
  private escapeLockCodeEntered = '';
  private escapeLockDigitsText?: Phaser.GameObjects.Text;
  private escapeInstrContainer?: Phaser.GameObjects.Container;
  private escapeCameraTween?: Phaser.Tweens.Tween;

  // Diary Fill-In state (Memory 7 — "Fill the Missing Diary")
  private diaryBlanks: Array<{
    worldX: number; // blank's centre in scene/world space — used for drop-distance + sparkle position
    worldY: number;
    localX: number; // blank's left edge in the page container's local space — matches word text origin (0, 0.5)
    localY: number;
    width: number;
    answer: string;
    filled: boolean;
    line: Phaser.GameObjects.Graphics;
    glow: Phaser.GameObjects.Rectangle;
  }> = [];
  private diaryPlacedCount = 0;
  private diaryTotalBlanks = 0;
  private diaryPageContainer?: Phaser.GameObjects.Container;
  private diaryPageW = 740;
  private diaryPageH = 520;
  // Local y (relative to the page's own centre) of the last paragraph line —
  // set once layout finishes, so the closing-line flourish can be placed
  // just below whatever actually got rendered instead of a fixed offset.
  private diaryParagraphBottomY = 0;
  private diaryRibbon?: Phaser.GameObjects.Container;
  private diaryInkWords: Phaser.GameObjects.Text[] = [];
  private diaryStripRefs: Array<{ container: Phaser.GameObjects.Container; word: string }> = [];
  private diaryCompleting = false;

  // Find the Moments — tooltip queue. Clicking several hidden spots in quick
  // succession (very easy to do once you know where a few are) used to spawn
  // one independent, fixed-duration tooltip per click with no coordination,
  // so they piled up and overlapped into unreadable stacked text. Queuing
  // guarantees exactly one on screen at a time, each shown for its own full
  // reveal — every discovery still gets read, none of them collide.
  private momentTooltipQueue: Array<{ x: number; y: number; title: string; description: string; icon?: string }> = [];
  private momentTooltipActive = false;
  private pendingMomentCompletion?: () => void;

  constructor() {
    super('MiniGame');
  }

  create(data: MiniGameStartData): void {
    const config = getMiniGameByMemory(data.memoryIndex);
    if (!config) {
      this.scene.start('Hub');
      return;
    }
    this.configData = config;
    const theme = setActiveMemoryTheme(config.id);
    this.completed = false;
    this.pendingMomentCompletion = undefined;

    const bgKey = config.miniGameConfig.backgroundKey ?? `bg-memory-${config.id}`;
    if (this.textures.exists(bgKey)) {
      fitViewportCover(this, this.add.image(VIEW_W / 2, VIEW_H / 2, bgKey).setDepth(0), VIEW_W, VIEW_H);
    } else {
      this.add.rectangle(VIEW_W / 2, VIEW_H / 2, VIEW_W, VIEW_H, 0x141019, 1).setDepth(0);
    }
    // Conversation Reconstruction is built to let the rooftop stay visible
    // and present, not buried under a scrim — every other mini-game keeps
    // the heavier overlay since they lean on flat UI panels instead.
    const isConversationReconstruction = config.miniGameType === 'rearrange-dialogue' || config.miniGameConfig.memory7Diary !== undefined;
    this.add.rectangle(VIEW_W / 2, VIEW_H / 2, Math.max(VIEW_W, this.scale.gameSize.width), Math.max(VIEW_H, this.scale.gameSize.height), 0x090911, isConversationReconstruction ? 0.14 : 0.34).setDepth(1);
    addCinematicVignette(this, VIEW_W, VIEW_H, isConversationReconstruction ? 0.16 : 0.32, 2);
    addSceneGrain(this, VIEW_W, VIEW_H, 3);
    addAudioHud(this, VIEW_W);

    if (config.miniGameType !== 'photo-album-restore') {
      const subtitle = config.miniGameConfig.memory2ConversationPuzzle?.subtitle ?? config.miniGameConfig.memory7Diary?.subtitle ?? `Memory ${config.id} reconstruction`;
      this.addMiniGameHeader(config.title, subtitle, theme.primary);
    }

    switch (config.miniGameType) {
      case 'find-the-moments':
        this.renderFindMoments();
        break;
      case 'conversation-crossword':
        this.renderCrossword();
        break;
      case 'rearrange-dialogue':
        this.renderConversationReconstruction();
        break;
      case 'hidden-differences':
        this.renderHiddenDifferences();
        break;
      case 'photo-album-restore':
        this.renderAlbumRestore();
        break;
      case 'office-escape-puzzle':
        this.renderOfficeEscape();
        break;
      case 'diary-fill-in':
        this.renderDiaryFillIn();
        break;
    }

    this.cameras.main.fadeIn(260, 0, 0, 0);
  }

  private addProgress(text: string, filled?: number, total?: number): void {
    this.progressText?.destroy();
    this.progressPlate?.destroy();
    this.progressBarFill?.destroy();
    this.progressBarGlow?.destroy();

    const theme = setActiveMemoryTheme(this.configData?.id);
    const y = VIEW_H - 30;
    const barW = 352;
    const barH = 4;

    // Glassmorphic backing panel — slightly wider to accommodate the bar
    this.progressPlate = addSoftPanel(this, VIEW_W / 2, y, barW + 44, 42, 39, 0x090911, 0.62, true);

    // Thin progress bar track
    const track = this.add.rectangle(VIEW_W / 2, y + 10, barW, barH, 0x000000, 0.44).setDepth(40).setScrollFactor(0);
    track.setStrokeStyle(1, theme.border, 0.18);
    void track;

    // Animated fill — lerps from 0 to the filled ratio if provided
    if (filled !== undefined && total !== undefined && total > 0) {
      const ratio = Phaser.Math.Clamp(filled / total, 0, 1);
      const fillTarget = Math.max(4, barW * ratio);
      this.progressBarFill = this.add
        .rectangle(VIEW_W / 2 - barW / 2, y + 10, 4, barH, theme.progressColor, 0.92)
        .setOrigin(0, 0.5)
        .setDepth(41)
        .setScrollFactor(0);
      this.tweens.add({
        targets: this.progressBarFill,
        width: fillTarget,
        duration: 340,
        ease: 'Sine.easeOut',
      });
      // Trailing glow on the fill leading edge
      this.progressBarGlow = this.add
        .rectangle(VIEW_W / 2 - barW / 2, y + 10, 12, barH + 4, theme.highlightColor, 0)
        .setOrigin(0, 0.5)
        .setDepth(42)
        .setScrollFactor(0);
      this.tweens.add({
        targets: this.progressBarGlow,
        x: VIEW_W / 2 - barW / 2 + fillTarget - 6,
        alpha: { from: 0.72, to: 0 },
        duration: 380,
        ease: 'Sine.easeOut',
      });
    }

    this.progressText = this.add
      .text(VIEW_W / 2, y - 8, text, {
        fontFamily: Fonts.ui,
        fontSize: text.length > 34 ? '13px' : '15px',
        color: '#f5ecd8',
        align: 'center',
        fixedWidth: barW,
        wordWrap: { width: barW },
        maxLines: 1,
      })
      .setOrigin(0.5)
      .setDepth(40)
      .setScrollFactor(0);
  }

  private addMiniGameHeader(title: string, subtitle: string, accent: number): void {
    // Size the backing panel to the actual text content so there is no
    // wide empty black block to the right of shorter titles.
    const panelW = Math.min(420, Math.max(230, title.length * 12 + 90));
    const panel = this.add.rectangle(30, 28, panelW, 56, 0x090911, 0.28).setOrigin(0, 0).setDepth(20).setScrollFactor(0);
    panel.setStrokeStyle(1, accent, 0.22);

    // Radiant halo behind the header — a large diffuse ellipse that pulses slowly
    const halo = this.add.ellipse(30 + panelW / 2, 54, panelW + 80, 80, accent, 0).setDepth(19).setScrollFactor(0);
    this.tweens.add({ targets: halo, alpha: 0.06, scale: 1.04, yoyo: true, repeat: -1, duration: 3200, ease: 'Sine.easeInOut' });

    // Accent bar starts at zero height and grows down — a quick cinematic reveal
    const accentBar = this.add.rectangle(48, 39, 2, 0, accent, 0.44).setDepth(21).setScrollFactor(0);
    this.tweens.add({ targets: accentBar, height: 30, duration: 380, ease: 'Sine.easeOut' });

    const textW = panelW - 70;
    const titleText = this.add.text(62, 35, title, {
      fontFamily: Fonts.title,
      fontSize: title.length > 28 ? '20px' : '24px',
      color: Phaser.Display.Color.IntegerToColor(accent).rgba,
      fixedWidth: textW,
      wordWrap: { width: textW },
      maxLines: 1,
    }).setOrigin(0, 0).setDepth(21).setScrollFactor(0);
    const subtitleText = this.add.text(63, 63, subtitle, {
      fontFamily: Fonts.ui,
      fontSize: '11px',
      color: '#d8cabb',
      fixedWidth: textW,
      wordWrap: { width: textW },
      maxLines: 1,
    }).setOrigin(0, 0).setAlpha(0.76).setDepth(21).setScrollFactor(0);

    // Slide the entire header in from the left
    const headerGroup = [panel, accentBar, titleText, subtitleText, halo];
    headerGroup.forEach((obj) => { (obj as Phaser.GameObjects.Rectangle).x -= 24; });
    this.tweens.add({
      targets: headerGroup,
      x: '+=24',
      alpha: { from: 0, to: 1 },
      duration: 420,
      ease: 'Sine.easeOut',
      onComplete: () => {
        // Glass shimmer sweep once the header has settled
        addGlassShimmer(this, 249, 56, 438, 56, 22);
      },
    });

    // Subtle periodic shimmer every 9 seconds
    this.time.addEvent({
      delay: 9000,
      loop: true,
      callback: () => addGlassShimmer(this, 249, 56, 438, 56, 22),
    });
  }


  private renderFindMoments(): void {
    const theme = setActiveMemoryTheme(this.configData.id);
    const found = new Set<string>();
    const objects = this.configData.miniGameConfig.hiddenObjects ?? [];
    const ornaments: Phaser.GameObjects.Arc[] = [];
    const foundLights: Phaser.GameObjects.Arc[] = [];
    const sparkleTimers: Phaser.Time.TimerEvent[] = [];
    this.momentTooltipQueue = [];
    this.momentTooltipActive = false;

    this.add.text(VIEW_W / 2, 96, 'find the hidden memories — tap the glowing spots', {
      fontFamily: Fonts.ui,
      fontSize: '17px',
      color: Phaser.Display.Color.IntegerToColor(theme.primary).rgba,
    }).setOrigin(0.5).setDepth(32).setAlpha(0.88);

    this.add.rectangle(VIEW_W / 2, VIEW_H - 42, 344, 48, theme.panelBackground, 0.42).setDepth(31).setStrokeStyle(1, theme.border, 0.18);
    this.add.text(VIEW_W / 2, VIEW_H - 56, 'Memory Fragments', {
      fontFamily: Fonts.ui,
      fontSize: '15px',
      color: Phaser.Display.Color.IntegerToColor(theme.primary).rgba,
    }).setOrigin(0.5).setDepth(32);
    objects.forEach((_object, index) => {
      const x = VIEW_W / 2 - ((objects.length - 1) * 17) / 2 + index * 17;
      const ornament = this.add.circle(x, VIEW_H - 28, 5, theme.shadow, 0.58).setDepth(32);
      ornament.setStrokeStyle(1, theme.secondary, 0.8);
      ornaments.push(ornament);
    });

    this.addDustParticles();
    this.addLeafDrift();

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.completed) return;
      const dx = Phaser.Math.Clamp((pointer.x / VIEW_W - 0.5) * 18, -18, 18);
      const dy = Phaser.Math.Clamp((pointer.y / VIEW_H - 0.5) * 14, -14, 14);
      this.cameras.main.setScroll(-dx, -dy);
    });

    objects.forEach((object, index) => {
      const id = object.id ?? object.key;
      const width = object.width ?? 42;
      const height = object.height ?? 42;
      const shimmer = this.add.circle(object.x, object.y, 5, theme.memoryGlow, 0).setDepth(13);
      const hoverBloom = this.add.ellipse(object.x, object.y, width * 0.9, height * 0.75, theme.glow, 0).setDepth(12);
      const zone = this.add.zone(object.x, object.y, width, height).setDepth(14).setInteractive({ useHandCursor: true });
      foundLights.push(shimmer);

      sparkleTimers.push(this.time.addEvent({
        delay: 1900 + index * 260,
        loop: true,
        callback: () => {
          if (!found.has(id)) this.emitTinySparkle(object.x, object.y, 0.32);
        },
      }));

      zone.on('pointerover', () => {
        if (found.has(id)) return;
        this.tweens.add({ targets: hoverBloom, alpha: 0.22, scale: 1.12, duration: 180, ease: 'Sine.easeOut' });
        this.tweens.add({ targets: shimmer, alpha: 0.38, scale: 1.9, yoyo: true, repeat: -1, duration: 620 });
      });
      zone.on('pointerout', () => {
        if (found.has(id)) return;
        this.tweens.killTweensOf([hoverBloom, shimmer]);
        hoverBloom.setAlpha(0).setScale(1);
        shimmer.setAlpha(0).setScale(1);
      });
      zone.on('pointerdown', () => {
        if (found.has(id)) return;
        found.add(id);
        zone.disableInteractive();
        this.tweens.killTweensOf([hoverBloom, shimmer]);
        hoverBloom.setAlpha(0.24).setScale(1);
        shimmer.setAlpha(0.72).setScale(1.6);
        this.tweens.add({ targets: shimmer, scale: 3.2, alpha: 0.18, duration: 700, ease: 'Sine.easeOut' });
        this.cameras.main.zoomTo(1.025, 260, 'Sine.easeOut');
        this.time.delayedCall(290, () => this.cameras.main.zoomTo(1, 360, 'Sine.easeInOut'));
        this.showMomentTooltip(object.x, object.y, object.title ?? object.key, object.description ?? object.caption, object.icon);
        ornaments[index].setFillStyle(theme.progressColor, 0.95).setStrokeStyle(1, theme.highlightColor, 0.95);
        this.tweens.add({ targets: ornaments[index], scale: 1.45, yoyo: true, duration: 220 });
        AudioManager.playSfx(this, 'sfx-interact');
        if (found.size >= objects.length) {
          sparkleTimers.forEach((timer) => timer.remove(false));
          this.pendingMomentCompletion = () => this.completeFindMoments(foundLights);
          if (!this.momentTooltipActive && this.momentTooltipQueue.length === 0) {
            const pending = this.pendingMomentCompletion;
            this.pendingMomentCompletion = undefined;
            this.time.delayedCall(260, pending);
          }
        }
      });
    });
  }

  private renderCrossword(): void {
    const theme = setActiveMemoryTheme(this.configData.id);
    const puzzle = this.configData.miniGameConfig.memory2ConversationPuzzle;
    type PuzzleWord = {
      id: string;
      answer: string;
      clue: string;
      hint: string;
      fragment?: string;
      row: number;
      col: number;
      direction: 'across' | 'down';
      hotspot: { label: string; x: number; y: number; width?: number; height?: number; revealLetterIndex?: number };
    };
    const words = puzzle?.words ?? (this.configData.miniGameConfig.crossword ?? []).map((entry, index) => ({
      id: entry.answer.toLowerCase(),
      answer: entry.answer,
      clue: entry.clue,
      hint: 'A fragment of care waiting to be restored.',
      fragment: undefined,
      row: index,
      col: 0,
      direction: 'across' as const,
      hotspot: { label: entry.answer.toLowerCase(), x: 0.5, y: 0.42 + index * 0.06, width: 0.07, height: 0.08, revealLetterIndex: 0 },
    } satisfies PuzzleWord));
    const puzzleWords = words as PuzzleWord[];
    if (!puzzleWords.length) {
      this.complete();
      return;
    }

    const solved = new Set<string>();
    const typed = new Map<string, string>();
    let selectedId = puzzleWords[0].id;
    let completing = false;
    const cellTexts = new Map<string, Phaser.GameObjects.Text>();
    const cellRects = new Map<string, Phaser.GameObjects.Rectangle>();
    const cellGlows = new Map<string, Phaser.GameObjects.Ellipse>();
    const clueRows = new Map<string, Phaser.GameObjects.Container>();
    const clueChecks = new Map<string, Phaser.GameObjects.Graphics>();
    const hotspotMarkers = new Map<string, Phaser.GameObjects.Ellipse>();
    const revealedFragments: (string | undefined)[] = [];
    const reconstructionOrnaments: Phaser.GameObjects.Arc[] = [];

    this.addDustParticles();
    this.addLeafDrift();
    const windowBloom = this.add.ellipse(1040, 230, 230, 170, theme.memoryGlow, 0.08).setDepth(3);
    this.tweens.add({ targets: windowBloom, alpha: 0.16, scale: 1.05, yoyo: true, repeat: -1, duration: 2600, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: this.cameras.main, zoom: 1.006, yoyo: true, repeat: -1, duration: 4200, ease: 'Sine.easeInOut' });

    addSoftPanel(this, 360, 400, 500, 435, 8, 0x090911, 0.5);
    addSoftPanel(this, 930, 402, 430, 438, 8, 0x090911, 0.58);
    this.add.image(360, 402, 'parchment-panel').setDisplaySize(470, 390).setAlpha(0.32).setDepth(8);

    // Tall enough to hold both the current hint AND the growing list of
    // revealed conversation fragments below it — these used to live in two
    // separate, independently-positioned blocks (a 54px hint strip plus six
    // fixed-row fragment lines starting right where that strip began), so
    // revealing even a second fragment already overlapped the hint text.
    const hintPanel = addSoftPanel(this, 360, 610, 470, 96, 12, 0x2b1c16, 0.72);
    const hintText = this.add.text(360, 572, '', {
      fontFamily: Fonts.body,
      fontSize: '18px',
      color: '#f5ecd8',
      align: 'center',
      wordWrap: { width: 420 },
      maxLines: 1,
    }).setOrigin(0.5, 0).setDepth(33);
    void hintPanel;

    // Board panel (above) is centered at (360, 402), sized 470x390. This
    // grid spans 9 columns x 7 rows (see the words' row/col data below), so
    // its origin has to be derived from the panel's own center — a fixed
    // origin left over from an earlier word layout put row 0 44px above the
    // panel's top edge, spilling the tiles out above the board entirely.
    const tileSize = 42;
    const gap = 4;
    const gridCols = 9;
    const boardOriginX = 360 - ((gridCols - 1) * (tileSize + gap)) / 2;
    // Dead-centering vertically (the equivalent of the X formula above) left
    // no room below the grid for the "Conversation Fragments" label and its
    // list, which sit inside the same board panel — the grid's bottom row
    // and that label ended up overlapping. Bias the grid toward the top of
    // the panel instead, freeing the space those fragments actually need.
    const boardTopMargin = 30;
    const boardOriginY = 402 - 195 + boardTopMargin + tileSize / 2;
    const cellOwners = new Map<string, string[]>();
    puzzleWords.forEach((word) => {
      [...word.answer].forEach((_letter, index) => {
        const row = word.row + (word.direction === 'down' ? index : 0);
        const col = word.col + (word.direction === 'across' ? index : 0);
        const key = `${row}:${col}`;
        const owners = cellOwners.get(key) ?? [];
        owners.push(word.id);
        cellOwners.set(key, owners);
      });
    });

    cellOwners.forEach((owners, key) => {
      const [row, col] = key.split(':').map(Number);
      const x = boardOriginX + col * (tileSize + gap);
      const y = boardOriginY + row * (tileSize + gap);
      const glow = this.add.ellipse(x, y, tileSize + 12, tileSize + 12, theme.glow, 0).setDepth(17);
      const rect = this.add.rectangle(x, y, tileSize, tileSize, theme.crosswordTile, 0.94).setDepth(18);
      rect.setStrokeStyle(2, theme.secondary, 0.56);
      const letter = this.add.text(x, y + 1, '', {
        fontFamily: Fonts.ui,
        fontSize: '23px',
        color: '#2b1c16',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(19);
      rect.setInteractive({ useHandCursor: true });
      rect.on('pointerover', () => {
        this.tweens.add({ targets: rect, y: y - 3, duration: 120, ease: 'Sine.easeOut' });
        this.tweens.add({ targets: glow, alpha: 0.14, duration: 120 });
      });
      rect.on('pointerout', () => {
        this.tweens.add({ targets: rect, y, duration: 160, ease: 'Sine.easeOut' });
        this.tweens.add({ targets: glow, alpha: 0, duration: 160 });
      });
      rect.on('pointerdown', () => selectWord(owners.find((id) => !solved.has(id)) ?? owners[0]));
      cellGlows.set(key, glow);
      cellRects.set(key, rect);
      cellTexts.set(key, letter);
    });

    const progressBack = this.add.rectangle(930, 576, 306, 8, theme.shadow, 0.88).setDepth(22);
    progressBack.setStrokeStyle(1, theme.secondary, 0.45);
    const progressFill = this.add.rectangle(779, 576, 0, 8, theme.progressColor, 0.95).setOrigin(0, 0.5).setDepth(23);
    const progressLabel = this.add.text(930, 540, '', {
      fontFamily: Fonts.ui,
      fontSize: '16px',
      color: Phaser.Display.Color.IntegerToColor(theme.primary).rgba,
    }).setOrigin(0.5).setDepth(24);
    const ornamentLabel = this.add.text(930, 604, 'Memory Reconstruction', {
      fontFamily: Fonts.ui,
      fontSize: '14px',
      color: Phaser.Display.Color.IntegerToColor(theme.secondary).rgba,
    }).setOrigin(0.5).setDepth(24);
    puzzleWords.forEach((_word, index) => {
      const ornament = this.add.circle(878 + index * 21, 630, 5, theme.shadow, 0.62).setDepth(24);
      ornament.setStrokeStyle(1, theme.secondary, 0.72);
      reconstructionOrnaments.push(ornament);
    });
    void ornamentLabel;

    // One accumulating, word-wrapped line rather than six fixed-position
    // rows — six short phrases pack onto 2-3 wrapped lines comfortably,
    // where six full-width rows needed more vertical room than this panel
    // (or the space above it) actually has.
    const fragmentsText = this.add.text(360, 604, '', {
      fontFamily: '"Bradley Hand", "Snell Roundhand", cursive',
      fontSize: '14px',
      color: Phaser.Display.Color.IntegerToColor(theme.primary).rgba,
      align: 'center',
      wordWrap: { width: 420 },
      lineSpacing: 3,
      maxLines: 3,
    }).setOrigin(0.5, 0).setDepth(24);

    puzzleWords.forEach((word, index) => {
      // Right panel top edge sits at y=183 (center 402, height 438); the old
      // base of 214 left only ~9px above the first clue row — cramped right
      // under the panel's top edge. 234 gives it real breathing room.
      const y = 234 + index * 52;
      const marker = this.add.text(-168, -4, `${index + 1}`, {
        fontFamily: Fonts.ui,
        fontSize: '15px',
        color: '#2b2320',
      }).setOrigin(0.5);
      const markerBg = this.add.circle(-168, 0, 14, theme.accent, 0.92).setStrokeStyle(1, theme.highlightColor, 0.65);
      // The ✓ glyph silently drops from this custom font — draw a tick
      // instead of relying on a Unicode character the font doesn't ship.
      const check = this.drawCheckmark(164, -12, theme.accent).setAlpha(0);
      const clue = this.add.text(-140, -17, this.cleanPuzzleText(word.clue, index), {
        fontFamily: Fonts.body,
        fontSize: '17px',
        color: theme.textPrimary,
        wordWrap: { width: 310 },
      });
      const rowBg = this.add.rectangle(0, 0, 376, 44, theme.button, 0.2).setStrokeStyle(1, theme.secondary, 0.12);
      const row = this.add.container(930, y, [rowBg, markerBg, marker, clue, check]).setDepth(24).setSize(376, 44).setInteractive({ useHandCursor: true });
      row.on('pointerover', () => {
        AudioManager.playSfx(this, 'sfx-interact');
        selectWord(word.id);
      });
      row.on('pointerdown', () => selectWord(word.id));
      clueRows.set(word.id, row);
      clueChecks.set(word.id, check);
    });

    puzzleWords.forEach((word) => {
      const marker = this.add.ellipse(word.hotspot.x * VIEW_W, word.hotspot.y * VIEW_H, (word.hotspot.width ?? 0.07) * VIEW_W, (word.hotspot.height ?? 0.08) * VIEW_H, theme.memoryGlow, 0.1)
        .setDepth(14)
        .setAlpha(0.12)
        .setInteractive({ useHandCursor: true });
      this.tweens.add({ targets: marker, alpha: 0.03, scale: 1.05, yoyo: true, repeat: -1, duration: 1800 });
      marker.on('pointerover', () => this.tweens.add({ targets: marker, alpha: 0.24, scale: 1.08, duration: 180 }));
      marker.on('pointerout', () => this.tweens.add({ targets: marker, alpha: solved.has(word.id) ? 0.18 : 0.08, scale: 1, duration: 220 }));
      marker.on('pointerdown', () => inspectHotspot(word.id));
      hotspotMarkers.set(word.id, marker);
    });

    const hintButton = this.add.text(806, 636, 'HINT', {
      fontFamily: Fonts.ui,
      fontSize: '15px',
      color: Phaser.Display.Color.IntegerToColor(theme.primary).rgba,
      backgroundColor: `#${theme.button.toString(16).padStart(6, '0')}`,
      padding: { left: 14, right: 14, top: 7, bottom: 7 },
    }).setDepth(25).setInteractive({ useHandCursor: true });
    hintButton.on('pointerover', () => this.tweens.add({ targets: hintButton, scale: 1.06, duration: 120 }));
    hintButton.on('pointerout', () => this.tweens.add({ targets: hintButton, scale: 1, duration: 120 }));
    hintButton.on('pointerdown', () => showHint(selectedId));

    const resetButton = this.add.text(985, 636, 'RESET', {
      fontFamily: Fonts.ui,
      fontSize: '15px',
      color: Phaser.Display.Color.IntegerToColor(theme.primary).rgba,
      backgroundColor: `#${theme.button.toString(16).padStart(6, '0')}`,
      padding: { left: 14, right: 14, top: 7, bottom: 7 },
    }).setDepth(25).setInteractive({ useHandCursor: true });
    resetButton.on('pointerover', () => this.tweens.add({ targets: resetButton, scale: 1.06, duration: 120 }));
    resetButton.on('pointerout', () => this.tweens.add({ targets: resetButton, scale: 1, duration: 120 }));
    resetButton.on('pointerdown', () => {
      if (solved.has(selectedId)) return;
      typed.set(selectedId, '');
      updateBoard();
    });

    const mobileInput = this.add.dom(VIEW_W / 2, VIEW_H - 18, 'input', {
      width: '1px',
      height: '1px',
      opacity: '0.01',
      border: '0',
      background: 'transparent',
      color: 'transparent',
    }) as Phaser.GameObjects.DOMElement;
    mobileInput.setDepth(1);
    mobileInput.addListener('input');
    mobileInput.on('input', () => {
      const node = mobileInput.node as HTMLInputElement;
      typed.set(selectedId, node.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, selectedWord().answer.length));
      updateBoard();
      checkSelected();
    });

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (completing || solved.has(selectedId)) return;
      if (/^[a-z]$/i.test(event.key)) {
        event.preventDefault();
        const word = selectedWord();
        typed.set(selectedId, `${typed.get(selectedId) ?? ''}${event.key.toUpperCase()}`.slice(0, word.answer.length));
        (mobileInput.node as HTMLInputElement).value = typed.get(selectedId) ?? '';
        updateBoard();
        checkSelected();
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        typed.set(selectedId, (typed.get(selectedId) ?? '').slice(0, -1));
        (mobileInput.node as HTMLInputElement).value = typed.get(selectedId) ?? '';
        updateBoard();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        checkSelected(true);
      }
    });

    const selectWord = (id: string, fromHotspot = false) => {
      selectedId = id;
      const word = selectedWord();
      if (!typed.has(id)) typed.set(id, '');
      (mobileInput.node as HTMLInputElement).value = typed.get(id) ?? '';
      (mobileInput.node as HTMLInputElement).focus();
      hintText.setText(fromHotspot ? `${word.hotspot.label}: ${this.cleanPuzzleText(word.hint)}` : this.cleanPuzzleText(word.hint));
      updateBoard();
    };

    const selectedWord = () => puzzleWords.find((word) => word.id === selectedId) ?? puzzleWords[0];

    const inspectHotspot = (id: string) => {
      const word = puzzleWords.find((entry) => entry.id === id) ?? puzzleWords[0];
      AudioManager.playSfx(this, 'sfx-page-turn');
      selectWord(id, true);
      const marker = hotspotMarkers.get(id);
      if (marker) {
        this.cameras.main.pan(
          VIEW_W / 2 + Phaser.Math.Clamp(marker.x - VIEW_W / 2, -25, 25),
          VIEW_H / 2 + Phaser.Math.Clamp(marker.y - VIEW_H / 2, -25, 25),
          260,
          'Sine.easeOut',
        );
        this.tweens.add({ targets: marker, alpha: 0.34, scale: 1.28, yoyo: true, duration: 240, repeat: 1 });
        this.emitTinySparkle(marker.x, marker.y, 0.46);
      }
      revealHintLetter(word);
    };

    const revealHintLetter = (word: PuzzleWord) => {
      if (solved.has(word.id)) return;
      const current = typed.get(word.id) ?? '';
      const index = Phaser.Math.Clamp(word.hotspot.revealLetterIndex ?? 0, 0, word.answer.length - 1);
      const letters = current.padEnd(word.answer.length, ' ').split('');
      if (!letters[index]?.trim()) {
        letters[index] = word.answer[index];
        typed.set(word.id, letters.join('').trimEnd());
        updateBoard();
      }
    };

    const showHint = (id: string) => {
      const word = puzzleWords.find((entry) => entry.id === id) ?? puzzleWords[0];
      hintText.setText(this.cleanPuzzleText(word.hint));
      this.tweens.add({ targets: hintText, alpha: 0.45, yoyo: true, duration: 160, repeat: 1 });
    };

    const checkSelected = (forceShake = false) => {
      const word = selectedWord();
      const value = typed.get(word.id) ?? '';
      if (value === word.answer) {
        solved.add(word.id);
        AudioManager.playSfx(this, 'sfx-interact');
        glowWord(word.id);
        unlockFragment(word.id);
        const next = puzzleWords.find((entry) => !solved.has(entry.id));
        if (next) selectWord(next.id);
        else updateBoard();
        if (solved.size >= puzzleWords.length) revealCompletion();
      } else if (forceShake || value.length >= word.answer.length) {
        AudioManager.playSfx(this, 'sfx-page-turn');
        shakeWord(word.id);
      }
    };

    const updateBoard = () => {
      puzzleWords.forEach((word) => {
        const active = word.id === selectedId;
        const row = clueRows.get(word.id);
        const hotspot = hotspotMarkers.get(word.id);
        row?.setAlpha(solved.has(word.id) ? 0.56 : active ? 1 : 0.74);
        hotspot?.setFillStyle(solved.has(word.id) ? theme.highlightColor : active ? theme.memoryGlow : theme.memoryGlow, solved.has(word.id) ? 0.18 : active ? 0.22 : 0.08);
      });
      cellOwners.forEach((owners, key) => {
        const rect = cellRects.get(key);
        const text = cellTexts.get(key);
        const glow = cellGlows.get(key);
        if (!rect || !text) return;
        const solvedOwner = owners.find((id) => solved.has(id));
        const activeOwner = owners.includes(selectedId);
        const displayOwner = solvedOwner ?? (activeOwner ? selectedId : undefined);
        const letter = displayOwner ? letterForCell(displayOwner, key) : '';
        if (text.text !== letter) {
          text.setText(letter).setAlpha(letter ? 0 : 1);
          if (letter) {
            this.tweens.add({
              targets: text,
              alpha: 1,
              scale: 1.16,
              duration: 120,
              onComplete: () => {
                text.setAlpha(1);
                this.tweens.add({ targets: text, scale: 1, duration: 90 });
              },
            });
            if (glow) this.tweens.add({ targets: glow, alpha: 0.28, scale: 1.1, yoyo: true, duration: 190 });
          }
        } else if (letter) {
          text.setAlpha(1);
        }
        rect.setFillStyle(solvedOwner ? theme.glow : activeOwner ? theme.tooltipBackground : theme.crosswordTile, solvedOwner ? 0.98 : 0.92);
        rect.setStrokeStyle(activeOwner ? 3 : 2, solvedOwner ? theme.accent : activeOwner ? theme.highlightColor : theme.secondary, activeOwner ? 1 : 0.68);
      });
      progressLabel.setText(`Conversation Progress  ${solved.size} / ${puzzleWords.length}`);
      progressFill.width = 306 * (solved.size / puzzleWords.length);
      reconstructionOrnaments.forEach((ornament, index) => {
        ornament.setFillStyle(index < solved.size ? theme.progressColor : theme.shadow, index < solved.size ? 0.95 : 0.62);
        ornament.setStrokeStyle(1, index < solved.size ? theme.highlightColor : theme.secondary, index < solved.size ? 0.95 : 0.72);
      });
    };

    const letterForCell = (wordId: string, key: string) => {
      const word = puzzleWords.find((entry) => entry.id === wordId);
      if (!word) return '';
      const [row, col] = key.split(':').map(Number);
      const index = word.direction === 'across' ? col - word.col : row - word.row;
      if (index < 0 || index >= word.answer.length) return '';
      if (solved.has(wordId)) return word.answer[index];
      return (typed.get(wordId) ?? '')[index] ?? '';
    };

    const glowWord = (wordId: string) => {
      const targets = cellsForWord(wordId).map((key) => cellRects.get(key)).filter(Boolean) as Phaser.GameObjects.Rectangle[];
      this.tweens.add({ targets, alpha: 0.68, yoyo: true, duration: 130, repeat: 2 });
      cellsForWord(wordId).forEach((key) => {
        const rect = cellRects.get(key);
        if (!rect) return;
        const sparkle = this.add.image(rect.x, rect.y, 'completion-sparkle').setDisplaySize(34, 34).setDepth(27).setAlpha(0.62);
        this.tweens.add({ targets: sparkle, scale: 1.6, alpha: 0, duration: 420, onComplete: () => sparkle.destroy() });
      });
      clueChecks.get(wordId)?.setAlpha(1);
      hotspotMarkers.get(wordId)?.setAlpha(0.18).setFillStyle(theme.highlightColor, 0.18);
    };

    const unlockFragment = (wordId: string) => {
      const index = puzzleWords.findIndex((entry) => entry.id === wordId);
      if (index < 0) return;
      revealedFragments[index] = puzzle?.conversationFragments?.[index] ?? puzzleWords[index].fragment ?? '';
      // Joined in puzzle-word order (not solve order) so the accumulating
      // text always reads as one coherent sentence-in-progress, however the
      // player solves the grid.
      fragmentsText.setText(revealedFragments.filter((entry): entry is string => Boolean(entry)).join('   '));
      this.tweens.add({ targets: fragmentsText, alpha: { from: 0.3, to: 1 }, scale: { from: 0.97, to: 1 }, duration: 260, ease: 'Sine.easeOut' });
    };

    const shakeWord = (wordId: string) => {
      const targets = cellsForWord(wordId).map((key) => cellRects.get(key)).filter(Boolean) as Phaser.GameObjects.Rectangle[];
      this.tweens.add({ targets, x: '+=6', yoyo: true, repeat: 2, duration: 50 });
    };

    const cellsForWord = (wordId: string) => {
      const word = puzzleWords.find((entry) => entry.id === wordId);
      if (!word) return [];
      return [...word.answer].map((_letter, index) => {
        const row = word.row + (word.direction === 'down' ? index : 0);
        const col = word.col + (word.direction === 'across' ? index : 0);
        return `${row}:${col}`;
      });
    };

    const revealCompletion = () => {
      if (completing) return;
      completing = true;
      this.input.keyboard?.removeAllListeners('keydown');
      AudioManager.playSfx(this, 'sfx-portal');
      const dim = this.add.rectangle(VIEW_W / 2, VIEW_H / 2, VIEW_W, VIEW_H, 0x090911, 0).setDepth(65);
      this.tweens.add({ targets: dim, alpha: 0.46, duration: 520 });
      this.tweens.add({
        targets: [
          hintPanel,
          hintText,
          hintButton,
          resetButton,
          progressBack,
          progressFill,
          progressLabel,
          ...reconstructionOrnaments,
          ...Array.from(hotspotMarkers.values()),
        ],
        alpha: 0,
        duration: 360,
      });
      puzzleWords.forEach((word, index) => this.time.delayedCall(index * 110, () => glowWord(word.id)));
      // All six fragments are already assembled into fragmentsText by now
      // (this only runs once every word is solved) — give the finished line
      // its own moment front-and-centre, then let it fade with the rest of
      // the in-progress UI as the big completion panel takes over.
      this.time.delayedCall(400, () => {
        fragmentsText.setDepth(72);
        this.tweens.add({ targets: fragmentsText, x: VIEW_W / 2, y: 205, scale: 1.15, duration: 520, ease: 'Sine.easeInOut' });
      });
      this.time.delayedCall(1600, () => {
        this.tweens.add({ targets: fragmentsText, alpha: 0, duration: 420 });
      });
      cellRects.forEach((rect, key) => {
        this.time.delayedCall(900 + Phaser.Math.Between(0, 520), () => {
          this.emitTinySparkle(rect.x, rect.y, 0.42);
          this.tweens.add({ targets: rect, alpha: 0, scale: 0.35, duration: 620, ease: 'Sine.easeIn' });
          this.tweens.add({ targets: cellTexts.get(key), alpha: 0, duration: 440 });
        });
      });
      const revealText = this.cleanPuzzleText(puzzle?.completionConversation ?? puzzle?.completionRevealText ?? '');
      const reveal = this.add.text(VIEW_W / 2, 0, revealText, {
        fontFamily: Fonts.body,
        fontSize: '28px',
        color: Phaser.Display.Color.IntegerToColor(theme.primary).rgba,
        align: 'center',
        wordWrap: { width: 720 },
        lineSpacing: 10,
      }).setOrigin(0.5).setDepth(75).setAlpha(0);
      const panelHeight = Phaser.Math.Clamp(reveal.height + 78, 212, 286);
      const panelY = VIEW_H / 2 + 34;
      const revealPanel = addSoftPanel(this, VIEW_W / 2, panelY, 820, panelHeight, 74, 0x090911, 0.84).setAlpha(0);
      reveal.setY(panelY - 6);
      this.time.delayedCall(1850, () => {
        this.tweens.add({ targets: [revealPanel, reveal], alpha: 1, duration: 720 });
        this.emitJournalSparkle(VIEW_W / 2, VIEW_H / 2 + 20);
      });
      this.time.delayedCall(5000, () => {
        dim.destroy();
        revealPanel.destroy();
        reveal.destroy();
        this.complete();
      });
    };

    selectWord(selectedId);
    updateBoard();
  }

  /**
   * Memory 3's "rearrange dialogue" puzzle: fragments of a remembered
   * conversation are dragged from a scattered pile onto a vertical timeline.
   * Each fragment only snaps at its own correct position, so the drag
   * gesture itself is the ordering validation — dropping it anywhere else
   * just bounces it back.
   */
  private renderConversationReconstruction(): void {
    const theme = setActiveMemoryTheme(this.configData.id);
    const items = this.configData.miniGameConfig.dialogueCards ?? [];
    if (!items.length) {
      this.complete();
      return;
    }
    const correctOrder = this.configData.miniGameConfig.correctOrder ?? items.map((_, i) => i);
    const count = items.length;
    const fallbackLine = 'A line from that conversation, waiting to be placed back in order.';

    // Ambient layers — rooftop stays alive with parallax drift and bokeh string lights
    this.addDustParticles();
    this.addLeafDrift();
    this.addBokehLights();
    this.tweens.add({ targets: this.cameras.main, zoom: 1.018, yoyo: true, repeat: -1, duration: 5400, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: this.cameras.main, scrollX: 10, yoyo: true, repeat: -1, duration: 7200, ease: 'Sine.easeInOut' });
    // Gentle parallax follows the cursor
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (this.completed) return;
      this.cameras.main.setScroll(
        Phaser.Math.Linear(this.cameras.main.scrollX, (ptr.x / VIEW_W - 0.5) * -5, 0.06),
        Phaser.Math.Linear(this.cameras.main.scrollY, (ptr.y / VIEW_H - 0.5) * -3, 0.06),
      );
    });

    // ── Instruction banner (glassmorphic pill) ──────────────────────────────
    const instrBanner = addSoftPanel(this, VIEW_W / 2, 140, 520, 38, 20, 0x090911, 0.52, true);
    instrBanner.setAlpha(0);
    this.tweens.add({ targets: instrBanner, alpha: 1, duration: 440, delay: 200, ease: 'Sine.easeOut' });
    this.add.text(VIEW_W / 2, 140, 'drag each memory onto the timeline, in order', {
      fontFamily: Fonts.ui,
      fontSize: '16px',
      color: Phaser.Display.Color.IntegerToColor(theme.primary).rgba,
    }).setOrigin(0.5).setDepth(21).setAlpha(0).setScrollFactor(0);
    // Delayed text fade-in so it doesn't compete with header slide
    this.time.delayedCall(200, () => {
      const instrText = this.children.list
        .filter((c) => c instanceof Phaser.GameObjects.Text && (c as Phaser.GameObjects.Text).text.includes('drag each memory'))
        .pop() as Phaser.GameObjects.Text | undefined;
      if (instrText) this.tweens.add({ targets: instrText, alpha: 0.92, duration: 440, ease: 'Sine.easeOut' });
    });

    // ── Timeline panel ──────────────────────────────────────────────────────
    const timelineX = 426;
    const timelineTop = 210;
    const timelineBottom = 560;
    const slotY = (index: number) => (count <= 1 ? (timelineTop + timelineBottom) / 2 : timelineTop + ((timelineBottom - timelineTop) / (count - 1)) * index);

    addSoftPanel(this, 238, (timelineTop + timelineBottom) / 2, 438, timelineBottom - timelineTop + 80, 10, 0x090911, 0.42, true);

    // Glowing gold spine: a thin vertical gradient bar that pulses
    const spine = this.add.rectangle(timelineX, (timelineTop + timelineBottom) / 2, 2, timelineBottom - timelineTop, theme.progressColor, 0.28).setDepth(12);
    const spineGlow = this.add.rectangle(timelineX, (timelineTop + timelineBottom) / 2, 6, timelineBottom - timelineTop, theme.memoryGlow, 0).setDepth(11);
    this.tweens.add({ targets: spineGlow, alpha: 0.12, scale: 1.06, yoyo: true, repeat: -1, duration: 2200, ease: 'Sine.easeInOut' });
    void spine;

    const slotNodes: Phaser.GameObjects.Arc[] = [];
    const slotGlows: Phaser.GameObjects.Arc[] = [];
    const connectors: Phaser.GameObjects.Graphics[] = [];
    for (let i = 0; i < count; i++) {
      const y = slotY(i);

      // Diffuse outer halo ring
      const outerRing = this.add.circle(timelineX, y, 26, theme.memoryGlow, 0).setDepth(11);
      this.tweens.add({ targets: outerRing, alpha: 0.10, scale: 1.1, yoyo: true, repeat: -1, duration: 2000 + i * 220, ease: 'Sine.easeInOut' });

      const glow = this.add.circle(timelineX, y, 16, theme.memoryGlow, 0).setDepth(13);
      // Node: inner filled circle with bright stroke
      const node = this.add.circle(timelineX, y, 9, theme.panelBackground, 0.9).setDepth(15);
      node.setStrokeStyle(2, theme.progressColor, 0.85);
      // Attract-pulse
      this.tweens.add({ targets: node, scale: 1.3, yoyo: true, repeat: -1, duration: 1400, delay: i * 200, ease: 'Sine.easeInOut' });

      // Faint horizontal guide line from node toward card drop zone
      const connector = this.add.graphics().setDepth(14);
      connector.lineStyle(1.5, theme.progressColor, 0.12);
      connector.lineBetween(timelineX, y, timelineX + 168, y);

      slotGlows.push(glow);
      slotNodes.push(node);
      connectors.push(connector);
      void outerRing;
    }

    // ── Reveal log (left timeline panel) ───────────────────────────────────
    this.add.text(58, 168, 'piecing it back together…', {
      fontFamily: Fonts.ui,
      fontSize: '13px',
      color: theme.textSecondary,
    }).setDepth(20).setAlpha(0.68);
    const revealLines: Phaser.GameObjects.Text[] = [];
    for (let i = 0; i < count; i++) {
      const line = this.add.text(58, slotY(i), '', {
        fontFamily: '"Bradley Hand", "Snell Roundhand", cursive',
        fontSize: '12px',
        color: theme.textPrimary,
        wordWrap: { width: 326 },
        lineSpacing: 2,
        maxLines: 5,
      }).setOrigin(0, 0.5).setDepth(20).setAlpha(0);
      revealLines.push(line);
    }

    this.addProgress(`0/${count} pieced together`, 0, count);

    const scatterSpots = this.scatterPositions(count);
    const placed = new Array(count).fill(false);
    let placedCount = 0;
    let completing = false;

    items.forEach((item, itemIndex) => {
      const slotIndex = correctOrder.indexOf(itemIndex);
      const spot = scatterSpots[itemIndex];
      const homeAngle = Phaser.Math.Between(-4, 4);
      const isHer = /her/i.test(item.speaker ?? '');

      // ── Premium card ────────────────────────────────────────────────────
      // Color palette per speaker
      const paperBase = isHer ? 0xf5dfe2 : 0xf0e3c8;
      const paperShade = isHer ? 0xeacdd2 : 0xe6d5b8;
      const accentColor = isHer ? 0xd88a9a : 0xb08a52;
      const speakerLabel = this.cleanPuzzleText(item.speaker, isHer ? 'Her' : 'Him');

      const cardW = 292;
      const cardH = 88;

      // Soft drop-shadow (larger, blurred with layered ellipse)
      const shadowBase = this.add.rectangle(10, 13, cardW - 8, cardH - 8, 0x000000, 0.12);
      const shadowBlur = this.add.ellipse(10, 16, cardW - 4, cardH - 4, 0x000000, 0.06);

      // Main paper body — drawn with graphics for full control
      const paper = this.add.graphics();
      paper.fillStyle(paperBase, 1);
      paper.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 4);
      // Subtle linen texture: fine horizontal lines at low alpha
      paper.lineStyle(1, 0x000000, 0.025);
      for (let ly = -cardH / 2 + 8; ly < cardH / 2 - 4; ly += 7) {
        paper.lineBetween(-cardW / 2 + 6, ly, cardW / 2 - 6, ly);
      }
      // Aged top-fold crease: darker strip across the top ~14px
      paper.fillStyle(paperShade, 0.55);
      paper.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, 14, { tl: 4, tr: 4, bl: 0, br: 0 });
      // Thin border
      paper.lineStyle(1, accentColor, 0.28);
      paper.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 4);

      // Pill-shaped speaker tag — drawn with graphics
      const pillW = 52;
      const pillH = 18;
      const pillX = -cardW / 2 + pillW / 2 + 12;
      const pillY = -cardH / 2 + pillH / 2 + 7;
      const pill = this.add.graphics();
      pill.fillStyle(accentColor, 0.96);
      pill.fillRoundedRect(pillX - pillW / 2, pillY - pillH / 2, pillW, pillH, pillH / 2);
      // Tiny highlight stripe on pill for depth
      pill.fillStyle(0xffffff, 0.16);
      pill.fillRoundedRect(pillX - pillW / 2 + 3, pillY - pillH / 2 + 2, pillW - 6, 4, 3);

      const pillText = this.add.text(pillX, pillY, speakerLabel, {
        fontFamily: Fonts.ui,
        fontSize: '11px',
        color: '#fff8ec',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      // Dialogue snippet text
      const snippetText = this.add.text(-cardW / 2 + 14, -cardH / 2 + 28, this.snippet(this.cleanPuzzleText(item.text, fallbackLine), 66), {
        fontFamily: Fonts.body,
        fontSize: '12px',
        color: '#2b2320',
        wordWrap: { width: cardW - 28 },
        lineSpacing: 2,
        maxLines: 2,
      });

      const container = this.add
        .container(spot.x, spot.y, [shadowBase, shadowBlur, paper, pill, pillText, snippetText])
        .setDepth(30 + itemIndex)
        .setSize(cardW, cardH)
        .setAngle(homeAngle);
      container.setInteractive({ useHandCursor: true, draggable: true });
      this.input.setDraggable(container);

      // Staggered floating animation — each card bobs at a different rate
      this.tweens.add({
        targets: container,
        y: spot.y - Phaser.Math.Between(5, 9),
        duration: Phaser.Math.Between(2200, 3400),
        yoyo: true,
        repeat: -1,
        delay: itemIndex * 320,
        ease: 'Sine.easeInOut',
      });

      // Proximity outline graphics (hidden until near correct slot)
      const proximityRing = this.add.graphics().setDepth(35 + itemIndex);

      const settleAt = { x: timelineX + 188, y: slotY(slotIndex) };

      container.on('dragstart', () => {
        if (completing || placed[itemIndex]) return;
        this.tweens.killTweensOf(container); // stop float bob
        this.children.bringToTop(container);
        AudioManager.playSfx(this, 'sfx-page-turn');
        // Lift: scale up, increase shadow spread
        this.tweens.add({ targets: container, angle: 0, scale: 1.10, duration: 160, ease: 'Sine.easeOut' });
        this.tweens.add({ targets: [shadowBase, shadowBlur], alpha: 0.52, y: '+=6', duration: 160 });
      });

      container.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
        if (completing || placed[itemIndex]) return;
        container.setPosition(dragX, dragY);
        const dist = Phaser.Math.Distance.Between(dragX, dragY, timelineX, slotY(slotIndex));
        const near = dist < 110;

        // Slot node glow pulses as card approaches
        slotGlows[slotIndex].setAlpha(near ? 0.38 : 0).setScale(near ? 1.4 : 1);

        // Proximity ring on the card — glows gold when close
        proximityRing.clear();
        if (near) {
          const snapProgress = 1 - dist / 110;
          proximityRing.lineStyle(2, theme.highlightColor, snapProgress * 0.72);
          proximityRing.strokeRoundedRect(dragX - cardW / 2, dragY - cardH / 2, cardW, cardH, 5);
        }
      });

      container.on('dragend', () => {
        if (completing || placed[itemIndex]) return;
        const dist = Phaser.Math.Distance.Between(container.x, container.y, timelineX, slotY(slotIndex));
        slotGlows[slotIndex].setAlpha(0).setScale(1);
        proximityRing.clear();

        if (dist < 110) {
          placed[itemIndex] = true;
          placedCount++;
          this.addProgress(
            placedCount >= count ? 'the memory comes back into focus' : `${placedCount}/${count} pieced together`,
            placedCount,
            count,
          );
          container.disableInteractive();
          this.tweens.add({
            targets: container,
            x: settleAt.x,
            y: settleAt.y,
            angle: 0,
            scale: 1,
            duration: 320,
            ease: 'Back.easeOut',
            onComplete: () => {
              this.tweens.add({ targets: [shadowBase, shadowBlur], alpha: shadowBase.alpha * 0.5, y: '-=6', duration: 200 });
              // Glass shimmer on the settled card
              addGlassShimmer(this, settleAt.x, settleAt.y, cardW, cardH, 36 + itemIndex);
              this.settleFragment(slotIndex, item, fallbackLine, theme, slotNodes, connectors, revealLines);
              // `placedCount` is incremented synchronously in dragend, but this
              // runs after each card's 320ms settle tween — if two or more
              // cards happen to settle in the same tick (queued drags, or
              // simply landing close together), every one of them sees the
              // final placedCount and would otherwise re-trigger the whole
              // completion sequence. `completing` must be checked, not just set.
              if (placedCount === count && !completing) {
                completing = true;
                this.beginConversationCompletion(items, correctOrder, fallbackLine, theme);
              }
            },
          });
        } else {
          // Bounce back to scatter position and restart float bob
          this.tweens.add({
            targets: container,
            x: spot.x,
            y: spot.y,
            angle: homeAngle,
            scale: 1,
            duration: 420,
            ease: 'Back.easeOut',
            onComplete: () => {
              this.tweens.add({
                targets: container,
                y: spot.y - Phaser.Math.Between(5, 9),
                duration: Phaser.Math.Between(2200, 3400),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
              });
            },
          });
          this.tweens.add({ targets: [shadowBase, shadowBlur], alpha: shadowBase.alpha, y: '-=6', duration: 260 });
        }
      });
    });
  }


  private settleFragment(
    slotIndex: number,
    item: { speaker: string; text: string },
    fallbackLine: string,
    theme: ReturnType<typeof setActiveMemoryTheme>,
    slotNodes: Phaser.GameObjects.Arc[],
    connectors: Phaser.GameObjects.Graphics[],
    revealLines: Phaser.GameObjects.Text[],
  ): void {
    AudioManager.playSfx(this, 'sfx-interact');
    const node = slotNodes[slotIndex];
    node.setFillStyle(theme.progressColor, 0.95).setStrokeStyle(1, theme.highlightColor, 0.95);
    this.tweens.add({ targets: node, scale: 1.5, yoyo: true, duration: 220 });
    const connector = connectors[slotIndex];
    connector.clear();
    connector.lineStyle(2, theme.progressColor, 0.75);
    const y = node.y;
    connector.lineBetween(node.x, y, node.x + 168, y);
    this.emitTinySparkle(node.x + 60, y, 0.5);

    const speaker = this.cleanPuzzleText(item.speaker, '');
    const fullMessage = this.cleanPuzzleText(item.text, fallbackLine);
    const line = revealLines[slotIndex];
    line.setText(`${speaker ? `${speaker}: ` : ''}${fullMessage}`).setAlpha(0);
    this.tweens.add({ targets: line, alpha: 1, duration: 320 });
  }

  private beginConversationCompletion(
    _items: { speaker: string; text: string }[],
    _correctOrder: number[],
    _fallbackLine: string,
    theme: ReturnType<typeof setActiveMemoryTheme>,
  ): void {
    AudioManager.playSfx(this, 'sfx-ink-write');

    // The player just rebuilt this conversation themselves — they don't need to
    // read it again. Instead, give them a quiet emotional beat: the two silhouettes
    // drifting together, the memory settling, and a single caption that responds
    // to the feeling rather than restating the words.
    this.time.delayedCall(600, () => {
      AudioManager.playSfx(this, 'sfx-portal');

      // Gentle dim — let the rooftop background still breathe through
      const dim = this.add.rectangle(VIEW_W / 2, VIEW_H / 2, VIEW_W, VIEW_H, 0x090911, 0).setDepth(60);
      this.tweens.add({ targets: dim, alpha: 0.46, duration: 680, ease: 'Sine.easeOut' });

      // Ghost silhouettes — ADD blend so they glow softly; drift inward
      const ghostHer = this.add.ellipse(VIEW_W / 2 - 340, VIEW_H / 2, 110, 300, 0xf3c9cf, 0)
        .setDepth(61).setBlendMode(Phaser.BlendModes.ADD);
      const ghostHim = this.add.ellipse(VIEW_W / 2 + 340, VIEW_H / 2, 110, 300, 0xe6c99a, 0)
        .setDepth(61).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: [ghostHer, ghostHim], alpha: 0.24, duration: 1100, ease: 'Sine.easeOut' });
      this.tweens.add({ targets: ghostHer, x: VIEW_W / 2 - 200, duration: 2600, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: ghostHim, x: VIEW_W / 2 + 200, duration: 2600, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: ghostHer, scaleY: 1.05, yoyo: true, repeat: -1, duration: 3200, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: ghostHim, scaleY: 1.05, yoyo: true, repeat: -1, duration: 3400, ease: 'Sine.easeInOut' });

      // Warm bokeh bloom in ADD mode
      const bokehColors = [theme.memoryGlow, theme.glow, 0xffffff, theme.primary];
      for (let bi = 0; bi < 5; bi++) {
        const bokeh = this.add
          .circle(
            VIEW_W / 2 + Phaser.Math.Between(-300, 300),
            VIEW_H / 2 + Phaser.Math.Between(-180, 180),
            Phaser.Math.Between(28, 72),
            bokehColors[bi % bokehColors.length],
            0,
          )
          .setDepth(62).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({
          targets: bokeh,
          alpha: Phaser.Math.FloatBetween(0.05, 0.13),
          scale: Phaser.Math.FloatBetween(1.0, 1.35),
          yoyo: true, repeat: -1,
          duration: Phaser.Math.Between(2400, 4800),
          delay: bi * 280,
          ease: 'Sine.easeInOut',
        });
      }

      // Emotional caption — responds to the feeling, not the content
      this.time.delayedCall(900, () => {
        this.emitJournalSparkle(VIEW_W / 2, VIEW_H / 2);
        AudioManager.playSfx(this, 'sfx-memory-restored');

        const caption = this.add
          .text(VIEW_W / 2, VIEW_H / 2, 'the conversation falls back into place.', {
            fontFamily: Fonts.body,
            fontSize: '26px',
            color: Phaser.Display.Color.IntegerToColor(theme.primary).rgba,
            align: 'center',
            wordWrap: { width: 560 },
          })
          .setOrigin(0.5)
          .setAlpha(0)
          .setDepth(65);
        this.tweens.add({ targets: caption, alpha: 0.92, y: VIEW_H / 2 - 10, duration: 700, ease: 'Sine.easeOut' });

        const hint = this.add
          .text(VIEW_W / 2, VIEW_H / 2 + 52, 'tap or press any key to continue', {
            fontFamily: Fonts.ui,
            fontSize: '15px',
            color: '#b9ad9c',
          })
          .setOrigin(0.5)
          .setAlpha(0)
          .setDepth(65);

        this.tweens.add({
          targets: hint,
          alpha: 1,
          duration: 380,
          delay: 800,
          onComplete: () => {
            this.tweens.add({ targets: hint, alpha: 0.36, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            this.tweens.add({ targets: hint, scale: 1.03, duration: 840, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          },
        });

        const proceed = () => {
          ghostHer.destroy();
          ghostHim.destroy();
          caption.destroy();
          hint.destroy();
          this.complete();
        };
        // 500ms debounce — prevent the last card-drop from immediately firing
        this.time.delayedCall(500, () => {
          this.input.once('pointerdown', proceed);
          this.input.keyboard?.once('keydown', proceed);
        });
      });
    });
  }

  private snippet(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    const cut = text.slice(0, maxLength);
    const lastSpace = cut.lastIndexOf(' ');
    return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxLength).trimEnd()}…`;
  }

  private scatterPositions(count: number): { x: number; y: number }[] {
    const preset = [
      { x: 700, y: 226 },
      { x: 1022, y: 218 },
      { x: 660, y: 452 },
      { x: 1016, y: 466 },
      { x: 860, y: 300 },
      { x: 880, y: 560 },
    ];
    return Array.from({ length: count }, (_, i) => {
      const base = preset[i % preset.length];
      return {
        x: base.x + Phaser.Math.Between(-18, 18),
        y: base.y + Phaser.Math.Between(-14, 14),
      };
    });
  }

  private emitTinySparkle(x: number, y: number, alpha = 0.42): void {
    const theme = setActiveMemoryTheme(this.configData.id);
    const sparkle = this.add.star(x, y, 4, 2, 7, theme.particleColor, alpha).setDepth(16);
    this.tweens.add({
      targets: sparkle,
      scale: 1.8,
      angle: 45,
      alpha: 0,
      duration: 720,
      ease: 'Sine.easeOut',
      onComplete: () => sparkle.destroy(),
    });
  }

  private emitJournalSparkle(x: number, y: number): void {
    for (let i = 0; i < 18; i++) {
      this.time.delayedCall(i * 28, () => {
        this.emitTinySparkle(x + Phaser.Math.Between(-90, 90), y + Phaser.Math.Between(-58, 58), 0.48);
      });
    }
  }

  private showMomentTooltip(x: number, y: number, title: string, description: string, icon?: string): void {
    this.momentTooltipQueue.push({ x, y, title, description, icon });
    if (!this.momentTooltipActive) this.processMomentTooltipQueue();
  }

  private processMomentTooltipQueue(): void {
    const next = this.momentTooltipQueue.shift();
    if (!next) {
      this.momentTooltipActive = false;
      const pending = this.pendingMomentCompletion;
      if (pending) {
        this.pendingMomentCompletion = undefined;
        this.time.delayedCall(260, pending);
      }
      return;
    }
    this.momentTooltipActive = true;

    const theme = setActiveMemoryTheme(this.configData.id);
    const iconLabel = this.momentIcon(next.icon);
    const panelWidth = 442;
    const textWidth = panelWidth - 74;

    // Measure the title/body at a scratch position first so the panel can
    // be sized to fit however many lines the actual text needs. A fixed
    // 94px panel clipped/overflowed once personalized descriptions ran
    // longer than the placeholder copy it was originally tuned for.
    const titleText = this.add.text(0, 0, `${iconLabel}${this.cleanPuzzleText(next.title)}`, {
      fontFamily: Fonts.title,
      fontSize: '27px',
      color: '#37241b',
      wordWrap: { width: textWidth },
      align: 'center',
    }).setOrigin(0.5, 0).setDepth(59).setAlpha(0);
    const body = this.add.text(0, 0, this.cleanPuzzleText(next.description), {
      fontFamily: Fonts.body,
      fontSize: '18px',
      color: '#4a3024',
      align: 'center',
      wordWrap: { width: textWidth },
      lineSpacing: 4,
    }).setOrigin(0.5, 0).setDepth(59).setAlpha(0);

    const gap = 17;
    const paddingTop = 24;
    const paddingBottom = 42;
    const ruleGap = 14;
    const panelHeight = Phaser.Math.Clamp(paddingTop + titleText.height + ruleGap + gap + body.height + paddingBottom, 158, 238);

    const tooltipX = Phaser.Math.Clamp(next.x, 20 + panelWidth / 2, VIEW_W - 20 - panelWidth / 2);
    const tooltipY = Phaser.Math.Clamp(next.y - 88, 20 + panelHeight / 2, VIEW_H - 20 - panelHeight / 2);

    const anchor = this.add.graphics().setDepth(55).setAlpha(0);
    anchor.lineStyle(1.5, theme.border, 0.28);
    anchor.beginPath();
    anchor.moveTo(next.x, next.y);
    anchor.lineTo(tooltipX, tooltipY + panelHeight / 2 - 6);
    anchor.strokePath();

    const shadow = this.add.rectangle(tooltipX + 7, tooltipY + 9, panelWidth, panelHeight, 0x000000, 0.28)
      .setDepth(55)
      .setAlpha(0);
    const paper = this.add.graphics().setDepth(56).setAlpha(0);
    const left = tooltipX - panelWidth / 2;
    const top = tooltipY - panelHeight / 2;
    paper.fillStyle(0xf6e2bc, 0.97);
    paper.fillRoundedRect(left, top, panelWidth, panelHeight, 12);
    paper.fillStyle(0xfff3d4, 0.38);
    paper.fillRoundedRect(left + 10, top + 8, panelWidth - 20, Math.max(36, panelHeight * 0.38), 9);
    paper.lineStyle(2, theme.border, 0.64);
    paper.strokeRoundedRect(left + 1, top + 1, panelWidth - 2, panelHeight - 2, 12);
    paper.lineStyle(1, 0xfff6dd, 0.56);
    paper.strokeRoundedRect(left + 9, top + 9, panelWidth - 18, panelHeight - 18, 8);

    const ruleY = top + paddingTop + titleText.height + ruleGap;
    const titleRule = this.add.rectangle(tooltipX, ruleY, panelWidth - 96, 1, theme.border, 0.38)
      .setDepth(58)
      .setAlpha(0);
    const jewel = this.add.circle(tooltipX, ruleY, 4, theme.highlightColor, 0.9)
      .setDepth(59)
      .setAlpha(0);
    const cornerMarks = [
      this.add.rectangle(left + 24, top + 22, 34, 1, theme.border, 0.46).setDepth(58).setAlpha(0),
      this.add.rectangle(left + 24, top + 22, 1, 24, theme.border, 0.46).setDepth(58).setAlpha(0),
      this.add.rectangle(left + panelWidth - 24, top + 22, 34, 1, theme.border, 0.46).setDepth(58).setAlpha(0),
      this.add.rectangle(left + panelWidth - 24, top + 22, 1, 24, theme.border, 0.46).setDepth(58).setAlpha(0),
      this.add.rectangle(left + 24, top + panelHeight - 22, 34, 1, theme.border, 0.34).setDepth(58).setAlpha(0),
      this.add.rectangle(left + 24, top + panelHeight - 22, 1, 24, theme.border, 0.34).setDepth(58).setAlpha(0),
      this.add.rectangle(left + panelWidth - 24, top + panelHeight - 22, 34, 1, theme.border, 0.34).setDepth(58).setAlpha(0),
      this.add.rectangle(left + panelWidth - 24, top + panelHeight - 22, 1, 24, theme.border, 0.34).setDepth(58).setAlpha(0),
    ];

    titleText.setPosition(tooltipX, top + paddingTop - 2);
    body.setPosition(tooltipX, ruleY + gap);

    const hint = this.add.text(tooltipX, tooltipY + panelHeight / 2 - 22, 'tap to close', {
      fontFamily: Fonts.ui,
      fontSize: '12px',
      color: '#8a6840',
    }).setOrigin(0.5).setDepth(59).setAlpha(0);

    const closeX = tooltipX + panelWidth / 2 - 24;
    const closeY = tooltipY - panelHeight / 2 + 24;
    const closeBg = this.add.circle(closeX, closeY, 14, 0xf9e8c9, 0.88)
      .setDepth(59)
      .setAlpha(0);
    closeBg.setStrokeStyle(1, theme.border, 0.7);
    const closeIcon = this.add.text(closeX, closeY, '✕', {
      fontFamily: Fonts.ui,
      fontSize: '13px',
      color: '#3c281e',
    }).setOrigin(0.5).setDepth(60).setAlpha(0);

    // Whole panel is clickable to dismiss, not just the small close button. No tiny
    // hit target to aim for while reading.
    const clickZone = this.add.rectangle(tooltipX, tooltipY, panelWidth, panelHeight, 0xffffff, 0)
      .setDepth(61).setInteractive({ useHandCursor: true });

    const allObjects = [
      anchor,
      shadow,
      paper,
      titleRule,
      jewel,
      ...cornerMarks,
      titleText,
      body,
      hint,
      closeBg,
      closeIcon,
      clickZone,
    ];
    paper.setScale(0.98);
    this.tweens.add({
      targets: [shadow, paper, titleRule, jewel, ...cornerMarks, titleText, body, hint, closeBg, closeIcon],
      alpha: 1,
      duration: 220,
      ease: 'Sine.easeOut',
    });
    this.tweens.add({ targets: anchor, alpha: 0.54, duration: 260, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: paper, scaleX: 1, scaleY: 1, duration: 220, ease: 'Back.easeOut' });

    const dismiss = () => {
      clickZone.disableInteractive();
      this.tweens.add({
        targets: allObjects.filter((obj) => obj !== clickZone),
        alpha: 0,
        duration: 220,
        onComplete: () => {
          allObjects.forEach((obj) => obj.destroy());
          this.processMomentTooltipQueue();
        },
      });
    };
    clickZone.on('pointerdown', dismiss);
  }

  private momentIcon(icon?: string): string {
    switch (icon) {
      case 'leaf':
        return '';
      case 'cup':
        return '';
      case 'flower':
        return '';
      case 'window':
        return '';
      case 'sun':
        return '';
      case 'bench':
        return '';
      case 'skyline':
        return '';
      default:
        return '';
    }
  }

  private addDustParticles(): void {
    const theme = setActiveMemoryTheme(this.configData.id);
    for (let i = 0; i < 26; i++) {
      const dust = this.add.circle(Phaser.Math.Between(60, VIEW_W - 60), Phaser.Math.Between(130, VIEW_H - 90), Phaser.Math.FloatBetween(0.8, 1.8), theme.particleColor, Phaser.Math.FloatBetween(0.06, 0.16)).setDepth(11);
      this.tweens.add({
        targets: dust,
        x: dust.x + Phaser.Math.Between(-18, 22),
        y: dust.y - Phaser.Math.Between(18, 46),
        alpha: Phaser.Math.FloatBetween(0.02, 0.1),
        duration: Phaser.Math.Between(5200, 8800),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private addLeafDrift(): void {
    for (let i = 0; i < 5; i++) {
      const leaf = this.add.ellipse(Phaser.Math.Between(40, VIEW_W - 40), Phaser.Math.Between(120, 420), 10, 5, 0xb97939, 0.22).setDepth(10).setAngle(Phaser.Math.Between(-25, 25));
      this.tweens.add({
        targets: leaf,
        x: leaf.x + Phaser.Math.Between(35, 80),
        y: leaf.y + Phaser.Math.Between(24, 58),
        angle: leaf.angle + Phaser.Math.Between(35, 90),
        alpha: 0,
        duration: Phaser.Math.Between(6500, 10000),
        repeat: -1,
        delay: i * 850,
      });
    }
  }

  /**
   * Warm bokeh string-light orbs near the top of the scene — emulates the
   * string of bistro bulbs visible in the rooftop background art. Each orb
   * breathes at its own slightly-off pace and occasionally twinkles with an
   * extra brightness burst. These sit at depth 9 so they live above the bg
   * but below interactive card layers.
   */
  private addBokehLights(): void {
    const theme = setActiveMemoryTheme(this.configData.id);
    const count = 9;
    const yBase = 100;
    const xStep = VIEW_W / (count + 1);
    for (let i = 0; i < count; i++) {
      const bx = xStep * (i + 1) + Phaser.Math.Between(-28, 28);
      const by = yBase + Phaser.Math.Between(-14, 18);
      const radius = Phaser.Math.FloatBetween(8, 16);
      // Outer diffuse halo
      const halo = this.add.circle(bx, by, radius * 2.4, theme.particleColor, 0).setDepth(9);
      this.tweens.add({
        targets: halo,
        alpha: Phaser.Math.FloatBetween(0.04, 0.10),
        scale: Phaser.Math.FloatBetween(1.0, 1.18),
        yoyo: true,
        repeat: -1,
        duration: Phaser.Math.Between(2800, 4800),
        delay: i * 260,
        ease: 'Sine.easeInOut',
      });
      // Bright core
      const core = this.add.circle(bx, by, radius * 0.55, 0xfff8e8, 0).setDepth(9);
      this.tweens.add({
        targets: core,
        alpha: Phaser.Math.FloatBetween(0.52, 0.82),
        scale: Phaser.Math.FloatBetween(0.88, 1.12),
        yoyo: true,
        repeat: -1,
        duration: Phaser.Math.Between(1800, 3600),
        delay: i * 180,
        ease: 'Sine.easeInOut',
      });
      // Occasional twinkle burst
      this.time.addEvent({
        delay: Phaser.Math.Between(4000, 10000) + i * 700,
        loop: true,
        callback: () => {
          this.tweens.add({ targets: core, alpha: 1, scale: 1.7, duration: 80, yoyo: true, ease: 'Sine.easeOut' });
          this.tweens.add({ targets: halo, alpha: 0.22, scale: 1.5, duration: 140, yoyo: true, ease: 'Sine.easeOut' });
        },
      });
    }
  }

  private completeFindMoments(foundLights: Phaser.GameObjects.Arc[]): void {
    if (this.completed) return;
    const theme = setActiveMemoryTheme(this.configData.id);
    AudioManager.playSfx(this, 'sfx-portal');
    this.add.rectangle(VIEW_W / 2, VIEW_H / 2, VIEW_W, VIEW_H, theme.memoryGlow, 0.08).setDepth(45);
    foundLights.forEach((light, index) => {
      this.time.delayedCall(index * 80, () => {
        this.emitTinySparkle(light.x, light.y, 0.7);
        this.tweens.add({ targets: light, alpha: 0.58, scale: 4.4, duration: 520, yoyo: true, ease: 'Sine.easeOut' });
      });
    });
    for (let i = 0; i < 32; i++) {
      this.time.delayedCall(i * 22, () => this.emitTinySparkle(Phaser.Math.Between(120, VIEW_W - 120), Phaser.Math.Between(140, VIEW_H - 100), 0.34));
    }
    const panel = addSoftPanel(this, VIEW_W / 2, VIEW_H / 2, 520, 116, 70, 0x090911, 0.76);
    const restored = this.add.text(VIEW_W / 2, VIEW_H / 2 - 26, 'Memory Restored', {
      fontFamily: Fonts.title,
      fontSize: '40px',
      color: Phaser.Display.Color.IntegerToColor(theme.primary).rgba,
    }).setOrigin(0.5, 0).setDepth(71);
    void panel;
    this.time.delayedCall(1250, () => {
      restored.destroy();
      panel.destroy();
      this.complete();
    });
  }

  private renderHiddenDifferences(): void {
    const theme = setActiveMemoryTheme(this.configData.id);
    const config = this.configData.miniGameConfig;
    const differences = config.differences ?? [];

    this.diffSolved.clear();
    this.diffHintActive = false;
    this.diffGems = [];
    this.diffIsMobile = this.scale.gameSize.width < 768;
    this.diffActiveSide = 'original';

    // ── Stage backdrop ──────────────────────────────────────────────────────
    // The comparison images use the same art as the background, so without a
    // strong visual break the puzzle blends into the scenery. Lay a deep dark
    // curtain over the whole viewport so only the panels and UI read as content.
    const backdrop = this.add.rectangle(VIEW_W / 2, VIEW_H / 2, VIEW_W, VIEW_H, 0x05040a, 0)
      .setDepth(8).setScrollFactor(0);
    this.tweens.add({ targets: backdrop, alpha: 0.78, duration: 500, ease: 'Sine.easeOut' });

    // Ambient bokeh lights still breathe above the curtain
    this.addBokehLights();

    // Desktop panels: 570×324 — large enough to see detail, both fit on 1280px.
    // Centres: lx=320, rx=960 → edges at 35px and 1245px from viewport sides.
    const imgW = this.diffIsMobile ? 760 : 570;
    const imgH = this.diffIsMobile ? 428 : 324;
    const lx = this.diffIsMobile ? VIEW_W / 2 : 320;
    const ly = this.diffIsMobile ? 320 : 355;
    const rx = this.diffIsMobile ? VIEW_W / 2 : 960;
    const ry = ly;

    // ── Spotlight halos behind each panel ───────────────────────────────────
    // Warm ellipses in ADD blend create a "lamp on the panel" theatre effect.
    if (!this.diffIsMobile) {
      const spotL = this.add.ellipse(lx, ly, imgW + 80, imgH + 80, theme.memoryGlow, 0)
        .setDepth(9).setBlendMode(Phaser.BlendModes.ADD);
      const spotR = this.add.ellipse(rx, ry, imgW + 80, imgH + 80, theme.memoryGlow, 0)
        .setDepth(9).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: [spotL, spotR], alpha: 0.07, duration: 700, ease: 'Sine.easeOut' });
      this.tweens.add({ targets: spotL, alpha: 0.10, scale: 1.04, yoyo: true, repeat: -1, duration: 3000, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: spotR, alpha: 0.10, scale: 1.04, yoyo: true, repeat: -1, duration: 3400, ease: 'Sine.easeInOut' });
    }

    // ── Glassmorphic instruction banner ─────────────────────────────────────
    const instruction = config.instruction ?? 'Compare the two rooms and find what changed.';
    const instrPanel = addSoftPanel(this, VIEW_W / 2, 130, 540, 38, 20, 0x090911, 0.54, true);
    instrPanel.setAlpha(0);
    this.tweens.add({ targets: instrPanel, alpha: 1, duration: 440, delay: 180, ease: 'Sine.easeOut' });
    this.add.text(VIEW_W / 2, 130, instruction, {
      fontFamily: Fonts.ui,
      fontSize: '16px',
      color: Phaser.Display.Color.IntegerToColor(theme.primary).rgba,
    }).setOrigin(0.5).setDepth(21).setAlpha(0).setScrollFactor(0);
    this.time.delayedCall(180, () => {
      const t = this.children.list.find(
        (c) => c instanceof Phaser.GameObjects.Text && (c as Phaser.GameObjects.Text).text === instruction,
      ) as Phaser.GameObjects.Text | undefined;
      if (t) this.tweens.add({ targets: t, alpha: 0.92, duration: 440, ease: 'Sine.easeOut' });
    });

    // ── Left image panel ─────────────────────────────────────────────────────
    // originalKey/rightKey (full native res) are kept for the "expand to
    // fullscreen" magnify buttons below; the small comparison panels here use
    // a separately-sharpened variant sized for their own ~570px display, so
    // neither use blurs the other (see sharpVariantKey in ImageFit.ts).
    const originalKey = config.originalImage ?? config.backgroundKey ?? `bg-memory-${this.configData.id}`;
    const originalPanelKey = sharpVariantKey(this, originalKey, imgH);
    this.diffImgLeft = this.add.image(0, 0, originalPanelKey).setDisplaySize(imgW, imgH).setInteractive({ useHandCursor: true });

    this.diffContainerLeft = this.add.container(lx, ly).setDepth(15);
    const frameL = this.add.graphics();
    // Outer glow border (thick warm gold)
    frameL.lineStyle(3, theme.progressColor, 0.38);
    frameL.strokeRect(-imgW / 2 - 3, -imgH / 2 - 3, imgW + 6, imgH + 6);
    // Inner crisp border
    frameL.lineStyle(1.5, theme.border, 0.72);
    frameL.strokeRect(-imgW / 2, -imgH / 2, imgW, imgH);
    // Inner warm edge accent
    frameL.lineStyle(1, theme.highlightColor, 0.18);
    frameL.strokeRect(-imgW / 2 + 2, -imgH / 2 + 2, imgW - 4, imgH - 4);
    // Panel label + expand button (top-right corner)
    const labelL = this.add.text(-imgW / 2 + 10, -imgH / 2 + 9, 'ORIGINAL', {
      fontFamily: Fonts.ui,
      fontSize: '10px',
      color: theme.textSecondary,
      fontStyle: 'bold',
    }).setAlpha(0.7);
    this.diffContainerLeft.add([frameL, this.diffImgLeft, labelL]);

    // ── Right image panel ─────────────────────────────────────────────────────
    const changedKey = config.changedImage ?? `bg-memory-${this.configData.id}-changed`;
    const rightKey = this.textures.exists(changedKey) ? changedKey : originalKey;
    const rightPanelKey = sharpVariantKey(this, rightKey, imgH);
    this.diffImgRight = this.add.image(0, 0, rightPanelKey).setDisplaySize(imgW, imgH);

    this.diffContainerRight = this.add.container(rx, ry).setDepth(15);
    const frameR = this.add.graphics();
    frameR.lineStyle(3, theme.progressColor, 0.38);
    frameR.strokeRect(-imgW / 2 - 3, -imgH / 2 - 3, imgW + 6, imgH + 6);
    frameR.lineStyle(1.5, theme.border, 0.72);
    frameR.strokeRect(-imgW / 2, -imgH / 2, imgW, imgH);
    frameR.lineStyle(1, theme.highlightColor, 0.18);
    frameR.strokeRect(-imgW / 2 + 2, -imgH / 2 + 2, imgW - 4, imgH - 4);
    const labelR = this.add.text(-imgW / 2 + 10, -imgH / 2 + 9, 'CHANGED', {
      fontFamily: Fonts.ui,
      fontSize: '10px',
      color: Phaser.Display.Color.IntegerToColor(theme.primary).rgba,
      fontStyle: 'bold',
    }).setAlpha(0.82);
    this.diffContainerRight.add([frameR, this.diffImgRight, labelR]);

    // ── VS divider between the two panels ───────────────────────────────────
    if (!this.diffIsMobile) {
      const mid = (lx + rx) / 2;
      const divLine = this.add.rectangle(mid, ly, 1.5, imgH - 10, theme.border, 0.22).setDepth(16);
      const vsCircle = this.add.circle(mid, ly, 18, theme.panelBackground, 0.88).setDepth(17);
      vsCircle.setStrokeStyle(1.5, theme.progressColor, 0.6);
      this.add.text(mid, ly, 'VS', {
        fontFamily: Fonts.ui,
        fontSize: '11px',
        color: Phaser.Display.Color.IntegerToColor(theme.progressColor).rgba,
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(18);
      void divLine;
    }

    // ── Expand buttons — scene-level, NOT inside containers ─────────────────
    // Interactive Text/objects inside Phaser containers are depth-sorted
    // within the container, but the image fills the whole hit area and swallows
    // pointer events before in-container children can receive them. Adding the
    // buttons directly to the scene at a higher depth sidesteps this entirely.
    if (!this.diffIsMobile) {
      const btnSize = 28;
      // Left panel — top-right corner in world coords
      const elxBtnX = lx + imgW / 2 - 2;
      const elxBtnY = ly - imgH / 2 + 2;
      const expandCircleL = this.add.circle(elxBtnX, elxBtnY, btnSize / 2, 0x090911, 0.72)
        .setDepth(25).setInteractive({ useHandCursor: true });
      expandCircleL.setStrokeStyle(1.5, theme.progressColor, 0.7);
      const expandIconL = this.add.text(elxBtnX, elxBtnY, '⤢', {
        fontFamily: Fonts.ui, fontSize: '13px',
        color: Phaser.Display.Color.IntegerToColor(theme.progressColor).rgba,
      }).setOrigin(0.5).setDepth(26);
      expandCircleL.on('pointerover', () => { expandCircleL.setFillStyle(theme.progressColor, 0.22); expandIconL.setAlpha(1); });
      expandCircleL.on('pointerout', () => { expandCircleL.setFillStyle(0x090911, 0.72); expandIconL.setAlpha(0.8); });
      expandCircleL.on('pointerdown', () => this.openDiffImageFullscreen(originalKey, 'ORIGINAL', imgW, imgH));

      // Right panel — top-right corner in world coords
      const erxBtnX = rx + imgW / 2 - 2;
      const erxBtnY = ry - imgH / 2 + 2;
      const expandCircleR = this.add.circle(erxBtnX, erxBtnY, btnSize / 2, 0x090911, 0.72)
        .setDepth(25).setInteractive({ useHandCursor: true });
      expandCircleR.setStrokeStyle(1.5, theme.progressColor, 0.7);
      const expandIconR = this.add.text(erxBtnX, erxBtnY, '⤢', {
        fontFamily: Fonts.ui, fontSize: '13px',
        color: Phaser.Display.Color.IntegerToColor(theme.progressColor).rgba,
      }).setOrigin(0.5).setDepth(26);
      expandCircleR.on('pointerover', () => { expandCircleR.setFillStyle(theme.progressColor, 0.22); expandIconR.setAlpha(1); });
      expandCircleR.on('pointerout', () => { expandCircleR.setFillStyle(0x090911, 0.72); expandIconR.setAlpha(0.8); });
      expandCircleR.on('pointerdown', () => this.openDiffImageFullscreen(rightKey, 'CHANGED', imgW, imgH));
    }

    // Slide both containers in from slightly off-screen for a cinematic entry
    if (!this.diffIsMobile) {
      this.diffContainerLeft.x = lx - 30;
      this.diffContainerLeft.alpha = 0;
      this.diffContainerRight.x = rx + 30;
      this.diffContainerRight.alpha = 0;
      this.tweens.add({ targets: this.diffContainerLeft, x: lx, alpha: 1, duration: 480, ease: 'Back.easeOut', delay: 100 });
      this.tweens.add({ targets: this.diffContainerRight, x: rx, alpha: 1, duration: 480, ease: 'Back.easeOut', delay: 200 });
    }

    // Overlay differences programmatically on the right side if fallback is used
    if (rightKey === originalKey) {
      this.createChangedOverlays(this.diffContainerRight, imgW, imgH);
    }

    if (!this.diffIsMobile) {
      this.diffImgRight.setInteractive({ useHandCursor: true });
    }

    // Pointer down handler
    const onPointerDown = (pointer: Phaser.Input.Pointer, localX: number, localY: number, clickedImg: Phaser.GameObjects.Image) => {
      this.onDiffClick(pointer, localX, localY, clickedImg);
    };
    this.diffImgLeft.on('pointerdown', (p: Phaser.Input.Pointer, lX: number, lY: number) => onPointerDown(p, lX, lY, this.diffImgLeft!));
    if (!this.diffIsMobile) {
      this.diffImgRight.on('pointerdown', (p: Phaser.Input.Pointer, lX: number, lY: number) => onPointerDown(p, lX, lY, this.diffImgRight!));
    }

    // Hover sparkle near unsolved differences
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.completed) return;
      const checkHover = (container: Phaser.GameObjects.Container) => {
        const dx = pointer.x - container.x;
        const dy = pointer.y - container.y;
        if (Math.abs(dx) <= imgW / 2 && Math.abs(dy) <= imgH / 2) {
          const normX = (dx + imgW / 2) / imgW;
          const normY = (dy + imgH / 2) / imgH;
          for (const diff of differences) {
            if (this.diffSolved.has(diff.id || '')) continue;
            const dist = Phaser.Math.Distance.Between(normX, normY, diff.x, diff.y);
            if (dist <= (diff.radius || 0.05) * 1.5) {
              if (Phaser.Math.Between(1, 100) <= 6) {
                this.emitTinySparkle(pointer.x + Phaser.Math.Between(-8, 8), pointer.y + Phaser.Math.Between(-8, 8), 0.22);
              }
            }
          }
        }
      };
      checkHover(this.diffContainerLeft!);
      if (!this.diffIsMobile) checkHover(this.diffContainerRight!);
    });

    // Periodic hint sparkles every 12 seconds
    this.diffSparkleTimer = this.time.addEvent({
      delay: 12000,
      loop: true,
      callback: () => {
        if (this.completed) return;
        const unsolved = differences.find((d) => !this.diffSolved.has(d.id || ''));
        if (!unsolved) return;
        const localX = unsolved.x * imgW - imgW / 2;
        const localY = unsolved.y * imgH - imgH / 2;
        this.emitTinySparkle(this.diffContainerLeft!.x + localX, this.diffContainerLeft!.y + localY, 0.4);
        if (!this.diffIsMobile) {
          this.emitTinySparkle(this.diffContainerRight!.x + localX, this.diffContainerRight!.y + localY, 0.4);
        }
      },
    });

    // Mobile layout toggle
    if (this.diffIsMobile) {
      this.diffImgRight.setAlpha(0);
      this.diffImgRight.setInteractive({ useHandCursor: true });
      this.diffImgRight.on('pointerdown', (p: Phaser.Input.Pointer, lX: number, lY: number) => onPointerDown(p, lX, lY, this.diffImgRight!));
      this.renderMobileToggleButton(510);
    }

    // ── Premium Hint & Reset buttons ─────────────────────────────────────────
    const btnY = this.diffIsMobile ? 580 : VIEW_H - 82;

    const hintBtn = this.add.rectangle(VIEW_W / 2 + 180, btnY, 112, 36, theme.panelBackground, 0.72).setDepth(30).setScrollFactor(0);
    hintBtn.setStrokeStyle(1.5, theme.progressColor, 0.5);
    this.add.text(VIEW_W / 2 + 180, btnY, '✦  Hint', {
      fontFamily: Fonts.ui,
      fontSize: '14px',
      color: Phaser.Display.Color.IntegerToColor(theme.progressColor).rgba,
    }).setOrigin(0.5).setDepth(31).setScrollFactor(0);
    hintBtn.setInteractive({ useHandCursor: true });
    hintBtn.on('pointerdown', () => this.showHint());
    hintBtn.on('pointerover', () => { hintBtn.setFillStyle(theme.progressColor, 0.18); });
    hintBtn.on('pointerout', () => { hintBtn.setFillStyle(theme.panelBackground, 0.72); });

    const resetBtn = this.add.rectangle(VIEW_W / 2 - 180, btnY, 112, 36, theme.panelBackground, 0.72).setDepth(30).setScrollFactor(0);
    resetBtn.setStrokeStyle(1.5, theme.border, 0.4);
    this.add.text(VIEW_W / 2 - 180, btnY, '↺  Reset', {
      fontFamily: Fonts.ui,
      fontSize: '14px',
      color: '#d8cabb',
    }).setOrigin(0.5).setDepth(31).setScrollFactor(0);
    resetBtn.setInteractive({ useHandCursor: true });
    resetBtn.on('pointerdown', () => this.scene.restart());
    resetBtn.on('pointerover', () => { resetBtn.setFillStyle(0x1a1530, 0.88); });
    resetBtn.on('pointerout', () => { resetBtn.setFillStyle(theme.panelBackground, 0.72); });

    this.renderProgressGems(theme);
  }

  /**
   * Opens a single comparison image at near-full-screen size so the player
   * can inspect fine details without leaving the mini-game. A dark overlay
   * covers the entire viewport, the image is centred and scaled to 90% of the
   * viewport height, and tapping the X button or pressing Escape dismisses it.
   */
  private openDiffImageFullscreen(textureKey: string, label: string, srcW: number, srcH: number): void {
    // Track every object we create so teardown is simply: fade → destroy all.
    const fsObjects: Phaser.GameObjects.GameObject[] = [];
    let teardownFired = false;

    const teardown = () => {
      if (teardownFired) return;
      teardownFired = true;
      // Remove ESC listener before tweening so it can't re-fire
      this.input.keyboard?.removeKey(Phaser.Input.Keyboard.KeyCodes.ESC);
      this.tweens.add({
        targets: fsObjects,
        alpha: 0,
        duration: 200,
        ease: 'Sine.easeIn',
        onComplete: () => fsObjects.forEach((o) => { if (o.active) o.destroy(); }),
      });
    };

    // ── Scrim ────────────────────────────────────────────────────────────────
    const scrim = this.add.rectangle(VIEW_W / 2, VIEW_H / 2, VIEW_W, VIEW_H, 0x03020a, 1)
      .setDepth(95).setScrollFactor(0).setInteractive();
    // Clicking the dark area outside the image also closes
    scrim.on('pointerdown', teardown);
    fsObjects.push(scrim);

    // ── Image sizing — use ACTUAL texture dimensions for correct aspect ratio ─
    // srcW/srcH are the display-size in the source widget (e.g. a polaroid card)
    // and may not match the real image proportions. Reading naturalWidth/Height
    // from the texture source ensures portrait/landscape images never stretch.
    let natW = srcW;
    let natH = srcH;
    if (this.textures.exists(textureKey)) {
      const texSrc = this.textures.get(textureKey).getSourceImage() as HTMLImageElement;
      if (texSrc && texSrc.naturalWidth) {
        natW = texSrc.naturalWidth;
        natH = texSrc.naturalHeight;
      }
    }
    const maxW = VIEW_W * 0.88;
    const maxH = VIEW_H * 0.86;
    const scale = Math.min(maxW / natW, maxH / natH);
    const dispW = natW * scale;
    const dispH = natH * scale;
    const cx = VIEW_W / 2;
    const cy = VIEW_H / 2;

    // ── Gold frame ──────────────────────────────────────────────────────────
    const frameFS = this.add.graphics().setDepth(97).setScrollFactor(0);
    frameFS.lineStyle(2.5, 0xc8a96a, 0.65);
    frameFS.strokeRect(cx - dispW / 2 - 3, cy - dispH / 2 - 3, dispW + 6, dispH + 6);
    frameFS.lineStyle(1, 0xffffff, 0.10);
    frameFS.strokeRect(cx - dispW / 2 + 1, cy - dispH / 2 + 1, dispW - 2, dispH - 2);
    fsObjects.push(frameFS);

    // ── Image ────────────────────────────────────────────────────────────────
    const img = this.add.image(cx, cy, textureKey)
      .setDisplaySize(dispW, dispH)
      .setDepth(96).setScrollFactor(0).setAlpha(0);
    this.tweens.add({ targets: img, alpha: 1, duration: 300, ease: 'Sine.easeOut' });
    // Clicking the image itself does NOT close (so the user can look at it)
    img.setInteractive();
    fsObjects.push(img);

    // ── Label badge ─────────────────────────────────────────────────────────
    const isChanged = label === 'CHANGED';
    const badgeBg = this.add.rectangle(
      cx - dispW / 2 + 58, cy - dispH / 2 + 18,
      96, 22, isChanged ? 0x8a6030 : 0x2a2040, 0.90,
    ).setDepth(98).setScrollFactor(0);
    badgeBg.setStrokeStyle(1, 0xc8a96a, 0.55);
    fsObjects.push(badgeBg);

    const labelTxt = this.add.text(cx - dispW / 2 + 58, cy - dispH / 2 + 18, label, {
      fontFamily: Fonts.ui, fontSize: '11px',
      color: isChanged ? '#fff8ec' : '#d8cabb',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(99).setScrollFactor(0);
    fsObjects.push(labelTxt);

    // ── Close button — large circle, top-right corner ────────────────────────
    const closeCx = cx + dispW / 2 + 14;   // sits just outside the image edge
    const closeCy = cy - dispH / 2 - 14;
    const closeBg = this.add.circle(closeCx, closeCy, 18, 0x1a1424, 0.95)
      .setDepth(100).setScrollFactor(0).setInteractive({ useHandCursor: true });
    closeBg.setStrokeStyle(2, 0xc8a96a, 0.85);
    fsObjects.push(closeBg);

    const closeIcon = this.add.text(closeCx, closeCy, '✕', {
      fontFamily: Fonts.ui, fontSize: '15px', color: '#ffd9a0',
    }).setOrigin(0.5).setDepth(101).setScrollFactor(0);
    fsObjects.push(closeIcon);

    closeBg.on('pointerdown', teardown);
    closeBg.on('pointerover', () => closeBg.setFillStyle(0xc8a96a, 0.28));
    closeBg.on('pointerout', () => closeBg.setFillStyle(0x1a1424, 0.95));

    // ── Hint ─────────────────────────────────────────────────────────────────
    const hint = this.add.text(cx, cy + dispH / 2 + 20, 'press Escape or click outside to close', {
      fontFamily: Fonts.ui, fontSize: '12px', color: '#5a5040',
    }).setOrigin(0.5).setDepth(99).setScrollFactor(0).setAlpha(0);
    this.tweens.add({ targets: hint, alpha: 0.75, duration: 380, delay: 400 });
    fsObjects.push(hint);

    // ── ESC key ───────────────────────────────────────────────────────────────
    const escKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    escKey?.once('down', teardown);
  }


  private createChangedOverlays(rightContainer: Phaser.GameObjects.Container, imgW: number, imgH: number): void {
    const overlay = this.add.graphics().setDepth(12);

    // 1. Shirt detail changed: (x: 0.28, y: 0.38) - Draw golden button/pocket detail
    const sx = 0.28 * imgW - imgW / 2;
    const sy = 0.38 * imgH - imgH / 2;
    overlay.fillStyle(0xffd9a0, 0.95);
    overlay.fillCircle(sx, sy, 6);
    overlay.lineStyle(1, 0xffffff, 0.8);
    overlay.strokeCircle(sx, sy, 6);

    // 2. Notice board note missing: (x: 0.69, y: 0.50) - Cover with warm brown rectangle
    const nx = 0.69 * imgW - imgW / 2;
    const ny = 0.50 * imgH - imgH / 2;
    overlay.fillStyle(0x734a34, 1);
    overlay.fillRect(nx - 14, ny - 14, 28, 28);
    overlay.lineStyle(1.5, 0x543524, 0.4);
    overlay.strokeRect(nx - 14, ny - 14, 28, 28);

    // 3. Flower color changed: (x: 0.32, y: 0.55) - Render blue/purple flower petals
    const fx = 0.32 * imgW - imgW / 2;
    const fy = 0.55 * imgH - imgH / 2;
    overlay.fillStyle(0x8fb6ff, 0.85);
    overlay.fillCircle(fx, fy, 7);
    overlay.fillStyle(0xb8c4ff, 0.9);
    overlay.fillCircle(fx - 4, fy + 2, 5);
    overlay.fillCircle(fx + 4, fy - 2, 5);

    // 4. Desk photo frame changed: (x: 0.50, y: 0.65) - Wood frame with a gold heart symbol
    const px = 0.50 * imgW - imgW / 2;
    const py = 0.65 * imgH - imgH / 2;
    overlay.fillStyle(0x1a120c, 1);
    overlay.fillRect(px - 12, py - 15, 24, 30);
    overlay.lineStyle(1.5, 0xd8b98d, 0.9);
    overlay.strokeRect(px - 12, py - 15, 24, 30);
    overlay.fillStyle(0xd8b98d, 0.95);
    overlay.fillCircle(px - 4, py, 3);
    overlay.fillCircle(px + 4, py, 3);
    overlay.beginPath();
    overlay.moveTo(px - 7, py + 1);
    overlay.lineTo(px + 7, py + 1);
    overlay.lineTo(px, py + 7);
    overlay.closePath();
    overlay.fill();

    // 5. Book position changed: (x: 0.58, y: 0.60) - Cover original book, draw rotated book cover
    const bx = 0.58 * imgW - imgW / 2;
    const by = 0.60 * imgH - imgH / 2;
    overlay.fillStyle(0x3d2b20, 1); // table wood color
    overlay.fillRect(bx - 20, by - 15, 40, 30);
    
    // Draw rotated book shape
    overlay.fillStyle(0xc77b43, 0.95);
    overlay.fillRect(bx + 8 - 12, by + 4 - 16, 24, 32);
    overlay.fillStyle(0xfff5df, 1); // page edge
    overlay.fillRect(bx + 8 - 10, by + 4 - 14, 20, 2);

    // 6. Window / curtain detail changed: (x: 0.77, y: 0.32) - Dark curtain fold shadow line
    const wx = 0.77 * imgW - imgW / 2;
    const wy = 0.32 * imgH - imgH / 2;
    overlay.lineStyle(2, 0x1f1625, 0.4);
    overlay.beginPath();
    overlay.moveTo(wx - 8, wy - 22);
    overlay.lineTo(wx + 4, wy + 22);
    overlay.strokePath();

    rightContainer.add(overlay);
  }

  private onDiffClick(_pointer: Phaser.Input.Pointer, localX: number, localY: number, clickedImg: Phaser.GameObjects.Image): void {
    if (this.completed) return;

    const normX = localX / clickedImg.width;
    const normY = localY / clickedImg.height;

    let foundDiff: any = null;
    const differences = this.configData.miniGameConfig.differences ?? [];
    for (const diff of differences) {
      if (this.diffSolved.has(diff.id || '')) continue;

      const dx = normX - diff.x;
      const dy = normY - diff.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= (diff.radius || 0.05)) {
        foundDiff = diff;
        break;
      }
    }

    if (foundDiff) {
      this.diffSolved.add(foundDiff.id || '');
      this.solveDifference(foundDiff);
    } else {
      this.wrongClickFeedback(clickedImg);
    }
  }

  private solveDifference(diff: any): void {
    const theme = setActiveMemoryTheme(this.configData.id);
    this.playRipple(diff.x, diff.y);
    this.drawSolvedMarker(diff.x, diff.y);
    
    const count = this.configData.miniGameConfig.differences?.length ?? 6;
    this.updateProgressGems(theme);

    const description = diff.description ?? 'A small detail noticed.';
    this.showCaption(`${diff.label} ${description}`);

    if (this.diffSolved.size >= count) {
      this.time.delayedCall(800, () => this.animateRestoredMerge());
    } else {
      AudioManager.playSfx(this, 'sfx-interact');
    }
  }

  private playRipple(normX: number, normY: number): void {
    const imgW = this.diffIsMobile ? 760 : 540;
    const imgH = this.diffIsMobile ? 428 : 304;

    const lx = normX * imgW - imgW / 2;
    const ly = normY * imgH - imgH / 2;

    const positions = [
      { x: this.diffContainerLeft!.x + lx, y: this.diffContainerLeft!.y + ly }
    ];
    if (!this.diffIsMobile) {
      positions.push({ x: this.diffContainerRight!.x + lx, y: this.diffContainerRight!.y + ly });
    }

    positions.forEach((pos) => {
      const ring = this.add.circle(pos.x, pos.y, 4, 0xffd9a0, 0).setDepth(45);
      ring.setStrokeStyle(1.5, 0xffd9a0, 0.9);
      this.tweens.add({
        targets: ring,
        radius: 42,
        alpha: 0,
        duration: 800,
        ease: 'Cubic.easeOut',
        onComplete: () => ring.destroy(),
      });

      for (let i = 0; i < 6; i++) {
        this.emitTinySparkle(pos.x, pos.y, 0.7);
      }
    });
  }

  private drawSolvedMarker(normX: number, normY: number): void {
    const imgW = this.diffIsMobile ? 760 : 540;
    const imgH = this.diffIsMobile ? 428 : 304;

    const lx = normX * imgW - imgW / 2;
    const ly = normY * imgH - imgH / 2;

    const markerL = this.add.circle(lx, ly, 8, 0xffd9a0, 0.28).setDepth(20);
    markerL.setStrokeStyle(1, 0xffd9a0, 0.6);
    const dotL = this.add.circle(lx, ly, 2, 0xffffff, 0.9).setDepth(21);
    this.diffContainerLeft!.add([markerL, dotL]);

    if (!this.diffIsMobile) {
      const markerR = this.add.circle(lx, ly, 8, 0xffd9a0, 0.28).setDepth(20);
      markerR.setStrokeStyle(1, 0xffd9a0, 0.6);
      const dotR = this.add.circle(lx, ly, 2, 0xffffff, 0.9).setDepth(21);
      this.diffContainerRight!.add([markerR, dotR]);
    }
  }

  private renderProgressGems(theme: ReturnType<typeof setActiveMemoryTheme>): void {
    const count = this.configData.miniGameConfig.differences?.length ?? 6;
    const startX = VIEW_W / 2 - ((count - 1) * 28) / 2;
    const y = this.diffIsMobile ? 635 : VIEW_H - 118;

    const gemsBg = addSoftPanel(this, VIEW_W / 2, y, count * 32 + 24, 30, 28, 0x090911, 0.46);
    void gemsBg;

    this.diffGems = [];
    for (let i = 0; i < count; i++) {
      const gx = startX + i * 28;
      const gem = this.add.circle(gx, y, 6, theme.shadow, 0.58).setDepth(32);
      gem.setStrokeStyle(1, theme.secondary, 0.8);
      this.diffGems.push(gem);
    }
  }

  private updateProgressGems(theme: ReturnType<typeof setActiveMemoryTheme>): void {
    const solvedCount = this.diffSolved.size;
    for (let i = 0; i < this.diffGems.length; i++) {
      const gem = this.diffGems[i];
      if (i < solvedCount) {
        gem.setFillStyle(theme.progressColor, 0.95);
        gem.setStrokeStyle(1, theme.highlightColor, 0.95);
        this.tweens.add({
          targets: gem,
          scale: 1.45,
          yoyo: true,
          duration: 220,
        });
      }
    }

    const count = this.configData.miniGameConfig.differences?.length ?? 6;
    this.addProgress(`${solvedCount} / ${count} differences found`);
  }

  private wrongClickFeedback(clickedImg: Phaser.GameObjects.Image): void {
    AudioManager.playSfx(this, 'sfx-footstep');
    const container = clickedImg === this.diffImgLeft ? this.diffContainerLeft : this.diffContainerRight;
    if (!container) return;

    const originalX = container.x;
    this.tweens.add({
      targets: container,
      x: originalX + 6,
      duration: 60,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        container.setX(originalX);
      }
    });
  }

  private showHint(): void {
    if (this.diffHintActive || this.completed) return;
    this.diffHintActive = true;

    const differences = this.configData.miniGameConfig.differences ?? [];
    const unsolved = differences.find((d) => !this.diffSolved.has(d.id || ''));
    if (!unsolved) {
      this.diffHintActive = false;
      return;
    }

    AudioManager.playSfx(this, 'sfx-interact');

    const imgW = this.diffIsMobile ? 760 : 540;
    const imgH = this.diffIsMobile ? 428 : 304;

    const lx = unsolved.x * imgW - imgW / 2;
    const ly = unsolved.y * imgH - imgH / 2;

    const leftCircle = this.add.circle(lx, ly, 22, 0xffd9a0, 0).setDepth(20);
    leftCircle.setStrokeStyle(2, 0xffd9a0, 0.85);
    this.diffContainerLeft!.add(leftCircle);

    let rightCircle: Phaser.GameObjects.Arc | null = null;
    if (!this.diffIsMobile) {
      rightCircle = this.add.circle(lx, ly, 22, 0xffd9a0, 0).setDepth(20);
      rightCircle.setStrokeStyle(2, 0xffd9a0, 0.85);
      this.diffContainerRight!.add(rightCircle);
    }

    const targets = rightCircle ? [leftCircle, rightCircle] : [leftCircle];
    this.tweens.add({
      targets,
      scaleX: 1.4,
      scaleY: 1.4,
      alpha: 0.1,
      duration: 500,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        leftCircle.destroy();
        rightCircle?.destroy();
        this.diffHintActive = false;
      }
    });
  }

  private renderMobileToggleButton(y: number): void {
    const cx = VIEW_W / 2;
    const btn = this.add.rectangle(cx, y, 220, 36, 0x090911, 0.62).setDepth(30);
    btn.setStrokeStyle(1, 0xffd9a0, 0.34);
    const btnText = this.add.text(cx, y, 'Showing: Original', {
      fontFamily: Fonts.ui,
      fontSize: '16px',
      color: '#ffd9a0',
    }).setOrigin(0.5).setDepth(31);

    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => {
      this.diffActiveSide = this.diffActiveSide === 'original' ? 'changed' : 'original';
      const targetAlpha = this.diffActiveSide === 'changed' ? 1 : 0;

      this.tweens.add({
        targets: this.diffImgRight,
        alpha: targetAlpha,
        duration: 240,
        ease: 'Sine.easeInOut',
      });

      btnText.setText(`Showing: ${this.diffActiveSide === 'original' ? 'Original' : 'Changed'}`);
      AudioManager.playSfx(this, 'sfx-page-turn');
    });

    btn.on('pointerover', () => btn.setFillStyle(0x151021, 0.78));
    btn.on('pointerout', () => btn.setFillStyle(0x090911, 0.62));
  }

  private animateRestoredMerge(): void {
    this.completed = true;
    this.diffSparkleTimer?.remove();
    this.input.off('pointermove');

    AudioManager.playSfx(this, 'sfx-portal');

    const leftMarkers = this.diffContainerLeft!.list.filter((child) => child instanceof Phaser.GameObjects.Arc);
    leftMarkers.forEach((marker, idx) => {
      this.time.delayedCall(200 + idx * 180, () => {
        this.tweens.add({
          targets: marker,
          scaleX: 1.8,
          scaleY: 1.8,
          alpha: 0.9,
          duration: 250,
          yoyo: true,
          ease: 'Quad.easeInOut',
        });
      });
    });

    const targetX = VIEW_W / 2;
    this.time.delayedCall(leftMarkers.length * 180 + 300, () => {
      if (this.diffIsMobile) {
        this.tweens.add({
          targets: this.diffImgRight,
          alpha: 0,
          duration: 1200,
          ease: 'Cubic.easeInOut',
        });
      } else {
        this.tweens.add({
          targets: this.diffContainerLeft,
          x: targetX,
          duration: 1500,
          ease: 'Cubic.easeInOut',
        });
        this.tweens.add({
          targets: this.diffContainerRight,
          x: targetX,
          alpha: 0,
          duration: 1500,
          ease: 'Cubic.easeInOut',
        });
      }

      this.time.delayedCall(1600, () => {
        AudioManager.playSfx(this, 'sfx-memory-restored');
        for (let i = 0; i < 28; i++) {
          this.time.delayedCall(i * 30, () => {
            this.emitTinySparkle(
              VIEW_W / 2 + Phaser.Math.Between(-280, 280),
              VIEW_H / 2 + Phaser.Math.Between(-160, 160),
              0.72
            );
          });
        }
        
        const textTheme = setActiveMemoryTheme(this.configData.id);
        const compText = this.configData.miniGameConfig.completionText ?? 'Some details change, but the feeling stays.';
        
        const restoredPanel = addSoftPanel(this, VIEW_W / 2, VIEW_H / 2, 620, 140, 81, 0x090911, 0.82).setAlpha(0);
        const restoredTitle = this.add.text(VIEW_W / 2, VIEW_H / 2 - 36, 'Memory Restored', {
          fontFamily: Fonts.title,
          fontSize: '36px',
          color: Phaser.Display.Color.IntegerToColor(textTheme.primary).rgba,
        }).setOrigin(0.5, 0).setDepth(82).setAlpha(0).setScrollFactor(0);

        const restoredBody = this.add.text(VIEW_W / 2, VIEW_H / 2 + 10, compText, {
          fontFamily: Fonts.body,
          fontSize: '22px',
          color: '#ffd9a0',
          align: 'center',
          wordWrap: { width: 560 },
        }).setOrigin(0.5, 0).setDepth(82).setAlpha(0).setScrollFactor(0);
        
        this.tweens.add({
          targets: [restoredPanel, restoredTitle, restoredBody],
          alpha: 1,
          duration: 600,
        });

        this.time.delayedCall(3000, () => {
          // This panel and the generic complete() panel both render at
          // (VIEW_W/2, VIEW_H/2) with the same depth — without destroying
          // this one first, "Memory Restored" and the generic completion
          // message rendered directly on top of each other, garbled together.
          restoredPanel.destroy();
          restoredTitle.destroy();
          restoredBody.destroy();
          this.completed = false; // Reset completed so complete() can execute
          this.complete();
        });
      });
    });
  }

  private renderAlbumRestore(): void {
    const theme = setActiveMemoryTheme(this.configData.id);
    const config = this.configData.miniGameConfig;
    const scrapbook = config.scrapbook;

    if (!scrapbook) {
      this.complete();
      return;
    }

    this.scrapSolved.clear();
    this.scrapPiecesPlaced = 0;
    this.scrapDevelopedImg = undefined;
    this.scrapMasks.forEach((m) => m.destroy());
    this.scrapMasks = [];
    this.scrapIsMobile = this.scale.gameSize.width < 768;

    // ── Stage curtain — same treatment as Hidden Differences ─────────────────
    // The album background is parchment-coloured art that blends with the
    // scene. A dark scrim behind the album box makes the page pop as a
    // distinct content area without hiding the atmospheric background entirely.
    const curtain = this.add.rectangle(VIEW_W / 2, VIEW_H / 2, VIEW_W, VIEW_H, 0x08060f, 0)
      .setDepth(3).setScrollFactor(0);
    this.tweens.add({ targets: curtain, alpha: 0.62, duration: 520, ease: 'Sine.easeOut' });

    // Ambient bokeh breathes above the curtain at depth 4
    this.addBokehLights();

    this.addDustParticles();
    this.addLeafDrift();

    // Match the 16:9 scrapbook artwork exactly so its paper, binding and
    // decorations never stretch. The larger desktop spread also keeps every
    // photo and loose fragment comfortably inside the physical page.
    const pageW = this.scrapIsMobile ? 760 : 1120;
    const pageH = this.scrapIsMobile ? 428 : 630;

    // ── Album shell — premium scrapbook spread asset ─────────────────────────
    const albumShadow = this.add.rectangle(VIEW_W / 2 + 8, VIEW_H / 2 + 10, pageW + 24, pageH + 22, 0x000000, 0.34)
      .setDepth(4);
    albumShadow.setScale(1, 0.96);
    // The PNG includes transparent canvas around the physical book. Keep the
    // opaque paper backing inside the visible leather edges so it cannot form
    // a rectangular halo outside the scrapbook silhouette.
    const albumPaper = this.add.rectangle(VIEW_W / 2, VIEW_H / 2, pageW * 0.86, pageH * 0.79, 0xf3e4c7, 1)
      .setDepth(4.5)
      .setAlpha(0);
    const scrapbookBg = this.textures.exists('photo-album-bg')
      ? this.add.image(VIEW_W / 2, VIEW_H / 2, 'photo-album-bg').setDisplaySize(pageW + 18, pageH + 18).setDepth(5)
      : addSoftPanel(this, VIEW_W / 2, VIEW_H / 2, pageW, pageH, 5, 0xfbf0d8, 0.97);
    scrapbookBg.setAlpha(0);
    this.tweens.add({ targets: [albumShadow, albumPaper, scrapbookBg], alpha: 1, duration: 520, ease: 'Sine.easeOut' });

    // Glassmorphic instruction banner
    const instrPanel = addSoftPanel(this, VIEW_W / 2, VIEW_H / 2 - pageH / 2 - 28, 420, 34, 20, 0x090911, 0.52, true);
    instrPanel.setAlpha(0);
    this.tweens.add({ targets: instrPanel, alpha: 1, duration: 440, delay: 200, ease: 'Sine.easeOut' });
    const instrTxt = this.add.text(VIEW_W / 2, VIEW_H / 2 - pageH / 2 - 28,
      config.instruction ?? 'Drag the photo fragments to restore the memory.', {
        fontFamily: Fonts.ui, fontSize: '15px',
        color: Phaser.Display.Color.IntegerToColor(theme.primary).rgba,
      }).setOrigin(0.5).setDepth(21).setAlpha(0);
    this.tweens.add({ targets: instrTxt, alpha: 0.9, duration: 440, delay: 200 });

    if (!this.scrapIsMobile) {
      // Handwritten album header — sits above all scattered fragments
      const headerBacking = this.add.rectangle(VIEW_W / 2 - 90, 150, 210, 60, 0xfbf0d8, 0.68).setDepth(24);
      headerBacking.setAngle(-3);
      this.add.text(VIEW_W / 2 - 90, 134, 'Chapters of Us', {
        fontFamily: '"Bradley Hand", "Snell Roundhand", cursive',
        fontSize: '28px', color: '#4b3c33', align: 'center',
      }).setOrigin(0.5).setDepth(25).setAngle(-3);
      this.add.text(VIEW_W / 2 - 90, 166, 'Memory V — Restored', {
        fontFamily: '"Bradley Hand", "Snell Roundhand", cursive',
        fontSize: '17px', color: '#8f8078', align: 'center',
      }).setOrigin(0.5).setDepth(25).setAngle(-2.5);
    }

    scrapbook.supportingPhotos.forEach((photo: any, pidx: number) => {
      const px = photo.x * VIEW_W;
      const py = photo.y * VIEW_H;

      const photoContainer = this.add.container(px, py).setDepth(10).setAngle(photo.rotation * 180 / Math.PI);

      const cardW = 164;
      const cardH = 218;
      const imgW2 = 144;
      const imgH2 = 170;

      // Multi-layer shadow for depth
      const shadow2 = this.add.rectangle(7, 7, cardW, cardH, 0x000000, 0.07);
      const shadow = this.add.rectangle(3, 3, cardW, cardH, 0x000000, 0.16);
      const cardBack = this.add.rectangle(0, 0, cardW, cardH, 0xfffef8, 1);
      cardBack.setStrokeStyle(1.5, 0xc9a86c, 0.32);
      // Aged paper tint along left edge
      const edgeTint = this.add.rectangle(-cardW / 2 + 3, 0, 6, cardH, 0xe8d8b0, 0.48);

      const tape = this.add.rectangle(0, -cardH / 2 + 4, 62, 18, 0xfdf3cf, 0.55)
        .setAngle(Phaser.Math.Between(-18, 18));
      tape.setStrokeStyle(1, 0xffffff, 0.18);

      const imgKey = photo.key;
      let sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
      if (this.textures.exists(imgKey)) {
        // This polaroid is tiny (182x172) but tapping it opens a magnified
        // fullscreen view via the untouched `imgKey` below — use a separate
        // sharpened variant here so the small card is crisp without
        // softening that magnify view.
        const displayKey = sharpVariantKey(this, imgKey, imgH2);
        const photoImage = this.add.image(0, -14, displayKey);
        const source = this.textures.get(displayKey).getSourceImage() as HTMLImageElement;
        const sourceRatio = source.width / source.height;
        const frameRatio = imgW2 / imgH2;
        if (sourceRatio > frameRatio) {
          const cropW = source.height * frameRatio;
          photoImage.setCrop((source.width - cropW) / 2, 0, cropW, source.height);
        } else {
          const cropH = source.width / frameRatio;
          photoImage.setCrop(0, (source.height - cropH) / 2, source.width, cropH);
        }
        sprite = photoImage.setDisplaySize(imgW2, imgH2);
      } else {
        sprite = this.add.rectangle(0, -16, imgW2, imgH2, 0xe4dcd2, 1);
        const text = this.add.text(0, -16, photo.label ?? 'Memory', {
          fontFamily: Fonts.ui, fontSize: '14px', color: '#6e5e54',
        }).setOrigin(0.5);
        photoContainer.add(text);
      }

      // Zoom hint icon (magnifier) in bottom-right of the image area
      const zoomHint = this.add.text(imgW2 / 2 - 2, -14 + imgH2 / 2 - 2, '🔍', {
        fontSize: '12px',
      }).setOrigin(1, 1).setAlpha(0).setDepth(1);

      const caption = this.add.text(0, imgH2 / 2 + 17, photo.label ?? '', {
        fontFamily: '"Bradley Hand", "Snell Roundhand", cursive',
        fontSize: '15px', color: '#4b3c33',
      }).setOrigin(0.5);

      photoContainer.add([shadow2, shadow, cardBack, edgeTint, sprite, zoomHint, caption, tape]);
      photoContainer.sendToBack(shadow);
      photoContainer.sendToBack(shadow2);

      // Make the whole polaroid tappable — opens fullscreen zoom
      photoContainer.setSize(cardW, cardH).setInteractive({ useHandCursor: true });
      photoContainer.on('pointerover', () => {
        this.tweens.add({ targets: zoomHint, alpha: 0.7, duration: 150 });
        this.tweens.add({ targets: photoContainer, scale: 1.04, duration: 140 });
      });
      photoContainer.on('pointerout', () => {
        this.tweens.add({ targets: zoomHint, alpha: 0, duration: 150 });
        this.tweens.add({ targets: photoContainer, scale: 1, duration: 140 });
      });
      photoContainer.on('pointerdown', () => {
        if (this.textures.exists(imgKey)) {
          this.openDiffImageFullscreen(imgKey, photo.label ?? 'Memory', imgW2, imgH2);
        }
      });

      // Staggered idle bob — each photo floats at its own rhythm
      const bobDuration = 2800 + pidx * 340;
      const bobAmt = 4 + (pidx % 3);
      this.tweens.add({
        targets: photoContainer,
        y: py - bobAmt,
        duration: bobDuration,
        yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut',
        delay: pidx * 280,
      });
      // Subtle rotation breath
      this.tweens.add({
        targets: photoContainer,
        angle: (photo.rotation * 180 / Math.PI) + (pidx % 2 === 0 ? 1.2 : -1.2),
        duration: bobDuration + 600,
        yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });

    const heroX = this.scrapIsMobile ? VIEW_W / 2 : 900;
    const heroY = this.scrapIsMobile ? 240 : 304;

    // Get texture source image size to adapt layout dynamically!
    const developedKey = scrapbook.heroPhoto;
    let imgWidth = 340;
    let imgHeight = 240;
    const texObj = this.textures.get(developedKey);
    if (texObj && texObj.getSourceImage()) {
      const src = texObj.getSourceImage() as HTMLImageElement;
      if (src.width && src.height) {
        imgWidth = src.width;
        imgHeight = src.height;
      }
    }
    const imageRatio = imgWidth / imgHeight;

    let heroW = 340;
    let heroH = 240;

    if (imageRatio < 0.95) {
      // Portrait photo (like the girl in the cap)
      heroH = 300;
      heroW = Math.round(heroH * imageRatio);
    } else {
      // Landscape photo
      heroW = 340;
      heroH = Math.round(heroW / imageRatio);
    }

    // This photo only ever appears at this small size in this mini-game (no
    // magnify view elsewhere for it), so unlike the polaroids above it's
    // safe to just use a sharpened variant everywhere it's drawn below.
    const heroPanelKey = sharpVariantKey(this, developedKey, heroH);

    const noteW = 320;
    const noteH = 200;
    // Place note on the LEFT page so it doesn't overlap the hero photo.
    // After all pieces are placed, it slides up from a neutral position on
    // the opposite page — feels like finding a hidden note in the album.
    const leftPageCx = this.scrapIsMobile ? VIEW_W / 2 : Math.round(VIEW_W / 2 - pageW / 4);
    const noteRevealY = this.scrapIsMobile ? VIEW_H / 2 + 60 : VIEW_H / 2 + 58;
    this.scrapNoteContainer = this.add.container(leftPageCx, noteRevealY + 30).setDepth(22).setAlpha(0);
    const noteBg = addSoftPanel(this, 0, 0, noteW - 20, noteH - 20, 8, 0xfffdf6, 1);
    const noteText = this.add.text(0, -28, scrapbook.hiddenNote, {
      fontFamily: '"Bradley Hand", "Snell Roundhand", cursive',
      fontSize: '18px',
      color: '#4b3c33',
      align: 'center',
      wordWrap: { width: noteW - 60 },
      lineSpacing: 6,
    }).setOrigin(0.5);

    const noteHint = this.add.text(0, 56, 'tap note to place final keepsake', {
      fontFamily: Fonts.ui,
      fontSize: '13px',
      color: '#8f8790',
    }).setOrigin(0.5).setAlpha(0);

    this.scrapNoteContainer.add([noteBg, noteText, noteHint]);

    // ── Drop zone — quiet gold frame; enough guidance without covering the art
    const heroSlot = this.add.rectangle(heroX, heroY, heroW, heroH, 0xc9a86c, 0).setDepth(9);
    heroSlot.setStrokeStyle(1.5, 0xc9a86c, 0);
    // Breathing glow on the slot
    this.tweens.add({
      targets: heroSlot,
      fillAlpha: 0.012,
      strokeAlpha: 0.12,
      duration: 1800,
      yoyo: true, repeat: -1,
      ease: 'Sine.easeInOut',
    });
    // Corner brackets
    const corners = this.add.graphics().setDepth(9);
    corners.lineStyle(2, 0xc9a86c, 0.48);
    const cs = 18;
    [[heroX - heroW / 2, heroY - heroH / 2], [heroX + heroW / 2, heroY - heroH / 2],
     [heroX - heroW / 2, heroY + heroH / 2], [heroX + heroW / 2, heroY + heroH / 2]].forEach(([bcx, bcy]) => {
      const sx = bcx < heroX ? 1 : -1;
      const sy = bcy < heroY ? 1 : -1;
      corners.strokePoints([
        new Phaser.Geom.Point(bcx, bcy + sy * cs),
        new Phaser.Geom.Point(bcx, bcy),
        new Phaser.Geom.Point(bcx + sx * cs, bcy),
      ]);
    });
    const slotLabel = this.add.text(heroX, heroY, 'drag photo pieces here', {
      fontFamily: Fonts.ui,
      fontSize: '14px',
      color: '#84633f',
      align: 'center',
    }).setOrigin(0.5).setDepth(9).setAlpha(0.26);

    this.scrapHeroContainer = this.add.container(heroX, heroY).setDepth(11);
    const heroShadow = this.add.rectangle(4, 4, heroW, heroH, 0x000000, 0.15).setDepth(10);
    const heroBorder = this.add.rectangle(0, 0, heroW, heroH, 0xffffff, 0).setDepth(20);
    heroBorder.setStrokeStyle(1.5, 0xd4b58e, 0.3);
    this.scrapHeroContainer.add([heroShadow, heroBorder]);

    const developedImg = this.add.image(0, 0, heroPanelKey).setDisplaySize(heroW, heroH).setAlpha(0).setDepth(12);
    this.scrapHeroContainer.add(developedImg);
    this.scrapDevelopedImg = developedImg;

    const scatterSpots = [
      { x: this.scrapIsMobile ? 170 : 488, y: this.scrapIsMobile ? 250 : 276 },
      { x: this.scrapIsMobile ? 440 : 660, y: this.scrapIsMobile ? 238 : 276 },
      { x: this.scrapIsMobile ? 176 : 488, y: this.scrapIsMobile ? 430 : 480 },
      { x: this.scrapIsMobile ? 446 : 660, y: this.scrapIsMobile ? 424 : 480 }
    ];

    const scaleX = (heroW / 2) / 170;
    const scaleY = (heroH / 2) / 120;

    scrapbook.pieces.forEach((piece: any, idx: number) => {
      const spot = scatterSpots[idx % scatterSpots.length];
      const startAngle = Phaser.Math.Between(-12, 12);
      const idlePieceScale = this.scrapIsMobile ? 0.78 : 0.76;
      
      const pieceContainer = this.add.container(spot.x, spot.y).setDepth(20).setAngle(startAngle).setScale(idlePieceScale);
      
      // Ragged backing card (white)
      const backing = this.add.graphics();
      backing.fillStyle(0xfffdfa, 0);
      backing.lineStyle(1.2, 0xd4b58e, 0.12);
      
      const pointsList: Phaser.Geom.Point[] = [];
      for (let k = 0; k < piece.points.length; k += 2) {
        pointsList.push(new Phaser.Geom.Point(piece.points[k] * scaleX, piece.points[k+1] * scaleY));
      }
      backing.fillPoints(pointsList, true);
      backing.strokePoints(pointsList, true);
      backing.setScale(1.01);

      // Full-size image inside pieceContainer, shifted by offsets so only the correct quadrant aligns at center
      const img = this.add.image(0, 0, heroPanelKey);
      img.setDisplaySize(heroW, heroH);
      
      const offsetW = piece.x === 0.25 ? heroW / 4 : -heroW / 4;
      const offsetH = piece.y === 0.25 ? heroH / 4 : -heroH / 4;
      img.setPosition(offsetW, offsetH);

      // Create stenciled mask using the exact polygon points
      const maskGraphics = this.add.graphics().setVisible(false).setDepth(21);
      maskGraphics.fillStyle(0xffffff, 1);
      maskGraphics.fillPoints(pointsList, true);
      
      // Sync mask graphics position & rotation with container starting pose
      maskGraphics.setPosition(spot.x, spot.y);
      maskGraphics.setAngle(startAngle);
      maskGraphics.setScale(idlePieceScale);
      
      this.scrapMasks.push(maskGraphics);

      const mask = maskGraphics.createGeometryMask();
      img.setMask(mask);

      const softShadow = this.add.ellipse(0, 10, heroW * 0.32, heroH * 0.16, 0x000000, 0.14);
      pieceContainer.add([softShadow, backing, img]);
      pieceContainer.sendToBack(softShadow);

      pieceContainer.setSize(heroW / 2, heroH / 2);
      pieceContainer.setInteractive({ useHandCursor: true, draggable: true });
      this.input.setDraggable(pieceContainer);

      const targetLX = piece.x * heroW - heroW / 2;
      const targetLY = piece.y * heroH - heroH / 2;
      const targetWorldX = heroX + targetLX;
      const targetWorldY = heroY + targetLY;

      // Some pointer/touch stacks can deliver a spurious extra dragend for a
      // single physical drag gesture. Without a lock, that second dragend
      // starts a competing tween on the same container properties (x/y/angle)
      // as the first one's settle tween — whichever finishes last "wins",
      // and if the piece already got reparented into scrapHeroContainer by
      // then, the loser tween keeps driving its now-local x/y toward a
      // stale world-space target, flinging the piece to a nonsensical spot.
      // `locked` makes placement idempotent: only the first genuine dragend
      // after a real drag is allowed to settle this piece.
      let locked = false;

      pieceContainer.on('dragstart', () => {
        if (this.completed || locked) return;
        this.tweens.killTweensOf(pieceContainer);
        this.children.bringToTop(pieceContainer);
        AudioManager.playSfx(this, 'sfx-page-turn');
        // Premium drag lift: scale up, tilt slightly, show gold glow ring
        this.tweens.add({ targets: pieceContainer, angle: 0, scale: 1.04, duration: 180, ease: 'Back.easeOut' });
        this.tweens.add({ targets: maskGraphics, angle: 0, scale: 1.04, duration: 180, ease: 'Back.easeOut' });
        const glow = this.add.ellipse(pieceContainer.x, pieceContainer.y, heroW * 0.52, heroH * 0.32, 0xc9a86c, 0)
          .setDepth(19).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: glow, alpha: 0.18, duration: 180 });
        // Kill glow on drop
        pieceContainer.once('dragend', () => this.tweens.add({ targets: glow, alpha: 0, duration: 180, onComplete: () => glow.destroy() }));
      });

      pieceContainer.on('drag', (_p: any, dragX: number, dragY: number) => {
        if (this.completed || locked) return;
        pieceContainer.setPosition(dragX, dragY);
        maskGraphics.setPosition(dragX, dragY);
        maskGraphics.setAngle(pieceContainer.angle);
        maskGraphics.setScale(pieceContainer.scaleX, pieceContainer.scaleY);
      });

      pieceContainer.on('dragend', () => {
        if (this.completed || locked) return;
        const dist = Phaser.Math.Distance.Between(pieceContainer.x, pieceContainer.y, targetWorldX, targetWorldY);
        this.tweens.killTweensOf(pieceContainer);

        if (dist < 36) {
          locked = true;
          pieceContainer.disableInteractive();
          this.scrapPiecesPlaced++;
          this.addProgress(`${this.scrapPiecesPlaced}/${scrapbook.pieces.length} fragments placed`);

          AudioManager.playSfx(this, 'sfx-page-turn');
          this.emitTinySparkle(targetWorldX, targetWorldY, 0.88);

          this.tweens.add({
            targets: pieceContainer,
            x: targetWorldX,
            y: targetWorldY,
            angle: 0,
            scale: 1,
            duration: 220,
            ease: 'Back.easeOut',
            onUpdate: () => {
              maskGraphics.setPosition(pieceContainer.x, pieceContainer.y);
              maskGraphics.setAngle(pieceContainer.angle);
              maskGraphics.setScale(pieceContainer.scaleX, pieceContainer.scaleY);
            },
            onComplete: () => {
              this.scrapHeroContainer!.add(pieceContainer);
              pieceContainer.setPosition(targetLX, targetLY);

              maskGraphics.setPosition(targetWorldX, targetWorldY);
              maskGraphics.setAngle(0);
              maskGraphics.setScale(1);

              if (this.scrapPiecesPlaced >= scrapbook.pieces.length) {
                slotLabel.destroy();
                heroSlot.destroy();
                corners.destroy();
                this.checkScrapbookCompletion();
              }
            }
          });
        } else {
          this.tweens.add({
            targets: pieceContainer,
            x: spot.x,
            y: spot.y,
            angle: startAngle,
            scale: idlePieceScale,
            duration: 380,
            ease: 'Back.easeOut',
            onUpdate: () => {
              maskGraphics.setPosition(pieceContainer.x, pieceContainer.y);
              maskGraphics.setAngle(pieceContainer.angle);
              maskGraphics.setScale(pieceContainer.scaleX, pieceContainer.scaleY);
            }
          });
        }
      });
    });

    this.addProgress(`0/${scrapbook.pieces.length} fragments placed`);
  }

  private checkScrapbookCompletion(): void {
    this.completed = true;
    const scrapbook = this.configData.miniGameConfig.scrapbook;
    if (!scrapbook) return;

    const developedImg = this.scrapDevelopedImg;

    if (developedImg) {
      this.tweens.add({
        targets: developedImg,
        alpha: 1,
        duration: 2400,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          const pieces = this.scrapHeroContainer!.list.filter(
            (child) => child instanceof Phaser.GameObjects.Container
          );
          pieces.forEach((p) => p.destroy());

          // Dispose stencils cleanly
          this.scrapMasks.forEach((m) => m.destroy());
          this.scrapMasks = [];

          this.time.delayedCall(1200, () => this.revealHiddenNote());
        }
      });

      const flash = this.add.circle(this.scrapHeroContainer!.x - 170, this.scrapHeroContainer!.y, 40, 0xfff3d8, 0.28).setDepth(20);
      this.tweens.add({
        targets: flash,
        x: this.scrapHeroContainer!.x + 170,
        alpha: 0,
        duration: 1800,
        ease: 'Cubic.easeInOut',
        onComplete: () => flash.destroy()
      });
    }
  }

  private revealHiddenNote(): void {
    const scrapbook = this.configData.miniGameConfig.scrapbook;
    if (!scrapbook) return;

    AudioManager.playSfx(this, 'sfx-portal');

    // The supporting polaroids on the left page are still interactive
    // (zoomable) at this point and were added to the display list before
    // this note, so without an explicit reorder their hit areas win ties
    // in Phaser's input hit-test and swallow taps meant for the note.
    this.children.bringToTop(this.scrapNoteContainer!);

    // Note slides up from its resting position on the LEFT page —
    // no need to shrink/tilt the hero photo since they no longer overlap.
    this.tweens.add({
      targets: this.scrapNoteContainer,
      y: this.scrapNoteContainer!.y - 30,
      alpha: 1,
      duration: 900,
      ease: 'Sine.easeOut',
      onComplete: () => {
        const hint = this.scrapNoteContainer!.list.find(
          (child) => child instanceof Phaser.GameObjects.Text && child.text.includes('keepsake')
        ) as Phaser.GameObjects.Text;
        
        if (hint) {
          this.tweens.add({
            targets: hint,
            alpha: 1,
            duration: 380,
            onComplete: () => {
              this.tweens.add({ targets: hint, alpha: 0.38, duration: 680, yoyo: true, repeat: -1 });
            }
          });
        }

        const noteBg = this.scrapNoteContainer!.list[0] as Phaser.GameObjects.Container;
        const notePanel = noteBg.list[1] as Phaser.GameObjects.Rectangle;
        
        const advanceKeepsake = () => {
          this.input.off('pointerdown', advanceKeepsake);
          if (notePanel) notePanel.off('pointerdown', advanceKeepsake);
          if (hint && hint.active) hint.destroy();
          this.dropFinalKeepsake();
        };

        if (notePanel) {
          notePanel.setInteractive({ useHandCursor: true });
          notePanel.once('pointerdown', advanceKeepsake);
        }

        // Also register pointerdown on the entire scene for responsive progression
        this.time.delayedCall(400, () => {
          this.input.once('pointerdown', advanceKeepsake);
        });
      }
    });
  }

  private dropFinalKeepsake(): void {
    const scrapbook = this.configData.miniGameConfig.scrapbook;
    if (!scrapbook) return;

    AudioManager.playSfx(this, 'sfx-page-turn');

    const kConfig = scrapbook.keepsake;
    const kX = kConfig.x * VIEW_W;
    const kY = kConfig.y * VIEW_H;

    const keepsake = this.add.image(kX, -60, kConfig.key).setDepth(25).setScale(0.85);
    
    this.tweens.add({
      targets: keepsake,
      y: kY,
      scale: 1,
      angle: Phaser.Math.Between(-8, 8),
      duration: 1200,
      ease: 'Bounce.easeOut',
      onComplete: () => {
        this.emitJournalSparkle(kX, kY);
        AudioManager.playSfx(this, 'sfx-portal');
        
        this.time.delayedCall(1600, () => {
          this.completed = false; 
          this.complete();
        });
      }
    });
  }




  private renderOfficeEscape(): void {
    const config = this.configData.miniGameConfig;
    const escape = config.officeEscape;

    if (!escape) {
      this.complete();
      return;
    }

    this.escapeDiscovered.clear();
    this.escapeActiveHotspotKey = undefined;
    this.escapeLockDrawn = false;
    this.notebookRowElements = [];
    this.escapeLockCodeEntered = '';
    this.escapeInstrContainer?.destroy();
    this.escapeInstrContainer = undefined;
    if (this.escapeCameraTween) {
      this.escapeCameraTween.stop();
      this.escapeCameraTween = undefined;
    }

    // ── Stage curtain — darkens background so clues and notebook stand out ─
    const curtain = this.add.rectangle(VIEW_W / 2, VIEW_H / 2, VIEW_W, VIEW_H, 0x06040c, 0)
      .setDepth(1).setScrollFactor(0);
    this.tweens.add({ targets: curtain, alpha: 0.44, duration: 600, ease: 'Sine.easeOut' });
    this.addBokehLights();

    const lightBeam = this.add.graphics().setDepth(2);
    lightBeam.fillStyle(0xfff5df, 0.05);
    lightBeam.slice(300, 0, 900, Phaser.Math.DegToRad(30), Phaser.Math.DegToRad(70));
    lightBeam.fillPath();

    this.escapeCameraTween = this.tweens.add({
      targets: this.cameras.main,
      scrollX: 4,
      scrollY: 3,
      duration: 5200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });


    this.addDustParticles();

    escape.hotspots.forEach((h: any) => {
      const zone = this.add.rectangle(h.x, h.y, h.width, h.height, 0xffffff, 0)
        .setDepth(10)
        .setInteractive({ useHandCursor: true });

      const hoverBorder = this.add.rectangle(h.x, h.y, h.width + 4, h.height + 4, 0xffd9a0, 0)
        .setStrokeStyle(1.5, 0xffd9a0, 0)
        .setDepth(11);

    zone.on('pointerover', () => {
        if (this.escapeActiveHotspotKey || this.escapeDiscovered.size >= escape.hotspots.length) return;
        // Amber pulse ring to suggest interactivity
        this.tweens.add({ targets: hoverBorder, strokeAlpha: 0.72, scaleX: 1.04, scaleY: 1.04, duration: 180 });
      });

      zone.on('pointerout', () => {
        this.tweens.add({ targets: hoverBorder, strokeAlpha: 0, scaleX: 1, scaleY: 1, duration: 200 });
      });

      zone.on('pointerdown', () => {
        if (this.escapeActiveHotspotKey || this.completed || this.escapeDiscovered.size >= escape.hotspots.length) return;
        hoverBorder.setStrokeStyle(1.5, 0xffd9a0, 0);
        this.inspectHotspot(h);
      });
    });

    // ── Premium Detective Notebook — glassmorphic brass-bound panel ────────────
    // Positioned at 160,500 so it's fully on screen with breathing room.
    this.escapeNotebookContainer = this.add.container(160, 500).setDepth(15);
    const nbPaper = addSoftPanel(this, 0, 25, 300, 360, 12, 0x12100a, 0.92, true);
    // addSoftPanel is screen-fixed by default because most panels are HUD.
    // Here it is nested inside a world-space notebook that animates beside the
    // keypad, so it must share the parent's camera transform or it visibly
    // separates from the border during the final camera pan.
    nbPaper.setScrollFactor(1);
    // Sophisticated brass double border + ornamental corner dots
    const nbBorder = this.add.graphics();
    nbBorder.lineStyle(1.5, 0xc9a86c, 0.58);
    nbBorder.strokeRect(-140, -145, 280, 340);
    nbBorder.lineStyle(1, 0xffd9a0, 0.22);
    nbBorder.strokeRect(-134, -139, 268, 328);
    // Golden brass corner accents
    nbBorder.fillStyle(0xc9a86c, 0.85);
    nbBorder.fillRect(-140, -145, 5, 5);
    nbBorder.fillRect(135, -145, 5, 5);
    nbBorder.fillRect(-140, 190, 5, 5);
    nbBorder.fillRect(135, 190, 5, 5);

    // Full header fill strip from top border down to divider — no empty gap
    const headerFill = this.add.rectangle(0, -124, 268, 44, 0xe8d4a0, 0.28);
    const headerBand = this.add.rectangle(0, -102, 268, 1.5, 0xc9a86c, 0.7);

    const notebookTitle = this.add.text(0, -124, '🔍  Detective Notebook', {
      fontFamily: '"Bradley Hand", "Snell Roundhand", cursive',
      fontSize: '18px',
      color: '#ffd9a0',
      align: 'center',
    }).setOrigin(0.5);

    const horizontalDivider = this.add.rectangle(0, -102, 264, 1, 0xc9a86c, 0.45);

    this.escapeNotebookContainer.add([nbPaper, nbBorder, headerFill, headerBand, notebookTitle, horizontalDivider]);

    this.updateNotebookUI();

    // ── Glassmorphic instruction banner (positioned top-center at y=96 to eliminate overlap) ──
    this.escapeInstrContainer = this.add.container(VIEW_W / 2, 96).setDepth(16).setAlpha(0);
    const instrPanel = addSoftPanel(this, 0, 0, 480, 34, 20, 0x090911, 0.62, true);
    const instrTxt = this.add.text(0, 0, config.instruction ?? 'Inspect the office environment for clues', {
      fontFamily: Fonts.ui, fontSize: '15px',
      color: '#ffd9a0',
    }).setOrigin(0.5);
    this.escapeInstrContainer.add([instrPanel, instrTxt]);
    this.tweens.add({ targets: this.escapeInstrContainer, alpha: 1, duration: 440, delay: 300, ease: 'Sine.easeOut' });

    this.addProgress(`0/${escape.hotspots.length} clues discovered`);
  }

  private updateNotebookUI(): void {
    if (!this.escapeNotebookContainer) return;
    const escape = this.configData.miniGameConfig.officeEscape;
    if (!escape) return;

    // Clearing the *previous* pass's per-row bullets/checkmarks/text used to
    // mean "destroy any Graphics or Arc sitting in this container" — but
    // nbBorder (the notebook's own ornate brass frame) is also a Graphics
    // object living in this same container, so that filter destroyed it
    // the very first time this ran, leaving the notebook with no visible
    // border at all. Tracking exactly which objects are the dynamic rows
    // (and only ever destroying those) keeps the static frame untouched.
    this.notebookRowElements.forEach((obj) => obj.destroy());
    this.notebookRowElements = [];

    // Rows used to sit at a fixed 62px stride. Real script-style fonts
    // ("Bradley Hand" etc.) aren't installed on every OS, and whatever
    // cursive font a browser substitutes can measure noticeably wider per
    // character than this was tuned against — text that wrapped to 2 lines
    // here could wrap to 3+ elsewhere, overflowing past the fixed next-row
    // position. The cursor now advances by each row's *actual* rendered
    // height instead, so extra wrapped lines push later rows down rather
    // than overlapping them, regardless of which font actually renders.
    let cursorY = -54;
    escape.hotspots.forEach((h: any) => {
      const rowY = cursorY;
      const isFound = this.escapeDiscovered.has(h.key);

      // Bullet circle
      const checkCircle = this.add.circle(-124, rowY, 7, isFound ? 0x5a8a63 : 0x2a2020, 1)
        .setStrokeStyle(1.5, isFound ? 0x8acb94 : 0x5a4a40, 0.85).setDepth(17);
      this.escapeNotebookContainer!.add(checkCircle);
      this.notebookRowElements.push(checkCircle);

      let rowHeight: number;

      if (isFound) {
        const check = this.drawCheckmark(checkCircle.x, checkCircle.y, 0xb8f0c0).setDepth(18);
        this.escapeNotebookContainer!.add(check);
        this.notebookRowElements.push(check);

        // Wrapping well short of the panel's true ~248px of room (rather
        // than right up against it) and forcing character-level breaks for
        // any one long word keeps this inside the border even on a wider
        // fallback font.
        const clueTextObj = this.add.text(-108, rowY - 8, h.clueText, {
          fontFamily: '"Bradley Hand", "Snell Roundhand", cursive',
          fontSize: '14px',
          color: '#e8d8b8',
          wordWrap: { width: 175, useAdvancedWrap: true },
          lineSpacing: 2,
        }).setOrigin(0, 0).setDepth(17);
        this.escapeNotebookContainer!.add(clueTextObj);
        this.notebookRowElements.push(clueTextObj);
        rowHeight = clueTextObj.height;
      } else {
        const placeholder = this.add.text(-108, rowY - 6, '— undiscovered clue —', {
          fontFamily: '"Bradley Hand", "Snell Roundhand", cursive',
          fontSize: '13px',
          color: '#5a4a3a',
          fontStyle: 'italic',
        }).setOrigin(0, 0).setDepth(17).setAlpha(0.7);
        this.escapeNotebookContainer!.add(placeholder);
        this.notebookRowElements.push(placeholder);
        rowHeight = placeholder.height;
      }

      cursorY += Math.max(56, rowHeight + 24);
    });


    this.addProgress(`${this.escapeDiscovered.size}/${escape.hotspots.length} clues discovered`);
  }

  private inspectHotspot(h: any): void {
    this.escapeActiveHotspotKey = h.key;
    if (this.escapeCameraTween) {
      this.escapeCameraTween.pause();
    }
    AudioManager.playSfx(this, 'sfx-page-turn');

    // Hide notebook and the top instruction banner while zoomed in on the clue —
    // the banner text sits fixed at screen-top and reads as clutter over the
    // zoomed-in clue art.
    if (this.escapeNotebookContainer) {
      this.tweens.add({ targets: this.escapeNotebookContainer, alpha: 0, duration: 280, ease: 'Sine.easeIn' });
    }
    if (this.escapeInstrContainer) {
      this.tweens.add({ targets: this.escapeInstrContainer, alpha: 0, duration: 280, ease: 'Sine.easeIn' });
    }

    this.cameras.main.pan(h.x, h.y, 450, 'Cubic.easeInOut');
    this.cameras.main.zoomTo(1.68, 450, 'Cubic.easeInOut');

    // ── Clue card: consistent 290×320 card, all elements self-contained ────
    // Card spans y=-160 to y=160. Header band fills the top. Sketch is a
    // fixed-size box. Caption is 2 lines max. closePrompt sits at y=142.
    const CARD_W = 290;
    const CARD_H = 320;
    const HALF_H = CARD_H / 2;   // 160

    const clueOverlay = this.add.container(h.x, h.y).setDepth(40).setScale(0);

    const backingShadow = this.add.rectangle(5, 5, CARD_W, CARD_H, 0x000000, 0.28);
    const backingOuter  = this.add.rectangle(0, 0, CARD_W, CARD_H, 0x1a1410, 0.96);
    backingOuter.setStrokeStyle(2.5, 0xc9a86c, 0.78);
    const backingInner  = this.add.rectangle(0, 0, CARD_W - 8, CARD_H - 8, 0xfffaee, 0.97);
    backingInner.setStrokeStyle(1, 0xe8d8b0, 0.55);

    // Full-bleed header band (covers y=-160 to y=-108) — no gap at top
    const headerBand = this.add.rectangle(0, -HALF_H + 26, CARD_W - 8, 52, 0xe8d4a0, 0.42);
    // Thin brass rule separating header from content
    const headerRule = this.add.rectangle(0, -HALF_H + 52, CARD_W - 20, 1, 0xc9a86c, 0.55);

    const sketch = this.add.graphics();
    let sketchLabel: Phaser.GameObjects.Text | null = null;

    // All sketches draw into a 160×140 box centred at y=-28 (cards y=-108 to y=32)
    const SK_TOP = -100;   // top of sketch box
    const SK_H   = 140;    // height of sketch box
    const SK_BTM = SK_TOP + SK_H;  // = 40

    if (h.key === 'calendar') {
      // Cream background + grid
      sketch.fillStyle(0xf8f6f0, 1);
      sketch.lineStyle(1, 0xd0c8b8, 0.7);
      sketch.fillRect(-80, SK_TOP, 160, SK_H);
      sketch.strokeRect(-80, SK_TOP, 160, SK_H);
      // Grid: 4 cols × 3 rows
      for (let gi = 1; gi < 4; gi++) {
        sketch.lineStyle(0.5, 0xd0c8b8, 0.45);
        sketch.lineBetween(-80 + gi * 40, SK_TOP, -80 + gi * 40, SK_BTM);
      }
      for (let gi = 1; gi < 3; gi++) {
        sketch.lineStyle(0.5, 0xd0c8b8, 0.45);
        sketch.lineBetween(-80, SK_TOP + gi * 46, 80, SK_TOP + gi * 46);
      }
      // Month label strip
      sketch.fillStyle(0xc9a86c, 0.22);
      sketch.fillRect(-80, SK_TOP, 160, 24);
      // Red circle on date
      sketch.lineStyle(2.5, 0xd95a53, 0.95);
      sketch.strokeCircle(-40, SK_TOP + 62, 18);
      sketchLabel = this.add.text(-40, SK_TOP + 62, '2', {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: '22px', color: '#d95a53', fontStyle: 'bold',
      }).setOrigin(0.5);

    } else if (h.key === 'sticky-note') {
      // Yellow sticky, fills the box
      sketch.fillStyle(0xfff3a0, 1);
      sketch.lineStyle(1.5, 0xd8c050, 0.7);
      sketch.fillRect(-80, SK_TOP, 160, SK_H);
      sketch.strokeRect(-80, SK_TOP, 160, SK_H);
      // Shadow fold corner
      sketch.fillStyle(0xe8d060, 0.5);
      sketch.fillTriangle(80, SK_BTM, 80, SK_BTM - 26, 80 - 26, SK_BTM);
      // Top rule on sticky
      sketch.fillStyle(0xfff9c0, 0.8);
      sketch.fillRect(-80, SK_TOP, 160, 8);
      sketchLabel = this.add.text(0, SK_TOP + SK_H / 2 - 8, '7', {
        fontFamily: '"Bradley Hand", "Snell Roundhand", cursive',
        fontSize: '72px', color: '#3a2c1a', fontStyle: 'bold',
      }).setOrigin(0.5);

    } else {
      // Ceramic mug — cream background
      sketch.fillStyle(0xf8f6f0, 1);
      sketch.fillRect(-80, SK_TOP, 160, SK_H);
      sketch.strokeRect(-80, SK_TOP, 160, SK_H);
      // Mug body (circle centred in box)
      const CY = SK_TOP + SK_H / 2 - 4;
      sketch.fillStyle(0x4a7aa8, 1);
      sketch.lineStyle(2, 0x7ab0d8, 0.7);
      sketch.fillCircle(0, CY, 52);
      sketch.strokeCircle(0, CY, 52);
      // Rim highlight arc
      sketch.lineStyle(2.5, 0xffffff, 0.35);
      sketch.arc(0, CY, 47, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(310), false);
      sketch.strokePath();
      // Stamped medallion
      sketch.fillStyle(0x2a5080, 0.85);
      sketch.fillCircle(0, CY, 20);
      sketchLabel = this.add.text(0, CY, '1', {
        fontFamily: Fonts.title, fontSize: '28px', color: '#d8eeff',
      }).setOrigin(0.5);
    }

    const title = this.add.text(0, -HALF_H + 26, h.sketchTitle, {
      fontFamily: Fonts.ui, fontSize: '13px', color: '#7a5a20',
      fontStyle: 'bold', letterSpacing: 1,
    }).setOrigin(0.5);

    const caption = this.add.text(0, SK_BTM + 20, h.sketchCaption, {
      fontFamily: '"Bradley Hand", "Snell Roundhand", cursive',
      fontSize: '15px', color: '#3a2c1a',
      align: 'center', wordWrap: { width: 240 }, lineSpacing: 2,
    }).setOrigin(0.5, 0);

    // Close prompt sits inside bottom padding, clamped to card interior
    const closePrompt = this.add.text(0, HALF_H - 22, 'tap anywhere to put down', {
      fontFamily: Fonts.ui, fontSize: '11px', color: '#a08870',
    }).setOrigin(0.5);


    clueOverlay.add([backingShadow, backingOuter, backingInner, headerBand, headerRule, sketch, title, caption, closePrompt]);
    clueOverlay.sendToBack(backingInner);
    clueOverlay.sendToBack(backingOuter);
    clueOverlay.sendToBack(backingShadow);

    // Add and promote sketch label AFTER sorting so it renders above the sketch
    if (sketchLabel) {
      clueOverlay.add(sketchLabel);
      clueOverlay.bringToTop(sketchLabel);
    }
    // Also ensure title, caption, closePrompt are above sketch
    clueOverlay.bringToTop(title);
    clueOverlay.bringToTop(caption);
    clueOverlay.bringToTop(closePrompt);

    this.tweens.add({
      targets: clueOverlay,
      scale: 1 / 1.68,
      duration: 320,
      ease: 'Back.easeOut'
    });

    this.time.delayedCall(450, () => {
      this.input.once('pointerdown', () => {
        this.tweens.add({
          targets: clueOverlay,
          scale: 0,
          duration: 220,
          onComplete: () => {
            clueOverlay.destroy();
            this.cameras.main.pan(VIEW_W / 2, VIEW_H / 2, 450, 'Cubic.easeInOut');
            this.cameras.main.zoomTo(1.0, 450, 'Cubic.easeInOut');

            this.time.delayedCall(460, () => {
              this.escapeDiscovered.add(h.key);
              this.updateNotebookUI();
              this.escapeActiveHotspotKey = undefined;

              const totalHotspots = this.configData.miniGameConfig.officeEscape?.hotspots.length ?? 3;
              if (this.escapeDiscovered.size >= totalHotspots && !this.escapeLockDrawn) {
                this.revealMemoryLock();
              } else {
                // Restore notebook and instruction banner visibility now that we're back to normal view
                if (this.escapeNotebookContainer) {
                  this.tweens.add({ targets: this.escapeNotebookContainer, alpha: 1, duration: 380, ease: 'Sine.easeOut' });
                }
                if (this.escapeInstrContainer) {
                  this.tweens.add({ targets: this.escapeInstrContainer, alpha: 1, duration: 380, ease: 'Sine.easeOut' });
                }
                if (this.escapeCameraTween) {
                  this.escapeCameraTween.resume();
                }
              }
            });
          }
        });
      });
    });
  }

  private revealMemoryLock(): void {
    this.escapeLockDrawn = true;
    this.completed = true;
    if (this.escapeCameraTween) {
      this.escapeCameraTween.pause();
    }


    if (this.escapeInstrContainer) {
      this.tweens.add({ targets: this.escapeInstrContainer, alpha: 0, duration: 600 });
    }

    // Hide bottom progress bar — keypad shows "ENTER 3-DIGIT CODE" inline
    const progressTargets = [this.progressPlate, this.progressText, this.progressBarFill, this.progressBarGlow].filter(Boolean);
    if (progressTargets.length) {
      this.tweens.add({ targets: progressTargets, alpha: 0, duration: 500, onComplete: () => {
        this.progressPlate?.destroy(); this.progressPlate = undefined;
        this.progressText?.destroy(); this.progressText = undefined;
        this.progressBarFill?.destroy(); this.progressBarFill = undefined;
        this.progressBarGlow?.destroy(); this.progressBarGlow = undefined;
      }});
    }

    if (this.escapeNotebookContainer) {
      this.escapeNotebookContainer.setDepth(19);
      this.tweens.add({
        targets: this.escapeNotebookContainer,
        // Left panel: comfortably in the left third without zoom compression issues.
        // Using VIEW_W fractions here works because the camera pans to VIEW_W/2,
        // so world-space positions remain relative to the same logical center.
        x: VIEW_W / 2 - 300,
        y: VIEW_H / 2,
        alpha: 1,
        scale: 1.0,
        duration: 1400,
        ease: 'Cubic.easeInOut'
      });
    }

    // Cover the full EXPAND-mode canvas, not just the 1280×720 design area
    const sw = this.scale.width;
    const sh = this.scale.height;
    this.escapeAmbientGlow = this.add.rectangle(sw / 2, sh / 2, sw + 200, sh + 200, 0x050407, 0.44)
      .setDepth(14).setScrollFactor(0);
    this.escapeAmbientGlow.setAlpha(0);
    this.tweens.add({ targets: this.escapeAmbientGlow, alpha: 1, duration: 1200 });

    this.cameras.main.pan(VIEW_W / 2, VIEW_H / 2, 1400, 'Cubic.easeInOut');
    // No zoom: the game uses Scale.EXPAND so the canvas equals the browser
    // viewport width. A 1.36× zoom shrinks the visible world to viewport/1.36
    // pixels, pushing the notebook off the left edge on ~1024px browsers and
    // the keypad header off the top on shorter viewports. Keep zoom at 1.0.

    AudioManager.playSfx(this, 'sfx-portal');

    // Right panel: centred horizontally but shifted right so it doesn't
    // overlap the notebook. No zoom, so scale stays at 1.0.
    this.escapeLockContainer = this.add.container(VIEW_W / 2 + 160, VIEW_H / 2).setDepth(20).setScale(0).setAlpha(0);
    this.buildMemoryLockUI();

    this.tweens.add({
      targets: this.escapeLockContainer,
      scale: 1.0,   // no zoom compensation needed
      alpha: 1,
      delay: 1500,
      duration: 800,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.completed = false;
        // hint is shown inline below the keypad — no bottom progress bar needed
      }
    });
  }

  private buildMemoryLockUI(): void {
    if (!this.escapeLockContainer) return;

    const g = this.add.graphics().setDepth(21);

    // ── Outer panel — matte charcoal with layered borders ─────────────────
    // Drop shadow
    g.fillStyle(0x000000, 0.55);
    g.fillRoundedRect(-135 + 5, -200 + 8, 270, 400, 14);
    // Outer gold border
    g.lineStyle(3, 0xd4a843, 0.92);
    g.strokeRoundedRect(-135, -200, 270, 400, 14);
    // Panel body
    g.fillStyle(0x1a1510, 1);
    g.fillRoundedRect(-135, -200, 270, 400, 14);
    // Inner inset border (gives depth)
    g.lineStyle(1, 0x8a6828, 0.45);
    g.strokeRoundedRect(-128, -193, 256, 386, 10);
    // Top header fill strip
    g.fillStyle(0xd4a843, 0.07);
    g.fillRoundedRect(-128, -193, 256, 50, { tl: 10, tr: 10, bl: 0, br: 0 });
    // Bottom strip
    g.fillStyle(0xd4a843, 0.05);
    g.fillRoundedRect(-128, 143, 256, 50, { tl: 0, tr: 0, bl: 10, br: 10 });
    // Thin brass rule under header
    g.lineStyle(1, 0xd4a843, 0.35);
    g.lineBetween(-120, -144, 120, -144);
    // Thin brass rule above bottom strip
    g.lineStyle(1, 0xd4a843, 0.28);
    g.lineBetween(-120, 142, 120, 142);
    // Corner ornament squares
    g.fillStyle(0xd4a843, 0.9);
    [[-128, -193], [120, -193], [-128, 182], [120, 182]].forEach(([cx, cy]) => {
      g.fillRect(cx, cy, 8, 8);
      g.fillStyle(0xfff0b0, 0.6);
      g.fillRect(cx + 1, cy + 1, 3, 3);
      g.fillStyle(0xd4a843, 0.9);
    });

    this.escapeLockContainer.add(g);

    // Header title
    const lockTitle = this.add.text(0, -170, 'M E M O R Y   L O C K', {
      fontFamily: Fonts.ui, fontSize: '10px',
      color: '#d4a843', letterSpacing: 2, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(24);
    this.escapeLockContainer.add(lockTitle);

    // ── Display — deep-set LCD bezel ──────────────────────────────────────
    const dg = this.add.graphics().setDepth(22);
    // Outer bezel (slightly recessed dark)
    dg.fillStyle(0x0a0806, 1);
    dg.fillRoundedRect(-102, -134, 204, 66, 6);
    dg.lineStyle(2, 0xd4a843, 0.75);
    dg.strokeRoundedRect(-102, -134, 204, 66, 6);
    // Screen background — deep green-black
    dg.fillStyle(0x060f04, 1);
    dg.fillRect(-96, -128, 192, 54);
    // Ambient green glow
    dg.fillStyle(0x0a2808, 0.7);
    dg.fillRect(-96, -128, 192, 54);
    // Three digit-slot outlines
    [-52, 0, 52].forEach(dx => {
      dg.lineStyle(0.5, 0x2a4a20, 0.6);
      dg.strokeRect(dx - 20, -124, 40, 46);
    });
    this.escapeLockContainer.add(dg);

    // Digit readout
    this.escapeLockDigitsText = this.add.text(0, -105, '–  –  –', {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '28px',
      color: '#66cc44',
      letterSpacing: 6,
    }).setOrigin(0.5).setDepth(24);
    this.escapeLockContainer.add(this.escapeLockDigitsText);

    // Pulsing glow on display
    const dispGlowRect = this.add.rectangle(0, -105, 192, 54, 0x22aa44, 0).setDepth(22);
    this.escapeLockContainer.add(dispGlowRect);
    this.tweens.add({ targets: dispGlowRect, alpha: 0.06, yoyo: true, repeat: -1, duration: 1800, ease: 'Sine.easeInOut' });

    // ── Keypad grid ────────────────────────────────────────────────────────
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'E'];
    const startX = -72;
    const startY = -28;
    const gapX = 72;
    const gapY = 58;

    keys.forEach((key, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const kX = startX + col * gapX;
      const kY = startY + row * gapY;

      const isEnter = key === 'E';
      const isClear = key === 'C';

      const bgColor  = isEnter ? 0x0d2e14 : isClear ? 0x2e0d0d : 0x0f0c08;
      const rimColor = isEnter ? 0x44bb66 : isClear ? 0xcc4444 : 0xd4a843;
      const glowCol  = isEnter ? 0x44bb66 : isClear ? 0xcc4444 : 0xd4a843;
      const txtColor = isEnter ? '#55dd77' : isClear ? '#dd5555' : '#f0d080';

      const kg = this.add.graphics().setDepth(23);
      // Shadow
      kg.fillStyle(0x000000, 0.5);
      kg.fillCircle(kX + 2, kY + 2, 26);
      // Key body
      kg.fillStyle(bgColor, 1);
      kg.fillCircle(kX, kY, 26);
      // Rim
      kg.lineStyle(2, rimColor, 0.65);
      kg.strokeCircle(kX, kY, 26);
      // Top-left specular gleam arc
      kg.lineStyle(2, 0xffffff, 0.1);
      kg.arc(kX, kY, 21, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(310), false);
      kg.strokePath();
      this.escapeLockContainer!.add(kg);

      const label = this.add.text(kX, kY, key, {
        fontFamily: Fonts.ui,
        fontSize: '20px',
        color: txtColor,
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(25);
      this.escapeLockContainer!.add(label);

      // Invisible interactive circle
      const hitArea = this.add.circle(kX, kY, 26, 0xffffff, 0).setDepth(26);
      hitArea.setInteractive({ useHandCursor: true });
      this.escapeLockContainer!.add(hitArea);

      hitArea.on('pointerover', () => {
        kg.lineStyle(2.5, glowCol, 1.0);
        kg.strokeCircle(kX, kY, 26);
        label.setAlpha(1);
      });
      hitArea.on('pointerout', () => {
        kg.lineStyle(2, rimColor, 0.65);
        kg.strokeCircle(kX, kY, 26);
        label.setAlpha(0.88);
      });
      hitArea.on('pointerdown', () => {
        if (this.completed) return;
        AudioManager.playSfx(this, 'sfx-page-turn');
        this.tweens.add({
          targets: [kg, label],
          scale: 0.85,
          duration: 65,
          yoyo: true,
          ease: 'Sine.easeIn',
          onComplete: () => this.handleKeypadInput(key),
        });
      });
    });

    // ── Code hint below panel ─────────────────────────────────────────────
    const hintLabel = this.add.text(0, 214, '✦  ENTER 3-DIGIT CODE  ✦', {
      fontFamily: Fonts.ui, fontSize: '11px',
      color: '#d4a843', letterSpacing: 2, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(24);
    this.escapeLockContainer!.add(hintLabel);
  }



  private handleKeypadInput(digit: string): void {
    const display = this.escapeLockDigitsText;
    if (!display) return;

    if (digit === 'C') {
      this.escapeLockCodeEntered = '';
      display.setText('–  –  –');
      display.setColor('#66cc44');
      return;
    }

    if (digit === 'E') {
      const escape = this.configData.miniGameConfig.officeEscape;
      if (!escape) return;

      const rawCode = escape.lockCode;
      const correctCode = (!rawCode || rawCode.includes('{{')) ? '271' : rawCode;

      if (this.escapeLockCodeEntered === correctCode) {
        this.completed = true;
        display.setColor('#8fd9a8');
        
        AudioManager.playSfx(this, 'sfx-memory-restored');
        
        for (let i = 0; i < 20; i++) {
          this.time.delayedCall(i * 30, () => {
            this.emitTinySparkle(
              VIEW_W / 2 + Phaser.Math.Between(-120, 120),
              VIEW_H / 2 + Phaser.Math.Between(-160, 160),
              0.85
            );
          });
        }

        this.tweens.add({
          targets: this.escapeLockContainer,
          scale: 1.06,
          angle: 12,
          duration: 400,
          ease: 'Sine.easeInOut',
          yoyo: true,
          onComplete: () => {
            if (this.escapeNotebookContainer) {
              this.tweens.add({ targets: this.escapeNotebookContainer, alpha: 0, duration: 400 });
            }
            if (this.escapeLockContainer) {
              this.tweens.add({ targets: this.escapeLockContainer, alpha: 0, duration: 400 });
            }
            // This whole reveal happens while revealMemoryLock()'s camera
            // pan/zoom (into the keypad) is still active. addSoftPanel's
            // container is already screen-locked (setScrollFactor(0)), but
            // plain this.add.text() objects are still world-space — under
            // an active zoom/pan they render at a different screen position
            // than the fixed-position panel behind them, so the text drifts
            // off-center relative to it. Locking these to the screen too
            // keeps everything sharing the same fixed coordinate space.
            const restoredPanel = addSoftPanel(this, VIEW_W / 2, VIEW_H / 2, 540, 130, 81, 0x090911, 0.82).setAlpha(0);
            const restoredTitle = this.add.text(VIEW_W / 2, VIEW_H / 2 - 32, 'Memory Unlocked', {
              fontFamily: Fonts.title,
              fontSize: '34px',
              color: '#8fd9a8',
            }).setOrigin(0.5, 0).setDepth(82).setAlpha(0).setScrollFactor(0);

            const restoredBody = this.add.text(VIEW_W / 2, VIEW_H / 2 + 12, escape.completionMessage, {
              fontFamily: Fonts.body,
              fontSize: '20px',
              color: '#ffd9a0',
              align: 'center',
              wordWrap: { width: 500 },
            }).setOrigin(0.5, 0).setDepth(82).setAlpha(0).setScrollFactor(0);

            this.tweens.add({
              targets: [restoredPanel, restoredTitle, restoredBody],
              alpha: 1,
              duration: 500
            });

            this.time.delayedCall(3000, () => {
              this.cameras.main.pan(VIEW_W / 2, VIEW_H / 2, 450, 'Cubic.easeInOut');
              this.cameras.main.zoomTo(1.0, 450, 'Cubic.easeInOut');

              this.time.delayedCall(460, () => {
                // The generic complete() panel renders at this same
                // (VIEW_W/2, VIEW_H/2) position — without destroying this
                // "Memory Unlocked" panel first, the two overlap and garble.
                restoredPanel.destroy();
                restoredTitle.destroy();
                restoredBody.destroy();
                this.completed = false;
                this.complete();
              });
            });
          }
        });

      } else {
        display.setColor('#d95a53');
        AudioManager.playSfx(this, 'sfx-page-turn');

        this.tweens.add({
          targets: this.escapeLockContainer,
          x: VIEW_W / 2 + 8,
          duration: 50,
          yoyo: true,
          repeat: 3,
          onComplete: () => {
            this.escapeLockContainer!.setX(VIEW_W / 2);
            this.escapeLockCodeEntered = '';
            display.setText('–  –  –');
            display.setColor('#66cc44');
          }
        });
      }
      return;
    }

    if (this.escapeLockCodeEntered.length < 3) {
      this.escapeLockCodeEntered += digit;
      const filled = this.escapeLockCodeEntered.split('').join('  ');
      const remaining = '–  '.repeat(3 - this.escapeLockCodeEntered.length).trimEnd();
      display.setText(filled + (remaining ? '  ' + remaining : ''));
      display.setColor('#f0d080');
    }
  }

  private showCaption(text: string): void {
    // Finding two differences in quick succession (easy to do — clicks don't
    // wait on each other) used to leave the previous caption's panel+text
    // still fading out while a new pair spawned on top of it at the exact
    // same spot, stacking into illegible overlapping text. A newer discovery
    // should just replace whatever caption is currently showing.
    this.tweens.killTweensOf([this.diffCaptionPanel, this.diffCaptionText].filter(Boolean));
    this.diffCaptionPanel?.destroy();
    this.diffCaptionText?.destroy();

    const panel = addSoftPanel(this, VIEW_W / 2, 642, 620, 58, 50, 0x090911, 0.7);
    const caption = this.add.text(VIEW_W / 2, 626, text, {
      fontFamily: Fonts.body,
      fontSize: '20px',
      color: '#f5ecd8',
      align: 'center',
      wordWrap: { width: 560 },
    }).setOrigin(0.5, 0).setDepth(51);
    this.diffCaptionPanel = panel;
    this.diffCaptionText = caption;
    this.tweens.add({
      targets: [panel, caption],
      alpha: 0,
      delay: 1200,
      duration: 350,
      onComplete: () => {
        panel.destroy();
        caption.destroy();
        if (this.diffCaptionPanel === panel) this.diffCaptionPanel = undefined;
        if (this.diffCaptionText === caption) this.diffCaptionText = undefined;
      },
    });
  }

  private drawCheckmark(x: number, y: number, color: number): Phaser.GameObjects.Graphics {
    const graphics = this.add.graphics({ x, y });
    graphics.lineStyle(2.5, color, 1);
    graphics.beginPath();
    graphics.moveTo(-7, 0);
    graphics.lineTo(-2, 5);
    graphics.lineTo(7, -7);
    graphics.strokePath();
    return graphics;
  }

  // Data for several mini-games (rearrange-dialogue, photo-album-restore,
  // office-escape-puzzle) still ships with unfilled
  // `{{TOKEN}}` placeholders in miniGames.ts. Every user-facing string in
  // this scene must route through here rather than render raw — a literal
  // `{{MEMORY_3_DIALOGUE_LINE_1}}` on screen is the single fastest way this
  // game reads as an unfinished AI scaffold instead of a finished gift.
  private cleanPuzzleText(text: string, fallback: string | number = 0): string {
    if (!text || text.includes('{{')) {
      if (typeof fallback === 'string') return fallback;
      const fallbacks = [
        'The first thing she kept asking.',
        'The kindness that returned every day.',
        'A small comfort beside medicine.',
        'The quiet rhythm of being cared for.',
        'The tiny object that made concern visible.',
        'The warm answer no one had to say.',
      ];
      return fallbacks[(fallback as number) % fallbacks.length];
    }
    return text;
  }

  private complete(): void {
    if (this.completed) return;
    this.completed = true;
    AudioManager.playSfx(this, 'sfx-portal');
    SaveState.markMiniGameCompleted(this.configData.id);

    const theme = setActiveMemoryTheme(this.configData.id);

    // Bokeh bloom — large soft circles behind the panel in ADD blend
    const bokehCols = [theme.memoryGlow, theme.glow, theme.primary, 0xffffff];
    for (let bi = 0; bi < 6; bi++) {
      const bx = VIEW_W / 2 + Phaser.Math.Between(-300, 300);
      const by = VIEW_H / 2 + Phaser.Math.Between(-180, 180);
      const bokeh = this.add
        .circle(bx, by, Phaser.Math.Between(28, 70), bokehCols[bi % bokehCols.length], 0)
        .setDepth(79)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: bokeh,
        alpha: Phaser.Math.FloatBetween(0.06, 0.16),
        scale: Phaser.Math.FloatBetween(1.0, 1.4),
        yoyo: true,
        repeat: -1,
        duration: Phaser.Math.Between(2400, 5200),
        delay: bi * 200,
        ease: 'Sine.easeInOut',
      });
    }

    const sparkle = this.add.image(VIEW_W / 2, VIEW_H / 2, 'completion-sparkle').setDepth(80).setScale(0.8).setScrollFactor(0);
    this.tweens.add({ targets: sparkle, scale: 3.8, alpha: 0, duration: 1100, ease: 'Sine.easeOut' });

    const panel = addSoftPanel(this, VIEW_W / 2, VIEW_H / 2, 640, 148, 81, 0x090911, 0.86, true);
    panel.setAlpha(0);
    this.tweens.add({ targets: panel, alpha: 1, duration: 480, ease: 'Sine.easeOut' });
    void panel;

    // Completion message fades in with the panel. addSoftPanel's own
    // container is screen-locked (setScrollFactor(0)); some mini-games
    // still have an active camera zoom/pan at this point, and a plain
    // world-space text would drift off-center relative to that fixed
    // panel instead of sitting centered on top of it.
    const msg = this.add.text(VIEW_W / 2, VIEW_H / 2 - 38, this.configData.miniGameConfig.completionMessage, {
      fontFamily: Fonts.body,
      fontSize: '28px',
      color: Phaser.Display.Color.IntegerToColor(theme.primary).rgba,
      align: 'center',
      wordWrap: { width: 560 },
    }).setOrigin(0.5, 0).setDepth(82).setAlpha(0).setScrollFactor(0);
    this.tweens.add({ targets: msg, alpha: 1, duration: 560, delay: 160, ease: 'Sine.easeOut' });

    // Glass shimmer sweep once the panel is visible
    this.time.delayedCall(500, () => addGlassShimmer(this, VIEW_W / 2, VIEW_H / 2, 640, 148, 83));

    // 'tap to continue' hint — breathing alpha + scale
    const hint = this.add
      .text(VIEW_W / 2, VIEW_H / 2 + 48, 'tap or press any key to continue', {
        fontFamily: Fonts.ui,
        fontSize: '16px',
        color: '#b9ad9c',
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(83)
      .setScrollFactor(0);
    this.tweens.add({
      targets: hint,
      alpha: 1,
      duration: 400,
      delay: 700,
      onComplete: () => {
        this.tweens.add({ targets: hint, alpha: 0.38, duration: 720, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: hint, scale: 1.03, duration: 860, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      },
    });

    const advance = () => {
      this.cameras.main.fadeOut(320, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start('Journal', { memoryIndex: this.configData.id, mode: 'update' });
      });
    };

    // Wait at least 800ms so a stray tap from the last drag-drop doesn't
    // immediately advance — then listen for any click/tap or key press.
    this.time.delayedCall(800, () => {
      this.input.once('pointerdown', advance);
      this.input.keyboard?.once('keydown', advance);
    });
  }

  /**
   * Memory 7 — "Fill the Missing Diary". The player finishes the last
   * unwritten diary page by dragging handwritten word-strips into blank
   * ink lines. Every correct drop writes itself into the page immediately,
   * so the paragraph becomes readable as the puzzle is solved rather than
   * being revealed all at once at the end.
   */
  private renderDiaryFillIn(): void {
    const theme = setActiveMemoryTheme(this.configData.id);
    const diary = this.configData.miniGameConfig.memory7Diary;
    if (!diary) {
      this.complete();
      return;
    }

    this.diaryBlanks = [];
    this.diaryInkWords = [];
    this.diaryStripRefs = [];
    this.diaryPlacedCount = 0;
    this.diaryCompleting = false;

    const pageX = VIEW_W / 2;
    const pageY = 296;
    const pageW = this.diaryPageW;
    const pageH = this.diaryPageH;
    const deco = diary.pageDecoration ?? {};

    this.addDustParticles();

    // Leather cover peeking behind the parchment, plus a soft contact shadow
    this.add.rectangle(pageX + 6, pageY + 10, pageW + 28, pageH + 28, 0x2b1b12, 0.88)
      .setStrokeStyle(2, 0x4a3120, 0.6)
      .setDepth(8);
    this.add.rectangle(pageX + 10, pageY + 16, pageW, pageH, 0x000000, 0.3).setDepth(9);

    // The whole page opens as one piece — a scaleX squeeze from a closed
    // spine reads as a page-turn without needing a real 3D flip.
    const page = this.add.container(pageX, pageY).setDepth(10).setScale(0.04, 1);
    this.diaryPageContainer = page;

    const parchment = this.add.image(0, 0, 'parchment-panel').setDisplaySize(pageW, pageH).setTint(0xf6e9c9);
    page.add(parchment);

    // Curled bottom-right corner
    const curl = this.add.graphics();
    curl.fillStyle(0xd8c39a, 0.9);
    curl.fillTriangle(pageW / 2, pageH / 2 - 34, pageW / 2, pageH / 2, pageW / 2 - 34, pageH / 2);
    curl.fillStyle(0x000000, 0.14);
    curl.fillTriangle(pageW / 2 - 3, pageH / 2 - 31, pageW / 2 - 3, pageH / 2 - 3, pageW / 2 - 31, pageH / 2 - 3);
    page.add(curl);

    if (deco.goldCorners !== false) {
      const gold = 0xc9a86c;
      const cSize = 22;
      const inset = 16;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
        const cx = sx * (pageW / 2 - inset);
        const cy = sy * (pageH / 2 - inset);
        const g = this.add.graphics();
        g.lineStyle(2, gold, 0.82);
        g.lineBetween(cx, cy, cx - sx * cSize, cy);
        g.lineBetween(cx, cy, cx, cy - sy * cSize);
        g.fillStyle(gold, 0.9);
        g.fillCircle(cx, cy, 3);
        page.add(g);
      });
    }

    if (deco.vines !== false) {
      const vine = this.add.graphics();
      vine.lineStyle(2, 0x6f8f5a, 0.5);
      const vineY = -pageH / 2 + 18;
      vine.beginPath();
      vine.moveTo(-pageW / 2 + 40, vineY);
      for (let vx = -pageW / 2 + 40; vx <= pageW / 2 - 40; vx += 20) {
        vine.lineTo(vx, vineY + Math.sin(vx * 0.09) * 6);
      }
      vine.strokePath();
      for (let lx = -pageW / 2 + 70; lx <= pageW / 2 - 70; lx += 90) {
        vine.fillStyle(0x7fa565, 0.55);
        vine.fillEllipse(lx, vineY - 6, 12, 6);
      }
      page.add(vine);
    }

    if (deco.flowers !== false && this.textures.exists('keepsake-04')) {
      const flower = this.add.image(pageW / 2 - 56, -pageH / 2 + 50, 'keepsake-04').setScale(0.45).setAlpha(0.9).setAngle(-14);
      page.add(flower);
    }

    if (deco.waxSeal !== false) {
      const ribbonStrip = this.add.rectangle(0, -34, 24, 86, 0x7a1f1f, 0.92).setOrigin(0.5, 0);
      const seal = this.add.circle(0, 38, 15, 0x8a2a2a, 0.96).setStrokeStyle(2, 0xc9a86c, 0.85);
      const sealGlyph = this.add.text(0, 38, '❦', { fontFamily: Fonts.title, fontSize: '15px', color: '#e8d4a8' }).setOrigin(0.5);
      const ribbon = this.add.container(pageW / 2 - 88, -pageH / 2, [ribbonStrip, seal, sealGlyph]).setAngle(-4);
      page.add(ribbon);
      this.diaryRibbon = ribbon;
    }

    const pageTitle = this.add.text(0, -pageH / 2 + 38, diary.title, {
      fontFamily: Fonts.title,
      fontSize: '22px',
      color: '#5a3a22',
      fontStyle: 'italic',
    }).setOrigin(0.5, 0);
    page.add(pageTitle);

    // Paragraph layout — blanks are runs of underscores in the source text,
    // matched in reading order against correctAnswers. Each word/blank is
    // its own Text/Graphics object so a correct drop can reveal just that
    // one word without re-flowing the rest of the page.
    type DiaryToken = { type: 'word'; text: string } | { type: 'blank' } | { type: 'break' };
    const tokenize = (paragraph: string): DiaryToken[] => {
      const tokens: DiaryToken[] = [];
      paragraph.split(/(_{3,}|\n)/).forEach((part) => {
        if (/^_{3,}$/.test(part)) tokens.push({ type: 'blank' });
        else if (part === '\n') tokens.push({ type: 'break' });
        else part.split(/\s+/).filter(Boolean).forEach((w) => tokens.push({ type: 'word', text: w }));
      });
      return tokens;
    };

    const contentPad = 80;
    const contentLeft = -pageW / 2 + contentPad;
    const lineMaxWidth = pageW - contentPad * 2;
    const lineHeight = 32;
    const spaceWidth = 8;
    const wordStyle = {
      fontFamily: '"Bradley Hand", "Snell Roundhand", cursive',
      fontSize: '20px',
      color: '#3a2418',
    };

    let cursorX = contentLeft;
    let cursorY = -pageH / 2 + 104;
    let blankIndex = 0;

    tokenize(diary.paragraph).forEach((token) => {
      if (token.type === 'break') {
        cursorX = contentLeft;
        cursorY += lineHeight + 8;
        return;
      }

      if (token.type === 'word') {
        const wordText = this.add.text(0, 0, token.text, wordStyle).setOrigin(0, 0.5);
        const w = wordText.width;
        if (cursorX + w > contentLeft + lineMaxWidth && cursorX > contentLeft) {
          cursorX = contentLeft;
          cursorY += lineHeight;
        }
        wordText.setPosition(cursorX, cursorY);
        page.add(wordText);
        cursorX += w + spaceWidth;
        return;
      }

      // Measure the real phrase width (not a character-count guess) so the
      // blank line matches exactly what the ink word will occupy once
      // revealed — phrases vary too much in glyph width for a fixed formula.
      const answer = diary.correctAnswers[blankIndex] ?? '';
      const measure = this.add.text(0, 0, answer || '_____', wordStyle);
      const blankWidth = Phaser.Math.Clamp(measure.width + 24, 90, 340);
      measure.destroy();
      if (cursorX + blankWidth > contentLeft + lineMaxWidth && cursorX > contentLeft) {
        cursorX = contentLeft;
        cursorY += lineHeight;
      }
      const startX = cursorX;
      const centerX = startX + blankWidth / 2;

      const glow = this.add.rectangle(centerX, cursorY, blankWidth + 16, 26, theme.accent, 0);
      const line = this.add.graphics();
      line.lineStyle(2, 0x6b4a30, 0.65);
      line.lineBetween(startX, cursorY + 11, startX + blankWidth, cursorY + 11);
      page.add(glow);
      page.add(line);

      this.diaryBlanks.push({
        worldX: pageX + centerX,
        worldY: pageY + cursorY,
        localX: startX,
        localY: cursorY,
        width: blankWidth,
        answer,
        filled: false,
        line,
        glow,
      });

      cursorX += blankWidth + spaceWidth;
      blankIndex += 1;
    });

    this.diaryTotalBlanks = blankIndex;
    this.diaryParagraphBottomY = cursorY;

    // Open the book
    this.tweens.add({ targets: page, scaleX: 1, duration: 620, ease: 'Sine.easeOut' });

    this.buildDiaryWordTray(diary.missingWords);
    this.addProgress(`0 of ${this.diaryTotalBlanks} words remembered`, 0, this.diaryTotalBlanks);
  }

  /** Handwritten paper strips below the diary — drag one onto a blank to fill it. */
  private buildDiaryWordTray(words: string[]): void {
    const trayY = 296 + this.diaryPageH / 2 + 96;
    const stripHeight = 50;
    const stripGap = 18;
    // Measure each phrase at the strip's real font so it always fits on one
    // line, however many words it holds — a fixed char-count guess breaks
    // down once phrases replace single words.
    const stripMeta = words.map((word) => {
      const measure = this.add.text(0, 0, word, { fontFamily: '"Bradley Hand", "Snell Roundhand", cursive', fontSize: '16px' });
      const width = Phaser.Math.Clamp(measure.width + 44, 110, 320);
      measure.destroy();
      return { word, width };
    });
    const totalWidth = stripMeta.reduce((s, m) => s + m.width, 0) + stripGap * (stripMeta.length - 1);
    const visibleMax = Math.min(totalWidth, VIEW_W - 80);
    const needsScroll = totalWidth > visibleMax + 0.5;
    const trayStartX = needsScroll ? 40 : (VIEW_W - totalWidth) / 2;

    const strips: Phaser.GameObjects.Container[] = [];
    let cursor = trayStartX;
    stripMeta.forEach((m) => {
      const homeX = cursor + m.width / 2;
      const strip = this.buildDiaryStrip(m.word, homeX, trayY, m.width, stripHeight);
      strips.push(strip);
      this.diaryStripRefs.push({ container: strip, word: m.word });
      cursor += m.width + stripGap;
    });

    // Once the tray is built, apply the initial "never force a guess" pass —
    // relevant if a diary ships with 2 or fewer blanks total.
    this.updateDiaryAssist();

    // Mobile / overflow case: strips run wider than the screen, so the tray
    // becomes a horizontally-scrollable filmstrip instead of wrapping rows.
    if (needsScroll) {
      const maskShape = this.make.graphics({}, false);
      maskShape.fillStyle(0xffffff);
      maskShape.fillRect(40, trayY - stripHeight / 2 - 12, visibleMax, stripHeight + 24);
      const mask = maskShape.createGeometryMask();
      strips.forEach((s) => s.setMask(mask));

      const catcher = this.add
        .rectangle(40 + visibleMax / 2, trayY, visibleMax, stripHeight + 24, 0x000000, 0.001)
        .setDepth(29)
        .setInteractive({ useHandCursor: true });

      let dragging = false;
      let lastPointerX = 0;
      let scrollX = 0;
      const minScroll = visibleMax - totalWidth;
      catcher.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        dragging = true;
        lastPointerX = pointer.x;
      });
      this.input.on('pointerup', () => { dragging = false; });
      this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
        if (!dragging) return;
        const targetScroll = Phaser.Math.Clamp(scrollX + (pointer.x - lastPointerX), minScroll, 0);
        const applied = targetScroll - scrollX;
        lastPointerX = pointer.x;
        if (applied === 0) return;
        strips.forEach((s) => {
          s.x += applied;
          (s as any).diaryHomeX += applied;
        });
        scrollX = targetScroll;
      });
    }
  }

  private buildDiaryStrip(word: string, x: number, y: number, width: number, height: number): Phaser.GameObjects.Container {
    const theme = getActiveMemoryTheme();
    const rotation = Phaser.Math.Between(-6, 6);
    // Soft "this one belongs" glow — invisible until the assist pass turns
    // it on for the last one or two remaining blanks.
    const assistGlow = this.add.rectangle(0, 0, width + 20, height + 20, theme.accent, 0);
    const shadow = this.add.rectangle(3, 4, width, height, 0x000000, 0.22);
    const paper = this.add.rectangle(0, 0, width, height, 0xf3e6c8, 0.97).setStrokeStyle(1, 0xcbb083, 0.7);
    const label = this.add.text(0, 0, word, {
      fontFamily: '"Bradley Hand", "Snell Roundhand", cursive',
      fontSize: '16px',
      color: '#3a2418',
    }).setOrigin(0.5);

    const strip = this.add.container(x, y, [assistGlow, shadow, paper, label]).setAngle(rotation).setDepth(32);
    strip.setSize(width, height);
    strip.setInteractive({ useHandCursor: true, draggable: true });
    this.input.setDraggable(strip);
    (strip as any).diaryHomeX = x;
    (strip as any).diaryHomeY = y;
    (strip as any).diaryHomeAngle = rotation;
    (strip as any).diaryGlow = assistGlow;

    strip.on('dragstart', () => {
      if (this.completed || this.diaryCompleting) return;
      this.children.bringToTop(strip);
      AudioManager.playSfx(this, 'sfx-paper-rustle');
      this.tweens.add({ targets: strip, angle: 0, scale: 1.08, duration: 160 });
      this.tweens.add({ targets: shadow, x: 8, y: 10, alpha: 0.32, duration: 160 });
    });

    strip.on('drag', (_p: unknown, dragX: number, dragY: number) => {
      if (this.completed || this.diaryCompleting) return;
      strip.setPosition(dragX, dragY);
      this.updateDiaryBlankHover(dragX, dragY);
    });

    strip.on('dragend', () => {
      if (this.completed || this.diaryCompleting) return;
      this.resolveDiaryDrop(strip, word, shadow);
    });

    return strip;
  }

  private updateDiaryBlankHover(x: number, y: number): void {
    this.diaryBlanks.forEach((b) => {
      if (b.filled) return;
      // Phrase blanks are much wider than single-word ones — scale the hover/
      // snap radius with each blank's own width so the whole ink line feels
      // "droppable," not just a small hotspot at its centre.
      const hoverDist = Math.max(60, b.width / 2 + 30);
      const dist = Phaser.Math.Distance.Between(x, y, b.worldX, b.worldY);
      const targetAlpha = dist < hoverDist ? 0.16 : 0;
      if (Math.abs(b.glow.alpha - targetAlpha) > 0.02) {
        this.tweens.add({ targets: b.glow, alpha: targetAlpha, duration: 140 });
      }
    });
  }

  private resolveDiaryDrop(strip: Phaser.GameObjects.Container, word: string, shadow: Phaser.GameObjects.Rectangle): void {
    let best: (typeof this.diaryBlanks)[number] | undefined;
    let bestDist = Infinity;
    this.diaryBlanks.forEach((b) => {
      if (b.filled) return;
      const snapDist = Math.max(60, b.width / 2 + 30);
      const dist = Phaser.Math.Distance.Between(strip.x, strip.y, b.worldX, b.worldY);
      if (dist < snapDist && dist < bestDist) {
        best = b;
        bestDist = dist;
      }
    });

    if (best && best.answer.trim().toLowerCase() === word.trim().toLowerCase()) {
      best.filled = true;
      this.diaryPlacedCount += 1;
      this.placeDiaryWord(best, word, strip, shadow);
      return;
    }

    // Wrong spot, or no blank nearby — a gentle bounce back to the tray, never harsh.
    const homeX = (strip as any).diaryHomeX;
    const homeY = (strip as any).diaryHomeY;
    const homeAngle = (strip as any).diaryHomeAngle;
    this.tweens.add({ targets: strip, x: homeX, y: homeY, angle: homeAngle, scale: 1, duration: 380, ease: 'Back.easeOut' });
    this.tweens.add({ targets: shadow, x: 3, y: 4, alpha: 0.22, duration: 380 });
  }

  private placeDiaryWord(
    blank: (typeof this.diaryBlanks)[number],
    word: string,
    strip: Phaser.GameObjects.Container,
    shadow: Phaser.GameObjects.Rectangle,
  ): void {
    void shadow;
    AudioManager.playSfx(this, 'sfx-fountain-pen');
    AudioManager.playSfx(this, 'sfx-sparkle');

    // Stop any assist fade/highlight loop before the flight tween takes over
    // the same properties, and drop it from the assist tray immediately —
    // otherwise the assist pass below (which re-runs after every placement)
    // would kill this strip's own flight-away tween mid-flight, since it's
    // still `.active` at this point and hasn't been destroyed yet.
    this.tweens.killTweensOf(strip);
    const stripGlow = (strip as any).diaryGlow;
    if (stripGlow) this.tweens.killTweensOf(stripGlow);
    this.diaryStripRefs = this.diaryStripRefs.filter((ref) => ref.container !== strip);

    this.tweens.add({
      targets: strip,
      x: blank.worldX,
      y: blank.worldY,
      angle: 0,
      scale: 0.9,
      alpha: 0,
      duration: 260,
      ease: 'Sine.easeIn',
      onComplete: () => strip.destroy(),
    });

    this.tweens.add({ targets: blank.glow, alpha: 0, duration: 200 });
    blank.line.setVisible(false);

    // Ink bleeding into the page, right before the word writes itself in
    const bleed = this.add.circle(blank.worldX, blank.worldY, 5, 0x3a2418, 0.28).setDepth(11);
    this.tweens.add({ targets: bleed, scale: 3.2, alpha: 0, duration: 520, ease: 'Sine.easeOut', onComplete: () => bleed.destroy() });

    const inkWord = this.add.text(blank.localX, blank.localY, word, {
      fontFamily: '"Bradley Hand", "Snell Roundhand", cursive',
      fontSize: '20px',
      color: '#3a2418',
    }).setOrigin(0, 0.5).setScale(0.6).setAlpha(0);
    this.diaryPageContainer?.add(inkWord);
    this.diaryInkWords.push(inkWord);
    this.tweens.add({ targets: inkWord, scale: 1, alpha: 1, duration: 320, ease: 'Back.easeOut' });

    this.emitTinySparkle(blank.worldX, blank.worldY, 0.7);
    this.time.delayedCall(70, () => this.emitTinySparkle(blank.worldX + 12, blank.worldY - 8, 0.5));

    this.addProgress(`${this.diaryPlacedCount} of ${this.diaryTotalBlanks} words remembered`, this.diaryPlacedCount, this.diaryTotalBlanks);
    this.updateDiaryAssist();

    if (this.diaryPlacedCount >= this.diaryTotalBlanks) {
      this.time.delayedCall(500, () => this.checkDiaryCompletion());
    }
  }

  /**
   * "The player should never be forced to guess." Once two or fewer blanks
   * remain, strips that can no longer be right quietly fade back, and the
   * strips that still fit one of the remaining blanks get a soft breathing
   * glow — so the ending reads as inevitable rather than a memory-test.
   */
  private updateDiaryAssist(): void {
    const remaining = this.diaryBlanks.filter((b) => !b.filled);
    const assistActive = remaining.length > 0 && remaining.length <= 2;
    const remainingAnswers = new Set(remaining.map((b) => b.answer.trim().toLowerCase()));

    this.diaryStripRefs = this.diaryStripRefs.filter((ref) => ref.container.active);

    this.diaryStripRefs.forEach((ref) => {
      const glow = (ref.container as any).diaryGlow as Phaser.GameObjects.Rectangle | undefined;
      this.tweens.killTweensOf(ref.container);
      if (glow) this.tweens.killTweensOf(glow);

      if (!assistActive) {
        this.tweens.add({ targets: ref.container, alpha: 1, duration: 300 });
        if (glow) this.tweens.add({ targets: glow, alpha: 0, duration: 300 });
        return;
      }

      const isRelevant = remainingAnswers.has(ref.word.trim().toLowerCase());
      if (isRelevant) {
        this.tweens.add({ targets: ref.container, alpha: 1, duration: 300 });
        if (glow) {
          this.tweens.add({ targets: glow, alpha: 0.32, duration: 620, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
      } else {
        this.tweens.add({ targets: ref.container, alpha: 0.38, duration: 400, ease: 'Sine.easeOut' });
        if (glow) this.tweens.add({ targets: glow, alpha: 0, duration: 300 });
      }
    });
  }

  /**
   * The page rests, the ink settles, a flower falls, the ribbon stills —
   * then the diary closes on its own and we fade back through the existing
   * Journal-update → Hub-return pipeline (`complete()` uses the same calls;
   * this only replaces what happens on screen beforehand).
   */
  private checkDiaryCompletion(): void {
    if (this.diaryCompleting) return;
    this.diaryCompleting = true;
    this.completed = true;

    SaveState.markMiniGameCompleted(this.configData.id);
    AudioManager.playSfx(this, 'sfx-portal');

    const diary = this.configData.miniGameConfig.memory7Diary;
    const page = this.diaryPageContainer;
    const goToJournal = () => {
      this.cameras.main.fadeOut(700, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start('Journal', { memoryIndex: this.configData.id, mode: 'update' });
      });
    };

    if (!diary || !page) {
      this.time.delayedCall(500, goToJournal);
      return;
    }

    const pageX = page.x;
    const pageY = page.y;

    // 1. Pause, then let the ink on every placed word settle darker.
    this.time.delayedCall(600, () => {
      this.diaryInkWords.forEach((t) => {
        this.tweens.addCounter({
          from: 0,
          to: 100,
          duration: 700,
          ease: 'Sine.easeOut',
          onUpdate: (tw) => {
            const c = Phaser.Display.Color.Interpolate.ColorWithColor(
              Phaser.Display.Color.ValueToColor(0x3a2418),
              Phaser.Display.Color.ValueToColor(0x150a05),
              100,
              tw.getValue() ?? 100,
            );
            t.setColor(Phaser.Display.Color.RGBToString(c.r, c.g, c.b));
          },
        });
      });

      // 2. The pen finishes the page itself — the closing line writes in,
      // positioned just below wherever the paragraph's own last line
      // actually landed (its length varies with which phrases got placed
      // and how the text wrapped), not a fixed offset that can overlap it.
      const closingY = Math.min(this.diaryParagraphBottomY + 44, this.diaryPageH / 2 - 46);
      if (diary.closingLine) {
        const closing = this.add.text(0, closingY, '', {
          fontFamily: '"Bradley Hand", "Snell Roundhand", cursive',
          fontSize: '21px',
          color: '#150a04',
          fontStyle: 'italic',
          stroke: '#3a2418',
          strokeThickness: 0.5,
        }).setOrigin(0.5, 0);
        page.add(closing);
        const full = diary.closingLine;
        let i = 0;
        this.time.addEvent({
          delay: 38,
          repeat: full.length - 1,
          callback: () => {
            i += 1;
            closing.setText(full.slice(0, i));
          },
        });
      }
    });

    // 3. A pressed flower drifts down and settles onto the page; the ribbon stills.
    this.time.delayedCall(1500, () => {
      if (this.textures.exists('keepsake-04')) {
        const flower = this.add.image(pageX - 40, pageY - this.diaryPageH, 'keepsake-04')
          .setDepth(60).setScale(0.3).setAlpha(0).setAngle(-30);
        this.tweens.add({
          targets: flower,
          y: pageY - 30,
          alpha: 1,
          angle: 8,
          scale: 0.55,
          duration: 1300,
          ease: 'Sine.easeIn',
          onComplete: () => {
            this.tweens.add({ targets: flower, y: '+=5', duration: 500, yoyo: true, ease: 'Sine.easeOut' });
            this.emitTinySparkle(flower.x, flower.y, 0.5);
          },
        });
      }

      if (this.diaryRibbon) {
        this.tweens.add({ targets: this.diaryRibbon, angle: 0, duration: 1100, ease: 'Elastic.easeOut' });
      }
    });

    // 4. The completion line, then the page closes and we fade home.
    this.time.delayedCall(3200, () => {
      // Position the message at a reliable central y, not relative to the
      // diary bottom (which pushes it to the vignette-heavy screen edge).
      const msgY = VIEW_H / 2 + 30;
      const msgBg = this.add.graphics().setDepth(69);
      msgBg.fillStyle(0x000000, 0.52);
      msgBg.fillRoundedRect(VIEW_W / 2 - 280, msgY - 14, 560, 54, 8);
      msgBg.setAlpha(0);
      const msg = this.add.text(VIEW_W / 2, msgY, this.configData.miniGameConfig.completionMessage, {
        fontFamily: Fonts.body,
        fontSize: '26px',
        color: '#f5ecd8',   // high-contrast cream — readable on any background
        align: 'center',
        wordWrap: { width: 520 },
      }).setOrigin(0.5, 0).setDepth(70).setAlpha(0);
      this.tweens.add({ targets: [msgBg, msg], alpha: 1, duration: 700, ease: 'Sine.easeOut' });

      this.time.delayedCall(2200, () => {
        this.tweens.add({ targets: page, scaleX: 0.04, alpha: 0, duration: 750, ease: 'Sine.easeIn' });
        this.tweens.add({ targets: [msgBg, msg], alpha: 0, duration: 500 });
        this.time.delayedCall(650, goToJournal);
      });
    });
  }
}
