import Phaser from 'phaser';

let currentMusic: Phaser.Sound.BaseSound | undefined;
const STORAGE_KEY = 'chapters-of-us-audio';
const DEFAULT_VOLUME = 0.72;

interface AudioPrefs {
  volume: number;
  muted: boolean;
}

let prefs: AudioPrefs = readPrefs();

function readPrefs(): AudioPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { volume: DEFAULT_VOLUME, muted: false };
    const parsed = JSON.parse(raw) as Partial<AudioPrefs>;
    return {
      volume: Phaser.Math.Clamp(parsed.volume ?? DEFAULT_VOLUME, 0, 1),
      muted: Boolean(parsed.muted),
    };
  } catch {
    return { volume: DEFAULT_VOLUME, muted: false };
  }
}

function writePrefs(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Private browsing or locked storage should not break audio playback.
  }
}

function applySceneAudio(scene: Phaser.Scene): void {
  scene.sound.volume = prefs.volume;
  scene.sound.mute = prefs.muted;
}

function applyCurrentMusic(): void {
  if (currentMusic) currentMusic.manager.volume = prefs.volume;
}

/** Guarded music/SFX playback — no-ops quietly if the real audio file hasn't been dropped in yet. */
export const AudioManager = {
  apply(scene: Phaser.Scene): void {
    applySceneAudio(scene);
    applyCurrentMusic();
  },

  playMusic(scene: Phaser.Scene, key: string, loop = true): void {
    if (!scene.cache.audio.exists(key)) return;
    applySceneAudio(scene);
    if (currentMusic?.key === key && currentMusic.isPlaying) return;
    currentMusic?.stop();
    currentMusic = scene.sound.add(key, { loop, volume: 0.5 });
    currentMusic.play();
  },

  stopMusic(): void {
    currentMusic?.stop();
  },

  pauseMusic(): void {
    if (currentMusic?.isPlaying) currentMusic.pause();
  },

  resumeMusic(): void {
    if (currentMusic?.isPaused && !prefs.muted) currentMusic.resume();
  },

  playSfx(scene: Phaser.Scene, key: string): void {
    if (!scene.cache.audio.exists(key)) return;
    applySceneAudio(scene);
    scene.sound.play(key, { volume: 0.6 });
  },

  getVolume(): number {
    return prefs.volume;
  },

  isMuted(): boolean {
    return prefs.muted;
  },

  setVolume(scene: Phaser.Scene, volume: number): void {
    prefs.volume = Phaser.Math.Clamp(volume, 0, 1);
    if (prefs.volume > 0) prefs.muted = false;
    writePrefs();
    applySceneAudio(scene);
    applyCurrentMusic();
  },

  changeVolume(scene: Phaser.Scene, delta: number): void {
    this.setVolume(scene, prefs.volume + delta);
  },

  toggleMute(scene: Phaser.Scene): void {
    prefs.muted = !prefs.muted;
    writePrefs();
    applySceneAudio(scene);
    applyCurrentMusic();
  },
};
