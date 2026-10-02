// npx tsx lib/property/coOwners.test.ts
import { readCoOwners, writeCoOwners, mergeCoOwnerNames, hasCoOwnerDetails, splitRowsFromRecord, recordFromSplitRows, withSelfRow, mergeScannedRows } from './coOwners';

let pass = 0, fail = 0;
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; } else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`); }
}

// ── Η παλιά μορφή (σκέτα ονόματα) και η νέα διαβάζονται το ίδιο ────────────
eq('σκέτα ονόματα', readCoOwners(['Μαρία', ' ', 'Γιώργος']), [
  { name: 'Μαρία', afm: null, pct: null, address: null },
  { name: 'Γιώργος', afm: null, pct: null, address: null },
]);
eq('αντικείμενα', readCoOwners([{ name: 'Μαρία', afm: '123 456 789', pct: '50', address: 'Ερμού 1' }]), [
  { name: 'Μαρία', afm: '123456789', pct: 50, address: 'Ερμού 1' },
]);
eq('ποσοστό εκτός ορίων → null', readCoOwners([{ name: 'Α', pct: 140 }])[0].pct, null);
eq('χωρίς όνομα δεν υπάρχει', readCoOwners([{ afm: '123456789' }]), []);
eq('όχι πίνακας → κενό', readCoOwners({ name: 'x' }), []);
eq('null → κενό', readCoOwners(null), []);

// ── Γράψιμο: τα κενά πεδία δεν γίνονται κλειδιά ──────────────────────────
eq('γράψιμο', writeCoOwners([
  { name: ' Μαρία ', afm: null, pct: 50, address: '' },
  { name: '', afm: '123456789', pct: null, address: null },
]), [{ name: 'Μαρία', pct: 50 }]);

// ── Ο οδηγός αλλάζει ονόματα, η βάση κρατά ΑΦΜ και ποσοστά ─────────────────
const known = readCoOwners([{ name: 'Μαρία', afm: '111111111', pct: 30 }, { name: 'Γιώργος', afm: '222222222', pct: 20 }]);
eq('ίδια ονόματα, ίδια στοιχεία', mergeCoOwnerNames(known, ['Μαρία', 'Γιώργος']), known);
eq('αλλαγή σειράς: ζευγάρι με όνομα', mergeCoOwnerNames(known, ['Γιώργος', 'Μαρία']).map(c => c.afm), ['222222222', '111111111']);
eq('διόρθωση ορθογραφίας: ζευγάρι με θέση', mergeCoOwnerNames(known, ['Μαρια', 'Γιώργος'])[0], { name: 'Μαρια', afm: '111111111', pct: 30, address: null });
eq('νέο όνομα: χωρίς στοιχεία', mergeCoOwnerNames(known, ['Μαρία', 'Γιώργος', 'Ελένη'])[2], { name: 'Ελένη', afm: null, pct: null, address: null });
eq('στοιχεία πέρα από ονόματα', [hasCoOwnerDetails(known), hasCoOwnerDetails(readCoOwners(['Μαρία']))], [true, false]);

// ── Κατανομή: ο υπόχρεος πρώτος, οι άλλοι από τη στήλη ─────────────────────
const owner = { name: 'Ελένη Παπά', afm: '123456789', ownership: 50 };
eq('χωρίς συνιδιοκτήτες η βάση δεν απαντά', splitRowsFromRecord(owner, []), null);
const rows = splitRowsFromRecord(owner, [{ name: 'Νίκος Παπάς', afm: '987654321', pct: 50, address: 'Πατησίων 5' }])!;
eq('γραμμές από τη βάση', rows, [
  { name: 'Ελένη Παπά', afm: '123456789', pct: '50', address: '', self: true },
  { name: 'Νίκος Παπάς', afm: '987654321', pct: '50', address: 'Πατησίων 5' },
]);
eq('ο υπόχρεος δεν γράφεται ως συνιδιοκτήτης', recordFromSplitRows(rows, owner), {
  coOwners: [{ name: 'Νίκος Παπάς', afm: '987654321', pct: 50, address: 'Πατησίων 5' }], ownership: 50,
});
eq('παλιά διάταξη: ο υπόχρεος βρίσκεται από το ΑΦΜ', recordFromSplitRows([
  { name: 'Νίκος', afm: '987654321', pct: '40', address: '' },
  { name: 'Ελένη', afm: '123456789', pct: '60', address: '' },
], owner).ownership, 60);
eq('χωρίς γραμμή υπόχρεου το ποσοστό δεν αγγίζεται', recordFromSplitRows([{ name: 'Άλλος', afm: '', pct: '30', address: '' }], owner).ownership, null);

// ── Άλλος άνθρωπος στην ίδια θέση δεν κληρονομεί ΑΦΜ και ποσοστό ──────────
eq('άλλο όνομα στη θέση: χωρίς στοιχεία', mergeCoOwnerNames([{ name: 'Μαρία Κ.', afm: '111111111', pct: 50, address: null }], ['Νίκος Λ.'])[0],
  { name: 'Νίκος Λ.', afm: null, pct: null, address: null });

// ── Πάντα μία γραμμή υπόχρεου ─────────────────────────────────────────────
const nobody = { name: null, afm: null, ownership: 100 };
eq('κενή φόρμα: γίνεται ο υπόχρεος', withSelfRow([{ name: '', afm: '', pct: '', address: '' }], nobody),
  [{ name: 'Ιδιοκτήτης', afm: '', pct: '100', address: '', self: true }]);
const legacy = withSelfRow([{ name: 'Γιώργος Παπάς', afm: '', pct: '50', address: '' }, { name: 'Μαρία Παπά', afm: '', pct: '50', address: '' }], nobody);
eq('παλιά διάταξη: η πρώτη γραμμή είναι ο υπόχρεος', legacy.map(r => !!r.self), [true, false]);
eq('και η αποθήκευση γράφει μόνο τη Μαρία, με ποσοστό υπόχρεου 50', recordFromSplitRows(legacy, nobody), {
  coOwners: [{ name: 'Μαρία Παπά', afm: null, pct: 50, address: null }], ownership: 50,
});
eq('με ΑΦΜ βρίσκεται ο σωστός', withSelfRow([{ name: 'Νίκος', afm: '987654321', pct: '40', address: '' }, { name: 'Ελένη', afm: '123456789', pct: '60', address: '' }], owner).map(r => !!r.self), [false, true]);

// ── Η σάρωση δεν σβήνει τον υπόχρεο ───────────────────────────────────────
const cur = [{ name: 'Ελένη Παπά', afm: '123456789', pct: '100', address: '', self: true }];
eq('σάρωση με τον υπόχρεο μέσα: παίρνει το ποσοστό του', mergeScannedRows(cur, [
  { name: 'ΠΑΠΑ ΕΛΕΝΗ', afm: '123456789', pct: '60', address: '' },
  { name: 'ΠΑΠΑΣ ΝΙΚΟΣ', afm: '987654321', pct: '40', address: '' },
], owner), [
  { name: 'Ελένη Παπά', afm: '123456789', pct: '60', address: '', self: true },
  { name: 'ΠΑΠΑΣ ΝΙΚΟΣ', afm: '987654321', pct: '40', address: '' },
]);
eq('σάρωση χωρίς τον υπόχρεο: μένει πρώτος, οι άλλοι από κάτω', mergeScannedRows(cur, [{ name: 'Τρίτος', afm: '', pct: '30', address: '' }], owner).map(r => r.name), ['Ελένη Παπά', 'Τρίτος']);

console.log(fail === 0 ? `✓ coOwners: ${pass} έλεγχοι πέρασαν` : `✗ coOwners: ${fail} απέτυχαν από ${pass + fail}`);
if (fail > 0) process.exit(1);
