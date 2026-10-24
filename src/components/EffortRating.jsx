import { useState } from 'react';
import Segmented from './Segmented';

const PART_NAMES = { warmup: 'the warm-up', practice: 'the practice questions', solo: 'the solo check' };
const SCALE = Array.from({ length: 10 }, (_, i) => String(i + 1));

// Same 1-10 mental effort item as Srinivasaprasad et al. (2026).
export default function EffortRating({ step, onComplete }) {
  const [value, setValue] = useState(null);

  return (
    <div className="panel narrow">
      <p className="kicker">Quick check-in</p>
      <h1>How much mental effort did {PART_NAMES[step.section]} take?</h1>

      <Segmented options={SCALE} value={value} onChange={setValue} ends={['Very low', 'Very high']} />

      <div className="actions">
        <button
          className="btn primary"
          disabled={value === null}
          onClick={() => onComplete({ section: step.section, round: step.round ?? null, effort: Number(value) })}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
