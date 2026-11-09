# Maintenance for Worker security automation

## Definition

Outcome: Enable weekly dependency update checks and CodeQL for worker-ci-action.
Preserved contract: Existing build, release and deployment workflow behavior and executable dependency pins.
Task base: f8fafde443a54d7eb815d77cf8a8f93dd53bfa0c
Affected paths: .github/dependabot.yml,.github/workflows/codeql-actions.yml,.github/workflows/codeql-js.yml
Verification inputs: The workflows, dependency updater configuration, shared CodeQL v1.2.4 interface, and existing repository source and lockfiles.
Proposed change: Reuse the org Dependabot baseline and pinned CodeQL workflow.
Required checks: actionlint, YAML policy checks, and existing runtime checks where available. Confirm hosted scans and Dependabot runs after merge.

## Evidence

No Dependabot version config or CodeQL results were present at the base. Local actionlint and updater policy checks passed. Existing delivery workflow YAML parses to the same values as the base.

## Reviews

## State

Independent review pending.
