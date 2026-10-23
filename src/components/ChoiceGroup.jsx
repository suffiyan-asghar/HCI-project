// A row of pill buttons for picking one option.
export default function ChoiceGroup({ label, options, value, onChange }) {
  return (
    <fieldset className="choice-group">
      <legend>{label}</legend>
      <div className="pills">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            className={`pill ${value === opt ? 'selected' : ''}`}
            aria-pressed={value === opt}
            onClick={() => onChange(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
