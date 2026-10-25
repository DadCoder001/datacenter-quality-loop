import { describe, expect, it } from 'vitest';
import { DEFAULT_ASSUMPTIONS, PHASES, phaseIndex, phaseOfDay } from '../../src/domain/project';
import { totalCost } from '../../src/domain/metrics';
import { LESSON_TEMPLATES, TEMPLATES } from '../../src/data/templates';
import { materialize, preventedIssues } from '../../src/data/materialize';
import { baselineDataset, compareSeries, estimatedAvoided, eventsFor, stateAt } from '../../src/sim/engine';

const A = DEFAULT_ASSUMPTIONS;
const on = materialize('on');
const off = materialize('off');

describe('seed scenario integrity', () => {
  it('has unique ids and valid cross-references', () => {
    const ids = new Set(on.issues.map((i) => i.id));
    expect(ids.size).toBe(on.issues.length);
    on.actions.forEach((a) => expect(ids.has(a.issueId)).toBe(true));
    on.lessons.forEach((l) => expect(ids.has(l.sourceIssueId)).toBe(true));
    expect(on.issues.every((i) => PHASES.some((p) => p.id === i.introducedPhase))).toBe(true);
  });
  it('orders lifecycle dates consistently in both scenarios', () => {
    [on, off].forEach((ds) =>
      ds.issues.forEach((i) => {
        expect(i.triagedDay ?? i.reportedDay).toBeGreaterThanOrEqual(i.reportedDay);
        if (i.rootCauseDay !== undefined) expect(i.rootCauseDay).toBeGreaterThanOrEqual(i.triagedDay as number);
        expect(i.verifiedDay as number).toBeGreaterThan(i.rootCauseDay ?? i.triagedDay ?? i.reportedDay);
      }),
    );
    [on, off].forEach((ds) =>
      ds.actions.forEach((a) => {
        expect(a.completedDay as number).toBeGreaterThanOrEqual(a.createdDay);
        expect(a.dueDay).toBeGreaterThan(a.createdDay);
      }),
    );
  });
  it('never detects a defect before the phase it was introduced', () => {
    [on, off].forEach((ds) =>
      ds.issues.forEach((i) => expect(phaseIndex(phaseOfDay(i.reportedDay))).toBeGreaterThanOrEqual(phaseIndex(i.introducedPhase))),
    );
  });
  it('covers all five phases, recurring families, and lessons that prevent later issues', () => {
    const phases = new Set(on.issues.map((i) => phaseOfDay(i.reportedDay)));
    expect(phases.size).toBe(5);
    const fam = new Map<string, number>();
    off.issues.forEach((i) => fam.set(i.family, (fam.get(i.family) ?? 0) + 1));
    expect([...fam.values()].filter((n) => n >= 2).length).toBeGreaterThanOrEqual(2);
    const prevented = preventedIssues();
    expect(prevented.length).toBeGreaterThanOrEqual(3);
    prevented.forEach(({ issue, lessonId }) => {
      const lesson = LESSON_TEMPLATES.find((l) => l.id === lessonId)!;
      const src = on.issues.find((i) => i.templateId === lesson.sourceTemplateId)!;
      expect(src.verifiedDay as number).toBeLessThan(issue.reportedDay);
    });
  });
  it('lists the template count used for the register', () => {
    expect(TEMPLATES.length).toBe(24);
    expect(on.issues.length).toBe(21);
  });
});

describe('simulation engine', () => {
  it('is deterministic', () => {
    expect(JSON.stringify(stateAt(on, 200, A))).toBe(JSON.stringify(stateAt(materialize('on'), 200, A)));
    expect(JSON.stringify(compareSeries(on, off, A))).toBe(JSON.stringify(compareSeries(materialize('on'), materialize('off'), A)));
  });
  it('scrubbing to day T equals state derived directly at T', () => {
    const play = [0, 50, 120, 250, 300].map((d) => stateAt(on, d, A));
    expect(stateAt(on, 250, A)).toEqual(play[3]);
  });
  it('diverges in the expected direction: closed-loop on beats off on CoPQ and handover date', () => {
    const sOn = stateAt(on, 360, A);
    const sOff = stateAt(off, 360, A);
    expect(sOn.copqTotal).toBeLessThan(sOff.copqTotal);
    expect(sOn.forecastReadyDay).toBeLessThan(sOff.forecastReadyDay);
    expect(sOn.reportedIssues).toBeLessThan(sOff.reportedIssues);
  });
  it('cost multipliers change results predictably', () => {
    const doubled = { ...A, costMultiplier: { ...A.costMultiplier, commissioning: A.costMultiplier.commissioning * 2 } };
    expect(stateAt(off, 360, doubled).copqTotal).toBeGreaterThan(stateAt(off, 360, A).copqTotal);
    const noDelay = { ...A, delayCostPerDayUsd: 0 };
    expect(stateAt(off, 360, noDelay).copq.delay).toBe(0);
  });
  it('keeps estimated avoided cost separate from observed CoPQ', () => {
    const s = stateAt(on, 360, A);
    const avoided = estimatedAvoided(A, 360);
    expect(avoided.total).toBeGreaterThan(0);
    expect(avoided.total).toBeCloseTo(avoided.fromEarlierDetection + avoided.fromPrevention);
    expect(s).not.toHaveProperty('avoided');
    // off cost minus on cost equals the estimated avoided total when every issue is in view
    const offTotal = totalCost(stateAt(baselineDataset(), 360, A).copq);
    expect(offTotal - s.copqTotal).toBeCloseTo(avoided.total);
  });
  it('emits ordered events', () => {
    const ev = eventsFor(on);
    for (let k = 1; k < ev.length; k++) expect(ev[k].day).toBeGreaterThanOrEqual(ev[k - 1].day);
  });
  it('has open and overdue work at the default project day', () => {
    const s = stateAt(on, 295, A);
    expect(s.openIssues).toBeGreaterThan(0);
    expect(s.actions.overdue).toBeGreaterThan(0);
  });
});
