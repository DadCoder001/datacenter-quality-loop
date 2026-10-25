import { isOpen, SEVERITY_RANK, statusAt } from '../domain/metrics';
import { phaseOfDay } from '../domain/project';
import type { Dataset, Issue, PhaseId, Severity } from '../domain/types';

export type ComponentId = 'pad' | 'hallA' | 'hallB' | 'power' | 'genyard' | 'cooling' | 'admin';
export type QualityState = 'planned' | 'building' | 'healthy' | 'issue_open' | 'verified';

export interface SceneComponent {
  id: ComponentId;
  label: string;
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  build: number;
  state: QualityState;
  worstOpen?: Severity;
  openIssueIds: string[];
  verifiedCount: number;
  /** True when built, past its commissioning window and free of open issues. */
  energized: boolean;
}

export interface SceneState {
  day: number;
  phase: PhaseId;
  components: SceneComponent[];
}

interface Spec {
  id: ComponentId;
  label: string;
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  start: number;
  end: number;
}

/** Facility defined as data so a different renderer (for example 3D) can consume the same scene state. */
export const FACILITY: Spec[] = [
  { id: 'pad', label: 'Site pad', x: 0, y: 0, w: 14, d: 10, h: 0.12, start: 60, end: 110 },
  { id: 'hallA', label: 'Hall A', x: 1, y: 1, w: 5, d: 3.5, h: 1.6, start: 140, end: 235 },
  { id: 'hallB', label: 'Hall B', x: 1, y: 5.5, w: 5, d: 3.5, h: 1.6, start: 170, end: 260 },
  { id: 'power', label: 'Power block', x: 7, y: 1, w: 2.5, d: 3.5, h: 1.3, start: 125, end: 215 },
  { id: 'genyard', label: 'Generator yard', x: 10.5, y: 1, w: 2.5, d: 3.5, h: 0.8, start: 125, end: 180 },
  { id: 'cooling', label: 'Cooling plant', x: 7, y: 5.5, w: 2.5, d: 3.5, h: 1.1, start: 130, end: 230 },
  { id: 'admin', label: 'Ops & life-safety', x: 10.5, y: 5.5, w: 2.5, d: 3.5, h: 0.9, start: 140, end: 250 },
];

export const componentFor = (i: Issue): ComponentId => {
  if (i.hall === 'A') return 'hallA';
  if (i.hall === 'B') return 'hallB';
  switch (i.system) {
    case 'electrical':
      return 'power';
    case 'cooling':
    case 'controls':
      return 'cooling';
    case 'site':
      return 'genyard';
    default:
      return 'admin';
  }
};

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

export const buildScene = (ds: Dataset, day: number): SceneState => {
  const components = FACILITY.map((spec): SceneComponent => {
    const build = clamp01((day - spec.start) / (spec.end - spec.start));
    const mine = ds.issues.filter((i) => componentFor(i) === spec.id && i.reportedDay <= day);
    const open = mine.filter((i) => isOpen(i, day)).sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
    const verified = mine.filter((i) => statusAt(i, day) === 'verified').length;
    let state: QualityState;
    if (open.length) state = 'issue_open';
    else if (build <= 0) state = 'planned';
    else if (build < 1) state = 'building';
    else state = verified ? 'verified' : 'healthy';
    return {
      id: spec.id, label: spec.label, x: spec.x, y: spec.y, w: spec.w, d: spec.d, h: spec.h, build, state,
      worstOpen: open[0]?.severity,
      openIssueIds: open.map((i) => i.id),
      verifiedCount: verified,
      energized: build >= 1 && day >= 255 && open.length === 0 && spec.id !== 'pad',
    };
  });
  return { day, phase: phaseOfDay(day), components };
};
