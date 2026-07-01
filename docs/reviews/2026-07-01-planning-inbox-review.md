# Planning Inbox Review Pipeline

## Review Scope

This review evaluates whether Planning Inbox should be added to Latchboard and
where it belongs in the roadmap.

## Decision

Adopt as v0.2. Do not include in v0.

## Review Summary

### Product Review

- The idea is useful because it turns Latchboard from pure observation into
  planned-vs-observed monitoring.
- It directly supports the two recurring failures: missing validation and missing
  next step.
- It must not become a PM board, scheduler, or executor in v0.2.

### Architecture Review

- Planning data should be a separate local store from derived cmux state.
- Planned tasks should link to observed workstreams by opaque id, task id, or
  explicit prompt inclusion.
- CLI execution should be deferred until an execution policy and approval gate
  exist.

### UX Review

- Planning should be a side panel or modal, not a new primary screen.
- Fast capture must be faster than writing a markdown note.
- The main dashboard should remain Attention Queue first.

### Security Review

- Prompt draft generation is acceptable.
- CLI execution, shell execution, server write actions, DB write actions,
  deployment, restart, and external mutation are forbidden in v0.2.
- Planning input and prompt drafts must pass forbidden-token validation before
  persistence or copy, covering raw prompts, terminal output, raw cmux payloads,
  full paths, raw repo names, command text, secret-like strings, and copied or
  extracted freeform logs.

### QA Review

- v0.2 needs fixtures for planned task creation, prompt generation, planned vs
  observed linking, and secret-like input rejection.
- v0 must not depend on Planning Inbox tests or data.

## Adopted Constraints

- v0 remains read-only and cmux-events driven.
- v0.2 Planning Inbox is copy-only and local-only.
- v1 may revisit allowlisted CLI handoff with explicit approval gates.

## Follow-Up

- Include Planning Inbox as future extension in the v0 spec.
- Keep a separate v0.2 spec for Planning Inbox.
- Do not implement Planning Inbox before v0 dogfood validates the attention
  model.
