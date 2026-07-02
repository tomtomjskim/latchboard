# Latchboard Troubleshooting

## Node Version

Latchboard requires Node.js `>=18.12 <23` and npm. If install, build, or test
commands fail before running project code, check the active version:

```bash
node --version
npm --version
```

Switch to a supported Node.js version, then rerun:

```bash
npm ci
```

## Playwright Browser Missing

Smoke tests use Chromium. If `npm run test:smoke` reports that the browser
binary is missing, install it:

```bash
npx playwright install chromium
```

Then rerun:

```bash
npm run test:smoke
```

## Port Already In Use

The default loopback port is `8787`. If it is already in use, choose another
port:

```bash
npm run demo -- --port 8788
```

You can also request an available port:

```bash
npm run demo -- --port 0
```

Smoke tests also default to `8787`. If that port is already in use during
`npm run test:smoke`, choose a fixed alternate port:

```bash
LATCHBOARD_SMOKE_PORT=8788 npm run test:smoke
```

## Real Mode Input Error

Real mode needs an explicit input file named `events.jsonl`:

```bash
npm run dev -- --input /path/to/events.jsonl
```

The file name itself must be `events.jsonl`; paths ending in other file names
are rejected.

## Empty Dashboard

If the dashboard opens but has no useful rows:

- Confirm the server printed a loopback URL on `127.0.0.1`.
- In demo mode, rerun `npm run demo` and expect 4 Attention Queue rows and 5 All
  Workstreams rows.
- In real mode, confirm `events.jsonl` contains JSONL records with an identity
  field and safe signals from [docs/input-format.md](input-format.md).
- Confirm event timestamps are parseable.

## Generated State Files

Latchboard writes local sidecar state to `.latchboard/state.json` by default.
That directory is ignored by git. To write state somewhere else:

```bash
npm run demo -- --state /tmp/latchboard-state.json
```
