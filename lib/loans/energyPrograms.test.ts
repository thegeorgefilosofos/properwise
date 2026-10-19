// ═══════════════════════════════════════════════════════════════════════════
// ΚΛΕΙΣΤΟ ΠΡΟΓΡΑΜΜΑ ΔΕΝ ΠΡΟΤΕΙΝΕΤΑΙ ΠΟΥΘΕΝΑ ΩΣ ΔΙΑΘΕΣΙΜΟ
// ─────────────────────────────────────────────────────────────────────────
// Στις 29/09/2026 η σημείωση της ενεργειακής αναβάθμισης έγραφε «Επιλέξιμο για
// Εξοικονομώ 2025 (προθεσμία 30/06/2026) και Αναβαθμίζω (31/08/2026)» και ο
// βοηθός «Εξοικονομώ 2025 (ολοκλήρωση 31/5/2026)», ενώ ο κατάλογος τα είχε
// κλειστά. Οι ημερομηνίες ζουν πλέον στο lib/loans/energyPrograms.
// ═══════════════════════════════════════════════════════════════════════════
import { openEnergyPrograms, energyProgramStates, joinGreek } from './energyPrograms';
import { PROGRAMS_NORM, energyProgramsNote } from '@/app/dashboard/components/TabLoanData';
import { KNOWLEDGE_PACKS } from '@/app/dashboard/components/assistantPersona';

let pass = 0; const fail: string[] = [];
const eq = (what: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; return; }
  fail.push(`${what}\n    περίμενα: ${JSON.stringify(want)}\n    πήρα:     ${JSON.stringify(got)}`);
};

eq('τον Μάιο του 2026 δέχονταν και τα δύο', openEnergyPrograms('2026-05-15'), ['Εξοικονομώ 2025', 'Αναβαθμίζω το Σπίτι μου']);
eq('τον Ιούνιο μόνο το Εξοικονομώ 2025', openEnergyPrograms('2026-06-15'), ['Εξοικονομώ 2025']);
eq('στις 29/09/2026 κανένα', openEnergyPrograms('2026-09-29'), []);
eq('άκυρη μέρα δεν ξανανοίγει τίποτα', openEnergyPrograms('χθες'), []);
eq('το Εξοικονομώ 2026 είναι επερχόμενο',
  energyProgramStates('2026-09-29').find(p => p.id === 'exoikonomo_2026')?.state, 'upcoming');

// ── Η ΠΑΡΑΤΑΣΗ ΟΛΟΚΛΗΡΩΣΗΣ ΔΕΝ ΞΑΝΑΝΟΙΓΕΙ ΤΙΣ ΑΙΤΗΣΕΙΣ ─────────────────────
// Το σχόλιο του EXOIKONOMO_2025 έλεγε να γραφτεί η παράταση στο `deadline`.
// Οι παρατάσεις του 2026 αφορούν την ολοκλήρωση έργων ήδη ενταγμένων· με το
// `deadline` στις 30/11/2026, όπως ζητούσε το σχόλιο, κατάλογος και Νόα θα
// έλεγαν «δέχεται αιτήσεις» ως το τέλος Νοεμβρίου.
for (const day of ['2026-10-18', '2026-11-15', '2026-11-30']) {
  eq(`Εξοικονομώ 2025 δεν δέχεται αιτήσεις στις ${day}`,
    energyProgramStates(day).find(p => p.id === 'exoikonomo_2025')?.acceptsApplications, false);
}
{
  const pack = KNOWLEDGE_PACKS.loans;
  eq('η Νόα δεν λέει ότι το Εξοικονομώ 2025 δέχεται αιτήσεις', /«Εξοικονομώ 2025» δέχεται αιτήσεις/.test(pack), false);
}

// ── ΤΟ ΕΞΟΙΚΟΝΟΜΩ 2026: ΚΑΝΕΝΑ ΨΗΦΙΟ ΧΩΡΙΣ ΕΠΙΣΗΜΟ ΟΔΗΓΟ ────────────────────
// Η κάρτα έγραφε «1,2 δισ. €, επιδότηση έως 80%, 62.000 κατοικίες», «2ο
// εξάμηνο 2026» και «Χωρίς εισοδηματικό κριτήριο», με πηγή εμπορικό ιστότοπο.
// Επίσημος οδηγός δεν έχει δημοσιευτεί (18/10/2026).
{
  const ex26 = PROGRAMS_NORM.find(p => p.id === 'exoikonomo_2026')!;
  const text = [ex26.type, ex26.desc, ex26.howItWorks, ex26.extra, ex26.savingsExample, ex26.deadline,
    ex26.totalBudget, ex26.duration, ...ex26.criteria].join(' ');
  eq('η κάρτα του Εξοικονομώ 2026 δεν έχει ψηφία', /\d/.test(text), false);
  eq('...ούτε εμπορική πηγή', /selectra/.test(ex26.url), false);
  eq('η Νόα δεν δίνει ποσοστό για το Εξοικονομώ 2026', /Εξοικονομώ 2026[^.]*\d+\s*%/.test(Object.values(KNOWLEDGE_PACKS).join('\n')), false);
}

eq('η σημείωση δεν ονομάζει κλειστό πρόγραμμα', /Εξοικονομώ|Αναβαθμίζω/.test(energyProgramsNote('2026-09-29')), false);
eq('όσο ήταν ανοιχτά τα ονόμαζε', energyProgramsNote('2026-05-15'), 'Επιλέξιμο για Εξοικονομώ 2025 και Αναβαθμίζω το Σπίτι μου');

// Ο κατάλογος διαβάζει τις ίδιες ημερομηνίες: δεν υπάρχει δεύτερη εκδοχή.
const anav = PROGRAMS_NORM.find(p => p.id === 'anavathmizo')!;
eq('ο κατάλογος έχει την προθεσμία αίτησης του Αναβαθμίζω', anav.applicationDeadline, '31/05/2026');
eq('και την προθεσμία υπογραφής', anav.deadline, '31/08/2026');

// Ο βοηθός δεν έχει πια δική του ημερομηνία για το Εξοικονομώ 2025.
const prompt = Object.values(KNOWLEDGE_PACKS).join('\n');
eq('ο βοηθός δεν γράφει «ολοκλήρωση 31/5/2026»', /31\/5\/2026/.test(prompt), false);
eq('ούτε αφήνει σκέτο ${…} στο κείμενο', /\$\{/.test(prompt), false);

eq('ένα όνομα', joinGreek(['Α']), 'Α');
eq('τρία ονόματα, χωρίς κόμμα πριν από το «και»', joinGreek(['Α', 'Β', 'Γ']), 'Α, Β και Γ');

if (fail.length) { console.error(`\n✗ energyPrograms: ${fail.length} αποτυχίες\n`); for (const f of fail) console.error('  ' + f); process.exit(1); }
console.log(`✓ energyPrograms: ${pass} έλεγχοι πέρασαν`);
