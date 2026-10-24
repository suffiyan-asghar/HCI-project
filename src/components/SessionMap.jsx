const PARTS = ['Warm-up', 'Round 1', 'Round 2', 'Round 3', 'Wrap-up'];

// Shows where the participant is in the session.
export default function SessionMap({ current }) {
  return (
    <div className="session-map" aria-label={`Part ${current + 1} of ${PARTS.length}: ${PARTS[current]}`}>
      {PARTS.map((part, i) => (
        <span key={part} className={`session-map-part ${i < current ? 'done' : ''} ${i === current ? 'current' : ''}`}>
          {part}
        </span>
      ))}
    </div>
  );
}
