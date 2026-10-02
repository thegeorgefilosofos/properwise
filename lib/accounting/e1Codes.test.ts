// npx tsx lib/accounting/e1Codes.test.ts
//
// ΚΑΘΕ ΓΡΑΜΜΗ ΤΟΥ ΠΙΝΑΚΑ 4Δ2 ΜΕ ΤΟΝ ΚΩΔΙΚΟ ΤΗΣ, ΟΠΩΣ ΕΙΝΑΙ ΤΥΠΩΜΕΝΟΣ ΣΤΟ Ε1.
// Οι αριθμοί εδώ είναι αντιγραμμένοι από το έντυπο (Φ-01.001) και όχι από τον
// κώδικα: ο έλεγχος υπάρχει για να πιάσει απόκλιση του κώδικα από το έντυπο.
import { e1CodeFor, e1PropertyClass, E1_4D2, E1_UNKNOWN_TYPE, E1_OWN_USE_HOME, type E1Use } from './e1Codes';

let pass = 0, fail = 0;
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; } else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`); }
}
const codes = (t: string | null, u: E1Use) => {
  const m = e1CodeFor(t, u);
  return m.ok ? [m.code.code, m.code.spouseCode] : null;
};

// ── 1. Εκμίσθωση: α) κατοικίες, β) καταστήματα κ.λπ., γ) βιομηχανοστάσια, δ) γαίες, ε) επιγραφές
for (const t of ['apartment', 'studio', 'house', 'villa', 'maisonette']) eq(`εκμίσθωση ${t} → 103/104`, codes(t, 'lease'), ['103', '104']);
for (const t of ['office', 'shop', 'warehouse', 'parking', 'storage']) eq(`εκμίσθωση ${t} → 105/106`, codes(t, 'lease'), ['105', '106']);
eq('εκμίσθωση βιομηχανοστασίου → 109/110', codes('Βιομηχανοστάσιο', 'lease'), ['109', '110']);
eq('εκμίσθωση εμπορικού κέντρου → 109/110', codes('Εμπορικό κέντρο', 'lease'), ['109', '110']);
eq('εκμίσθωση γης → 101/102', codes('land', 'lease'), ['101', '102']);
eq('εκμίσθωση χώρου επιγραφών → 107/108', codes('Χώρος επιγραφών', 'lease'), ['107', '108']);

// ── 2. Υπεκμίσθωση και ενοίκιο που καταβλήθηκε ─────────────────────────────
eq('υπεκμίσθωση → 111/112', codes('apartment', 'sublease'), ['111', '112']);
eq('υπεκμίσθωση γραφείου → 111/112', codes('office', 'sublease'), ['111', '112']);
eq('ενοίκιο που καταβλήθηκε → 113/114', codes('apartment', 'sublease_rent_paid'), ['113', '114']);

// ── 3. Δωρεάν παραχώρηση ──────────────────────────────────────────────────
eq('δωρεάν παραχώρηση κατοικίας → 129/130', codes('apartment', 'free'), ['129', '130']);
eq('δωρεάν παραχώρηση καταστήματος → 143/144', codes('shop', 'free'), ['143', '144']);
eq('δωρεάν παραχώρηση γης → 141/142', codes('land', 'free'), ['141', '142']);
eq('δωρεάν παραχώρηση επιγραφών → 147/148', codes('Χώρος επιγραφών', 'free'), ['147', '148']);

// ── 4. Ιδιοχρησιμοποίηση ──────────────────────────────────────────────────
eq('ιδιοχρησιμοποίηση γραφείου → 145/146', codes('office', 'own_use'), ['145', '146']);
eq('ιδιοχρησιμοποίηση θέσης στάθμευσης → 145/146', codes('parking', 'own_use'), ['145', '146']);
eq('ιδιοχρησιμοποίηση επιγραφών → 145/146', codes('Χώρος επιγραφών', 'own_use'), ['145', '146']);
eq('ιδιοχρησιμοποίηση γης → 149/150', codes('land', 'own_use'), ['149', '150']);
const home = e1CodeFor('apartment', 'own_use');
eq('ιδιοχρησιμοποίηση κατοικίας: καμία γραμμή, χωρίς σημαία', home.ok ? 'κωδικός' : [home.reason, home.flagged], [E1_OWN_USE_HOME, false]);

// ── 11. Ανείσπρακτα ───────────────────────────────────────────────────────
eq('ανείσπρακτα → 125/126', codes('apartment', 'unpaid'), ['125', '126']);
eq('ανείσπρακτα καταστήματος → 125/126', codes('shop', 'unpaid'), ['125', '126']);

// ── Η άυλη εμπορική αξία ΔΕΝ είναι 109 ─────────────────────────────────────
eq('το 109 είναι μόνο βιομηχανοστάσια και εμπορικά κέντρα με ΦΠΑ', E1_4D2.lease.industrial?.label.includes('βιομηχανοστασίων'), true);
eq('κανένας κωδικός δεν λέει «άυλη»', Object.values(E1_4D2).flatMap(r => Object.values(r)).some(x => !!x && /άυλη/.test(x.label)), false);

// ── Άγνωστο: ΠΟΤΕ σιωπηλά 103 ──────────────────────────────────────────────
for (const t of [null, '', 'other', 'spaceship']) {
  const m = e1CodeFor(t, 'lease');
  eq(`άγνωστο «${t}» → χωρίς κωδικό, σημασμένο`, m.ok ? m.code.code : [m.reason, m.flagged], [E1_UNKNOWN_TYPE, true]);
}

// ── Ελληνικές ετικέτες παλιών εγγραφών ────────────────────────────────────
eq('«Κατοικία» → κατοικία', e1PropertyClass('Κατοικία'), 'home');
eq('«Αποθήκη πολυκατοικίας» → αποθήκη, όχι κατοικία', e1PropertyClass('Αποθήκη πολυκατοικίας'), 'business');
eq('«Επαγγελματική στέγη» → επαγγελματικός, όχι γη', e1PropertyClass('Επαγγελματική στέγη'), 'business');
eq('«Θέση Στάθμευσης» → στάθμευση', e1PropertyClass('Θέση Στάθμευσης'), 'business');
eq('«Οικόπεδο» → γη', e1PropertyClass('Οικόπεδο'), 'land');
eq('«Γη / Αγρός» → γη', e1PropertyClass('Γη / Αγρός'), 'land');

console.log(fail === 0 ? `✓ e1Codes: ${pass} έλεγχοι πέρασαν` : `✗ e1Codes: ${fail} απέτυχαν από ${pass + fail}`);
if (fail > 0) process.exit(1);
