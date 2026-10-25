import { MILESTONES, PROJECT_LENGTH_DAYS, phaseIndex, phaseOfDay } from './project';
import type {
  Action,
  Assumptions,
  CostBreakdown,
  Issue,
  IssueStatus,
  Milestone,
  PhaseId,
  Severity,
} from './types';

export const detectedPhase = (issue: Issue): PhaseId => phaseOfDay(issue.reportedDay);

export const statusAt = (issue: Issue, day: number): IssueStatus => {
  if (issue.reportedDay > day) return 'not_reported';
  if (issue.verifiedDay !== undefined && issue.verifiedDay <= day) return 'verified';
  if (issue.rootCauseDay !== undefined && issue.rootCauseDay <= day) return 'actions_open';
  if (issue.triagedDay !== undefined && issue.triagedDay <= day) return 'investigating';
  return 'reported';
};

export const visibleIssues = (issues: Issue[], day: number): Issue[] => issues.filter((i) => i.reportedDay <= day);

export const isOpen = (issue: Issue, day: number): boolean => {
  const s = statusAt(issue, day);
  return s !== 'not_reported' && s !== 'verified';
};

export const ageDays = (issue: Issue, day: number): number => {
  const end = issue.verifiedDay !== undefined && issue.verifiedDay <= day ? issue.verifiedDay : day;
  return Math.max(0, end - issue.reportedDay);
};

/** Phases between where the defect was introduced and where it was detected (0 = caught in the phase it was created). */
export const detectionLagPhases = (issue: Issue): number =>
  Math.max(0, phaseIndex(detectedPhase(issue)) - phaseIndex(issue.introducedPhase));

export const issueDelayDays = (issue: Issue, a: Assumptions): number =>
  issue.delayWeight * a.delayDaysPerPhase[detectedPhase(issue)];

export const issueCost = (issue: Issue, a: Assumptions): CostBreakdown => {
  const m = a.costMultiplier[detectedPhase(issue)];
  return {
    rework_labor: issue.baseCost.rework_labor * m,
    materials: issue.baseCost.materials * m,
    retest: issue.baseCost.retest * m,
    delay: issueDelayDays(issue, a) * a.delayCostPerDayUsd,
  };
};

export const totalCost = (c: CostBreakdown): number => c.rework_labor + c.materials + c.retest + c.delay;

export const emptyCost = (): CostBreakdown => ({ rework_labor: 0, materials: 0, retest: 0, delay: 0 });

export const addCost = (x: CostBreakdown, y: CostBreakdown): CostBreakdown => ({
  rework_labor: x.rework_labor + y.rework_labor,
  materials: x.materials + y.materials,
  retest: x.retest + y.retest,
  delay: x.delay + y.delay,
});

/** Observed CoPQ: cost recorded for issues reported by `day`. Never includes estimated avoided cost. */
export const observedCoPQ = (issues: Issue[], a: Assumptions, day: number): CostBreakdown =>
  visibleIssues(issues, day).reduce((acc, i) => addCost(acc, issueCost(i, a)), emptyCost());

const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

export const avgTimeToTriage = (issues: Issue[], day: number): number | null =>
  mean(
    issues
      .filter((i) => i.triagedDay !== undefined && i.triagedDay <= day)
      .map((i) => (i.triagedDay as number) - i.reportedDay),
  );

export const avgTimeToVerifiedClosure = (issues: Issue[], day: number): number | null =>
  mean(
    issues
      .filter((i) => i.verifiedDay !== undefined && i.verifiedDay <= day)
      .map((i) => (i.verifiedDay as number) - i.reportedDay),
  );

export const actionsVisible = (actions: Action[], day: number): Action[] => actions.filter((a) => a.createdDay <= day);
export const actionDone = (a: Action, day: number): boolean => a.completedDay !== undefined && a.completedDay <= day;
export const actionOverdue = (a: Action, day: number): boolean => !actionDone(a, day) && a.dueDay < day;

export interface ActionStats {
  total: number;
  done: number;
  overdue: number;
  completionRate: number | null;
  overdueRate: number | null;
  preventativeTotal: number;
  preventativeDone: number;
}

export const actionStats = (actions: Action[], day: number): ActionStats => {
  const vis = actionsVisible(actions, day);
  const done = vis.filter((a) => actionDone(a, day)).length;
  const overdue = vis.filter((a) => actionOverdue(a, day)).length;
  const prev = vis.filter((a) => a.kind === 'preventative');
  return {
    total: vis.length,
    done,
    overdue,
    completionRate: vis.length ? done / vis.length : null,
    overdueRate: vis.length ? overdue / vis.length : null,
    preventativeTotal: prev.length,
    preventativeDone: prev.filter((a) => actionDone(a, day)).length,
  };
};

/** Share of visible issues that repeat a family already seen (family count minus one, per family). */
export const repeatIssueRate = (issues: Issue[], day: number): number | null => {
  const vis = visibleIssues(issues, day);
  if (!vis.length) return null;
  const families = new Map<string, number>();
  vis.forEach((i) => families.set(i.family, (families.get(i.family) ?? 0) + 1));
  const repeats = [...families.values()].reduce((s, n) => s + (n - 1), 0);
  return repeats / vis.length;
};

export interface MilestoneForecast {
  milestone: Milestone;
  slipDays: number;
  forecastDay: number;
  atRisk: boolean;
}

/** Forecast slip = overlap factor × delay days of issues detected at or before the milestone's phase and reported by `day`. */
export const milestoneForecasts = (issues: Issue[], a: Assumptions, day: number): MilestoneForecast[] =>
  MILESTONES.map((milestone) => {
    const mi = phaseIndex(milestone.phase);
    const delay = visibleIssues(issues, day)
      .filter((i) => phaseIndex(detectedPhase(i)) <= mi)
      .reduce((s, i) => s + issueDelayDays(i, a), 0);
    const slipDays = Math.round(delay * a.scheduleOverlapFactor * 10) / 10;
    return {
      milestone,
      slipDays,
      forecastDay: milestone.plannedDay + slipDays,
      atRisk: slipDays >= a.atRiskSlipDays,
    };
  });

export const forecastReadyDay = (issues: Issue[], a: Assumptions, day: number): number => {
  const forecasts = milestoneForecasts(issues, a, day);
  return forecasts[forecasts.length - 1]?.forecastDay ?? PROJECT_LENGTH_DAYS;
};

export const countBySeverity = (issues: Issue[]): Record<Severity, number> => {
  const out: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  issues.forEach((i) => (out[i.severity] += 1));
  return out;
};

export const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export const isHighRisk = (i: Issue): boolean => i.severity === 'critical' || i.severity === 'high';

export const fmtUsd = (n: number): string =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`;
