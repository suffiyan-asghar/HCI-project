// Picks the database: Postgres (e.g. Supabase) when DATABASE_URL is set, otherwise the
// SQLite file on this machine. Both export the same functions; callers await them.
const db = process.env.DATABASE_URL ? await import('./db-postgres.js') : await import('./db-sqlite.js');

export const { DB_PATH, STALE_AFTER_MS, isStale, createSession, canUseTutor, saveSession, listSessions, tableRows, backupIfChanged, lastBackup } = db;
// Only the SQLite database can be downloaded as a single file; Supabase keeps its own backups.
export const backup = db.backup ?? null;
