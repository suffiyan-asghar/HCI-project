// The same API tests, run against Postgres (an in-memory PGlite) instead of SQLite,
// so the Supabase code path is covered too.
process.env.DATABASE_URL = 'pglite:memory';
await import('./server.test.js');
