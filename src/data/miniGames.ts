import { MEMORIES } from './memories';

export type MiniGameType =
  | 'find-the-moments'
  | 'conversation-crossword'
  | 'rearrange-dialogue'
  | 'hidden-differences'
  | 'photo-album-restore'
  | 'office-escape-puzzle'
  | 'diary-fill-in';

interface BaseMiniGameConfig {
  completionMessage: string;
  subtitle?: string;
  instruction?: string;
  originalImage?: string;
  changedImage?: string;
  completionText?: string;
}

export interface HiddenMoment {
  id?: string;
  key: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  title?: string;
  description?: string;
  icon?: string;
  discovered?: boolean;
  caption: string;
}

export interface CrosswordEntry {
  answer: string;
  clue: string;
}

export interface ConversationPuzzleWord {
  id: string;
  answer: string;
  clue: string;
  hint: string;
  fragment?: string;
  row: number;
  col: number;
  direction: 'across' | 'down';
  hotspot: {
    label: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    revealLetterIndex?: number;
  };
}

export interface ConversationPuzzleConfig {
  title: string;
  subtitle: string;
  conversationFragments?: string[];
  completionRevealText: string;
  completionConversation?: string;
  completionAnimation?: 'conversation-reconstruction';
  words: ConversationPuzzleWord[];
}

export interface DialogueCard {
  speaker: string;
  text: string;
}

export interface DifferenceSpot {
  id?: string;
  x: number;
  y: number;
  label: string;
  description?: string;
  radius?: number;
}

export interface AlbumFragment {
  label: string;
  caption: string;
}

export interface ScrapbookPhoto {
  key: string;
  label?: string;
  x: number;
  y: number;
  rotation: number;
  scale?: number;
}

export interface ScrapbookKeepsake {
  key: string;
  label: string;
  x: number;
  y: number;
}

export interface ScrapbookPieceConfig {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  points: number[];
}

export interface ScrapbookConfig {
  heroPhoto: string;
  completionText: string;
  hiddenNote: string;
  keepsake: ScrapbookKeepsake;
  supportingPhotos: ScrapbookPhoto[];
  pieces: ScrapbookPieceConfig[];
}


export interface EscapeHotspot {
  key: string;
  x: number;
  y: number;
  hint: string;
}

export interface EnvironmentalHotspot {
  key: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  clueText: string;
  sketchTitle: string;
  sketchCaption: string;
}

export interface OfficeEscapeConfig {
  lockCode: string;
  completionMessage: string;
  hotspots: EnvironmentalHotspot[];
}

export interface DiaryPageDecoration {
  flowers?: boolean;
  vines?: boolean;
  goldCorners?: boolean;
  waxSeal?: boolean;
  curledEdges?: boolean;
}

export interface Memory7DiaryConfig {
  title: string;
  subtitle: string;
  // Blanks are written inline as runs of 3+ underscores, in reading order —
  // e.g. "the way you ___ at me" — matched positionally against
  // `correctAnswers`. A literal "\n" forces a line break (stanza-style);
  // everything else word-wraps automatically inside the page.
  paragraph: string;
  missingWords: string[];
  correctAnswers: string[];
  pageDecoration?: DiaryPageDecoration;
  completionAnimation?: 'diary-close';
  // The diary's own final handwritten line, revealed as a "the pen finishes
  // itself" flourish right after the last blank is placed — distinct from
  // `completionMessage`, which is the overlay shown once the whole page rests.
  closingLine?: string;
}

export interface MiniGameConfig {
  id: number;
  title: string;
  miniGameType: MiniGameType;
  dialogueCompleteTriggersMiniGame: true;
  journal: {
    title: string;
    entry: string;
    keepsake: string;
    image: string;
    artifactTitle?: string;
    artifactCaption?: string;
    accent?: 'flower' | 'charm' | 'letter' | 'shoe' | 'coffee' | 'ticket' | 'locket';
  };
  miniGameConfig: BaseMiniGameConfig & {
    backgroundKey?: string;
    hiddenObjects?: HiddenMoment[];
    crossword?: CrosswordEntry[];
    memory2ConversationPuzzle?: ConversationPuzzleConfig;
    dialogueCards?: DialogueCard[];
    correctOrder?: number[];
    differences?: DifferenceSpot[];
    albumFragments?: AlbumFragment[];
    scrapbook?: ScrapbookConfig;
    escapeHotspots?: EscapeHotspot[];
    officeEscape?: OfficeEscapeConfig;
    memory7Diary?: Memory7DiaryConfig;
    lockCode?: string;
    finalSentence?: string;
  };
}

const byIndex = Object.fromEntries(MEMORIES.map((memory) => [memory.index, memory]));

export const MINI_GAMES: MiniGameConfig[] = [
  {
    id: 1,
    title: 'Find the Moments',
    miniGameType: 'find-the-moments',
    dialogueCompleteTriggersMiniGame: true,
    journal: {
      title: 'The First Noticing',
      entry: 'A quiet page for the tiny things that made an ordinary afternoon feel different.',
      keepsake: 'keepsake-01',
      image: 'journal-memory-1',
      artifactTitle: 'Pressed Flower',
      artifactCaption: 'The flower I noticed that afternoon.',
      accent: 'flower',
    },
    miniGameConfig: {
      backgroundKey: byIndex[1].backgroundKey,
      // Replace these embedded-object coordinates, labels, and descriptions with final Memory 1 scene details.
      hiddenObjects: [
        {
          key: 'terrace-railing',
          x: 878,
          y: 368,
          width: 74,
          height: 38,
          title: 'Terrace Railing',
          description: 'The terrace where I first noticed you — a cute girl in semi-formals, somehow unforgettable.',
          icon: 'rail',
          caption: 'The terrace where I first noticed you — a cute girl in semi-formals, somehow unforgettable.',
        },
        {
          key: 'autumn-leaf',
          x: 530,
          y: 470,
          width: 44,
          height: 34,
          title: 'Autumn Leaf',
          description: 'A little neckpiece, gifted by your father — small, but never went unnoticed.',
          icon: 'leaf',
          caption: 'A little neckpiece, gifted by your father — small, but never went unnoticed.',
        },
        {
          key: 'coffee-cup',
          x: 1008,
          y: 520,
          width: 48,
          height: 44,
          title: 'Coffee Cup',
          description: 'Your voice was as warm as this cup — soft and sweet, like honey.',
          icon: 'cup',
          caption: 'Your voice was as warm as this cup — soft and sweet, like honey.',
        },
        {
          key: 'city-skyline',
          x: 310,
          y: 250,
          width: 86,
          height: 42,
          title: 'Skyline Reflection',
          description: 'Even against that whole skyline, your aura and energy were the only thing I noticed.',
          icon: 'skyline',
          caption: 'Even against that whole skyline, your aura and energy were the only thing I noticed.',
        },
        {
          key: 'bench',
          x: 1110,
          y: 585,
          width: 92,
          height: 46,
          title: 'Bench Engraving',
          description: 'You’d come sit with the IT guys beside our row, long before any of this began — and I’d catch myself smiling, just watching you from the side.',
          icon: 'bench',
          caption: 'You’d come sit with the IT guys beside our row, long before any of this began — and I’d catch myself smiling, just watching you from the side.',
        },
        {
          key: 'flower-pot',
          x: 640,
          y: 500,
          width: 52,
          height: 44,
          title: 'Flower Pot',
          description: 'A tiny yellow duck on your phone cover — such a small thing, so entirely you.',
          icon: 'flower',
          caption: 'A tiny yellow duck on your phone cover — such a small thing, so entirely you.',
        },
        {
          key: 'office-window',
          x: 955,
          y: 292,
          width: 78,
          height: 50,
          title: 'Office Window',
          description: 'You’d walk that terrace like it was a ramp-walk — and through that glass, you never once saw me watching.',
          icon: 'window',
          caption: 'You’d walk that terrace like it was a ramp-walk — and through that glass, you never once saw me watching.',
        },
        {
          key: 'warm-light',
          x: 1110,
          y: 338,
          width: 62,
          height: 48,
          title: 'Warm Sunlight',
          description: 'The kind of light that made an ordinary afternoon feel like something worth remembering — starting with you.',
          icon: 'sun',
          caption: 'The kind of light that made an ordinary afternoon feel like something worth remembering — starting with you.',
        },
      ],
      completionMessage: 'Every small thing is written down now.',
    },
  },
  {
    id: 2,
    title: 'Reconstruct the Conversation',
    miniGameType: 'conversation-crossword',
    dialogueCompleteTriggersMiniGame: true,
    journal: {
      title: 'The Daily Check-In',
      entry: 'Care, repeated gently, became its own kind of language.',
      keepsake: 'keepsake-02',
      image: 'journal-memory-2',
      artifactTitle: 'Medicine Bottle Charm',
      artifactCaption: 'A tiny reminder that care can sound like a question.',
      accent: 'charm',
    },
    miniGameConfig: {
      backgroundKey: byIndex[2].backgroundKey,
      // Replace these placeholder clues, answers, coordinates, and reveal text with final Memory 2 details.
      memory2ConversationPuzzle: {
        title: 'Reconstruct the Conversation',
        subtitle: 'Memory 2 reconstruction',
        completionRevealText: 'You asked again and again, not because you had to, but because you cared.',
        completionConversation:
          'You asked every day if I was feeling better.\nIt never felt like a routine question.\nIt always felt like you genuinely cared.',
        completionAnimation: 'conversation-reconstruction',
        conversationFragments: [
          '...how are you...',
          '...did you eat...',
          '...drink some water...',
          '...take your medicine...',
          '...every day...',
          '...that smile said enough...',
        ],
        words: [
          {
            id: 'health',
            answer: 'HEALTH',
            clue: 'The first thing she kept asking about.',
            hint: 'It was never formality. It felt like real concern.',
            fragment: '...how are you...',
            row: 0,
            col: 2,
            direction: 'across',
            hotspot: { label: 'medicine bottle', x: 0.74, y: 0.78, width: 0.07, height: 0.09, revealLetterIndex: 0 },
          },
          {
            id: 'care',
            answer: 'CARE',
            clue: 'What her daily question quietly became.',
            hint: 'The word was small, but it changed the room.',
            fragment: '...did you eat...',
            row: 0,
            col: 8,
            direction: 'down',
            hotspot: { label: 'coffee mug', x: 0.42, y: 0.76, width: 0.07, height: 0.08, revealLetterIndex: 1 },
          },
          {
            id: 'daily',
            answer: 'DAILY',
            clue: 'How often that concern returned.',
            hint: 'It arrived with the rhythm of ordinary days.',
            fragment: '...every day...',
            row: 3,
            col: 2,
            direction: 'across',
            hotspot: { label: 'calendar', x: 0.56, y: 0.34, width: 0.08, height: 0.1, revealLetterIndex: 2 },
          },
          {
            id: 'water',
            answer: 'WATER',
            clue: 'A small comfort beside medicine.',
            hint: 'A practical kindness, offered without drama.',
            fragment: '...drink some water...',
            row: 5,
            col: 4,
            direction: 'across',
            hotspot: { label: 'glass of water', x: 0.67, y: 0.78, width: 0.06, height: 0.1, revealLetterIndex: 0 },
          },
          {
            id: 'medicine',
            answer: 'MEDICINE',
            clue: 'The tiny bottle on the desk.',
            hint: 'The object that made concern visible.',
            fragment: '...take your medicine...',
            row: 6,
            col: 0,
            direction: 'across',
            hotspot: { label: 'sticky note / notice board', x: 0.31, y: 0.39, width: 0.1, height: 0.12, revealLetterIndex: 3 },
          },
          {
            id: 'smile',
            answer: 'SMILE',
            clue: 'The soft answer no one had to say.',
            hint: 'Warm light at the edge of a difficult day.',
            fragment: '...that smile said enough...',
            row: 2,
            col: 1,
            direction: 'down',
            hotspot: { label: 'window / warm light', x: 0.85, y: 0.32, width: 0.12, height: 0.13, revealLetterIndex: 2 },
          },
        ],
      },
      crossword: [
        { answer: 'HEALTH', clue: 'The first thing she kept asking about.' },
        { answer: 'CARE', clue: 'What daily kindness felt like.' },
        { answer: 'DAILY', clue: 'How often the question returned.' },
        { answer: 'SMILE', clue: 'The soft answer no one had to say.' },
        { answer: 'WATER', clue: 'A small comfort beside medicine.' },
        { answer: 'MEDICINE', clue: 'The tiny bottle on the desk.' },
      ],
      completionMessage: 'The answer was care, all along.',
    },
  },
  {
    id: 3,
    title: 'Rebuild the Conversation',
    miniGameType: 'rearrange-dialogue',
    dialogueCompleteTriggersMiniGame: true,
    journal: {
      title: 'A Conversation Like Home',
      entry: 'The lines fall back into order, the way trust did.',
      keepsake: 'keepsake-03',
      image: 'journal-memory-3',
      artifactTitle: 'Folded Letter',
      artifactCaption: 'The conversation that started feeling like home.',
      accent: 'letter',
    },
    miniGameConfig: {
      dialogueCards: [
        { speaker: 'Him', text: 'One weekend, just tell everyone it’s an office trip. 😝 We’ll have an amazing Saturday and Sunday together, then head back.' },
        { speaker: 'Her', text: 'And what exactly am I supposed to tell them? My mom video calls me every single day—you know that.' },
        { speaker: 'Him', text: 'It’s not like I’ll be glued to you the whole time. You can always do the video call.' },
        { speaker: 'Her', text: 'What am I supposed to show her? ‘Look, this is my manager!’ 🤣🤣 I’d love to go… but at least meet me normally once before we plan something like that.' },
      ],
      correctOrder: [0, 1, 2, 3],
      completionMessage: 'The conversation sounds like itself again.',
    },
  },
  {
    id: 4,
    title: 'Hidden Differences',
    miniGameType: 'hidden-differences',
    dialogueCompleteTriggersMiniGame: true,
    journal: {
      title: 'Everything Remembered',
      entry: 'Attention turns into evidence. Nothing small was ever small to you.',
      keepsake: 'keepsake-04',
      image: 'journal-memory-4',
      artifactTitle: 'Shoe Charm',
      artifactCaption: 'Proof that being noticed can feel like being loved.',
      accent: 'shoe',
    },
    miniGameConfig: {
      backgroundKey: byIndex[4].backgroundKey,
      /* 
         =====================================================================
         MEMORY 4 CONFIGURATION FOR "SPOT THE DIFFERENCE" PUZZLE
         To modify the puzzle, change the values below.
         =====================================================================
      */
      originalImage: 'bg-memory-4',               // [Original Image Key / Path]
      changedImage: 'bg-memory-4-changed',         // [Changed Image Key / Path - if not found, programmatic overlays will render]
      subtitle: 'Memory 4 reconstruction',
      instruction: 'Compare the two rooms and find what changed.',
      completionMessage: 'Every difference has been noticed.',
      completionText: 'Some details change, but the feeling stays.',
      differences: [
        {
          id: 'shirt-detail',
          label: 'The shirt detail changed.',
          description: 'One tiny detail, the kind she would have noticed.',
          x: 0.21,
          y: 0.40,
          radius: 0.05
        },
        {
          id: 'notice-board',
          label: 'Notice board note missing.',
          description: 'A small square of paper, gone from the frame.',
          x: 0.66,
          y: 0.40,
          radius: 0.06
        },
        {
          id: 'flower-color',
          label: 'Flower color changed.',
          description: 'A different shade of warm autumn petals.',
          x: 0.47,
          y: 0.52,
          radius: 0.05
        },
        {
          id: 'photo-frame',
          label: 'Desk photo frame changed.',
          description: 'A photo turned around, or a different picture altogether.',
          x: 0.36,
          y: 0.49,
          radius: 0.05
        },
        {
          id: 'book-position',
          label: 'Book position changed.',
          description: 'Resting tilted on a different corner of the desk.',
          x: 0.58,
          y: 0.61,
          radius: 0.05
        },
        {
          id: 'window-detail',
          label: 'Curtain / window detail changed.',
          description: 'A fold hanging slightly differently in the light.',
          x: 0.83,
          y: 0.29,
          radius: 0.06
        }
      ],
      /* ===================================================================== */
    },
  },
  {
    id: 5,
    title: 'Photo Album Restore',
    miniGameType: 'photo-album-restore',
    dialogueCompleteTriggersMiniGame: true,
    journal: {
      title: 'Midnight Kept Safe',
      entry: 'The album page holds the birthday exactly where it belongs.',
      keepsake: 'keepsake-05',
      image: 'journal-memory-5',
      artifactTitle: 'Coffee Cup',
      artifactCaption: 'Even now this reminds me of you.',
      accent: 'coffee',
    },
    miniGameConfig: {
      completionMessage: 'The album page is whole again.',
      /* 
         =====================================================================
         MEMORY 5 CONFIGURATION FOR PREMIUM SCRAPBOOK RESTORATION
         =====================================================================
      */
      scrapbook: {
        heroPhoto: 'bg-memory-5-album',
        completionText: 'Midnight had never once felt like being chosen — until then.',
        hiddenNote: 'Some memories never disappeared.\nThey were simply waiting to be found again.',
        keepsake: {
          key: 'keepsake-05',
          label: 'The Coffee Cup Keepsake',
          x: 0.82,
          y: 0.82
        },
        supportingPhotos: [
          { key: 'bg-memory-5-support-1', label: 'Among the Pines', x: 0.22, y: 0.32, rotation: -0.04, scale: 0.5 },
          { key: 'bg-memory-5-support-2', label: 'On the Bridge', x: 0.24, y: 0.68, rotation: 0.04, scale: 0.44 },
          { key: 'bg-memory-5-support-3', label: 'The Flying Dutchman', x: 0.78, y: 0.68, rotation: -0.06, scale: 0.4 }
        ],
        pieces: [
          {
            id: 'top-left',
            x: 0.25,
            y: 0.25,
            width: 0.5,
            height: 0.5,
            points: [-85, -60,  85, -60,  70,  5,  -85,  60]
          },
          {
            id: 'top-right',
            x: 0.75,
            y: 0.25,
            width: 0.5,
            height: 0.5,
            points: [-85, -60,  85, -60,  85,  60,  -70,  5]
          },
          {
            id: 'bottom-left',
            x: 0.25,
            y: 0.75,
            width: 0.5,
            height: 0.5,
            points: [-85, -60,  70, -5,  85,  60,  -85,  60]
          },
          {
            id: 'bottom-right',
            x: 0.75,
            y: 0.75,
            width: 0.5,
            height: 0.5,
            points: [-70, -5,  85, -60,  85,  60,  -85,  60]
          }
        ]
      }
      /* ===================================================================== */
    },
  },
  {
    id: 6,
    title: 'Office Escape Puzzle',
    miniGameType: 'office-escape-puzzle',
    dialogueCompleteTriggersMiniGame: true,
    journal: {
      title: 'Tuesday Unlocked',
      entry: 'The little office clues open into the one thing that mattered: time.',
      keepsake: 'keepsake-06',
      image: 'journal-memory-6',
      artifactTitle: 'Movie Ticket',
      artifactCaption: 'A small ticket for a day that became larger than planned.',
      accent: 'ticket',
    },
    miniGameConfig: {
      backgroundKey: byIndex[6].backgroundKey,
      completionMessage: 'The keepsake drawer unlocks.',
      /* 
         =====================================================================
         MEMORY 6 CONFIGURATION FOR ENVIRONMENTAL CLUE INVESTIGATION
         =====================================================================
      */
      officeEscape: {
        lockCode: '271',
        completionMessage: 'The keepsake drawer unlocks.',
        hotspots: [
          {
            key: 'calendar',
            name: 'Wall Calendar',
            x: 954,
            y: 224,
            width: 80,
            height: 96,
            clueText: 'A wall calendar. The 2nd of the month is circled in red ink.',
            sketchTitle: 'Circle on the Calendar',
            sketchCaption: 'Tuesday, the 2nd.\nIt was a day we promised not to forget.'
          },
          {
            key: 'sticky-note',
            name: 'Sticky Note',
            x: 712,
            y: 346,
            width: 54,
            height: 54,
            clueText: 'A yellow sticky note on the monitor. It has a handwritten "7" scribbled on it.',
            sketchTitle: 'Scribbled Sticky Note',
            sketchCaption: 'A single digit "7" left behind on the glass.'
          },
          {
            key: 'desk-coffee',
            name: 'Coffee Mug',
            x: 432,
            y: 472,
            width: 60,
            height: 60,
            clueText: 'A coffee mug on the side table. The bottom has a printed "1" emblem.',
            sketchTitle: 'The Blue Ceramic Mug',
            sketchCaption: 'A stamped "1" on the clay base.\nCold coffee, half-finished.'
          }
        ]
      }
      /* ===================================================================== */
    },
  },
  {
    id: 7,
    title: 'Fill the Missing Diary',
    miniGameType: 'diary-fill-in',
    dialogueCompleteTriggersMiniGame: true,
    journal: {
      title: 'Right Now, All Over Again',
      entry: 'The last notes become one sentence, and the letter can finally wait for you.',
      keepsake: 'keepsake-07',
      image: 'journal-memory-7',
      artifactTitle: 'Heart Locket',
      artifactCaption: 'The final page, kept close.',
      accent: 'locket',
    },
    miniGameConfig: {
      backgroundKey: byIndex[7].backgroundKey,
      completionMessage: 'Every chapter deserves an ending.',
      /*
         =====================================================================
         MEMORY 7 CONFIGURATION — FILL THE MISSING DIARY
         Replace paragraph / missingWords / correctAnswers freely; blanks are
         plain runs of underscores (___) matched in reading order against
         correctAnswers. Each answer should be a short 2–5 word phrase, not a
         single word — the diary should read like a restored handwritten page,
         not a fill-in-the-blank worksheet. No other file needs to change.
         =====================================================================
      */
      memory7Diary: {
        title: 'The Last Page',
        subtitle: 'help her finish the final entry',
        paragraph:
          'I never imagined that ___ would somehow become my favourite part of the day.\n' +
          "Even now I remember ___ right before you turned shy, and how you'd still show up with ___, just to see me smile.\n" +
          "You always tell me to stop making little things for you, and spend ___ instead — even then, somehow, you're still thinking of me.\n" +
          'Some evenings never really end. They just quietly become ___.',
        missingWords: [
          'the memories I hold closest',
          'a box of warm petha',
          'our endless audio calls',
          'that time on yourself',
          'the way you smiled',
        ],
        correctAnswers: [
          'our endless audio calls',
          'the way you smiled',
          'a box of warm petha',
          'that time on yourself',
          'the memories I hold closest',
        ],
        pageDecoration: {
          flowers: true,
          vines: true,
          goldCorners: true,
          waxSeal: true,
          curledEdges: true,
        },
        completionAnimation: 'diary-close',
        closingLine: '— always, in every version of us.',
      },
      /* ===================================================================== */
    },
  },
];

export const getMiniGameByMemory = (memoryIndex: number): MiniGameConfig | undefined =>
  MINI_GAMES.find((game) => game.id === memoryIndex);
