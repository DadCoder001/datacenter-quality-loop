---
name: datacenter-quality-loop
description: (Planned, not yet functional) Adapt the closed-loop quality and learning framework to a specific data-center delivery business by interviewing the user and generating a validated scenario.json.
---

# Data-center quality loop skill (draft)

## When to use
The user wants to tailor the Quality Loop demo to their own data-center delivery context.

## Intake interview (ask one topic at a time)
1. Delivery phases and names used in their organization (default: design, site, construction, commissioning, handover).
2. Capacity milestones and target dates.
3. Top recurring issue families (for example termination torque, commissioning test failures, design coordination clashes).
4. Cost drivers: rework labor, materials, retest, delay cost per day, and how cost grows with later detection.
5. Terminology: issue vs NCR vs defect, root-cause method (5-Whys, fishbone), corrective vs preventative actions.
6. Any real data available (register exports) and whether to anonymize it.

## Output
A `scenario.json` following [schema.md](schema.md), with fictional or anonymized data only.

## Validation
- No company-specific or confidential names unless the user owns them.
- Observed cost and estimated avoided cost remain separate.
- Integrity rules from `tests/unit` apply: dates in order, repeats prevented only by verified lessons.

## Status
Draft scaffold. See [ROADMAP.md](../ROADMAP.md).
