import { downloadJson } from '../lib/storage';

export default function Done({ session, onReset }) {
  const excluded = session.status === 'excluded';

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
        <span>Researcher · {session.participantId}</span>
        <span>
          <button className="btn plain" onClick={() => downloadJson(`studybot-${session.participantId}.json`, session)}>
            Download session
          </button>
          <button className="btn plain" onClick={onReset}>
            Next participant
          </button>
        </span>
      </div>
    </div>
  );
}
