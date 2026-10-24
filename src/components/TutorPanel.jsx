import { useEffect, useRef, useState } from 'react';
import { firstLevel, givesAnswer, nextLevel } from '../tutor/policy';
import { getTutorReply } from '../tutor';
import RichText from './RichText';
import { ArrowUpIcon } from './icons';

export const emptyChat = {
  messages: [],
  pending: false,
  level: null,
  levelsShown: [],
  noIdea: false,
  selectionAtFirstAsk: null,
  aiStatedAnswer: null,
};

// Both groups see the same panel. They differ only in the guess-first gate
// (Adaptive) and in which help level each reply uses (see tutor/policy.js).
export default function TutorPanel({ group, question, planted, selected, noAiResults, chat, setChat, log }) {
  const [draft, setDraft] = useState('');
  const listRef = useRef(null);
  const locked = group === 'adaptive' && selected === null && !chat.noIdea && chat.messages.length === 0;

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.messages.length, chat.pending]);

  async function send(text) {
    text = text.trim();
    if (!text || chat.pending || locked) return;
    setDraft('');

    const isFirst = chat.messages.length === 0;
    const previousLevel = chat.level;
    const level = previousLevel === null ? firstLevel(group, noAiResults) : nextLevel(group, previousLevel);

    setChat((c) => ({
      ...c,
      pending: true,
      level,
      messages: [...c.messages, { role: 'user', text, t: Date.now() }],
      ...(isFirst && { selectionAtFirstAsk: selected }),
    }));
    log('chat_user', { qid: question.id, text, level, selectedAtSend: selected });

    try {
      const reply = await getTutorReply({ question, level, planted, group });
      const stated = givesAnswer(level) ? (planted ? question.plantedWrong : question.correct) : null;
      setChat((c) => ({
        ...c,
        pending: false,
        messages: [...c.messages, { role: 'bot', text: reply, level, t: Date.now() }],
        levelsShown: [...c.levelsShown, level],
        aiStatedAnswer: stated ?? c.aiStatedAnswer,
      }));
      log('chat_bot', { qid: question.id, level, statedAnswer: stated });
    } catch (err) {
      setChat((c) => ({
        ...c,
        pending: false,
        level: previousLevel,
        messages: [...c.messages, { role: 'bot', text: '⚠️ Sorry, I could not answer just now. Please try again.', error: true, t: Date.now() }],
      }));
      log('chat_error', { qid: question.id, message: String(err) });
    }
  }

  function noIdea() {
    setChat((c) => ({ ...c, noIdea: true }));
    log('no_idea', { qid: question.id });
  }

  const quickReply = chat.messages.length === 0 ? 'Can you help me with this question?' : 'Can you help a bit more?';

  return (
    <aside className="tutor" aria-label="StudyBot AI tutor">
      <div className="tutor-header">
        <span className="tutor-avatar" aria-hidden="true">
          SB
        </span>
        <div className="tutor-name">
          StudyBot
          <span>AI tutor</span>
        </div>
      </div>

      <div className="tutor-messages" ref={listRef} aria-live="polite">
        <div className="bubble bot">
          <p>👋 Hi! I'm StudyBot. Ask me anything about this question.</p>
        </div>
        {chat.messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role} ${m.error ? 'error' : ''}`}>
            {m.role === 'bot' ? <RichText text={m.text} /> : <p>{m.text}</p>}
          </div>
        ))}
        {chat.pending && (
          <div className="bubble bot typing" aria-label="StudyBot is typing">
            <span />
            <span />
            <span />
          </div>
        )}
      </div>

      {locked ? (
        <div className="tutor-gate">
          <p className="secondary">
            <strong>Make your best guess first.</strong>
            Choose an answer, then you can ask StudyBot for help.
          </p>
          <button className="btn tinted" onClick={noIdea}>
            I have no idea yet
          </button>
        </div>
      ) : (
        <div className="tutor-footer">
          <button className="suggestion" disabled={chat.pending} onClick={() => send(quickReply)}>
            {quickReply}
          </button>
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
          >
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message StudyBot" aria-label="Message StudyBot" />
            <button className="send" type="submit" aria-label="Send" disabled={!draft.trim() || chat.pending}>
              <ArrowUpIcon />
            </button>
          </form>
        </div>
      )}
    </aside>
  );
}
