// Setup check for the server laptop: `npm run check`. Uses a throwaway database, so it
// never touches the study data.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let failed = false;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.log(`  ! ${msg}`);
const fail = (msg) => {
  failed = true;
  console.log(`  ✗ ${msg}`);
};

console.log('StudyBot setup check\n');

const [major, minor] = process.versions.node.split('.').map(Number);
if (major > 22 || (major === 22 && minor >= 13)) ok(`Node ${process.versions.node}`);
else fail(`Node ${process.versions.node} is too old: install Node 22.13 or newer (Node 24 LTS recommended)`);

const dir = mkdtempSync(join(tmpdir(), 'studybot-check-'));
process.env.DB_PATH = join(dir, 'check.sqlite');

try {
  const { validateBank, getQuestion } = await import('../server/questions.js');
  const bank = validateBank();
  ok(`Question bank: ${bank.questions.length} questions, ${Object.keys(bank.blocks).length} blocks, ${bank.spares?.length ?? 0} spares`);

  const db = await import('../server/db.js');
  const created = db.createSession({});
  const saved = db.saveSession(
    { participantId: created.participantId, group: created.group, status: 'active', steps: [], responses: {}, events: [] },
    created.token,
    getQuestion,
  );
  db.backup();
  if (saved) ok('Database: create, save and backup work');
  else fail('Database: saving a session failed');

  if (process.env.RESEARCHER_PASSWORD) ok('RESEARCHER_PASSWORD is set');
  else warn('RESEARCHER_PASSWORD is not set: anyone on the Wi-Fi could open /admin. Add it to .env');

  const { tutorInfo, tutorReply } = await import('../server/tutor.js');
  if (tutorInfo.mode !== 'live') {
    warn('No GROQ_API_KEY in .env: the tutor will use canned replies');
  } else {
    const started = Date.now();
    const reply = await tutorReply({
      question: getQuestion(bank.blocks.A.practice[0]),
      level: 'full',
      planted: false,
      messages: [{ role: 'user', text: 'Can you help me with this question?' }],
    });
    if (reply.source === 'live') ok(`Groq tutor (${tutorInfo.model}) replied in ${Date.now() - started} ms`);
    else fail(`Groq tutor failed (${reply.note}); participants would get canned replies`);
  }
} catch (err) {
  fail(err.message);
} finally {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Windows can keep the open database file locked; the temp folder is harmless.
  }
}

console.log(failed ? '\nFix the ✗ items above before running the study.' : '\nAll good. Start the study with: npm start');
process.exit(failed ? 1 : 0);
