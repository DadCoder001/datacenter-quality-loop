import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../data/store';
import { PHASES, phaseLabel } from '../domain/project';
import {
  actionOverdue,
  actionStats,
  actionsVisible,
  avgTimeToTriage,
  avgTimeToVerifiedClosure,
  detectedPhase,
  fmtUsd,
  isHighRisk,
  isOpen,
  issueCost,
  milestoneForecasts,
  observedCoPQ,
  repeatIssueRate,
  SEVERITY_RANK,
  statusAt,
  totalCost,
  visibleIssues,
} from '../domain/metrics';
import { estimatedAvoided } from '../sim/engine';
import { Card, Empty, Kpi, SeverityChip, StatusChip } from '../components/ui';
import { issueHref } from '../components/router';
import { SEVERITIES } from '../domain/project';

const fmtDays = (n: number | null): string => (n === null ? '–' : `${n.toFixed(1)} d`);
const fmtPct = (n: number | null): string => (n === null ? '–' : `${Math.round(n * 100)}%`);

const SEV_FILL = { critical: '#c62828', high: '#ef6c00', medium: '#f9a825', low: '#5c7a99' } as const;

export function DashboardView() {
  const issues = useStore((s) => s.issues);
  const actions = useStore((s) => s.actions);
  const day = useStore((s) => s.asOfDay);
  const a = useStore((s) => s.assumptions);

  const vis = useMemo(() => visibleIssues(issues, day), [issues, day]);
  const open = vis.filter((i) => isOpen(i, day));
  const highRiskOpen = open.filter(isHighRisk);
  const stats = actionStats(actions, day);
  const copq = observedCoPQ(issues, a, day);
  const avoided = estimatedAvoided(a, day);
  const forecasts = milestoneForecasts(issues, a, day);
  const atRisk = forecasts.filter((m) => m.atRisk).length;

  const byPhase = PHASES.map((p) => {
    const row: Record<string, string | number> = { phase: p.label.split(' ')[0] };
    SEVERITIES.forEach((s) => (row[s] = vis.filter((i) => detectedPhase(i) === p.id && i.severity === s).length));
    return row;
  });

  const costByPhase = PHASES.map((p) => {
    const row = { phase: p.label.split(' ')[0], rework_labor: 0, materials: 0, retest: 0, delay: 0 };
    vis.filter((i) => detectedPhase(i) === p.id).forEach((i) => {
      const c = issueCost(i, a);
      row.rework_labor += c.rework_labor;
      row.materials += c.materials;
      row.retest += c.retest;
      row.delay += c.delay;
    });
    return row;
  });

  const matrix = PHASES.map((intro) => PHASES.map((det) => vis.filter((i) => i.introducedPhase === intro.id && detectedPhase(i) === det.id).length));
  const maxCell = Math.max(1, ...matrix.flat());

  const watch = [...highRiskOpen].sort((x, y) => SEVERITY_RANK[x.severity] - SEVERITY_RANK[y.severity] || x.reportedDay - y.reportedDay);
  const overdue = actionsVisible(actions, day).filter((x) => actionOverdue(x, day));

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1>Portfolio dashboard</h1>
          <p className="muted">Project Meridian (fictional) as of project day {day}. All figures are computed from the same records as the register and simulation.</p>
        </div>
      </div>

      <div className="kpi-grid">
        <Kpi id="open" label="Open issues" value={open.length} sub={`${vis.length} reported in total`} />
        <Kpi id="highrisk" label="High-risk open (critical / high)" value={highRiskOpen.length} tone={highRiskOpen.length ? 'bad' : 'good'} />
        <Kpi id="overdue" label="Overdue actions" value={stats.overdue} sub={`${fmtPct(stats.overdueRate)} of ${stats.total} actions`} tone={stats.overdue ? 'bad' : 'good'} />
        <Kpi id="completion" label="Action completion" value={fmtPct(stats.completionRate)} sub={`Preventative: ${stats.preventativeDone}/${stats.preventativeTotal}`} />
        <Kpi id="triage" label="Avg time to triage" value={fmtDays(avgTimeToTriage(issues, day))} />
        <Kpi id="closure" label="Avg time to verified closure" value={fmtDays(avgTimeToVerifiedClosure(issues, day))} />
        <Kpi id="repeat" label="Repeat-issue rate" value={fmtPct(repeatIssueRate(issues, day))} sub="Issues repeating an already-seen family" />
        <Kpi id="milestones" label="Milestones at risk" value={atRisk} sub={`Forecast ready: day ${forecasts[forecasts.length - 1].forecastDay}`} tone={atRisk ? 'warn' : 'good'} />
      </div>

      <div className="two-col">
        <Card title="Cost of poor quality">
          <div className="kpi-row">
            <Kpi id="copq" label="Observed CoPQ" value={fmtUsd(totalCost(copq))} sub="Recorded rework, materials, retest and delay (assumption-based rates)" />
            <Kpi id="avoided" label="Estimated cost avoided" value={fmtUsd(avoided.total)} sub="Counterfactual estimate, shown separately" tone="good" />
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={costByPhase} margin={{ left: 8, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="phase" />
                <YAxis tickFormatter={(v: number) => fmtUsd(v)} width={64} />
                <Tooltip formatter={(v: number) => fmtUsd(v)} />
                <Legend />
                <Bar dataKey="rework_labor" name="Rework labor" stackId="c" fill="#37474f" isAnimationActive={false} />
                <Bar dataKey="materials" name="Materials" stackId="c" fill="#78909c" isAnimationActive={false} />
                <Bar dataKey="retest" name="Retest" stackId="c" fill="#90a4ae" isAnimationActive={false} />
                <Bar dataKey="delay" name="Delay" stackId="c" fill="#c62828" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="muted">By phase where the issue was detected.</p>
        </Card>
        <Card title="Issues by detection phase and severity">
          <div className="chart">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byPhase} margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="phase" />
                <YAxis allowDecimals={false} width={32} />
                <Tooltip />
                <Legend />
                {SEVERITIES.map((s) => (
                  <Bar key={s} dataKey={s} stackId="s" fill={SEV_FILL[s]} isAnimationActive={false} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="two-col">
        <Card title="Where defects are introduced vs. where they are found">
          <table className="matrix" data-testid="escape-matrix">
            <thead>
              <tr>
                <th>Introduced ↓ / Detected →</th>
                {PHASES.map((p) => (
                  <th key={p.id}>{p.label.split(' ')[0]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PHASES.map((intro, r) => (
                <tr key={intro.id}>
                  <th>{intro.label}</th>
                  {PHASES.map((det, c) => {
                    const n = matrix[r][c];
                    const late = c > r;
                    return (
                      <td key={det.id} style={{ background: n && late ? `rgba(198,40,40,${0.12 + (0.5 * n) / maxCell})` : n ? `rgba(27,127,90,${0.12 + (0.4 * n) / maxCell})` : undefined }}>
                        {n || ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted">Green: found in the phase it was introduced. Red: escaped to a later phase, where fixing costs more.</p>
        </Card>
        <Card title="Milestones: planned vs. forecast">
          <table className="table" data-testid="milestone-table">
            <thead>
              <tr>
                <th>Milestone</th>
                <th>Planned</th>
                <th>Forecast</th>
                <th>Slip</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {forecasts.map((f) => (
                <tr key={f.milestone.id}>
                  <td>{f.milestone.name}</td>
                  <td>Day {f.milestone.plannedDay}</td>
                  <td>Day {f.forecastDay}</td>
                  <td>{f.slipDays > 0 ? `+${f.slipDays} d` : '–'}</td>
                  <td>{f.atRisk ? <span className="chip sev-high">At risk</span> : <span className="chip st-verified">On track</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted">Forecast slip reflects only issues reported so far.</p>
        </Card>
      </div>

      <div className="two-col">
        <Card title="Watchlist: open high-risk issues">
          {watch.length === 0 ? (
            <Empty>No open critical or high issues at this project day.</Empty>
          ) : (
            <table className="table" data-testid="watchlist">
              <tbody>
                {watch.map((i) => (
                  <tr key={i.id}>
                    <td><a href={issueHref(i.id)}>{i.id}</a></td>
                    <td>{i.title}</td>
                    <td><SeverityChip severity={i.severity} /></td>
                    <td><StatusChip status={statusAt(i, day)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card title="Overdue actions">
          {overdue.length === 0 ? (
            <Empty>No overdue actions at this project day.</Empty>
          ) : (
            <table className="table" data-testid="overdue-list">
              <tbody>
                {overdue.map((x) => (
                  <tr key={x.id}>
                    <td><a href={issueHref(x.issueId)}>{x.issueId}</a></td>
                    <td>{x.title}</td>
                    <td>{x.owner}</td>
                    <td>{day - x.dueDay} d late</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="muted">Phase labels: {PHASES.map((p) => phaseLabel(p.id)).join(' → ')}</p>
        </Card>
      </div>
    </div>
  );
}
