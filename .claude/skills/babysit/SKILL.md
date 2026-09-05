---
name: babysit
description: How to triage and fix CI failures on this repo's PRs.
---

# Babysitting CI — Energy and Power Monitor Card

This repo runs two workflows on every PR (see `.github/workflows/`):

- **CI** (`ci.yaml`) — no external dependencies, so a failure here is
  always real and always this PR's to fix:
  - *Check card syntax* / *Check translation module syntax* — a JS
    syntax error was introduced. Reproduce with
    `node --input-type=module --check < <file>` and fix the reported
    line; this is a hard parse error, never a flake.
  - *Check translation key parity across locales* — a key was added to
    `en.js` (or one locale) without mirroring it to every other locale
    file, or `index.js` imports a locale that no longer exports the
    expected shape. Fix by adding/removing the key everywhere
    `scripts/check-translations.mjs` reports, not by loosening the script.

- **Validate** (`validate.yaml`) — runs `hacs/action` against
  `hacs.json` and the repo layout. A failure here usually means:
  - `hacs.json`'s `filename` doesn't match the real file name in `dist/`.
  - The repo is missing something HACS' "plugin" category requires
    (check the action's own log output for the specific requirement —
    it names the failing check).
  - Occasionally a transient network/API error talking to GitHub's API
    from within the action — the one legitimate case to re-run once
    before treating it as a real failure.

Never "fix" a red run by disabling the check, adding `continue-on-error`,
or skipping a locale in `scripts/check-translations.mjs` — those defeat
the point of having the check. If a translation genuinely can't be
provided yet, add the English string as a placeholder for that locale
rather than omitting the key.

There's no bundler and no `npm install` step in either workflow by
design (see `steward/SKILL.md`) — don't add one to "fix" a failure;
the fix is almost always in `dist/`.
