# Roadmap

## v0.1 (this release)
Working MVP: lifecycle simulation (closed loop OFF vs ON), closed-loop issue workflow, dashboard, learning view, editable assumptions, demo video, live demo.

## vNext: reusable skill
Goal: let a quality, construction or program lead adapt the framework to their own data-center business without writing code.

1. **Skill (first)**: [skill/SKILL.md](skill/SKILL.md) runs an intake interview (delivery phases, capacity milestones, issue families, cost drivers, terminology, existing data) and produces a validated `scenario.json`.
2. **Config-driven app**: refactor `src/data/templates.ts` and `src/domain/project.ts` into a loader that reads `scenario.json`, keeping the existing integrity and determinism tests as the validation suite.
3. **Template/CLI (second)**: an `npx` generator that scaffolds a customized app from a scenario file.
4. **Real data import**: map an organization's NCR / punch-list exports into the issue register.
5. **3D renderer**: optional, behind the existing `SceneRenderer` seam.

Principles: stay company-neutral, keep observed cost separate from estimated avoided cost, and make every assumption editable and visible.

Status: planned. Nothing in `skill/` is shipped functionality yet. See [skill/schema.md](skill/schema.md) for the draft config schema.
