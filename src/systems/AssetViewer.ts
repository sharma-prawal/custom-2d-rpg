import Phaser from 'phaser';
import {
  CHARACTER_IMAGES,
  PROP_IMAGES,
  BACKGROUND_IMAGES,
  UI_IMAGES,
  MUSIC_TRACKS,
  SFX_TRACKS,
} from '../data/assetManifest';
import { fitWithin } from './ImageFit';
import { addSoftPanel, Fonts } from './VisualTheme';
import { AudioManager } from './AudioManager';

interface ViewerCategory {
  name: string;
  kind: 'image' | 'audio';
  keys: string[];
}

const CATEGORIES: ViewerCategory[] = [
  { name: 'Characters', kind: 'image', keys: CHARACTER_IMAGES.map((a) => a.key) },
  { name: 'Props', kind: 'image', keys: PROP_IMAGES.map((a) => a.key) },
  { name: 'Backgrounds', kind: 'image', keys: BACKGROUND_IMAGES.map((a) => a.key) },
  { name: 'UI', kind: 'image', keys: UI_IMAGES.map((a) => a.key) },
  { name: 'Music', kind: 'audio', keys: MUSIC_TRACKS.map((a) => a.key) },
  { name: 'SFX', kind: 'audio', keys: SFX_TRACKS.map((a) => a.key) },
];

/**
 * A simple in-game gallery for every image/audio key in the asset manifest —
 * lets you page through what's currently real art vs. placeholder, and
 * preview audio once it's added, without leaving the game.
 */
export class AssetViewer {
  private scene: Phaser.Scene;
  private viewW: number;
  private viewH: number;
  private container?: Phaser.GameObjects.Container;
  private catIndex = 0;
  private itemIndex = 0;
  private thumb?: Phaser.GameObjects.Image;
  private titleText?: Phaser.GameObjects.Text;
  private keyText?: Phaser.GameObjects.Text;
  private audioNote?: Phaser.GameObjects.Text;
  private opened = false;
  private previewSound?: Phaser.Sound.BaseSound;

  constructor(scene: Phaser.Scene, viewW: number, viewH: number) {
    this.scene = scene;
    this.viewW = viewW;
    this.viewH = viewH;
  }

  get isOpen(): boolean {
    return this.opened;
  }

  open(): void {
    this.opened = true;
    this.catIndex = 0;
    this.itemIndex = 0;
    this.build();
    this.render();
  }

  close(): void {
    this.opened = false;
    this.stopPreview();
    this.thumb?.destroy();
    this.thumb = undefined;
    this.container?.destroy();
    this.container = undefined;
  }

  next(): void {
    const cat = this.currentCategory();
    this.itemIndex = (this.itemIndex + 1) % cat.keys.length;
    this.render();
  }

  prev(): void {
    const cat = this.currentCategory();
    this.itemIndex = (this.itemIndex - 1 + cat.keys.length) % cat.keys.length;
    this.render();
  }

  nextCategory(): void {
    this.catIndex = (this.catIndex + 1) % CATEGORIES.length;
    this.itemIndex = 0;
    this.render();
  }

  prevCategory(): void {
    this.catIndex = (this.catIndex - 1 + CATEGORIES.length) % CATEGORIES.length;
    this.itemIndex = 0;
    this.render();
  }

  togglePreview(): void {
    const cat = this.currentCategory();
    if (cat.kind !== 'audio') return;

    if (this.previewSound?.isPlaying) {
      this.previewSound.pause();
      this.audioNote?.setText('♪\n\npaused');
      return;
    }
    if (this.previewSound?.isPaused) {
      AudioManager.pauseMusic();
      this.previewSound.resume();
      this.audioNote?.setText('♪\n\nplaying');
      return;
    }
    const key = this.currentKey();
    if (!this.scene.cache.audio.exists(key)) return;
    AudioManager.pauseMusic();
    this.previewSound = this.scene.sound.add(key, { volume: 0.6 });
    this.previewSound.play();
    this.audioNote?.setText('♪\n\nplaying');
  }

  private currentCategory(): ViewerCategory {
    return CATEGORIES[this.catIndex];
  }

  private currentKey(): string {
    return this.currentCategory().keys[this.itemIndex];
  }

  private build(): void {
    const panel = addSoftPanel(this.scene, this.viewW / 2, this.viewH / 2, this.viewW - 140, this.viewH - 120, 2000, 0x14141c, 0.94);

    this.titleText = this.scene.add
      .text(this.viewW / 2, 90, '', { fontFamily: Fonts.title, fontSize: '34px', color: '#c9a8ff' })
      .setOrigin(0.5);

    this.keyText = this.scene.add
      .text(this.viewW / 2, this.viewH - 170, '', { fontFamily: Fonts.ui, fontSize: '20px', color: '#f5ecd8' })
      .setOrigin(0.5);

    const hint = this.scene.add
      .text(
        this.viewW / 2,
        this.viewH - 130,
        '←/→ item   ↑/↓ category   enter play/pause   space/click close',
        { fontFamily: Fonts.ui, fontSize: '17px', color: '#8a8a9c' },
      )
      .setOrigin(0.5);

    this.audioNote = this.scene.add
      .text(this.viewW / 2, this.viewH / 2 - 20, '', {
        fontFamily: Fonts.title,
        fontSize: '40px',
        color: '#ffd9a0',
        align: 'center',
      })
      .setOrigin(0.5);

    this.container = this.scene.add.container(0, 0, [panel, this.titleText, this.audioNote, this.keyText, hint]);
    this.container.setDepth(2000);
    this.container.setScrollFactor(0);
  }

  private render(): void {
    this.stopPreview();
    this.thumb?.destroy();
    this.thumb = undefined;

    const cat = this.currentCategory();
    const key = this.currentKey();
    this.titleText?.setText(`${cat.name}  (${this.itemIndex + 1}/${cat.keys.length})`);
    this.keyText?.setText(key);

    if (cat.kind === 'image') {
      this.audioNote?.setText('');
      this.thumb = this.scene.add.image(this.viewW / 2, this.viewH / 2 - 20, key);
      this.thumb.setDepth(2001).setScrollFactor(0);
      fitWithin(this.thumb, this.viewW - 420, 340);
      this.container?.add(this.thumb);
    } else {
      const exists = this.scene.cache.audio.exists(key);
      this.audioNote?.setText(exists ? '♪\n\npreview available' : '♪\n\n(not added yet)');
    }
  }

  private stopPreview(): void {
    this.previewSound?.stop();
    this.previewSound = undefined;
    AudioManager.resumeMusic();
  }
}
