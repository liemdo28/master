# Mi Workflow Studio Spec

Provider candidate: Open Agent Builder

Goal: visually define Mi workflows, export JSON, run dry-run validation, and only later connect approved actions.

Minimum entities:
- workflow
- trigger
- step
- approval policy
- audit log
- artifact reference

Lab pass:
- load `pocs/food_safety_submission_v1.json`
- validate schema
- render or list steps
- export unchanged JSON
- no production write
