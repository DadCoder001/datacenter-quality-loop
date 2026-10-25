# Draft `scenario.json` schema

```jsonc
{
  "project": { "name": "string", "days": 360 },
  "phases": [{ "id": "design", "label": "Design", "startDay": 0, "endDay": 59 }],
  "milestones": [{ "id": "M1", "label": "string", "day": 60, "phaseId": "design" }],
  "assumptions": {
    "costMultiplier": { "design": 1 },
    "delayDaysPerPhase": { "design": 0 },
    "delayCostPerDayUsd": 35000,
    "scheduleOverlapFactor": 0.6,
    "atRiskSlipDays": 3
  },
  "issueTemplates": [{
    "id": "T01", "title": "string", "family": "string", "severity": "high",
    "introducedPhase": "design", "onDay": 12, "offDay": 70, "onLag": 10,
    "delayWeight": 1, "cost": { "labor": 0, "materials": 0, "retest": 0 },
    "whys": ["string"], "rootCause": "string",
    "corrective": ["string"], "preventative": ["string"]
  }],
  "lessons": [{ "id": "L01", "title": "string", "preventsTemplateIds": ["T09"], "verifiedByTemplateId": "T01" }]
}
```

Rules: phase ranges are contiguous; `onDay`/`offDay` fall inside the project; a lesson only prevents a repeat that occurs after the lesson's source issue is verified.

Draft only; the app does not read this file yet.
