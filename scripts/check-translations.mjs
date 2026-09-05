// Fails if any locale under dist/translations is missing keys that en.js
// has, or carries keys en.js doesn't (usually a leftover from a rename).
// Run with: node scripts/check-translations.mjs

import { TRANSLATIONS as EN } from '../dist/translations/en.js';

const LOCALES = ['de', 'es', 'fr', 'it', 'ja', 'ko', 'nl', 'pt', 'tr', 'zh'];
const enKeys = new Set(Object.keys(EN.en));

let ok = true;

for (const code of LOCALES) {
  const mod = await import(`../dist/translations/${code}.js`);
  const keys = new Set(Object.keys(mod.TRANSLATIONS?.[code] || {}));
  const missing = [...enKeys].filter(k => !keys.has(k));
  const extra = [...keys].filter(k => !enKeys.has(k));

  if (missing.length || extra.length) {
    ok = false;
    console.error(`Locale "${code}" is out of sync with en.js:`);
    if (missing.length) console.error(`  missing keys: ${missing.join(', ')}`);
    if (extra.length) console.error(`  extra keys:   ${extra.join(', ')}`);
  }
}

if (!ok) {
  process.exit(1);
}

console.log(`All ${LOCALES.length} locales match en.js (${enKeys.size} keys).`);
