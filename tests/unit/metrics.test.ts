import { describe, expect, it } from 'vitest';
import { DEFAULT_ASSUMPTIONS, MILESTONES, phaseOfDay } from '../../src/domain/project';
import {
  actionOverdue,
  actionStats,
  avgTimeToTriage,
  avgTimeToVerifiedClosure,
  detectionLagPhases,
  issueCost,
  milestoneForecasts,
  observedCoPQ,
  repeatIssueRate,
  statusAt,
  totalCost,
} from '../../src/domain/metrics';
import type { Action, Issue } from '../../src/domain/types';

const base: Issue = {
  id: 'X-1', title: 't', description: 'd', family: 'F1', system: 'electrical', hall: 'A', severity: 'high',
  introducedPhase: 'design', owner: 'o', reportedDay: 10, evidence: [], source: 'user', delayWeight: 1,
  baseCost: { rework_labor: 1000, materials: 500, retest: 100 },
};
const A = DEFAULT_ASSUMPTIONS;
const mk = (o: Partial<Issue>): Issue => ({ ...base, ...o });

describe('phase mapping', () => {
  it('maps days to phases at boundaries', () => {
    expect(phaseOfDay(0)).toBe('design');
    expect(phaseOfDay(59)).toBe('design');
    expect(phaseOfDay(60)).toBe('site');
    expect(phaseOfDay(250)).toBe('commissioning');
    expect(phaseOfDay(360)).toBe('handover');
  });
});

describe('statusAt', () => {
  const i = mk({ reportedDay: 10, triagedDay: 12, rootCauseDay: 20, verifiedDay: 40 });
  it('walks through the loop stages', () => {
    expect(statusAt(i, 9)).toBe('not_reported');
    expect(statusAt(i, 10)).toBe('reported');
    expect(statusAt(i, 12)).toBe('investigating');
    expect(statusAt(i, 20)).toBe('actions_open');
    expect(statusAt(i, 40)).toBe('verified');
  });
});

describe('cost', () => {
  it('uses the multiplier for the detected phase (hand-computed)', () => {
    const early = mk({ reportedDay: 10, delayWeight: 0.6 });
    expect(totalCost(issueCost(early, A))).toBe(1600); // multiplier 1, no delay in design
    const late = mk({ reportedDay: 270, delayWeight: 0.5 });
    // 11 x (1000+500+100) = 17600; delay 0.5*4 = 2 days * 35000 = 70000
    expect(totalCost(issueCost(late, A))).toBe(87600);
  });
  it('observed CoPQ counts only reported issues and has no avoided-cost component', () => {
    const issues = [mk({ id: 'a', reportedDay: 10 }), mk({ id: 'b', reportedDay: 100 })];
    const c = observedCoPQ(issues, A, 50);
    expect(Object.keys(c).sort()).toEqual(['delay', 'materials', 'retest', 'rework_labor']);
    expect(totalCost(c)).toBe(1600);
  });
  it('handles an empty issue list', () => {
    expect(totalCost(observedCoPQ([], A, 100))).toBe(0);
  });
});

describe('timing metrics', () => {
  it('computes averages only over completed items and null when none', () => {
    const issues = [
      mk({ id: 'a', reportedDay: 10, triagedDay: 11, verifiedDay: 30 }),
      mk({ id: 'b', reportedDay: 20, triagedDay: 23 }),
    ];
    expect(avgTimeToTriage(issues, 100)).toBe(2);
    expect(avgTimeToVerifiedClosure(issues, 100)).toBe(20);
    expect(avgTimeToVerifiedClosure(issues, 25)).toBeNull();
    expect(avgTimeToTriage([], 100)).toBeNull();
  });
  it('measures detection lag in phases', () => {
    expect(detectionLagPhases(mk({ introducedPhase: 'design', reportedDay: 270 }))).toBe(3);
    expect(detectionLagPhases(mk({ introducedPhase: 'construction', reportedDay: 130 }))).toBe(0);
  });
});

describe('actions', () => {
  const acts: Action[] = [
    { id: 'a1', issueId: 'x', kind: 'corrective', title: '', owner: '', createdDay: 10, dueDay: 20, completedDay: 18 },
    { id: 'a2', issueId: 'x', kind: 'preventative', title: '', owner: '', createdDay: 10, dueDay: 25 },
    { id: 'a3', issueId: 'x', kind: 'corrective', title: '', owner: '', createdDay: 10, dueDay: 40, completedDay: 50 },
    { id: 'a4', issueId: 'x', kind: 'corrective', title: '', owner: '', createdDay: 90, dueDay: 99 },
  ];
  it('flags overdue only when not done and past due', () => {
    expect(actionOverdue(acts[1], 25)).toBe(false);
    expect(actionOverdue(acts[1], 26)).toBe(true);
    expect(actionOverdue(acts[2], 45)).toBe(true);
    expect(actionOverdue(acts[2], 50)).toBe(false);
  });
  it('computes completion and overdue rates over visible actions', () => {
    const s = actionStats(acts, 45);
    expect(s.total).toBe(3);
    expect(s.done).toBe(1);
    expect(s.overdue).toBe(2);
    expect(s.completionRate).toBeCloseTo(1 / 3);
    expect(s.preventativeTotal).toBe(1);
    expect(actionStats([], 10).completionRate).toBeNull();
  });
});

describe('repeat issues and milestones', () => {
  it('counts repeats as family count minus one', () => {
    const issues = [mk({ id: 'a', family: 'F1' }), mk({ id: 'b', family: 'F1' }), mk({ id: 'c', family: 'F2' })];
    expect(repeatIssueRate(issues, 100)).toBeCloseTo(1 / 3);
    expect(repeatIssueRate([], 100)).toBeNull();
  });
  it('accumulates schedule slip into milestones at or after the detection phase', () => {
    const issues = [mk({ reportedDay: 270, delayWeight: 1 })]; // 4 delay days * 0.6 = 2.4
    const f = milestoneForecasts(issues, A, 300);
    expect(f.find((m) => m.milestone.id === 'M3')?.slipDays).toBe(0);
    expect(f.find((m) => m.milestone.id === 'M4')?.slipDays).toBe(2.4);
    expect(f.find((m) => m.milestone.id === 'M5')?.slipDays).toBe(2.4);
    expect(f.find((m) => m.milestone.id === 'M5')?.atRisk).toBe(false);
    expect(f).toHaveLength(MILESTONES.length);
  });
});
