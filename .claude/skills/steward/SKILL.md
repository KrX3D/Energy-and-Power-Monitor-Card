---
name: steward
description: Repo-specific conventions for a Claude session driving this PR to green or reviewing it.
---

# Steward guide — Energy and Power Monitor Card

This repo is a Home Assistant HACS Lovelace card. There is no build step,
no package.json, and no bundler: the file the browser loads,
`dist/Energy-and-Power-Monitor-Card.js`, is committed directly and *is*
the source. Editing a `src/` file and forgetting to rebuild is not a
failure mode here because there is no separate source to go stale — but
it also means there's no compiler to catch syntax mistakes before they
ship, so be extra careful editing that file by hand.

## Shape of the repo

- `dist/Energy-and-Power-Monitor-Card.js` — the whole card: shared config
  logic (`EnergyMonitorLogic`), the `energy-power-monitor-card` LitElement,
  and its `energy-power-monitor-card-editor` companion. All in one file
  on purpose (see the file's header comment) — don't split it into
  modules as a "cleanup."
- `dist/translations/<lang>.js` — one file per locale, each exporting
  `TRANSLATIONS.<lang>` with the same set of keys as `en.js`.
  `dist/translations/index.js` merges them and `localize()` falls back
  language → short code → `en` → the raw key.
- `hacs.json` — HACS plugin metadata. `filename` must match the actual
  card file name exactly, or HACS installs break for users.
- No `package.json`. Don't add one, and don't introduce `npm install`
  steps to CI — that changes what ships to users and isn't needed for a
  drop-in ES module loaded via `<script type="module">`/unpkg import.

## Validating a change before pushing

There's no test suite. What actually catches mistakes:

```sh
node --input-type=module --check < dist/Energy-and-Power-Monitor-Card.js
for f in dist/translations/*.js; do node --input-type=module --check < "$f"; done
node scripts/check-translations.mjs   # every locale has the same keys as en.js
```

Run these locally before pushing — they're also what `CI` (`.github/workflows/ci.yaml`)
runs on every push and PR. `Validate` (`.github/workflows/validate.yaml`) additionally
runs `hacs/action` to check HACS repo/manifest requirements.

## Translations

Any new user-facing string goes into `dist/translations/en.js` **and**
every other locale file (`de, es, fr, it, ja, ko, nl, pt, tr, zh`) with
the same key — even if you just copy the English string as a placeholder
for a locale you can't translate. `scripts/check-translations.mjs` will
fail CI otherwise. Don't delete a key from one locale without removing it
everywhere, and don't leave `index.js`'s import list out of sync with the
files under `dist/translations/`.

## Config schema

New config options belong in `EnergyMonitorLogic._initConfig()` (the one
place that applies defaults) — don't scatter `config.foo || default`
fallbacks across the card and editor. If it's user-facing in the visual
editor, it also needs a label in `_computeLabel()` (and usually a
translation key) and a row in the editor's `render()`.

## Merging

This repo's `Release` workflow tags and publishes a GitHub release
automatically on every PR merge to `main` (bumps the patch version). That
means merging to `main` is a real, user-visible release — don't merge a
PR here you wouldn't want installed by every HACS user immediately.
