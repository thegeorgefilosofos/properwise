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
