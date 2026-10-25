# Default assumptions

All values are editable in the UI and reset to these defaults.

| Assumption | Default | Rationale |
|---|---|---|
| Cost multiplier by detection phase (design, site, construction, commissioning, handover) | 1, 2, 5, 11, 18 | Illustrative escalation: later detection means more rework, retest and disruption |
| Delay days per issue by phase | 0, 0.5, 1.5, 4, 6 (× issue delay weight) | Later defects are more likely to sit on the critical path |
| Delay cost per day | $35,000 | Placeholder for carrying cost and deferred capacity revenue |
| Schedule overlap factor | 0.6 | Not all delays stack on the critical path |
| At-risk threshold | 3 days of slip | Milestone flagged when forecast slip exceeds it |
| Closed-loop OFF behavior | Triage +4 days, no root cause, corrective actions only, slower closure | Models reactive punch-list handling |

Figures are illustrative, not benchmarks. Replace them with an organization's own data before drawing conclusions.
