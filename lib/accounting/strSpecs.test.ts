// npx tsx lib/accounting/strSpecs.test.ts
//
// Ο ΚΑΤΑΛΟΓΟΣ ΤΗΣ ΒΡΑΧΥΧΡΟΝΙΑΣ ΚΑΙ ΤΟ ΠΡΟΤΥΠΟ ΠΟΥ ΤΟΝ ΚΟΥΒΑΛΑ. Κρίνονται τρία:
// ότι κανένας αριθμός ή νόμος δεν φτάνει στην οθόνη γραμμένος με το χέρι, ότι
// μόνο τα έγγραφα κουβαλούν σημείωση λήξης και ότι το πρότυπο είναι ΑΚΡΙΒΩΣ ο
// κατάλογος. Το «εννέα» στηρίζεται σε δευτερογενείς πηγές: αν η εγκύκλιος πει
// άλλα, αλλάζουν μαζί ο κατάλογος και αυτή η δοκιμή.
import { STR_SPECS } from './strSpecs'
import { TEMPLATES } from '@/app/dashboard/components/checklist/model'
import type { FieldContext } from '@/lib/property/fields'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }

ok('εννέα στοιχεία', STR_SPECS.length === 9)
ok('μοναδικά αναγνωριστικά', new Set(STR_SPECS.map(s => s.id)).size === STR_SPECS.length)
const texts = STR_SPECS.flatMap(s => [s.label, s.note ?? ''])
ok('κανένα ψηφίο ή € σε ετικέτα ή σημείωση', texts.every(t => !/[0-9€]/.test(t)))
// Χωρίς `\b`: το όριο λέξης της JavaScript είναι ASCII και δεν ταιριάζει ποτέ πριν από ελληνικό γράμμα.
ok('κανένα κόμμα πριν από «και»', texts.every(t => !/,\s*και(?![\p{L}])/u.test(t)))
const docs = STR_SPECS.filter(s => s.kind === 'document')
ok('σημείωση έχουν ακριβώς τα τρία έγγραφα',
  docs.length === 3 && STR_SPECS.filter(s => s.note).every(s => s.kind === 'document') && docs.every(s => !!s.note))
ok('η σημείωση λέει «αν γράφει λήξη», δεν την υποθέτει', docs.every(s => /^Αν το έγγραφο γράφει/.test(s.note ?? '')))
ok('ετήσιο μόνο το ασφαλιστήριο',
  STR_SPECS.filter(s => s.recurring === 'yearly').map(s => s.id).join() === 'insurance')
ok('τα τέσσερα του άρθρου 3 ν.5170/2025 είναι στον κατάλογο',
  ['extinguisher', 'smoke_detector', 'first_aid', 'escape_signage'].every(id => STR_SPECS.some(s => s.id === id)))

const tpl = TEMPLATES.str_specs
ok('υπάρχει το πρότυπο', !!tpl)
ok('το πρότυπο είναι ακριβώς ο κατάλογος, με τη σειρά του',
  JSON.stringify(tpl.items) === JSON.stringify(STR_SPECS.map(s => ({
    description: s.label, category: 'legal', priority: s.priority, recurring: s.recurring, ...(s.note ? { note: s.note } : {}),
  }))))
const ctx = (status: string) => ({ status } as unknown as FieldContext)
ok('φαίνεται μόνο στη βραχυχρόνια',
  !!tpl.when?.(ctx('rent_short')) && ['rent_long', 'vacant', 'renovation'].every(s => !tpl.when?.(ctx(s))))
ok('η ετικέτα δεν γράφει νόμο ούτε αριθμό', !/ν\.|[0-9]/.test(tpl.label))

console.log(`${fail ? '✗' : '✓'} προδιαγραφές βραχυχρόνιας: ${pass} περνούν${fail ? `, ${fail} αποτυγχάνουν` : ''}`)
if (fail) process.exit(1)
