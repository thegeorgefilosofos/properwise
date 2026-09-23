#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΠΛΗΡΩΜΕΝΕΣ ΔΙΑΔΡΟΜΕΣ ΕΛΕΓΧΟΥΝ ΤΟ ΠΑΚΕΤΟ ΣΤΟΝ SERVER, ΟΧΙ ΜΟΝΟ ΣΤΗΝ ΟΘΟΝΗ
// ─────────────────────────────────────────────────────────────────────────
// Ενα endpoint που παράγει πληρωμένο αποτέλεσμα (επενδυτική ανάλυση, εξαγωγή Ε2)
// και εμπιστεύεται μόνο το `hasFeature` της οθόνης είναι ανοιχτή πόρτα: όποιος
// χτυπήσει κατευθείαν τη διεύθυνση παρακάμπτει το λουκέτο. Ο φύλακας απαιτεί
// ΚΑΘΕ τέτοια διαδρομή, όσο υπάρχει στον κώδικα, να καλεί `requireFeature` με τη
// δική της δυνατότητα — τον έλεγχο που διαβάζει το πλάνο από τη βάση.
//
// ΔΕΝ ΕΦΕΥΡΙΣΚΕΙ ΔΙΑΔΡΟΜΗ. Οσο ένα route δεν έχει γραφτεί ακόμη, ο φύλακας το
// προσπερνά· ελέγχει μόνο ό,τι υπάρχει. Ετσι το «χτίζεται σε βήματα» δεν γίνεται
// ψευτο-αποτυχία, αλλά τη στιγμή που η διαδρομή μπει, η πύλη είναι υποχρεωτική.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs';

// Διαδρομή → η δυνατότητα που ΠΡΕΠΕΙ να ελέγχει. Νέα πληρωμένη διαδρομή; μπαίνει εδώ.
const PAID_ROUTES = [
  { file: 'app/api/investment/route.ts', feature: 'investment_analysis' },
  { file: 'app/api/e2/export/route.ts', feature: 'e2_export' },
];

// Ενα σχόλιο που ΑΝΑΦΕΡΕΙ την πύλη δεν είναι η πύλη. Αν ο φύλακας μετρούσε και τα
// σχόλια, μια διαδρομή θα περνούσε γράφοντας «// requireFeature('...')» χωρίς να
// την καλεί ποτέ. Κόβουμε σχόλια γραμμής και μπλοκ πριν ψάξουμε την πραγματική κλήση.
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const problems = [];
let checked = 0;

for (const { file, feature } of PAID_ROUTES) {
  if (!existsSync(file)) continue; // δεν χτίστηκε ακόμη
  checked++;
  const src = stripComments(readFileSync(file, 'utf8'));
  const calls = new RegExp(`requireFeature\\(\\s*['"\`]${feature}['"\`]`).test(src);
  if (!calls) {
    problems.push(`${file}: δεν καλεί requireFeature('${feature}') — η πύλη ζει μόνο στην οθόνη.`);
  }
}

if (problems.length) {
  console.error('✗ Πληρωμένες διαδρομές χωρίς έλεγχο πακέτου στον server:');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}

console.log(
  checked === 0
    ? 'guard-server-entitlements: καμία πληρωμένη διαδρομή στον κώδικα ακόμη.'
    : `guard-server-entitlements: ${checked} πληρωμένες διαδρομές, όλες με requireFeature ✓`,
);
