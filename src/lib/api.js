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

// Session sync: the latest snapshot is sent whenever the session changes, one request at
// a time. If the server can't be reached it keeps retrying; the browser's own copy
// (storage.js) still survives a refresh in the meantime.
const RETRY_MS = 5000;
let latest = null;
let inFlight = false;
let retryTimer = null;
let status = 'saved'; // 'saved' | 'saving' | 'offline'
const listeners = new Set();

function setStatus(next) {
  if (next === status) return;
  status = next;
  listeners.forEach((fn) => fn());
}

async function flush() {
  if (inFlight || !latest) return;
  const session = latest;
  inFlight = true;
  setStatus('saving');
  try {
    await request(`/sessions/${encodeURIComponent(session.participantId)}`, { method: 'PUT', body: session, token: session.token });
    if (latest === session) latest = null;
    setStatus(latest ? 'saving' : 'saved');
  } catch {
    setStatus('offline');
    clearTimeout(retryTimer);
    retryTimer = setTimeout(flush, RETRY_MS);
  } finally {
    inFlight = false;
  }
  if (latest && status !== 'offline') flush();
}

export function syncSession(session) {
  latest = session;
  if (status !== 'offline') flush();
}

export function useSyncStatus() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => status,
    () => status,
  );
}
