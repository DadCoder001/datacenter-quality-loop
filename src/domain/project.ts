import type { Assumptions, Milestone, Phase, PhaseId, Severity, SystemId } from './types';

export const PROJECT_NAME = 'Project Meridian';
export const PROJECT_LENGTH_DAYS = 360;
export const DEFAULT_AS_OF_DAY = 295;

export const PHASES: Phase[] = [
  { id: 'design', label: 'Product / Design', startDay: 0, endDay: 59 },
  { id: 'site', label: 'Site Planning & Procurement', startDay: 60, endDay: 119 },
  { id: 'construction', label: 'Construction', startDay: 120, endDay: 249 },
  { id: 'commissioning', label: 'Commissioning', startDay: 250, endDay: 319 },
  { id: 'handover', label: 'Handover', startDay: 320, endDay: 360 },
];

export const MILESTONES: Milestone[] = [
  { id: 'M1', name: 'Design release', phase: 'design', plannedDay: 60 },
  { id: 'M2', name: 'Long-lead equipment ready', phase: 'site', plannedDay: 120 },
  { id: 'M3', name: 'Construction complete', phase: 'construction', plannedDay: 250 },
  { id: 'M4', name: 'Integrated systems test complete', phase: 'commissioning', plannedDay: 320 },
  { id: 'M5', name: 'Ready for service (handover)', phase: 'handover', plannedDay: 360 },
];

export const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low'];

export const SYSTEM_LABELS: Record<SystemId, string> = {
  structure: 'Structure & envelope',
  electrical: 'Electrical power',
  cooling: 'Cooling plant & piping',
  fire: 'Fire protection',
  controls: 'Controls & BMS',
  whitespace: 'White space / racks',
  site: 'Site & civil',
  operations: 'Operations readiness',
};

export const phaseIndex = (id: PhaseId): number => PHASES.findIndex((p) => p.id === id);

export const phaseOfDay = (day: number): PhaseId => {
  const found = PHASES.find((p) => day >= p.startDay && day <= p.endDay);
  if (found) return found.id;
  return day < 0 ? 'design' : 'handover';
};

export const phaseLabel = (id: PhaseId): string => PHASES.find((p) => p.id === id)?.label ?? id;

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  costMultiplier: { design: 1, site: 2, construction: 5, commissioning: 11, handover: 18 },
  delayDaysPerPhase: { design: 0, site: 0.5, construction: 1.5, commissioning: 4, handover: 6 },
  delayCostPerDayUsd: 35000,
  scheduleOverlapFactor: 0.6,
  atRiskSlipDays: 3,
};
