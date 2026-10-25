import { useState } from 'react';

const FACTS = [
  ['Time', 'About 35 minutes'],
  ['What you do', 'Answer GRE-style verbal questions. Depending on your group, an AI tutor called StudyBot may help on some of them.'],
  ['Privacy', 'Answers are stored under a participant ID. We never record your name.'],
  ['Your choice', 'Taking part is voluntary. You can stop at any time by telling the researcher.'],
];

export default function Consent({ onComplete }) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="panel narrow">
      <h1>Before you begin</h1>
      <p className="secondary">
        We're studying how students work with an AI tutor on verbal reasoning questions, as part of a
        Human-Computer Interaction course project.
      </p>

      <div className="group">
        {FACTS.map(([label, value]) => (
          <div key={label} className="row stacked">
            <span className="row-label">{label}</span>
            <span className="row-value">{value}</span>
          </div>
        ))}
      </div>
      <p className="footnote">Some details of the study are explained at the end.</p>

      <div className="group">
        <label className="row check-row">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>I've read this and agree to take part.</span>
        </label>
      </div>

      <div className="actions">
        <button className="btn primary" disabled={!agreed} onClick={() => onComplete({ consent: true, at: new Date().toISOString() })}>
          Continue
        </button>
      </div>
    </div>
  );
}
