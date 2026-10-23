import bank from '../data/questions.json';
import { CONFIG } from '../config';

const byId = Object.fromEntries(bank.questions.map((q) => [q.id, q]));

export const LETTERS = ['A', 'B', 'C', 'D', 'E'];

// Latin square: each block appears in each round equally often across participants.
const BLOCK_ORDERS = [
  ['A', 'B', 'C'],
  ['B', 'C', 'A'],
  ['C', 'A', 'B'],
];

export function getQuestion(id) {
  const q = byId[id];
  if (!q) throw new Error(`Unknown question id: ${id}`);
  return q;
}

function isPlanted(round, index) {
  return CONFIG.plantedPositions.some((p) => p.round === round && p.index === index);
}

// The full, fixed list of screens one participant sees.
export function buildSteps(blockOrder) {
  const order = BLOCK_ORDERS[blockOrder % BLOCK_ORDERS.length];
  const steps = [{ kind: 'consent' }, { kind: 'demographics' }, { kind: 'intro', section: 'warmup' }];

  bank.warmup.forEach((qid, i) =>
    steps.push({ kind: 'question', section: 'warmup', qid, index: i, total: bank.warmup.length, ai: false }),
  );
  steps.push({ kind: 'effort', section: 'warmup' });

  order.forEach((blockId, r) => {
    const round = r + 1;
    const block = bank.blocks[blockId];

    steps.push({ kind: 'intro', section: 'practice', round });
    block.practice.forEach((qid, i) =>
      steps.push({
        kind: 'question',
        section: 'practice',
        round,
        block: blockId,
        qid,
        index: i,
        total: block.practice.length,
        ai: true,
        planted: isPlanted(round, i),
      }),
    );
    steps.push({ kind: 'effort', section: 'practice', round });

    steps.push({ kind: 'intro', section: 'solo', round });
    block.solo.forEach((qid, i) =>
      steps.push({ kind: 'question', section: 'solo', round, block: blockId, qid, index: i, total: block.solo.length, ai: false }),
    );
    steps.push({ kind: 'effort', section: 'solo', round });
  });

  steps.push({ kind: 'questionnaire' }, { kind: 'debrief' }, { kind: 'done' });
  return steps;
}

export function sectionLabel(step) {
  if (step.section === 'warmup') return 'Warm-up';
  if (step.section === 'practice') return `Practice with StudyBot · Round ${step.round} of ${CONFIG.rounds}`;
  return `Solo check · Round ${step.round} of ${CONFIG.rounds}`;
}

export function questionProgress(session) {
  const questionSteps = session.steps.filter((s) => s.kind === 'question').length;
  const done = session.steps.slice(0, session.stepIndex).filter((s) => s.kind === 'question').length;
  return { done, total: questionSteps };
}
