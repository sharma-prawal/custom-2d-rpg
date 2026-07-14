export interface BtsNote {
  title: string;
  body: string;
}

export const BTS_NOTES: BtsNote[] = [
  {
    title: 'Bug Report #1',
    body: 'The cat sprite (there is no cat) walked backwards into the wall for three hours before anyone noticed there was no cat.',
  },
  {
    title: 'Bug Report #2',
    body: 'Chapter Five originally took place at 11:59pm. QA (me) insisted it be exactly midnight. QA (me) was right.',
  },
  {
    title: 'Asset Log',
    body: '"Petha box, but make it look emotionally significant" took 14 attempts.',
  },
  {
    title: 'Design Note',
    body: 'Considered adding a jump button. Rejected — this is not that kind of RPG. She has never needed to jump to matter to me.',
  },
  {
    title: 'Overheard in the Terminal',
    body: '"Can you make the terrace scene warmer" was typed into three different AI tools before one of them understood "warmer" meant light, not temperature.',
  },
  {
    title: 'Confession',
    body: 'The developer got distracted rereading Chapter Four four separate times and had to be reminded that dialogue boxes do not write themselves.',
  },
];
