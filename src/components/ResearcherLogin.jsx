import { useState } from 'react';
import { checkResearcherKey, setResearcherKey } from '../lib/api';

// Asks for the researcher password once per laptop; the browser remembers it.
export default function ResearcherLogin({ onDone }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setResearcherKey(password);
    try {
      await checkResearcherKey();
      onDone();
    } catch (err) {
      setError(err.status === 401 ? 'That password is not right.' : "Can't reach the study server.");
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="group">
        <label className="row">
          <span className="row-label">Researcher password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required />
        </label>
      </div>
      {error && <p className="warn">{error}</p>}
      <p className="footnote">Set on the server as RESEARCHER_PASSWORD. This laptop remembers it.</p>
      <div className="actions">
        <button className="btn primary" type="submit">
          Unlock
        </button>
      </div>
    </form>
  );
}
