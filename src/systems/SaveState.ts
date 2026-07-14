const STORAGE_KEY = 'chapters-of-us-save-v1';

export interface SaveData {
  visitedMemories: number[];
  completedMiniGames: number[];
  journalPages: number[];
  reachedLetter: boolean;
  unlockedBts: boolean;
}

const DEFAULT_SAVE: SaveData = {
  visitedMemories: [],
  completedMiniGames: [],
  journalPages: [],
  reachedLetter: false,
  unlockedBts: false,
};

function read(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SAVE, visitedMemories: [] };
    const parsed = JSON.parse(raw) as SaveData;
    const data = {
      ...DEFAULT_SAVE,
      ...parsed,
      visitedMemories: parsed.visitedMemories ?? [],
      completedMiniGames: parsed.completedMiniGames ?? parsed.visitedMemories ?? [],
      journalPages: parsed.journalPages ?? parsed.completedMiniGames ?? parsed.visitedMemories ?? [],
    };
    data.unlockedBts = data.reachedLetter;
    return data;
  } catch {
    return { ...DEFAULT_SAVE, visitedMemories: [] };
  }
}

function write(data: SaveData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage unavailable (private browsing etc.) — fail silently, progress just won't persist.
  }
}

export const SaveState = {
  get(): SaveData {
    return read();
  },

  markVisited(memoryIndex: number): SaveData {
    const data = read();
    if (!data.visitedMemories.includes(memoryIndex)) {
      data.visitedMemories.push(memoryIndex);
      data.visitedMemories.sort((a, b) => a - b);
    }
    write(data);
    return data;
  },

  markMiniGameCompleted(memoryIndex: number): SaveData {
    const data = read();
    if (!data.completedMiniGames.includes(memoryIndex)) {
      data.completedMiniGames.push(memoryIndex);
      data.completedMiniGames.sort((a, b) => a - b);
    }
    if (!data.visitedMemories.includes(memoryIndex)) {
      data.visitedMemories.push(memoryIndex);
      data.visitedMemories.sort((a, b) => a - b);
    }
    if (!data.journalPages.includes(memoryIndex)) {
      data.journalPages.push(memoryIndex);
      data.journalPages.sort((a, b) => a - b);
    }
    write(data);
    return data;
  },

  hasCompletedMiniGame(memoryIndex: number): boolean {
    return read().completedMiniGames.includes(memoryIndex);
  },

  markLetterReached(): SaveData {
    const data = read();
    data.reachedLetter = true;
    data.unlockedBts = true;
    write(data);
    return data;
  },

  isUnlocked(memoryIndex: number): boolean {
    const data = read();
    if (memoryIndex === 1) return true;
    return data.visitedMemories.includes(memoryIndex - 1);
  },

  reset(): void {
    write({ ...DEFAULT_SAVE, visitedMemories: [], completedMiniGames: [], journalPages: [] });
  },
};
