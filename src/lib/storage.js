// Until the server exists (build step 5), sessions are kept in this browser's localStorage.
const ACTIVE = 'studybot.active';
const COMPLETED = 'studybot.completed';
const COUNTER = 'studybot.counter';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the session still runs, it just won't survive a refresh.
  }
}

export const loadActive = () => read(ACTIVE, null);
export const saveActive = (session) => write(ACTIVE, session);
export function clearActive() {
  try {
    localStorage.removeItem(ACTIVE);
  } catch {
    // ignore
  }
}

export const loadCompleted = () => read(COMPLETED, []);
export function archive(session) {
  const others = loadCompleted().filter((s) => s.participantId !== session.participantId);
  write(COMPLETED, [...others, session]);
}

export const peekCounter = () => read(COUNTER, 0);
export function takeCounter() {
  const n = peekCounter();
  write(COUNTER, n + 1);
  return n;
}

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
