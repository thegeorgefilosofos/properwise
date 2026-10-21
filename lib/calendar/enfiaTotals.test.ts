// npx tsx lib/calendar/enfiaTotals.test.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// ΠΟΣΕΣ ΔΟΣΕΙΣ ΕΝΦΙΑ: Η ΜΗΧΑΝΗ, Ο ΦΟΡΟΛΟΓΟΥΜΕΝΟΣ ΚΑΙ ΟΙ ΠΕΡΙΤΤΕΣ
// ─────────────────────────────────────────────────────────────────────────
// Ρωτά: βγάζει η μηχανή όσες δόσεις ζητά ο κανόνας των 10€ όταν ξέρει το
// σύνολο και δώδεκα με σημείωση όταν δεν το ξέρει; ενώνει τα ακίνητα μόνο
// του ΙΔΙΟΥ φορολογούμενου; κρατά πάντα το μεγαλύτερο σύνολο; ξέρει ποια
// γραμμή περισσεύει;
// ═══════════════════════════════════════════════════════════════════════════
import { greekPropertyTaxObligations, lastWorkingDayOfMonth, ENFIA_FEWER_HINT } from '@/lib/tax/greekTaxCalendar';
import { enfiaInstalmentCount } from '@/lib/tools/enfiaSchedule';
import { enfiaCountsByProperty, enfiaTotalOfSettings } from './enfiaTotals';
import { enfiaYearOf, planDocSave, ENFIA_TITLE } from '@/lib/billing/documents';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra?: unknown) => {
  if (cond) pass++;
  else { fail++; console.error(`✗ ${name}`, extra ?? ''); }
};

const enfia = (year: number, count?: number) => greekPropertyTaxObligations(year, 'owner', count ? { enfiaInstalments: { [year]: count } } : {})
  .filter(o => o.kind === 'enfia-first' || o.kind === 'enfia-instalment' || o.kind === 'enfia-last');

// ── Η ΜΗΧΑΝΗ ───────────────────────────────────────────────────────────────
ok('μηχανή: 27,44€ → δύο δόσεις', enfia(2026, enfiaInstalmentCount(27.44)).length === 2);
ok('μηχανή: 67,20€ → έξι δόσεις', enfia(2026, enfiaInstalmentCount(67.2)).length === 6);
ok('μηχανή: άγνωστο → δώδεκα', enfia(2026).length === 12);
ok('μηχανή: άγνωστο → η σημείωση σε κάθε δόση', enfia(2026).every(o => o.notes.includes(ENFIA_FEWER_HINT)));
ok('μηχανή: γνωστό δώδεκα → δώδεκα, χωρίς σημείωση', enfia(2026, 12).length === 12 && enfia(2026, 12).every(o => !o.notes.includes(ENFIA_FEWER_HINT)));
ok('μηχανή: ποτέ πάνω από δώδεκα', enfia(2026, 40).length === 12);
ok('μηχανή: άκυρο πλήθος → άγνωστο', enfia(2026, 0).length === 12 && greekPropertyTaxObligations(2026, 'owner', { enfiaInstalments: { 2026: 2.5 } })
  .filter(o => o.kind.startsWith('enfia-') && o.kind !== 'enfia-issue').length === 12);
{
  const two = enfia(2026, 2);
  ok('μηχανή: οι δύο είναι η 1η και η 2η, με τα ίδια κλειδιά', two.map(o => o.id).join() === 'enfia-first-2026,enfia-instalment-2026-2');
  ok('μηχανή: η τελευταία το λέει', two[1].title === 'ΕΝΦΙΑ, 2η και τελευταία δόση', two[1]);
  ok('μηχανή: η 2η στο τέλος του επόμενου μήνα', two[1].date === lastWorkingDayOfMonth(2026, 3), two[1].date);
  ok('μηχανή: η 1η μένει στην ημερομηνία του νόμου', two[0].date === lastWorkingDayOfMonth(2026, 2) && two[0].confidence === 'statutory');
  const one = enfia(2026, 1);
  ok('μηχανή: μία δόση → μία γραμμή, με τον τίτλο της', one.length === 1 && one[0].title === 'ΕΝΦΙΑ, πληρωμή σε μία δόση');
  const eleven = enfia(2026, 11);
  ok('μηχανή: έντεκα → χωρίς την 12η του Φεβρουαρίου', eleven.length === 11 && !eleven.some(o => o.kind === 'enfia-last')
    && eleven[10].title === 'ΕΝΦΙΑ, 11η και τελευταία δόση');
}
ok('μηχανή: έτος χωρίς εκκαθαριστικό αγνοεί το πλήθος', enfia(2027, 2).length === enfia(2027).length);
ok('μηχανή: τα άλλα είδη δεν αλλάζουν', greekPropertyTaxObligations(2026, 'short_term', { enfiaInstalments: { 2026: 2 } }).filter(o => !o.kind.startsWith('enfia-')).length
  === greekPropertyTaxObligations(2026, 'short_term').filter(o => !o.kind.startsWith('enfia-')).length);

// ── ΠΟΙΟΣ ΦΟΡΟΛΟΓΟΥΜΕΝΟΣ ───────────────────────────────────────────────────
{
  const props = [{ id: 'a', client_id: 'c1' }, { id: 'b', client_id: 'c2' }, { id: 'c', client_id: null }];
  const facts = [{ propertyId: 'a', year: 2026, amount: 27.44 }];
  const one = enfiaCountsByProperty(props, null, facts);
  ok('ιδιώτης: ένα εκκαθαριστικό για όλα', ['a', 'b', 'c'].every(id => one.get(id)?.[2026] === 2));
  const pro = enfiaCountsByProperty(props, new Set(['c1', 'c2']), facts);
  ok('επαγγελματίας: μόνο τα ακίνητα της ίδιας καρτέλας', pro.get('a')?.[2026] === 2 && pro.get('b')?.[2026] === undefined && pro.get('c')?.[2026] === undefined);
  const alone = enfiaCountsByProperty(props, new Set(), facts);
  ok('άγνωστος φορολογούμενος: κάθε ακίνητο μόνο του', alone.get('a')?.[2026] === 2 && alone.get('b')?.[2026] === undefined);
  const max = enfiaCountsByProperty(props, null, [...facts, { propertyId: 'b', year: 2026, amount: 67.2 }, { propertyId: 'c', year: 2025, amount: 500 }]);
  ok('δύο σύνολα: το μεγαλύτερο, ανά έτος', max.get('a')?.[2026] === 6 && max.get('a')?.[2025] === 12);
  ok('γεγονός ξένου ακινήτου: δεν μετρά', enfiaCountsByProperty(props, null, [{ propertyId: 'zz', year: 2026, amount: 27.44 }]).get('a')?.[2026] === undefined);
}
ok('ρυθμίσεις: ποσό με κόμμα και έτος', enfiaTotalOfSettings('a', { enfiaStatementTotal: '27,44', enfiaStatementYear: '2026' })?.amount === 27.44);
ok('ρυθμίσεις: χωρίς έτος δεν μετρά', enfiaTotalOfSettings('a', { enfiaStatementTotal: '27,44', enfiaStatementYear: '' }) === null);
ok('ρυθμίσεις: κενό ή μηδέν δεν μετρά', enfiaTotalOfSettings('a', { enfiaStatementTotal: '', enfiaStatementYear: '2026' }) === null
  && enfiaTotalOfSettings('a', { enfiaStatementTotal: '0', enfiaStatementYear: '2026' }) === null);

// ── ΤΟ ΑΡΧΕΙΟ ΚΡΑΤΑ ΣΥΝΟΛΟ, ΟΧΙ ΜΕΡΙΔΙΟ ──────────────────────────────────────
ok('τίτλος: «ΕΝΦΙΑ 2026» → 2026', enfiaYearOf(`${ENFIA_TITLE} 2026`) === 2026 && enfiaYearOf('Ε9 2026') === null && enfiaYearOf('ΕΝΦΙΑ') === null);
{
  const lines = [{ atak: '01234567890', amount: 27 }, { atak: '01234567891', amount: 93 }];
  const share = planDocSave({ doc_type: 'tax', subtype: 'enfia', tax_year: 2026, property_amount: 27, lines, line: 0 }, '2026-10-20');
  ok('πολλά ακίνητα χωρίς σύνολο: το μερίδιο δεν γράφεται ως σύνολο', share.archive?.amount === undefined, share.archive);
  const single = planDocSave({ doc_type: 'tax', subtype: 'enfia', tax_year: 2026, property_amount: 27, lines: [lines[0]], line: 0 }, '2026-10-20');
  ok('ένα ακίνητο: το ποσό του είναι το σύνολο', single.archive?.amount === 27);
  const total = planDocSave({ doc_type: 'tax', subtype: 'enfia', tax_year: 2026, amount: 120, property_amount: 27, lines, line: 0 }, '2026-10-20');
  ok('με σύνολο: το σύνολο', total.archive?.amount === 120 && total.archive?.title === 'ΕΝΦΙΑ 2026');
  // ΤΟ ΣΗΜΑ ΤΟΥ ΣΥΝΟΛΟΥ (έλεγχος 21/10/2026, εύρημα E): μόνο αυτό μετρά δόσεις.
  ok('με σύνολο: σημαδεμένο ως σύνολο', total.archive?.statement_total === true);
  ok('ένα ακίνητο: σημαδεμένο ως σύνολο', single.archive?.statement_total === true);
  ok('μερίδιο χωρίς σύνολο: χωρίς σήμα', share.archive?.statement_total === undefined);
  const bill = planDocSave({ doc_type: 'tax', tax_year: 2026, amount: 50 }, '2026-10-20');
  ok('άλλο φορολογικό με ποσό: χωρίς σήμα', bill.archive?.statement_total === undefined, bill.archive);
}

console.log(`\nenfiaTotals: ${pass} ✓ · ${fail} ✗`);
if (fail) process.exit(1);
