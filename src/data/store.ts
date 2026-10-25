import { create } from 'zustand';
import { DEFAULT_AS_OF_DAY, DEFAULT_ASSUMPTIONS, PROJECT_LENGTH_DAYS } from '../domain/project';
import { actionDone, statusAt } from '../domain/metrics';
import type { Action, Assumptions, Dataset, Issue, Lesson, RootCause, Severity, SystemId } from '../domain/types';
import { materialize } from './materialize';

const STORAGE_KEY = 'quality-loop-mvp-v1';

export interface NewIssueInput {
  title: string;
  description: string;
  family: string;
  system: SystemId;
  hall: 'A' | 'B' | 'Site';
  severity: Severity;
  introducedPhase: Issue['introducedPhase'];
  owner: string;
  estimatedLaborUsd: number;
}

interface Persisted extends Dataset {
  asOfDay: number;
  assumptions: Assumptions;
}

interface StoreState extends Persisted {
  setAsOfDay: (day: number) => void;
  setAssumptions: (a: Assumptions) => void;
  resetAssumptions: () => void;
  resetAll: () => void;
  createIssue: (input: NewIssueInput) => string;
  triageIssue: (id: string, owner: string, severity: Severity) => void;
  recordRootCause: (id: string, rc: RootCause) => void;
  addAction: (issueId: string, kind: Action['kind'], title: string, owner: string, dueInDays: number) => void;
  completeAction: (actionId: string) => void;
  verifyIssue: (id: string, note: string, effective: boolean) => { ok: boolean; reason?: string };
  addLesson: (issueId: string, title: string, summary: string) => void;
}

const clampDay = (d: number): number => Math.max(0, Math.min(PROJECT_LENGTH_DAYS, Math.round(d)));

const initial = (): Persisted => ({
  ...materialize('on'),
  asOfDay: DEFAULT_AS_OF_DAY,
  assumptions: DEFAULT_ASSUMPTIONS,
});

const load = (): Persisted => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return initial();
    const p = JSON.parse(raw) as Persisted;
    if (!Array.isArray(p.issues) || !Array.isArray(p.actions) || !Array.isArray(p.lessons)) return initial();
    return { ...initial(), ...p };
  } catch {
    return initial();
  }
};

const patchIssue = (issues: Issue[], id: string, patch: Partial<Issue>): Issue[] =>
  issues.map((i) => (i.id === id ? { ...i, ...patch } : i));

export const useStore = create<StoreState>((set, get) => ({
  ...load(),
  setAsOfDay: (day) => set({ asOfDay: clampDay(day) }),
  setAssumptions: (assumptions) => set({ assumptions }),
  resetAssumptions: () => set({ assumptions: DEFAULT_ASSUMPTIONS }),
  resetAll: () => set(initial()),

  createIssue: (input) => {
    const { issues, asOfDay } = get();
    const n = issues.filter((i) => i.source === 'user').length + 1;
    const id = `U-${String(n).padStart(3, '0')}`;
    const labor = Math.max(0, input.estimatedLaborUsd);
    const issue: Issue = {
      id,
      title: input.title,
      description: input.description,
      family: input.family,
      system: input.system,
      hall: input.hall,
      severity: input.severity,
      introducedPhase: input.introducedPhase,
      owner: input.owner,
      reportedDay: asOfDay,
      evidence: [],
      baseCost: { rework_labor: labor, materials: Math.round(labor * 0.3), retest: Math.round(labor * 0.2) },
      delayWeight: input.severity === 'critical' ? 1 : input.severity === 'high' ? 0.8 : input.severity === 'medium' ? 0.4 : 0.2,
      source: 'user',
    };
    set({ issues: [...issues, issue] });
    return id;
  },

  triageIssue: (id, owner, severity) => {
    const { issues, asOfDay } = get();
    const i = issues.find((x) => x.id === id);
    if (!i || i.reportedDay > asOfDay) return;
    set({ issues: patchIssue(issues, id, { owner, severity, triagedDay: asOfDay }) });
  },

  recordRootCause: (id, rc) => {
    const { issues, asOfDay } = get();
    const i = issues.find((x) => x.id === id);
    if (!i || i.triagedDay === undefined || i.triagedDay > asOfDay) return;
    set({ issues: patchIssue(issues, id, { rootCause: rc, rootCauseDay: asOfDay }) });
  },

  addAction: (issueId, kind, title, owner, dueInDays) => {
    const { actions, asOfDay, issues } = get();
    const i = issues.find((x) => x.id === issueId);
    if (!i || i.reportedDay > asOfDay) return;
    const n = actions.filter((a) => a.issueId === issueId).length + 1;
    const action: Action = {
      id: `${issueId}-A${n}`, issueId, kind, title, owner, createdDay: asOfDay, dueDay: asOfDay + Math.max(1, dueInDays),
    };
    set({ actions: [...actions, action] });
  },

  completeAction: (actionId) => {
    const { actions, asOfDay } = get();
    set({ actions: actions.map((a) => (a.id === actionId ? { ...a, completedDay: asOfDay } : a)) });
  },

  verifyIssue: (id, note, effective) => {
    const { issues, actions, asOfDay } = get();
    const i = issues.find((x) => x.id === id);
    if (!i) return { ok: false, reason: 'Issue not found.' };
    if (statusAt(i, asOfDay) !== 'actions_open') return { ok: false, reason: 'Record root cause and actions first.' };
    const mine = actions.filter((a) => a.issueId === id && a.createdDay <= asOfDay);
    if (!mine.some((a) => a.kind === 'corrective')) return { ok: false, reason: 'Add at least one corrective action.' };
    if (mine.some((a) => !actionDone(a, asOfDay))) return { ok: false, reason: 'Complete all actions before verifying.' };
    set({ issues: patchIssue(issues, id, { verifiedDay: asOfDay, verification: { note, effective } }) });
    return { ok: true };
  },

  addLesson: (issueId, title, summary) => {
    const { issues, lessons } = get();
    const i = issues.find((x) => x.id === issueId);
    if (!i) return;
    const lesson: Lesson = { id: `L-${String(lessons.length + 1).padStart(2, '0')}U`, title, summary, family: i.family, sourceIssueId: issueId };
    set({ lessons: [...lessons, lesson], issues: patchIssue(issues, issueId, { lessonId: lesson.id }) });
  },
}));

useStore.subscribe((s) => {
  try {
    const p: Persisted = { issues: s.issues, actions: s.actions, lessons: s.lessons, asOfDay: s.asOfDay, assumptions: s.assumptions };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: continue in memory */
  }
});
