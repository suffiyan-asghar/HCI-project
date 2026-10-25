import { useCallback, useEffect, useState } from 'react';
import { exportUrl, fetchAdmin } from '../lib/api';
import ResearcherLogin from './ResearcherLogin';

const GROUPS = ['standard', 'adaptive', 'control'];
const STATUSES = ['complete', 'active', 'excluded', 'aborted'];
const EXPORTS = [
  ['participants.csv', 'One row per participant with summary scores'],
  ['answers.csv', 'One row per answered question'],
  ['chat.csv', 'Every tutor message, with its source and any retry note'],
  ['events.csv', 'Every logged action, with timestamps'],
  ['database.sqlite', 'A full copy of the database (also saved in data/backups on the server)'],
];

const minutesBetween = (from, to) => (new Date(to) - new Date(from)) / 60000;

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Researcher page at /admin: tutor health, group balance, all sessions, and data exports.
export default function AdminPage() {
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading'); // 'loading' | 'ok' | 'locked' | 'offline'

  const load = useCallback(
    () =>
      fetchAdmin()
        .then((d) => {
          setData(d);
          setState('ok');
        })
        .catch((err) => setState(err.status === 401 ? 'locked' : 'offline')),
    [],
  );

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);

  if (state === 'locked') {
    return (
      <div className="panel narrow">
        <p className="kicker">Researcher</p>
        <h1>Study data</h1>
        <ResearcherLogin onDone={load} />
      </div>
    );
  }

  const real = data?.sessions.filter((s) => !s.demo) ?? [];
  const demos = data?.sessions.filter((s) => s.demo) ?? [];
  const count = (group, status) => real.filter((s) => s.grp === group && s.status === status).length;
  const durations = real.filter((s) => s.status === 'complete' && s.finished_at).map((s) => minutesBetween(s.startedAt, s.finished_at));
  const typical = median(durations);
  const tutor = data?.tutor;

  return (
    <div className="panel wide">
      <p className="kicker">Researcher</p>
      <h1>Study data</h1>
      {state === 'offline' && <p className="warn">Can't reach the study server. Retrying every 5 seconds.</p>}

      {tutor && (
        <>
          <h2>Tutor</h2>
          <p className="secondary">
            {tutor.mode === 'live' ? `Live (${tutor.model})` : 'Canned replies only: no GROQ_API_KEY on the server'} · since the
            server started: {tutor.live} live replies, {tutor.retried} retried, {tutor.fallback} replaced by canned replies
          </p>
          {tutor.fallback > 0 && tutor.lastError && (
            <p className="warn">
              Last failure at {new Date(tutor.lastError.at).toLocaleTimeString()}: {tutor.lastError.message}. Participants still got
              a reply at the right help level, but check this before the next session.
            </p>
          )}
        </>
      )}

      <h2>Group balance</h2>
      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Group</th>
              {STATUSES.map((s) => (
                <th key={s}>{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GROUPS.map((g) => (
              <tr key={g}>
                <td>{g}</td>
                {STATUSES.map((s) => (
                  <td key={s} className="num">
                    {count(g, s)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="secondary">
        {typical === null
          ? 'Session length appears here once sessions are complete.'
          : `Typical complete session: ${typical.toFixed(0)} minutes (median of ${durations.length}).`}
        {data?.lastBackup && ` Last automatic backup: ${data.lastBackup}.`}
      </p>

      <h2>Download</h2>
      <div className="group">
        {EXPORTS.map(([file, description]) => (
          <a key={file} className="row stacked" href={exportUrl(file)}>
            <span className="row-label">{file}</span>
            <span className="row-value">{description}</span>
          </a>
        ))}
      </div>

      <h2>Sessions</h2>
      <SessionTable sessions={real} />
      {demos.length > 0 && (
        <>
          <h2>Demo sessions</h2>
          <p className="secondary">Not counted in group balance and left out of every export.</p>
          <SessionTable sessions={demos} />
        </>
      )}

      <div className="researcher-bar">
        <a href="/">Back to the study</a>
        <span>Refreshes every 5 seconds{data && ` · Database: ${data.database}`}</span>
      </div>
    </div>
  );
}

function SessionTable({ sessions }) {
  return (
    <div className="table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Group</th>
            <th>Order</th>
            <th>Status</th>
            <th>Progress</th>
            <th>Minutes</th>
            <th>Started</th>
            <th>Last update</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.participant_id}>
              <td>{s.participant_id}</td>
              <td>{s.grp}</td>
              <td className="num">{s.block_order}</td>
              <td>{s.status}</td>
              <td className="num">{s.progress}</td>
              <td className="num">{minutesBetween(s.startedAt, s.finished_at ?? s.updated_at).toFixed(0)}</td>
              <td>{new Date(s.created_at).toLocaleString()}</td>
              <td>{new Date(s.updated_at).toLocaleTimeString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
