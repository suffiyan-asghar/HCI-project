import { useState } from 'react';
import { buildSteps } from '../lib/session';
import { downloadJson, loadCompleted, peekCounter, takeCounter } from '../lib/storage';

// Researcher-only screen: sets up a participant before handing over the laptop.
export default function StartScreen({ onStart }) {
  const [participantId, setParticipantId] = useState(() => `P${String(peekCounter() + 1).padStart(3, '0')}`);
  const [groupChoice, setGroupChoice] = useState('auto');
  const completed = loadCompleted();
  const idTaken = completed.some((s) => s.participantId === participantId.trim());

  function start(e) {
    e.preventDefault();
    const counter = takeCounter();
    // Auto mode alternates groups, and each group cycles through the three block orders.
    const group = groupChoice === 'auto' ? (counter % 2 === 0 ? 'standard' : 'adaptive') : groupChoice;
    const blockOrder = Math.floor(counter / 2) % 3;
    onStart({
      participantId: participantId.trim(),
      group,
      blockOrder,
      steps: buildSteps(blockOrder),
      stepIndex: 0,
      responses: {},
      noAiResults: [],
      events: [{ t: Date.now(), step: 0, type: 'session_start', group, blockOrder }],
      status: 'active',
      startedAt: new Date().toISOString(),
    });
  }

  return (
    <div className="panel narrow">
      <p className="kicker">Researcher</p>
      <h1>New session</h1>
      <p className="secondary">Set this up, then hand the laptop to the participant.</p>

      <form onSubmit={start}>
        <div className="group">
          <label className="row">
            <span className="row-label">Participant ID</span>
            <input value={participantId} onChange={(e) => setParticipantId(e.target.value)} required spellCheck="false" />
          </label>
          <label className="row">
            <span className="row-label">Group</span>
            <select value={groupChoice} onChange={(e) => setGroupChoice(e.target.value)}>
              <option value="auto">Auto-assign</option>
              <option value="standard">Standard</option>
              <option value="adaptive">Adaptive</option>
            </select>
          </label>
        </div>
        {idTaken && <p className="warn">This ID already has saved data on this laptop.</p>}
        <p className="footnote">Auto-assign alternates groups so they stay balanced.</p>

        <div className="actions">
          <button className="btn primary" type="submit" disabled={!participantId.trim()}>
            Start session
          </button>
        </div>
      </form>

      <div className="researcher-bar">
        <span>
          {completed.length} session{completed.length === 1 ? '' : 's'} saved on this laptop · Ctrl+Shift+X ends a session
        </span>
        <button
          className="btn plain"
          type="button"
          disabled={completed.length === 0}
          onClick={() => downloadJson(`studybot-sessions-${Date.now()}.json`, completed)}
        >
          Download data
        </button>
      </div>
    </div>
  );
}
