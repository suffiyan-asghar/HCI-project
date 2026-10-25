import { STATIC, useSyncStatus } from '../lib/api';
import { downloadJson } from '../lib/storage';

const SYNC_TEXT = {
  saved: STATIC ? 'Demo build: saved in this browser only' : 'Saved to the study server',
  saving: 'Saving to the study server…',
  offline: "Not saved to the server yet: it can't be reached. Retrying.",
  rejected: 'The server rejected this session. Download it and keep the file.',
};

export default function Done({ session, onReset }) {
  const excluded = session.status === 'excluded';
  const sync = useSyncStatus(session.participantId);

  function nextParticipant() {
    const warning =
      sync === 'rejected'
        ? 'The server rejected this session, so it will not be saved there. Download it first. Continue anyway?'
        : 'This session has not reached the server yet. It stays queued on this laptop and is sent when the server is back, but download a copy to be safe. Continue anyway?';
    if (sync !== 'saved' && !window.confirm(warning)) return;
    onReset();
  }

  return (
    <div className="panel narrow center">
      <svg className={`done-mark ${excluded ? 'neutral' : ''}`} viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="32" />
        <path d="M19 33l9 9 17-19" />
      </svg>
      <h1>{excluded ? 'Thanks for your interest' : 'All done. Thank you.'}</h1>
      <p className="secondary">
        {excluded
          ? "This study is for people who haven't taken the GRE in the past year, so we won't need you for the rest."
          : 'Your responses have been saved.'}
      </p>
      <p>Please let the researcher know you've finished.</p>

      <div className="researcher-bar">
        <span className={sync === 'offline' || sync === 'rejected' ? 'text-red' : undefined}>
          Researcher · {session.participantId} · {SYNC_TEXT[sync]}
        </span>
        <span>
          <button
            className="btn plain"
            onClick={() => downloadJson(`studybot-${session.participantId}.json`, { ...session, token: undefined })}
          >
            Download session
          </button>
          <button className="btn plain" onClick={nextParticipant}>
            Next participant
          </button>
        </span>
      </div>
    </div>
  );
}
