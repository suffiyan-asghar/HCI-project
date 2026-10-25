import { useCallback, useEffect, useRef, useState } from 'react';
import { syncSession } from './lib/api';
import { ACTIVE_KEY, archive, clearActive, loadActive, saveActive } from './lib/storage';
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
import AdminPage from './components/AdminPage';

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
  if (window.location.pathname === '/admin') {
    return (
      <Shell>
        <AdminPage />
      </Shell>
    );
  }
  return <Study />;
}

function Study() {
  const [session, setSession] = useState(loadActive);
  const [otherTab, setOtherTab] = useState(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  // Only one tab may run the session: if another tab changes it, this one stops.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === ACTIVE_KEY) setOtherTab(true);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!session || otherTab) return;
    saveActive(session);
    syncSession(session);
  }, [session, otherTab]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [session?.stepIndex]);

  const log = useCallback((type, data = {}) => {
    setSession((s) => s && { ...s, events: [...s.events, { t: Date.now(), step: s.stepIndex, type, ...data }] });
  }, []);

  // Keeps the current question's unfinished state (choice, chat) so a refresh can restore it.
  const saveDraft = useCallback((draft) => {
    setSession((s) => s && { ...s, draft: { ...draft, step: s.stepIndex } });
  }, []);

  // Stores the current screen's response and moves to the next screen.
  const complete = useCallback((data = {}) => {
    setSession((s) => {
      const step = s.steps[s.stepIndex];
      const next = {
        ...s,
        draft: null,
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
      const s = sessionRef.current;
      if (!s || !window.confirm(`End session ${s.participantId} and return to the start screen?`)) return;
      if (!s.finishedAt) {
        const aborted = { ...s, status: 'aborted', finishedAt: new Date().toISOString() };
        archive(aborted);
        syncSession(aborted);
      }
      clearActive();
      setSession(null);
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

  if (otherTab) {
    return (
      <Shell>
        <div className="panel narrow center">
          <h1>StudyBot is open in another tab</h1>
          <p className="secondary">Close this tab and carry on in the other one, so no answers are lost.</p>
        </div>
      </Shell>
    );
  }

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
      <div className="screen" key={session.stepIndex}>
        <Screen
          session={session}
          step={step}
          draft={session.draft?.step === session.stepIndex ? session.draft : null}
          saveDraft={saveDraft}
          log={log}
          onComplete={complete}
          onReset={reset}
        />
      </div>
    </Shell>
  );
}

function Shell({ progress, children }) {
  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <span className="wordmark">StudyBot</span>
          {progress && (
            <div className="progress" aria-label={`${progress.done} of ${progress.total} questions done`}>
              <span className="progress-text">
                {progress.done} of {progress.total}
              </span>
              <div className="progress-track">
                <div className="progress-fill" style={{ transform: `scaleX(${progress.done / progress.total})` }} />
              </div>
            </div>
          )}
        </div>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
