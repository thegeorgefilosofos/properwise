// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΔΟΣΕΙΣ ΤΟΥ ΟΔΗΓΟΥ ΠΛΗΡΩΜΗΣ ΣΥΜΦΩΝΟΥΝ ΜΕ ΤΟ ΗΜΕΡΟΛΟΓΙΟ
//
// Ο οδηγός δείχνει δώδεκα ημερομηνίες που δεν είναι γραμμένες πουθενά: τις
// χτίζει από την πρώτη και την τελευταία δόση του greekTaxCalendar.ts. Εδώ
// ελέγχεται ότι οι άκρες είναι ακριβώς εκείνες, ότι κάθε δόση πέφτει σε
// εργάσιμη στον δικό της μήνα και ότι η πηγή του εκκαθαριστικού διαβάζεται.
//
// Τρέξε: npx tsx app/odigos/enfia-2026-pliromi-doseis-pistopoiitiko/schedule.test.ts
// ═══════════════════════════════════════════════════════════════════════════
import { enfiaInstalments, enfiaIssueBasis, instalmentStatus, obligationOf } from './schedule'
import { isNonWorkingDay } from '@/lib/calendar/greekHolidays'

let passed = 0, failed = 0
const fails: string[] = []
const ok = (name: string, cond: boolean) => { if (cond) passed++; else { failed++; fails.push(name) } }

for (const year of [2026, 2027, 2028]) {
  const dates = enfiaInstalments(year)
  ok(`${year}: η πρώτη είναι η 1η δόση του ημερολογίου`, dates[0] === obligationOf(year, 'enfia-first').date)
  ok(`${year}: η τελευταία είναι η τελευταία δόση του ημερολογίου`, dates.at(-1) === obligationOf(year, 'enfia-last').date)
  ok(`${year}: δώδεκα δόσεις`, dates.length === 12)
  ok(`${year}: όλες σε εργάσιμη`, dates.every(d => !isNonWorkingDay(d)))
  ok(`${year}: μία δόση ανά μήνα, με τη σειρά`, dates.every((d, i) => i === 0 || d.slice(0, 7) > dates[i - 1].slice(0, 7)))
}

// ΕΝΦΙΑ 2026: εκδόθηκε, άρα η πηγή υπάρχει και οι ημερομηνίες είναι του νόμου.
const basis = enfiaIssueBasis(2026)
ok('2026: η απόφαση του εκκαθαριστικού διαβάζεται', !!basis && basis.decision.includes('Α.1061/13-03-2026'))
ok('2026: ο νόμος των προθεσμιών διαβάζεται', !!basis && basis.law === 'ν. 4223/2013, άρθρο 6')
ok('2026: ημερομηνίες του νόμου', obligationOf(2026, 'enfia-first').confidence === 'statutory')
ok('2026: πρώτη δόση 31.3.2026', enfiaInstalments(2026)[0] === '2026-03-31')
ok('2026: τελευταία δόση 26.2.2027', enfiaInstalments(2026).at(-1) === '2027-02-26')

// Το επόμενο έτος δεν έχει εκδοθεί: καμία πηγή, καμία εφεύρεση.
ok('2027: χωρίς πηγή πριν από την έκδοση', enfiaIssueBasis(2027) === null)

// Πού βρίσκεται ο αναγνώστης.
const d26 = enfiaInstalments(2026)
ok('πριν από την πρώτη: όλες μένουν', instalmentStatus(d26, '2026-03-01').left === 12)
ok('την ημέρα της δόσης μετρά ακόμη', instalmentStatus(d26, '2026-03-31').next === '2026-03-31')
ok('3.10.2026: μένουν πέντε, επόμενη 30.10', instalmentStatus(d26, '2026-10-03').left === 5 && instalmentStatus(d26, '2026-10-03').next === '2026-10-30')
ok('μετά την τελευταία: καμία', instalmentStatus(d26, '2027-03-01').left === 0 && instalmentStatus(d26, '2027-03-01').next === null)

console.log(`schedule (ΕΝΦΙΑ δόσεις): ${passed} ✓ · ${failed} ✗`)
if (failed) { for (const f of fails) console.log('  ✗ ' + f); process.exit(1) }
