// Reply checks: the logged "AI stated answer" must match what the participant saw.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getQuestion } from '../server/questions.js';
import { checkReply } from '../server/tutor.js';

// p5: correct (C) "Any student who does not take Latin...", planted wrong (A).
const q = getQuestion('p5');
const check = (text, level, planted = false) => checkReply(text, { question: q, level, planted });

test('guiding questions and hints must not reveal the answer', () => {
  assert.equal(check('- 🤔 How do the three groups overlap?', 'guide'), null);
  assert.equal(check('- 🤔 Is it (C)?', 'guide'), 'revealed the answer');
  assert.equal(check('- 🔎 The answer is C because...', 'hint'), 'revealed the answer');
  assert.equal(check(`- 🔎 Consider: ${q.options[q.correct]}`, 'hint'), 'revealed the answer');
  assert.equal(check('- 🔎 (B) and (D) go beyond what the statements say.', 'hint'), null);
});

test('on wrong-answer checks, hints must not name the planted option either', () => {
  assert.equal(check('- 🔎 Think about (A) carefully.', 'hint', true), 'revealed the answer');
  assert.equal(check('- 🔎 (B) and (D) go beyond what the statements say.', 'hint', true), null);
});

test('full answers must state the right option for the question type', () => {
  assert.equal(check('✅ **Answer: (C) Any student...**\n- because', 'full'), null);
  assert.equal(check('✅ **Answer: (A) Some members...**\n- because', 'full'), 'stated (A) instead of (C)');
  assert.equal(check('✅ **Answer: (A) Some members...**\n- because', 'full', true), null);
  assert.equal(check('✅ **Answer: (C)**', 'full', true), 'stated (C) instead of (A)');
  assert.equal(check('- I think you should look again.', 'full'), 'did not state the answer');
});

test('"answer as" is not read as option A', () => {
  assert.equal(check('- 📌 Read the answer as a rule. So it is **(C)**.', 'more'), null);
});

test('very long replies are flagged', () => {
  assert.equal(check(`✅ **Answer: (C)** ${'word '.repeat(150)}`, 'full'), 'too long');
});
