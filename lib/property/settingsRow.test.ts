import { readFileSync } from 'node:fs';
import { settingsRow, hasAnySetting } from './settingsRow';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean) => { if (cond) pass++; else { fail++; console.log('  ✗ ' + name); } };

// Η περίπτωση του λογιστή: όνομα και ΑΦΜ ιδιοκτήτη, κενή λήξη ασφάλισης.
const form = { owner_name: 'Γ. Παραδείγματος', owner_afm: '000000012', insurance_expiry: '', notes: '   ' };
const row = settingsRow(form);
ok('η κενή ημερομηνία γίνεται null, όχι ""', row.insurance_expiry === null);
ok('τα σκέτα κενά γίνονται null', row.notes === null);
ok('το συμπληρωμένο κείμενο μένει', row.owner_name === 'Γ. Παραδείγματος' && row.owner_afm === '000000012');
ok('η συμπληρωμένη ημερομηνία μένει', settingsRow({ insurance_expiry: '2027-03-31' }).insurance_expiry === '2027-03-31');
ok('κόβονται τα κενά στις άκρες', settingsRow({ owner_phone: ' 2101234567 ' }).owner_phone === '2101234567');
ok('καμία τιμή "" σε ολόκληρη τη γραμμή', !Object.values(row).includes('' as never));
ok('κάτι υπάρχει όταν συμπληρώθηκε έστω ένα πεδίο', hasAnySetting(form));
ok('τίποτα όταν όλα είναι κενά', !hasAnySetting({ owner_name: '', notes: '  ', insurance_expiry: '' }));

// Ο οδηγός γράφει ΜΟΝΟ μέσω του settingsRow: ποτέ ξανά τη φόρμα αυτούσια.
const wiz = readFileSync('app/dashboard/components/AddPropertyWizard.tsx', 'utf8');
ok('ο οδηγός δεν στέλνει τη φόρμα αυτούσια στο property_settings', !/upsert\(\{\s*\.\.\.settings[,\s}]/.test(wiz));
ok('ο οδηγός περνά τις επαφές από το settingsRow', /settingsRow\(settings\)/.test(wiz));
// Το κλείσιμο μετά το πρώτο βήμα ανανεώνει τη λίστα: το ακίνητο υπάρχει ήδη.
ok('το κλείσιμο μετά τη δημιουργία καλεί onSaved', /if \(createdId && !isEdit\)[^\n]*onSaved\(createdId\)/.test(wiz));

console.log(fail ? `✗ settingsRow: ${fail} απέτυχαν, ${pass} πέρασαν` : `✓ settingsRow: ${pass} έλεγχοι πέρασαν`);
if (fail) process.exit(1);
