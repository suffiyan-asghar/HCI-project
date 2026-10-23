import { getQuestion, LETTERS } from '../lib/session';

export default function Debrief({ session, onComplete }) {
  const planted = session.steps
    .map((step, i) => ({ step, response: session.responses[i] }))
    .filter(({ step }) => step.planted);

  return (
    <div className="card medium">
      <p className="eyebrow">Debrief</p>
      <h1>Thank you! Here's what we were studying</h1>
      <p>
        We are testing whether easy, answer-first AI help makes students rely on the AI more, and whether a tutor
        that asks you to think first can prevent that. Half of the participants used a tutor that gave answers
        straight away. The other half used one that sometimes gave hints or questions instead.
      </p>
      <p>
        <strong>On two practice questions, StudyBot was set up to give a wrong answer on purpose.</strong> We did
        this to see whether people check the AI's answers or accept them. It was not a test of you, and getting
        them wrong is completely normal. Here are those two questions:
      </p>

      {planted.map(({ step, response }) => {
        const q = getQuestion(step.qid);
        const sawWrong = response?.aiStatedAnswer === q.plantedWrong;
        return (
          <div key={`${step.round}-${step.index}`} className="debrief-item">
            <p className="eyebrow">
              Round {step.round}, practice question {step.index + 1}
            </p>
            <p className="stem">{q.stem.split('\n')[0]}</p>
            <ul className="plain-list">
              <li>
                ✅ Correct answer: <strong>({LETTERS[q.correct]}) {q.options[q.correct]}</strong>
              </li>
              {sawWrong ? (
                <li>
                  ⚠️ StudyBot told you: ({LETTERS[q.plantedWrong]}) {q.options[q.plantedWrong]}, which was wrong.
                </li>
              ) : (
                <li>StudyBot did not give you its (wrong) answer on this question.</li>
              )}
            </ul>
          </div>
        );
      })}

      <p>
        Everywhere else, StudyBot tried to give correct help. Please don't tell other students about this part
        until the study is over, so their results stay fair. If you have any questions, ask the researcher.
      </p>

      <div className="actions">
        <button className="btn primary" onClick={() => onComplete({ seenAt: new Date().toISOString() })}>
          Finish
        </button>
      </div>
    </div>
  );
}
