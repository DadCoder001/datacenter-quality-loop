import { useMemo } from 'react';
import { useStore } from '../data/store';
import { preventedIssues } from '../data/materialize';
import { detectedPhase, fmtUsd, issueCost, totalCost, visibleIssues } from '../domain/metrics';
import { PHASES, phaseLabel } from '../domain/project';
import { Card, Empty } from '../components/ui';
import { issueHref } from '../components/router';

export function LearningView() {
  const issues = useStore((s) => s.issues);
  const lessons = useStore((s) => s.lessons);
  const day = useStore((s) => s.asOfDay);
  const a = useStore((s) => s.assumptions);

  const vis = useMemo(() => visibleIssues(issues, day), [issues, day]);
  const families = useMemo(() => {
    const m = new Map<string, typeof vis>();
    vis.forEach((i) => m.set(i.family, [...(m.get(i.family) ?? []), i]));
    return [...m.entries()].map(([family, list]) => ({
      family,
      list,
      cost: list.reduce((s, i) => s + totalCost(issueCost(i, a)), 0),
      phases: [...new Set(list.map((i) => PHASES.findIndex((p) => p.id === detectedPhase(i))))].sort().map((k) => PHASES[k].label.split(' ')[0]),
    })).sort((x, y) => y.list.length - x.list.length || y.cost - x.cost);
  }, [vis, a]);

  const available = lessons.filter((l) => {
    const src = issues.find((i) => i.id === l.sourceIssueId);
    return src?.verifiedDay !== undefined && src.verifiedDay <= day;
  });
  const prevented = useMemo(() => preventedIssues(), []);

  return (
    <div className="view">
      <div className="view-head"><div><h1>Learning</h1><p className="muted">Recurring issue families and the lessons that close the loop, as of project day {day}.</p></div></div>

      <Card title="Issue families">
        <table className="table" data-testid="family-table">
          <thead><tr><th>Family</th><th>Issues</th><th>Repeats</th><th>Detected in</th><th>Observed CoPQ</th></tr></thead>
          <tbody>
            {families.map((f) => (
              <tr key={f.family}>
                <td>{f.family}</td><td>{f.list.length}</td>
                <td>{f.list.length > 1 ? <span className="chip sev-high">{f.list.length - 1} repeat{f.list.length > 2 ? 's' : ''}</span> : '–'}</td>
                <td>{f.phases.join(', ')}</td><td>{fmtUsd(f.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {families.length === 0 ? <Empty>No issues reported yet.</Empty> : null}
      </Card>

      <h2 className="section-title">Lessons learned ({available.length})</h2>
      {available.length === 0 ? <Card><Empty>No lessons are available at this project day. Verify an issue and capture a lesson.</Empty></Card> : null}
      <div className="lessons" data-testid="lessons">
        {available.map((l) => {
          const src = issues.find((i) => i.id === l.sourceIssueId);
          const avoided = prevented.filter((p) => p.lessonId === l.id && p.issue.reportedDay <= day);
          const familyAfter = src ? issues.filter((i) => i.family === l.family && i.reportedDay > (src.verifiedDay ?? 0) && i.reportedDay <= day).length : 0;
          return (
            <Card key={l.id} title={l.title} className="lesson" >
              <p>{l.summary}</p>
              <p className="muted small">Family: {l.family} · Source: <a href={issueHref(l.sourceIssueId)}>{l.sourceIssueId}</a> · Applied from day {src?.verifiedDay}</p>
              {avoided.length ? (
                <div className="prevented">
                  <strong>Repeat avoided (simulated baseline)</strong>
                  <ul>
                    {avoided.map((p) => (
                      <li key={p.issue.id}>
                        Without this lesson, “{p.issue.title}” would have been found on day {p.issue.reportedDay} in {phaseLabel(detectedPhase(p.issue))}, est. {fmtUsd(totalCost(issueCost(p.issue, a)))} (estimate).
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="muted small">Issues in this family since: {familyAfter}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
