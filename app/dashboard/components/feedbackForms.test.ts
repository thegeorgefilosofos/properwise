// npx tsx app/dashboard/components/feedbackForms.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// ΤΟ ΠΡΩΤΟ FEEDBACK ΧΡΗΣΤΗ (23/11/2026): ΦΟΡΜΕΣ ΚΑΙ ΛΙΣΤΕΣ
// ─────────────────────────────────────────────────────────────────────────
// Τρία σημεία όπου η φόρμα έβαζε τον χρήστη να κάνει δουλειά που δεν
// χρειαζόταν:
//   · η ημερομηνία αγοράς του 2015 ήθελε 130 πατήματα «προηγούμενος μήνας»·
//   · η ειδικότητα της νέας επαφής ερχόταν ήδη συμπληρωμένη με «Άλλο», την
//     τελευταία από 60 επιλογές: η λίστα άνοιγε στον πάτο της και ο χρήστης
//     ανέβαινε για να βρει την αρχή·
//   · σε χαμηλό παράθυρο υπολογιστή η σελίδα ολόκληρη κυλούσε κάτω από το
//     κέλυφος και το κάτω μέρος της οθόνης χανόταν.
// ═══════════════════════════════════════════════════════════════════════════
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { DatePickerPanel, dpTitle, dpPrev, dpNext, dpPickYear, dpPickMonth, yearPage, type DpState } from './UIComponents';
import { ROLE_SELECT_OPTIONS, EMPTY_FORM, roleToSave } from './contacts/model';

let passed = 0, failed = 0;
const fails: string[] = [];
const ok = (name: string, cond: boolean) => { if (cond) passed++; else { failed++; fails.push(name); } };
const eq = (name: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) passed++; else { failed++; fails.push(`${name}: got ${g}, want ${w}`); }
};

// ══ B1. Η ΧΡΟΝΙΑ ΑΛΛΑΖΕΙ ΑΠΟ ΤΗΝ ΚΕΦΑΛΙΔΑ ═══════════════════════════════════
console.log('Ημερολόγιο: αλλαγή χρονιάς');
{
  // Σεπτέμβριος 2026 → Μάρτιος 2015. Πριν: 138 πατήματα «προηγούμενος μήνας».
  let s: DpState = { view: 'days', year: 2026, month: 8 };
  let clicks = 0;
  s = dpTitle(s); clicks++;
  eq('το πάτημα στην κεφαλίδα ανοίγει τις χρονιές', s.view, 'years');
  ok('η σελίδα χρονιών δείχνει και παλιές χρονιές', yearPage(s.year).includes(2018));
  s = dpPrev(s); clicks++;
  ok('ένα «προηγούμενο» στις χρονιές πάει δώδεκα χρόνια πίσω', yearPage(s.year).includes(2015));
  s = dpPickYear(s, 2015); clicks++;
  eq('μετά τη χρονιά, οι μήνες της', [s.view, s.year], ['months', 2015]);
  s = dpPickMonth(s, 2); clicks++;
  eq('μετά τον μήνα, οι μέρες του', s, { view: 'days', year: 2015, month: 2 });
  ok('τέσσερα πατήματα αντί για 138', clicks === 4);
  // Τα βέλη των ημερών μένουν όπως ήταν: ένας μήνας τη φορά, με αλλαγή χρονιάς.
  eq('προηγούμενος μήνας από Ιανουάριο', dpPrev({ view: 'days', year: 2026, month: 0 }), { view: 'days', year: 2025, month: 11 });
  eq('επόμενος μήνας από Δεκέμβριο', dpNext({ view: 'days', year: 2026, month: 11 }), { view: 'days', year: 2027, month: 0 });
  eq('στους μήνες τα βέλη αλλάζουν χρονιά', dpNext({ view: 'months', year: 2026, month: 4 }), { view: 'months', year: 2027, month: 4 });
  eq('από τους μήνες, η κεφαλίδα πάει στις χρονιές', dpTitle({ view: 'months', year: 2026, month: 4 }).view, 'years');
  eq('δώδεκα χρονιές ανά σελίδα', yearPage(2026).length, 12);

  const noop = () => {};
  const html = (view: DpState['view']) => renderToStaticMarkup(createElement(DatePickerPanel, {
    value: '2026-09-15', today: '2026-11-23', initialView: view, onPick: noop, onClear: noop, onToday: noop,
  }));
  const days = html('days');
  ok('η κεφαλίδα των ημερών είναι κουμπί που ανοίγει μήνα και χρονιά', /<button[^>]*aria-label="Αλλαγή μήνα και έτους"/.test(days));
  const years = html('years');
  ok('η όψη χρονιών έχει κουμπί για κάθε χρονιά', ['2018', '2026', '2029'].every(y => new RegExp(`<button[^>]*>${y}</button>`).test(years)));
  ok('η επιλεγμένη χρονιά φαίνεται πατημένη', /<button[^>]*aria-pressed="true"[^>]*>2026<\/button>/.test(years));
  const months = html('months');
  ok('η όψη μηνών έχει δώδεκα κουμπιά', (months.match(/class="dp-cell"/g) || []).length === 12);
}

// ══ B3. ΚΑΜΙΑ ΠΡΟΕΠΙΛΟΓΗ ΣΤΗΝ ΕΙΔΙΚΟΤΗΤΑ, ΤΟ «ΑΛΛΟ» ΜΕΝΕΙ ΤΕΛΕΥΤΑΙΟ ═════════
// Ο χρήστης ζήτησε το «Άλλο» πρώτο. Το πρόβλημα όμως ήταν η προεπιλογή: η λίστα
// ανοίγει στην επιλεγμένη τιμή και η επιλεγμένη τιμή ήταν η τελευταία. Χωρίς
// προεπιλογή η λίστα ξεκινά από την κορυφή και όποιος ψάχνει «Υδραυλικός» τον
// βρίσκει χωρίς να περάσει από το «Άλλο». Το «Άλλο» μένει τελευταίο, όπως σε
// κάθε λίστα της εφαρμογής.
console.log('Νέα επαφή: ειδικότητα');
{
  eq('η νέα επαφή δεν έχει προεπιλεγμένη ειδικότητα', EMPTY_FORM.role, '');
  const real = ROLE_SELECT_OPTIONS.filter(o => !o.disabled);
  eq('το «Άλλο» μένει τελευταίο', real[real.length - 1].value, 'other');
  // Όποιος δεν διαλέξει, αποθηκεύεται όπως πριν: «Άλλο».
  eq('χωρίς επιλογή, αποθηκεύεται «Άλλο»', roleToSave('', ''), 'other');
  eq('«Άλλο» με δικό του κείμενο, αποθηκεύεται το κείμενο', roleToSave('other', 'Κηπουρός πισίνας'), 'Κηπουρός πισίνας');
  eq('γνωστή ειδικότητα, αποθηκεύεται όπως είναι', roleToSave('plumber', 'κάτι'), 'plumber');
  const src = readFileSync(new URL('./TabContacts.tsx', import.meta.url), 'utf8');
  ok('η φόρμα αποθηκεύει μέσω του ίδιου κανόνα', /roleToSave\(form\.role, roleOther\)/.test(src));
}

// ══ B5. ΤΟ ΚΕΛΥΦΟΣ ΚΡΑΤΑ ΜΕΣΑ ΤΟΥ Ο,ΤΙ ΚΑΘΕΤΑΙ ΑΠΟΛΥΤΑ ═══════════════════════
// Τα `.sr-only` των βημάτων της Αξιοποίησης είναι `position: absolute`. Χωρίς
// τοποθετημένο πρόγονο, το μπλοκ που τα περιέχει ήταν η ίδια η σελίδα: όσα
// κάθονταν κάτω από το ύψος του παραθύρου τη μάκραιναν (μετρημένο: 737 σε
// παράθυρο 560) και η ρόδα, στο τέλος της κύλισης, κυλούσε όλη τη σελίδα. Η
// μπάρα της κορυφής έφευγε πάνω και το κάτω μέρος έμενε κομμένο. Στα ≤1024
// το κέλυφος ήταν ήδη `relative`· στον υπολογιστή όχι.
console.log('Κέλυφος: χωρίς κύλιση σελίδας');
{
  const css = readFileSync(new URL('../../globals.css', import.meta.url), 'utf8');
  const base = css.match(/\n\.app-shell \{[^}]*\}/);
  ok('το κέλυφος είναι τοποθετημένο σε κάθε πλάτος', !!base && /position:\s*relative/.test(base[0]));
}

// ══ B6. Η ΑΠΟΔΟΣΗ ΚΡΥΒΕΤΑΙ ΣΤΟ ΑΜΦΙΣΒΗΤΟΥΜΕΝΟ ΧΩΡΙΣ ΚΕΝΗ ΟΘΟΝΗ ════════════
// Η ορατότητα ελέγχεται στο lib/property/visibility.test.ts. Εδώ κλειδώνει ο
// δρόμος διαφυγής: όποιος ήταν στην Απόδοση όταν η κατάσταση έγινε
// «Αμφισβητούμενο» βλέπει την Επισκόπηση, όχι κενή οθόνη.
console.log('Απόδοση που κρύβεται: δρόμος διαφυγής');
{
  const page = readFileSync(new URL('../page.tsx', import.meta.url), 'utf8');
  ok('καρτέλα που δεν φαίνεται πια δίνει τη θέση της στην Επισκόπηση', /const navSafe = navVisible\(nav\) \? nav : 'overview'/.test(page));
}

console.log(`feedbackForms.test.ts: ${passed} passed, ${failed} failed`);
for (const f of fails) console.log('  ✗ ' + f);
if (failed) process.exit(1);
