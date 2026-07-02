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

Report vulnerabilities through GitHub Private Vulnerability Reporting when it is
available for the repository. If private vulnerability reporting is not
available, use a private maintainer contact before creating any public issue.

Public GitHub issues are appropriate only for non-sensitive hardening requests,
documentation fixes, or questions that do not require private reproduction
details.

Before submitting any report, remove tokens, secrets, raw prompts, terminal
output, full paths, repo names, branch names, commands, customer identifiers,
and any other sensitive local data.

Do not include sensitive reproduction details in a public issue. Use opaque
identifiers and sanitized metadata when a public follow-up is needed.

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
