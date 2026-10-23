import { useCallback, useEffect, useState } from 'react';
import { archive, clearActive, loadActive, saveActive } from './lib/storage';
import { questionProgress } from './lib/session';
import StartScreen from './components/StartScreen';
import Consent from './components/Consent';
import Demographics from './components/Demographics';
import Intro from './components/Intro';
import QuestionScreen from './components/QuestionScreen';
import EffortRating from './components/EffortRating';
import Questionnaire from './components/Questionnaire';
import Debrief from './components/Debrief';
import Done from './components/Done';

const SCREENS = {
  consent: Consent,
  demographics: Demographics,
  intro: Intro,
  question: QuestionScreen,
  effort: EffortRating,
  questionnaire: Questionnaire,
  debrief: Debrief,
  done: Done,
};

export default function App() {
  const [session, setSession] = useState(loadActive);

  useEffect(() => {
    if (session) saveActive(session);
  }, [session]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [session?.stepIndex]);

  const log = useCallback((type, data = {}) => {
    setSession((s) => s && { ...s, events: [...s.events, { t: Date.now(), step: s.stepIndex, type, ...data }] });
  }, []);

  // Stores the current screen's response and moves to the next screen.
  const complete = useCallback((data = {}) => {
    setSession((s) => {
      const step = s.steps[s.stepIndex];
      const next = {
        ...s,
        responses: { ...s.responses, [s.stepIndex]: data },
        stepIndex: s.stepIndex + 1,
        events: [...s.events, { t: Date.now(), step: s.stepIndex, type: 'step_complete', kind: step.kind }],
      };
      if (step.kind === 'question' && !step.ai) next.noAiResults = [...s.noAiResults, data.correct];
      if (step.kind === 'demographics' && data.greLastYear === 'yes') {
        next.status = 'excluded';
        next.stepIndex = s.steps.length - 1;
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    clearActive();
    setSession(null);
  }, []);

  // Researcher escape hatch: Ctrl+Shift+X ends the current session.
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'x')) return;
      setSession((s) => {
        if (!s || !window.confirm(`End session ${s.participantId} and return to the start screen?`)) return s;
        if (!s.finishedAt) archive({ ...s, status: 'aborted', finishedAt: new Date().toISOString() });
        clearActive();
        return null;
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!session || session.finishedAt || session.steps[session.stepIndex].kind !== 'done') return;
    const finished = {
      ...session,
      status: session.status === 'excluded' ? 'excluded' : 'complete',
      finishedAt: new Date().toISOString(),
    };
    archive(finished);
    setSession(finished);
  }, [session]);

  if (!session) {
    return (
      <Shell>
        <StartScreen onStart={setSession} />
      </Shell>
    );
  }

  const step = session.steps[session.stepIndex];
  const Screen = SCREENS[step.kind];
  const showProgress = ['intro', 'question', 'effort'].includes(step.kind);

  return (
    <Shell progress={showProgress ? questionProgress(session) : null}>
      <Screen key={session.stepIndex} session={session} step={step} log={log} onComplete={complete} onReset={reset} />
    </Shell>
  );
}

function Shell({ progress, children }) {
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">📘</span> StudyBot
        </div>
        {progress && (
          <div className="progress" aria-label={`Question ${progress.done} of ${progress.total} done`}>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
            <span className="progress-text">
              {progress.done} / {progress.total}
            </span>
          </div>
        )}
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
