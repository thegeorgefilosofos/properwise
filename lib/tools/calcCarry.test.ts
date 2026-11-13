// ═══════════════════════════════════════════════════════════════════════════
// Η ΣΥΝΕΧΕΙΑ ΣΤΟΝ ΠΙΝΑΚΑ: ΠΟΙΟ ΦΟΡΤΙΟ, ΤΙ ΠΡΟΣΥΜΠΛΗΡΩΝΕΙ, ΤΙ ΛΕΕΙ Η ΕΠΙΒΕΒΑΙΩΣΗ
// ─────────────────────────────────────────────────────────────────────────
// Τρέξε: npx tsx lib/tools/calcCarry.test.ts
// ═══════════════════════════════════════════════════════════════════════════
import { resolveCarry, draftToolOf, carryWizard, carrySavedNote, carryNextDeadline } from './calcCarry'
import { readRentCarry, rentCarryWizard, rentChanged, rentSignupHref, RENT_APP_PATH } from './rentCarry'
import { ENFIA_APP_PATH, enfiaPublicEstimate } from './enfiaCarry'
import { SPEC as RENT } from './rentSpec'
import { continuation } from '../auth/continuation'
import { writeStatus, STATUSES } from '../property/status'
import { taxEventsToWrite } from '../facts/deadlines'
import { fe } from '../core/format'
import type { CalcDraft } from './calcDraft'

let passed = 0, failed = 0
const fails: string[] = []
const ok = (name: string, cond: boolean) => { if (cond) passed++; else { failed++; fails.push(name) } }

const NOW = Date.UTC(2026, 10, 13)
const draft = (tool: CalcDraft['tool'], values: Record<string, string>): CalcDraft => ({ tool, values, at: NOW })
const none = new URLSearchParams()
const TODAY = '2026-11-13'

// ── ΠΟΙΟ ΦΟΡΤΙΟ ─────────────────────────────────────────────────────────────
{
  const e = resolveCarry('enfia', none, draft('enfia', { tm: '120', zoni: '2100', orofos: 'third' }))
  ok('ΕΝΦΙΑ από το πρόχειρο', e?.kind === 'enfia' && e.enfia.inputs.sqm === 120 && e.enfia.values.orofos === 'third')
  const u = resolveCarry('enfia', new URLSearchParams('tm=90&zoni=1400'), draft('enfia', { tm: '120', zoni: '2100' }))
  ok('παλιός σύνδεσμος με πεδία: μετρά η διεύθυνση', u?.kind === 'enfia' && u.enfia.inputs.sqm === 90)
  ok('πρόχειρο ενοικίων σε action=enfia δεν διαβάζεται', resolveCarry('enfia', none, draft('rent', { enoikio: '750' })) === null)
  ok('πρόχειρο ΕΝΦΙΑ σε action=rent δεν διαβάζεται', resolveCarry('rent', none, draft('enfia', { tm: '120' })) === null)
  const r = resolveCarry('rent', none, draft('rent', { enoikio: '750', etos: '2026' }))
  ok('ενοίκια από το πρόχειρο', r?.kind === 'rent' && r.rent.monthly === 750)
  ok('χωρίς πρόχειρο: τίποτα', resolveCarry('rent', none, null) === null && resolveCarry('enfia', none, null) === null)
  ok('άλλο action: τίποτα', resolveCarry('scan', none, draft('enfia', { tm: '120' })) === null && resolveCarry(null, none, null) === null)
  ok('το εργαλείο κάθε action', draftToolOf('enfia') === 'enfia' && draftToolOf('rent') === 'rent' && draftToolOf('scan') === null && draftToolOf(null) === null)
}

// ── ΤΟ ΕΝΟΙΚΙΟ ΕΛΕΓΧΕΤΑΙ ΟΠΩΣ Ο ΕΝΦΙΑ ─────────────────────────────────────────
{
  ok('το παράδειγμα της σελίδας δεν είναι ακίνητο', readRentCarry({}) === null && readRentCarry({ ...RENT }) === null)
  ok('το έτος μόνο του δεν κάνει τη σελίδα «αλλαγμένη»', !rentChanged({ ...RENT, etos: '2026' }))
  ok('οι μήνες μετρούν ως αλλαγή', rentChanged({ mines: '10' }) && readRentCarry({ mines: '10' })?.monthly === 600)
  ok('ελληνική γραφή ποσού', readRentCarry({ enoikio: '1.250,50' })?.monthly === 1250.5)
  for (const [name, v] of [
    ['μηδέν', { enoikio: '0' }], ['αρνητικό', { enoikio: '-5' }], ['κείμενο', { enoikio: 'abc' }],
    ['13 μήνες', { enoikio: '700', mines: '13' }], ['τράπεζα 2', { enoikio: '700', trapeza: '2' }],
    ['έτος κείμενο', { enoikio: '700', etos: '20x6' }], ['σύνδεσμος', { enoikio: '//kako.gr' }],
  ] as const) ok(`άκυρο (${name}) → τίποτα`, readRentCarry(v as Record<string, string>) === null)

  // Ο σύνδεσμος της εγγραφής: καμία τιμή· η συνέχεια φτάνει ακέραιη.
  ok('ενοίκια με προεπιλογές → σκέτη εγγραφή', rentSignupHref({ ...RENT, etos: '2026' }) === '/signup')
  const href = rentSignupHref({ ...RENT, enoikio: '750' })
  const url = new URL(href, 'https://properwise.gr')
  ok('η συνέχεια των ενοικίων φτάνει στον πίνακα', continuation(url.search) === RENT_APP_PATH)
  ok('…χωρίς το ποσό στη διεύθυνση', !href.includes('750'))
  ok('οι δύο συνέχειες δείχνουν στον πίνακα', ENFIA_APP_PATH.startsWith('/dashboard?') && RENT_APP_PATH.startsWith('/dashboard?'))
}

// ── ΤΙ ΠΡΟΣΥΜΠΛΗΡΩΝΕΙ Ο ΟΔΗΓΟΣ ──────────────────────────────────────────────
{
  ok('χωρίς φορτίο: τίποτα', carryWizard(null) === undefined)
  const w = carryWizard({ kind: 'rent', rent: { monthly: 750 } })
  ok('ενοίκια → «μακροχρόνια» και το μίσθωμα', w?.statusKey === 'rent_long' && w.rent === '750' && w.sqm === undefined)
  ok('η κατάσταση είναι επιλογή του οδηγού', STATUSES.some(s => s.key === w?.statusKey))
  ok('μίσθωμα χωρίς ουρές κινητής υποδιαστολής', rentCarryWizard({ monthly: 0.1 + 0.2 }).rent === '0.3')
  const e = resolveCarry('enfia', none, draft('enfia', { tm: '64,5', zoni: '3.200', orofos: 'first', pososto: '50', voith: '8' }))
  const we = carryWizard(e)
  ok('ΕΝΦΙΑ → τ.μ., ποσοστό, όροφος, βοηθητικοί', we?.sqm === '64.5' && we.ownership === '50' && we.floor === '1ος' && we.storageSqm === '8' && we.statusKey === undefined)
}

// ── Η ΕΠΙΒΕΒΑΙΩΣΗ ΛΕΕΙ ΟΣΑ ΑΠΟΘΗΚΕΥΤΗΚΑΝ ─────────────────────────────────────
{
  const owner = writeStatus('own_use')
  const long = writeStatus('rent_long')
  const nextEnfia = carryNextDeadline('enfia', owner, TODAY)
  const firstEnfia = taxEventsToWrite(TODAY, 'owner').find(e => /^tax:enfia-(first|instalment|last)-/.test(String(e.source)))
  ok('η προθεσμία ΕΝΦΙΑ είναι αυτή που γράφει το ημερολόγιο', !!nextEnfia && nextEnfia.date === firstEnfia?.event_date && nextEnfia.title === firstEnfia?.title)
  ok('…και όχι η «έκδοση εκκαθαριστικού»', !!nextEnfia && !/έκδοση/.test(nextEnfia.title))
  const nextRent = carryNextDeadline('rent', long, TODAY)
  ok('ενοίκια: δόση φόρου εισοδήματος ή δήλωση', !!nextRent && /Φόρος εισοδήματος|Δήλωση εισοδήματος/.test(nextRent.title))
  ok('ενοίκια χωρίς μίσθωση στον οδηγό: καμία προθεσμία φόρου εισοδήματος', carryNextDeadline('rent', owner, TODAY) === null)

  const i = resolveCarry('enfia', none, draft('enfia', { tm: '120', zoni: '2100' }))
  const annual = i?.kind === 'enfia' ? enfiaPublicEstimate(i.enfia.inputs)!.annual : 0
  const note = carrySavedNote('enfia', { name: 'Κυψέλη', sqm: 120, ...owner }, annual, TODAY)
  ok('ονομάζει το ακίνητο, τα τ.μ. και τον ΕΝΦΙΑ', note.startsWith(`Αποθηκεύτηκε το «Κυψέλη»: 120 τ.μ., ΕΝΦΙΑ ${fe(annual)} τον χρόνο.`))
  ok('…και την προθεσμία σε ηη/μμ/εεεε', /Στο ημερολόγιό σου: ΕΝΦΙΑ, .+, \d{2}\/\d{2}\/\d{4}\.$/.test(note))
  ok('χωρίς γραμμένο ΕΝΦΙΑ δεν τον αναφέρει', !carrySavedNote('enfia', { name: 'Α', sqm: 120, ...owner }, null, TODAY).includes('ΕΝΦΙΑ 0'))
  ok('…ούτε ποσό που δεν γράφτηκε', !/τον χρόνο/.test(carrySavedNote('enfia', { name: 'Α', sqm: 120, ...owner }, null, TODAY)))
  const rn = carrySavedNote('rent', { name: 'Παγκράτι', sqm: 0, target_rent: 750, ...long }, null, TODAY)
  ok('ενοίκια: μίσθωμα από τη γραμμή, όχι τ.μ. μηδέν', rn.startsWith(`Αποθηκεύτηκε το «Παγκράτι»: μίσθωμα ${fe(750)} τον μήνα.`) && !rn.includes('0 τ.μ.'))
  ok('χωρίς όνομα: «το ακίνητο»', carrySavedNote('enfia', { ...owner }, null, TODAY).startsWith('Αποθηκεύτηκε το ακίνητο.'))
  ok('κανένα κόμμα πριν από «και», καμία παύλα', !/,\sκαι|\u2014/.test(note + rn))
}

console.log(`lib/tools/calcCarry.test.ts: ${passed} passed, ${failed} failed`)
if (failed) { for (const f of fails) console.log('  ✗ ' + f); process.exit(1) }
