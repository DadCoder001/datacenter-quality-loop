import type { Action, Dataset, Issue, Lesson, Scenario } from '../domain/types';
import { LESSON_TEMPLATES, TEMPLATES, type Template } from './templates';

export const issueIdFor = (templateId: string): string => `I-${templateId.slice(1).padStart(3, '0')}`;
export const lessonIdFor = (id: string): string => id;

const OFF_CLOSURE_FACTOR = 1.8;
const OFF_CLOSURE_EXTRA_DAYS = 5;
const OFF_TRIAGE_DAYS = 4;

const buildIssue = (t: Template, scenario: Scenario): Issue | null => {
  const base = {
    id: issueIdFor(t.id),
    templateId: t.id,
    title: t.title,
    description: t.description,
    family: t.family,
    system: t.system,
    hall: t.hall,
    severity: t.severity,
    introducedPhase: t.introduced,
    owner: t.owner,
    evidence: t.evidence,
    baseCost: t.base,
    delayWeight: t.delayWeight,
    source: 'seed' as const,
  };

  if (scenario === 'on') {
    if (t.onDay === null) return null;
    const rcaOffset = t.onLag >= 15 ? 5 : 3;
    return {
      ...base,
      reportedDay: t.onDay,
      triagedDay: t.onDay + 1,
      rootCauseDay: t.onDay + rcaOffset,
      verifiedDay: t.onDay + t.onLag,
      rootCause: { whys: t.whys, rootCause: t.rootCause },
      verification: { note: 'Re-inspected and retested; preventative action confirmed in place.', effective: true },
      lessonId: t.lessonId,
    };
  }

  if (t.offDay === null) return null;
  return {
    ...base,
    reportedDay: t.offDay,
    triagedDay: t.offDay + OFF_TRIAGE_DAYS,
    verifiedDay: t.offDay + Math.round(t.onLag * OFF_CLOSURE_FACTOR) + OFF_CLOSURE_EXTRA_DAYS,
  };
};

const buildActions = (issue: Issue, t: Template, scenario: Scenario): Action[] => {
  if (scenario === 'on') {
    const rca = issue.rootCauseDay as number;
    const verified = issue.verifiedDay as number;
    return [
      {
        id: `${issue.id}-A1`, issueId: issue.id, kind: 'corrective', title: t.corrective, owner: issue.owner,
        createdDay: rca, dueDay: rca + 7, completedDay: verified - 2,
      },
      {
        id: `${issue.id}-A2`, issueId: issue.id, kind: 'preventative', title: t.preventative, owner: 'Quality Manager',
        createdDay: rca, dueDay: rca + 21, completedDay: verified - 1,
      },
    ];
  }
  const triaged = issue.triagedDay as number;
  return [
    {
      id: `${issue.id}-A1`, issueId: issue.id, kind: 'corrective', title: t.corrective, owner: issue.owner,
      createdDay: triaged, dueDay: triaged + 14, completedDay: (issue.verifiedDay as number) - 1,
    },
  ];
};

/** Builds the full dataset for a scenario from the shared project templates. Deterministic: no randomness. */
export const materialize = (scenario: Scenario): Dataset => {
  const issues: Issue[] = [];
  const actions: Action[] = [];
  TEMPLATES.forEach((t) => {
    const issue = buildIssue(t, scenario);
    if (!issue) return;
    issues.push(issue);
    actions.push(...buildActions(issue, t, scenario));
  });
  const lessons: Lesson[] =
    scenario === 'on'
      ? LESSON_TEMPLATES.map((l) => ({
          id: lessonIdFor(l.id),
          title: l.title,
          summary: l.summary,
          family: l.family,
          sourceIssueId: issueIdFor(l.sourceTemplateId),
        }))
      : [];
  return { issues, actions, lessons };
};

/** Seed issues avoided in the closed-loop scenario by an applied lesson, with the lesson that prevents them. */
export const preventedIssues = (): { issue: Issue; lessonId: string }[] =>
  TEMPLATES.filter((t) => t.preventedBy)
    .map((t) => ({ issue: buildIssue(t, 'off') as Issue, lessonId: t.preventedBy as string }))
    .filter((x) => x.issue);
