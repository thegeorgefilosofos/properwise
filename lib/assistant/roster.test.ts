// npx tsx lib/assistant/roster.test.ts
//
// ΚΑΝΕΝΑΣ ΑΡΙΘΜΟΣ ΤΡΙΤΟΥ ΣΤΟ ΠΛΑΙΣΙΟ ΤΗΣ ΝΟΑΣ. Οι ενδείξεις λένε ΑΝ υπάρχει
// τηλέφωνο ή ΑΦΜ, ποτέ ποιο. Η γραμμή ταιριάσματος λέει ΠΟΙΟΣ, ποτέ τον αριθμό.
import { contactFlags, matchesNumber, numberMatchLine, numbersIn } from './roster';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } };

const clients = [
  { name: 'Γιάννης Παπαδόπουλος', phone: '+30 691 234 5678', afm: '123456789' },
  { name: 'Μαρία Κ.', phone: '6977000111', afm: '' },
];
const contacts = [{ name: 'Νίκος υδραυλικός', phone: '210 555 0101' }];

// ── Ενδείξεις χωρίς ψηφία ─────────────────────────────────────────────
const f = contactFlags({ phone: clients[0].phone, afm: clients[0].afm, email: 'g@x.gr' });
ok('ενδείξεις: τηλέφωνο, email, ΑΦΜ', f.join('|') === 'έχει τηλέφωνο|έχει email|έχει ΑΦΜ');
ok('ενδείξεις: κανένα ψηφίο', !/\d/.test(f.join(' ')));
ok('κενά πεδία: καμία ένδειξη', contactFlags({ phone: ' ', afm: '', email: '' }).length === 0);

// ── Αριθμοί μέσα σε ερώτηση ──────────────────────────────────────────
ok('τηλέφωνο με κενά', numbersIn('ποιος είναι ο 69 1234 5678;').includes('6912345678'));
ok('ποσό δεν είναι αριθμός', numbersIn('φόρος για 8.400€ και 1.026€').length === 0);

// ── Κανόνας ταιριάσματος ─────────────────────────────────────────────
ok('ΑΦΜ ακριβώς', matchesNumber('123456789', clients[0]));
ok('τέλος τηλεφώνου', matchesNumber('345678', clients[0]));
ok('με πρόθεμα 0030', matchesNumber('00306977000111', clients[1]));
ok('κάτω από 6 ψηφία όχι', !matchesNumber('45678', clients[0]));
ok('μέρος ΑΦΜ όχι', !matchesNumber('234567', { name: 'x', afm: '123456789' }));

// ── Η γραμμή: όνομα ναι, αριθμός όχι ─────────────────────────────────
const line = numberMatchLine('Ποιος είναι ο 123456789;', clients, contacts);
ok('βρίσκει τον πελάτη από ΑΦΜ', line.includes('Γιάννης Παπαδόπουλος'));
ok('η γραμμή δεν έχει ψηφία', !/\d/.test(line));
ok('βρίσκει επαφή από σταθερό', numberMatchLine('πάρε τον 2105550101', clients, contacts).includes('Νίκος υδραυλικός'));
ok('τίποτα χωρίς αριθμό', numberMatchLine('πόσα έφερε ο Γιάννης;', clients, contacts) === '');
ok('τίποτα για άγνωστο αριθμό', numberMatchLine('ο 6999999999 ποιος είναι;', clients, contacts) === '');

console.log(fail === 0 ? `✓ roster: ${pass} έλεγχοι πέρασαν` : `✗ roster: ${fail} απέτυχαν από ${pass + fail}`);
if (fail > 0) process.exit(1);
