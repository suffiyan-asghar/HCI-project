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
    <div className="card narrow">
      <p className="eyebrow">Researcher setup</p>
      <h1>Start a new session</h1>
      <p className="muted">Fill this in, then hand the laptop to the participant.</p>

      <form onSubmit={start} className="form">
        <label className="field">
          <span>Participant ID</span>
          <input value={participantId} onChange={(e) => setParticipantId(e.target.value)} required />
          {idTaken && <span className="warn">This ID already has saved data on this laptop.</span>}
        </label>

        <label className="field">
          <span>Group</span>
          <select value={groupChoice} onChange={(e) => setGroupChoice(e.target.value)}>
            <option value="auto">Auto-assign (alternates, keeps groups balanced)</option>
            <option value="standard">Standard tutor</option>
            <option value="adaptive">Adaptive tutor</option>
          </select>
        </label>

        <button className="btn primary" type="submit" disabled={!participantId.trim()}>
          Start session
        </button>
      </form>

      <div className="researcher-footer">
        <span>
          {completed.length} session{completed.length === 1 ? '' : 's'} saved on this laptop
        </span>
        <button
          className="btn link"
          type="button"
          disabled={completed.length === 0}
          onClick={() => downloadJson(`studybot-sessions-${Date.now()}.json`, completed)}
        >
          Download data
        </button>
      </div>
      <p className="tiny muted">During a session, press Ctrl+Shift+X to end it and return here.</p>
    </div>
  );
}
