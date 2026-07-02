# Latchboard Release Checklist

## Preflight

- Confirm `package.json` declares Node.js `>=18.12 <23` and license `MIT`.
- Confirm `package.json` has a package `files` allowlist.
- Confirm the checkout is on the intended release branch.
- Confirm `.superpowers/`, `.serena/`, `.latchboard/`,
  `docs/superpowers/plans/`, `dist/`, `test-results/`, and
  `playwright-report/` are not staged or packaged for release.
- Confirm Planning Inbox is documented as future v0.2 work, not current v0.

## Validation Commands

Run from a clean checkout:

```bash
npm ci
npm run release:preflight
npm test
npm run typecheck
npm run build
npm run test:smoke
```

If smoke tests cannot find Chromium, install the browser binary and rerun smoke:

```bash
npx playwright install chromium
npm run test:smoke
```

If the smoke port is already in use, rerun smoke on a fixed alternate port:

```bash
LATCHBOARD_SMOKE_PORT=8788 npm run test:smoke
```

## Generated Artifacts

These commands create local generated files that are ignored by git:

- `npm run build` creates `dist/`.
- `npm run demo` creates `.latchboard/state.json`.
- `npm run test:smoke` creates `test-results/` and may create
  `playwright-report/` when a smoke test fails.

## Privacy Checks

- Review [docs/privacy.md](privacy.md), [docs/input-format.md](input-format.md),
  and [SECURITY.md](../SECURITY.md).
- Confirm Real Events examples use only safe metadata fields.
- Confirm docs tell users not to include raw prompts, terminal output, full
  paths, repo names, branch names, commands, tokens, secrets, or customer
  identifiers.
- Confirm generated `.latchboard/state.json` is local sidecar state and ignored
  by git.

## GitHub Publish

Do not assume a GitHub remote already exists.

1. Choose the public repository owner and repository URL.
2. Inspect existing remotes:

   ```bash
   git remote -v
   ```

3. If no `origin` remote exists, add it only after the owner and URL are
   confirmed:

   ```bash
   git remote add origin <public-repository-url>
   ```

4. If `origin` already exists, verify it points to the intended public
   repository before pushing.
5. Push the release branch or tag only after validation and privacy checks pass.

## Fresh Clone Smoke

In a new directory, clone the public repository and run:

```bash
npm ci
npm run build
npm run demo
```

Open the printed loopback URL. The expected demo result is 4 Attention Queue
rows and 5 All Workstreams rows. `npm run demo` writes `.latchboard/state.json`,
which must remain ignored by git.

## Dogfood Start

Start real mode with a local metadata-only input file named `events.jsonl`:

```bash
npm run dev -- --input /path/to/events.jsonl
```

Use [docs/input-format.md](input-format.md) for the JSONL format and privacy
rules. Do not dogfood with raw prompts, terminal output, paths, repo names,
branch names, commands, tokens, secrets, or customer identifiers.

## Rollback

- Stop the local Latchboard process.
- Remove or archive generated `.latchboard/state.json` if it is no longer
  needed.
- If a public GitHub push used the wrong remote, stop and coordinate repository
  access changes before pushing any corrective branch or tag.
- If a released doc contains sensitive data, remove the data from the public
  repository history according to the repository owner's incident process.
