import { useEffect, useState } from 'react';
import { checkResearcherKey, createSession } from '../lib/api';
import { buildSteps } from '../lib/session';
import { downloadJson, loadCompleted } from '../lib/storage';
import ResearcherLogin from './ResearcherLogin';

// Researcher-only screen: sets up a participant before handing over the laptop.
export default function StartScreen({ onStart }) {
  const [access, setAccess] = useState('checking'); // 'checking' | 'locked' | 'open' | 'offline'
  const [groupChoice, setGroupChoice] = useState('auto');
  const [demo, setDemo] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);
  const completed = loadCompleted();

  useEffect(() => {
    checkResearcherKey()
      .then(() => setAccess('open'))
      .catch((err) => setAccess(err.status === 401 ? 'locked' : 'offline'));
  }, []);

  async function start(e) {
    e.preventDefault();
    setStarting(true);
    setError(null);
    try {
      // The server hands out IDs and balances groups across all study laptops.
      const created = await createSession({ group: groupChoice === 'auto' ? null : groupChoice, demo });
      const { participantId, group, blockOrder, token } = created;
      onStart({
        participantId,
        token,
        group,
        blockOrder,
        demo: created.demo,
        steps: buildSteps(blockOrder, group, { demo: created.demo }),
        stepIndex: 0,
        responses: {},
        noAiResults: [],
        events: [{ t: Date.now(), step: 0, type: 'session_start', group, blockOrder, demo: created.demo }],
        status: 'active',
        startedAt: new Date().toISOString(),
      });
    } catch (err) {
      if (err.status === 401) setAccess('locked');
      else setError("Can't reach the study server. Check that it is running and this laptop is on the same Wi-Fi.");
      setStarting(false);
    }
  }

  return (
    <div className="panel narrow">
      <p className="kicker">Researcher</p>
      <h1>New session</h1>

      {access === 'checking' && <p className="secondary">Connecting to the study server…</p>}
      {access === 'offline' && (
        <p className="warn">Can't reach the study server. Check that it is running and this laptop is on the same Wi-Fi, then reload.</p>
      )}
      {access === 'locked' && <ResearcherLogin onDone={() => setAccess('open')} />}

      {access === 'open' && (
        <>
          <p className="secondary">Set this up, then hand the laptop to the participant.</p>
          <form onSubmit={start}>
            <div className="group">
              <label className="row">
                <span className="row-label">Group</span>
                <select value={groupChoice} onChange={(e) => setGroupChoice(e.target.value)}>
                  <option value="auto">Auto-assign</option>
                  <option value="standard">Standard</option>
                  <option value="adaptive">Adaptive</option>
                  <option value="control">No AI (control)</option>
                </select>
              </label>
              <label className="row check-row">
                <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
                <span>Demo session: a short run for the recording, never counted in the data</span>
              </label>
            </div>
            {error && <p className="warn">{error}</p>}
            <p className="footnote">
              The participant ID is assigned by the server. Auto-assign puts each person in the group with the fewest
              participants so far.
            </p>

            <div className="actions">
              <button className="btn primary" type="submit" disabled={starting}>
                {starting ? 'Starting…' : demo ? 'Start demo' : 'Start session'}
              </button>
            </div>
          </form>
        </>
      )}

      <div className="researcher-bar">
        <span>
          <a href="/admin">Researcher page</a> · Ctrl+Shift+X ends a session
        </span>
        <button
          className="btn plain"
          type="button"
          disabled={completed.length === 0}
          onClick={() => downloadJson(`studybot-backup-${Date.now()}.json`, completed)}
        >
          Local backup ({completed.length})
        </button>
      </div>
    </div>
  );
}
