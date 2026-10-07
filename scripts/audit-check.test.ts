// npx tsx scripts/audit-check.test.ts
//
// Η κρίση του ημερήσιου audit, με σταθερά δείγματα αντί για ζωντανό μητρώο.
// Το full-braces.json και το clean.json είναι πραγματικές αναφορές του
// `npm audit --json` στις 07/10/2026 (πλήρης και `--omit=dev`). Τα υπόλοιπα
// είναι παράγωγά τους, με πλασματικά πακέτα «example-*».
import { readFileSync } from 'node:fs';
import { advisoriesOf, schemaProblems, decide, MAX_DAYS } from './lib/audit-allowlist.mjs';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean) { if (cond) { pass++; } else { fail++; console.error(`✗ ${name}`); } }
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; } else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`); }
}
const fx = (f: string) => JSON.parse(readFileSync(new URL(`./fixtures/audit/${f}`, import.meta.url), 'utf8'));
const throws = (fn: () => unknown) => { try { fn(); return false; } catch { return true; } };
const kinds = (r: { problems: { kind: string }[] }) => r.problems.map(p => p.kind).sort();

const full = fx('full-braces.json');
const fullNew = fx('full-new-high.json');
const clean = fx('clean.json');
const prodBraces = fx('prod-braces.json');
const real = JSON.parse(readFileSync(new URL('./audit-allowlist.json', import.meta.url), 'utf8'));

const BRACES = {
  id: 'GHSA-vfj7-8cjw-p6xm', package: 'braces', scope: 'dev',
  reason: 'Μόνο από το eslint-config-next, χωρίς διορθωμένη έκδοση, εκτός διαδρομής εκτέλεσης.',
  owner: '@owner', added: '2026-10-07', expires: '2026-12-31',
};
const list = (...advisories: object[]) => ({ advisories });

// ═══ ΑΝΑΓΝΩΣΗ ΤΗΣ ΑΝΑΦΟΡΑΣ ═════════════════════════════════════════════════
// Πέντε πακέτα φαίνονται high, αλλά αδυναμία είναι ΜΙΑ: τα άλλα τέσσερα την
// κληρονομούν. Αν μετρούσαν ως δικές τους, η εξαίρεση θα ήθελε πέντε εγγραφές.
const adv = advisoriesOf(full);
eq('μία αδυναμία πίσω από πέντε high', adv.map(a => `${a.id} ${a.package} ${a.severity}`), ['GHSA-vfj7-8cjw-p6xm braces high']);
eq('το εύρος της αδυναμίας', adv[0].range, '<=3.0.3');
eq('καθαρή αναφορά: καμία αδυναμία', advisoriesOf(clean), []);
eq('δύο νέες αδυναμίες, όποια κι αν είναι η σοβαρότητα', advisoriesOf(fullNew).map(a => a.package), ['braces', 'example-dev-tool', 'example-moderate']);
ok('σφάλμα μητρώου: πετά, δεν δίνει «καθαρό»', throws(() => advisoriesOf(fx('error.json'))));
ok('άγνωστη μορφή αναφοράς: πετά', throws(() => advisoriesOf({ auditReportVersion: 1, advisories: {} })));
ok('κενό αντικείμενο: πετά', throws(() => advisoriesOf({})));
ok('null: πετά', throws(() => advisoriesOf(null)));

// ═══ Η ΣΗΜΕΡΙΝΗ ΚΑΤΑΣΤΑΣΗ ══════════════════════════════════════════════════
const today = decide({ full, prod: clean, allowlist: list(BRACES), today: '2026-10-07' });
eq('braces με εξαίρεση: κανένα πρόβλημα', today.problems, []);
eq('η εξαίρεση εφαρμόστηκε', today.allowed.map(a => a.id), ['GHSA-vfj7-8cjw-p6xm']);
eq('καμία προειδοποίηση με 85 ημέρες περιθώριο', today.warnings, []);

// ═══ 1. ΝΕΑ HIGH Ή CRITICAL ΧΩΡΙΣ ΑΠΟΦΑΣΗ ══════════════════════════════════
eq('χωρίς εξαίρεση: το braces κοκκινίζει', kinds(decide({ full, prod: clean, allowlist: list(), today: '2026-10-07' })), ['unlisted']);
const nu = decide({ full: fullNew, prod: clean, allowlist: list(BRACES), today: '2026-10-07' });
eq('νέα critical: κοκκινίζει μόνο αυτή', nu.problems.map(p => `${p.kind} ${p.id}`), ['unlisted GHSA-2222-3333-4444']);
ok('η moderate δεν κρίνει', !nu.problems.some(p => p.id === 'GHSA-5555-6666-7777'));
// Ιδιο αναγνωριστικό σε άλλο πακέτο δεν είναι η ίδια απόφαση.
eq('ίδιο GHSA σε άλλο πακέτο: δεν καλύπτει', kinds(decide({ full, prod: clean, allowlist: list({ ...BRACES, package: 'micromatch' }), today: '2026-10-07' })), ['stale', 'unlisted']);

// ═══ 2. ΛΗΞΗ ═══════════════════════════════════════════════════════════════
eq('την ημέρα λήξης ισχύει ακόμη', kinds(decide({ full, prod: clean, allowlist: list(BRACES), today: '2026-12-31' })), []);
eq('την επομένη κοκκινίζει', kinds(decide({ full, prod: clean, allowlist: list(BRACES), today: '2027-01-01' })), ['expired']);
const soon = decide({ full, prod: clean, allowlist: list(BRACES), today: '2026-12-01' });
eq('30 ημέρες πριν: προειδοποίηση χωρίς αποτυχία', [soon.problems.length, soon.warnings.length], [0, 1]);
ok('η προειδοποίηση λέει πόσες ημέρες', /λήγει σε 30 ημέρες/.test(soon.warnings[0] ?? ''));
ok('μία ημέρα πριν: ενικός', /λήγει σε 1 ημέρα,/.test(decide({ full, prod: clean, allowlist: list(BRACES), today: '2026-12-30' }).warnings[0] ?? ''));

// ═══ 3. ΕΞΑΙΡΕΣΗ ΧΩΡΙΣ ΖΩΝΤΑΝΗ ΑΔΥΝΑΜΙΑ ════════════════════════════════════
eq('διορθώθηκε: η εγγραφή πρέπει να φύγει', kinds(decide({ full: clean, prod: clean, allowlist: list(BRACES), today: '2026-10-07' })), ['stale']);
// Αν η σοβαρότητα πέσει κάτω από high, η εξαίρεση δεν χρειάζεται πια.
const downgraded = structuredClone(full);
downgraded.vulnerabilities.braces.via[0].severity = 'moderate';
eq('έπεσε σε moderate: η εγγραφή πρέπει να φύγει', kinds(decide({ full: downgraded, prod: clean, allowlist: list(BRACES), today: '2026-10-07' })), ['stale']);
eq('έληξε ΚΑΙ δεν υπάρχει: και τα δύο', kinds(decide({ full: clean, prod: clean, allowlist: list(BRACES), today: '2027-01-01' })), ['expired', 'stale']);

// ═══ 4. ΠΑΡΑΓΩΓΗ ═══════════════════════════════════════════════════════════
eq('έφτασε στο --omit=dev: κοκκινίζει', kinds(decide({ full, prod: prodBraces, allowlist: list(BRACES), today: '2026-10-07' })), ['production']);
ok('σφάλμα στην αναφορά παραγωγής: πετά', throws(() => decide({ full, prod: fx('error.json'), allowlist: list(BRACES), today: '2026-10-07' })));

// ═══ Η ΛΙΣΤΑ ΩΣ ΕΓΓΡΑΦΟ ════════════════════════════════════════════════════
const bad = (patch: object) => schemaProblems(list({ ...BRACES, ...patch })).length;
eq('πλήρης εγγραφή: κανένα πρόβλημα', schemaProblems(list(BRACES)), []);
eq('χωρίς πίνακα advisories', schemaProblems({}).length, 1);
eq('χωρίς owner', bad({ owner: '' }), 1);
eq('scope παραγωγής', bad({ scope: 'prod' }), 1);
eq('χωρίς scope', bad({ scope: undefined }), 1);
eq('αναγνωριστικό CVE αντί για GHSA', bad({ id: 'CVE-2024-4068' }), 1);
eq('σύντομος λόγος', bad({ reason: 'dev only' }), 1);
eq('ανύπαρκτη ημερομηνία', bad({ expires: '2026-02-30' }), 1);
eq('λήξη πριν την προσθήκη', bad({ expires: '2026-10-01' }), 1);
eq(`λήξη πάνω από ${MAX_DAYS} ημέρες`, bad({ expires: '2027-12-31' }), 1);
eq('διπλή εγγραφή', schemaProblems(list(BRACES, BRACES)).length, 1);
eq('κακογραμμένη λίστα κοκκινίζει και στην απόφαση', kinds(decide({ full, prod: clean, allowlist: list({ ...BRACES, owner: '' }), today: '2026-10-07' })), ['schema']);

// ═══ Η ΛΙΣΤΑ ΤΟΥ ΑΠΟΘΕΤΗΡΙΟΥ ════════════════════════════════════════════════
// Η λήξη δεν ελέγχεται εδώ: θα κοκκίνιζε κάθε PR την 1η Ιανουαρίου για λόγο
// που το PR δεν άγγιξε. Τη λήξη την κρίνει ο ημερήσιος έλεγχος.
eq('το scripts/audit-allowlist.json είναι καλογραμμένο', schemaProblems(real), []);
ok('όλες οι εξαιρέσεις είναι μόνο ανάπτυξης', real.advisories.every((e: { scope: string }) => e.scope === 'dev'));
eq('η εξαίρεση του braces καλύπτει τη σημερινή αναφορά', kinds(decide({ full, prod: clean, allowlist: real, today: '2026-10-07' })), []);

console.log(`\naudit-check: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
