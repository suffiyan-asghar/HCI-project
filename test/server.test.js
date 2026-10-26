// API and database: access rules, group balance, saving, the tutor endpoint and exports.
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

// Must be set before the server modules load: they read these at import time.
process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), 'studybot-test-')), 'test.sqlite');
process.env.TUTOR_MODE = 'mock';
const PASSWORD = 'test-password';

const { createApp } = await import('../server/index.js');

let server, base;
before(async () => {
  server = createApp({ password: PASSWORD }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://localhost:${server.address().port}/api`;
});
after(() => server.close());

async function call(path, { method = 'GET', body, key = PASSWORD, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (key) headers['x-researcher-key'] = key;
  if (token) headers['x-session-token'] = token;
  const res = await fetch(base + path, { method, headers, body: body && JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: res.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text };
}

const start = (body = {}) => call('/sessions', { method: 'POST', body });
const snapshot = (s, extra = {}) => ({ participantId: s.participantId, group: s.group, status: 'active', steps: [], responses: {}, events: [], ...extra });
const save = (s, extra, token = s.token) => call(`/sessions/${s.participantId}`, { method: 'PUT', body: snapshot(s, extra), token });

test('researcher routes need the password', async () => {
  assert.equal((await call('/admin/sessions', { key: null })).status, 401);
  assert.equal((await call('/admin/sessions', { key: 'wrong' })).status, 401);
  assert.equal((await call('/sessions', { method: 'POST', body: {}, key: null })).status, 401);
  assert.equal((await call('/export/participants.csv?key=' + PASSWORD, { key: null })).status, 200);
});

test('groups stay balanced; excluded, aborted and demo sessions free their slot', async () => {
  for (let i = 0; i < 6; i++) await start();
  const counted = (await call('/admin/sessions')).body.sessions.filter((s) => !s.demo && !['excluded', 'aborted'].includes(s.status));
  const sizes = ['standard', 'adaptive', 'control'].map((g) => counted.filter((s) => s.grp === g).length);
  assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `group sizes ${sizes}`);

  const a = (await start()).body;
  await save(a, { status: 'excluded' });
  const b = (await start()).body;
  assert.equal(b.group, a.group, 'the excluded slot is reused');

  const demo = (await start({ demo: true })).body;
  assert.match(demo.participantId, /^DEMO/);
  const c = (await start()).body;
  assert.notEqual(c.participantId, demo.participantId);
  assert.match(c.participantId, /^P\d{3}$/);
});

test('only the browser holding the session token can save or use the tutor', async () => {
  const s = (await start({ group: 'standard' })).body;
  assert.equal((await save(s, {}, 'wrong-token')).status, 404);
  assert.equal((await save(s)).status, 200);

  const ask = (token, qid = 'p1') =>
    call('/tutor', { method: 'POST', token, body: { participantId: s.participantId, qid, level: 'full', planted: false, messages: [{ role: 'user', text: 'help' }] } });
  assert.equal((await ask('wrong-token')).status, 403);
  const reply = await ask(s.token);
  assert.equal(reply.status, 200);
  assert.equal(reply.body.source, 'mock');
  assert.match(reply.body.text, /Answer: \(A\)/);
  assert.equal((await ask(s.token, 's1')).status, 400, 'solo questions have no tutor');

  await save(s, { status: 'complete' });
  assert.equal((await ask(s.token)).status, 403, 'no tutor after the session ends');
});

test('a finished session cannot be overwritten, but its final save can be retried', async () => {
  const s = (await start({ group: 'standard' })).body;
  const finishedAt = new Date().toISOString();
  assert.equal((await save(s, { status: 'complete', finishedAt })).status, 200);
  assert.equal((await save(s, { status: 'complete', finishedAt })).status, 200, 'retry of the same final save');
  assert.equal((await save(s, { status: 'active' })).status, 409, 'stale snapshot');
  const row = (await call('/admin/sessions')).body.sessions.find((x) => x.participant_id === s.participantId);
  assert.equal(row.status, 'complete');
});

test('an abandoned session goes stale and frees its slot until it saves again', async () => {
  const a = (await start({ group: 'control' })).body;
  // Pretend the laptop went quiet two hours ago.
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  if (process.env.DATABASE_URL) {
    const { query } = await import('../server/db-postgres.js');
    await query('UPDATE sessions SET updated_at = $1 WHERE participant_id = $2', [twoHoursAgo, a.participantId]);
  } else {
    const { DatabaseSync } = await import('node:sqlite');
    const raw = new DatabaseSync(process.env.DB_PATH);
    raw.prepare('UPDATE sessions SET updated_at = ? WHERE participant_id = ?').run(twoHoursAgo, a.participantId);
    raw.close();
  }

  const status = async (id) => (await call('/admin/sessions')).body.sessions.find((x) => x.participant_id === id).status;
  assert.equal(await status(a.participantId), 'stale');
  const b = (await start({ group: 'control' })).body;
  assert.equal(b.blockOrder, a.blockOrder, 'the stale slot is reused');

  assert.equal((await save(a)).status, 200);
  assert.equal(await status(a.participantId), 'active', 'a save brings it back');
});

test('malformed snapshots get a 400, not a crash', async () => {
  const s = (await start({ group: 'standard' })).body;
  const put = (body) => call(`/sessions/${s.participantId}`, { method: 'PUT', body: { ...snapshot(s), ...body }, token: s.token });
  assert.equal((await put({ responses: undefined })).status, 400);
  assert.equal((await put({ status: 'hacked' })).status, 400);
  assert.equal((await put({ steps: [{ kind: 'question', section: 'warmup' }] })).status, 400, 'question step without qid');
  assert.equal((await put({ events: [{ type: 'x' }] })).status, 400, 'event without t');
  assert.equal((await put({})).status, 200);
});

test('saves only add new events and answers', async () => {
  const s = (await start({ group: 'control' })).body;
  const step = { kind: 'question', section: 'warmup', qid: 'w1', ai: false };
  const ev = (n) => Array.from({ length: n }, (_, i) => ({ t: i + 1, step: 0, type: `e${i}` }));
  await save(s, { steps: [step], events: ev(2) });
  await save(s, { steps: [step], events: ev(5), responses: { 0: { qid: 'w1', selected: 1, correct: false, timeMs: 5 } } });
  await save(s, { steps: [step], events: ev(6), responses: { 0: { qid: 'w1', selected: 1, correct: false, timeMs: 5 } } });

  const rows = (csv) => csv.replace(/^﻿/, '').split('\r\n').filter((line) => line.includes(s.participantId));
  assert.equal(rows((await call('/export/events.csv')).body).length, 6);
  assert.equal(rows((await call('/export/answers.csv')).body).length, 1);
});

test('CSV cells that look like formulas are escaped; unknown exports 404', async () => {
  const s = (await start({ group: 'control' })).body;
  const survey = { tlx: {}, likert: {}, noticedWrong: 'No', comments: '=HYPERLINK("http://x")' };
  await save(s, { steps: [{ kind: 'questionnaire' }], responses: { 0: survey }, startedAt: new Date().toISOString() });
  const csv = (await call('/export/participants.csv')).body;
  assert.ok(csv.includes(`"'=HYPERLINK(""http://x"")"`));
  assert.equal((await call('/export/constructor.csv')).status, 404);
});

test('saved sessions fill the tables; demo sessions stay out of exports', async () => {
  const real = (await start({ group: 'adaptive' })).body;
  const demo = (await start({ group: 'adaptive', demo: true })).body;
  const answered = {
    steps: [{ kind: 'question', section: 'warmup', qid: 'w1', ai: false }],
    responses: { 0: { qid: 'w1', selected: 2, correct: true, timeMs: 1000 } },
    events: [{ t: 1, step: 0, type: 'question_shown', qid: 'w1' }],
    status: 'complete',
    finishedAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
  };
  assert.equal((await save(real, answered)).status, 200);
  assert.equal((await save(demo, answered)).status, 200);

  const answers = (await call('/export/answers.csv')).body;
  assert.ok(answers.includes(real.participantId));
  assert.ok(!answers.includes(demo.participantId));

  const participants = (await call('/export/participants.csv')).body;
  const header = participants.replace(/^﻿/, '').split('\r\n')[0];
  for (const column of ['acc_warmup', 'planted_accept_rate_when_told', 'acc_transfer', 'mean_followup_gap_s']) {
    assert.ok(header.includes(column), `participants.csv has ${column}`);
  }
  assert.ok(!participants.includes(demo.participantId));
});
