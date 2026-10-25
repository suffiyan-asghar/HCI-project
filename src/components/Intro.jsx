import { hasTutor } from '../lib/session';
import SessionMap from './SessionMap';

const NUMBERS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
const questions = (n) => `${NUMBERS[n] ?? n} question${n === 1 ? '' : 's'}`;

const COPY = {
  warmup: (n) => ({
    title: 'Warm-up',
    lede: `${questions(n)} on your own, without AI help. Do your best. It's fine to guess.`,
  }),
  practice: (n, withTutor) =>
    withTutor
      ? {
          title: 'Practice with StudyBot',
          lede: `${questions(n)}. StudyBot, an AI tutor, sits beside each one. Use it as much or as little as you like.`,
        }
      : {
          title: 'Practice',
          lede: `${questions(n)} on your own. Take your time and work through each one.`,
        },
  solo: (n) => ({
    title: 'Solo check',
    lede: `${questions(n)} on your own. No AI help this time.`,
  }),
  retention: () => ({
    title: 'Final check',
    lede: "A last few questions on your own, without AI help. Some you've seen before and some are new.",
  }),
};

const WRAP_UP = 4;

export default function Intro({ session, step, onComplete }) {
  const copy = COPY[step.section](step.count, hasTutor(session.group));
  return (
    <div className="panel narrow">
      <SessionMap current={step.section === 'retention' ? WRAP_UP : (step.round ?? 0)} />
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
