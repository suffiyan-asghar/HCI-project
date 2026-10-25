import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { backup, backupIfChanged, canUseTutor, createSession, DB_PATH, lastBackup, listSessions, saveSession, tableRows } from './db.js';
import { participantRows } from './export.js';
import { getQuestion, validateBank } from './questions.js';
import { STATUSES } from '../src/lib/constants.js';
import { tutorInfo, tutorReply, tutorStatus } from './tutor.js';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));
const LEVELS = ['guide', 'hint', 'full', 'more'];
const BACKUP_EVERY_MS = 10 * 60 * 1000;

function sameSecret(given, expected) {
  const a = Buffer.from(String(given ?? ''));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createApp({ password = process.env.RESEARCHER_PASSWORD } = {}) {
  validateBank();
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // Researcher-only routes need RESEARCHER_PASSWORD, sent as a header (or ?key= for downloads).
  // Without a password set, they are open, which is fine for development only.
  const researcher = (req, res, next) => {
    if (!password || sameSecret(req.get('x-researcher-key') ?? req.query.key, password)) return next();
    res.status(401).json({ error: 'Researcher password required' });
  };

  app.get('/api/health', (req, res) => res.json({ ok: true, passwordRequired: Boolean(password), tutor: tutorInfo }));

  app.get('/api/researcher/check', researcher, (req, res) => res.json({ ok: true }));

  app.post('/api/sessions', researcher, (req, res) => {
    res.json(createSession({ group: req.body?.group, demo: req.body?.demo === true }));
  });

  // Participant routes are authorised by the session's own token (from createSession).
  app.put('/api/sessions/:id', (req, res) => {
    const problem = sessionProblem(req.body, req.params.id);
    if (problem) return res.status(400).json({ error: `Malformed session: ${problem}` });

    const result = saveSession(req.body, req.get('x-session-token'), getQuestion);
    if (result === 'unknown') return res.status(404).json({ error: 'Unknown session or wrong token' });
    if (result === 'finished') return res.status(409).json({ error: 'Session already finished' });
    res.json({ ok: true });
  });

  app.post('/api/tutor', async (req, res) => {
    const { participantId, qid, level, planted, messages } = req.body ?? {};
    if (!canUseTutor(participantId, req.get('x-session-token'))) return res.status(403).json({ error: 'No active session' });
    const question = getQuestion(qid);
    if (!question || question.plantedWrong === undefined || !LEVELS.includes(level) || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Bad tutor request' });
    }
    res.json(await tutorReply({ question, level, planted: !!planted, messages }));
  });

  app.get('/api/admin/sessions', researcher, (req, res) => {
    res.json({
      tutor: tutorStatus(),
      database: DB_PATH,
      lastBackup: lastBackup(),
      sessions: listSessions().map(({ session, ...row }) => ({
        ...row,
        progress: session ? `${session.stepIndex} / ${session.steps.length}` : '—',
        startedAt: session?.startedAt ?? row.created_at,
      })),
    });
  });

  // CSV exports for R / Excel. participants.csv has one row per person with summary scores.
  const exports = {
    participants: () => participantRows(listSessions().filter((s) => !s.demo), getQuestion),
    answers: () => tableRows('answers'),
    chat: () => tableRows('chat_messages'),
    events: () => tableRows('events'),
  };

  app.get('/api/export/:name.csv', researcher, (req, res) => {
    if (!Object.hasOwn(exports, req.params.name)) return res.status(404).end();
    const build = exports[req.params.name];
    res.attachment(`studybot-${req.params.name}.csv`).type('text/csv').send(toCsv(build()));
  });

  app.get('/api/export/database.sqlite', researcher, (req, res) => {
    res.download(backup(), 'studybot.sqlite');
  });

  // The built app (npm run build). Any other path gets index.html so /admin works.
  if (existsSync(DIST)) {
    app.use(express.static(DIST));
    app.use((req, res) => res.sendFile('index.html', { root: DIST }));
  }
  return app;
}

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

// Checks the shape saveSession relies on, so a bad body gets a 400 instead of a crash.
function sessionProblem(session, id) {
  if (!isObject(session) || session.participantId !== id) return 'participant ID';
  if (!STATUSES.includes(session.status ?? 'active')) return 'status';
  if (!Array.isArray(session.steps) || !session.steps.every(isObject)) return 'steps';
  if (!isObject(session.responses)) return 'responses';
  if (!Array.isArray(session.events) || !session.events.every((e) => isObject(e) && typeof e.t === 'number' && typeof e.type === 'string')) {
    return 'events';
  }
  const badStep = session.steps.findIndex((step, i) => {
    if (step.kind !== 'question') return false;
    if (typeof step.qid !== 'string' || !getQuestion(step.qid)) return true;
    const r = session.responses[i];
    if (r === undefined) return false;
    if (!isObject(r)) return true;
    return r.messages !== undefined && !(Array.isArray(r.messages) && r.messages.every((m) => isObject(m) && typeof m.text === 'string'));
  });
  return badStep === -1 ? null : `step ${badStep}`;
}

function toCsv(rows) {
  if (rows.length === 0) return '';
  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v) => {
    if (v === null || v === undefined) return '';
    let s = String(v);
    // Free text (comments, chat) that looks like a formula would run in Excel, so it gets a
    // leading '. "- " bullets in tutor replies are left alone: Excel doesn't run those.
    if (typeof v === 'string' && /^(?:[=@\t\r]|[+-](?!\s))/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // The BOM makes Excel read the file as UTF-8, so emojis in chat survive.
  return '﻿' + [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\r\n');
}

// Started directly (npm start / npm run server), not imported by the tests.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT) || 3000;
  createApp().listen(port, '0.0.0.0', () => {
    const lan = Object.values(networkInterfaces())
      .flat()
      .filter((i) => i.family === 'IPv4' && !i.internal)
      .map((i) => `http://${i.address}:${port}`);
    console.log(`StudyBot server on port ${port}`);
    console.log(`  Study laptops open: ${lan.join('  ') || `http://localhost:${port}`}`);
    console.log(`  Researcher page:    /admin`);
    console.log(`  Database:           ${DB_PATH} (backed up every 10 minutes to data/backups)`);
    console.log(`  Tutor:              ${tutorInfo.mode}${tutorInfo.model ? ` (${tutorInfo.model})` : ' (canned replies; set GROQ_API_KEY for live)'}`);
    if (!process.env.RESEARCHER_PASSWORD) console.log('  WARNING: RESEARCHER_PASSWORD is not set, so /admin and starting sessions are open to anyone on the network.');
    if (!existsSync(DIST)) console.log('  No build found: run "npm run build", or use "npm run dev" for development.');
  });
  setInterval(backupIfChanged, BACKUP_EVERY_MS).unref();
}
