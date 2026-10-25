# Metric definitions

All metrics are pure functions in `src/domain/metrics.ts`, evaluated at the selected project day (`asOfDay`).

| Metric | Definition |
|---|---|
| Reported / open issues | Issues with `reportedDay <= asOfDay` / those not yet verified closed |
| Detected phase | Phase containing the reported day; the introduced phase is where the defect originated |
| Time to triage | Triage day minus reported day, averaged over triaged issues |
| Time to verified closure | Verification day minus reported day, averaged over verified issues |
| Overdue actions | Open actions with a due day before `asOfDay` |
| Action completion | Completed actions / total actions (preventative shown separately) |
| Repeat-issue rate | Issues whose family was already seen / reported issues |
| Observed CoPQ | Sum of recorded rework labor, materials, retest and delay cost, scaled by the detection-phase multiplier |
| Delay cost | Delay days × delay cost per day; delay days = phase delay days × issue delay weight |
| Milestone slip | Schedule overlap factor × delay days of issues detected at or before the milestone's phase |
| At risk | Forecast slip greater than the at-risk threshold |
| Estimated avoided | OFF total minus ON total, split into earlier detection and prevented repeats |

Invariant (unit tested): at day 360, OFF total − ON total = estimated avoided total.
