// npx tsx lib/market/housingLines.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// Η ΤΙΜΗ ΤΗΣ F ΔΕΝ ΛΕΓΕΤΑΙ ΜΕΣΟΣ ΟΡΟΣ, ΟΥΤΕ ΑΠΟ ΤΗ ΝΟΑ ΟΥΤΕ ΑΠΟ ΤΗΝ ΚΑΡΤΕΛΑ
// ─────────────────────────────────────────────────────────────────────────
// Η ΓΡΑΜΜΗ ΤΗΣ ΠΑΡΑΓΩΓΗΣ 18/10/2026 08:00 UTC: κάτω από το `bog_housing_new`
// η σειρά MIR.M.GR.B.A2C.F (κυμαινόμενο ή σταθερό έως 1 έτος), 3,39, Αύγουστος
// 2026· καμία `bog_housing_floating` ή `bog_housing_fixed`. Η δημόσια σελίδα την
// απέρριπτε. Η Νόα έλεγε «Μέσο επιτόκιο νέου στεγαστικού δανείου… περίπου
// 3,39%» και η λωρίδα της καρτέλας Δάνειο «ΤτΕ μέσο 3,39%», διαβάζοντας τη
// στήλη. Και η εφεδρεία του useMarketData κρατούσε το ίδιο 3,39 της F.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { housingLines } from '@/lib/market/housingLines'
import { ECB_SERIES, seriesPage, type MarketKey, type Provenance, type RateProvenance } from '@/lib/market/ecb'

let pass = 0; const fail: string[] = []
const eq = (what: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; return }
  fail.push(`${what}\n    περίμενα: ${JSON.stringify(want)}\n    πήρα:     ${JSON.stringify(got)}`)
}
const code = (f: string): string => readFileSync(f, 'utf8').replace(/^\s*\/\/.*$/gm, '')

const page = (key: MarketKey): string => seriesPage(ECB_SERIES.find(s => s.key === key)!.candidates[0])
const at = (key: MarketKey, value: number, asOf = '2026-08-01', url = page(key)): RateProvenance => ({
  value, asOf, url, source: 'ΕΚΤ, στοιχεία Τράπεζας της Ελλάδος', basis: 'νέες χορηγήσεις', fetchedAt: '2026-10-18T08:00:01.894Z',
})
const F = 'https://data.ecb.europa.eu/data/datasets/MIR/MIR.M.GR.B.A2C.F.R.A.2250.EUR.N'

// ── 1. Η ΠΑΡΑΓΩΓΗ ΤΗΣ 18/10: ΚΑΝΕΝΑ ΝΟΥΜΕΡΟ ΣΤΕΓΑΣΤΙΚΟΥ ───────────────────
const prod: Provenance = { bog_housing_new: at('bog_housing_new', 3.39, '2026-08-01', F), bog_housing_stock: at('bog_housing_stock', 2.9) }
eq('η F κάτω από το όνομα του μέσου όρου δεν δίνεται στη Νόα', housingLines(prod, '2026-10-19'), [])
eq('χωρίς ταυτότητα, καμία γραμμή', housingLines(null, '2026-10-19'), [])

// ── 2. ΟΙ ΤΡΕΙΣ ΣΕΙΡΕΣ ΤΟΥ ΚΑΤΑΛΟΓΟΥ, ΜΕ ΤΙΣ ΕΤΙΚΕΤΕΣ ΤΟΥΣ ────────────────
const three: Provenance = {
  bog_housing_new: at('bog_housing_new', 3.21),
  bog_housing_floating: at('bog_housing_floating', 3.39),
  bog_housing_fixed: at('bog_housing_fixed', 3.05),
}
const lines = housingLines(three, '2026-10-19')
eq('μία γραμμή ανά σειρά', lines.length, 3)
eq('ο μέσος όρος με την ετικέτα του καταλόγου, τον μήνα και την πηγή', lines[0],
  'Μέσο επιτόκιο νέων στεγαστικών στην Ελλάδα: 3,21% (Αύγουστος 2026, νέες χορηγήσεις, πηγή ΕΚΤ, στοιχεία Τράπεζας της Ελλάδος).')
eq('το κυμαινόμενο λέγεται κυμαινόμενο', lines[1].startsWith('Νέα στεγαστικά στην Ελλάδα, κυμαινόμενο ή σταθερό έως 1 έτος: 3,39%'), true)
eq('το σταθερό λέγεται σταθερό', lines[2].startsWith('Νέα στεγαστικά στην Ελλάδα, σταθερό πάνω από 1 έτος: 3,05%'), true)
eq('η F στη δική της θέση, ενώ το bog_housing_new έχει την F: μόνο η σωστή γραμμή',
  housingLines({ ...prod, bog_housing_floating: at('bog_housing_floating', 3.39) }, '2026-10-19').map(l => l.split(':')[0]),
  ['Νέα στεγαστικά στην Ελλάδα, κυμαινόμενο ή σταθερό έως 1 έτος'])
eq('παλιά τιμή το λέει', housingLines({ bog_housing_new: at('bog_housing_new', 3.21, '2026-01-01') }, '2026-10-19')[0]
  .endsWith(', η πηγή δεν έχει δώσει νεότερη τιμή).'), true)

// ── 3. ΟΙ ΚΑΤΑΝΑΛΩΤΕΣ ΠΕΡΝΟΥΝ ΑΠΟ ΤΗΝ ΤΑΥΤΟΤΗΤΑ ───────────────────────────
// Η Νόα: η γραμμή της αγοράς βγαίνει από τη housingLines, όχι από τη στήλη.
const noa = code('app/dashboard/components/assistant/useAssistant.ts')
eq('η Νόα δεν διαβάζει τη στήλη bog_housing_new', /\brates\??\.bog_housing_new\b/.test(noa), false)
eq('η Νόα παίρνει τα στεγαστικά από τη housingLines', /housingLines\(/.test(noa), true)
// Η καρτέλα Δάνειο: η λωρίδα «ΤτΕ μέσο» δείχνει ό,τι δίνει το useMarketData.
const hook = code('app/hooks/useMarketData.ts')
eq('η εφεδρεία δεν κρατά αριθμό για το bog_housing_new', /bog_housing_new:\s*\d/.test(hook), false)
eq('η τιμή της βάσης περνά από τη σειρά του καταλόγου',
  /bog_housing_new:\s*catalogEntry\(provenance, 'bog_housing_new'\)/.test(hook), true)
eq('και δεν πέφτει πίσω στη στήλη', /row\.bog_housing_new/.test(hook), false)

if (fail.length) { console.error(`\n✗ στεγαστικά της Νόας: ${fail.length} αποτυχίες\n`); for (const f of fail) console.error('  ' + f); process.exit(1) }
console.log(`✓ στεγαστικά της Νόας: ${pass} έλεγχοι πέρασαν`)
