// iOS-style segmented control for picking one of a few options.
export default function Segmented({ label, options, value, onChange, ends }) {
  const index = options.indexOf(value);

  return (
    <fieldset className="field-group">
      {label && <legend className="field-label">{label}</legend>}
      <div className="segmented" role="radiogroup" aria-label={label} style={{ '--count': options.length, '--index': index }}>
        {index >= 0 && <span className="segmented-thumb" aria-hidden="true" />}
        {options.map((opt) => (
          <button key={opt} type="button" role="radio" aria-checked={value === opt} className="segment" onClick={() => onChange(opt)}>
            {opt}
          </button>
        ))}
      </div>
      {ends && (
        <div className="scale-ends">
          <span>{ends[0]}</span>
          <span>{ends[1]}</span>
        </div>
      )}
    </fieldset>
  );
}
