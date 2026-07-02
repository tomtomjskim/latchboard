# Security Policy

## Supported Versions

Latchboard v0 is source-distributed for local use from the public repository.
Use the current default branch or a documented release tag. The supported
runtime is Node.js `>=18.12 <23`.

## Local-Only Threat Model

Latchboard is designed as a local-only, read-only dashboard:

- The server binds to `127.0.0.1`.
- API and SSE access require a per-process bearer token.
- Input is local JSONL.
- Output is sanitized dashboard state and local sidecar state.
- There is no telemetry or remote sync path in v0.

## Reporting a Vulnerability

Public users should open a GitHub issue with no secrets. Before submitting,
remove tokens, paths, raw prompts, terminal output, customer identifiers, repo
names, branch names, commands, and any other sensitive local data.

If the report requires sensitive reproduction details, first open a minimal
issue that describes the affected area without including the sensitive data.

## Sensitive Data Rules

Do not place these values in input files, screenshots, logs, issues, pull
requests, or release notes:

- raw prompts,
- terminal output,
- full paths,
- repo names,
- branch names,
- commands,
- tokens,
- secrets,
- customer identifiers.

Use opaque identifiers and sanitized metadata in examples and reports.
