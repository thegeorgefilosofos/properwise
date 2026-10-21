// npx tsx lib/calendar/noteParts.test.ts
import { noteParts, linkLabel } from './noteParts'
import { CONFIDENCE_HINT } from '@/lib/tax/greekTaxCalendar'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }

// Η σημείωση όπως τη βρήκε ο ιδιοκτήτης στο ημερολόγιο (21/10/2026).
const legacy = 'Μηνιαία απόδοση του τέλους για τις διανυκτερεύσεις του προηγούμενου μήνα. Δες στο φορολογικό ημερολόγιο (https://www.aade.gr/eforologiko-imerologio) και στο https://www.taxheaven.gr/calendar. '
  + `Ποιος το κάνει: Ο λογιστής. ${CONFIDENCE_HINT.statutory} Πού γίνεται: myAADE · Φορολογικές Υπηρεσίες · Τέλη και Ειδικοί Φόροι.`
const p = noteParts(legacy)
ok('καμία διεύθυνση στο κείμενο', !/https?:|www\./.test(p.summary))
ok('οι διευθύνσεις γίνονται σύνδεσμοι με όνομα', p.links.map(l => l.label).join(',') === 'ΑΑΔΕ,Taxheaven')
ok('ο σύνδεσμος κρατά τη διεύθυνση', p.links[1].href === 'https://www.taxheaven.gr/calendar')
ok('ποιος', p.who === 'Ο λογιστής')
ok('πού, σε βήματα', p.where.join('|') === 'myAADE|Φορολογικές Υπηρεσίες|Τέλη και Ειδικοί Φόροι')
ok('προθεσμία του νόμου', p.deadline === 'statutory')
ok('η περιγραφή μένει χωρίς σημάδια', p.summary === 'Μηνιαία απόδοση του τέλους για τις διανυκτερεύσεις του προηγούμενου μήνα.' && !p.summary.includes('Ποιος') && !p.summary.includes('Πού γίνεται'))
ok('καμία άδεια παρένθεση ή κρεμασμένη πρόθεση', !/\(\s*\)|\sστο\s*\.|\sκαι\s*\./.test(p.summary))

const a = noteParts(`Δήλωση. ${CONFIDENCE_HINT.announced}`)
ok('περυσινή ημερομηνία', a.deadline === 'announced' && a.summary === 'Δήλωση.')
ok('απλή σημείωση: ως έχει', noteParts('Αριθμός παροχής 123').summary === 'Αριθμός παροχής 123')
ok('κενό: κενό', noteParts(null).summary === '' && noteParts(null).links.length === 0)
ok('άγνωστος τόπος: το όνομα του τόπου', linkLabel('https://www.example.com/x') === 'example.com')
ok('myAADE', linkLabel('https://www.myaade.gov.gr') === 'myAADE')

console.log(fail === 0 ? `✓ noteParts: ${pass} έλεγχοι πέρασαν` : `✗ noteParts: ${fail} απέτυχαν από ${pass + fail}`)
if (fail > 0) process.exit(1)
