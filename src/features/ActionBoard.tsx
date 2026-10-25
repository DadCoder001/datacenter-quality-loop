import { useMemo, useState } from 'react';
import { useStore } from '../data/store';
import { OWNERS } from '../data/templates';
import { actionDone, actionOverdue, actionsVisible } from '../domain/metrics';
import type { Action } from '../domain/types';
import { Card, Empty } from '../components/ui';
import { issueHref } from '../components/router';

function ActionCard({ a, day, onDone }: { a: Action; day: number; onDone?: () => void }) {
  const late = actionOverdue(a, day);
  return (
    <li className={`action-card ${late ? 'late' : ''}`} data-action={a.id}>
      <div><a href={issueHref(a.issueId)}>{a.issueId}</a> <span className={`chip ${a.kind === 'preventative' ? 'kind-prev' : 'kind-corr'}`}>{a.kind}</span></div>
      <div className="action-title">{a.title}</div>
      <div className="muted small">{a.owner} · due day {a.dueDay}{late ? ` · ${day - a.dueDay} d overdue` : ''}{a.completedDay !== undefined && actionDone(a, day) ? ` · done day ${a.completedDay}` : ''}</div>
      {onDone ? <button type="button" className="btn small" onClick={onDone}>Mark done</button> : null}
    </li>
  );
}

export function ActionBoard() {
  const actions = useStore((s) => s.actions);
  const day = useStore((s) => s.asOfDay);
  const complete = useStore((s) => s.completeAction);
  const [owner, setOwner] = useState('all');
  const [kind, setKind] = useState<'all' | Action['kind']>('all');

  const vis = useMemo(
    () => actionsVisible(actions, day).filter((a) => (owner === 'all' || a.owner === owner) && (kind === 'all' || a.kind === kind)),
    [actions, day, owner, kind],
  );
  const overdue = vis.filter((a) => actionOverdue(a, day)).sort((x, y) => x.dueDay - y.dueDay);
  const open = vis.filter((a) => !actionDone(a, day) && !actionOverdue(a, day)).sort((x, y) => x.dueDay - y.dueDay);
  const done = vis.filter((a) => actionDone(a, day)).sort((x, y) => (y.completedDay ?? 0) - (x.completedDay ?? 0));
  const owners = [...new Set([...Object.values(OWNERS), ...actions.map((a) => a.owner)])];

  return (
    <div className="view">
      <div className="view-head"><div><h1>Action board</h1><p className="muted">Corrective and preventative actions as of project day {day}.</p></div></div>
      <Card>
        <div className="filters">
          <label className="field"><span>Owner</span><select value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Filter by owner"><option value="all">All owners</option>{owners.map((o) => <option key={o}>{o}</option>)}</select></label>
          <label className="field"><span>Type</span><select value={kind} onChange={(e) => setKind(e.target.value as 'all' | Action['kind'])} aria-label="Filter by action type"><option value="all">All</option><option value="corrective">Corrective</option><option value="preventative">Preventative</option></select></label>
        </div>
      </Card>
      <div className="board">
        <Card title={`Overdue (${overdue.length})`} className="col overdue-col">
          {overdue.length ? <ul className="cards" data-testid="col-overdue">{overdue.map((a) => <ActionCard key={a.id} a={a} day={day} onDone={() => complete(a.id)} />)}</ul> : <Empty>Nothing overdue.</Empty>}
        </Card>
        <Card title={`Open (${open.length})`} className="col">
          {open.length ? <ul className="cards" data-testid="col-open">{open.map((a) => <ActionCard key={a.id} a={a} day={day} onDone={() => complete(a.id)} />)}</ul> : <Empty>No open actions.</Empty>}
        </Card>
        <Card title={`Done (${done.length})`} className="col">
          {done.length ? <ul className="cards" data-testid="col-done">{done.slice(0, 12).map((a) => <ActionCard key={a.id} a={a} day={day} />)}</ul> : <Empty>None completed yet.</Empty>}
          {done.length > 12 ? <p className="muted small">Showing the 12 most recent of {done.length}.</p> : null}
        </Card>
      </div>
    </div>
  );
}
