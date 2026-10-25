// Session builder: every group and question order gets the screens the design requires.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let vite, buildSteps, getQuestion, CONFIG;

before(async () => {
  // Load the browser modules through Vite, which handles the JSON import.
  vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  ({ buildSteps, getQuestion } = await vite.ssrLoadModule('/src/lib/session.js'));
  ({ CONFIG } = await vite.ssrLoadModule('/src/config.js'));
});
after(() => vite.close());

const questions = (steps) => steps.filter((s) => s.kind === 'question');

for (const group of ['standard', 'adaptive', 'control']) {
  for (const blockOrder of [0, 1, 2]) {
    test(`${group}, order ${blockOrder}: full session`, () => {
      const steps = buildSteps(blockOrder, group);
      const qs = questions(steps);
      const practice = qs.filter((s) => s.section === 'practice');
      const retention = qs.filter((s) => s.section === 'retention');

      assert.equal(practice.length, CONFIG.rounds * CONFIG.practicePerRound);
      assert.equal(new Set(qs.filter((s) => s.section !== 'retention').map((s) => s.qid)).size, qs.length - retention.length, 'no question repeats before the final check');
      assert.equal(retention.length, 9, '3 practice + 3 solo re-tests + 3 transfer');

      const planted = practice.filter((s) => s.planted).map((s) => s.qid);
      assert.equal(planted.length, group === 'control' ? 0 : 2);
      assert.ok(retention.every((s) => !planted.includes(s.qid)), 'wrong-answer questions are never re-tested');
      assert.ok(practice.every((s) => s.ai === (group !== 'control')));

      for (const s of retention.filter((r) => r.retest !== 'transfer')) {
        const q = getQuestion(s.qid);
        assert.notEqual(s.order.indexOf(q.correct), q.correct, 'the correct option moves on re-test');
        assert.equal(s.askSource, group !== 'control');
      }

      const kinds = steps.map((s) => s.kind);
      assert.ok(kinds.indexOf('questionnaire') < kinds.indexOf('debrief'));
      assert.equal(kinds.at(-1), 'done');
      const lastRetention = steps.findLastIndex((s) => s.section === 'retention');
      assert.ok(lastRetention < kinds.indexOf('debrief'), 'the debrief comes after the final check');
    });
  }
}

test('demo session is short and shows one wrong-answer check', () => {
  const steps = buildSteps(0, 'standard', { demo: true });
  const qs = questions(steps);
  assert.ok(qs.length <= 8, `demo has ${qs.length} questions`);
  assert.equal(qs.filter((s) => s.planted).length, 1);
  assert.ok(steps.some((s) => s.kind === 'debrief'));
});

test('intro screens carry the question count they announce', () => {
  const steps = buildSteps(0, 'adaptive');
  for (const intro of steps.filter((s) => s.kind === 'intro')) {
    const next = steps.slice(steps.indexOf(intro) + 1).filter((s) => s.kind === 'question' && s.section === intro.section);
    const count = intro.round ? next.filter((s) => s.round === intro.round).length : next.length;
    assert.equal(intro.count, count, `${intro.section} ${intro.round ?? ''}`);
  }
});
