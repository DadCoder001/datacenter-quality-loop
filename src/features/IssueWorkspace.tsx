import { useState } from 'react';
import { useStore } from '../data/store';
import { OWNERS } from '../data/templates';
import { PHASES, SEVERITIES, SYSTEM_LABELS, phaseIndex, phaseLabel } from '../domain/project';
import {
  actionDone,
  actionOverdue,
  actionsVisible,
  ageDays,
  detectedPhase,
  detectionLagPhases,
  fmtUsd,
  issueCost,
  statusAt,
  totalCost,
} from '../domain/metrics';
import type { Action, Issue, Severity } from '../domain/types';
import { Card, Empty, PhaseChip, SeverityChip, StatusChip } from '../components/ui';
import { issueHref } from '../components/router';

const STEPS = ['Reported', 'Triaged', 'Root cause', 'Actions done', 'Verified'] as const;

const stepIndex = (status: ReturnType<typeof statusAt>): number =>
  ({ not_reported: -1, reported: 0, investigating: 1, actions_open: 2, verified: 4 })[status];

function Stepper({ issue, day }: { issue: Issue; day: number }) {
  const status = statusAt(issue, day);
  const idx = stepIndex(status);
  return (
    <ol className="stepper" aria-label="Closed-loop progress">
      {STEPS.map((s, n) => (
        <li key={s} className={n <= idx ? 'done' : n === idx + 1 ? 'next' : ''}>
          <span className="dot" aria-hidden="true">{n <= idx ? '✓' : n + 1}</span> {s}
        </li>
      ))}
    </ol>
  );
}

function TriageForm({ issue }: { issue: Issue }) {
  const triage = useStore((s) => s.triageIssue);
  const [owner, setOwner] = useState(issue.owner);
  const [severity, setSeverity] = useState<Severity>(issue.severity);
  return (
    <Card title="Step 1: Triage">
      <p className="muted">Confirm severity, assign an accountable owner and start the investigation.</p>
      <div className="form">
        <label className="field"><span>Severity</span>
          <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>{SEVERITIES.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label className="field"><span>Owner</span>
          <select value={owner} onChange={(e) => setOwner(e.target.value)}>
            {[...new Set([...Object.values(OWNERS), issue.owner])].map((o) => <option key={o}>{o}</option>)}</select></label>
        <div className="form-actions wide"><button type="button" className="btn primary" onClick={() => triage(issue.id, owner, severity)}>Triage and start investigation</button></div>
      </div>
    </Card>
  );
}

function RootCauseForm({ issue }: { issue: Issue }) {
  const save = useStore((s) => s.recordRootCause);
  const [whys, setWhys] = useState<string[]>(['', '', '', '', '']);
  const [root, setRoot] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    const filled = whys.map((w) => w.trim()).filter(Boolean);
    if (filled.length < 2) return setError('Provide at least two "why" answers.');
    if (!root.trim()) return setError('State the root cause.');
    save(issue.id, { whys: filled, rootCause: root.trim() });
  };
  return (
    <Card title="Step 2: Root cause (5 Whys)">
      <p className="muted">Ask why repeatedly until you reach a process or system cause, not a person.</p>
      <div className="form">
        {whys.map((w, n) => (
          <label key={n} className="field wide"><span>Why {n + 1}?</span>
            <input value={w} onChange={(e) => setWhys(whys.map((x, k) => (k === n ? e.target.value : x)))} /></label>
        ))}
        <label className="field wide"><span>Root cause statement</span><textarea rows={2} value={root} onChange={(e) => setRoot(e.target.value)} /></label>
        {error ? <p role="alert" className="error wide">{error}</p> : null}
        <div className="form-actions wide"><button type="button" className="btn primary" onClick={submit}>Save root cause</button></div>
      </div>
    </Card>
  );
}

function ActionsCard({ issue, actions, day, editable }: { issue: Issue; actions: Action[]; day: number; editable: boolean }) {
  const addAction = useStore((s) => s.addAction);
  const complete = useStore((s) => s.completeAction);
  const [kind, setKind] = useState<Action['kind']>('corrective');
  const [title, setTitle] = useState('');
  const [owner, setOwner] = useState(issue.owner);
  const [due, setDue] = useState(7);
  const mine = actionsVisible(actions, day).filter((a) => a.issueId === issue.id);
  return (
    <Card title="Corrective and preventative actions">
      {mine.length === 0 ? <Empty>No actions yet.</Empty> : (
        <table className="table" data-testid="issue-actions">
          <thead><tr><th>Type</th><th>Action</th><th>Owner</th><th>Due</th><th>Status</th><th /></tr></thead>
          <tbody>
            {mine.map((a) => {
              const done = actionDone(a, day);
              const late = actionOverdue(a, day);
              return (
                <tr key={a.id} data-action={a.id}>
                  <td><span className={`chip ${a.kind === 'preventative' ? 'kind-prev' : 'kind-corr'}`}>{a.kind}</span></td>
                  <td>{a.title}</td><td>{a.owner}</td><td>Day {a.dueDay}</td>
                  <td>{done ? <span className="chip st-verified">● Done</span> : late ? <span className="chip sev-high">Overdue</span> : <span className="chip st-reported">Open</span>}</td>
                  <td>{editable && !done ? <button type="button" className="btn small" onClick={() => complete(a.id)}>Mark done</button> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {editable ? (
        <div className="form add-action">
          <label className="field"><span>Type</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as Action['kind'])}><option value="corrective">corrective (fix this instance)</option><option value="preventative">preventative (stop recurrence)</option></select></label>
          <label className="field wide"><span>Action</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What will be done?" /></label>
          <label className="field"><span>Owner</span>
            <select value={owner} onChange={(e) => setOwner(e.target.value)}>{[...new Set([...Object.values(OWNERS), issue.owner])].map((o) => <option key={o}>{o}</option>)}</select></label>
          <label className="field"><span>Due in (days)</span><input type="number" min={1} value={due} onChange={(e) => setDue(Number(e.target.value))} /></label>
          <div className="form-actions wide"><button type="button" className="btn" disabled={!title.trim()} onClick={() => { addAction(issue.id, kind, title.trim(), owner, due); setTitle(''); }}>Add action</button></div>
        </div>
      ) : null}
    </Card>
  );
}

function VerifyForm({ issue }: { issue: Issue }) {
  const verify = useStore((s) => s.verifyIssue);
  const [note, setNote] = useState('');
  const [effective, setEffective] = useState(true);
  const [msg, setMsg] = useState('');
  return (
    <Card title="Step 4: Verify the fix worked">
      <p className="muted">Close the loop only with evidence: re-inspection, retest or a monitoring period. Completing tasks is not verification.</p>
      <div className="form">
        <label className="field wide"><span>Verification evidence</span><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <label className="field"><span><input type="checkbox" checked={effective} onChange={(e) => setEffective(e.target.checked)} /> Fix confirmed effective</span></label>
        {msg ? <p role="alert" className="error wide">{msg}</p> : null}
        <div className="form-actions wide">
          <button type="button" className="btn primary" onClick={() => {
            if (!note.trim()) return setMsg('Describe the verification evidence.');
            const r = verify(issue.id, note.trim(), effective);
            setMsg(r.ok ? '' : r.reason ?? 'Cannot verify yet.');
          }}>Verify and close</button>
        </div>
      </div>
    </Card>
  );
}

function LessonForm({ issue }: { issue: Issue }) {
  const add = useStore((s) => s.addLesson);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  return (
    <Card title="Step 5: Capture the lesson">
      <p className="muted">Write what other projects and teams should do differently. It will appear in the learning view.</p>
      <div className="form">
        <label className="field wide"><span>Lesson title</span><input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="field wide"><span>What to do differently</span><textarea rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} /></label>
        <div className="form-actions wide"><button type="button" className="btn primary" disabled={!title.trim() || !summary.trim()} onClick={() => add(issue.id, title.trim(), summary.trim())}>Save lesson</button></div>
      </div>
    </Card>
  );
}

export function IssueWorkspace({ id }: { id: string }) {
  const issues = useStore((s) => s.issues);
  const actions = useStore((s) => s.actions);
  const lessons = useStore((s) => s.lessons);
  const day = useStore((s) => s.asOfDay);
  const a = useStore((s) => s.assumptions);
  const setDay = useStore((s) => s.setAsOfDay);
  const issue = issues.find((i) => i.id === id);

  if (!issue) {
    return <div className="view"><Card title="Issue not found"><p>No issue with ID {id}.</p><a href="#/register">Back to register</a></Card></div>;
  }
  if (issue.reportedDay > day) {
    return (
      <div className="view"><Card title={`${issue.id} has not been reported yet`}>
        <p>This issue is first reported on project day {issue.reportedDay}; the project is currently at day {day}.</p>
        <button type="button" className="btn primary" onClick={() => setDay(issue.reportedDay)}>Jump to day {issue.reportedDay}</button>{' '}
        <a href="#/register">Back to register</a></Card></div>
    );
  }

  const status = statusAt(issue, day);
  const observed = issueCost(issue, a);
  const introIdx = phaseIndex(issue.introducedPhase);
  const early = issueCost({ ...issue, reportedDay: PHASES[introIdx].startDay }, a);
  const lag = detectionLagPhases(issue);
  const related = issues.filter((i) => i.family === issue.family && i.id !== issue.id && i.reportedDay <= day);
  const priorLessons = lessons.filter((l) => {
    const src = issues.find((i) => i.id === l.sourceIssueId);
    return l.family === issue.family && src && src.verifiedDay !== undefined && src.verifiedDay <= day && src.id !== issue.id;
  });
  const ownLesson = lessons.find((l) => l.id === issue.lessonId && l.sourceIssueId === issue.id);
  const rc = issue.rootCauseDay !== undefined && issue.rootCauseDay <= day ? issue.rootCause : undefined;
  const mine = actionsVisible(actions, day).filter((x) => x.issueId === issue.id);
  const allDone = mine.length > 0 && mine.every((x) => actionDone(x, day));

  const timeline: { day: number; text: string }[] = [{ day: issue.reportedDay, text: `Reported (${phaseLabel(detectedPhase(issue))})` }];
  if (issue.triagedDay !== undefined && issue.triagedDay <= day) timeline.push({ day: issue.triagedDay, text: `Triaged; owner ${issue.owner}` });
  if (issue.rootCauseDay !== undefined && issue.rootCauseDay <= day) timeline.push({ day: issue.rootCauseDay, text: 'Root cause documented; actions assigned' });
  mine.filter((x) => actionDone(x, day)).forEach((x) => timeline.push({ day: x.completedDay as number, text: `Action done: ${x.title}` }));
  if (issue.verifiedDay !== undefined && issue.verifiedDay <= day) timeline.push({ day: issue.verifiedDay, text: issue.verification ? 'Verified closed' : 'Closed (no structured verification)' });
  timeline.sort((x, y) => x.day - y.day);

  return (
    <div className="view" data-testid="issue-workspace" data-issue-id={issue.id}>
      <p><a href="#/register">← Register</a></p>
      <div className="view-head">
        <div>
          <h1>{issue.id}: {issue.title}</h1>
          <p className="chips"><SeverityChip severity={issue.severity} /> <StatusChip status={status} /> <PhaseChip phase={issue.introducedPhase} /> → <PhaseChip phase={detectedPhase(issue)} /></p>
        </div>
      </div>
      <Stepper issue={issue} day={day} />

      <div className="two-col">
        <Card title="Details">
          <p>{issue.description}</p>
          <dl className="dl">
            <dt>Family</dt><dd>{issue.family}</dd>
            <dt>System</dt><dd>{SYSTEM_LABELS[issue.system]} · {issue.hall === 'Site' ? 'Site / plant' : `Hall ${issue.hall}`}</dd>
            <dt>Owner</dt><dd>{issue.owner}</dd>
            <dt>Age</dt><dd>{ageDays(issue, day)} days</dd>
            <dt>Escape</dt><dd>{lag === 0 ? 'Caught in the phase it was introduced.' : `Escaped ${lag} phase${lag > 1 ? 's' : ''} before detection.`}</dd>
            <dt>Evidence</dt><dd>{issue.evidence.length ? issue.evidence.join('; ') : 'None attached'}</dd>
          </dl>
        </Card>
        <Card title="Cost impact">
          <table className="table" data-testid="issue-cost">
            <tbody>
              <tr><td>Rework labor</td><td>{fmtUsd(observed.rework_labor)}</td></tr>
              <tr><td>Materials</td><td>{fmtUsd(observed.materials)}</td></tr>
              <tr><td>Retest</td><td>{fmtUsd(observed.retest)}</td></tr>
              <tr><td>Schedule delay</td><td>{fmtUsd(observed.delay)}</td></tr>
              <tr><th>Observed CoPQ</th><th>{fmtUsd(totalCost(observed))}</th></tr>
            </tbody>
          </table>
          {lag > 0 ? (
            <p className="muted">Estimate if caught in {phaseLabel(issue.introducedPhase)}: {fmtUsd(totalCost(early))} (assumption-based; not part of observed CoPQ).</p>
          ) : null}
        </Card>
      </div>

      {status === 'reported' ? <TriageForm issue={issue} /> : null}
      {status === 'investigating' ? <RootCauseForm issue={issue} /> : null}

      {rc ? (
        <Card title="Root cause">
          <ol className="whys">{rc.whys.map((w, n) => <li key={n}><strong>Why?</strong> {w}</li>)}</ol>
          <p><strong>Root cause:</strong> {rc.rootCause}</p>
        </Card>
      ) : null}

      {status === 'actions_open' || status === 'verified' || mine.length > 0 ? (
        <ActionsCard issue={issue} actions={actions} day={day} editable={status === 'actions_open'} />
      ) : null}
      {status === 'actions_open' ? (allDone ? <VerifyForm issue={issue} /> : <Card title="Step 4: Verify the fix worked"><p className="muted">Complete all actions to enable verification.</p></Card>) : null}
      {status === 'verified' ? (
        <Card title="Verification">
          <p>{issue.verification ? issue.verification.note : 'Closed without a structured verification record.'}</p>
          {issue.verification ? <p><span className={`chip ${issue.verification.effective ? 'st-verified' : 'sev-high'}`}>{issue.verification.effective ? 'Fix confirmed effective' : 'Fix not effective'}</span></p> : null}
        </Card>
      ) : null}
      {status === 'verified' && !ownLesson && issue.verification ? <LessonForm issue={issue} /> : null}
      {ownLesson ? <Card title="Lesson captured"><h3>{ownLesson.title}</h3><p>{ownLesson.summary}</p></Card> : null}

      <div className="two-col">
        <Card title="Timeline">
          <ul className="timeline-list">{timeline.map((t, n) => <li key={n}><span className="feed-day">Day {t.day}</span> {t.text}</li>)}</ul>
        </Card>
        <Card title="Related history (same family)">
          {priorLessons.length ? priorLessons.map((l) => <p key={l.id} className="lesson-hint">Lesson available: <strong>{l.title}</strong></p>) : null}
          {related.length === 0 ? <Empty>No other issues in this family yet.</Empty> : (
            <ul>{related.map((r) => <li key={r.id}><a href={issueHref(r.id)}>{r.id}</a> {r.title} · <StatusChip status={statusAt(r, day)} /></li>)}</ul>
          )}
        </Card>
      </div>
    </div>
  );
}
