// npx tsx lib/accounting/strSpecs.test.ts
//
// Ο ΚΑΤΑΛΟΓΟΣ ΤΗΣ ΒΡΑΧΥΧΡΟΝΙΑΣ ΚΑΙ ΤΟ ΠΡΟΤΥΠΟ ΠΟΥ ΤΟΝ ΚΟΥΒΑΛΑ. Κρίνονται πέντε:
// ότι κανένας αριθμός ή νόμος δεν φτάνει στην οθόνη γραμμένος με το χέρι, ότι
// μόνο τα έγγραφα κουβαλούν σημείωση λήξης, ότι κάθε περίπτωση του άρθρου 3
// ν.5170/2025 έχει γραμμή, ότι το πρότυπο είναι ΑΚΡΙΒΩΣ ο κατάλογος, ότι η
// εργασία, η περίληψη και η Νόα λένε κάθε γραμμή του και ότι ο δημόσιος οδηγός
// δίνει στον ίδιο κατάλογο την ίδια βάση. Η πρώτη εκδοχή είχε εννέα γραμμές και
// της έλειπαν τέσσερις υποχρεώσεις του άρθρου. Ως τις 09/10/2026 ο οδηγός
// έγραφε όλες τις περιπτώσεις α΄ έως δ΄ αλλά χρέωνε μόνο τέσσερα στοιχεία στο
// άρθρο 3 από 01/10/2025 και τα υπόλοιπα στον ν.5073/2023.
import { readFileSync } from 'node:fs'
import { STR_SPECS } from './strSpecs'
import { UPDATE_ACTIONS, REGULATORY_UPDATES_2026 } from './updates2026'
import { KNOWLEDGE_PACKS } from '@/app/dashboard/components/assistantPersona'
import { TEMPLATES } from '@/app/dashboard/components/checklist/model'
import type { FieldContext } from '@/lib/property/fields'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }

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
// Οι περιπτώσεις (α) έως (δ) του άρθρου 3 ν.5170/2025, μία γραμμή για καθεμία
// υποχρέωση. Αν λείψει έστω μία, η λίστα λέει «εντάξει» σε όποιον δεν είναι.
const ARTICLE_3: Record<string, string[]> = {
  'α': ['main_use', 'natural_light', 'ventilation', 'air_conditioning'],
  'β': ['insurance'],
  'γ': ['electrician', 'extinguisher', 'smoke_detector', 'rcd_relay', 'escape_signage'],
  'δ': ['pest_control', 'first_aid', 'emergency_phones'],
}
for (const [letter, ids] of Object.entries(ARTICLE_3)) {
  const missing = ids.filter(id => !STR_SPECS.some(s => s.id === id))
  ok(`περίπτωση (${letter}) του άρθρου 3: λείπουν ${missing.join(', ') || 'κανένα'}`, missing.length === 0)
}
ok('καμία γραμμή εκτός άρθρου 3', STR_SPECS.every(s => Object.values(ARTICLE_3).some(ids => ids.includes(s.id))))

// ΤΑ ΚΕΙΜΕΝΑ ΠΟΥ ΛΕΝΕ ΤΟΝ ΚΑΤΑΛΟΓΟ, ΟΧΙ ΜΟΝΟ ΤΟ ΠΡΟΤΥΠΟ. Η σημείωση της εργασίας
// που φτιάχνεται μόνη της για κάθε ακίνητο βραχυχρόνιας (UPDATE_ACTIONS, μέσω
// του obligationTasks.ts), η περίληψη του ίδιου κανόνα και η γνώση της Νόας
// έλεγαν ακόμη τον παλιό κατάλογο: χωρίς κλιματισμό, ρελέ διαρροής, οδηγό
// τηλεφώνων και χώρους κύριας χρήσης. Κάθε υποχρέωση του άρθρου 3 πρέπει να
// είναι σε καθένα από τα τρία, με τη διατύπωση της ετικέτας της.
{
  const low = (t: string) => t.toLocaleLowerCase('el')
  const tax = KNOWLEDGE_PACKS.tax
  const at = tax.indexOf('ΠΡΟΔΙΑΓΡΑΦΕΣ ΒΡΑΧΥΧΡΟΝΙΑΣ:')
  const texts: [string, string][] = [
    ['η σημείωση της εργασίας', UPDATE_ACTIONS['str-technical-specs']?.cost ?? ''],
    ['η περίληψη του κανόνα', REGULATORY_UPDATES_2026.find(u => u.id === 'str-technical-specs')?.summary ?? ''],
    ['η γνώση της Νόας', at < 0 ? '' : tax.slice(at, tax.indexOf('\n', at))],
  ]
  for (const [where, text] of texts) {
    ok(`${where}: βρέθηκε`, text.length > 0)
    const missing = Object.values(ARTICLE_3).flat()
      .map(id => STR_SPECS.find(s => s.id === id)?.label ?? id)
      .filter(label => !low(text).includes(low(label)))
    ok(`${where}: λείπουν ${missing.join(', ') || 'κανένα'}`, missing.length === 0)
  }
}

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

// ── Ο δημόσιος οδηγός: ίδια βάση για όλο τον κατάλογο ─────────────────────
// Η σελίδα δεν εξάγει τις πηγές της (το page.tsx του Next δέχεται μόνο
// συγκεκριμένα exports), οπότε διαβάζεται ως κείμενο.
{
  const page = readFileSync('app/odigos/vraxyxronia-ama-prodiagrafes-2026/page.tsx', 'utf8')
  const from = page.indexOf('const SOURCES')
  const sources = [...page.slice(from, page.indexOf('];', from)).matchAll(/^\s*['`](.*)['`],\s*$/gm)].map(m => m[1])
  const specs = sources.filter(x => /^Προδιαγραφ/.test(x))
  ok('ο οδηγός έχει μία πηγή για τις προδιαγραφές', specs.length === 1)
  const src = specs[0] ?? ''
  ok('η πηγή των προδιαγραφών είναι το άρθρο 3 ν.5170/2025, περιπτώσεις α΄ έως δ΄, από 01/10/2025',
    src.includes('άρθρο 3 ν.5170/2025') && src.includes('α΄ έως δ΄') && src.includes('01/10/2025'))
  ok('η πηγή των προδιαγραφών δεν τις χρεώνει στον ν.5073/2023', !src.includes('5073/2023'))
  ok('οι πηγές του οδηγού γράφουν την εγκύκλιο 19567/25.09.2025', sources.some(x => x.includes('19567/25.09.2025')))
  const body = page.slice(page.indexOf('<H2 {...S.specs} />'), page.indexOf('<H2 {...S.fines} />'))
  ok('το κείμενο δίνει την ημερομηνία ισχύος σε όλες τις περιπτώσεις α΄ έως δ΄',
    body.includes('01/10/2025') && body.includes('α΄ έως δ΄'))
  ok('το κείμενο δεν τοποθετεί την αρχή των προδιαγραφών στο 2026', !/Το 2026 κάθε ακίνητο/.test(body))
}

console.log(`${fail ? '✗' : '✓'} προδιαγραφές βραχυχρόνιας: ${pass} περνούν${fail ? `, ${fail} αποτυγχάνουν` : ''}`)
if (fail) process.exit(1)
