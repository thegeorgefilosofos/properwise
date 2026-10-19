#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΚΑΝΕΝΑ ΣΕΝΑΡΙΟ ΔΕΝ ΜΑΝΤΕΥΕΙ ΠΟΥ ΕΙΝΑΙ Ο CHROMIUM
// ─────────────────────────────────────────────────────────────────────────
// ΤΙ ΕΓΙΝΕ. Δεκαεπτά σενάρια έγραφαν καρφωτά τη διαδρομή του Chromium μέσα στο
// container της ανάπτυξης. Ο δρομέας του CI δεν την έχει, οπότε το πρώτο βήμα
// περιηγητή έσκαγε — και επειδή το job σταματά στο πρώτο σφάλμα, ΟΛΑ τα
// επόμενα βήματα δεν εκτελέστηκαν ποτέ. Το CI ήταν κόκκινο σε κάθε εκτέλεση
// και τα μισά «blocking» βήματα ήταν διακοσμητικά.
//
// ΔΥΟ ΚΑΝΟΝΕΣ ΚΑΙ ΟΙ ΔΥΟ ΑΠΟ ΤΟ ΙΔΙΟ ΜΑΘΗΜΑ:
//
//   1. Η διαδρομή ρωτιέται (`scripts/lib/chrome.mjs`), δεν γράφεται. Μόνο ο
//      ίδιος ο εντοπιστής επιτρέπεται να ξέρει διαδρομές.
//   2. Η έκδοση που εγκαθιστά το CI δένεται με το playwright-core του
//      package.json. Αν αποκλίνουν, ο δρομέας κατεβάζει build που το
//      playwright-core δεν ψάχνει και είμαστε πάλι στο ίδιο σημείο.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { projectFiles } from './lib/git-files.mjs';

const RESOLVER = 'scripts/lib/chrome.mjs';
const CI = '.github/workflows/ci.yml';
const problems = [];

// ── 1. Καμία καρφωτή διαδρομή περιηγητή έξω από τον εντοπιστή ──
// Ο ίδιος ο εντοπιστής και ο ίδιος ο φύλακας, ΓΡΑΦΟΥΝ διαδρομές: ο πρώτος
// γιατί είναι η δουλειά του, ο δεύτερος γιατί τις ψάχνει.
const SELF = 'scripts/guard-chromium-path.mjs';
const scripts = projectFiles("'scripts/**'")
  .filter(f => /\.(mjs|ts)$/.test(f) && f !== RESOLVER && f !== SELF);
const PATH_RE = /['"`][^'"`\n]*(pw-browsers|chrome-linux|Google Chrome\.app|chromium-\d+)[^'"`\n]*['"`]/;
for (const f of scripts) {
  let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
  const m = PATH_RE.exec(src);
  if (m) problems.push(`${f} γράφει διαδρομή περιηγητή: ${m[0].slice(0, 66)}`);
}

// ── 2. Η έκδοση του CI ταιριάζει με το playwright-core ──
// ΚΑΘΕ εγκατάσταση, όχι μόνο η πρώτη. Το ci.yml εγκαθιστά περιηγητή σε πέντε
// jobs· ο έλεγχος κοίταζε μόνο το πρώτο, οπότε το πέμπτο (webkit) μπορούσε να
// μείνει πίσω και ο φύλακας να βγαίνει πράσινος (δοκιμασμένο 19/10/2026).
// ΚΑΙ ΚΑΘΕ ΜΟΡΦΗ. Η κανονική έκφραση ζητούσε ψηφίο μετά το «@», οπότε ένα
// `playwright install` χωρίς έκδοση ή ένα `playwright@latest install` δεν
// μετρούσαν καν ως εγκατάσταση: ο φύλακας έβγαινε πράσινος «σε 4 jobs» ενώ το
// npx θα έφερνε την τελευταία έκδοση του μητρώου (δοκιμασμένο 19/10/2026).
const INSTALL_RE = /\bplaywright(?:@(\S+))?\s+install\b/;
let want = '';
let pins = 0;
try { want = JSON.parse(readFileSync('node_modules/playwright-core/package.json', 'utf8')).version; }
catch { /* χωρίς εγκατάσταση: ο έλεγχος έκδοσης παραλείπεται */ }
if (want) {
  const lines = readFileSync(CI, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const m = INSTALL_RE.exec(line);
    if (!m) return;
    pins++;
    const pin = m[1];
    if (!pin) problems.push(`${CI}:${i + 1} εγκαθιστά playwright χωρίς έκδοση· το npx φέρνει την τελευταία του μητρώου, όχι την ${want} του playwright-core`);
    else if (pin !== want) problems.push(`${CI}:${i + 1} εγκαθιστά playwright@${pin} ενώ το playwright-core είναι ${want}`);
  });
  if (!pins) problems.push(`το ${CI} δεν εγκαθιστά Chromium· οι σουίτες περιηγητή θα σκάσουν στον δρομέα`);
}

if (problems.length) {
  console.error(`✗ ${problems.length} ${problems.length === 1 ? 'πρόβλημα' : 'προβλήματα'} με τον εντοπισμό του Chromium:\n`);
  for (const p of problems) console.error(`  · ${p}`);
  console.error(`
  Η διαδρομή έρχεται από το ${RESOLVER}:
      import { chromePath } from './lib/chrome.mjs'
      chromium.launch({ executablePath: chromePath(), args: ['--no-sandbox'] })
${want ? `
  Και η έκδοση του CI ακολουθεί το playwright-core, σε όλα τα jobs μαζί:
      sed -i -E 's#playwright(@[^ ]*)? install#playwright@${want} install#' ${CI}
  (και το «from» της μετάλλαξης chromium-path στο scripts/lib/mutations.mjs)
` : ''}`);
  process.exit(1);
}
console.log(`✓ ${scripts.length} σενάρια ρωτούν τον εντοπιστή και το CI εγκαθιστά playwright@${want || '—'}${pins ? ` σε ${pins} jobs` : ''}`);
