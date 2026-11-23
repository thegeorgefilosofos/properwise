// npx tsx lib/accountant/ask.test.ts
//
// «ΖΗΤΗΣΕ ΟΛΑ» ΑΝΑ ΠΕΛΑΤΗ (Μ18, αξιολόγηση 23/11/2026). Ο λογιστής έστελνε τρία
// χωριστά μηνύματα για τρία πράγματα που λείπουν από τον ίδιο πελάτη. Τώρα
// στέλνει ένα, που τα λέει όλα με τις φράσεις του `askPhrase`.
import { askText, askSubjectMany } from './ask'

let pass = 0, fail = 0
const eq = (n: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++
  else { fail++; console.error(`✗ ${n}: πήρα ${JSON.stringify(got)}, ήθελα ${JSON.stringify(want)}`) }
}

const morning = new Date('2026-11-09T07:00:00Z')
const items = [
  { key: 'uncategorised', item: '3 δαπάνες χωρίς κατηγορία' },
  { key: 'owner_afm', item: 'Δεν έχει συμπληρώσει ΑΦΜ' },
  { key: 'aade_e2', item: 'Δεν έχει ανέβει το προσυμπληρωμένο Ε2' },
]
const t = askText({ items, year: 2026, now: morning })
eq('τρία σε μία πρόταση, χωρίς κόμμα πριν από το «και»', t.body.split('\n')[1],
  'για να κλείσουμε το Ε2 2026, σας παρακαλώ να βάλετε κατηγορία σε 3 δαπάνες, να συμπληρώσετε τον ΑΦΜ σας και να ανεβάσετε το προσυμπληρωμένο Ε2 από το Taxisnet.')
eq('θέμα με το πλήθος', t.subject, 'Ε2 2026: 3 στοιχεία που λείπουν')
eq('δύο: μόνο «και»', askText({ items: items.slice(0, 2), year: 2026, now: morning }).body.split('\n')[1],
  'για να κλείσουμε το Ε2 2026, σας παρακαλώ να βάλετε κατηγορία σε 3 δαπάνες και να συμπληρώσετε τον ΑΦΜ σας.')
eq('ένα στη λίστα: ίδιο με το μονό αίτημα', askText({ items: items.slice(0, 1), year: 2026, now: morning }),
  askText({ key: items[0].key, item: items[0].item, year: 2026, now: morning }))
eq('θέμα για ένα: η γραμμή της λίστας', askSubjectMany(2026, items.slice(0, 1)), 'Ε2 2026: 3 δαπάνες χωρίς κατηγορία')

console.log(`ask: ${pass} πέρασαν, ${fail} απέτυχαν`)
if (fail) process.exit(1)
