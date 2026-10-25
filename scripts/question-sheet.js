// Writes docs/QUESTION_SHEET.md: every question in readable form for proofreading.
// Run with `npm run questions:sheet` after editing src/data/questions.json.
import { writeFileSync } from 'node:fs';
import { getQuestion, LETTERS, validateBank } from '../server/questions.js';

const bank = validateBank();
const out = [];
const list = (lines) => lines.map((l) => `  - ${l}`).join('\n');

function question(id, { tutor }) {
  const q = getQuestion(id);
  out.push(`### ${q.id} · ${q.type}`, '');
  if (q.passage) out.push(`> ${q.passage}`, '');
  out.push(q.stem.replace(/\n/g, '  \n'), '');
  q.options.forEach((opt, i) => {
    const marks = [i === q.correct && '✅ correct', i === q.plantedWrong && '⚠️ planted wrong answer'].filter(Boolean).join(', ');
    out.push(`- **(${LETTERS[i]})** ${opt}${marks ? `  ← ${marks}` : ''}`);
  });
  out.push('');
  if (q.explanation) out.push(`- **Why it's correct:**\n${list(q.explanation)}`);
  if (tutor) {
    out.push(`- **Hint:**\n${list(q.hint)}`, `- **Guiding question:** ${q.guide}`);
    out.push(`- **Planted reasoning** (must sound convincing):\n${list(q.plantedWhy)}`);
    out.push(`- **Planted hint** (must not rule out the correct or planted option):\n${list(q.plantedHint)}`);
    out.push(`- **Planted guiding question:** ${q.plantedGuide}`);
  }
  out.push('', '---', '');
}

out.push(
  '# Question sheet',
  '',
  'Generated from `src/data/questions.json` by `npm run questions:sheet`. Edit the JSON, not this file.',
  '',
  'For each question, check: one option is clearly best, the planted wrong answer sounds plausible and its reasoning convincing, and no hint gives the answer away.',
  '',
);

out.push('## Warm-up (no AI)', '');
bank.warmup.forEach((id) => question(id, { tutor: false }));
for (const [name, block] of Object.entries(bank.blocks)) {
  out.push(`## Block ${name}: practice (with tutor)`, '');
  block.practice.forEach((id) => question(id, { tutor: true }));
  out.push(`## Block ${name}: solo check (no AI)`, '');
  block.solo.forEach((id) => question(id, { tutor: false }));
}
out.push('## Transfer questions (final check only)', '');
bank.transfer.forEach((id) => question(id, { tutor: false }));
out.push('## Spares', '', 'Any spare can replace a question of the same type in any section.', '');
(bank.spares ?? []).forEach((id) => question(id, { tutor: true }));

const path = new URL('../docs/QUESTION_SHEET.md', import.meta.url);
writeFileSync(path, out.join('\n'));
console.log(`Wrote ${path.pathname}`);
