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
