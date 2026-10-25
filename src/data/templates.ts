import type { BaseCost, PhaseId, Severity, SystemId } from '../domain/types';

export interface Template {
  id: string;
  title: string;
  description: string;
  family: string;
  system: SystemId;
  hall: 'A' | 'B' | 'Site';
  severity: Severity;
  introduced: PhaseId;
  /** Day reported with closed-loop learning on; null = avoided by an applied lesson. */
  onDay: number | null;
  /** Day reported in the baseline without closed-loop learning; null = not applicable. */
  offDay: number | null;
  /** Days from report to verified closure when the loop is on. */
  onLag: number;
  owner: string;
  base: BaseCost;
  delayWeight: number;
  whys: string[];
  rootCause: string;
  evidence: string[];
  corrective: string;
  preventative: string;
  /** Lesson that this issue's closure produces. */
  lessonId?: string;
  /** Lesson that prevents this issue when the loop is on. */
  preventedBy?: string;
}

export interface LessonTemplate {
  id: string;
  title: string;
  summary: string;
  family: string;
  sourceTemplateId: string;
}

export const OWNERS = {
  design: 'Design Manager',
  supplier: 'Supplier Quality Engineer',
  construction: 'Construction Manager',
  mep: 'MEP Superintendent',
  cx: 'Commissioning Lead',
  handover: 'Handover Manager',
  quality: 'Quality Manager',
};

export const TEMPLATES: Template[] = [
  {
    id: 'T01', title: 'Chilled-water main clashes with cable tray in Hall A',
    description: 'Coordination model shows the 400 mm chilled-water main crossing the Hall A overhead cable tray at the same elevation.',
    family: 'Design coordination', system: 'cooling', hall: 'A', severity: 'high', introduced: 'design',
    onDay: 38, offDay: 170, onLag: 14, owner: OWNERS.design, base: { rework_labor: 6000, materials: 2000, retest: 0 }, delayWeight: 0.6,
    whys: ['Pipe and tray were routed by different teams.', 'Models were federated only at 60% design.', 'No clash-detection gate before issue-for-construction.', 'Interface owners were not named per zone.'],
    rootCause: 'No formal clash-detection gate or named interface owner before issue-for-construction.',
    evidence: ['BIM clash report CR-014', 'Coordination meeting notes'],
    corrective: 'Reroute chilled-water main below tray; reissue affected drawings.',
    preventative: 'Add a clash-resolution gate (zero hard clashes) before issue-for-construction.',
    lessonId: 'L04',
  },
  {
    id: 'T02', title: 'Generator load-bank spec does not match utility interconnect requirement',
    description: 'Specified load-bank capacity cannot demonstrate the interconnect agreement test steps.',
    family: 'Requirements & specs', system: 'electrical', hall: 'Site', severity: 'high', introduced: 'design',
    onDay: 92, offDay: 262, onLag: 20, owner: OWNERS.design, base: { rework_labor: 8000, materials: 12000, retest: 4000 }, delayWeight: 0.8,
    whys: ['Test procedure was written from a generic spec.', 'Utility requirements were not traced into the commissioning plan.', 'No requirement-traceability review at design freeze.'],
    rootCause: 'External requirements were not traced into specifications at design freeze.',
    evidence: ['Utility interconnect agreement §6.2', 'Load-bank datasheet'],
    corrective: 'Revise specification and procure the correct load-bank rental.',
    preventative: 'Add an external-requirements traceability check to design freeze.',
  },
  {
    id: 'T03', title: 'CDU control sequence ambiguous for loss-of-pump scenario',
    description: 'Submitted controls narrative does not define CDU behaviour on single-pump loss.',
    family: 'Controls & commissioning scripts', system: 'controls', hall: 'A', severity: 'medium', introduced: 'design',
    onDay: 190, offDay: 270, onLag: 30, owner: OWNERS.design, base: { rework_labor: 5000, materials: 1000, retest: 3000 }, delayWeight: 0.7,
    whys: ['Narrative copied from a prior project.', 'No scenario list reviewed against the narrative.', 'Controls review happened after procurement.'],
    rootCause: 'Controls sequences were not reviewed against a failure-scenario list before procurement.',
    evidence: ['Controls narrative rev C', 'Submittal review comments'],
    corrective: 'Issue revised sequence of operations and update PLC logic.',
    preventative: 'Review each sequence against the standard failure-scenario list at submittal.',
  },
  {
    id: 'T04', title: 'Battery-room fire suppression zone missing from drawings',
    description: 'Fire protection drawings omit suppression coverage for the battery room.',
    family: 'Design coordination', system: 'fire', hall: 'Site', severity: 'critical', introduced: 'design',
    onDay: 52, offDay: 205, onLag: 12, owner: OWNERS.design, base: { rework_labor: 5000, materials: 3000, retest: 0 }, delayWeight: 1.0,
    whys: ['Room was added late to the layout.', 'Fire discipline was not in the change-control distribution.', 'Code-compliance checklist not rerun after change.'],
    rootCause: 'Late layout changes bypassed fire-protection review.',
    evidence: ['Code review comment FP-07', 'Layout change log'],
    corrective: 'Add suppression zone and update hydraulic calculations.',
    preventative: 'Route every layout change through all-discipline review.',
  },
  {
    id: 'T05', title: 'Switchgear breakers fail supplier torque and QA record check at FAT',
    description: 'Witnessed factory acceptance test found incomplete torque records on main switchgear.',
    family: 'Supplier quality', system: 'electrical', hall: 'Site', severity: 'high', introduced: 'site',
    onDay: 110, offDay: 215, onLag: 30, owner: OWNERS.supplier, base: { rework_labor: 9000, materials: 6000, retest: 4000 }, delayWeight: 1.2,
    whys: ['Supplier shipped before QA documents were complete.', 'Hold points were not contractual.', 'No witness plan for long-lead gear.'],
    rootCause: 'Long-lead equipment had no contractual hold points or witness plan.',
    evidence: ['FAT report FAT-03', 'Supplier QA record gaps'],
    corrective: 'Hold shipment; complete torque verification and records.',
    preventative: 'Include hold points and a witness plan in long-lead purchase orders.',
    lessonId: 'L05',
  },
  {
    id: 'T06', title: 'Chiller weld inspection documentation missing',
    description: 'Supplier could not provide NDT records for chiller refrigerant piping welds.',
    family: 'Supplier quality', system: 'cooling', hall: 'Site', severity: 'medium', introduced: 'site',
    onDay: 98, offDay: 190, onLag: 18, owner: OWNERS.supplier, base: { rework_labor: 3000, materials: 1500, retest: 3000 }, delayWeight: 0.5,
    whys: ['Weld records were not in the submittal checklist.', 'Supplier audit covered only the final assembly.'],
    rootCause: 'Supplier quality plan lacked required inspection records.',
    evidence: ['Supplier audit SA-11'],
    corrective: 'Obtain or recreate NDT records and re-inspect welds.',
    preventative: 'Add NDT record requirements to supplier quality plans.',
  },
  {
    id: 'T07', title: 'Generator-yard drainage graded away from catch basin',
    description: 'Survey shows yard grading deviates from civil drawings.',
    family: 'Site & civil', system: 'site', hall: 'Site', severity: 'low', introduced: 'site',
    onDay: 84, offDay: 150, onLag: 10, owner: OWNERS.construction, base: { rework_labor: 4000, materials: 1500, retest: 500 }, delayWeight: 0.2,
    whys: ['Grade stakes were set from superseded drawing.', 'Drawing revision not controlled at the site.'],
    rootCause: 'Superseded civil drawing was in use at the site.',
    evidence: ['Survey as-built vs. design'],
    corrective: 'Regrade yard to current drawings.',
    preventative: 'Enforce controlled drawing register at point of work.',
  },
  {
    id: 'T08', title: 'Busway joint torque and termination defects in Hall A',
    description: 'Thermal scan and spot checks show under-torqued busway joints and incomplete terminations.',
    family: 'Termination & torque', system: 'electrical', hall: 'A', severity: 'high', introduced: 'construction',
    onDay: 150, offDay: 255, onLag: 40, owner: OWNERS.mep, base: { rework_labor: 10000, materials: 3000, retest: 3000 }, delayWeight: 1.0,
    whys: ['Crew used an uncalibrated torque tool.', 'Torque verification was left to crew self-checks.', 'No independent torque audit before energization.', 'Quality plan assumed commissioning would catch it.'],
    rootCause: 'No independent torque audit before energization; the quality plan relied on commissioning to catch defects.',
    evidence: ['Thermal scan IR-210', 'Torque audit sheets', 'Photos of joints J-12 to J-19'],
    corrective: 'Re-torque and re-terminate all Hall A joints and re-inspect.',
    preventative: 'Independent torque audit (calibrated tools, 10% witness) before any energization.',
    lessonId: 'L01',
  },
  {
    id: 'T09', title: 'Busway joint torque and termination defects in Hall B',
    description: 'Same pattern as Hall A, found at energization of Hall B.',
    family: 'Termination & torque', system: 'electrical', hall: 'B', severity: 'high', introduced: 'construction',
    onDay: null, offDay: 285, onLag: 40, owner: OWNERS.mep, base: { rework_labor: 10000, materials: 3000, retest: 3000 }, delayWeight: 1.0,
    whys: ['Hall A finding was not shared with Hall B crews.', 'No checklist change after Hall A.'],
    rootCause: 'Lessons from Hall A were not applied to Hall B work.',
    evidence: ['Hall B energization log'],
    corrective: 'Re-torque Hall B joints.', preventative: 'Apply torque-audit checklist to all halls.',
    preventedBy: 'L01',
  },
  {
    id: 'T10', title: 'Chilled-water piping flushing and cleanliness deficiency in Hall A',
    description: 'Strainer debris and flush-water samples exceed cleanliness limits.',
    family: 'Pipe cleanliness', system: 'cooling', hall: 'A', severity: 'medium', introduced: 'construction',
    onDay: 170, offDay: 268, onLag: 30, owner: OWNERS.mep, base: { rework_labor: 7000, materials: 2500, retest: 3000 }, delayWeight: 0.8,
    whys: ['Flush was shortened to hold the schedule.', 'No cleanliness acceptance criteria before filling.', 'Strainers were not inspected after flush.'],
    rootCause: 'No cleanliness acceptance gate between flushing and system fill.',
    evidence: ['Strainer debris photos', 'Water sample lab report'],
    corrective: 'Repeat flush, clean strainers and re-sample.',
    preventative: 'Add a cleanliness gate (sample and strainer inspection) before fill.',
    lessonId: 'L02',
  },
  {
    id: 'T11', title: 'Chilled-water piping cleanliness deficiency in Hall B',
    description: 'Repeat of the Hall A flushing failure.',
    family: 'Pipe cleanliness', system: 'cooling', hall: 'B', severity: 'medium', introduced: 'construction',
    onDay: null, offDay: 272, onLag: 30, owner: OWNERS.mep, base: { rework_labor: 7000, materials: 2500, retest: 3000 }, delayWeight: 0.8,
    whys: ['Same shortened flush as Hall A.'], rootCause: 'Hall A lesson not applied to Hall B.',
    evidence: ['Strainer debris photos'], corrective: 'Repeat flush.', preventative: 'Apply cleanliness gate to all loops.',
    preventedBy: 'L02',
  },
  {
    id: 'T12', title: 'Fire-stopping at wall penetrations incomplete',
    description: 'Walk-down finds unsealed penetrations in rated walls.',
    family: 'Inspection readiness', system: 'fire', hall: 'Site', severity: 'medium', introduced: 'construction',
    onDay: 200, offDay: 330, onLag: 25, owner: OWNERS.construction, base: { rework_labor: 6000, materials: 2000, retest: 1000 }, delayWeight: 0.6,
    whys: ['Trades penetrated walls after fire-stopping sign-off.', 'No penetration log tied to inspection.'],
    rootCause: 'No penetration log controlling fire-stopping after later trade work.',
    evidence: ['Walk-down punch list', 'Penetration photos'],
    corrective: 'Seal penetrations and re-inspect.',
    preventative: 'Maintain a penetration log; final sign-off after last trade.',
  },
  {
    id: 'T13', title: 'Rack grounding and bonding continuity not verified',
    description: 'Continuity tests missing for first rack rows.',
    family: 'Inspection readiness', system: 'whitespace', hall: 'A', severity: 'medium', introduced: 'construction',
    onDay: 215, offDay: 280, onLag: 28, owner: OWNERS.cx, base: { rework_labor: 4000, materials: 1000, retest: 2000 }, delayWeight: 0.5,
    whys: ['Test was assumed to be part of rack install scope.', 'No owner for bonding verification.'],
    rootCause: 'Bonding verification had no assigned owner or record.',
    evidence: ['Missing test records'],
    corrective: 'Test and record continuity for all rows.',
    preventative: 'Assign bonding verification owner and add to turnover package.',
  },
  {
    id: 'T14', title: 'Cable tray support spacing nonconformance',
    description: 'Supports exceed allowable spacing in two corridors.',
    family: 'Workmanship', system: 'electrical', hall: 'A', severity: 'low', introduced: 'construction',
    onDay: 160, offDay: 225, onLag: 15, owner: OWNERS.mep, base: { rework_labor: 3500, materials: 800, retest: 0 }, delayWeight: 0.2,
    whys: ['Installers used old spacing detail.', 'No first-article inspection.'],
    rootCause: 'No first-article inspection for repetitive installs.',
    evidence: ['Inspection photos'],
    corrective: 'Add supports to meet spacing.',
    preventative: 'Introduce first-article inspection for repetitive work.',
  },
  {
    id: 'T15', title: 'Slab flatness out of tolerance in Hall B rack zone',
    description: 'Survey shows slab flatness exceeds tolerance for rack alignment.',
    family: 'Workmanship', system: 'structure', hall: 'B', severity: 'low', introduced: 'construction',
    onDay: 140, offDay: 240, onLag: 15, owner: OWNERS.construction, base: { rework_labor: 5000, materials: 1500, retest: 500 }, delayWeight: 0.3,
    whys: ['Finish crew skipped intermediate checks.', 'Flatness acceptance criteria not in the pour checklist.'],
    rootCause: 'Pour checklist omitted flatness acceptance criteria.',
    evidence: ['Floor-flatness survey'],
    corrective: 'Grind high spots and re-survey.',
    preventative: 'Add flatness criteria and mid-pour checks to the checklist.',
  },
  {
    id: 'T16', title: 'Chiller start fails: BMS point mapping error',
    description: 'Chiller 2 refuses to start due to mismapped enable point.',
    family: 'Controls & commissioning scripts', system: 'controls', hall: 'Site', severity: 'medium', introduced: 'construction',
    onDay: 262, offDay: 262, onLag: 20, owner: OWNERS.cx, base: { rework_labor: 2500, materials: 300, retest: 1500 }, delayWeight: 0.4,
    whys: ['Point list edited manually in two places.', 'No point-to-point check before functional test.', 'Controls contractor assumed integrator verified.'],
    rootCause: 'No point-to-point verification before functional performance tests.',
    evidence: ['BMS trend logs', 'Point list rev 7 vs 9'],
    corrective: 'Correct point mapping and retest start sequence.',
    preventative: 'Require point-to-point verification before functional tests.',
    lessonId: 'L03',
  },
  {
    id: 'T17', title: 'UPS battery string fails load test',
    description: 'String 3 reaches cut-off voltage early under load-bank test.',
    family: 'Supplier quality', system: 'electrical', hall: 'A', severity: 'high', introduced: 'site',
    onDay: 275, offDay: 275, onLag: 40, owner: OWNERS.supplier, base: { rework_labor: 5000, materials: 15000, retest: 4000 }, delayWeight: 0.9,
    whys: ['Cells were stored beyond allowable period.', 'Storage conditions not logged.', 'Receiving inspection lacked state-of-charge checks.'],
    rootCause: 'Receiving inspection and storage controls did not cover battery state of charge.',
    evidence: ['Load test curves', 'Receiving records'],
    corrective: 'Replace affected cells and retest string.',
    preventative: 'Add storage logs and state-of-charge checks at receiving.',
  },
  {
    id: 'T18', title: 'Integrated systems test: generator transfer sequence timing out of limits',
    description: 'Transfer to generator exceeds allowed time during IST.',
    family: 'Controls & commissioning scripts', system: 'controls', hall: 'Site', severity: 'high', introduced: 'design',
    onDay: 280, offDay: 296, onLag: 30, owner: OWNERS.cx, base: { rework_labor: 4000, materials: 1000, retest: 6000 }, delayWeight: 1.0,
    whys: ['Sequence timing was never simulated.', 'Controls interface between ATS and generator was untested before IST.'],
    rootCause: 'Interface timing was first exercised in IST rather than in earlier functional tests.',
    evidence: ['IST step log', 'ATS relay settings'],
    corrective: 'Retune relay settings and rerun transfer test.',
    preventative: 'Run interface timing tests in level-4 functional tests.',
  },
  {
    id: 'T19', title: 'Leak-detection sensors miswired',
    description: 'Hall A leak-detection zones report incorrect locations.',
    family: 'Controls & commissioning scripts', system: 'controls', hall: 'A', severity: 'medium', introduced: 'construction',
    onDay: 284, offDay: 300, onLag: 18, owner: OWNERS.cx, base: { rework_labor: 2500, materials: 400, retest: 1000 }, delayWeight: 0.3,
    whys: ['Terminal labels differ from drawing.', 'Point-to-point checks skipped.'],
    rootCause: 'Field labels were not verified against drawings.',
    evidence: ['Alarm test log'],
    corrective: 'Correct wiring and retest alarms.',
    preventative: 'Include label verification in point-to-point checks.',
  },
  {
    id: 'T20', title: 'Hot-aisle containment air leakage found in thermal test',
    description: 'Thermal test shows bypass air through containment door seals.',
    family: 'Workmanship', system: 'whitespace', hall: 'B', severity: 'medium', introduced: 'construction',
    onDay: 292, offDay: 305, onLag: 20, owner: OWNERS.cx, base: { rework_labor: 3000, materials: 2500, retest: 1500 }, delayWeight: 0.4,
    whys: ['Door seal profile differs from specification.', 'No mock-up before installation.'],
    rootCause: 'No mock-up or first-article approval for containment components.',
    evidence: ['Thermal images'],
    corrective: 'Replace door seals and re-test.',
    preventative: 'Require approved mock-up for containment components.',
  },
  {
    id: 'T21', title: 'As-built drawings and O&M manuals incomplete at turnover',
    description: 'Turnover package lacks as-built updates for electrical single-lines and O&M manuals.',
    family: 'Handover readiness', system: 'operations', hall: 'Site', severity: 'medium', introduced: 'construction',
    onDay: 325, offDay: 335, onLag: 18, owner: OWNERS.handover, base: { rework_labor: 3500, materials: 0, retest: 0 }, delayWeight: 0.4,
    whys: ['As-builts were updated at the end of the project.', 'No turnover-package review before the final milestone.'],
    rootCause: 'Turnover documentation was not tracked as a deliverable with interim reviews.',
    evidence: ['Turnover checklist'],
    corrective: 'Complete as-builts and manuals; review with operations.',
    preventative: 'Track turnover documents from construction start with interim reviews.',
  },
  {
    id: 'T22', title: 'Spare-parts inventory gap against maintenance plan',
    description: 'Critical spares listed in the maintenance plan are not on site.',
    family: 'Handover readiness', system: 'operations', hall: 'Site', severity: 'low', introduced: 'site',
    onDay: 330, offDay: 345, onLag: 20, owner: OWNERS.handover, base: { rework_labor: 1500, materials: 5000, retest: 0 }, delayWeight: 0.2,
    whys: ['Spares list was not reconciled with procurement.', 'Operations were engaged late.'],
    rootCause: 'Operations stakeholders were engaged too late to reconcile spares.',
    evidence: ['Spares reconciliation sheet'],
    corrective: 'Order and receive missing spares.',
    preventative: 'Engage operations at design review to define spares.',
  },
  {
    id: 'T23', title: 'Alarm thresholds not transferred to operations monitoring',
    description: 'Monitoring system alarm set-points differ from commissioned values.',
    family: 'Handover readiness', system: 'controls', hall: 'Site', severity: 'medium', introduced: 'commissioning',
    onDay: 335, offDay: 348, onLag: 15, owner: OWNERS.handover, base: { rework_labor: 2000, materials: 0, retest: 1000 }, delayWeight: 0.3,
    whys: ['Commissioned values lived in a separate spreadsheet.', 'No transfer step in turnover process.'],
    rootCause: 'No controlled transfer of commissioned set-points to operations.',
    evidence: ['Set-point comparison'],
    corrective: 'Align alarm thresholds with commissioned values.',
    preventative: 'Add set-point transfer to the turnover checklist.',
  },
  {
    id: 'T24', title: 'BMS point mapping error on Hall B cooling units',
    description: 'Repeat of the chiller point mapping problem on Hall B equipment.',
    family: 'Controls & commissioning scripts', system: 'controls', hall: 'B', severity: 'medium', introduced: 'construction',
    onDay: null, offDay: 291, onLag: 34, owner: OWNERS.cx, base: { rework_labor: 2500, materials: 300, retest: 1500 }, delayWeight: 0.4,
    whys: ['Point-to-point check not applied to Hall B.'], rootCause: 'Chiller lesson was not applied to Hall B.',
    evidence: ['BMS trend logs'], corrective: 'Correct mapping.', preventative: 'Apply point-to-point checks to all halls.',
    preventedBy: 'L03',
  },
];

export const LESSON_TEMPLATES: LessonTemplate[] = [
  { id: 'L01', title: 'Independent torque audit before energization', family: 'Termination & torque', sourceTemplateId: 'T08',
    summary: 'Use calibrated tools and witness at least 10% of joints before any energization. Applies to every hall and busway run.' },
  { id: 'L02', title: 'Cleanliness gate before filling piping loops', family: 'Pipe cleanliness', sourceTemplateId: 'T10',
    summary: 'Require passing water samples and strainer inspection before system fill. Do not shorten flushing to hold schedule.' },
  { id: 'L03', title: 'Point-to-point verification before functional tests', family: 'Controls & commissioning scripts', sourceTemplateId: 'T16',
    summary: 'Complete and sign point-to-point checks, including label verification, before any functional performance test.' },
  { id: 'L04', title: 'Clash-resolution gate before issue-for-construction', family: 'Design coordination', sourceTemplateId: 'T01',
    summary: 'Require zero hard clashes and named interface owners per zone before drawings are issued for construction.' },
  { id: 'L05', title: 'Hold points and witness plan for long-lead equipment', family: 'Supplier quality', sourceTemplateId: 'T05',
    summary: 'Write hold points and a witnessed FAT into purchase orders; release shipment only after QA records are complete.' },
];
