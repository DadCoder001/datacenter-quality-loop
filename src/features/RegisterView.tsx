import { useMemo, useState } from 'react';
import { useStore } from '../data/store';
import { OWNERS } from '../data/templates';
import { PHASES, SEVERITIES, SYSTEM_LABELS, phaseLabel } from '../domain/project';
import { ageDays, detectedPhase, SEVERITY_RANK, statusAt, visibleIssues } from '../domain/metrics';
import type { IssueStatus, PhaseId, Severity, SystemId } from '../domain/types';
import { Card, Empty, PhaseChip, SeverityChip, StatusChip } from '../components/ui';
import { issueHref } from '../components/router';

type SortKey = 'severity' | 'newest' | 'oldest' | 'age';

function NewIssueForm({ onDone }: { onDone: (id: string | null) => void }) {
  const createIssue = useStore((s) => s.createIssue);
  const issues = useStore((s) => s.issues);
  const day = useStore((s) => s.asOfDay);
  const families = useMemo(() => [...new Set(issues.map((i) => i.family))], [issues]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [family, setFamily] = useState('');
  const [system, setSystem] = useState<SystemId>('electrical');
  const [hall, setHall] = useState<'A' | 'B' | 'Site'>('Site');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [introduced, setIntroduced] = useState<PhaseId>('construction');
  const [owner, setOwner] = useState(OWNERS.construction);
  const [labor, setLabor] = useState(5000);
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError('Enter a short title.');
    if (!family.trim()) return setError('Enter an issue family (used to detect repeats).');
    const detected = PHASES.findIndex((p) => p.id === introduced);
    const current = PHASES.findIndex((p) => day >= p.startDay && day <= p.endDay);
    if (detected > current) return setError('A defect cannot be introduced in a phase that has not started yet.');
    const id = createIssue({ title: title.trim(), description: description.trim(), family: family.trim(), system, hall, severity, introducedPhase: introduced, owner, estimatedLaborUsd: labor });
    onDone(id);
  };

  return (
    <Card title={`Report a field issue (project day ${day})`}>
      <form onSubmit={submit} className="form" aria-label="New issue form">
        <label className="field wide"><span>Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Torque defects on UPS output breakers" /></label>
        <label className="field wide"><span>Description</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></label>
        <label className="field"><span>Issue family</span><input list="families" value={family} onChange={(e) => setFamily(e.target.value)} /></label>
        <datalist id="families">{families.map((f) => <option key={f} value={f} />)}</datalist>
        <label className="field"><span>System</span>
          <select value={system} onChange={(e) => setSystem(e.target.value as SystemId)}>
            {Object.entries(SYSTEM_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></label>
        <label className="field"><span>Location</span>
          <select value={hall} onChange={(e) => setHall(e.target.value as 'A' | 'B' | 'Site')}>
            <option value="Site">Site / plant</option><option value="A">Hall A</option><option value="B">Hall B</option>
          </select></label>
        <label className="field"><span>Severity</span>
          <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>{SEVERITIES.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label className="field"><span>Phase introduced</span>
          <select value={introduced} onChange={(e) => setIntroduced(e.target.value as PhaseId)}>{PHASES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
        <label className="field"><span>Initial owner</span>
          <select value={owner} onChange={(e) => setOwner(e.target.value)}>{Object.values(OWNERS).map((o) => <option key={o}>{o}</option>)}</select></label>
        <label className="field"><span>Est. rework labor if caught at design (USD)</span>
          <input type="number" min={0} step={500} value={labor} onChange={(e) => setLabor(Number(e.target.value))} /></label>
        {error ? <p role="alert" className="error wide">{error}</p> : null}
        <div className="form-actions wide">
          <button type="submit" className="btn primary">Report issue</button>
          <button type="button" className="btn" onClick={() => onDone(null)}>Cancel</button>
        </div>
      </form>
    </Card>
  );
}

export function RegisterView() {
  const issues = useStore((s) => s.issues);
  const day = useStore((s) => s.asOfDay);
  const [q, setQ] = useState('');
  const [phase, setPhase] = useState<'all' | PhaseId>('all');
  const [severity, setSeverity] = useState<'all' | Severity>('all');
  const [status, setStatus] = useState<'all' | 'open' | IssueStatus>('all');
  const [system, setSystem] = useState<'all' | SystemId>('all');
  const [sort, setSort] = useState<SortKey>('severity');
  const [creating, setCreating] = useState(false);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = visibleIssues(issues, day).filter((i) => {
      const st = statusAt(i, day);
      if (needle && !`${i.id} ${i.title} ${i.family} ${i.owner}`.toLowerCase().includes(needle)) return false;
      if (phase !== 'all' && detectedPhase(i) !== phase) return false;
      if (severity !== 'all' && i.severity !== severity) return false;
      if (system !== 'all' && i.system !== system) return false;
      if (status === 'open' && st === 'verified') return false;
      if (status !== 'all' && status !== 'open' && st !== status) return false;
      return true;
    });
    const cmp: Record<SortKey, (x: typeof list[number], y: typeof list[number]) => number> = {
      severity: (x, y) => SEVERITY_RANK[x.severity] - SEVERITY_RANK[y.severity] || y.reportedDay - x.reportedDay,
      newest: (x, y) => y.reportedDay - x.reportedDay,
      oldest: (x, y) => x.reportedDay - y.reportedDay,
      age: (x, y) => ageDays(y, day) - ageDays(x, day),
    };
    return list.sort(cmp[sort]);
  }, [issues, day, q, phase, severity, status, system, sort]);

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1>Issue register</h1>
          <p className="muted">Issues reported as of project day {day}. Open an issue to work it through root cause, actions and verification.</p>
        </div>
        <button type="button" className="btn primary" onClick={() => setCreating(true)}>+ Report issue</button>
      </div>
      {creating ? <NewIssueForm onDone={(id) => { setCreating(false); if (id) window.location.hash = `/issue/${id}`; }} /> : null}
      <Card>
        <div className="filters" role="search">
          <label className="field"><span>Search</span><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ID, title, family, owner" /></label>
          <label className="field"><span>Detected in</span>
            <select value={phase} onChange={(e) => setPhase(e.target.value as 'all' | PhaseId)} aria-label="Filter by detection phase">
              <option value="all">All phases</option>{PHASES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
          <label className="field"><span>Severity</span>
            <select value={severity} onChange={(e) => setSeverity(e.target.value as 'all' | Severity)} aria-label="Filter by severity">
              <option value="all">All</option>{SEVERITIES.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="field"><span>Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as 'all' | 'open' | IssueStatus)} aria-label="Filter by status">
              <option value="all">All</option><option value="open">Open (not verified)</option><option value="reported">Reported</option>
              <option value="investigating">Investigating</option><option value="actions_open">Actions in progress</option><option value="verified">Verified closed</option></select></label>
          <label className="field"><span>System</span>
            <select value={system} onChange={(e) => setSystem(e.target.value as 'all' | SystemId)} aria-label="Filter by system">
              <option value="all">All systems</option>{Object.entries(SYSTEM_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="field"><span>Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort issues">
              <option value="severity">Severity</option><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="age">Age (longest)</option></select></label>
        </div>
        {rows.length === 0 ? (
          <Empty>No issues match these filters at project day {day}.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table" data-testid="register-table">
              <thead>
                <tr><th>ID</th><th>Title</th><th>Severity</th><th>Status</th><th>Introduced</th><th>Detected</th><th>Owner</th><th>Age</th></tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.id} data-issue-row={i.id}>
                    <td><a href={issueHref(i.id)}>{i.id}</a></td>
                    <td>{i.title}<div className="muted small">{i.family} · {SYSTEM_LABELS[i.system]}</div></td>
                    <td><SeverityChip severity={i.severity} /></td>
                    <td><StatusChip status={statusAt(i, day)} /></td>
                    <td><PhaseChip phase={i.introducedPhase} /></td>
                    <td><PhaseChip phase={detectedPhase(i)} /></td>
                    <td>{i.owner}</td>
                    <td>{ageDays(i, day)} d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small">{rows.length} issue(s) shown · detection phases: {PHASES.map((p) => phaseLabel(p.id)).join(', ')}</p>
      </Card>
    </div>
  );
}
