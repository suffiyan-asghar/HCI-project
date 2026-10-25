import { readFileSync } from 'node:fs';

const bank = JSON.parse(readFileSync(new URL('../src/data/questions.json', import.meta.url), 'utf8'));
const byId = new Map(bank.questions.map((q) => [q.id, q]));

export const LETTERS = ['A', 'B', 'C', 'D', 'E'];

export function getQuestion(id) {
  return byId.get(id) ?? null;
}

// Fails fast at startup if the bank is missing anything the session or tutor relies on.
export function validateBank() {
  const problems = [];
  const need = (q, fields) => fields.filter((f) => q[f] === undefined).forEach((f) => problems.push(`${q.id}: missing ${f}`));
  const ref = (id, where) => {
    if (byId.has(id)) return true;
    problems.push(`${where}: unknown question ${id}`);
    return false;
  };

  for (const q of bank.questions) {
    need(q, ['type', 'stem', 'options', 'correct']);
    if (!(q.correct >= 0 && q.correct < q.options.length)) problems.push(`${q.id}: correct out of range`);
  }
  // Hints must never give away an option they are meant to keep open.
  const named = (lines, q, i) => lines.some((line) => line.toLowerCase().includes(q.options[i].toLowerCase().replace(/[.]$/, '')));
  // Any practice position can be a wrong-answer check, and a spare can replace any question,
  // so these need every tutor field.
  const tutorReady = (id, where) => {
    if (!ref(id, where)) return;
    const q = byId.get(id);
    need(q, ['hint', 'guide', 'explanation', 'plantedWrong', 'plantedWhy', 'plantedHint', 'plantedGuide']);
    if (q.plantedWrong === q.correct) problems.push(`${id}: plantedWrong equals correct`);
    if (q.hint && named(q.hint, q, q.correct)) problems.push(`${id}: hint names the correct option`);
    if (q.plantedHint && (named(q.plantedHint, q, q.correct) || named(q.plantedHint, q, q.plantedWrong))) {
      problems.push(`${id}: plantedHint names the correct or planted option`);
    }
  };

  bank.warmup.forEach((id) => ref(id, 'warmup'));
  bank.transfer.forEach((id) => ref(id, 'transfer'));
  (bank.spares ?? []).forEach((id) => tutorReady(id, 'spares'));
  for (const [name, block] of Object.entries(bank.blocks)) {
    block.solo.forEach((id) => ref(id, `block ${name} solo`));
    block.practice.forEach((id) => tutorReady(id, `block ${name} practice`));
  }
  const ids = bank.questions.map((q) => q.id);
  ids.filter((id, i) => ids.indexOf(id) !== i).forEach((id) => problems.push(`duplicate id ${id}`));
  if (problems.length) throw new Error(`Question bank problems:\n  ${problems.join('\n  ')}`);
  return bank;
}
