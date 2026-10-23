import { useState } from 'react';

const PART_NAMES = { warmup: 'the warm-up', practice: 'the practice questions', solo: 'the solo check' };

// Same 1-10 mental effort item as Srinivasaprasad et al. (2026).
export default function EffortRating({ step, onComplete }) {
  const [value, setValue] = useState(null);

  return (
    <div className="card narrow">
      <p className="eyebrow">Quick check-in</p>
      <h1>How much mental effort did {PART_NAMES[step.section]} require?</h1>

      <div className="scale" role="radiogroup" aria-label="Mental effort from 1 to 10">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            className={`scale-btn ${value === n ? 'selected' : ''}`}
            onClick={() => setValue(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="scale-labels">
        <span>Very low</span>
        <span>Very high</span>
      </div>

      <div className="actions">
        <button
          className="btn primary"
          disabled={value === null}
          onClick={() => onComplete({ section: step.section, round: step.round ?? null, effort: value })}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
