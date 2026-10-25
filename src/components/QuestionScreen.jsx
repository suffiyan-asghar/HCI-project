import { useEffect, useRef, useState } from 'react';
import { getQuestion, LETTERS, sectionLabel } from '../lib/session';
import TutorPanel, { emptyChat } from './TutorPanel';
import Segmented from './Segmented';
import { CheckIcon } from './icons';

export default function QuestionScreen({ session, step, draft, saveDraft, log, onComplete }) {
  const question = getQuestion(step.qid);
  // Re-tested questions show their options in a new order; `selected` is always the original index.
  const order = step.order ?? question.options.map((_, i) => i);
  const [selected, setSelected] = useState(draft?.selected ?? null);
  const [source, setSource] = useState(draft?.source ?? null);
  // A restored chat may still be waiting for a reply; TutorPanel asks for it again.
  const [chat, setChat] = useState(draft?.chat ?? emptyChat);
  const shownAt = useRef(draft?.shownAt ?? Date.now());

  useEffect(() => {
    log(draft ? 'question_resumed' : 'question_shown', { qid: question.id, section: step.section, round: step.round ?? null });
    // Logged once per mount; `draft` only matters for the first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log, question.id, step.section, step.round]);

  // Saved from the first render, so a refresh before any click keeps the original shownAt.
  useEffect(() => {
    saveDraft({ selected, source, chat, shownAt: shownAt.current });
  }, [saveDraft, selected, source, chat]);

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
    if (step.section === 'retention') {
      return onComplete({
        ...base,
        retest: step.retest,
        sourceRound: step.sourceRound ?? null,
        order: step.order ?? null,
        // Source memory: did they remember solving this one with or without StudyBot?
        sourceAnswer: source,
      });
    }
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
      <section className="panel">
        <div className="question-meta">
          <p className="kicker">{sectionLabel(step)}</p>
          <span className="question-count">
            {step.index + 1} of {step.total}
          </span>
        </div>

        {question.passage && <blockquote className="passage">{question.passage}</blockquote>}
        <p className="stem">{question.stem}</p>

        <div className="option-list" role="radiogroup" aria-label="Answer options">
          {order.map((i, pos) => (
            <button key={i} type="button" role="radio" aria-checked={selected === i} className="option-row" onClick={() => choose(i)}>
              <span className="option-letter">{LETTERS[pos]}</span>
              <span className="option-text">{question.options[i]}</span>
              <CheckIcon className="option-check" />
            </button>
          ))}
        </div>

        {step.askSource && (
          <Segmented
            label="Earlier in the session, did StudyBot help you with this question?"
            options={['Yes', 'No', "Don't remember"]}
            value={source}
            onChange={setSource}
          />
        )}

        <div className="actions">
          <button
            className="btn primary"
            disabled={selected === null || chat.pending || (step.askSource && source === null)}
            onClick={submit}
          >
            Next
          </button>
        </div>
      </section>

      {step.ai && (
        <TutorPanel
          session={session}
          question={question}
          planted={!!step.planted}
          selected={selected}
          chat={chat}
          setChat={setChat}
          log={log}
        />
      )}
    </div>
  );
}
