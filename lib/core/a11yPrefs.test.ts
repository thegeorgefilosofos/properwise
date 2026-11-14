// npx tsx lib/core/a11yPrefs.test.ts
//
// ΟΙ ΡΥΘΜΙΣΕΙΣ ΠΡΟΣΒΑΣΙΜΟΤΗΤΑΣ: ανάγνωση, εγγραφή, τα παλιά κλειδιά και, το
// πιο ύπουλο, ότι το σενάριο πριν το paint γράφει ΤΙΣ ΙΔΙΕΣ ιδιότητες με το
// `applyA11y`. Αν απέκλιναν, ο χρήστης θα έβλεπε ένα μέγεθος στη φόρτωση και
// άλλο μόλις ενυδατωθεί η σελίδα.
import {
  A11Y_DEFAULTS, A11Y_INIT_SCRIPT, A11Y_KEY, APP_ATTR, LEGACY_LARGE, LEGACY_MOTION,
  a11yAttributes, applyA11y, parseA11y, serializeA11y, type A11yPrefs,
} from './a11yPrefs';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n); } };
const same = (a: A11yPrefs, b: A11yPrefs) => JSON.stringify(a) === JSON.stringify(b);

// ── ΑΝΑΓΝΩΣΗ ──────────────────────────────────────────────────────────────
ok('τίποτα αποθηκευμένο: προεπιλογές', same(parseA11y(null), A11Y_DEFAULTS));
ok('προεπιλογές: κανονικό, χωρίς αντίθεση, όπως η συσκευή, χωρίς ανάγνωση',
  A11Y_DEFAULTS.text === 'normal' && !A11Y_DEFAULTS.contrast && A11Y_DEFAULTS.motion === 'system' && !A11Y_DEFAULTS.speakAmounts);
ok('χαλασμένο JSON: προεπιλογές', same(parseA11y('{oops'), A11Y_DEFAULTS));
ok('πίνακας αντί για αντικείμενο: προεπιλογές', same(parseA11y('[1,2]'), A11Y_DEFAULTS));
{
  const p = parseA11y(JSON.stringify({ text: 'xlarge', contrast: true, motion: 'reduce', speakAmounts: true }));
  ok('όλες οι τιμές διαβάζονται', p.text === 'xlarge' && p.contrast && p.motion === 'reduce' && p.speakAmounts);
}
{
  const p = parseA11y(JSON.stringify({ text: 'huge', contrast: 'yes', motion: 'full' }));
  ok('άκυρες τιμές πέφτουν στην προεπιλογή, πεδίο προς πεδίο', p.text === 'normal' && !p.contrast && p.motion === 'system');
}
{
  const p = parseA11y(JSON.stringify({ contrast: true }));
  ok('μερική εγγραφή: τα υπόλοιπα προεπιλογές', p.contrast && p.text === 'normal');
}

// ── ΤΑ ΠΑΛΙΑ ΚΛΕΙΔΙΑ ───────────────────────────────────────────────────────
ok('παλιό «μεγαλύτερο κείμενο» γίνεται «μεγάλο»', parseA11y(null, { large: '1' }).text === 'large');
ok('παλιά «μειωμένη κίνηση» γίνεται «πάντα λιγότερη»', parseA11y(null, { motion: '1' }).motion === 'reduce');
ok('παλιά κλειδιά στο «0»: προεπιλογές', same(parseA11y(null, { large: '0', motion: '0' }), A11Y_DEFAULTS));
ok('η νέα εγγραφή κερδίζει τα παλιά', parseA11y(JSON.stringify({ text: 'normal' }), { large: '1' }).text === 'normal');

// ── ΕΓΓΡΑΦΗ ───────────────────────────────────────────────────────────────
{
  const p: A11yPrefs = { text: 'large', contrast: true, motion: 'reduce', speakAmounts: false };
  ok('πάει και έρχεται χωρίς απώλεια', same(parseA11y(serializeA11y(p)), p));
}

// ── ΙΔΙΟΤΗΤΕΣ ΣΤΟ <html> ──────────────────────────────────────────────────
const fakeEl = () => {
  const attrs = new Map<string, string>();
  return { attrs, setAttribute: (n: string, v: string) => { attrs.set(n, v); }, removeAttribute: (n: string) => { attrs.delete(n); } };
};
{
  const a = a11yAttributes(A11Y_DEFAULTS);
  ok('προεπιλογές: καμία ιδιότητα', a['data-text'] === null && a['data-contrast'] === null && a['data-motion'] === null);
  const el = fakeEl();
  applyA11y(el, { text: 'xlarge', contrast: true, motion: 'reduce', speakAmounts: true });
  ok('γράφονται οι τρεις ιδιότητες', el.attrs.get('data-text') === 'xlarge' && el.attrs.get('data-contrast') === 'high' && el.attrs.get('data-motion') === 'reduce');
  applyA11y(el, A11Y_DEFAULTS);
  ok('η επιστροφή στις προεπιλογές τις ΣΒΗΝΕΙ', el.attrs.size === 0);
}

// ── ΤΟ ΣΕΝΑΡΙΟ ΠΡΙΝ ΤΟ PAINT ΣΥΜΦΩΝΕΙ ΜΕ ΤΟ applyA11y ─────────────────────
const runInit = (store: Record<string, string>, pathname = '/') => {
  const el = fakeEl();
  const localStorage = { getItem: (k: string) => (k in store ? store[k] : null) };
  const document = { documentElement: el };
  new Function('localStorage', 'document', 'location', A11Y_INIT_SCRIPT)(localStorage, document, { pathname });
  el.attrs.delete(APP_ATTR);
  return el.attrs;
};
const appMark = (pathname: string) => {
  const el = fakeEl();
  new Function('localStorage', 'document', 'location', A11Y_INIT_SCRIPT)({ getItem: () => null }, { documentElement: el }, { pathname });
  return el.attrs.get(APP_ATTR) === '1';
};
const cases: A11yPrefs[] = [
  A11Y_DEFAULTS,
  { text: 'large', contrast: false, motion: 'system', speakAmounts: false },
  { text: 'xlarge', contrast: true, motion: 'reduce', speakAmounts: true },
  { text: 'normal', contrast: true, motion: 'system', speakAmounts: false },
];
for (const p of cases) {
  const fromScript = runInit({ [A11Y_KEY]: serializeA11y(p) });
  const el = fakeEl(); applyA11y(el, p);
  ok(`σενάριο = applyA11y για ${serializeA11y(p)}`, JSON.stringify([...fromScript].sort()) === JSON.stringify([...el.attrs].sort()));
}
{
  const a = runInit({ [LEGACY_LARGE]: '1', [LEGACY_MOTION]: '1' });
  ok('το σενάριο διαβάζει και τα παλιά κλειδιά', a.get('data-text') === 'large' && a.get('data-motion') === 'reduce');
  const b = runInit({ [A11Y_KEY]: '{oops' });
  ok('το σενάριο αντέχει χαλασμένη εγγραφή', b.size === 0);
}

// ── ΤΟ ΣΗΜΑΔΙ ΤΟΥ ΠΙΝΑΚΑ ΕΛΕΓΧΟΥ ΑΠΟ ΤΟ ΠΡΩΤΟ PAINT ─────────────────────────
ok('/dashboard: σημάδι', appMark('/dashboard') && appMark('/dashboard/x'));
ok('δημόσια σελίδα: χωρίς σημάδι', !appMark('/') && !appMark('/dashboards') && !appMark('/ypologismos-enfia'));

console.log(`${pass} πέρασαν, ${fail} απέτυχαν`);
if (fail) process.exit(1);
