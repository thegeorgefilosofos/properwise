// npx tsx app/odigos/airbnb-takk-2026/examples.test.ts
//
// ΤΑ ΠΑΡΑΔΕΙΓΜΑΤΑ ΤΟΥ ΟΔΗΓΟΥ AIRBNB, ΚΑΡΦΩΜΕΝΑ ΣΤΟ ΕΓΚΕΚΡΙΜΕΝΟ ΚΕΙΜΕΝΟ
// (05.10.2026). Η σελίδα τα υπολογίζει από τη μηχανή· αν αλλάξει ποσό ή
// κλίμακα, ο έλεγχος κοκκινίζει και το κείμενο ξαναδιαβάζεται πριν βγει.
import { readFileSync } from 'node:fs';
import {
  APARTMENT, LARGE_HOUSE, SPLIT_APARTMENT, SPLIT_LARGE_HOUSE, YEAR_NIGHTS, yearLevy, INCOME_EXAMPLE, EXAMPLE_SQM,
} from './examples';
import { isHighSeasonMonth, rentalBracketsForYear } from '@/lib/billing/greekTax';

let passed = 0, failed = 0;
const fails: string[] = [];
const ok = (name: string, cond: boolean) => { if (cond) passed++; else { failed++; fails.push(name); } };

// ── Τα δύο ακίνητα ─────────────────────────────────────────────────────────
ok(`διαμέρισμα ${EXAMPLE_SQM} τ.μ.: 8 / 2`, APARTMENT.high === 8 && APARTMENT.low === 2);
ok(`μονοκατοικία ${EXAMPLE_SQM} τ.μ.: 15 / 4`, LARGE_HOUSE.high === 15 && LARGE_HOUSE.low === 4);

// ── Οι περίοδοι που λέει το κείμενο ────────────────────────────────────────
ok('Απρίλιος έως Οκτώβριος: υψηλή', [3, 4, 5, 6, 7, 8, 9].every(isHighSeasonMonth));
ok('Νοέμβριος έως Μάρτιος: χαμηλή', [10, 11, 0, 1, 2].every(m => !isHighSeasonMonth(m)));

// ── Κράτηση 28/10 – 05/11 ──────────────────────────────────────────────────
{
  const [oct, nov] = SPLIT_APARTMENT.months;
  ok('δύο ειδικά στοιχεία', SPLIT_APARTMENT.months.length === 2 && SPLIT_LARGE_HOUSE.months.length === 2);
  ok('4 + 4 νύχτες, σύνολο 8', oct.nights === 4 && nov.nights === 4);
  ok('Οκτώβριος 28–31, Νοέμβριος 1–4', oct.firstNight === 28 && oct.lastNight === 31 && nov.firstNight === 1 && nov.lastNight === 4);
  ok('διαμέρισμα 32 + 8 = 40', oct.levy === 32 && nov.levy === 8 && SPLIT_APARTMENT.total === 40);
  const [octH, novH] = SPLIT_LARGE_HOUSE.months;
  ok('μονοκατοικία 60 + 16 = 76', octH.levy === 60 && novH.levy === 16 && SPLIT_LARGE_HOUSE.total === 76);
  ok('δηλώσεις έως 30/11 και 31/12', oct.deadline === '2026-11-30' && nov.deadline === '2026-12-31');
}

// ── Μια χρονιά ─────────────────────────────────────────────────────────────
ok('90 υψηλής, 30 χαμηλής', YEAR_NIGHTS.high === 90 && YEAR_NIGHTS.low === 30);
{
  const a = yearLevy(APARTMENT);
  ok('διαμέρισμα 720 + 60 = 780', a.high === 720 && a.low === 60 && a.total === 780);
  ok('μονοκατοικία 1.470', yearLevy(LARGE_HOUSE).total === 1470);
}

// ── Φόρος εισοδήματος ──────────────────────────────────────────────────────
ok('έτος 2026', INCOME_EXAMPLE.year === 2026);
ok('12.000 ακαθάριστο', INCOME_EXAMPLE.gross === 12000);
ok('φορολογητέο 11.400', Math.abs(INCOME_EXAMPLE.taxable - 11400) < 1e-9);
ok('συντελεστής 15%', INCOME_EXAMPLE.rate === 0.15);
ok('φόρος 1.710', Math.abs(INCOME_EXAMPLE.tax - 1710) < 1e-9);
// Το κείμενο γράφει «11.400 × 15%»: αληθεύει μόνο όσο όλο το φορολογητέο
// μένει στο πρώτο κλιμάκιο.
ok('όλο το φορολογητέο στο πρώτο κλιμάκιο', INCOME_EXAMPLE.taxable <= rentalBracketsForYear(INCOME_EXAMPLE.year)[0].to);
ok('κλίμακα 2026: 12.000 / 24.000 / 36.000 με 15 / 25 / 35 / 45%',
  rentalBracketsForYear(2026).map(b => `${b.from}:${b.rate}`).join() === '0:0.15,12000:0.25,24000:0.35,36000:0.45');

// ── Η σελίδα ───────────────────────────────────────────────────────────────
// Ο οδηγός ΑΜΑ έχει ανοιχτό P0: η σελίδα τον εξαιρεί από τους «Σχετικούς
// οδηγούς» και δεν τον δείχνει πουθενά αλλού (ούτε `href` ούτε `link`).
{
  const page = readFileSync('app/odigos/airbnb-takk-2026/page.tsx', 'utf8');
  const AMA = '/odigos/vraxyxronia-ama-prodiagrafes-2026';
  ok('η σελίδα περνά το exclude στους «Σχετικούς οδηγούς»', /<RelatedGuides current=\{GUIDE\} exclude=\{RELATED_EXCLUDE\} \/>/.test(page));
  ok('το RELATED_EXCLUDE κρατά τον οδηγό ΑΜΑ', page.includes(`const RELATED_EXCLUDE = [guideAt('${AMA}').href];`));
  ok('η διαδρομή του ΑΜΑ εμφανίζεται μόνο στην εξαίρεση', page.split(AMA).length - 1 === 1);
  ok('η σύγκριση δείχνει στο εργαλείο', page.includes('href="/vraxyxronia-i-makroxronia"'));
}

// ── report ───────────────────────────────────────────────────────────────────
console.log(`\nairbnb-takk-2026/examples.ts — ${passed} passed, ${failed} failed (σύνολο ${passed + failed})`);
if (failed) { console.log('FAILED:\n' + fails.map(f => '  ✗ ' + f).join('\n')); process.exit(1); }
console.log('όλα πέρασαν');
