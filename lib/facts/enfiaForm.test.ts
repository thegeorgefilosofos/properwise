// npx tsx lib/facts/enfiaForm.test.ts
//
// ΤΑ ΚΛΕΙΔΙΑ ΤΩΝ ΠΑΛΙΩΝ ΚΤΙΡΙΩΝ ΛΗΓΟΥΝ ΜΕ ΤΟ ΕΤΟΣ. Η «Παλαιότητα» αποθηκεύεται
// ως κλειδί χωρίς έτος. Κτίριο του 1927 με «pre1930» (0,8) το 2026 έμενε στο
// 0,8 και τον ΕΝΦΙΑ 2028, όταν είναι 101 ετών και ο νόμος δίνει 0,60
// (lib/billing/enfia.ts). Με έτος κατασκευής στην καρτέλα, το κλειδί των δύο
// κανόνων βγαίνει από εκείνο.
import { enfiaFromSettings, effectiveEnfiaAge } from './enfiaForm';
import { enfiaYear, ENFIA_DEFAULTS } from './enfia';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra = '') => {
  if (cond) pass++; else { fail++; console.error(`✗ ${name}${extra ? ` (${extra})` : ''}`); }
};

const FORM = { ...ENFIA_DEFAULTS, enfiaSqm: '80', enfiaZone: '751_1500', enfiaFloor: 'ground' };
const annual = (age: string, year: number, yearBuilt?: number | string | null) =>
  enfiaFromSettings({ ...FORM, enfiaAge: age }, year, null, yearBuilt)?.annual;

// 1927: 99 έτη το 2026 (πριν από το 1930), 101 το 2028 (άνω των 100).
ok('1927 στον ΕΝΦΙΑ 2026: το «pre1930» μένει', effectiveEnfiaAge('pre1930', 1927, 2026) === 'pre1930');
ok('1927 στον ΕΝΦΙΑ 2028: «over100», όχι το αποθηκευμένο «pre1930»', effectiveEnfiaAge('pre1930', 1927, 2028) === 'over100');
ok('ΕΝΦΙΑ 2026: ίδιο ποσό με ρητό «pre1930»', annual('pre1930', 2026, 1927) === annual('pre1930', 2026));
ok('ΕΝΦΙΑ 2028: ίδιο ποσό με ρητό «over100»', annual('pre1930', 2028, 1927) === annual('over100', 2028),
  `${annual('pre1930', 2028, 1927)} ≠ ${annual('over100', 2028)}`);
ok('ΕΝΦΙΑ 2028: μικρότερο από το 0,8', (annual('pre1930', 2028, 1927) ?? 0) < (annual('pre1930', 2028) ?? 0));

// Και ανάποδα: «over100» αποθηκευμένο για κτίριο που δεν είναι άνω των 100.
ok('«over100» για κτίριο του 1985: ο πίνακας', effectiveEnfiaAge('over100', 1985, 2026) === 'y26_plus');

// Τα κλειδιά του πίνακα είναι επιλογή του ιδιοκτήτη και δεν αγγίζονται.
ok('«y26_plus» μένει, ακόμη κι αν το έτος λέει άλλο', effectiveEnfiaAge('y26_plus', 1920, 2026) === 'y26_plus');
ok('κενό («Δεν γνωρίζω») μένει κενό', effectiveEnfiaAge('', 1927, 2028) === '');
ok('παλιό κλειδί «over_30» μένει όπως είναι', effectiveEnfiaAge('over_30', 1927, 2028) === 'over_30');

// Χωρίς έτος, ή με απίθανο έτος, μένει το αποθηκευμένο: κανένα μάντεμα.
ok('χωρίς έτος κατασκευής: το αποθηκευμένο', effectiveEnfiaAge('pre1930', null, 2028) === 'pre1930');
ok('έτος «1200»: το αποθηκευμένο', effectiveEnfiaAge('pre1930', 1200, 2028) === 'pre1930');
ok('έτος ως κείμενο «1927»', effectiveEnfiaAge('pre1930', '1927', 2028) === 'over100');
ok('μη κείμενο στη ρύθμιση: κενό', effectiveEnfiaAge(42, 1927, 2028) === '');

// Η Λογιστική και ο επιλογέας του πίνακα βλέπουν το ίδιο κλειδί.
{
  const s = { ...FORM, enfiaAge: 'pre1930' };
  const y28 = enfiaYear(s, 2028, { yearBuilt: 1927 });
  ok('Λογιστική 2028: ο επιλογέας δείχνει «over100»', y28.ageKey === 'over100');
  ok('Λογιστική 2028: η εκτίμηση της φόρμας με 0,60', y28.estimate === annual('over100', 2028));
  ok('Λογιστική 2026: ο επιλογέας δείχνει «pre1930»', enfiaYear(s, 2026, { yearBuilt: 1927 }).ageKey === 'pre1930');
}

console.log(fail ? `✗ enfiaForm: ${fail} απέτυχαν από ${pass + fail}` : `✓ enfiaForm: ${pass} έλεγχοι πέρασαν`);
if (fail) process.exit(1);
