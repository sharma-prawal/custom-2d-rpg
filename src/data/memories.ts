export interface MemoryProp {
  key: string;
  x: number;
  y: number;
  label: string;
  /** Shown in the dialogue box when interacted with. */
  narration: string[];
}

export interface MemoryData {
  id: string;
  index: number;
  title: string;
  subtitle: string;
  setting: string;
  timeOfDay: 'morning' | 'afternoon' | 'dusk' | 'night' | 'midnight' | 'evening';
  season: string;
  herOutfit: string;
  hisOutfit: string;
  /** Ambient color tint applied over the scene to sell time-of-day/season mood. */
  ambientTint: number;
  ambientAlpha: number;
  backgroundKey: string;
  musicKey: string;
  /** Opening narration shown as soon as the scene loads, before any prop is touched. */
  intro: string[];
  props: MemoryProp[];
  /** Final line(s) shown once every prop in the scene has been visited. */
  closing: string[];
}

export const MEMORIES: MemoryData[] = [
  {
    id: 'memory-1',
    index: 1,
    title: 'The Afternoon I Started Noticing You',
    subtitle: 'Long before either of us said a word',
    setting: '5th-floor office terrace',
    timeOfDay: 'afternoon',
    season: 'early autumn',
    herOutfit: 'office-formals',
    hisOutfit: 'office-formals',
    ambientTint: 0xffdca8,
    ambientAlpha: 0.08,
    backgroundKey: 'bg-memory-1',
    musicKey: 'music-memory-1',
    intro: [
      'Fifth floor, just past lunchtime — same as always.',
      'You walked this way every single day, never once knowing someone had started waiting for it.',
    ],
    props: [
      {
        key: 'prop-terrace-railing',
        x: 880,
        y: 360,
        label: 'The Railing',
        narration: [
          'We hadn’t exchanged a single word. We were practically strangers.',
          'And still, catching sight of you made the rest of my day feel warmer.',
        ],
      },
      {
        key: 'prop-office-clock',
        x: 240,
        y: 240,
        label: 'The Clock',
        narration: [
          'Looking back, I think some part of me knew before I was ever brave enough to admit it.',
        ],
      },
    ],
    closing: ['Some stories start quietly, long before anyone says hello.'],
  },
  {
    id: 'memory-2',
    index: 2,
    title: 'A Question You Kept Asking',
    subtitle: 'One stubborn ache, and someone who kept checking in',
    setting: 'A cozy office break room',
    timeOfDay: 'afternoon',
    season: 'late autumn',
    herOutfit: 'casual-comfortable',
    hisOutfit: 'casual-comfortable',
    ambientTint: 0xffe9c2,
    ambientAlpha: 0.07,
    backgroundKey: 'bg-memory-2',
    musicKey: 'music-memory-2',
    intro: [
      'For weeks, an aching tooth turned into an unwelcome part of my daily routine.',
    ],
    props: [
      {
        key: 'prop-desk-medicine',
        x: 400,
        y: 400,
        label: 'A Small Medicine Bottle',
        narration: [
          'What caught me off guard was you — checking in almost every day to see if I was doing okay.',
          'It never once felt like politeness. It never felt like a duty.',
        ],
      },
      {
        key: 'prop-calendar',
        x: 960,
        y: 280,
        label: 'The Calendar',
        narration: [
          'Every “feeling any better today?” carried something more than small talk.',
          'It might have been the first time I understood how good it feels to simply be looked after.',
        ],
      },
    ],
    closing: ['Quiet kindness, offered again and again, has a way of staying with you.'],
  },
  {
    id: 'memory-3',
    index: 3,
    title: 'The Conversation That Felt Like Home',
    subtitle: 'Where all the walls quietly came down',
    setting: 'A rooftop bench, string lights overhead',
    timeOfDay: 'dusk',
    season: 'autumn evening',
    herOutfit: 'casual-light-jacket',
    hisOutfit: 'casual-light-jacket',
    ambientTint: 0x8a6bb0,
    ambientAlpha: 0.14,
    backgroundKey: 'bg-memory-3',
    musicKey: 'music-memory-3',
    intro: [
      'Some people take years to really know one another.',
      'Somehow, we skipped straight past all that distance.',
    ],
    props: [
      {
        key: 'prop-bench',
        x: 640,
        y: 440,
        label: 'The Bench',
        narration: [
          'Neither of us noticed the exact moment the walls came down.',
          'It felt like two people who’d been holding onto unspoken thoughts for too long had finally found someone safe enough to hand them to.',
        ],
      },
      {
        key: 'prop-string-lights',
        x: 1040,
        y: 200,
        label: 'String Lights',
        narration: [
          'Talking to you never felt new. It felt familiar, like returning somewhere.',
          'Almost as if we’d been waiting on each other without realizing it.',
        ],
      },
    ],
    closing: ['Home isn’t always somewhere you go. Sometimes it’s just someone you talk to.'],
  },
  {
    id: 'memory-4',
    index: 4,
    title: 'Everything You Somehow Remembered',
    subtitle: 'Not just the big days — every small one too',
    setting: 'A room full of small treasured objects',
    timeOfDay: 'afternoon',
    season: 'season-neutral',
    herOutfit: 'home-casual',
    hisOutfit: 'home-casual',
    ambientTint: 0xfff1d6,
    ambientAlpha: 0.06,
    backgroundKey: 'bg-memory-4',
    musicKey: 'music-memory-4',
    intro: [
      'Most people remember a birthday. You remembered almost everything.',
    ],
    props: [
      {
        key: 'prop-shirt-hanger',
        x: 360,
        y: 280,
        label: 'A Shirt on a Hanger',
        narration: ['The shirt I’d worn once. The shoes I’d only just bought.'],
      },
      {
        key: 'prop-pinboard',
        x: 880,
        y: 360,
        label: 'A Pinboard of Small Notes',
        narration: [
          'The offhand things I’d mentioned once. The tiny details I’d have forgotten myself.',
          'Love doesn’t always show up as some grand gesture. Sometimes it’s just someone quietly paying attention.',
        ],
      },
    ],
    closing: ['Every small thing you noticed was a reminder that I mattered to you.'],
  },
  {
    id: 'memory-5',
    index: 5,
    title: 'The Midnight You Remembered First',
    subtitle: 'A wish a day early, and one right at midnight',
    setting: 'An outdoor spot strung with lights, cake and candles waiting',
    timeOfDay: 'midnight',
    season: 'winter',
    herOutfit: 'party-outfit',
    hisOutfit: 'party-outfit',
    ambientTint: 0x1a2456,
    ambientAlpha: 0.26,
    backgroundKey: 'bg-memory-5',
    musicKey: 'music-memory-5',
    intro: [
      'You wished me happy birthday a full day early… and then again, right as the clock struck twelve…',
    ],
    props: [
      {
        key: 'prop-cake',
        x: 640,
        y: 400,
        label: 'The Cake',
        narration: [
          '…and it stopped feeling like just another year, just another wish.',
          'To everyone else, it was one more square on the calendar. To you, it felt like you’d been counting down to that exact second.',
        ],
      },
      {
        key: 'prop-clock-tower',
        x: 1040,
        y: 160,
        label: 'The Clock Striking Twelve',
        narration: [
          'You’ll probably never know how much that moment meant.',
          'But I remember every second of it, still.',
        ],
      },
    ],
    closing: ['Midnight had never once felt like being chosen — until then.'],
  },
  {
    id: 'memory-6',
    index: 6,
    title: 'Tuesdays, Suddenly My Favorite Day',
    subtitle: 'The gift that wasn’t wrapped in anything',
    setting: 'A row of office desks, golden light through the blinds',
    timeOfDay: 'afternoon',
    season: 'late winter',
    herOutfit: 'smart-casual',
    hisOutfit: 'smart-casual',
    ambientTint: 0xffd9a0,
    ambientAlpha: 0.12,
    backgroundKey: 'bg-memory-6',
    musicKey: 'music-memory-6',
    intro: [
      'The most valuable thing you’ve ever given me was never a gift. It was your time.',
    ],
    props: [
      {
        key: 'prop-desk-coffee',
        x: 520,
        y: 400,
        label: 'A Cup of Coffee, Still Warm',
        narration: [
          'Somehow, Tuesdays quietly became the best day of my week.',
          'I’d secretly hope you’d stop by the office. I’d wonder what you’d be wearing that day.',
        ],
      },
      {
        key: 'prop-wall-calendar-tuesday',
        x: 960,
        y: 240,
        label: 'Tuesday, Circled',
        narration: [
          'I’d invent the smallest excuse just to keep you there a minute longer.',
          'Because every excuse was really just one more chance to be near you.',
        ],
      },
    ],
    closing: ['An ordinary day stops being ordinary the moment someone chooses to spend it with you.'],
  },
  {
    id: 'memory-7',
    index: 7,
    title: 'Right Now, All Over Again',
    subtitle: 'So many small moments I’m not ready to let go of',
    setting: 'A home table — a Petha box, two phones mid-call',
    timeOfDay: 'evening',
    season: 'present day',
    herOutfit: 'cozy-date-night',
    hisOutfit: 'cozy-date-night',
    ambientTint: 0xffb488,
    ambientAlpha: 0.11,
    backgroundKey: 'bg-memory-7',
    musicKey: 'music-memory-7',
    intro: [
      'There are so many small moments lately that I never want to lose.',
    ],
    props: [
      {
        key: 'prop-petha-box',
        x: 480,
        y: 400,
        label: 'The Panchhi Petha Box',
        narration: [
          'The day you walked in with Panchhi Petha, easy and unbothered, like there was nothing left to be nervous about.',
        ],
      },
      {
        key: 'prop-phone-call',
        x: 880,
        y: 360,
        label: 'Our Endless Late-Night Calls',
        narration: [
          'Our never-ending audio calls, where you sit through every story, every dream, every stray thought I have.',
          'The way you smile, then blush right after, whenever I get unbearably cheesy.',
        ],
      },
      {
        key: 'prop-notebook',
        x: 680,
        y: 240,
        label: 'A Half-Finished Little Gift',
        narration: [
          'And my favorite part — when you tell me to stop making things for you and spend that time on myself instead.',
          'Even while asking me to put myself first… you’re still, somehow, thinking of me.',
          'That’s simply who you are. And it’s exactly why I love you.',
        ],
      },
    ],
    closing: ['Every one of these moments led here. There’s just one more place left to walk to.'],
  },
];

export const getMemoryByIndex = (index: number): MemoryData | undefined =>
  MEMORIES.find((m) => m.index === index);
