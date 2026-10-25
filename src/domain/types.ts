export type PhaseId = 'design' | 'site' | 'construction' | 'commissioning' | 'handover';
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type Scenario = 'on' | 'off';
export type IssueStatus = 'not_reported' | 'reported' | 'investigating' | 'actions_open' | 'verified';
export type SystemId = 'structure' | 'electrical' | 'cooling' | 'fire' | 'controls' | 'whitespace' | 'site' | 'operations';
export type CostCategory = 'rework_labor' | 'materials' | 'retest' | 'delay';

export interface Phase {
  id: PhaseId;
  label: string;
  startDay: number;
  endDay: number;
}

export interface Milestone {
  id: string;
  name: string;
  phase: PhaseId;
  plannedDay: number;
}

export interface BaseCost {
  rework_labor: number;
  materials: number;
  retest: number;
}

export type CostBreakdown = Record<CostCategory, number>;

export interface RootCause {
  whys: string[];
  rootCause: string;
}

export interface Verification {
  note: string;
  effective: boolean;
}

export interface Issue {
  id: string;
  templateId?: string;
  title: string;
  description: string;
  family: string;
  system: SystemId;
  hall: 'A' | 'B' | 'Site';
  severity: Severity;
  introducedPhase: PhaseId;
  owner: string;
  reportedDay: number;
  triagedDay?: number;
  rootCauseDay?: number;
  verifiedDay?: number;
  evidence: string[];
  rootCause?: RootCause;
  verification?: Verification;
  baseCost: BaseCost;
  delayWeight: number;
  lessonId?: string;
  source: 'seed' | 'user';
}

export interface Action {
  id: string;
  issueId: string;
  kind: 'corrective' | 'preventative';
  title: string;
  owner: string;
  createdDay: number;
  dueDay: number;
  completedDay?: number;
}

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  family: string;
  sourceIssueId: string;
}

export interface Dataset {
  issues: Issue[];
  actions: Action[];
  lessons: Lesson[];
}

export interface Assumptions {
  costMultiplier: Record<PhaseId, number>;
  delayDaysPerPhase: Record<PhaseId, number>;
  delayCostPerDayUsd: number;
  scheduleOverlapFactor: number;
  atRiskSlipDays: number;
}
