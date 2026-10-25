import { randomBytes } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

export const DB_PATH = process.env.DB_PATH || fileURLToPath(new URL('../data/studybot.sqlite', import.meta.url));
const BACKUP_DIR = join(dirname(DB_PATH), 'backups');
const KEEP_BACKUPS = 40;
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;

  -- One row per participant. "data" is the full session snapshot from the browser;
  -- the other tables are rebuilt from it on every save so they can be queried directly.
  -- "token" is a per-session secret: only the browser that started the session can write to it.
  -- Demo sessions (for the recording) never count towards group balance or appear in exports.
  CREATE TABLE IF NOT EXISTS sessions (
    seq            INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id TEXT NOT NULL UNIQUE,
    grp            TEXT NOT NULL,
    block_order    INTEGER NOT NULL,
    status         TEXT NOT NULL,
    demo           INTEGER NOT NULL DEFAULT 0,
    token          TEXT NOT NULL,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL,
    finished_at    TEXT,
    data           TEXT
  );

  -- One row per answered question.
  CREATE TABLE IF NOT EXISTS answers (
    participant_id      TEXT NOT NULL,
    step                INTEGER NOT NULL,
    section             TEXT NOT NULL,
    round               INTEGER,
    block               TEXT,
    qid                 TEXT NOT NULL,
    question_type       TEXT,
    retest              TEXT,
    source_round        INTEGER,
    selected            INTEGER,
    correct             INTEGER,
    time_ms             INTEGER,
    ai                  INTEGER,
    planted             INTEGER,
    asked_ai            INTEGER,
    tried_before_asking INTEGER,
    no_idea             INTEGER,
    levels_shown        TEXT,
    ai_stated_answer    INTEGER,
    matched_ai          INTEGER,
    accepted_wrong_ai   INTEGER,
    source_answer       TEXT,
    PRIMARY KEY (participant_id, step)
  );

  -- "source" is live / mock / fallback; "note" says why a live reply was retried or replaced.
  CREATE TABLE IF NOT EXISTS chat_messages (
    participant_id TEXT NOT NULL,
    step           INTEGER NOT NULL,
    qid            TEXT NOT NULL,
    idx            INTEGER NOT NULL,
    role           TEXT NOT NULL,
    level          TEXT,
    source         TEXT,
    note           TEXT,
    text           TEXT NOT NULL,
    t              INTEGER,
    PRIMARY KEY (participant_id, step, idx)
  );

  CREATE TABLE IF NOT EXISTS events (
    participant_id TEXT NOT NULL,
    idx            INTEGER NOT NULL,
    t              INTEGER NOT NULL,
    step           INTEGER,
    type           TEXT NOT NULL,
    data           TEXT,
    PRIMARY KEY (participant_id, idx)
  );
`);

const GROUPS = ['standard', 'adaptive', 'control'];
// Sessions that count towards group balance. Excluded, aborted and demo ones don't.
const COUNTED = "demo = 0 AND status NOT IN ('excluded', 'aborted')";
let changedSinceBackup = false;

function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    changedSinceBackup = true;
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// node:sqlite binds only null, numbers, strings and buffers.
const bool = (v) => (v === true ? 1 : v === false ? 0 : null);
const num = (v) => (typeof v === 'number' ? v : null);
const str = (v) => (v === undefined || v === null ? null : String(v));

/**
 * Allocates the next participant ID and assigns a group: the one with the fewest
 * counted sessions (ties broken in GROUPS order), unless the researcher picked one.
 * The block order cycles within each group so orders stay balanced per group.
 */
export function createSession({ group: groupChoice, demo = false } = {}) {
  return transaction(() => {
    const counts = Object.fromEntries(GROUPS.map((g) => [g, 0]));
    for (const row of db.prepare(`SELECT grp, COUNT(*) AS n FROM sessions WHERE ${COUNTED} GROUP BY grp`).all()) {
      counts[row.grp] = row.n;
    }
    const group = GROUPS.includes(groupChoice) ? groupChoice : GROUPS.reduce((a, b) => (counts[b] < counts[a] ? b : a));
    const blockOrder = counts[group] % 3;

    const now = new Date().toISOString();
    const { seq } = db.prepare('SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM sessions').get();
    const { demos } = db.prepare('SELECT COUNT(*) AS demos FROM sessions WHERE demo = 1').get();
    const participantId = demo ? `DEMO${demos + 1}` : `P${String(seq - demos).padStart(3, '0')}`;
    const token = randomBytes(18).toString('base64url');
    db.prepare(
      `INSERT INTO sessions (seq, participant_id, grp, block_order, status, demo, token, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
    ).run(seq, participantId, group, blockOrder, demo ? 1 : 0, token, now, now);
    return { participantId, group, blockOrder, token, demo };
  });
}

/** True when the token belongs to this participant and the session is still running. */
export function canUseTutor(participantId, token) {
  const row = db.prepare('SELECT status FROM sessions WHERE participant_id = ? AND token = ?').get(str(participantId), str(token));
  return row?.status === 'active';
}

const insertAnswer = db.prepare(`
  INSERT INTO answers VALUES (
    :participant_id, :step, :section, :round, :block, :qid, :question_type, :retest, :source_round,
    :selected, :correct, :time_ms, :ai, :planted, :asked_ai, :tried_before_asking, :no_idea,
    :levels_shown, :ai_stated_answer, :matched_ai, :accepted_wrong_ai, :source_answer
  )`);
const insertMessage = db.prepare('INSERT INTO chat_messages VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
const insertEvent = db.prepare('INSERT INTO events VALUES (?, ?, ?, ?, ?, ?)');

/** Stores a full session snapshot and rebuilds its rows in the derived tables. */
export function saveSession(session, token, getQuestion) {
  const id = session.participantId;
  const { token: _secret, ...data } = session;
  return transaction(() => {
    const result = db
      .prepare(
        `UPDATE sessions SET status = ?, updated_at = ?, finished_at = ?, data = ?
         WHERE participant_id = ? AND grp = ? AND token = ?`,
      )
      .run(str(session.status) ?? 'active', new Date().toISOString(), str(session.finishedAt), JSON.stringify(data), str(id), str(session.group), str(token));
    if (result.changes === 0) return false;

    for (const table of ['answers', 'chat_messages', 'events']) {
      db.prepare(`DELETE FROM ${table} WHERE participant_id = ?`).run(id);
    }

    session.steps.forEach((step, i) => {
      const r = session.responses[i];
      if (step.kind !== 'question' || !r) return;
      insertAnswer.run({
        participant_id: id,
        step: i,
        section: step.section,
        round: num(step.round),
        block: str(step.block),
        qid: step.qid,
        question_type: str(getQuestion(step.qid)?.type),
        retest: str(step.retest),
        source_round: num(step.sourceRound),
        selected: num(r.selected),
        correct: bool(r.correct),
        time_ms: num(r.timeMs),
        ai: bool(step.ai),
        planted: bool(r.planted),
        asked_ai: bool(r.askedAI),
        tried_before_asking: bool(r.triedBeforeAsking),
        no_idea: bool(r.noIdea),
        levels_shown: r.levelsShown ? r.levelsShown.join('>') : null,
        ai_stated_answer: num(r.aiStatedAnswer),
        matched_ai: bool(r.matchedAI),
        accepted_wrong_ai: bool(r.acceptedWrongAI),
        source_answer: str(r.sourceAnswer),
      });
      (r.messages ?? []).forEach((m, idx) =>
        insertMessage.run(id, i, step.qid, idx, m.role, str(m.level), str(m.source), str(m.note), m.text, num(m.t)),
      );
    });

    session.events.forEach(({ t, step, type, ...rest }, idx) =>
      insertEvent.run(id, idx, t, num(step), type, Object.keys(rest).length ? JSON.stringify(rest) : null),
    );
    return true;
  });
}

export function listSessions() {
  return db
    .prepare('SELECT participant_id, grp, block_order, status, demo, created_at, updated_at, finished_at, data FROM sessions ORDER BY seq')
    .all()
    .map(({ data, ...row }) => ({ ...row, session: data ? JSON.parse(data) : null }));
}

/** Rows of a derived table, without demo sessions. */
export const tableRows = (table) =>
  db
    .prepare(
      `SELECT t.* FROM ${table} t JOIN sessions s USING (participant_id)
       WHERE s.demo = 0 ORDER BY s.seq, t.rowid`,
    )
    .all();

/** Writes a consistent copy of the whole database, keeps the newest few, and returns its path. */
export function backup() {
  const path = join(BACKUP_DIR, `studybot-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`);
  mkdirSync(BACKUP_DIR, { recursive: true });
  db.prepare('VACUUM INTO ?').run(path);
  changedSinceBackup = false;
  const old = readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.sqlite')).sort().slice(0, -KEEP_BACKUPS);
  old.forEach((f) => rmSync(join(BACKUP_DIR, f)));
  return path;
}

/** Backs up only if something was saved since the last backup. */
export const backupIfChanged = () => (changedSinceBackup ? backup() : null);

export function lastBackup() {
  try {
    return readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.sqlite')).sort().at(-1) ?? null;
  } catch {
    return null;
  }
}
