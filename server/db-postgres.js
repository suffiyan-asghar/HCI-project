import { randomBytes } from 'node:crypto';
import { GROUPS } from '../src/lib/constants.js';

// The same tables and rules as db-sqlite.js, in Postgres (Supabase in production).
// DATABASE_URL=pglite:memory runs an in-memory Postgres instead, for the tests.
const URL_ = process.env.DATABASE_URL;
export const DB_PATH = URL_.startsWith('pglite:') ? 'PGlite (in memory)' : `Postgres at ${new URL(URL_).hostname}`;

// Each backend gives: query(sql, params) -> rows, and transaction(fn), where fn gets a query.
async function connect() {
  if (URL_.startsWith('pglite:')) {
    const { PGlite } = await import('@electric-sql/pglite');
    const pg = new PGlite();
    const wrap = (c) => async (sql, params) => (await c.query(sql, params)).rows;
    return { query: wrap(pg), transaction: (fn) => pg.transaction((tx) => fn(wrap(tx))) };
  }
  const { default: pg } = await import('pg');
  // Supabase needs SSL; its certificate chain isn't in Node's store, so don't verify it.
  // sslmode in the URL would override this, so it is dropped.
  const url = new URL(URL_);
  url.searchParams.delete('sslmode');
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  // Serverless functions each hold a pool, so keep it small; Supabase's pooler does the rest.
  const pool = new pg.Pool({ connectionString: url.href, ssl: local ? false : { rejectUnauthorized: false }, max: 3 });
  const wrap = (c) => async (sql, params) => (await c.query(sql, params)).rows;
  return {
    query: wrap(pool),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(wrap(client));
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

// Row level security with no policies: only this server's database login can read or write.
// Without it, Supabase's public REST API would expose participant data to anyone with the anon key.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS sessions (
    seq            INTEGER PRIMARY KEY,
    participant_id TEXT NOT NULL UNIQUE,
    grp            TEXT NOT NULL,
    block_order    INTEGER NOT NULL,
    status         TEXT NOT NULL,
    demo           INTEGER NOT NULL DEFAULT 0,
    token          TEXT NOT NULL,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL,
    finished_at    TEXT,
    data           JSONB
  );
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
    time_ms             BIGINT,
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
    t              BIGINT,
    PRIMARY KEY (participant_id, step, idx)
  );
  CREATE TABLE IF NOT EXISTS events (
    participant_id TEXT NOT NULL,
    idx            INTEGER NOT NULL,
    t              BIGINT NOT NULL,
    step           INTEGER,
    type           TEXT NOT NULL,
    data           TEXT,
    PRIMARY KEY (participant_id, idx)
  );
  ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
  ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
  ALTER TABLE events ENABLE ROW LEVEL SECURITY;
`;

// Advisory lock keys: one serialises schema setup across cold starts, one participant IDs.
const SCHEMA_LOCK = 724001;
const CREATE_LOCK = 724002;

let ready;
function database() {
  ready ??= (async () => {
    const db = await connect();
    await db.transaction(async (q) => {
      await q('SELECT pg_advisory_xact_lock($1)', [SCHEMA_LOCK]);
      for (const statement of SCHEMA.split(';').map((s) => s.trim()).filter(Boolean)) await q(statement);
    });
    return db;
  })().catch((err) => {
    ready = null; // try again on the next request
    throw err;
  });
  return ready;
}

export const STALE_AFTER_MS = 60 * 60 * 1000;
const staleCutoff = () => new Date(Date.now() - STALE_AFTER_MS).toISOString();
export const isStale = (row) => row.status === 'active' && row.updated_at < staleCutoff();
const COUNTED = "demo = 0 AND status NOT IN ('excluded', 'aborted') AND NOT (status = 'active' AND updated_at < $1)";

const bool = (v) => (v === true ? 1 : v === false ? 0 : null);
const num = (v) => (typeof v === 'number' ? v : null);
const str = (v) => (v === undefined || v === null ? null : String(v));

/** See db-sqlite.js: next participant ID, least-filled group, block order cycling per group. */
export async function createSession({ group: groupChoice, demo = false } = {}) {
  const db = await database();
  return db.transaction(async (q) => {
    await q('SELECT pg_advisory_xact_lock($1)', [CREATE_LOCK]);
    const counts = Object.fromEntries(GROUPS.map((g) => [g, 0]));
    for (const row of await q(`SELECT grp, COUNT(*)::int AS n FROM sessions WHERE ${COUNTED} GROUP BY grp`, [staleCutoff()])) {
      counts[row.grp] = row.n;
    }
    const group = GROUPS.includes(groupChoice) ? groupChoice : GROUPS.reduce((a, b) => (counts[b] < counts[a] ? b : a));
    const blockOrder = counts[group] % 3;

    const now = new Date().toISOString();
    const [{ seq }] = await q('SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM sessions');
    const [{ demos }] = await q('SELECT COUNT(*)::int AS demos FROM sessions WHERE demo = 1');
    const participantId = demo ? `DEMO${demos + 1}` : `P${String(seq - demos).padStart(3, '0')}`;
    const token = randomBytes(18).toString('base64url');
    await q(
      `INSERT INTO sessions (seq, participant_id, grp, block_order, status, demo, token, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, $7)`,
      [seq, participantId, group, blockOrder, demo ? 1 : 0, token, now],
    );
    return { participantId, group, blockOrder, token, demo };
  });
}

export async function canUseTutor(participantId, token) {
  const db = await database();
  const [row] = await db.query('SELECT status FROM sessions WHERE participant_id = $1 AND token = $2', [str(participantId), str(token)]);
  return row?.status === 'active';
}

const ANSWER_COLUMNS = 22;
const placeholders = (n) => Array.from({ length: n }, (_, i) => `$${i + 1}`).join(', ');

/** See db-sqlite.js: returns 'saved', 'unknown' or 'finished', and inserts only new rows. */
export async function saveSession(session, token, getQuestion) {
  const id = session.participantId;
  const { token: _secret, ...data } = session;
  const db = await database();
  return db.transaction(async (q) => {
    // FOR UPDATE: two saves of the same session can't interleave their inserts.
    const [row] = await q('SELECT finished_at FROM sessions WHERE participant_id = $1 AND grp = $2 AND token = $3 FOR UPDATE', [
      str(id),
      str(session.group),
      str(token),
    ]);
    if (!row) return 'unknown';
    if (row.finished_at) return session.finishedAt === row.finished_at ? 'saved' : 'finished';

    await q('UPDATE sessions SET status = $1, updated_at = $2, finished_at = $3, data = $4::jsonb WHERE participant_id = $5', [
      str(session.status) ?? 'active',
      new Date().toISOString(),
      str(session.finishedAt),
      JSON.stringify(data),
      str(id),
    ]);

    const savedSteps = new Set((await q('SELECT step FROM answers WHERE participant_id = $1', [id])).map((r) => r.step));
    for (const [i, step] of session.steps.entries()) {
      const r = session.responses[i];
      if (step.kind !== 'question' || !r || savedSteps.has(i)) continue;
      await q(`INSERT INTO answers VALUES (${placeholders(ANSWER_COLUMNS)})`, [
        id,
        i,
        step.section,
        num(step.round),
        str(step.block),
        step.qid,
        str(getQuestion(step.qid)?.type),
        str(step.retest),
        num(step.sourceRound),
        num(r.selected),
        bool(r.correct),
        num(r.timeMs),
        bool(step.ai),
        bool(r.planted),
        bool(r.askedAI),
        bool(r.triedBeforeAsking),
        bool(r.noIdea),
        r.levelsShown ? r.levelsShown.join('>') : null,
        num(r.aiStatedAnswer),
        bool(r.matchedAI),
        bool(r.acceptedWrongAI),
        str(r.sourceAnswer),
      ]);
      for (const [idx, m] of (r.messages ?? []).entries()) {
        await q(`INSERT INTO chat_messages VALUES (${placeholders(10)})`, [
          id, i, step.qid, idx, m.role, str(m.level), str(m.source), str(m.note), m.text, num(m.t),
        ]);
      }
    }

    const [{ saved }] = await q('SELECT COUNT(*)::int AS saved FROM events WHERE participant_id = $1', [id]);
    for (const [i, { t, step, type, ...rest }] of session.events.slice(saved).entries()) {
      await q(`INSERT INTO events VALUES (${placeholders(6)})`, [
        id, saved + i, t, num(step), type, Object.keys(rest).length ? JSON.stringify(rest) : null,
      ]);
    }
    return 'saved';
  });
}

export async function listSessions() {
  const db = await database();
  const rows = await db.query(
    'SELECT participant_id, grp, block_order, status, demo, created_at, updated_at, finished_at, data FROM sessions ORDER BY seq',
  );
  return rows.map(({ data, ...row }) => ({ ...row, status: isStale(row) ? 'stale' : row.status, session: data ?? null }));
}

// Postgres has no rowid, so rows come out in primary key order.
const ORDER = { answers: 't.step', chat_messages: 't.step, t.idx', events: 't.idx' };

export async function tableRows(table) {
  if (!Object.hasOwn(ORDER, table)) throw new Error(`Unknown table ${table}`);
  const db = await database();
  return db.query(`SELECT t.* FROM ${table} t JOIN sessions s USING (participant_id) WHERE s.demo = 0 ORDER BY s.seq, ${ORDER[table]}`);
}

/** Raw SQL, for the tests. */
export async function query(sql, params) {
  return (await database()).query(sql, params);
}

// Supabase backs the database up itself.
export const backupIfChanged = () => null;
export const lastBackup = () => null;
