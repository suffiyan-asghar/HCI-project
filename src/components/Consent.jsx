import { useState } from 'react';

export default function Consent({ onComplete }) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="card narrow">
      <h1>Welcome to the StudyBot study</h1>
      <p>
        We are studying how students work with an AI tutor on verbal reasoning questions. This is part of a
        Human-Computer Interaction course project.
      </p>
      <ul className="plain-list">
        <li>⏱️ It takes about <strong>30 minutes</strong>.</li>
        <li>📝 You will answer 28 GRE-style questions. On some of them, an AI tutor called StudyBot can help you.</li>
        <li>🔒 Your answers are stored under a participant ID only. We do not record your name.</li>
        <li>✋ Taking part is voluntary. You can stop at any time without giving a reason. Just tell the researcher.</li>
        <li>💬 Some details of the study will be explained at the end.</li>
      </ul>

      <label className="check">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>I have read the information above and agree to take part.</span>
      </label>

      <div className="actions">
        <button className="btn primary" disabled={!agreed} onClick={() => onComplete({ consent: true, at: new Date().toISOString() })}>
          Continue
        </button>
      </div>
    </div>
  );
}
