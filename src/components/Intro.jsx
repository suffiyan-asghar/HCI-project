import SessionMap from './SessionMap';

const COPY = {
  warmup: () => ({
    title: 'Warm-up',
    lede: "Four questions on your own, without AI help. Do your best. It's fine to guess.",
  }),
  practice: () => ({
    title: 'Practice with StudyBot',
    lede: 'Five questions. StudyBot, an AI tutor, sits beside each one. Use it as much or as little as you like.',
  }),
  solo: () => ({
    title: 'Solo check',
    lede: 'Three questions on your own. No AI help this time.',
  }),
};

export default function Intro({ step, onComplete }) {
  const copy = COPY[step.section]();
  return (
    <div className="panel narrow">
      <SessionMap current={step.round ?? 0} />
      <h1 className="intro-title">{copy.title}</h1>
      <p className="intro-lede">{copy.lede}</p>
      <div className="actions">
        <button className="btn primary" onClick={() => onComplete()}>
          Start
        </button>
      </div>
    </div>
  );
}
