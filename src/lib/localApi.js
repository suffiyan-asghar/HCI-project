import { mockReply } from '../../server/mockTutor.js';
import { GROUPS } from './constants';
import { getQuestion } from './session';
import { loadActive, loadCompleted } from './storage';

// Stand-ins for the study server in the frontend-only demo build (npm run build:static).
// Sessions stay in this browser's storage (lib/storage.js) and the tutor gives the canned
// replies, since an AI key can't be shipped to the browser.
const COUNTER = 'studybot.localCount';

function nextNumber() {
  try {
    const n = Number(localStorage.getItem(COUNTER) ?? 0) + 1;
    localStorage.setItem(COUNTER, String(n));
    return n;
  } catch {
    return 1;
  }
}

export async function createSession({ group, demo }) {
  const n = nextNumber();
  return {
    participantId: demo ? `DEMO${n}` : `P${String(n).padStart(3, '0')}`,
    // Auto-assign rotates through the groups; the block order cycles once per full rotation.
    group: GROUPS.includes(group) ? group : GROUPS[(n - 1) % GROUPS.length],
    blockOrder: Math.floor((n - 1) / GROUPS.length) % 3,
    token: 'local',
    demo: !!demo,
  };
}

export const checkResearcherKey = async () => ({ ok: true });

export async function fetchTutorReply(_token, { qid, level, planted }) {
  // A short pause so the typing indicator shows, as it would with a live reply.
  await new Promise((resolve) => setTimeout(resolve, 700));
  return { text: mockReply({ question: getQuestion(qid), level, planted }), source: 'mock' };
}

export async function fetchAdmin() {
  const active = loadActive();
  const all = [...loadCompleted().filter((s) => s.participantId !== active?.participantId), ...(active ? [active] : [])];
  return {
    sessions: all.map((s) => ({
      participant_id: s.participantId,
      grp: s.group,
      block_order: s.blockOrder,
      status: s.status,
      demo: s.demo ? 1 : 0,
      created_at: s.startedAt,
      updated_at: s.finishedAt ?? new Date(s.events.at(-1)?.t ?? Date.now()).toISOString(),
      finished_at: s.finishedAt ?? null,
      progress: `${s.stepIndex} / ${s.steps.length}`,
      startedAt: s.startedAt,
    })),
  };
}
