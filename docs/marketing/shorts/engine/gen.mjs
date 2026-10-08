// Παράγει το docs/marketing/shorts/CALENDAR-2026Q4.md από το episodes.mjs.
// Χρήση, από τη ρίζα του έργου:
//   node docs/marketing/shorts/engine/gen.mjs docs/marketing/shorts/CALENDAR-2026Q4.md lib/legal/validity.ts
import { readFileSync, writeFileSync } from 'node:fs'
import { EPISODES, RESERVES } from './episodes.mjs'

const [, , OUT, VALIDITY] = process.argv
const YEAR = 2026
const SERIES = {
  arithmos: { name: 'Ένας αριθμός', end: 'Ο αριθμός μένει μόνος, στο ίδιο σημείο και μέγεθος με το πρώτο καρέ, ώστε η επανάληψη να δένει' },
  lathi: { name: 'Λάθη ιδιοκτήτη', end: 'Η κόκκινη σφραγίδα «ΛΑΘΟΣ» γυρίζει πράσινη «ΣΩΣΤΑ» και η κάμερα επιστρέφει στο αντικείμενο του πρώτου καρέ' },
  prothesmia: { name: 'Προθεσμία', end: 'Η σελίδα του ημερολογίου με ημερομηνία και έτος μένει ακίνητη· η πρώτη λέξη του αγκιστριού ξαναμπαίνει' },
  mythos: { name: 'Μύθος ή αλήθεια', end: 'Η πινακίδα «ΜΥΘΟΣ» ή «ΑΛΗΘΕΙΑ» γυρίζει πίσω στο ερωτηματικό του πρώτου καρέ' },
  vraxy: { name: 'Βραχυχρόνια', end: 'Η βαλίτσα κλείνει και γίνεται το εικονίδιο του πρώτου καρέ' },
  makro: { name: 'Μακροχρόνια', end: 'Το κλειδί γυρίζει στην πόρτα του πρώτου καρέ' },
  noa: { name: 'Η Νόα απαντά', end: 'Η απάντηση σβήνει και το πεδίο ερώτησης αδειάζει, έτοιμο για την ίδια ερώτηση' },
  pws: { name: 'Πώς το κάνει το PROPERWISE', end: 'Η οθόνη της εφαρμογής κλείνει σε εικονίδιο και ξανανοίγει στο πρώτο καρέ' },
  erotisi: { name: 'Ερώτηση θεατή', end: 'Η κάρτα σχολίου ξαναεμφανίζεται κενή: «Γράψε τη δική σου ερώτηση»' },
  telos: { name: 'Τέλος χρονιάς', end: 'Η τελευταία σελίδα του έτους γυρίζει και αποκαλύπτει πάλι το πρώτο καρέ' },
  diorthosame: { name: 'Τι διορθώσαμε', end: 'Η διαφορά του κώδικα κλείνει, το πράσινο μένει· ο λάθος αριθμός ξαναεμφανίζεται διαγραμμένος' },
  nea: { name: 'Τα νέα του ακινήτου', end: 'Η κάρτα «Πηγή» με τη διεύθυνση της ανακοίνωσης και πίσω στον τίτλο' },
}

// ── Ημερομηνίες ──────────────────────────────────────────────────────────
const iso = (dm) => { const [d, m] = dm.split('/').map(Number); return `${YEAR}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` }
const dayNum = (isoS) => Math.floor(Date.parse(`${isoS}T12:00:00Z`) / 864e5)
const fmt = (isoS) => { const [y, m, d] = isoS.split('-'); return `${d}/${m}/${y}` }
const WD = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο']
const wd = (isoS) => WD[new Date(`${isoS}T12:00:00Z`).getUTCDay()]

const days = []
for (let n = dayNum('2026-10-07'); n <= dayNum('2026-12-31'); n++) days.push(new Date(n * 864e5).toISOString().slice(0, 10))
const slots = days.flatMap(d => [{ d, k: 'A' }, { d, k: 'B' }])

// ── Μητρώο ισχύος ─────────────────────────────────────────────────────────
const vsrc = readFileSync(VALIDITY, 'utf8')
const VALID = {}
for (const m of vsrc.matchAll(/id: '([^']+)'[\s\S]*?validTo: ([^,\n]+)/g)) VALID[m[1]] = m[2].trim().replace(/'/g, '')
const deathOf = (e) => {
  const parts = []
  const dates = (e.v || []).map(id => {
    if (!(id in VALID)) throw new Error(`άγνωστο id ισχύος ${id}`)
    return VALID[id]
  }).filter(v => v && v !== 'null').sort()
  if (dates.length) parts.push(`${fmt(dates[0])} (μικρότερο \`validTo\` από ${e.v.map(x => `\`${x}\``).join(', ')} στο lib/legal/validity.ts)`)
  else if (e.v && e.v.length) parts.push(`ανοιχτό (${e.v.map(x => `\`${x}\``).join(', ')}: validTo null)`)
  if (e.d) parts.push(e.d)
  return parts.join(' · ') || 'ανοιχτό'
}

// ── Έλεγχοι δεδομένων ─────────────────────────────────────────────────────
for (const e of EPISODES) {
  if (!SERIES[e.s]) throw new Error(`άγνωστη σειρά ${e.s}`)
  if ([...e.ti].length >= 60) throw new Error(`τίτλος ≥ 60: ${e.ti}`)
  const strip = (x) => x.replace(/\{[^}]+\}/g, '').replace(/Ε[129]\b|39Β/g, '')
  const nb = e.b.length + 2
  if (nb < 5 || nb > 8) throw new Error(`σκηνές ${nb}: ${e.ti}`)
  if (/\d/.test(strip(e.ti)) || /\d/.test(strip(e.h))) throw new Error(`ψηφίο σε τίτλο ή αγκίστρι: ${e.ti}`)
  if (!e.pin && !e.w) throw new Error(`χωρίς ημερομηνία: ${e.ti}`)
}

// ── Τοποθέτηση ────────────────────────────────────────────────────────────
function rng(seed) { return () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff } }

function schedule(seed) {
  const r = rng(seed)
  const at = new Map() // `${d}${k}` -> episode
  const placedDay = new Map() // episode -> day number
  for (const e of EPISODES.filter(x => x.pin)) {
    const [dm, k] = [e.pin.slice(0, 5), e.pin.slice(5)]
    const key = `${iso(dm)}${k}`
    if (at.has(key)) throw new Error(`διπλό pin ${key}`)
    at.set(key, e); placedDay.set(e, dayNum(iso(dm)))
  }
  const topicOk = (e, dn) => {
    for (const [o, odn] of placedDay) if (o !== e && o.t === e.t && Math.abs(odn - dn) < 7) return false
    return true
  }
  const pending = EPISODES.filter(e => !e.pin)
  let prevSeries = null
  const recent = []
  for (const s of slots) {
    const key = `${s.d}${s.k}`
    const dn = dayNum(s.d)
    if (at.has(key)) { prevSeries = at.get(key).s; recent.push(prevSeries); continue }
    const other = at.get(`${s.d}${s.k === 'A' ? 'B' : 'A'}`)
    const avail = pending.filter(e => !placedDay.has(e) && dn >= dayNum(iso(e.w[0])) && dn <= dayNum(iso(e.w[1])) && topicOk(e, dn))
    const loose = avail.filter(e => e.s !== prevSeries && (!other || other.s !== e.s) && true)
    const strict = loose.filter(e => !recent.slice(-3).includes(e.s))
    const urgent = avail.filter(e => dayNum(iso(e.w[1])) - dn <= 1)
    const urgentLoose = urgent.filter(e => loose.includes(e))
    const pool = urgentLoose.length ? urgentLoose : urgent.length ? urgent : strict.length ? strict : loose.length ? loose : avail
    if (!pool.length) return { fail: `κενό slot ${fmt(s.d)} ${s.k}` }
    pool.sort((a, b) => (dayNum(iso(a.w[1])) - dayNum(iso(b.w[1]))) || (r() - 0.5))
    // λίγη τυχαιότητα ανάμεσα στα δύο πιο επείγοντα, για ποικιλία σειρών
    const pick = pool.length > 1 && dayNum(iso(pool[1].w[1])) - dayNum(iso(pool[0].w[1])) < 3 && r() < 0.5 ? pool[1] : pool[0]
    at.set(key, pick); placedDay.set(pick, dn); prevSeries = pick.s; recent.push(pick.s)
  }
  const missing = EPISODES.filter(e => !placedDay.has(e))
  if (missing.length) return { fail: `δεν μπήκαν: ${missing.map(e => `${e.ti} [${e.w}]`).join(' | ')}` }
  // σειρά συνεχόμενη;
  let same = 0; const seq = slots.map(s => at.get(`${s.d}${s.k}`).s)
  for (let i = 1; i < seq.length; i++) { if (seq[i] === seq[i - 1]) same += 100; for (let j = Math.max(0, i - 4); j < i - 1; j++) if (seq[j] === seq[i]) same++ }
  return { at, same }
}

let best = null; let lastFail = ''
for (let seed = 1; seed < 4000; seed++) {
  const res = schedule(seed)
  if (res.fail) { lastFail = res.fail; continue }
  if (!best || res.same < best.same) best = res
  if (best.same === 0) break
}
if (!best) throw new Error(`Δεν βγήκε πρόγραμμα: ${lastFail}`)
const at = best.at

// ── Αρίθμηση επεισοδίων ανά σειρά ──────────────────────────────────────────
const num = new Map(); const count = {}
for (const s of slots) { const e = at.get(`${s.d}${s.k}`); count[e.s] = (count[e.s] || 0) + 1; num.set(e, count[e.s]) }
const pad = (n) => String(n).padStart(2, '0')

// ── Έλεγχος κανόνα 7 ημερών ───────────────────────────────────────────────
const byTopic = {}
for (const s of slots) { const e = at.get(`${s.d}${s.k}`); (byTopic[e.t] ||= []).push(dayNum(s.d)) }
for (const [t, arr] of Object.entries(byTopic)) for (let i = 1; i < arr.length; i++) if (arr[i] - arr[i - 1] < 7) throw new Error(`θέμα ${t} μέσα σε 7 ημέρες`)

// ── Απόδοση ──────────────────────────────────────────────────────────────
const HOUR = { A: '13:00', B: '20:00' }
const SEC = (n) => `${n}″`
const L = []
L.push('# Ημερολόγιο Shorts, 07/10/2026 ως 31/12/2026')
L.push('')
L.push('Δύο shorts την ημέρα, ογδόντα έξι ημέρες, εκατόν εβδομήντα δύο θέσεις. Θέση **A** στις 13:00, θέση **B** στις 20:00, ώρα Ελλάδας. Οι ώρες είναι η αρχική υπόθεση· ο βρόχος της Παρασκευής τις αλλάζει (STRATEGY.md, «Ώρες»).')
L.push('')
L.push('Το αρχείο **παράγεται** από το `docs/marketing/shorts/engine/` (`node docs/marketing/shorts/engine/gen.mjs docs/marketing/shorts/CALENDAR-2026Q4.md lib/legal/validity.ts`): αλλαγή γίνεται στο `episodes.mjs`, όχι εδώ. Κάθε επεισόδιο ζει ως δεδομένα (σειρά, θέμα, παράθυρο ημερομηνιών, σκηνές, γεγονότα) και η τοποθέτηση γίνεται με δύο κανόνες: κανένα θέμα δεν ξαναβγαίνει μέσα σε επτά ημέρες και καμία σειρά δεν παίζει δύο φορές στη σειρά. Οι προθεσμίες κάθονται σε σταθερή μέρα, πάντα το πολύ 45 ημέρες πριν, όπως ορίζει το `.claude/skills/anartisi/SKILL.md`.')
L.push('')
L.push('## Πώς διαβάζεται μια θέση')
L.push('')
L.push('- **Αγκίστρι 0–1″:** η φράση που γράφεται στην οθόνη στο πρώτο καρέ, πριν από οτιδήποτε άλλο. Κανένα λογότυπο πριν από αυτή.')
L.push('- **Σκηνές:** 5 ως 7 ενότητες. Κάθε ενότητα έχει 1 ως 4 κοψίματα· ο ρυθμός είναι ένα κόψιμο κάθε 1,5 ως 2,5 δευτερόλεπτα. Οι μεταβάσεις εξηγούνται στο STRATEGY.md, «Λεξικό μεταβάσεων».')
L.push('- **Γεγονότα:** κάθε αριθμός της θέσης βγαίνει από τον κώδικα που γράφεται εκεί. Όπου γράφει «ΧΡΕΙΑΖΕΤΑΙ ΠΗΓΗ», η θέση δεν γυρίζεται πριν βρεθεί η επίσημη πηγή και μπει στον κώδικα ή στη σελίδα του οδηγού. Ο έλεγχος πηγών και η κατάσταση κάθε γραμμής είναι στο SOURCES.md: «ΠΗΓΗ ΕΠΙΒΕΒΑΙΩΜΕΝΗ», «ΠΗΓΗ ΜΕΡΙΚΗ» (η θέση λέει μόνο τα επιβεβαιωμένα), «ΑΝΑΜΟΝΗ ΦΕΚ» (ξαναελέγχεται από την ημερομηνία που γράφει, πριν από το γύρισμα), «ΕΝΑΝΤΙΩΝΕΤΑΙ ΣΤΟΝ ΚΩΔΙΚΑ» (η πηγή διαφωνεί με τιμή του κώδικα· κανένας αριθμός του θέματος στο καρέ πριν διορθωθεί ο κώδικας) και «ΧΡΕΙΑΖΕΤΑΙ ΣΤΑΘΕΡΑ ΣΤΟΝ ΚΩΔΙΚΑ» (ο αριθμός δεν μπαίνει στο καρέ πριν γίνει σταθερά).')
L.push('- **Placeholders** όπως `{ENFIA_NEXT_DUE}`: τους γεμίζει η μηχανή απόδοσης την ημέρα της απόδοσης. Ο πίνακας με την πηγή του καθενός είναι στο TEXTS-WEEK-01.md.')
L.push('- **CTA:** μόνο διαδρομές που υπάρχουν στο `app/`. Η σήμανση είναι `utm_source=<πλατφόρμα>&utm_medium=short&utm_campaign=<σειρά>-e<αριθμός>&utm_content=<ημμ><θέση>`, με πλατφόρμα `youtube`, `instagram`, `facebook` ή `tiktok`.')
L.push('- **Λήγει:** η ημερομηνία θανάτου του βίντεο. Είναι το μικρότερο `validTo` των ρυθμιζόμενων μεγεθών που φαίνονται στο καρέ (lib/legal/validity.ts) ή η ίδια η προθεσμία. Μετά από αυτή το βίντεο γίνεται ιδιωτικό ή παίρνει καρφιτσωμένη διόρθωση (README.md, «Απόσυρση»).')
L.push('')

// Ευρετήριο
L.push('## Ευρετήριο')
L.push('')
L.push('| Ημερομηνία | Μέρα | A · 13:00 | B · 20:00 |')
L.push('|---|---|---|---|')
for (const d of days) {
  const a = at.get(`${d}A`), b = at.get(`${d}B`)
  const cell = (e) => `${SERIES[e.s].name} #${pad(num.get(e))}: ${e.ti}`
  L.push(`| ${fmt(d)} | ${wd(d)} | ${cell(a)} | ${cell(b)} |`)
}
L.push('')

// Σειρές
L.push('## Σειρές')
L.push('')
L.push('| Σειρά | Slug για UTM | Επεισόδια |')
L.push('|---|---|---|')
for (const [k, v] of Object.entries(SERIES)) L.push(`| ${v.name} | \`${k}\` | ${count[k] || 0} |`)
L.push(`| **Σύνολο** | | **${Object.values(count).reduce((a, b) => a + b, 0)}** |`)
L.push('')

// Γεγονότα ημερολογίου
const EVENTS = [
  ['09/10B', 'ΕΝΦΙΑ, 8η δόση (enfia-instalment-2026-8), λήξη 30/10/2026', 'lib/tax/greekTaxCalendar'],
  ['15/10A', 'Δήλωση βραχυχρόνιας διαμονής Σεπτεμβρίου (str-registry-2026-10), λήξη 20/10/2026', 'lib/tax/greekTaxCalendar'],
  ['26/10A', 'Απόδοση τέλους ανθεκτικότητας (str-climate-fee-2026-10), 30/10/2026', 'lib/tax/greekTaxCalendar'],
  ['28/10A', 'Αργία 28ης Οκτωβρίου και μετάθεση προθεσμιών', 'lib/calendar/greekHolidays'],
  ['29/10A', 'ΕΝΦΙΑ, 8η δόση, υπενθύμιση πριν τη λήξη 30/10/2026', 'lib/tax/greekTaxCalendar'],
  ['30/10A', 'Απόφαση ΕΚΤ 29/10/2026 (με όρο)', 'ecb.europa.eu, ημερολόγιο συνεδριάσεων (SOURCES.md)'],
  ['30/10B', 'Χαμηλή περίοδος τέλους ανθεκτικότητας από 01/11/2026', '`isHighSeasonMonth()` στο lib/billing/greekTax'],
  ['17/11A', 'Δήλωση βραχυχρόνιας διαμονής Οκτωβρίου (str-registry-2026-11), λήξη 20/11/2026', 'lib/tax/greekTaxCalendar'],
  ['23/11B', 'ΕΝΦΙΑ, 9η δόση (enfia-instalment-2026-9), λήξη 30/11/2026', 'lib/tax/greekTaxCalendar'],
  ['26/11A', 'Απόδοση τέλους ανθεκτικότητας (str-climate-fee-2026-11), 30/11/2026', 'lib/tax/greekTaxCalendar'],
  ['30/11A', 'ΕΝΦΙΑ, 9η δόση, ημέρα λήξης', 'lib/tax/greekTaxCalendar'],
  ['16/12A', 'Δήλωση βραχυχρόνιας διαμονής Νοεμβρίου (str-registry-2026-12), λήξη 21/12/2026', 'lib/tax/greekTaxCalendar'],
  ['18/12A', 'Απόφαση ΕΚΤ 17/12/2026 (με όρο)', 'ecb.europa.eu, ημερολόγιο συνεδριάσεων (SOURCES.md)'],
  ['22/12A', 'ΕΝΦΙΑ, 10η δόση (enfia-instalment-2026-10), λήξη 31/12/2026', 'lib/tax/greekTaxCalendar'],
  ['29/12A', 'ΕΝΦΙΑ 10η δόση και τέλος ανθεκτικότητας (str-climate-fee-2026-12), 31/12/2026', 'lib/tax/greekTaxCalendar'],
  ['31/12B', 'Κλείσιμο χρονιάς: όσα λήγουν 31/12/2026', 'lib/legal/validity'],
]
L.push('## Γεγονότα του ημερολογίου και η θέση τους')
L.push('')
L.push('Οι σταθερές θέσεις. Οι υπόλοιπες προθεσμίες του έτους (έκπτωση ανακαίνισης ως 31/12/2026, παράθυρο τριετούς απαλλαγής, πλαφόν επαγγελματικών μισθώσεων, αναστολή ΑΜΑ, αναστολές ΦΠΑ νεόδμητων και υπεραξίας, δήλωση μίσθωσης για μισθώσεις του Οκτωβρίου, επιστροφή ενοικίου) έχουν παράθυρο και η θέση τους φαίνεται στο ευρετήριο.')
L.push('')
L.push('| Θέση | Γεγονός | Πηγή |')
L.push('|---|---|---|')
for (const [p, ev, src] of EVENTS) {
  const e = at.get(`${iso(p.slice(0, 5))}${p.slice(5)}`)
  L.push(`| ${p.slice(0, 5)}/2026 ${p.slice(5)} | ${ev} · ${SERIES[e.s].name} #${pad(num.get(e))} | ${src} |`)
}
// με παράθυρο
const windowed = [
  ['r39b', 'Έκπτωση ανακαίνισης 39Β, δαπάνες ως 31/12/2026 (`RENO_39B_TO`)'],
  ['exempt-window', 'Τριετής απαλλαγή, μισθώσεις ως 31/12/2026 (longterm-exemption-conditions)'],
  ['commercial-cap', 'Πλαφόν επαγγελματικών μισθώσεων ως 31/12/2026 (`COMMERCIAL_RENT_CAP_2026`)'],
  ['ama-new', 'Λήξη αναστολής νέων ΑΜΑ 31/12/2026 (ama-red-zones)'],
  ['thess-ama', 'Αναστολή ΑΜΑ Θεσσαλονίκης 01/07 ως 31/12/2026 (ν.5313/2026)'],
  ['vat-newbuild', 'Αναστολή ΦΠΑ νεόδμητων ως 31/12/2026 (new-build-vat-suspension)'],
  ['capital-gains', 'Αναστολή φόρου υπεραξίας ως 31/12/2026 (capital-gains-suspension)'],
  ['lease-decl', 'Δήλωση μίσθωσης για μισθώσεις Οκτωβρίου (`declarationDeadline()`)'],
  ['rent-refund', 'Επιστροφή ενοικίου στους ενοικιαστές, Νοέμβριος 2026 (είδηση)'],
  ['bank-prep', 'Ενοίκιο μέσω τράπεζας από 01/07/2027 (`FIRST_YEAR_BANK_RECEIPT`)'],
  ['enfia-next', 'Έκδοση ΕΝΦΙΑ 2027, βεβαιότητα announced (enfia-issue-2027)'],
  ['holiday-season', 'Γιορτές και βραχυχρόνια, Δεκέμβριος'],
  ['gas', 'Θέρμανση, φυσικό αέριο, χειμώνας'],
  ['euribor', 'Euribor του μήνα (euribor_3m)'],
]
for (const [t, ev] of windowed) {
  const hits = slots.filter(s => at.get(`${s.d}${s.k}`).t === t).map(s => { const e = at.get(`${s.d}${s.k}`); return `${fmt(s.d)} ${s.k} (${SERIES[e.s].name} #${pad(num.get(e))})` })
  L.push(`| ${hits.join(', ') || '—'} | ${ev} | κώδικας ή είδηση στη θέση |`)
}
L.push('')

// Εφεδρικά
L.push('## Θέσεις με όρο και εφεδρικά')
L.push('')
L.push('Μερικές θέσεις γυρίζονται μόνο αν ισχύσει κάτι (απόφαση που ανακοινώνεται, ΦΕΚ που δημοσιεύεται). Αν ο όρος δεν ισχύσει ως την παραμονή, μπαίνει εφεδρικό:')
L.push('')
for (const r of RESERVES) L.push(`- ${r}`)
L.push('')
L.push('Ο βρόχος της Παρασκευής μπορεί επίσης να αντικαταστήσει **μία θέση την εβδομάδα** με «Ξανά, αλλιώς»: το short της εβδομάδας με το καλύτερο «Viewed vs swiped away», με νέο αγκίστρι και νέα πρώτη σκηνή. Ποτέ το ίδιο αρχείο δύο φορές.')
L.push('')

// Θέσεις
L.push('## Οι θέσεις')
L.push('')
let lastMonth = ''
for (const s of slots) {
  const e = at.get(`${s.d}${s.k}`)
  const mon = s.d.slice(5, 7)
  if (mon !== lastMonth) { L.push(`### ${{ '10': 'Οκτώβριος', '11': 'Νοέμβριος', '12': 'Δεκέμβριος' }[mon]} ${YEAR}`); L.push(''); lastMonth = mon }
  const n = num.get(e)
  const camp = `${e.s}-e${pad(n)}`
  const content = `${s.d.slice(8, 10)}${s.d.slice(5, 7)}${s.k.toLowerCase()}`
  L.push(`#### ${fmt(s.d)} · ${wd(s.d)} · ${s.k} (${HOUR[s.k]}) · ${SERIES[e.s].name} #${pad(n)}`)
  L.push('')
  L.push(`- **Τίτλος:** ${e.ti}`)
  L.push(`- **Αγκίστρι 0–1″:** ${e.h.startsWith('«') ? e.h : `«${e.h}»`}`)
  L.push(`- **Γωνία:** ${e.a} · **θέμα:** \`${e.t}\``)
  L.push('- **Σκηνές:**')
  const mids = e.b.length
  const total = 55, hookEnd = 3, endStart = 48
  const step = (endStart - hookEnd) / mids
  L.push(`  1. ${SEC(0)}–${SEC(hookEnd)} ${e.hv}. Το αγκίστρι γράφεται στο πρώτο καρέ. · μετάβαση: ${e.b[0][1]}`)
  e.b.forEach(([v], i) => {
    const a = Math.round(hookEnd + i * step), b = Math.round(hookEnd + (i + 1) * step)
    const next = i + 1 < mids ? e.b[i + 1][1] : 'κοπή στον χτύπο'
    L.push(`  ${i + 2}. ${SEC(a)}–${SEC(b)} ${v} · μετάβαση: ${next}`)
  })
  L.push(`  ${mids + 2}. ${SEC(endStart)}–${SEC(total)} Κάρτα «properwise.gr${e.c === '/' ? '' : e.c}» σε γραμμή γραφομηχανής. ${SERIES[e.s].end}. · βρόχος στο καρέ 1`)
  L.push('- **Γεγονότα (κώδικας):**')
  for (const f of e.f) L.push(`  - ${f}`)
  L.push(`- **CTA:** \`https://properwise.gr${e.c === '/' ? '/' : e.c}?utm_source=<πλατφόρμα>&utm_medium=short&utm_campaign=${camp}&utm_content=${content}\``)
  L.push(`- **Λήγει:** ${deathOf(e)}`)
  L.push(`- **Υλικό:** ${e.r || 'νέο, από τη μηχανή reel (scripts/marketing/reelKit.ts) με γεγονότα από τον κώδικα'}`)
  if (e.n) L.push(`- **Είδηση, πηγή:** ${e.n}`)
  if (e.cond) L.push(`- **Όρος:** ${e.cond}`)
  L.push('')
}

writeFileSync(OUT, L.join('\n'))
console.log(`ok · seed συνεχόμενες ίδιες σειρές: ${best.same} · ${slots.length} θέσεις`)
console.log(count)
