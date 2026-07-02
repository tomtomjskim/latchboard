# Latchboard

Local AI work completion gate.

## Current Scope

Latchboard v0.1 is a local read-only monitor. It does not yet provide a
planning inbox, todo modal, scheduling, Telegram/Hermes execution, or automatic
agent command dispatch.

## What It Does

Latchboard turns local JSONL work events into a read-only dashboard for work
that may need operator attention: missing validation, missing next step, blocked
work, and stale work. The demo fixture is expected to show 4 Attention Queue
rows and 5 Observed Scopes rows.

In real cmux mode, neutral UI activity such as focus, selection, window, pane,
surface, workspace, and notification events is reduced to `activity_seen`. This
shows that the live source is current without treating UI activity alone as a
missing next-step alert.

The browser dashboard embeds the latest snapshot into the initial HTML and then
auto-refreshes every 2 seconds. Real cmux workstreams use privacy-safe dimension
labels such as `workspace a1b2c3` or `session d4e5f6`, and show their last safe
signal. Neutral cmux UI activity is grouped by workspace first to reduce
window/pane noise; agent and tool activity is grouped by session first. When a
session/tool event also carries a workspace identity, the dashboard shows a
privacy-safe parent hint such as `Parent workspace a1b2c3`.

v0.1 still does not display repo names, paths, raw prompts, or task titles.
Those need a separate safe metadata source before they can appear in the UI.

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

Open the printed loopback URL. `npm run demo` uses fixed sanitized fixture data
from `fixtures/demo-attention-gate.jsonl`, labels the UI as not live data, and
writes `.latchboard/state.json`, which is ignored by git.

The expected demo result is 4 Attention Queue rows and 5 Observed Scopes rows.

If smoke tests fail because the Chromium browser binary is missing, install it:

```bash
npx playwright install chromium
```

## Real Events Mode

Real mode requires an explicit local input file named `events.jsonl`:

```bash
npm run dev -- --input /path/to/events.jsonl
```

For cmux's default local event stream, use:

```bash
npm run dev:cmux
```

Real mode currently expects native cmux JSONL event envelopes. Keep each event
metadata-only:

```json
{"type":"event","name":"window.keyed","occurred_at":"2026-07-02T05:19:42.996Z","payload":{"workspace_id":"opaque-workspace-id","window_id":"opaque-window-id"}}
```

Top-level `signals` are not trusted in real cmux mode. Latchboard groups neutral
UI activity by `workspace_id` first, while agent and tool activity prefers
`session_id`. Do not include raw
prompts, terminal output, full paths, repo names, branch names, commands,
tokens, secrets, or customer identifiers. See [docs/input-format.md](docs/input-format.md)
for the safe input contract.

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

Immediate development priorities:

1. Live cmux baseline: read `~/.cmuxterm/events.jsonl` safely and show current
   local activity without raw payload leakage. Current implementation shows
   neutral cmux activity as `activity_seen` and keeps activity-only workstreams
   out of the Attention Queue.
2. Planning Inbox: add local-only task intake, validation expectation, next-step
   requirement, and prompt draft generation.
3. Agent handoff and scheduling: keep this deferred until explicit approval,
   dry-run, and audit gates exist.

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
