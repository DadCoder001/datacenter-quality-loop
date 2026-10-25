import { useEffect, useMemo, useRef, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../data/store';
import { MILESTONES, PHASES, PROJECT_LENGTH_DAYS, phaseLabel, phaseOfDay } from '../domain/project';
import { fmtUsd } from '../domain/metrics';
import type { Assumptions, Dataset } from '../domain/types';
import { baselineDataset, compareSeries, estimatedAvoided, eventsFor, stateAt } from '../sim/engine';
import { IsoRenderer } from '../render/IsoRenderer';
import { buildScene } from '../render/scene';
import { Card, Kpi } from '../components/ui';
import { issueHref } from '../components/router';
import { AssumptionsPanel } from './AssumptionsPanel';

const DAYS_PER_SECOND = 15;
const SPEEDS = [0.5, 1, 2, 4];

function Timeline({ day, onChange }: { day: number; onChange: (d: number) => void }) {
  const total = PROJECT_LENGTH_DAYS + 1;
  return (
    <div className="timeline">
      <div className="timeline-bands" aria-hidden="true">
        {PHASES.map((p) => (
          <div key={p.id} className={`band ${phaseOfDay(day) === p.id ? 'active' : ''}`} style={{ width: `${((p.endDay - p.startDay + 1) / total) * 100}%` }}>
            {p.label}
          </div>
        ))}
        {MILESTONES.map((m) => (
          <span key={m.id} className="milestone-tick" style={{ left: `${(m.plannedDay / total) * 100}%` }} title={`${m.name} (planned day ${m.plannedDay})`}>
            ◆
          </span>
        ))}
      </div>
      <input
        aria-label="Project day"
        className="scrubber"
        type="range"
        min={0}
        max={PROJECT_LENGTH_DAYS}
        step={1}
        value={day}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function ScenarioPanel({ title, subtitle, ds, day, a, variant, linkIssues }: { title: string; subtitle: string; ds: Dataset; day: number; a: Assumptions; variant: 'off' | 'on'; linkIssues: boolean }) {
  const state = useMemo(() => stateAt(ds, day, a), [ds, day, a]);
  const scene = useMemo(() => buildScene(ds, day), [ds, day]);
  const events = useMemo(() => eventsFor(ds), [ds]);
  const recent = events.filter((e) => e.day <= day).slice(-5).reverse();
  const atRisk = state.milestones.filter((m) => m.atRisk).length;
  const slip = state.slipDays;
  return (
    <Card className={`scenario ${variant}`} title={title} actions={<span className="muted">{subtitle}</span>}>
      <div data-testid={`scene-${variant}`}>
        <IsoRenderer
          scene={scene}
          title={title}
          onSelectIssue={linkIssues ? (id) => (window.location.hash = issueHref(id).slice(1)) : undefined}
        />
      </div>
      <div className="kpi-row">
        <Kpi id={`${variant}-reported`} label="Issues reported / open" value={`${state.reportedIssues} / ${state.openIssues}`} />
        <Kpi id={`${variant}-copq`} label="Observed CoPQ" value={fmtUsd(state.copqTotal)} tone={variant === 'off' ? 'bad' : undefined} />
        <Kpi id={`${variant}-ready`} label="Forecast ready-for-service" value={`Day ${Math.round(state.forecastReadyDay * 10) / 10}`} sub={slip > 0 ? `+${slip} days vs plan` : 'on plan'} tone={slip >= a.atRiskSlipDays ? 'bad' : undefined} />
        <Kpi id={`${variant}-risk`} label="Milestones at risk" value={atRisk} sub={`${state.actions.overdue} overdue actions`} />
      </div>
      <h3 className="feed-title">Recent events</h3>
      <ul className="feed" data-testid={`feed-${variant}`}>
        {recent.length === 0 ? <li className="muted">Nothing reported yet.</li> : null}
        {recent.map((e) => (
          <li key={`${e.day}-${e.issueId}-${e.type}`}>
            <span className="feed-day">Day {e.day}</span>{' '}
            {linkIssues ? <a href={issueHref(e.issueId)}>{e.text}</a> : e.text}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function SimulationView() {
  const issues = useStore((s) => s.issues);
  const actions = useStore((s) => s.actions);
  const day = useStore((s) => s.asOfDay);
  const setDay = useStore((s) => s.setAsOfDay);
  const a = useStore((s) => s.assumptions);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const dayRef = useRef(day);

  const onDs = useMemo<Dataset>(() => ({ issues, actions, lessons: [] }), [issues, actions]);
  const offDs = baselineDataset();
  const series = useMemo(() => compareSeries(onDs, offDs, a), [onDs, offDs, a]);
  const avoided = useMemo(() => estimatedAvoided(a, day), [a, day]);

  useEffect(() => {
    if (Math.floor(dayRef.current) !== day) dayRef.current = day;
  }, [day]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      dayRef.current = Math.min(PROJECT_LENGTH_DAYS, dayRef.current + dt * DAYS_PER_SECOND * speed);
      const d = Math.floor(dayRef.current);
      if (d !== useStore.getState().asOfDay) setDay(d);
      if (dayRef.current >= PROJECT_LENGTH_DAYS) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, setDay]);

  const togglePlay = () => {
    if (!playing && day >= PROJECT_LENGTH_DAYS) {
      dayRef.current = 0;
      setDay(0);
    }
    setPlaying((p) => !p);
  };
  const step = (n: number) => {
    setPlaying(false);
    setDay(day + n);
  };

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1>Lifecycle simulation: design to handover</h1>
          <p className="muted">
            The same fictional project played twice. Left: issues are found late and lessons are not carried forward. Right:
            closed-loop learning finds them earlier and prevents repeats. Scripted and deterministic; an illustration, not a forecast.
          </p>
        </div>
      </div>

      <Card className="controls">
        <div className="control-row">
          <button type="button" className="btn primary" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? '❚❚ Pause' : '▶ Play'}
          </button>
          <button type="button" className="btn" onClick={() => step(-5)} aria-label="Step back 5 days">
            −5 d
          </button>
          <button type="button" className="btn" onClick={() => step(5)} aria-label="Step forward 5 days">
            +5 d
          </button>
          <label className="field inline">
            <span>Speed</span>
            <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Playback speed">
              {SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {s}×
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn" onClick={() => { setPlaying(false); setDay(0); }}>
            Restart
          </button>
          <div className="day-readout" data-testid="day-readout">
            Day <strong>{day}</strong> of {PROJECT_LENGTH_DAYS} · {phaseLabel(phaseOfDay(day))}
          </div>
        </div>
        <Timeline day={day} onChange={(d) => { setPlaying(false); setDay(d); }} />
        <p className="legend">
          <span className="swatch planned" /> planned <span className="swatch building" /> under construction <span className="swatch healthy" /> built
          <span className="swatch issue" /> open issue (marker ! = click to open) <span className="swatch verified" /> verified closed{' '}
          <span className="swatch lit" /> energized racks · ◆ planned milestone
        </p>
      </Card>

      <div className="compare">
        <ScenarioPanel title="Without closed-loop learning" subtitle="Baseline" ds={offDs} day={day} a={a} variant="off" linkIssues={false} />
        <ScenarioPanel title="With closed-loop learning" subtitle="Click a marker to open the issue" ds={onDs} day={day} a={a} variant="on" linkIssues />
      </div>

      <Card title="Observed vs. estimated" className="avoided" >
        <div className="kpi-row">
          <Kpi id="avoided" label="Estimated cost avoided so far" value={fmtUsd(avoided.total)} sub="Counterfactual estimate under the assumptions below; kept separate from observed CoPQ" tone="good" />
          <Kpi label="…from earlier detection" value={fmtUsd(avoided.fromEarlierDetection)} sub="Same issue, found in an earlier phase" />
          <Kpi label="…from prevented repeats" value={fmtUsd(avoided.fromPrevention)} sub="Repeat issues avoided by an applied lesson" />
        </div>
        <p className="muted">
          Impact on total cost of ownership (TCO) is potential only: fewer defects handed to operations should reduce later repair and
          disruption, but the demo data does not prove a TCO result.
        </p>
      </Card>

      <div className="charts">
        <Card title="Cumulative observed CoPQ">
          <div className="chart" data-testid="chart-copq">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={series} margin={{ left: 8, right: 16, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" type="number" domain={[0, PROJECT_LENGTH_DAYS]} />
                <YAxis tickFormatter={(v: number) => fmtUsd(v)} width={64} />
                <Tooltip formatter={(v: number) => fmtUsd(v)} labelFormatter={(d) => `Day ${d}`} />
                <Legend />
                <ReferenceLine x={day} stroke="#37474f" strokeDasharray="4 2" />
                <Line type="stepAfter" dataKey="off" name="Without loop" stroke="#c62828" dot={false} strokeWidth={2} isAnimationActive={false} />
                <Line type="stepAfter" dataKey="on" name="With loop" stroke="#1b7f5a" dot={false} strokeWidth={2} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Forecast schedule slip at ready-for-service (days)">
          <div className="chart" data-testid="chart-slip">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={series} margin={{ left: 8, right: 16, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" type="number" domain={[0, PROJECT_LENGTH_DAYS]} />
                <YAxis width={40} />
                <Tooltip labelFormatter={(d) => `Day ${d}`} />
                <Legend />
                <ReferenceLine x={day} stroke="#37474f" strokeDasharray="4 2" />
                <Line type="stepAfter" dataKey="offSlip" name="Without loop" stroke="#c62828" dot={false} strokeWidth={2} isAnimationActive={false} />
                <Line type="stepAfter" dataKey="onSlip" name="With loop" stroke="#1b7f5a" dot={false} strokeWidth={2} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <AssumptionsPanel />
    </div>
  );
}
