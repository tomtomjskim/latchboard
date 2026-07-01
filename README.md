# Latchboard

Local AI work completion gate.

Latchboard turns today's local cmux events into a read-only attention queue for
missing validation, missing next step, blocked work, and stale work.

## Privacy Model

Latchboard is local-only and read-only. It binds to `127.0.0.1`, reads local
JSONL events, writes a local snapshot sidecar, and renders metadata-only
workstream state. Raw prompts, terminal output, repository paths, branch names,
commands, and secrets are not part of the normalized fact or public snapshot
contract.

See `docs/privacy.md` for the full privacy model.

## Quick Start

```bash
npm install
npm run build
npm run demo
```

Open the printed loopback URL. The demo uses sanitized fixture data from
`fixtures/demo-attention-gate.jsonl`.

## Real Events Mode

Real mode requires an explicit local input file named `events.jsonl`:

```bash
npm run dev -- --input /path/to/events.jsonl
```

Useful flags:

- `--port 8787`
- `--state .latchboard/state.json`
- `--timezone Asia/Seoul`
- `--stale-ms 7200000`

## Validation

```bash
npm test -- tests/server/privacy-canary.test.ts
npm test
npm run typecheck
npm run build
npm run test:smoke
npm audit --omit=dev
```

## Design Docs

- `docs/privacy.md`
- `docs/superpowers/specs/2026-07-01-latchboard-v0-design.md`
- `docs/superpowers/specs/2026-07-01-latchboard-planning-inbox-design.md`
- `docs/superpowers/plans/2026-07-01-latchboard-v0-implementation.md`
