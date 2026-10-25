import { PROJECT_LENGTH_DAYS } from '../domain/project';
import {
  actionStats,
  forecastReadyDay,
  isOpen,
  issueCost,
  milestoneForecasts,
  observedCoPQ,
  totalCost,
  visibleIssues,
  type ActionStats,
  type MilestoneForecast,
} from '../domain/metrics';
import type { Assumptions, CostBreakdown, Dataset, Issue } from '../domain/types';
import { TEMPLATES } from '../data/templates';
import { issueIdFor, materialize } from '../data/materialize';

export type SimEventType = 'reported' | 'triaged' | 'root_cause' | 'verified';

export interface SimEvent {
  day: number;
  type: SimEventType;
  issueId: string;
  text: string;
}

export interface SimState {
  day: number;
  openIssues: number;
  reportedIssues: number;
  copq: CostBreakdown;
  copqTotal: number;
  forecastReadyDay: number;
  slipDays: number;
  milestones: MilestoneForecast[];
  actions: ActionStats;
}

let offCache: Dataset | null = null;
export const baselineDataset = (): Dataset => (offCache ??= materialize('off'));

export const stateAt = (ds: Dataset, day: number, a: Assumptions): SimState => {
  const copq = observedCoPQ(ds.issues, a, day);
  const ready = forecastReadyDay(ds.issues, a, day);
  return {
    day,
    openIssues: ds.issues.filter((i) => isOpen(i, day)).length,
    reportedIssues: visibleIssues(ds.issues, day).length,
    copq,
    copqTotal: totalCost(copq),
    forecastReadyDay: ready,
    slipDays: Math.round((ready - PROJECT_LENGTH_DAYS) * 10) / 10,
    milestones: milestoneForecasts(ds.issues, a, day),
    actions: actionStats(ds.actions, day),
  };
};

export const eventsFor = (ds: Dataset): SimEvent[] => {
  const events: SimEvent[] = [];
  ds.issues.forEach((i) => {
    events.push({ day: i.reportedDay, type: 'reported', issueId: i.id, text: `${i.id} reported: ${i.title}` });
    if (i.triagedDay !== undefined)
      events.push({ day: i.triagedDay, type: 'triaged', issueId: i.id, text: `${i.id} triaged to ${i.owner}` });
    if (i.rootCauseDay !== undefined)
      events.push({ day: i.rootCauseDay, type: 'root_cause', issueId: i.id, text: `${i.id} root cause documented; actions assigned` });
    if (i.verifiedDay !== undefined)
      events.push({
        day: i.verifiedDay,
        type: 'verified',
        issueId: i.id,
        text: i.verification ? `${i.id} verified closed` : `${i.id} closed (no structured verification)`,
      });
  });
  return events.sort((x, y) => x.day - y.day || x.issueId.localeCompare(y.issueId));
};

export interface SeriesPoint {
  day: number;
  off: number;
  on: number;
  offSlip: number;
  onSlip: number;
}

export const compareSeries = (on: Dataset, off: Dataset, a: Assumptions, step = 5): SeriesPoint[] => {
  const pts: SeriesPoint[] = [];
  for (let d = 0; d <= PROJECT_LENGTH_DAYS; d += step) {
    const s1 = stateAt(on, d, a);
    const s0 = stateAt(off, d, a);
    pts.push({ day: d, on: s1.copqTotal, off: s0.copqTotal, onSlip: s1.slipDays, offSlip: s0.slipDays });
  }
  return pts;
};

/**
 * Estimated cost avoided by closed-loop learning, as of `day`. This is a counterfactual estimate based on the
 * stated assumptions; it is kept separate from observed CoPQ and is never added to it.
 */
export const estimatedAvoided = (a: Assumptions, day: number): { total: number; fromEarlierDetection: number; fromPrevention: number } => {
  const off = baselineDataset();
  let early = 0;
  let prevented = 0;
  TEMPLATES.forEach((t) => {
    const offIssue = off.issues.find((i) => i.id === issueIdFor(t.id));
    if (!offIssue) return;
    const offCost = totalCost(issueCost(offIssue, a));
    if (t.onDay === null) {
      if (offIssue.reportedDay <= day) prevented += offCost;
    } else if (t.onDay <= day) {
      const onIssue: Issue = { ...offIssue, reportedDay: t.onDay };
      early += offCost - totalCost(issueCost(onIssue, a));
    }
  });
  return { total: early + prevented, fromEarlierDetection: early, fromPrevention: prevented };
};
