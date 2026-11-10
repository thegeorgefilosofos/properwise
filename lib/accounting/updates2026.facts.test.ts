// ═══════════════════════════════════════════════════════════════════════════
// ΟΙ ΕΝΗΜΕΡΩΣΕΙΣ 2026 ΔΙΑΒΑΖΟΥΝ ΤΙΣ ΣΤΑΘΕΡΕΣ, ΔΕΝ ΤΙΣ ΞΑΝΑΓΡΑΦΟΥΝ
// ─────────────────────────────────────────────────────────────────────────
// Έλεγχος δημόσιων στοιχείων 10/11/2026. Το πλαφόν των εμπορικών μισθώσεων, οι
// ημερομηνίες των κόκκινων ζωνών, το παράθυρο της τριετούς απαλλαγής και το
// DSTI ήταν γραμμένα με το χέρι, ενώ υπήρχαν σταθερές. Σήμερα συμφωνούσαν· με
// την πρώτη παράταση θα έλεγαν άλλο. Επίσης ο Φορέας Απόκτησης και
// Επαναμίσθωσης «ξεκινούσε φθινόπωρο 2026» σαν γεγονός, χωρίς πηγή.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { REGULATORY_UPDATES_2026 as U, yearSpan } from './updates2026'
import { COMMERCIAL_RENT_CAP_2026 as CAP } from '../documents/rentAdjustment'
import { ATHENS_STR_FREEZE as ATH, THESS_STR_FREEZE as THESS } from '../market/greekMarket'
import { DSTI_LIMIT } from '../loans/affordability'
import { grDate, fpRate } from '../core/format'
import { regulated } from '../legal/validity'
import { SALE_LEASE_BACK_STATUS as SLB_STATUS, SALE_LEASE_BACK_HREF as SLB_HREF } from './saleLeaseBack'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }
const get = (id: string) => U.find(u => u.id === id)

const capYear = Number(CAP.from.slice(0, 4))
const cap = get('commercial-rent-cap-3pct')
ok('πλαφόν: τίτλος από τη σταθερά', !!cap && cap.title.includes(fpRate(CAP.pct)) && cap.title.includes(`(${capYear})`))
ok('πλαφόν: περίοδος από τη σταθερά', !!cap && cap.summary.includes(`από ${grDate(CAP.from)} έως ${grDate(CAP.to)}`) && cap.effective === `${grDate(CAP.from)}–${grDate(CAP.to)}`)
ok('πλαφόν: «επί του μισθώματος του» προηγούμενου έτους', !!cap && cap.summary.includes(`επί του μισθώματος του ${capYear - 1}`))

const ama = get('ama-red-zones')
ok('ΑΜΑ: η Αθήνα από τη σταθερά', !!ama && ama.summary.includes(`έως ${grDate(ATH.to)}`))
ok('ΑΜΑ: η Θεσσαλονίκη από τη σταθερά', !!ama && ama.summary.includes(THESS.area) && ama.summary.includes(`από ${grDate(THESS.from)} έως ${grDate(THESS.to)}`))

const pct = (r: number) => fpRate(r * 100)
const dsti = get('dsti-ltv-limits')
ok('DSTI: τα δύο όρια από τη σταθερά', !!dsti && dsti.summary.includes(pct(DSTI_LIMIT.firstTimeBuyer)) && dsti.summary.includes(pct(DSTI_LIMIT.other)))
ok('DSTI: «πρώτη φορά», όχι «πρώτης κατοικίας» (affordability.ts)', !!dsti && !dsti.summary.includes('πρώτης κατοικίας'))

const slb = get('sale-lease-back')
// Ο Φορέας λέει μόνο ό,τι λέει η ανακοίνωση του ΥΠΕΘΟΟ: «φθινόπωρο του 2026»
// επιτρέπεται μόνο μαζί με την πηγή. Αριθμοί που δεν βρέθηκαν δεν μπαίνουν ποτέ.
const UNSOURCED = /~\s?12 έτη|12 ετών|~\s?15\.000|15\.000 νοικοκυρ/
const autumnOnlyWithSource = (t: string) =>
  [...t.matchAll(/φθινόπωρο/g)].every(m => /ΥΠΕΘΟΟ/.test(t.slice(Math.max(0, (m.index ?? 0) - 120), (m.index ?? 0) + 120)))
ok('Φορέας: η πρόταση κατάστασης παραθέτει την ανακοίνωση', /^Το ΥΠΕΘΟΟ ανακοίνωσε τον Ιούνιο 2026 έναρξη το φθινόπωρο του 2026, χωρίς συγκεκριμένη ημερομηνία\.$/.test(SLB_STATUS))
ok('Φορέας: η πηγή είναι η ανακοίνωση του ΥΠΕΘΟΟ', /^https:\/\/minfin\.gov\.gr\/.*fthinoporo-tou-2026/.test(SLB_HREF) && slb?.sourceHref === SLB_HREF)
ok('Φορέας: η περίληψη λέει την πρόταση της πηγής', !!slb && slb.summary.includes(SLB_STATUS))
ok('Φορέας: «φθινόπωρο» μόνο μαζί με την πηγή', !!slb && autumnOnlyWithSource(slb.summary) && autumnOnlyWithSource(slb.effective))
ok('Φορέας: χωρίς «~12 έτη» και «~15.000»', !!slb && !UNSOURCED.test(slb.summary))
ok('Φορέας: χωρίς «απόφαση του Υπουργού» (δεν έχει ακόμη πηγή στο μητρώο)', !!slb && !/απόφαση του Υπουργού/.test(slb.summary))
ok('Φορέας: χωρίς «ενδιάμεσο πρόγραμμα» (δεν επαληθεύτηκε ότι δέχεται αιτήσεις)', !!slb && !/ενδιάμεσο πρόγραμμα/.test(slb.summary))

// Τα `effective` βγαίνουν από τις ίδιες σταθερές με την περίληψη.
const VAC = regulated('vacant-rental-exemption')
const vac = get('longterm-exemption-conditions')
ok('απαλλαγή: το effective από το μητρώο', !!vac && vac.effective === yearSpan(VAC.validFrom, VAC.validTo) && vac.effective === `${VAC.validFrom.slice(0, 4)}–${(VAC.validTo ?? '').slice(0, 4)}`)
ok('yearSpan: με λήξη «2024–2026»', yearSpan('2024-09-08', '2026-12-31') === '2024–2026')
ok('yearSpan: χωρίς λήξη «από 2024», όχι «2024–»', yearSpan('2024-09-08', null) === 'από 2024' && yearSpan('2024-09-08', undefined) === 'από 2024')
ok('ΑΜΑ: το effective από τις σταθερές των ζωνών', !!ama && ama.effective === `έως ${grDate(ATH.to > THESS.to ? ATH.to : THESS.to)} για την αναστολή νέων ΑΜΑ`)
ok('ΑΜΑ: η ημερομηνία ισχύος λέει ότι αφορά την αναστολή, όχι τη μη μεταβίβαση', !!ama && /^έως \d{2}\/\d{2}\/\d{4} για την αναστολή νέων ΑΜΑ$/.test(ama.effective) && !/μεταβίβασ/.test(ama.effective))
const updSrc = readFileSync('lib/accounting/updates2026.ts', 'utf8')
ok('απαλλαγή και ΑΜΑ: το effective δεν γράφεται «20xx–20xx» με το χέρι', !/effective: '20\d\d–20\d\d'/.test(updSrc))
ok('effective: καμία παύλα em', U.every(u => !u.effective.includes('—')))

// Οι ίδιοι κανόνες στις οθόνες του πίνακα.
const loan = readFileSync('app/dashboard/components/TabLoanData.tsx', 'utf8')
ok('Οδηγός οφειλών: καμία γραμμή «Έναρξη:» γραμμένη με το χέρι στα facts', !/'Έναρξη[^']*'/.test(loan))
// κυριολεκτικό-πρότυπο: ψάχνουμε το κείμενο της πηγής, όχι τιμή.
ok('Οδηγός οφειλών: ο Φορέας από την πρόταση της πηγής', loan.includes('${SALE_LEASE_BACK_STATUS}') && loan.includes('url: SALE_LEASE_BACK_HREF'))
ok('Οδηγός οφειλών: «φθινόπωρο» μόνο μαζί με την πηγή, χωρίς αριθμούς χωρίς πηγή', autumnOnlyWithSource(loan) && !UNSOURCED.test(loan) && !/ενδιάμεσο πρόγραμμα/.test(loan))
const care = readFileSync('app/dashboard/components/TabTenantCare.tsx', 'utf8')
// κυριολεκτικό-πρότυπο: ψάχνουμε το κείμενο της πηγής, όχι τιμή.
ok('Ενοικιαστής: το έτος της κατοικίας δεν δένεται με το πλαφόν των εμπορικών', !care.includes('Για το ${CAP_YEAR} δεν ισχύει γενικό'))
ok('Ενοικιαστής: το πλαφόν από τη σταθερά', care.includes('fpRate(COMMERCIAL_RENT_CAP_2026.pct)') && !care.includes("το 3% επί του μισθώματος του 2025"))
const guide = readFileSync('app/dashboard/components/loan/LoanGuide.tsx', 'utf8')
ok('Οδηγός δανείου: χωρίς ημερομηνία πλαισίου με το χέρι', !guide.includes('ισχύον πλαίσιο (Ιούλιος 2026)'))
ok('Οδηγός δανείου: η «Γέφυρα 3» δεν είναι κρατικό πρόγραμμα', !guide.includes("label:'Γέφυρα 3"))

// Η Νόα λέει τα ίδια με τις οθόνες: ο Φορέας από την πρόταση της πηγής, το πλαφόν από τη σταθερά.
const noa = readFileSync('app/dashboard/components/assistantPersona.ts', 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
ok('Νόα: ο Φορέας από την πρόταση της πηγής, δύο φορές', (noa.match(/\$\{SALE_LEASE_BACK_STATUS\}/g) ?? []).length === 2)
ok('Νόα: «φθινόπωρο» μόνο μαζί με την πηγή', autumnOnlyWithSource(noa))
ok('Νόα: ο Φορέας χωρίς «~12 έτη», «12 ετών» και «~15.000»', !UNSOURCED.test(noa))
ok('Νόα: χωρίς «ενδιάμεσο πρόγραμμα» για τον Φορέα', !/ενδιάμεσο πρόγραμμα/.test(noa))
ok('Νόα: το πλαφόν δεν γράφεται «3%» με το χέρι', !/πλαφόν[^·\n]{0,40}\b3%/.test(noa) && !/πλαφόν αναπροσαρμογής 3%/.test(noa))
ok('Νόα: το πλαφόν από το COMMERCIAL_RENT_CAP_2026 με fpRate', noa.includes('fpRate(COMMERCIAL_RENT_CAP_2026.pct)'))

console.log(fail ? `✗ updates2026 στοιχεία: ${fail} απέτυχαν, ${pass} πέρασαν` : `✓ updates2026 στοιχεία: ${pass} έλεγχοι πέρασαν`)
if (fail) process.exit(1)
