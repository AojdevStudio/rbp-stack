# Review: Observability + Installer + Spec Telemetry

## Recommendations / Review Comments

- [P1] Honor observability disabled flag in ralph-execute/close-with-proof
  - File: rbp/scripts/ralph-execute.sh:15-24
  - Issue: Quick-plan path does not read rbp-config.yaml to set RBP_OBSERVABILITY_ENABLED, so emit-event defaults to true even when opt-out is set.
  - Recommendation: Load the config flag in ralph-execute.sh (or propagate via ralph.sh) and export RBP_OBSERVABILITY_ENABLED before any events emit.

- [P2] Optional PAI check blocks non-interactive installs
  - File: rbp/install.sh:78-93
  - Issue: Installer prompts Continue without PAI? (y/n) when Observability skill is missing. This hangs in CI/non-interactive installs.
  - Recommendation: Default to continue in non-interactive environments, or add a flag/env override to skip the prompt.

- [P3] Spec parsed event reports total beads, not tasks created
  - File: rbp/scripts/ralph-execute.sh:245-252
  - Issue: task_count uses bd list length, which counts all beads, inflating telemetry when existing beads are present.
  - Recommendation: Capture delta (before/after) or count tasks created for the spec only.
