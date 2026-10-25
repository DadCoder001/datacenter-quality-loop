import { useStore } from '../data/store';
import { DEFAULT_ASSUMPTIONS, PHASES } from '../domain/project';
import type { Assumptions, PhaseId } from '../domain/types';
import { Card } from '../components/ui';

const NumberField = ({ label, value, step, min, onChange, id }: { label: string; value: number; step: number; min: number; onChange: (n: number) => void; id: string }) => (
  <label className="field" htmlFor={id}>
    <span>{label}</span>
    <input
      id={id}
      type="number"
      value={value}
      step={step}
      min={min}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n) && n >= min) onChange(n);
      }}
    />
  </label>
);

export function AssumptionsPanel() {
  const a = useStore((s) => s.assumptions);
  const setAssumptions = useStore((s) => s.setAssumptions);
  const reset = useStore((s) => s.resetAssumptions);
  const setPhase = (key: 'costMultiplier' | 'delayDaysPerPhase', phase: PhaseId, n: number) =>
    setAssumptions({ ...a, [key]: { ...a[key], [phase]: n } } as Assumptions);
  const changed = JSON.stringify(a) !== JSON.stringify(DEFAULT_ASSUMPTIONS);
  return (
    <Card
      title="Assumptions (illustrative, adjustable)"
      actions={
        <button type="button" className="btn small" onClick={reset} disabled={!changed}>
          Reset to defaults
        </button>
      }
    >
      <p className="muted">
        These numbers are illustrative inputs, not benchmarks. They drive every cost and schedule figure in the demo, so changing
        them changes both scenarios. Cost avoided is a counterfactual estimate and is never added to observed CoPQ.
      </p>
      <div className="assump-grid">
        <div>
          <h3>Rework cost multiplier by detection phase</h3>
          {PHASES.map((p) => (
            <NumberField key={p.id} id={`mult-${p.id}`} label={p.label} step={0.5} min={0} value={a.costMultiplier[p.id]} onChange={(n) => setPhase('costMultiplier', p.id, n)} />
          ))}
        </div>
        <div>
          <h3>Schedule delay days per issue weight, by detection phase</h3>
          {PHASES.map((p) => (
            <NumberField key={p.id} id={`delay-${p.id}`} label={p.label} step={0.5} min={0} value={a.delayDaysPerPhase[p.id]} onChange={(n) => setPhase('delayDaysPerPhase', p.id, n)} />
          ))}
        </div>
        <div>
          <h3>Project-wide</h3>
          <NumberField id="delay-cost" label="Delay cost per day (USD)" step={5000} min={0} value={a.delayCostPerDayUsd} onChange={(n) => setAssumptions({ ...a, delayCostPerDayUsd: n })} />
          <NumberField id="overlap" label="Schedule overlap factor (0–1)" step={0.1} min={0} value={a.scheduleOverlapFactor} onChange={(n) => setAssumptions({ ...a, scheduleOverlapFactor: Math.min(1, n) })} />
          <NumberField id="atrisk" label="Milestone at-risk threshold (days)" step={1} min={0} value={a.atRiskSlipDays} onChange={(n) => setAssumptions({ ...a, atRiskSlipDays: n })} />
        </div>
      </div>
    </Card>
  );
}
