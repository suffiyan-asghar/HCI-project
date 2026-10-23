import { CONFIG } from '../config';

const COPY = {
  warmup: () => ({
    eyebrow: 'Part 1',
    title: 'Warm-up',
    points: ['4 questions on your own, with no AI help.', "Do your best. It's fine to guess."],
  }),
  practice: (round) => ({
    eyebrow: `Round ${round} of ${CONFIG.rounds}`,
    title: 'Practice with StudyBot',
    points: [
      '5 questions.',
      'StudyBot, an AI tutor, is in the panel on the right.',
      'Use it as much or as little as you like.',
    ],
  }),
  solo: (round) => ({
    eyebrow: `Round ${round} of ${CONFIG.rounds}`,
    title: 'Solo check',
    points: ['3 questions on your own.', 'No AI help this time.'],
  }),
};

export default function Intro({ step, onComplete }) {
  const copy = COPY[step.section](step.round);
  return (
    <div className="card narrow intro">
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1>{copy.title}</h1>
      <ul className="plain-list">
        {copy.points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <div className="actions">
        <button className="btn primary" onClick={() => onComplete()}>
          Start
        </button>
      </div>
    </div>
  );
}
