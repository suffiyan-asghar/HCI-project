import bank from '../data/questions.json';
import { CONFIG } from '../config';

const byId = Object.fromEntries(bank.questions.map((q) => [q.id, q]));

export const LETTERS = ['A', 'B', 'C', 'D', 'E'];

export const GROUPS = ['standard', 'adaptive', 'control'];
export const hasTutor = (group) => group !== 'control';

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

// How much of the bank a session uses. A demo session takes a short slice of everything.
function sessionPlan(demo) {
  const d = CONFIG.demo;
  return {
    rounds: demo ? d.rounds : CONFIG.rounds,
    warmup: demo ? d.warmup : bank.warmup.length,
    practice: demo ? d.practice : CONFIG.practicePerRound,
    solo: demo ? d.solo : Infinity,
    transfer: demo ? d.transfer : bank.transfer.length,
    planted: demo ? d.plantedPositions : CONFIG.plantedPositions,
  };
}

function shuffle(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// A new option order for a question seen before, so the answer can't be recalled by
// position. order[k] is the original index of the option shown in position k.
function reshuffledOrder(question) {
  const identity = question.options.map((_, i) => i);
  let order;
  do order = shuffle(identity);
  while (order.indexOf(question.correct) === question.correct);
  return order;
}

// Final check: questions seen earlier (one practice, one solo per round) asked again
// without AI, plus new transfer questions. Practice questions where the tutor gave a
// wrong answer on purpose are never re-tested.
function retentionSteps(rounds, plan, isPlanted, withTutor) {
  const seen = new Set();
  const items = [];
  const add = (item) => {
    if (seen.has(item.qid)) return;
    seen.add(item.qid);
    items.push(item);
  };

  rounds.forEach(({ round, practice, solo }) => {
    const p = CONFIG.retention.practicePick.find((i) => i < practice.length && !isPlanted(round, i));
    add({ qid: practice[p], retest: 'practice', sourceRound: round });
    add({ qid: solo[Math.min(CONFIG.retention.soloPick, solo.length - 1)], retest: 'solo', sourceRound: round });
  });
  bank.transfer.slice(0, plan.transfer).forEach((qid) => add({ qid, retest: 'transfer' }));

  return shuffle(items).map((item, i, all) => ({
    kind: 'question',
    section: 'retention',
    ...item,
    index: i,
    total: all.length,
    ai: false,
    ...(item.retest !== 'transfer' && { order: reshuffledOrder(getQuestion(item.qid)), askSource: withTutor }),
  }));
}

// The full, fixed list of screens one participant sees.
export function buildSteps(blockOrder, group, { demo = false } = {}) {
  const plan = sessionPlan(demo);
  const isPlanted = (round, index) => plan.planted.some((p) => p.round === round && p.index === index);
  const withTutor = hasTutor(group);
  const warmup = bank.warmup.slice(0, plan.warmup);
  const rounds = BLOCK_ORDERS[blockOrder % BLOCK_ORDERS.length].slice(0, plan.rounds).map((blockId, r) => ({
    round: r + 1,
    blockId,
    practice: bank.blocks[blockId].practice.slice(0, plan.practice),
    solo: bank.blocks[blockId].solo.slice(0, plan.solo),
  }));

  const steps = [{ kind: 'consent' }, { kind: 'demographics' }, { kind: 'intro', section: 'warmup', count: warmup.length }];
  warmup.forEach((qid, i) => steps.push({ kind: 'question', section: 'warmup', qid, index: i, total: warmup.length, ai: false }));
  steps.push({ kind: 'effort', section: 'warmup' });

  for (const { round, blockId, practice, solo } of rounds) {
    steps.push({ kind: 'intro', section: 'practice', round, count: practice.length });
    practice.forEach((qid, i) =>
      steps.push({
        kind: 'question',
        section: 'practice',
        round,
        block: blockId,
        qid,
        index: i,
        total: practice.length,
        ai: withTutor,
        planted: withTutor && isPlanted(round, i),
      }),
    );
    steps.push({ kind: 'effort', section: 'practice', round });

    steps.push({ kind: 'intro', section: 'solo', round, count: solo.length });
    solo.forEach((qid, i) =>
      steps.push({ kind: 'question', section: 'solo', round, block: blockId, qid, index: i, total: solo.length, ai: false }),
    );
    steps.push({ kind: 'effort', section: 'solo', round });
  }

  // The questionnaire also serves as a short delay before the retention test.
  const retention = retentionSteps(rounds, plan, isPlanted, withTutor);
  steps.push({ kind: 'questionnaire' }, { kind: 'intro', section: 'retention', count: retention.length });
  steps.push(...retention);
  steps.push({ kind: 'debrief' }, { kind: 'done' });
  return steps;
}

export function sectionLabel(step) {
  if (step.section === 'warmup') return 'Warm-up';
  if (step.section === 'retention') return 'Final check';
  if (step.section === 'practice') {
    return `${step.ai ? 'Practice with StudyBot' : 'Practice'} · Round ${step.round} of ${CONFIG.rounds}`;
  }
  return `Solo check · Round ${step.round} of ${CONFIG.rounds}`;
}

export function questionProgress(session) {
  const questionSteps = session.steps.filter((s) => s.kind === 'question').length;
  const done = session.steps.slice(0, session.stepIndex).filter((s) => s.kind === 'question').length;
  return { done, total: questionSteps };
}
