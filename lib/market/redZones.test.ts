// npx tsx lib/market/redZones.test.ts
//
// Η ΑΝΑΣΤΟΛΗ ΣΤΗ ΘΕΣΣΑΛΟΝΙΚΗ ΛΕΓΕΤΑΙ ΙΔΙΑ ΣΤΗΝ ΕΦΑΡΜΟΓΗ ΚΑΙ ΣΤΟΥΣ ΟΔΗΓΟΥΣ.
// Ως τις 07/10/2026 τα δεδομένα αγοράς έλεγαν ότι το μέτρο «δεν είχε πηγή» και
// καλούσαν τον αναγνώστη να ελέγξει, ενώ οι δύο οδηγοί και το updates2026.ts το
// έγραφαν ως νόμο (ν.5313/2026). Ο έλεγχος κρατά μία πηγή, `THESS_STR_FREEZE`:
// τα δεδομένα αγοράς και οι οδηγοί τη διαβάζουν, το updates2026.ts λέει το ίδιο.
import { readFileSync } from 'node:fs'
import { grDate } from '../core/format'
import { REGIONS, SHORT_TERM, THESS_STR_FREEZE as THESS } from './greekMarket'
import { REGULATORY_UPDATES_2026 } from '../accounting/updates2026'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }

const FROM = grDate(THESS.from), TO = grDate(THESS.to)
const says = (text: string | undefined) =>
  !!text && text.includes(THESS.area) && text.includes(FROM) && text.includes(TO) && text.includes(THESS.law)

// ── Η πηγή ───────────────────────────────────────────────────────────────
ok('η πηγή: παρ. 2Β του άρθρου 111 ν.4446/2016', THESS.provision === 'άρθρο 111 παρ. 2Β ν.4446/2016')
ok('η πηγή: ν.5313/2026, ΦΕΚ Α΄ 102/25.06.2026', THESS.law === 'ν.5313/2026' && THESS.fek === 'ΦΕΚ Α΄ 102/25.06.2026')
ok('η πηγή: το άρθρο που πρόσθεσε την παράγραφο', THESS.addedBy === `άρθρο ${THESS.article} ${THESS.law}`)
ok('το διάστημα είναι έγκυρο (από < έως)', THESS.from < THESS.to)

// ── Τα δεδομένα αγοράς: η προειδοποίηση του ROI και της περιοχής ────────────
const st = SHORT_TERM.find(s => s.key === 'thess')
ok('βραχυχρόνια Θεσσαλονίκης: κόκκινη ζώνη', st?.redZone === true)
ok('βραχυχρόνια Θεσσαλονίκης: η σημείωση λέει περιοχή, ημερομηνίες και νόμο', says(st?.note))
ok('βραχυχρόνια Θεσσαλονίκης: η σημείωση δεν ζητά πια «αν ισχύει»', !/αν ισχύει/.test(st?.note ?? ''))
const region = REGIONS.find(r => r.key === 'thess_center')
ok('κέντρο Θεσσαλονίκης: η σημείωση περιοχής λέει το ίδιο', says(region?.note))
ok('κέντρο Θεσσαλονίκης: χωρίς «έλεγξε αν ισχύει»', !/αν ισχύει/.test(region?.note ?? ''))
// Η Αθήνα μένει όπως ήταν· καμία άλλη περιοχή δεν σημαδεύτηκε κατά λάθος.
ok('κόκκινες ζώνες: μόνο κέντρο Αθήνας και Θεσσαλονίκη',
  SHORT_TERM.filter(s => s.redZone).map(s => s.key).sort().join(',') === 'ath_center,thess')

// ── Ο κανόνας της εφαρμογής (updates2026.ts) λέει το ίδιο ────────────────────
const rule = REGULATORY_UPDATES_2026.find(u => u.id === 'ama-red-zones')
ok('updates2026: ο κανόνας υπάρχει', !!rule)
ok('updates2026: η περίληψη λέει περιοχή και ημερομηνίες της σταθεράς',
  !!rule && rule.summary.includes(THESS.area) && rule.summary.includes(FROM) && rule.summary.includes(TO))
ok('updates2026: η νομική βάση λέει τον νόμο και την παρ. 2Β',
  !!rule && rule.legalBasis.includes(THESS.law) && rule.legalBasis.includes('2Β'))

// ── Οι οδηγοί διαβάζουν τη σταθερά, δεν την ξαναγράφουν ─────────────────────
const GUIDES = [
  'app/odigos/vraxyxronia-ama-prodiagrafes-2026/page.tsx',
  'app/odigos/airbnb-takk-2026/page.tsx',
]
for (const f of GUIDES) {
  const src = readFileSync(f, 'utf8')
  // Σχόλια έξω: εκεί η ιστορία του μέτρου γράφεται με λέξεις και ημερομηνίες.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  ok(`${f}: εισάγει το THESS_STR_FREEZE`, /THESS_STR_FREEZE/.test(code) && /from '@\/lib\/market\/greekMarket'/.test(code))
  ok(`${f}: η περιοχή δεν γράφεται με το χέρι`, !code.includes('Δημοτική Κοινότητα Θεσσαλονίκης') && !code.includes('Δημοτικής Κοινότητας Θεσσαλονίκης'))
  ok(`${f}: η έναρξη ${FROM} δεν γράφεται με το χέρι`, !code.includes(FROM))
}

console.log(fail ? `✗ redZones: ${fail} απέτυχαν, ${pass} πέρασαν` : `✓ redZones: ${pass} έλεγχοι πέρασαν`)
if (fail) process.exit(1)
