import { downloadJson } from '../lib/storage';

export default function Done({ session, onReset }) {
  const excluded = session.status === 'excluded';

  return (
    <div className="card narrow center">
      <div className="big-emoji" aria-hidden="true">
        {excluded ? '🙏' : '🎉'}
      </div>
      <h1>{excluded ? 'Thank you for your interest' : 'All done. Thank you!'}</h1>
      <p>
        {excluded
          ? "This study is for people who haven't taken the GRE in the past year, so we won't need you for the rest of it."
          : 'Your responses have been saved.'}
      </p>
      <p className="muted">Please let the researcher know you have finished.</p>

      <div className="researcher-footer">
        <span>Researcher: {session.participantId}</span>
        <span>
          <button className="btn link" onClick={() => downloadJson(`studybot-${session.participantId}.json`, session)}>
            Download this session
          </button>
          <button className="btn link" onClick={onReset}>
            Next participant
          </button>
        </span>
      </div>
    </div>
  );
}
