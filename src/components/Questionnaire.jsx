import { useState } from 'react';
import ChoiceGroup from './ChoiceGroup';

const TLX = [
  { key: 'mental', title: 'Mental demand', q: 'How mentally demanding was the task?', low: 'Very low', high: 'Very high' },
  { key: 'physical', title: 'Physical demand', q: 'How physically demanding was the task?', low: 'Very low', high: 'Very high' },
  { key: 'temporal', title: 'Temporal demand', q: 'How hurried or rushed was the pace of the task?', low: 'Very low', high: 'Very high' },
  { key: 'performance', title: 'Performance', q: 'How successful were you in doing what you were asked to do?', low: 'Perfect', high: 'Failure' },
  { key: 'effort', title: 'Effort', q: 'How hard did you have to work to reach your level of performance?', low: 'Very low', high: 'Very high' },
  { key: 'frustration', title: 'Frustration', q: 'How insecure, discouraged, irritated, stressed or annoyed were you?', low: 'Very low', high: 'Very high' },
];

const LIKERT = [
  { key: 'trustAnswers', q: "I trusted StudyBot's answers." },
  { key: 'checkedAnswers', q: "I checked StudyBot's answers before using them." },
  { key: 'reliedOn', q: 'I relied on StudyBot to answer the practice questions.' },
  { key: 'reliedMoreOverTime', q: 'I relied on StudyBot more as the session went on.' },
  { key: 'couldDoAlone', q: 'I could have answered most practice questions without StudyBot.' },
  { key: 'clarity', q: "StudyBot's responses were clear and concise." },
  { key: 'emojiHelped', q: 'The emojis helped me understand the responses.' },
  { key: 'helpedLearn', q: 'StudyBot helped me learn how to solve this kind of question.' },
];

const LIKERT_LABELS = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'];

export default function Questionnaire({ onComplete }) {
  const [tlx, setTlx] = useState({});
  const [likert, setLikert] = useState({});
  const [noticedWrong, setNoticedWrong] = useState(null);
  const [comments, setComments] = useState('');

  const complete =
    TLX.every((t) => tlx[t.key] !== undefined) && LIKERT.every((l) => likert[l.key] !== undefined) && noticedWrong !== null;

  return (
    <div className="card medium">
      <p className="eyebrow">Almost done</p>
      <h1>About the whole session</h1>

      <h2>Workload</h2>
      <p className="muted">Drag or click each scale. Think about the session as a whole.</p>
      <div className="tlx">
        {TLX.map((t) => {
          const touched = tlx[t.key] !== undefined;
          return (
            <div key={t.key} className="tlx-item">
              <div className="tlx-title">
                <strong>{t.title}</strong> <span className="muted">{t.q}</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                className={touched ? '' : 'untouched'}
                value={touched ? tlx[t.key] : 50}
                aria-label={t.title}
                onChange={(e) => setTlx((s) => ({ ...s, [t.key]: Number(e.target.value) }))}
                onClick={(e) => setTlx((s) => ({ ...s, [t.key]: Number(e.target.value) }))}
              />
              <div className="scale-labels">
                <span>{t.low}</span>
                <span>{t.high}</span>
              </div>
            </div>
          );
        })}
      </div>

      <h2>StudyBot</h2>
      <div className="likert" role="table" aria-label="Statements about StudyBot">
        <div className="likert-row likert-head" role="row">
          <span role="columnheader" />
          {LIKERT_LABELS.map((l) => (
            <span key={l} role="columnheader">
              {l}
            </span>
          ))}
        </div>
        {LIKERT.map((item) => (
          <div key={item.key} className="likert-row" role="row">
            <span role="rowheader">{item.q}</span>
            {LIKERT_LABELS.map((label, i) => (
              <label key={label} className="likert-cell" role="cell">
                <input
                  type="radio"
                  name={item.key}
                  checked={likert[item.key] === i + 1}
                  onChange={() => setLikert((s) => ({ ...s, [item.key]: i + 1 }))}
                  aria-label={`${item.q} ${label}`}
                />
                <span className="likert-mobile-label">{label}</span>
              </label>
            ))}
          </div>
        ))}
      </div>

      <ChoiceGroup
        label="Did you notice any StudyBot answers that seemed wrong?"
        options={['Yes', 'No', 'Not sure']}
        value={noticedWrong}
        onChange={setNoticedWrong}
      />

      <label className="field">
        <span>Anything else you'd like to tell us? (optional)</span>
        <textarea rows="3" value={comments} onChange={(e) => setComments(e.target.value)} />
      </label>

      <div className="actions">
        {!complete && <span className="muted tiny">Please answer every item above.</span>}
        <button className="btn primary" disabled={!complete} onClick={() => onComplete({ tlx, likert, noticedWrong, comments })}>
          Continue
        </button>
      </div>
    </div>
  );
}
