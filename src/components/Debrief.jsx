import { getQuestion, hasTutor, LETTERS } from '../lib/session';

const answerText = (q, i) => `(${LETTERS[i]}) ${q.options[i]}`;

export default function Debrief({ session, onComplete }) {
  if (!hasTutor(session.group)) return <ControlDebrief onComplete={onComplete} />;

  const planted = session.steps
    .map((step, i) => ({ step, response: session.responses[i] }))
    .filter(({ step }) => step.planted);

  return (
    <div className="panel medium">
      <p className="kicker">Debrief</p>
      <h1>What we were studying</h1>
      <p>
        We're testing whether easy, answer-first AI help makes students rely on the AI more and remember less, and
        whether a tutor that asks you to think first can prevent that. Some participants had a tutor that gave
        answers straight away, some had one that sometimes gave a hint or a question instead, and some worked
        without AI. The final check showed how much stuck from earlier in the session.
      </p>
      <p>
        <strong>On two practice questions, StudyBot was set up to give a wrong answer on purpose.</strong> This
        shows whether people check the AI or accept it. It wasn't a test of you, and going along with it is
        completely normal.
      </p>

      {planted.map(({ step, response }) => {
        const q = getQuestion(step.qid);
        const sawWrong = response?.aiStatedAnswer === q.plantedWrong;
        return (
          <div key={`${step.round}-${step.index}`}>
            <p className="debrief-label">
              Round {step.round} · Practice question {step.index + 1}
            </p>
            <div className="group">
              <div className="debrief-stem">{q.stem.split('\n')[0]}</div>
              <div className="row stacked">
                <span className="row-label">Correct answer</span>
                <span className="row-value">{answerText(q, q.correct)}</span>
              </div>
              <div className="row stacked">
                <span className="row-label">StudyBot told you</span>
                {sawWrong ? (
                  <span className="row-value text-red">{answerText(q, q.plantedWrong)}, which is wrong</span>
                ) : (
                  <span className="row-value">Nothing. It didn't give its answer on this one.</span>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <p>
        Everywhere else, StudyBot tried to give correct help. Please don't mention this part to other students
        until the study is over, so their results stay fair. If you have questions, ask the researcher.
      </p>

      <div className="actions">
        <button className="btn primary" onClick={() => onComplete({ seenAt: new Date().toISOString() })}>
          Finish
        </button>
      </div>
    </div>
  );
}

function ControlDebrief({ onComplete }) {
  return (
    <div className="panel medium">
      <p className="kicker">Debrief</p>
      <h1>What we were studying</h1>
      <p>
        We're testing whether easy, answer-first AI help makes students rely on the AI more and remember less, and
        whether a tutor that asks you to think first can prevent that. Other participants practised with an AI
        tutor called StudyBot. You were in the comparison group, which worked without AI, so we can see what
        people achieve and remember on their own.
      </p>
      <p>
        The final check showed how much stuck from earlier in the session. Please don't discuss the study with
        other students until it is over, so their results stay fair. If you have questions, ask the researcher.
      </p>

      <div className="actions">
        <button className="btn primary" onClick={() => onComplete({ seenAt: new Date().toISOString() })}>
          Finish
        </button>
      </div>
    </div>
  );
}
