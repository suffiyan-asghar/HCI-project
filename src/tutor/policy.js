import { CONFIG } from '../config';

// Help levels, from least to most help:
//   guide -> a guiding question
//   hint  -> a hint that rules out wrong options
//   full  -> the answer plus a short reason
//   more  -> further explanation after the answer was given

export function firstLevel(group, noAiResults) {
  if (group === 'standard') return 'full';
  const recent = noAiResults.slice(-CONFIG.adaptive.window);
  if (recent.length === 0) return 'full';
  const accuracy = recent.filter(Boolean).length / recent.length;
  if (accuracy < CONFIG.adaptive.fullBelow) return 'full';
  if (accuracy < CONFIG.adaptive.hintBelow) return 'hint';
  return 'guide';
}

export function nextLevel(group, current) {
  if (group === 'standard') return 'more';
  return { guide: 'hint', hint: 'full', full: 'more', more: 'more' }[current];
}

export const givesAnswer = (level) => level === 'full' || level === 'more';
