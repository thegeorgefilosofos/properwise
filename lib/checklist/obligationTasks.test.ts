// Τεστ για τις παραγόμενες εκκρεμότητες και τον φύλακα του παραστατικού
// (lib/checklist/obligationTasks.ts). Τρέξε με:
//   npx tsx lib/checklist/obligationTasks.test.ts
import { readFileSync, readdirSync } from 'node:fs'
import {
  taxTaskDrafts, lawTaskDrafts, obligationDrafts, pendingDrafts, audiencesFor,
  expenseFromReceipt, actualCostFromReceipt, costVariance, enfiaTasksPaidByBills,
  isTaxTaskRef, isLawTaskRef, isGeneratedRef, taxTaskRef, TAX_REF_PREFIX,
  type ReceiptEntry,
} from './obligationTasks'
import { UPDATE_ACTIONS, actionableUpdatesFor, REGULATORY_UPDATES_2026 } from '@/lib/accounting/updates2026'
import { taxEventSource, TAX_SOURCE_PREFIX } from '@/lib/tax/greekTaxCalendar'
import type { FieldContext } from '@/lib/property/fields'

let passed = 0, failed = 0;
function ok(name: string, cond: boolean) { if (cond) { passed++; } else { failed++; console.log('  ✗ ' + name); } }
function eq<T>(name: string, a: T, b: T) { ok(`${name} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`, JSON.stringify(a) === JSON.stringify(b)); }

const TODAY = '2026-07-30';
const ctx = (o: Partial<FieldContext>): FieldContext =>
  ({ status: 'vacant', business: false, doubleEntry: false, propertyCount: 1, ...o });

// ═══════════════════════════════════════════════════════════════════════════
// 1) ΤΟ ΤΡΙΤΟ ΗΜΕΡΟΛΟΓΙΟ ΕΦΥΓΕ — καμία ημερομηνία δεν γεννιέται εδώ
// ═══════════════════════════════════════════════════════════════════════════
{
  const owner = taxTaskDrafts(TODAY, 'owner')
  ok('ο ιδιοκτήτης παίρνει φορολογικές υποχρεώσεις', owner.length > 0);
  ok('καμία προθεσμία στο παρελθόν', owner.every(d => !!d.due_date && d.due_date >= TODAY));
  ok('καμία προθεσμία «1η του μήνα»', owner.every(d => !d.due_date!.endsWith('-01')));
  ok('όλες έχουν επίσημη πηγή', owner.every(d => (d.sourceUrl || '').startsWith('https://')));
  ok('όλες είναι κρίσιμες για συμμόρφωση', owner.every(d => d.critical));
  ok('όλες λένε ποιος το κάνει', owner.every(d => /Ποιος το κάνει:/.test(d.note)));
  ok('όλες λένε πόσο σίγουρη είναι η ημερομηνία', owner.every(d => /(ορίζει ο νόμος|επιβεβαίωσέ την)/.test(d.note)));
  ok('μοναδικά κλειδιά', new Set(owner.map(d => d.ref)).size === owner.length);
  ok('κάθε κλειδί είναι φορολογικό', owner.every(d => isTaxTaskRef(d.ref) && isGeneratedRef(d.ref)));
  ok('κανένα εκτιμώμενο κόστος στο σχέδιο', owner.every(d => !('estimated_cost' in d)));
}

// Μία γραμμή ανά υποχρέωση: η βραχυχρόνια έχει 12 μηνιαίες δηλώσεις + 12
// αποδόσεις τέλους ανά έτος. Δεν γίνονται τριάντα εκκρεμότητες.
{
  const short = taxTaskDrafts(TODAY, 'short_term')
  const owner = taxTaskDrafts(TODAY, 'owner')
  ok('η βραχυχρόνια έχει παραπάνω από τον ιδιοκτήτη', short.length > owner.length);
  ok('η βραχυχρόνια μένει σύντομη λίστα', short.length <= 8);
  ok('μία μόνο δήλωση βραχυχρόνιας διαμονής', short.filter(d => /βραχυχρόνιας διαμονής/.test(d.description)).length === 1);
  ok('μία μόνο απόδοση τέλους ανθεκτικότητας', short.filter(d => /ανθεκτικότητας/.test(d.description)).length === 1);
  ok('ο ιδιοκτήτης δεν βλέπει δήλωση βραχυχρόνιας', !owner.some(d => /βραχυχρόνια/i.test(d.description)));
  ok('οι πληρωμές πάνε στα Οικονομικά', short.some(d => d.category === 'financial'));
  ok('οι δηλώσεις πάνε στα Νομικά', short.some(d => d.category === 'legal'));
}

// ΟΙ ΔΟΣΕΙΣ ΤΟΥ ΕΝΦΙΑ (03.10.2026): οι δέκα ενδιάμεσες είναι ένα είδος, άρα
// ΜΙΑ εκκρεμότητα, η επόμενη. Στις 3.10.2026 είναι η όγδοη, στο τέλος Οκτωβρίου,
// όχι η τελευταία του Φεβρουαρίου.
{
  const oct = taxTaskDrafts('2026-10-03', 'owner')
  const mid = oct.filter(d => d.ref.startsWith(taxTaskRef('enfia-instalment-')))
  eq('μία ενδιάμεση δόση ΕΝΦΙΑ, όχι δέκα', mid.length, 1);
  eq('είναι η όγδοη', mid[0]?.description, 'ΕΝΦΙΑ, 8η δόση');
  eq('με το κλειδί της μηχανής', mid[0]?.ref, taxTaskRef('enfia-instalment-2026-8'));
  eq('στο τέλος Οκτωβρίου', mid[0]?.due_date, '2026-10-30');
  eq('πληρωμή, άρα Οικονομικά', mid[0]?.category, 'financial');
  eq('του νόμου, άρα κρίσιμη', mid[0]?.priority, 'critical');
  const pays = oct.filter(d => /^ΕΝΦΙΑ, .*δόση$/.test(d.description)).map(d => d.due_date)
  ok('η δόση του Οκτωβρίου είναι η πρώτη πληρωμή ΕΝΦΙΑ της λίστας', pays.length > 0 && pays.every(p => p! >= '2026-10-30'));
}

// ═══════════════════════════════════════════════════════════════════════════
// 2) ΑΛΛΑΓΕΣ ΝΟΜΟΘΕΣΙΑΣ → ΕΚΚΡΕΜΟΤΗΤΑ, με φιλτράρισμα κατά επιλογή
// ═══════════════════════════════════════════════════════════════════════════
eq('κενό ακίνητο, καμία ακροατηρία', audiencesFor(ctx({ status: 'vacant' })), []);
eq('μακροχρόνια → long_term', audiencesFor(ctx({ status: 'rent_long' })), ['long_term']);
eq('βραχυχρόνια → short_term', audiencesFor(ctx({ status: 'rent_short' })), ['short_term']);
eq('επιχείρηση με δάνειο', audiencesFor(ctx({ status: 'rent_long', business: true, hasLoan: true })), ['long_term', 'business', 'borrower']);

{
  const vacant = lawTaskDrafts(ctx({ status: 'vacant' }))
  eq('κενό ακίνητο: καμία εκκρεμότητα νομοθεσίας', vacant.length, 0);

  const long = lawTaskDrafts(ctx({ status: 'rent_long' }))
  ok('η μακροχρόνια παίρνει εκκρεμότητες', long.length > 0);
  ok('υπάρχει η εκκρεμότητα του IBAN/IRIS', long.some(d => /IRIS/.test(d.description)));
  ok('λέει τι χάνει αν δεν γίνει', long.some(d => /5%/.test(d.note)));
  ok('χωρίς προθεσμία, γιατί ο νόμος δεν έχει καταληκτική', long.every(d => d.due_date === null));
  ok('όλες έχουν σύνδεσμο πηγής ή ρητή βάση', long.every(d => !!d.sourceUrl || /Βάση:/.test(d.note)));
  ok('όλες λένε ποιος το κάνει', long.every(d => /Ποιος το κάνει:/.test(d.note)));
  ok('κλειδιά νομοθεσίας', long.every(d => isLawTaskRef(d.ref) && isGeneratedRef(d.ref)));
  ok('η μακροχρόνια δεν βλέπει προδιαγραφές βραχυχρόνιας', !long.some(d => /βραχυχρόνιας/.test(d.description)));

  const short = lawTaskDrafts(ctx({ status: 'rent_short' }))
  ok('η βραχυχρόνια βλέπει τα δικαιολογητικά καταλληλότητας', short.some(d => /καταλληλότητας/.test(d.description)));
  ok('η βραχυχρόνια δεν βλέπει το πλαφόν εμπορικών', !short.some(d => /3%/.test(d.description)));
}

// Μόνο action/warning γίνονται εργασίες. Η ενημέρωση δεν είναι υποχρέωση.
{
  const infoIds = REGULATORY_UPDATES_2026.filter(u => u.severity === 'info').map(u => u.id)
  ok('καμία ενημερωτική δεν έχει καταγραμμένη ενέργεια', infoIds.every(id => !UPDATE_ACTIONS[id]));
  ok('κάθε ενέργεια αντιστοιχεί σε υπαρκτό κανόνα', Object.keys(UPDATE_ACTIONS).every(id => REGULATORY_UPDATES_2026.some(u => u.id === id)));
  ok('κάθε ενέργεια είναι προστακτική χωρίς ορολογία', Object.values(UPDATE_ACTIONS).every(a => a.action.length > 20 && a.cost.length > 20));
  ok('κάθε ενέργεια λέει ποιος', Object.values(UPDATE_ACTIONS).every(a => ['app', 'owner', 'accountant'].includes(a.who)));
  const acts = actionableUpdatesFor('long_term')
  ok('actionableUpdatesFor δίνει μόνο action/warning', acts.every(a => a.update.severity !== 'info'));
}

// ═══════════════════════════════════════════════════════════════════════════
// 3) ΤΑΥΤΟΤΗΤΑ: δεύτερο πάτημα δεν διπλασιάζει τη λίστα
// ═══════════════════════════════════════════════════════════════════════════
{
  const all = obligationDrafts(TODAY, 'long_term', ctx({ status: 'rent_long' }))
  ok('περιέχει και φορολογικές και νομοθετικές', all.some(d => isTaxTaskRef(d.ref)) && all.some(d => isLawTaskRef(d.ref)));
  eq('χωρίς υπάρχουσες, όλες είναι νέες', pendingDrafts(all, []).length, all.length);
  eq('με όλες υπάρχουσες, καμία νέα', pendingDrafts(all, all.map(d => d.ref)).length, 0);

  // ═══ ΤΟ ΚΛΕΙΔΙ ΕΙΝΑΙ ΤΟ ΙΔΙΟ ΣΕ ΔΥΟ ΠΙΝΑΚΕΣ ΚΑΙ ΠΡΕΠΕΙ ΝΑ ΜΕΙΝΕΙ ═════════
  // Την ίδια θεσμική προθεσμία τη γράφουν δύο οθόνες: το Ημερολόγιο σε
  // `calendar_events.source` και οι Εκκρεμότητες σε `checklist_items` ως `ref`.
  // Οι Εκκρεμότητες σταματούν να προτείνουν ό,τι έχει ήδη το ημερολόγιο — αλλά
  // ΜΟΝΟ αν τα δύο κλειδιά γράφονται ολόγραφα ίδια. Αν αποκλίνουν (πρόθεμα που
  // κόπηκε, μορφή που άλλαξε), η αντιπαραβολή αποτυγχάνει ΣΙΩΠΗΛΑ και ο χρήστης
  // ξαναβλέπει τις ίδιες τέσσερις ημερομηνίες σε δύο οθόνες.
  ok('το κλειδί της εκκρεμότητας και του γεγονότος είναι το ίδιο αλφαριθμητικό',
     taxTaskRef('enfia_2026_1') === taxEventSource('enfia_2026_1'));
  ok('τα δύο προθέματα δεν έχουν αποκλίνει', TAX_REF_PREFIX === TAX_SOURCE_PREFIX);
  eq('γεγονός ημερολογίου αναγνωρίζεται ως υπάρχουσα υποχρέωση',
     pendingDrafts(all, all.map(d => taxEventSource(d.ref.slice(TAX_REF_PREFIX.length))))
       .filter(d => d.ref.startsWith(TAX_REF_PREFIX)).length, 0);
  eq('μερική επικάλυψη', pendingDrafts(all, [all[0].ref]).length, all.length - 1);
  ok('άγνωστο κλειδί δεν μπερδεύεται', pendingDrafts(all, [taxTaskRef('δεν-υπάρχει')]).length === all.length);
}

// ═══════════════════════════════════════════════════════════════════════════
// 4) Ο ΦΥΛΑΚΑΣ: καμία δαπάνη χωρίς παραστατικό
// ═══════════════════════════════════════════════════════════════════════════
const receipt = (o: Partial<ReceiptEntry>): ReceiptEntry => ({
  amount: 143, date: '2026-07-14', description: 'Υδραυλικός, αλλαγή μπαταρίας',
  category: 'Συντήρηση & Επισκευές', group: 'maintenance',
  evidence: { path: 'u/p/document/1_inv.jpg', name: 'inv.jpg' }, ...o,
});

ok('με παραστατικό γράφεται δαπάνη', expenseFromReceipt(receipt({})) !== null);
eq('χωρίς παραστατικό, ΤΙΠΟΤΑ', expenseFromReceipt(receipt({ evidence: null })), null);
eq('κενή διαδρομή αρχείου, ΤΙΠΟΤΑ', expenseFromReceipt(receipt({ evidence: { path: '   ', name: 'x' } })), null);
eq('μηδενικό ποσό, ΤΙΠΟΤΑ', expenseFromReceipt(receipt({ amount: 0 })), null);
eq('αρνητικό ποσό, ΤΙΠΟΤΑ', expenseFromReceipt(receipt({ amount: -50 })), null);
eq('NaN ποσό, ΤΙΠΟΤΑ', expenseFromReceipt(receipt({ amount: Number.NaN })), null);
eq('χωρίς ημερομηνία, ΤΙΠΟΤΑ', expenseFromReceipt(receipt({ date: '' })), null);
eq('κακή ημερομηνία, ΤΙΠΟΤΑ', expenseFromReceipt(receipt({ date: '14/07/2026' })), null);
eq('κενή περιγραφή, ΤΙΠΟΤΑ', expenseFromReceipt(receipt({ description: '  ' })), null);

{
  const row = expenseFromReceipt(receipt({ provider: 'Υδραυλικές ΕΠΕ' }))!
  eq('η δαπάνη με παραστατικό είναι ΠΛΗΡΩΜΕΝΗ', row.paid, true);
  eq('κρατά το ποσό του χαρτιού', row.amount, 143);
  eq('κρατά την ημερομηνία του χαρτιού', row.date, '2026-07-14');
  eq('κρατά τον πάροχο', row.store_vendor, 'Υδραυλικές ΕΠΕ');
  ok('η σημείωση δείχνει στο Αρχείο', /Αρχείο: inv\.jpg/.test(row.notes));
  ok('καμία «προγραμματισμένη εκκρεμότητα»', !/Προγραμματισμέν/.test(row.notes));
  eq('actual_cost = ποσό παραστατικού', actualCostFromReceipt(receipt({})), 143);
  eq('actual_cost χωρίς παραστατικό', actualCostFromReceipt(receipt({ evidence: null })), null);
}

// ═══════════════════════════════════════════════════════════════════════════
// 5) Η ΑΠΟΚΛΙΣΗ ΔΕΝ ΕΙΝΑΙ ΠΛΕΟΝ −(ΕΚΤΙΜΗΣΗ)
// ═══════════════════════════════════════════════════════════════════════════
eq('εκτίμηση χωρίς πραγματικό: άγνωστο, όχι απόκλιση', costVariance(1850, 0), null);
eq('πραγματικό χωρίς εκτίμηση: άγνωστο', costVariance(0, 143), null);
eq('τίποτα από τα δύο: άγνωστο', costVariance(0, 0), null);
eq('και τα δύο: πραγματική απόκλιση', costVariance(120, 143), 23);
eq('υπέρ του χρήστη', costVariance(200, 143), -57);

// ═══════════════════════════════════════════════════════════════════════════
// 6) ΦΡΟΥΡΟΣ ΠΗΓΑΙΟΥ ΚΩΔΙΚΑ — ό,τι σβήστηκε να μην επιστρέψει σιωπηλά
// ═══════════════════════════════════════════════════════════════════════════
{
  // Ο ΦΡΟΥΡΟΣ ΔΙΑΒΑΖΕΙ ΟΛΕΣ ΤΙΣ ΟΘΟΝΕΣ ΤΩΝ ΕΚΚΡΕΜΟΤΗΤΩΝ, ΟΧΙ ΜΙΑ. Όσο ο κώδικας
  // ζούσε σε ένα αρχείο, το όνομα του αρχείου ήταν αρκετό. Τώρα ζει σε οκτώ και
  // ένας φρουρός που κοιτάζει μόνο το πρώτο θα άφηνε ό,τι σβήστηκε να επιστρέψει
  // σε οποιοδήποτε από τα υπόλοιπα εφτά — σιωπηλά, που είναι ακριβώς ο λόγος που
  // γράφτηκε.
  const dir = 'app/dashboard/components/checklist'
  const raw = [
    readFileSync('app/dashboard/components/TabChecklist.tsx', 'utf8'),
    ...readdirSync(dir).sort().filter(f => !f.endsWith('.test.ts')).map(f => readFileSync(`${dir}/${f}`, 'utf8')),
  ].join('\n')
  // Τα σχόλια ΕΞΑΙΡΟΥΝΤΑΙ: το αρχείο τεκμηριώνει ρητά τι σβήστηκε και γιατί και
  // αυτή η τεκμηρίωση δεν πρέπει να πέφτει πάνω στον φρουρό. Ελέγχεται ο κώδικας.
  const src = raw.split('\n').filter(l => !l.trim().startsWith('//')).join('\n')

  // Ο κεντρικός κανόνας: ΜΙΑ εγγραφή δαπάνης και περνά από τον φύλακα.
  // Ο πίνακας έχει πλέον στρώμα (lib/data/expenses.ts): η καρτέλα δεν τον
  // αγγίζει απευθείας, οπότε ο φρουρός μετρά τις κλήσεις του στρώματος.
  const inserts = src.match(/expenses\.(addRow|insert|insertReturning|add)\(/g) || []
  eq('μία και μόνο εγγραφή στα expenses', inserts.length, 1);
  ok('η εγγραφή δαπάνης περνά από το expenseFromReceipt',
    /expenseFromReceipt\(/.test(src) && /expenses\.addRow\(supabase, \{ \.\.\.expenseRow/.test(src))
  ok('σβήστηκε το makeTaskExpense', !/makeTaskExpense/.test(src));
  ok('σβήστηκε η «Προγραμματισμένη εκκρεμότητα»', !/Προγραμματισμένη εκκρεμότητα/.test(src));

  // Το τρίτο ημερολόγιο και οι ημερομηνίες «1η του μήνα».
  ok('σβήστηκε το AADE_CALENDAR', !/AADE_CALENDAR\b/.test(src));
  ok('σβήστηκε το loadAADECalendar', !/loadAADECalendar/.test(src));
  ok('καμία ημερομηνία -MM-01 από πρότυπο', !/-01'\s*,\s*note:/.test(src));
  ok('καταναλώνει το ένα ημερολόγιο', /from '@\/lib\/checklist\/obligationTasks'/.test(src));

  // Τα 24 επινοημένα κόστη.
  ok('κανένα σταθερό κόστος στα πρότυπα', !/estimated_cost:\s*[1-9]/.test(src));
  ok('τα πρότυπα δεν διαφημίζουν σύνολο κόστους', !/~\$\{cost\}/.test(src));

  // Οι δύο editors που ορίζονταν και δεν χρησιμοποιούνταν.
  ok('το SubTaskEditor χρησιμοποιείται', (src.match(/SubTaskEditor/g) || []).length >= 2);
  ok('το CommentsEditor χρησιμοποιείται', (src.match(/CommentsEditor/g) || []).length >= 2);

  // Το actual_cost δεν γράφεται πια σταθερά 0 από τη φόρμα.
  ok('το actual_cost δεν είναι σταθερό 0 στη φόρμα', !/actual_cost:\s*parseFloat\(form\.actual_cost\)/.test(src));
}

// ── Πληρωμένος λογαριασμός ΕΝΦΙΑ: κλείνει ΜΟΝΟ την ίδια δόση ──────────────────
{
  // Τρεις δόσεις στη λίστα, μία ανά μήνα, όπως τις γράφει το taxTaskDrafts.
  // Η πρώτη στη σειρά της λίστας είναι η 7η δόση (Σεπτέμβριος 2026)· η
  // πληρωμένη είναι η 8η (Οκτώβριος 2026). Η παλιά συμπεριφορά (πρώτη ανοιχτή
  // με «ενφια», οποιοσδήποτε πληρωμένος λογαριασμός) έκλεινε την 7η.
  const tasks = [
    { id: 'sep', description: 'ΕΝΦΙΑ 2026 — 7η δόση', status: 'pending', due_date: '2026-09-30', ref: 'tax:enfia-instalment-2026-7' },
    { id: 'oct', description: 'ΕΝΦΙΑ 2026 — 8η δόση', status: 'pending', due_date: '2026-10-30', ref: 'tax:enfia-instalment-2026-8' },
    { id: 'nov', description: 'ΕΝΦΙΑ 2026 — 9η δόση', status: 'pending', due_date: '2026-11-30', ref: 'tax:enfia-instalment-2026-9' },
    { id: 'issue', description: 'Ανάρτηση εκκαθαριστικού ΕΝΦΙΑ 2027', status: 'pending', due_date: '2027-03-15', ref: 'tax:enfia-issue-2027' },
  ]
  const oct = [{ paid: true, due_date: '2026-10-30' }]
  eq('ο πληρωμένος Οκτωβρίου κλείνει ΜΟΝΟ τη δόση Οκτωβρίου', enfiaTasksPaidByBills(tasks, oct), ['oct'])
  ok('η πρώτη ανοιχτή (Σεπτέμβριος) ΔΕΝ κλείνει από λογαριασμό άλλου μήνα',
    !enfiaTasksPaidByBills(tasks, oct).includes('sep'))
  // Ίδιος μήνας, άλλο έτος: η δόση του Οκτωβρίου 2025 δεν είναι του 2026.
  eq('άλλο έτος, ίδιος μήνας → τίποτα', enfiaTasksPaidByBills(tasks, [{ paid: true, due_date: '2025-10-31' }]), [])
  eq('απλήρωτος λογαριασμός → τίποτα', enfiaTasksPaidByBills(tasks, [{ paid: false, due_date: '2026-10-30' }]), [])
  eq('λογαριασμός χωρίς ημερομηνία → τίποτα', enfiaTasksPaidByBills(tasks, [{ paid: true, due_date: null }]), [])
  // Η ανάρτηση δεν είναι πληρωμή, ακόμη κι αν πέφτει στον ίδιο μήνα.
  eq('η ανάρτηση του εκκαθαριστικού δεν κλείνει από λογαριασμό',
    enfiaTasksPaidByBills(tasks, [{ paid: true, due_date: '2027-03-31' }]), [])
  // Ήδη κλειστή δεν ξαναγράφεται.
  eq('κλειστή δόση δεν ξανακλείνει',
    enfiaTasksPaidByBills([{ ...tasks[1], status: 'done' }], oct), [])
  // Χειρόγραφη εργασία χωρίς κλειδί: από τίτλο ΚΑΙ μήνα· χωρίς προθεσμία ποτέ.
  eq('χειρόγραφη «Πληρωμή ΕΝΦΙΑ» με ίδιο μήνα κλείνει',
    enfiaTasksPaidByBills([{ id: 'm', description: 'Πληρωμή ΕΝΦΊΑ', status: 'pending', due_date: '2026-10-15', ref: null }], oct), ['m'])
  eq('χειρόγραφη χωρίς προθεσμία δεν κλείνει ποτέ',
    enfiaTasksPaidByBills([{ id: 'm', description: 'Πληρωμή ΕΝΦΙΑ', status: 'pending', due_date: null, ref: null }], oct), [])
  eq('άλλη υποχρέωση στον ίδιο μήνα δεν κλείνει',
    enfiaTasksPaidByBills([{ id: 'e9', description: 'Ε9', status: 'pending', due_date: '2026-10-30', ref: 'tax:e9-2026' }], oct), [])

  // Η καρτέλα δεν κρατά πια την παλιά λογική «πρώτη με ενφια».
  const tab = readFileSync('app/dashboard/components/TabChecklist.tsx', 'utf8')
  ok('η καρτέλα καλεί το enfiaTasksPaidByBills', /enfiaTasksPaidByBills\(/.test(tab))
  ok('σβήστηκε το «πρώτος λογαριασμός ΕΝΦΙΑ»', !/enfiaBillData\[0\]/.test(tab))
  ok("σβήστηκε το «πρώτη εργασία με 'ενφια'»", !/rows\.find\(.*'ενφια'/.test(tab))
}

// ── Η δόση που ξανάνοιξε ο χρήστης δεν ξανακλείνει μόνη της (07.10.2026) ──────
// Αναπαραγωγή: πληρωμένος λογαριασμός Οκτωβρίου (paid_at 01/10 10:00), η δόση
// Οκτωβρίου κλείνει αυτόματα, ο χρήστης την ξε-τσεκάρει στις 02/10. Πριν, η
// επόμενη φόρτωση την ξανάκλεινε, γιατί τίποτα δεν θυμόταν το ξανα-άνοιγμα.
{
  const task = { id: 'oct', description: 'ΕΝΦΙΑ 2026 — 8η δόση', status: 'pending', due_date: '2026-10-30', ref: 'tax:enfia-instalment-2026-8' }
  const bill = { paid: true, due_date: '2026-10-30', paid_at: '2026-10-01T10:00:00.000Z', created_at: '2026-09-20T08:00:00.000Z' }
  eq('χωρίς ξανα-άνοιγμα, ο πληρωμένος την κλείνει', enfiaTasksPaidByBills([task], [bill]), ['oct'])
  eq('ξανανοιγμένη ΜΕΤΑ την πληρωμή → μένει ανοιχτή',
    enfiaTasksPaidByBills([{ ...task, reopened_at: '2026-10-02T09:00:00.000Z' }], [bill]), [])
  eq('νέα πληρωμή ΜΕΤΑ το ξανα-άνοιγμα → κλείνει ξανά',
    enfiaTasksPaidByBills([{ ...task, reopened_at: '2026-10-02T09:00:00.000Z' }],
      [bill, { ...bill, paid_at: '2026-10-03T12:00:00.000Z' }]), ['oct'])
  eq('ξανανοιγμένη ΠΡΙΝ την πληρωμή → κλείνει (η πληρωμή είναι νεότερη)',
    enfiaTasksPaidByBills([{ ...task, reopened_at: '2026-09-25T09:00:00.000Z' }], [bill]), ['oct'])
  eq('λογαριασμός χωρίς paid_at κρίνεται από την καταχώρησή του',
    enfiaTasksPaidByBills([{ ...task, reopened_at: '2026-09-25T09:00:00.000Z' }], [{ ...bill, paid_at: null, created_at: '2026-09-26T09:00:00.000Z' }]), ['oct'])
  eq('λογαριασμός χωρίς καμία ώρα δεν υπερισχύει του ξανα-ανοίγματος',
    enfiaTasksPaidByBills([{ ...task, reopened_at: '2026-10-02T09:00:00.000Z' }], [{ ...bill, paid_at: null, created_at: null }]), [])
  // Άλλη δόση, που δεν την άγγιξε ο χρήστης, κλείνει κανονικά δίπλα στην ξανανοιγμένη.
  const sep = { ...task, id: 'sep', due_date: '2026-09-30', ref: 'tax:enfia-instalment-2026-7' }
  eq('το ξανα-άνοιγμα μιας δόσης δεν κρατά ανοιχτή άλλη',
    enfiaTasksPaidByBills([{ ...task, reopened_at: '2026-10-02T09:00:00.000Z' }, sep],
      [bill, { ...bill, due_date: '2026-09-30' }]), ['sep'])

  // Η καρτέλα γράφει το ίχνος και το διαβάζει.
  const tab = readFileSync('app/dashboard/components/TabChecklist.tsx', 'utf8')
  ok('το ξε-τσεκάρισμα περνά την προηγούμενη κατάσταση', /checklist\.setStatus\(supabase, item\.id, newStatus, before\)/.test(tab))
  ok('η φόρμα γράφει την κατάσταση από το statusFields', /checklist\.statusFields\(form\.status, editItem\?\.status\)/.test(tab))
  ok('το ταίριασμα παίρνει reopened_at', /reopened_at,\s*\}\)\), enfiaBills\)/.test(tab))
  ok('ο λογαριασμός ζητείται με την ώρα πληρωμής', /'id,paid,due_date,paid_at,created_at'/.test(tab))
  const mig = readdirSync('supabase/migrations').filter(f => f.endsWith('.sql'))
    .map(f => readFileSync(`supabase/migrations/${f}`, 'utf8')).join('\n')
  ok('η στήλη υπάρχει στη βάση, με if not exists',
    /alter table public\.checklist_items\s+add column if not exists reopened_at timestamptz/.test(mig))
}

console.log(`obligationTasks.ts — ${passed} passed, ${failed} failed (σύνολο ${passed + failed})`)
if (failed > 0) process.exit(1)
