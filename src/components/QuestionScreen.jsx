import { useEffect, useRef, useState } from 'react';
import { getQuestion, LETTERS, sectionLabel } from '../lib/session';
import TutorPanel, { emptyChat } from './TutorPanel';

export default function QuestionScreen({ session, step, log, onComplete }) {
  const question = getQuestion(step.qid);
  const [selected, setSelected] = useState(null);
  const [chat, setChat] = useState(emptyChat);
  const shownAt = useRef(Date.now());

  useEffect(() => {
    log('question_shown', { qid: question.id, section: step.section, round: step.round ?? null });
  }, [log, question.id, step.section, step.round]);

  function choose(i) {
    setSelected(i);
    log('option_selected', { qid: question.id, option: i });
  }

  function submit() {
    const base = {
      qid: question.id,
      section: step.section,
      round: step.round ?? null,
      selected,
      correct: selected === question.correct,
      timeMs: Date.now() - shownAt.current,
      ai: step.ai,
    };
    if (!step.ai) return onComplete(base);

    const askedAI = chat.messages.length > 0;
    onComplete({
      ...base,
      planted: !!step.planted,
      askedAI,
      // Did they pick an option before their first message? (RQ2, logged for both groups.)
      triedBeforeAsking: askedAI ? chat.selectionAtFirstAsk !== null : null,
      noIdea: chat.noIdea,
      levelsShown: chat.levelsShown,
      aiStatedAnswer: chat.aiStatedAnswer,
      matchedAI: chat.aiStatedAnswer !== null && selected === chat.aiStatedAnswer,
      acceptedWrongAI: !!step.planted && chat.aiStatedAnswer === question.plantedWrong && selected === question.plantedWrong,
      messages: chat.messages,
    });
  }

  return (
    <div className={`question-layout ${step.ai ? 'with-tutor' : ''}`}>
      <section className="card question-card">
        <div className="question-meta">
          <span className="eyebrow">{sectionLabel(step)}</span>
          <span className="muted">
            Question {step.index + 1} of {step.total}
          </span>
        </div>

        {question.passage && <blockquote className="passage">{question.passage}</blockquote>}
        <p className="stem">{question.stem}</p>

        <div className="options" role="radiogroup" aria-label="Answer options">
          {question.options.map((opt, i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={selected === i}
              className={`option ${selected === i ? 'selected' : ''}`}
              onClick={() => choose(i)}
            >
              <span className="option-letter">{LETTERS[i]}</span>
              <span>{opt}</span>
            </button>
          ))}
        </div>

        <div className="actions">
          <button className="btn primary" disabled={selected === null || chat.pending} onClick={submit}>
            Next
          </button>
        </div>
      </section>

      {step.ai && (
        <TutorPanel
          group={session.group}
          question={question}
          planted={!!step.planted}
          selected={selected}
          noAiResults={session.noAiResults}
          chat={chat}
          setChat={setChat}
          log={log}
        />
      )}
    </div>
  );
}
