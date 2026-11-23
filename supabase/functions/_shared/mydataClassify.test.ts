// npx tsx supabase/functions/_shared/mydataClassify.test.ts
//
// ΤΑ ΤΡΙΑ ΕΠΙΠΕΔΑ ΤΟΥ myDATA (PR-Α2): ΑΥΤΟΜΑΤΑ, ΓΙΑ ΕΛΕΓΧΟ, ΑΠΟΡΡΙΨΗ.
//
// Ο κανόνας του ιδιοκτήτη (σχέδιο 23/11/2026, «ΑΥΣΤΗΡΟΠΟΙΗΣΗ» και «ΟΡΙΟ
// ΕΛΕΓΧΟΥ»), πρώτα το πιο συντηρητικό:
//   · ΑΥΤΟΜΑΤΑ μόνο πάροχος του μητρώου (lib/mydata/providers.ts) που ο χρήστης
//     έχει ήδη επιβεβαιώσει μία φορά, με συμβατό τύπο, ποσά που κλείνουν, όχι
//     πιστωτικό, όχι πάνω από το όριο του άρθρου 23 ΚΦΕ και όχι πάνω από 2× τον
//     μέσο όρο του ίδιου παρόχου.
//   · ΑΠΟΡΡΙΨΗ ο εκδότης της λίστας «δεν αφορά ακίνητα». Δεν αποθηκεύεται.
//   · ΟΛΑ ΤΑ ΑΛΛΑ για έλεγχο, με τον λόγο ως κωδικό.
import { classifyDoc, type ClassifyDoc } from './mydataClassify.ts'
import { PROVIDERS, NOT_PROPERTY, providerByAfm, KIND_CATEGORY } from '../../../lib/mydata/providers.ts'
import { BANK_PAYMENT_LIMIT_CENTS, UNUSUAL_FACTOR } from '../../../lib/mydata/limits.ts'

let pass = 0, fail = 0
const ok = (name: string, cond: boolean) => { if (cond) pass++; else { fail++; console.error('✗ ' + name) } }
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// Ο πρώτος πάροχος ρεύματος του μητρώου. Οι δοκιμές δεν γράφουν ΑΦΜ με το χέρι:
// διαβάζουν το μητρώο, ώστε μια διόρθωσή του να μη χρειάζεται δεύτερη αλλαγή εδώ.
const POWER = PROVIDERS.find(p => p.kind === 'electricity')!
const WATER = PROVIDERS.find(p => p.kind === 'water')!
const UNKNOWN_AFM = '099000049'

const doc = (p: Partial<ClassifyDoc> = {}): ClassifyDoc => ({
  counterpartAfm: POWER.afm, docType: '2.1', netCents: 7137, vatCents: 1713, grossCents: 8850,
  credit: false, amountsClose: true, ...p,
})
const seen = { n: 3, avgCents: 9000 }

// ── 0. ΤΟ ΜΗΤΡΩΟ ΥΠΑΡΧΕΙ ΚΑΙ ΤΟ ΒΡΙΣΚΕΙ Η ΑΝΑΖΗΤΗΣΗ ────────────────────────────
ok('0: υπάρχει πάροχος ρεύματος και νερού', !!POWER && !!WATER)
ok('0: η αναζήτηση βρίσκει τον πάροχο', providerByAfm(POWER.afm)?.name === POWER.name)
ok('0: άγνωστο ΑΦΜ: κανένας πάροχος', providerByAfm(UNKNOWN_AFM) === null)
ok('0: το όριο είναι σε λεπτά, θετικό', Number.isInteger(BANK_PAYMENT_LIMIT_CENTS) && BANK_PAYMENT_LIMIT_CENTS > 0)

// ── 1. ΚΑΤΗΓΟΡΙΟΠΟΙΗΣΗ: ΓΝΩΣΤΟΣ ΠΑΡΟΧΟΣ, ΗΔΗ ΕΠΙΒΕΒΑΙΩΜΕΝΟΣ ────────────────────
{
  const v = classifyDoc(doc(), seen)
  ok('1: αυτόματα', v.tier === 'auto')
  ok('1: είδος ρεύμα', v.kind === 'electricity')
  ok('1: κατηγορία της εφαρμογής από το είδος', v.category === KIND_CATEGORY.electricity.slug)
  ok('1: κανένας λόγος ελέγχου', same(v.reasons, []))
  const w = classifyDoc(doc({ counterpartAfm: WATER.afm, docType: '11.2' }), seen)
  ok('1: νερό με απόδειξη παροχής: αυτόματα, κατηγορία νερό', w.tier === 'auto' && w.category === KIND_CATEGORY.water.slug)
}

// ── 2. ΝΕΟΣ ΠΑΡΟΧΟΣ: ΠΑΝΤΑ ΓΙΑ ΕΛΕΓΧΟ, ΜΕ ΤΗΝ ΚΑΤΗΓΟΡΙΑ ΠΡΟΣΥΜΠΛΗΡΩΜΕΝΗ ────────
{
  const v = classifyDoc(doc(), null)
  ok('2: χωρίς ιστορικό: για έλεγχο', v.tier === 'review')
  ok('2: λόγος new_provider', v.reasons.includes('new_provider'))
  ok('2: η κατηγορία μένει προσυμπληρωμένη', v.category === KIND_CATEGORY.electricity.slug)
  ok('2: ιστορικό με μηδέν επιβεβαιωμένα μετρά ως νέος', classifyDoc(doc(), { n: 0, avgCents: 0 }).reasons.includes('new_provider'))
}

// ── 3. ΤΟ ΟΡΙΟ ΤΟΥ ΑΡΘΡΟΥ 23 ΚΦΕ: ΠΑΝΩ ΑΠΟ ΑΥΤΟ, ΠΑΝΤΑ ΕΛΕΓΧΟΣ ─────────────────
{
  const big = { n: 3, avgCents: BANK_PAYMENT_LIMIT_CENTS }
  const over = classifyDoc(doc({ grossCents: BANK_PAYMENT_LIMIT_CENTS + 1 }), big)
  ok('3: ένα λεπτό πάνω από το όριο: για έλεγχο', over.tier === 'review' && over.reasons.includes('over_limit'))
  const at = classifyDoc(doc({ grossCents: BANK_PAYMENT_LIMIT_CENTS }), big)
  ok('3: ακριβώς στο όριο («άνω των»): όχι over_limit', !at.reasons.includes('over_limit') && at.tier === 'auto')
  const unknownOver = classifyDoc(doc({ counterpartAfm: UNKNOWN_AFM, grossCents: BANK_PAYMENT_LIMIT_CENTS + 1 }), null)
  ok('3: και για άγνωστο πάροχο το over_limit λέγεται', unknownOver.reasons.includes('over_limit'))
}

// ── 4. ΠΙΣΤΩΤΙΚΑ ΚΑΙ ΑΚΥΡΩΤΙΚΑ: ΠΑΝΤΑ ΕΛΕΓΧΟΣ ───────────────────────────────────
{
  const v = classifyDoc(doc({ docType: '5.1', credit: true }), seen)
  ok('4: πιστωτικό τιμολόγιο: για έλεγχο', v.tier === 'review' && v.reasons.includes('credit'))
  const r = classifyDoc(doc({ docType: '11.4', credit: true }), seen)
  ok('4: πιστωτικό λιανικής: για έλεγχο', r.tier === 'review' && r.reasons.includes('credit'))
}

// ── 5. ΠΑΝΩ ΑΠΟ 2× ΤΟΝ ΜΕΣΟ ΟΡΟ ΤΟΥ ΙΔΙΟΥ ΠΑΡΟΧΟΥ ─────────────────────────────
{
  const hist = { n: 4, avgCents: 4000 }
  const v = classifyDoc(doc({ grossCents: 4000 * UNUSUAL_FACTOR + 1 }), hist)
  ok('5: ένα λεπτό πάνω από το διπλάσιο: για έλεγχο', v.tier === 'review' && v.reasons.includes('unusual_amount'))
  const at = classifyDoc(doc({ grossCents: 4000 * UNUSUAL_FACTOR }), hist)
  ok('5: ακριβώς το διπλάσιο: αυτόματα', at.tier === 'auto')
  ok('5: χωρίς ιστορικό ο κανόνας δεν εφαρμόζεται (είναι ήδη νέος)', !classifyDoc(doc({ grossCents: 99999 }), null).reasons.includes('unusual_amount'))
}

// ── 6. ΑΓΝΩΣΤΟΣ ΠΑΡΟΧΟΣ: ΠΟΤΕ ΑΥΤΟΜΑΤΑ, ΟΣΟ ΚΙ ΑΝ ΤΟΝ ΕΧΕΙ ΕΠΙΒΕΒΑΙΩΣΕΙ ─────────
{
  const v = classifyDoc(doc({ counterpartAfm: UNKNOWN_AFM }), { n: 9, avgCents: 8850, category: 'plumber' })
  ok('6: άγνωστος με ιστορικό: για έλεγχο', v.tier === 'review' && v.reasons.includes('unknown_provider'))
  ok('6: η κατηγορία από την τελευταία επιλογή του χρήστη', v.category === 'plumber')
  ok('6: κανένα είδος παρόχου', v.kind === null)
  const bare = classifyDoc(doc({ counterpartAfm: UNKNOWN_AFM }), null)
  ok('6: άγνωστος χωρίς ιστορικό: καμία κατηγορία από εδώ', bare.category === null && bare.tier === 'review')
  const junk = classifyDoc(doc({ counterpartAfm: UNKNOWN_AFM }), { n: 1, avgCents: 100, category: 'Robert"); drop' })
  ok('6: κατηγορία που δεν είναι slug δεν περνά', junk.category === null)
}

// ── 7. ΤΥΠΟΣ ΠΑΡΑΣΤΑΤΙΚΟΥ ΚΑΙ ΠΟΣΑ ΠΟΥ ΔΕΝ ΚΛΕΙΝΟΥΝ ─────────────────────────────
{
  ok('7: ενδοκοινοτικό από πάροχο του μητρώου: για έλεγχο', classifyDoc(doc({ docType: '1.2' }), seen).reasons.includes('doc_type'))
  ok('7: απόδειξη ενοικίου: για έλεγχο', classifyDoc(doc({ docType: '8.1' }), seen).reasons.includes('doc_type'))
  for (const t of ['1.1', '2.1', '11.1', '11.2', '11.3']) ok(`7: τύπος ${t} συμβατός`, classifyDoc(doc({ docType: t }), seen).tier === 'auto')
  const v = classifyDoc(doc({ amountsClose: false }), seen)
  ok('7: ποσά που δεν κλείνουν: για έλεγχο', v.tier === 'review' && v.reasons.includes('amounts'))
}

// ── 8. ΑΠΟΡΡΙΨΗ ΧΩΡΙΣ ΑΠΟΘΗΚΕΥΣΗ ──────────────────────────────────────────────
{
  const rules = { notProperty: new Set([UNKNOWN_AFM]) }
  const v = classifyDoc(doc({ counterpartAfm: UNKNOWN_AFM }), null, rules)
  ok('8: εκδότης της λίστας «δεν αφορά ακίνητα»: απόρριψη', v.tier === 'reject')
  ok('8: η απόρριψη δεν κρατά κατηγορία ούτε λόγο', v.category === null && same(v.reasons, []))
  ok('8: η απόρριψη υπερισχύει του πιστωτικού', classifyDoc(doc({ counterpartAfm: UNKNOWN_AFM, credit: true, docType: '5.1' }), null, rules).tier === 'reject')
  ok('8: χωρίς κανόνες, η λίστα του αποθετηρίου', classifyDoc(doc({ counterpartAfm: UNKNOWN_AFM }), null).tier === 'review')
  ok('8: πάροχος του μητρώου δεν είναι ποτέ και στη λίστα άρνησης', PROVIDERS.every(p => !NOT_PROPERTY.some(n => n.afm === p.afm)))
}

// ── 9. ΣΕΙΡΑ ΚΑΙ ΣΤΑΘΕΡΟΤΗΤΑ ΤΩΝ ΛΟΓΩΝ ─────────────────────────────────────────
{
  const v = classifyDoc(doc({ docType: '5.1', credit: true, grossCents: BANK_PAYMENT_LIMIT_CENTS + 100 }), null)
  ok('9: πολλοί λόγοι μαζί, χωρίς διπλά', new Set(v.reasons).size === v.reasons.length && v.reasons.length >= 3)
  ok('9: ίδια είσοδος, ίδια απάντηση', same(classifyDoc(doc(), seen), classifyDoc(doc(), seen)))
}

console.log(`mydata classify: ${pass} ✓ · ${fail} ✗`)
if (fail) process.exit(1)
