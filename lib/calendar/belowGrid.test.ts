// npx tsx lib/calendar/belowGrid.test.ts
//
// ΜΙΑ ΛΙΣΤΑ ΚΑΤΩ ΑΠΟ ΤΟ ΠΛΕΓΜΑ (Υ8, αξιολόγηση 23/11/2026). Το ίδιο γεγονός
// φαινόταν τρεις φορές στην ίδια οθόνη: στο πλέγμα, στο «Επόμενα από σήμερα»
// και στα «Γεγονότα». Τώρα μένει μία λίστα: της ημέρας που διάλεξε ο χρήστης,
// αλλιώς του μήνα.
import { belowGrid } from './belowGrid'

let pass = 0, fail = 0
const eq = (n: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++
  else { fail++; console.error(`✗ ${n}: πήρα ${JSON.stringify(got)}, ήθελα ${JSON.stringify(want)}`) }
}

const ev = (id: string, event_date: string) => ({ id, event_date })
const NOV = [ev('a', '2026-11-03'), ev('b', '2026-11-25'), ev('c', '2026-11-25')]

eq('χωρίς επιλογή: όλος ο μήνας', belowGrid(NOV, null, '2026-11'), { day: null, events: NOV })
eq('με ημέρα: μόνο εκείνη', belowGrid(NOV, '2026-11-25', '2026-11').events.map(e => e.id), ['b', 'c'])
eq('…και λέει ποια', belowGrid(NOV, '2026-11-25', '2026-11').day, '2026-11-25')
eq('άδεια ημέρα: άδεια λίστα, όχι ο μήνας', belowGrid(NOV, '2026-11-04', '2026-11'), { day: '2026-11-04', events: [] })
eq('ημέρα άλλου μήνα: ο μήνας που φαίνεται', belowGrid(NOV, '2026-10-25', '2026-11'), { day: null, events: NOV })
eq('ίδιο πρόθεμα, άλλος μήνας (2026-1 ≠ 2026-11)', belowGrid(NOV, '2026-11-03', '2026-1').day, null)

console.log(`belowGrid: ${pass} πέρασαν, ${fail} απέτυχαν`)
if (fail) process.exit(1)
