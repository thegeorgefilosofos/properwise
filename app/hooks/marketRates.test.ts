// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΕΠΙΤΟΚΙΑ ΤΗΣ ΕΚΤ ΔΕΝ ΓΡΑΦΟΝΤΑΙ «ΕΚΤΙΜΗΣΗ»
// ─────────────────────────────────────────────────────────────────────────
// Η ΟΘΟΝΗ ΤΗΣ 21/10/2026. Η λωρίδα της καρτέλας Δάνειο έγραφε «EURIBOR
// ΤΡΙΜΗΝΟΥ 2,64% εκτίμηση Σεπ 2026 · EURIBOR ΜΗΝΟΣ 2,41% εκτίμηση Σεπ 2026 ·
// ΕΚΤ, ΚΑΤΑΘΕΣΕΙΣ 2,50% εκτίμηση Σεπ 2026», χωρίς «ΤτΕ μέσο». Η γραμμή της
// βάσης ήταν πλήρης· στη λωρίδα είχε φτάσει η εφεδρεία, γιατί το hook έκανε
// κάθε αποτυχία ανάγνωσης εφεδρεία, σιωπηλά και μία φορά για όλη την καρτέλα,
// και η λωρίδα έλεγε την εφεδρεία «εκτίμηση».
//
// Τι καρφώνεται:
//   · η γραμμή της παραγωγής (21/10/2026 08:00 UTC) δίνει ζωντανά νούμερα με
//     ταυτότητα, «ΤτΕ μέσο» και λεζάντες χωρίς «εκτίμηση»·
//   · η εφεδρεία λέγεται «τελευταία γνωστή τιμή ΕΚΤ, Σεπ 2026», διακεκομμένη·
//   · το hook ξαναδοκιμάζει και αναφέρει την αποτυχία, δεν την καταπίνει.
//
// Τρέξε: npx tsx app/hooks/marketRates.test.ts
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { marketFromRow, rateNote, RATES_UNREAD, FALLBACK_NOTE, type LiveMarketRates } from './useMarketData'
import type { MarketRatesRow } from '@/lib/supabase/tables'
import type { MarketKey } from '@/lib/market/ecb'

let pass = 0; const fail: string[] = []
const eq = (what: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; return }
  fail.push(`${what}\n    περίμενα: ${JSON.stringify(want)}\n    πήρα:     ${JSON.stringify(got)}`)
}
const code = (f: string): string => readFileSync(f, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

const ECB = 'Ευρωπαϊκή Κεντρική Τράπεζα', BOG = 'ΕΚΤ, στοιχεία Τράπεζας της Ελλάδος'
const FETCHED = '2026-10-19T08:00:02.509Z'
const FM = (s: string) => `https://data.ecb.europa.eu/data/datasets/FM/FM.${s}`
const MIR = (s: string) => `https://data.ecb.europa.eu/data/datasets/MIR/MIR.M.GR.B.A2C.${s}.R.A.2250.EUR.N`
const ON_CHANGE = 'ισχύει από την τελευταία μεταβολή', MEAN = 'μέσος όρος μήνα', NEW = 'νέες χορηγήσεις'

// ── Η ΓΡΑΜΜΗ ΤΗΣ ΠΑΡΑΓΩΓΗΣ, ΟΠΩΣ ΤΗΝ ΕΠΙΣΤΡΕΦΕΙ Η ΒΑΣΗ (id 135) ─────────────
const prodRow: MarketRatesRow = {
  id: 135, ecb_dfl: 2.5, ecb_rate: 2.65, euribor_1m: 2.4143636, euribor_3m: 2.6350455,
  euribor_6m: 2.9215909, euribor_12m: 3.247, bog_housing_new: 3.3, bog_housing_stock: 2.9,
  source_bog: 'ΕΚΤ, νέες χορηγήσεις 01/08/2026', source_euribor: 'ΕΚΤ, μέσος όρος μήνα 01/09/2026',
  rate_changed: false, updated_at: '2026-10-21T08:00:04.1+00:00',
  provenance: {
    ecb_dfl: { url: FM('D.U2.EUR.4F.KR.DFR.LEV'), asOf: '2026-10-19', basis: ON_CHANGE, value: 2.5, source: ECB, fetchedAt: FETCHED },
    ecb_rate: { url: FM('D.U2.EUR.4F.KR.MRR_FR.LEV'), asOf: '2026-10-19', basis: ON_CHANGE, value: 2.65, source: ECB, fetchedAt: FETCHED },
    euribor_1m: { url: FM('M.U2.EUR.RT.MM.EURIBOR1MD_.HSTA'), asOf: '2026-09-01', basis: MEAN, value: 2.4143636, source: ECB, fetchedAt: FETCHED },
    euribor_3m: { url: FM('M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA'), asOf: '2026-09-01', basis: MEAN, value: 2.6350455, source: ECB, fetchedAt: FETCHED },
    euribor_6m: { url: FM('M.U2.EUR.RT.MM.EURIBOR6MD_.HSTA'), asOf: '2026-09-01', basis: MEAN, value: 2.9215909, source: ECB, fetchedAt: FETCHED },
    euribor_12m: { url: FM('M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA'), asOf: '2026-09-01', basis: MEAN, value: 3.247, source: ECB, fetchedAt: FETCHED },
    bog_housing_new: { url: MIR('A'), asOf: '2026-08-01', basis: NEW, value: 3.3, source: BOG, fetchedAt: FETCHED },
    bog_housing_stock: { url: MIR('I'), asOf: '2026-08-01', basis: NEW, value: 2.9, source: BOG, fetchedAt: FETCHED },
    bog_housing_floating: { url: MIR('F'), asOf: '2026-08-01', basis: NEW, value: 3.39, source: BOG, fetchedAt: FETCHED },
  },
}

// Τα κλειδιά της λωρίδας, με τη σειρά της (TabLoan.tsx): το «ΤτΕ μέσο» μπαίνει
// μόνο όταν υπάρχει `bog_housing_new`.
const strip = (m: LiveMarketRates): MarketKey[] =>
  ['euribor_3m', 'euribor_1m', 'ecb_dfl', ...(m.bog_housing_new ? ['bog_housing_new' as const] : [])] as MarketKey[]
const notes = (m: LiveMarketRates) => strip(m).map(k => rateNote(m, k)?.text ?? null)

// ── 1. Η ΓΡΑΜΜΗ ΤΗΣ ΠΑΡΑΓΩΓΗΣ ΦΤΑΝΕΙ ΖΩΝΤΑΝΗ ───────────────────────────────
const live = marketFromRow(prodRow, '2026-10-21')
eq('η γραμμή είναι ζωντανή', live.live, true)
eq('έτοιμη, όχι σε φόρτωση', live.isLoading, false)
eq('η ταυτότητα περνά ολόκληρη', Object.keys(live.provenance).length, 9)
eq('το ΤτΕ μέσο από τη σειρά A', live.bog_housing_new, 3.3)
eq('η σφραγίδα της γραμμής, όχι της εφεδρείας', live.updated_at, '2026-10-21T08:00:04.1+00:00')
eq('η λωρίδα έχει και το ΤτΕ μέσο', strip(live), ['euribor_3m', 'euribor_1m', 'ecb_dfl', 'bog_housing_new'])
eq('οι λεζάντες της λωρίδας', notes(live),
  ['μέσος όρος Σεπτεμβρίου', 'μέσος όρος Σεπτεμβρίου', '19/10/2026', '01/08/2026'])
eq('καμία λεζάντα δεν λέει «εκτίμηση»', notes(live).some(t => /εκτίμ/i.test(t ?? '')), false)
eq('καμία λεζάντα δεν λέει «τελευταία γνωστή»', notes(live).some(t => /τελευταία γνωστή/.test(t ?? '')), false)
eq('φρέσκες τιμές, χωρίς διακεκομμένη', strip(live).map(k => rateNote(live, k)?.dotted), [false, false, false, false])
eq('ο τίτλος λέει βάση και πηγή', rateNote(live, 'euribor_3m')?.title, `${MEAN}, ${ECB}`)

// Jsonb γραμμένο ως κείμενο: η ταυτότητα δεν χάνεται.
const asText = marketFromRow({ ...prodRow, provenance: JSON.stringify(prodRow.provenance) }, '2026-10-21')
eq('ταυτότητα ως κείμενο διαβάζεται', notes(asText), notes(live))

// Παλιά τιμή: η λεζάντα μένει η περίοδός της, με διακεκομμένη.
const late = marketFromRow(prodRow, '2026-12-20')
eq('παλιό Euribor υπογραμμίζεται', rateNote(late, 'euribor_3m')?.dotted, true)
eq('και πάλι όχι «εκτίμηση»', rateNote(late, 'euribor_3m')?.text, 'μέσος όρος Σεπτεμβρίου')

// Ζωντανή γραμμή χωρίς ταυτότητα για ένα κλειδί: τίποτα δίπλα του.
const bare = marketFromRow({ ...prodRow, provenance: null }, '2026-10-21')
eq('χωρίς ταυτότητα, καμία λεζάντα', notes(bare), [null, null, null])
eq('χωρίς ταυτότητα, ούτε ΤτΕ μέσο', bare.bog_housing_new, null)

// ── 2. Η ΕΦΕΔΡΕΙΑ ΛΕΓΕΤΑΙ ΜΕ ΤΟ ΟΝΟΜΑ ΤΗΣ ────────────────────────────────────
eq('η εφεδρεία δεν είναι ζωντανή', RATES_UNREAD.live, false)
eq('η λεζάντα της εφεδρείας', FALLBACK_NOTE, 'τελευταία γνωστή τιμή ΕΚΤ, Σεπ 2026')
eq('κάθε τιμή της εφεδρείας τη λέει', notes(RATES_UNREAD), [FALLBACK_NOTE, FALLBACK_NOTE, FALLBACK_NOTE])
eq('με διακεκομμένη υπογράμμιση', strip(RATES_UNREAD).map(k => rateNote(RATES_UNREAD, k)?.dotted), [true, true, true])
eq('ούτε η εφεδρεία λέει «εκτίμηση»', notes(RATES_UNREAD).some(t => /εκτίμ/i.test(t ?? '')), false)
eq('σε φόρτωση, καμία λεζάντα', rateNote({ ...RATES_UNREAD, isLoading: true }, 'euribor_3m'), null)

// ── 3. ΟΙ ΚΑΤΑΝΑΛΩΤΕΣ ───────────────────────────────────────────────────────
const tab = code('app/dashboard/components/TabLoan.tsx')
eq('η λωρίδα δεν γράφει «εκτίμηση» δίπλα σε επιτόκιο', /εκτίμηση\s*\{/.test(tab), false)
eq('η λωρίδα παίρνει τη λεζάντα από τη rateNote', /rateNote\(market,\s*item\.k\)/.test(tab), true)
const calc = code('app/dashboard/components/loan/calc/InputCards.tsx')
eq('ο υπολογιστής λέει την εφεδρεία με το ίδιο όνομα', /:\s*FALLBACK_NOTE\}/.test(calc), true)
const hook = code('app/hooks/useMarketData.ts')
const body = hook.slice(hook.indexOf('export function useMarketRates'), hook.indexOf('export function useMarketFeedHealth'))
eq('το hook ξαναδοκιμάζει', /READ_RETRIES_MS/.test(body), true)
eq('το hook αναφέρει την αποτυχία', /captureError\(/.test(body), true)
eq('καμία εξαίρεση δεν καταπίνεται σιωπηλά', /catch\s*\{\s*\n?\s*setData/.test(body), false)
eq('η εφεδρεία βγαίνει ως μη ζωντανή', /setData\(RATES_UNREAD\)/.test(body), true)

if (fail.length) { console.error(`\n✗ επιτόκια της λωρίδας: ${fail.length} αποτυχίες\n`); for (const f of fail) console.error('  ' + f); process.exit(1) }
console.log(`✓ επιτόκια της λωρίδας: ${pass} έλεγχοι πέρασαν`)
