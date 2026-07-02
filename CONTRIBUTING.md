# Contributing

## Development Setup

Use Node.js `>=18.12 <23` and npm:

```bash
npm ci
npm run build
npm run demo
```

Open the printed loopback URL. The demo fixture should show 4 Attention Queue
rows and 5 All Workstreams rows.

## Validation

Run these before opening a pull request:

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run test:smoke
```

If smoke tests need a browser binary, run:

```bash
npx playwright install chromium
```

## Privacy Boundary

Latchboard event records, screenshots, logs, reports, issues, and release notes
must stay metadata-only. Do not include raw prompts, private terminal output,
full paths, repo names, branch names, private command history, tokens, secrets,
or customer identifiers.

Real Events examples must use a local file named `events.jsonl` and the safe
format in [docs/input-format.md](docs/input-format.md).

## Pull Request Checklist

- The change stays local-only and read-only unless a design doc explicitly says
  otherwise.
- Public docs use `npm ci`, not `npm install`, for fresh-clone setup.
- Demo docs mention `.latchboard/state.json` as generated ignored state.
- Smoke test docs mention `npx playwright install chromium`.
- Planning Inbox is described as future v0.2 work, not current v0.
- Validation commands were run or the PR explains which command could not run
  and why.
