import { useSyncExternalStore } from 'react';

// Talks to the study server (server/index.js), which keeps all results in SQLite.
//
// Two kinds of credential: the researcher password (entered once per laptop, kept in this
// browser) for starting sessions and the /admin page, and a per-session token from the
// server that lets this browser save its own session and use the tutor.
const KEY_STORAGE = 'studybot.researcherKey';

export function getResearcherKey() {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export function setResearcherKey(key) {
  try {
    localStorage.setItem(KEY_STORAGE, key);
  } catch {
    // Blocked storage: the password just has to be entered again next time.
  }
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'x-researcher-key': getResearcherKey() };
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers['x-session-token'] = token;
  const res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new ApiError(res.status, `${res.status} ${res.statusText}`);
  return res.json();
}

export const createSession = ({ group, demo }) => request('/sessions', { method: 'POST', body: { group, demo } });
export const checkResearcherKey = () => request('/researcher/check');
export const fetchTutorReply = (token, body) => request('/tutor', { method: 'POST', body, token });
export const fetchAdmin = () => request('/admin/sessions');
export const exportUrl = (file) => `/api/export/${file}?key=${encodeURIComponent(getResearcherKey())}`;

// Session sync: the latest snapshot of each session is queued and sent one request at a
// time. The queue is per participant, so starting the next session never drops an
// unsent one, and it is kept in localStorage so it also survives a page reload.
// Network and server errors are retried; a 4xx rejection is not (it would fail forever)
// and is reported as 'rejected' so the researcher downloads the session instead.
const RETRY_MS = 5000;
const QUEUE_STORAGE = 'studybot.unsynced';
const pending = new Map(readQueue()); // participantId -> latest unsent snapshot
const statuses = new Map(); // participantId -> 'saving' | 'saved' | 'offline' | 'rejected'
let inFlight = false;
let retryTimer = null;
const listeners = new Set();

function readQueue() {
  try {
    return Object.entries(JSON.parse(localStorage.getItem(QUEUE_STORAGE) ?? '{}'));
  } catch {
    return [];
  }
}

function writeQueue() {
  try {
    localStorage.setItem(QUEUE_STORAGE, JSON.stringify(Object.fromEntries(pending)));
  } catch {
    // Storage full or blocked: the queue still works until the page is closed.
  }
}

function setStatus(id, next) {
  if (statuses.get(id) === next) return;
  statuses.set(id, next);
  listeners.forEach((fn) => fn());
}

function scheduleRetry() {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    flush();
  }, RETRY_MS);
}

async function flush() {
  if (inFlight) return;
  const next = pending.entries().next();
  if (next.done) return;
  const [id, session] = next.value;

  inFlight = true;
  setStatus(id, 'saving');
  let retry = false;
  try {
    await request(`/sessions/${encodeURIComponent(id)}`, { method: 'PUT', body: session, token: session.token });
    if (pending.get(id) === session) {
      pending.delete(id);
      setStatus(id, 'saved');
    }
  } catch (err) {
    if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
      if (pending.get(id) === session) pending.delete(id);
      setStatus(id, 'rejected');
      console.error(`[sync] server rejected session ${id}: ${err.message}`);
    } else {
      // Move it to the back so one unreachable save doesn't block the others, then wait.
      if (pending.get(id) === session) {
        pending.delete(id);
        pending.set(id, session);
      }
      setStatus(id, 'offline');
      retry = true;
    }
  } finally {
    inFlight = false;
    writeQueue();
  }
  if (retry) scheduleRetry();
  else flush();
}

export function syncSession(session) {
  const id = session.participantId;
  pending.delete(id); // re-insert so the newest snapshot keeps its place in line
  pending.set(id, session);
  writeQueue();
  if (statuses.get(id) !== 'offline') setStatus(id, 'saving');
  // While offline, wait for the scheduled retry instead of hitting the server on every click.
  if (!retryTimer) flush();
}

/** Sync state of one session. Sessions this tab never queued count as saved. */
export function useSyncStatus(participantId) {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => statuses.get(participantId) ?? (pending.has(participantId) ? 'saving' : 'saved'),
  );
}

// Snapshots left over from before a reload are sent straight away.
if (pending.size) flush();
