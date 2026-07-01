# Latchboard Privacy Model

Latchboard is a local-only, read-only dashboard for local AI work signals. It is
designed to show metadata about work state without displaying raw prompts,
terminal output, repository paths, branch names, commands, or secrets.

## Local Only

- The server binds to `127.0.0.1`.
- The browser UI is served from the same loopback server.
- API access requires the per-process bearer token printed by the local server.
- Latchboard does not include telemetry or a remote sync path.

## Read Only

- Latchboard reads JSONL event input and writes a local snapshot sidecar.
- It does not write back to the event source.
- It does not modify repositories, shells, tasks, credentials, or editor state.

## Metadata Only

The normalizer converts raw event records into `SafeFact` metadata:

- source type,
- normalized timestamp,
- generated workstream id,
- safe fact code,
- safe source event type.

The public snapshot, REST API, SSE stream, and UI render from that sanitized
snapshot. Raw record fields such as payload, prompt text, terminal output,
paths, commands, tokens, branch names, and repo names are not part of the public
contract.

## Quick Start

```bash
npm install
npm run build
npm run demo
```

Open the printed loopback URL in your browser. The server also prints the API
token used by the UI bootstrap.

## Real Events Mode

Real mode requires an explicit local input file named `events.jsonl`:

```bash
npm run dev -- --input /path/to/events.jsonl
```

Optional runtime flags:

- `--port 8787`
- `--state .latchboard/state.json`
- `--timezone Asia/Seoul`
- `--stale-ms 7200000`

## Validation Commands

Run these before release:

```bash
npm test -- tests/server/privacy-canary.test.ts
npm test
npm run typecheck
npm run build
npm run test:smoke
npm audit --omit=dev
```

## Design Docs

- `docs/superpowers/specs/2026-07-01-latchboard-v0-design.md`
- `docs/superpowers/specs/2026-07-01-latchboard-planning-inbox-design.md`
- `docs/superpowers/plans/2026-07-01-latchboard-v0-implementation.md`
