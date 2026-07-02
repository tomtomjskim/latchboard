# Latchboard

Local AI work completion gate.

## What It Does

Latchboard turns local JSONL work events into a read-only dashboard for work
that may need operator attention: missing validation, missing next step, blocked
work, and stale work. The demo fixture is expected to show 4 Attention Queue
rows and 5 All Workstreams rows.

Latchboard is source-distributed for local use. npm package publishing is not
the primary distribution path.

## Privacy Model

Latchboard is local-only and read-only. It binds to `127.0.0.1`, reads local
JSONL events, writes a local snapshot sidecar, and renders metadata-only
workstream state. Raw prompts, terminal output, full paths, repo names, branch
names, commands, tokens, secrets, and customer identifiers must not be included
in input events or reports.

See [docs/privacy.md](docs/privacy.md) for the full privacy model.

## Requirements

- Node.js `>=18.12 <23`
- npm

## Quick Start

```bash
npm ci
npm run build
npm run demo
```

Open the printed loopback URL. `npm run demo` uses sanitized fixture data from
`fixtures/demo-attention-gate.jsonl` and writes `.latchboard/state.json`, which
is ignored by git.

The expected demo result is 4 Attention Queue rows and 5 All Workstreams rows.

If smoke tests fail because the Chromium browser binary is missing, install it:

```bash
npx playwright install chromium
```

## Real Events Mode

Real mode requires an explicit local input file named `events.jsonl`:

```bash
npm run dev -- --input /path/to/events.jsonl
```

Use JSONL, one JSON object per line. Keep each event metadata-only:

```json
{"time":"2026-07-02T09:10:00.000+09:00","source":"cmux","sessionId":"opaque-session-id","kind":"assistant","signals":["completion_claim_seen","next_step_signal_seen"]}
```

Do not include raw prompts, terminal output, full paths, repo names, branch
names, commands, tokens, secrets, or customer identifiers. See
[docs/input-format.md](docs/input-format.md) for the safe input contract.

## Runtime Flags

- `--mode demo|real`: demo uses the sanitized fixture; real reads `--input`.
- `--input /path/to/events.jsonl`: required in real mode and the file name must
  be `events.jsonl`.
- `--port 8787`: loopback HTTP port. Use `0` to request an available port.
- `--state .latchboard/state.json`: local sidecar snapshot path.
- `--timezone Asia/Seoul`: dashboard date/timezone.
- `--stale-ms 7200000`: stale threshold in milliseconds.

## Validation

```bash
npm test
npm run typecheck
npm run build
npm run test:smoke
```

Smoke tests may require:

```bash
npx playwright install chromium
```

## Release Checklist

Use [docs/release-checklist.md](docs/release-checklist.md) before publishing a
public GitHub release. The release checklist covers fresh-clone smoke testing,
privacy checks, GitHub remote setup, dogfood start, and rollback.

## Operations

- [docs/dogfood-runbook.md](docs/dogfood-runbook.md)

## Roadmap

Latchboard v0 is local-only, read-only, and dashboard-focused. Planning Inbox is
future v0.2 work and is not implemented in v0.

## Design Docs

- [docs/privacy.md](docs/privacy.md)
- [docs/input-format.md](docs/input-format.md)
- [docs/troubleshooting.md](docs/troubleshooting.md)
- [docs/release-checklist.md](docs/release-checklist.md)
- [SECURITY.md](SECURITY.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [docs/superpowers/specs/2026-07-01-latchboard-v0-design.md](docs/superpowers/specs/2026-07-01-latchboard-v0-design.md)
- [docs/superpowers/specs/2026-07-01-latchboard-planning-inbox-design.md](docs/superpowers/specs/2026-07-01-latchboard-planning-inbox-design.md)

## License

MIT
