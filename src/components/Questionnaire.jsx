import { useState } from 'react';
import Segmented from './Segmented';

const TLX = [
  { key: 'mental', title: 'Mental demand', q: 'How mentally demanding was the task?', low: 'Very low', high: 'Very high' },
  { key: 'physical', title: 'Physical demand', q: 'How physically demanding was the task?', low: 'Very low', high: 'Very high' },
  { key: 'temporal', title: 'Temporal demand', q: 'How hurried or rushed was the pace?', low: 'Very low', high: 'Very high' },
  { key: 'performance', title: 'Performance', q: 'How successful were you at what you were asked to do?', low: 'Perfect', high: 'Failure' },
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

const AGREEMENT = ['1', '2', '3', '4', '5'];

export default function Questionnaire({ onComplete }) {
  const [tlx, setTlx] = useState({});
  const [likert, setLikert] = useState({});
  const [noticedWrong, setNoticedWrong] = useState(null);
  const [comments, setComments] = useState('');

  const complete =
    TLX.every((t) => tlx[t.key] !== undefined) && LIKERT.every((l) => likert[l.key] !== undefined) && noticedWrong !== null;

  const setTlxValue = (key) => (e) => setTlx((s) => ({ ...s, [key]: Number(e.target.value) }));

  return (
    <div className="panel medium">
      <p className="kicker">Almost done</p>
      <h1>Looking back on the session</h1>

      <h2>Workload</h2>
      <p className="secondary">Move each slider to where it fits best for the session as a whole.</p>
      <div className="tlx">
        {TLX.map((t) => {
          const touched = tlx[t.key] !== undefined;
          const value = touched ? tlx[t.key] : 50;
          return (
            <div key={t.key}>
              <p className="tlx-question">
                <strong>{t.title}.</strong> <span className="secondary">{t.q}</span>
              </p>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                className={`range ${touched ? '' : 'untouched'}`}
                style={{ '--val': `${value}%` }}
                value={value}
                aria-label={t.title}
                onChange={setTlxValue(t.key)}
                onPointerDown={setTlxValue(t.key)}
              />
              <div className="scale-ends">
                <span>{t.low}</span>
                <span>{t.high}</span>
              </div>
            </div>
          );
        })}
      </div>

      <h2>StudyBot</h2>
      <p className="secondary">How much do you agree with each statement? 1 is strongly disagree, 5 is strongly agree.</p>
      {LIKERT.map((item) => (
        <div key={item.key} className="statement">
          <Segmented
            label={item.q}
            options={AGREEMENT}
            value={likert[item.key] ? String(likert[item.key]) : undefined}
            onChange={(v) => setLikert((s) => ({ ...s, [item.key]: Number(v) }))}
            ends={['Strongly disagree', 'Strongly agree']}
          />
        </div>
      ))}

      <h2>One last thing</h2>
      <Segmented
        label="Did any of StudyBot's answers seem wrong to you?"
        options={['Yes', 'No', 'Not sure']}
        value={noticedWrong}
        onChange={setNoticedWrong}
      />

      <div className="field-group">
        <label className="field-label" htmlFor="comments">
          Anything else you'd like to tell us? <span className="secondary">Optional</span>
        </label>
        <textarea id="comments" className="text-input" rows="3" value={comments} onChange={(e) => setComments(e.target.value)} />
      </div>

      <div className="actions">
        {!complete && <span className="footnote">Answer every item to continue.</span>}
        <button className="btn primary" disabled={!complete} onClick={() => onComplete({ tlx, likert, noticedWrong, comments })}>
          Continue
        </button>
      </div>
    </div>
  );
}
