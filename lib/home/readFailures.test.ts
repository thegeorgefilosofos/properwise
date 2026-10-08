// npx tsx lib/home/readFailures.test.ts
//
// Η Επισκόπηση έγραφε «0€» όταν μια ανάγνωση έπεφτε. Αυτό το αρχείο κρατά την
// απόφαση ειλικρινή: ποια περιοχή λείπει και πότε κρύβονται τα σύνολα.
import { readFileSync } from 'node:fs'
import {
  readFailures, moneyIncomplete, failedSentence, MONEY_AREAS,
  trustedStep, trustedInsight, trustedObligation, INSIGHT_SOURCES, LEASE_DECL_AREA, TAX_DEADLINES_AREA,
} from './readFailures'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }

const err = { message: 'fetch failed' }

// ── ΤΙ ΑΠΕΤΥΧΕ ─────────────────────────────────────────────────────────────
ok('καμία αποτυχία, κενή λίστα', readFailures([['Δαπάνες', null], ['Ενοίκια', undefined]]).length === 0)
{
  const f = readFailures([['Ενοίκια', err], ['Δαπάνες', null], ['Ενοίκια', err], ['Εξοπλισμός', err]])
  ok('κάθε περιοχή μία φορά', f.filter(a => a === 'Ενοίκια').length === 1)
  ok('με τη σειρά που δόθηκαν', f.join('|') === 'Ενοίκια|Εξοπλισμός')
  ok('η επιτυχημένη δεν μετρά', !f.includes('Δαπάνες'))
}

// ── ΠΟΤΕ ΚΡΥΒΟΝΤΑΙ ΤΑ ΣΥΝΟΛΑ ──────────────────────────────────────────────
ok('χωρίς αποτυχία τα ποσά μένουν', !moneyIncomplete([]))
ok('τα ενοίκια κρατούν λεφτά', moneyIncomplete(['Ενοίκια']))
ok('οι εκκρεμότητες μόνες τους δεν κρύβουν ποσά', !moneyIncomplete(['Εκκρεμότητες', 'Εξοπλισμός']))
ok('μία περιοχή με ποσά αρκεί', moneyIncomplete(['Εξοπλισμός', 'Δάνεια']))
ok('κάθε περιοχή με ποσά κρύβει τα σύνολα', MONEY_AREAS.every(a => moneyIncomplete([a])))

// ── Η ΠΡΟΤΑΣΗ ──────────────────────────────────────────────────────────────
ok('τίποτα, καμία πρόταση', failedSentence([]) === '')
ok('μία περιοχή', failedSentence(['Ενοίκια']) === 'Δεν φορτώθηκαν: Ενοίκια.')
ok('δύο, με «και»', failedSentence(['Ενοίκια', 'Δάνεια']) === 'Δεν φορτώθηκαν: Ενοίκια και Δάνεια.')
ok('τρεις, χωρίς κόμμα πριν από το «και»',
   failedSentence(['Δαπάνες', 'Ενοίκια', 'Δάνεια']) === 'Δεν φορτώθηκαν: Δαπάνες, Ενοίκια και Δάνεια.')

// ── ΕΚΚΡΕΜΟΤΗΤΕΣ ΑΠΟ ΑΠΟΥΣΙΑ ──────────────────────────────────────────────
ok('χωρίς αποτυχία κάθε βήμα λέγεται', trustedStep('tenant', []) && trustedStep('άγνωστο', []))
ok('οι ενοικιαστές δεν διαβάστηκαν, δεν λέμε «Πρόσθεσε ενοικιαστή»', !trustedStep('tenant', ['Ενοικιαστές']))
ok('ούτε «Συμπλήρωσε αξία και ενοίκιο»', !trustedStep('details', ['Ενοικιαστές']))
ok('άλλη περιοχή δεν κρύβει το βήμα', trustedStep('inv', ['Ενοικιαστές']))
ok('άγνωστο βήμα, με αποτυχία, δεν λέγεται', !trustedStep('νέο-βήμα', ['Εξοπλισμός']))

ok('οι δαπάνες δεν διαβάστηκαν, όχι «Ξεκίνα με μία φωτογραφία»', !trustedInsight('no-expenses', ['Δαπάνες']))
ok('η ασφάλεια ζει στο ακίνητο, λέγεται πάντα', trustedInsight('insurance-soon', ['Δαπάνες', 'Ενοίκια']))
ok('η απόδοση θέλει όλα τα ποσά', !trustedInsight('yield-low', ['Διαμονές']))
ok('το «κενό ακίνητο» θέλει ενοικιαστές', !trustedInsight('vacant', ['Ενοικιαστές']))

ok('η δήλωση μίσθωσης δεν διαβάστηκε, δεν ξαναζητείται',
   !trustedObligation({ id: 'lease_decl', category: 'contract' }, [LEASE_DECL_AREA]))
ok('πληρωμένη δόση ΕΝΦΙΑ δεν ξαναγίνεται οφειλή',
   !trustedObligation({ id: 'enfia_3', category: 'tax' }, [TAX_DEADLINES_AREA]))
ok('η λήξη μίσθωσης βγαίνει από παρουσία, μένει',
   trustedObligation({ id: 'lease_end', category: 'contract' }, [LEASE_DECL_AREA, TAX_DEADLINES_AREA]))
ok('οι φορολογικές μένουν όταν απέτυχε άλλη περιοχή',
   trustedObligation({ id: 'enfia_3', category: 'tax' }, ['Εξοπλισμός']))

// Κάθε παρατήρηση της μηχανής έχει δηλωμένες πηγές. Χωρίς αυτό, νέα παρατήρηση
// θα κρυβόταν σε κάθε αποτυχία, χωρίς να ξέρει κανείς ότι γίνεται.
{
  const src = readFileSync('lib/insights/engine.ts', 'utf8')
  const ids = [...new Set([...src.matchAll(/\bid:\s*'([a-z-]+)'/g)].map(m => m[1]))]
  const missing = ids.filter(id => !(id in INSIGHT_SOURCES))
  ok(`κάθε παρατήρηση του engine.ts έχει πηγές (λείπουν: ${missing.join(', ') || 'καμία'})`, ids.length > 10 && missing.length === 0)
}

console.log(fail === 0 ? `✓ readFailures: ${pass} έλεγχοι πέρασαν` : `✗ readFailures: ${fail} απέτυχαν από ${pass + fail}`)
if (fail > 0) process.exit(1)
