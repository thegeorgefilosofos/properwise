// npx tsx lib/billing/planRefresh.test.ts
//
// ΤΟ ΠΑΚΕΤΟ ΜΕΤΑ ΤΟ ΤΑΜΕΙΟ ΚΑΙ ΟΙ ΣΤΗΛΕΣ ΠΟΥ ΤΟ ΚΡΙΝΟΥΝ.
// Ευρήματα 5 και 8 του ελέγχου της 12.11.2026: η επιστροφή «checkout=ok» δεν
// τη διάβαζε κανείς και οι Ρυθμίσεις διάβαζαν θέσεις από προσκλήσεις που δεν
// είχαν ζητήσει από τη βάση.
import { readFileSync } from 'node:fs'
import {
  takeCheckoutReturn, subscriptionArrived, pollUntil, planFieldsFromRow, PLAN_COLUMNS,
  PLAN_POLL_DELAYS_MS, CHECKOUT_RETURN_SAY, type PlanProfileRow,
} from './planRefresh'

let pass = 0, fail = 0
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n) } }

const NOW = Date.parse('2026-11-12T10:00:00Z')

async function main() {
  // ── Η ΠΑΡΑΜΕΤΡΟΣ ΤΗΣ ΕΠΙΣΤΡΟΦΗΣ ──────────────────────────────────────────
  {
    const r = takeCheckoutReturn('?checkout=ok')
    ok('το «checkout=ok» αναγνωρίζεται', r.returned)
    ok('και σβήνεται από τη διεύθυνση', r.search === '')
    const k = takeCheckoutReturn('?checkout=ok&tab=settings')
    ok('οι άλλες παράμετροι μένουν', k.returned && k.search === '?tab=settings')
    const x = takeCheckoutReturn('?checkout=cancel')
    ok('άλλη τιμή δεν είναι επιστροφή', !x.returned && x.search === '')
    const n = takeCheckoutReturn('?tab=calendar')
    ok('χωρίς παράμετρο η διεύθυνση δεν αγγίζεται', !n.returned && n.search === '?tab=calendar')
    ok('κενή διεύθυνση', !takeCheckoutReturn('').returned && takeCheckoutReturn('').search === '')
  }

  // ── ΗΡΘΕ Η ΣΥΝΔΡΟΜΗ; ─────────────────────────────────────────────────────
  ok('χωρίς προφίλ: όχι', !subscriptionArrived(null, NOW))
  ok('δωρεάν χωρίς κατάσταση: όχι', !subscriptionArrived({ plan: 'free' }, NOW))
  ok('ενεργή με πακέτο: ναι', subscriptionArrived({ plan: 'solo', subscription_status: 'active' }, NOW))
  ok('σε δοκιμή του εμπόρου: ναι', subscriptionArrived({ plan: 'plus', subscription_status: 'on_trial' }, NOW))
  ok('κατάσταση χωρίς πακέτο ακόμη: όχι', !subscriptionArrived({ plan: 'free', subscription_status: 'active' }, NOW))
  ok('ληγμένη: όχι', !subscriptionArrived({ plan: 'solo', subscription_status: 'expired' }, NOW))
  ok('ακυρωμένη που έληξε: όχι', !subscriptionArrived({ plan: 'solo', subscription_status: 'cancelled', mor_ends_at: '2026-11-01T00:00:00Z' }, NOW))
  ok('ακυρωμένη που τρέχει ακόμη: ναι', subscriptionArrived({ plan: 'solo', subscription_status: 'cancelled', mor_ends_at: '2026-12-01T00:00:00Z' }, NOW))
  ok('άγνωστη κατάσταση: όχι', !subscriptionArrived({ plan: 'solo', subscription_status: 'super' }, NOW))

  // ── Η ΑΝΑΜΟΝΗ ΕΧΕΙ ΟΡΙΟ ──────────────────────────────────────────────────
  {
    const slept: number[] = []
    const sleep = async (ms: number) => { slept.push(ms) }
    let reads = 0
    const r = await pollUntil<PlanProfileRow>({
      read: async () => { reads++; return { plan: 'free' } },
      done: row => subscriptionArrived(row, NOW),
      delays: [10, 20, 30],
      sleep,
    })
    ok('χωρίς άφιξη: σταματά', !r.arrived)
    ok('τέσσερις αναγνώσεις για τρεις παύσεις', reads === 4 && r.reads === 4)
    ok('οι παύσεις τηρούνται με τη σειρά', slept.join(',') === '10,20,30')
  }
  {
    const slept: number[] = []
    let reads = 0
    const r = await pollUntil<PlanProfileRow>({
      read: async () => { reads++; return reads >= 3 ? { plan: 'solo', subscription_status: 'active' } : { plan: 'free' } },
      done: row => subscriptionArrived(row, NOW),
      delays: [10, 20, 30, 40],
      sleep: async ms => { slept.push(ms) },
    })
    ok('η άφιξη στην τρίτη ανάγνωση σταματά την αναμονή', r.arrived && r.reads === 3)
    ok('δεν περιμένει περισσότερο από όσο χρειάστηκε', slept.join(',') === '10,20')
    ok('επιστρέφει τη γραμμή που ήρθε', r.row?.plan === 'solo')
  }
  {
    const slept: number[] = []
    let reads = 0
    const r = await pollUntil<PlanProfileRow>({
      read: async () => { reads++; return null },
      done: row => subscriptionArrived(row, NOW),
      delays: [5, 6],
      sleep: async ms => { slept.push(ms) },
      waitFirst: true,
    })
    ok('με waitFirst: πρώτα παύση, μετά ανάγνωση', slept.join(',') === '5,6' && reads === 2 && !r.arrived)
  }
  {
    let reads = 0
    const r = await pollUntil<PlanProfileRow>({
      read: async () => { reads++; if (reads === 1) throw new Error('δίκτυο'); return { plan: 'solo', subscription_status: 'active' } },
      done: row => subscriptionArrived(row, NOW),
      delays: [1],
      sleep: async () => {},
    })
    ok('αποτυχημένη ανάγνωση δεν ρίχνει, μετρά ως «όχι ακόμη»', r.arrived && reads === 2)
  }
  {
    let reads = 0
    let stop = false
    const r = await pollUntil<PlanProfileRow>({
      read: async () => { reads++; stop = true; return null },
      done: () => false,
      delays: [1, 1, 1],
      sleep: async () => {},
      cancelled: () => stop,
    })
    ok('η ακύρωση σταματά πριν την επόμενη ανάγνωση', !r.arrived && reads === 1)
  }
  {
    const total = PLAN_POLL_DELAYS_MS.reduce((a, b) => a + b, 0)
    ok('το συνολικό όριο είναι πεπερασμένο και κάτω από ένα λεπτό', total > 10_000 && total < 60_000)
    ok('το μήνυμα της καθυστέρησης δεν λέει ότι το πακέτο άλλαξε', !/είναι πλέον/.test(CHECKOUT_RETURN_SAY.late))
  }

  // ── ΟΙ ΣΤΗΛΕΣ: ΟΣΑ ΔΙΑΒΑΖΟΝΤΑΙ, ΖΗΤΙΟΥΝΤΑΙ ──────────────────────────────
  {
    const cols = new Set(PLAN_COLUMNS.split(',').map(c => c.trim()))
    const touched = new Set<string>()
    const spy = new Proxy({} as Record<string, unknown>, { get: (_t, k) => { if (typeof k === 'string') touched.add(k); return undefined } })
    planFieldsFromRow(spy as PlanProfileRow, NOW)
    const missing = [...touched].filter(k => !cols.has(k))
    ok(`κάθε στήλη που διαβάζεται ζητιέται (λείπουν: ${missing.join(', ') || 'καμία'})`, missing.length === 0)
    ok('οι θέσεις από προσκλήσεις ζητιούνται', cols.has('bonus_properties') && cols.has('bonus_properties_until'))
  }
  {
    const f = planFieldsFromRow({ plan: 'solo', bonus_properties: 2, bonus_properties_until: '2027-01-01', comp_plan: 'plus' }, NOW)
    ok('οι θέσεις από προσκλήσεις φτάνουν στην οθόνη', f.bonusProperties === 2 && f.bonusUntil === '2027-01-01')
    ok('μηδέν θέσεις μένει μηδέν', planFieldsFromRow({ bonus_properties: 0 }, NOW).bonusProperties === 0)
    ok('χωρίς προφίλ: δωρεάν', planFieldsFromRow(null, NOW).plan === 'free')
  }

  // ── ΟΙ ΔΥΟ ΑΝΑΓΝΩΣΕΙΣ ΧΡΗΣΙΜΟΠΟΙΟΥΝ ΤΙΣ ΙΔΙΕΣ ΣΤΗΛΕΣ ─────────────────────
  // Οι Ρυθμίσεις έγραφαν δική τους λίστα με το χέρι και ξέχασαν δύο στήλες.
  {
    const settings = readFileSync('app/dashboard/components/TabSettings.tsx', 'utf8')
    const dash = readFileSync('app/dashboard/components/shell/useDashboard.ts', 'utf8')
    ok('οι Ρυθμίσεις ζητούν τις στήλες από το PLAN_COLUMNS', /billing\.profile<[^>]*>\(\s*supabase,\s*userId,\s*PLAN_COLUMNS\)/.test(settings))
    // κυριολεκτικό-πρότυπο: ψάχνουμε το κείμενο της πηγής, όχι την τιμή του.
    ok('ο πίνακας ζητά τις στήλες από το PLAN_COLUMNS', dash.includes('`${PLAN_COLUMNS}, profile_type, legal_form`'))
    ok('ο πίνακας διαβάζει την επιστροφή από το ταμείο', dash.includes('takeCheckoutReturn(window.location.search)'))
    ok('οι Ρυθμίσεις ξαναδιαβάζουν όταν αλλάξει το planVersion', /useEffect\(\(\) => \{ loadPlan\(\); \}, \[loadPlan, planVersion\]\)/.test(settings))
    ok('η κάρτα χρέωσης ειδοποιεί τον γονέα', settings.includes('onPlanChanged={planChanged}'))
  }

  console.log(fail === 0 ? `✓ planRefresh: ${pass} έλεγχοι πέρασαν` : `✗ planRefresh: ${fail} απέτυχαν από ${pass + fail}`)
  if (fail > 0) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
