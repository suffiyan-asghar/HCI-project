import { useState } from 'react';
import ChoiceGroup from './ChoiceGroup';

const QUESTIONS = [
  { key: 'gender', label: 'Gender', options: ['Male', 'Female', 'Prefer not to say'] },
  { key: 'nativeEnglish', label: 'Are you a native English speaker?', options: ['Yes', 'No'] },
  {
    key: 'aiUse',
    label: 'How often do you use AI chatbots (e.g. ChatGPT, Claude, Gemini)?',
    options: ['Never', 'Monthly or less', 'Weekly', 'Daily'],
  },
  { key: 'greLastYear', label: 'Have you taken the GRE in the past 12 months?', options: ['Yes', 'No'] },
];

export default function Demographics({ onComplete }) {
  const [age, setAge] = useState('');
  const [answers, setAnswers] = useState({});

  const ageNum = Number(age);
  const ageValid = Number.isInteger(ageNum) && ageNum >= 16 && ageNum <= 99;
  const complete = ageValid && QUESTIONS.every((q) => answers[q.key]);

  function submit() {
    const normalized = Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, v.toLowerCase()]));
    onComplete({ age: ageNum, ...normalized });
  }

  return (
    <div className="card narrow">
      <h1>About you</h1>
      <p className="muted">A few quick questions before we begin.</p>

      <div className="form">
        <label className="field short">
          <span>Age</span>
          <input type="number" inputMode="numeric" min="16" max="99" value={age} onChange={(e) => setAge(e.target.value)} />
        </label>

        {QUESTIONS.map((q) => (
          <ChoiceGroup
            key={q.key}
            label={q.label}
            options={q.options}
            value={answers[q.key]}
            onChange={(v) => setAnswers((a) => ({ ...a, [q.key]: v }))}
          />
        ))}
      </div>

      <div className="actions">
        <button className="btn primary" disabled={!complete} onClick={submit}>
          Continue
        </button>
      </div>
    </div>
  );
}
