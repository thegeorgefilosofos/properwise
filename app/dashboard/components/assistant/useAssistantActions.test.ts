// ═══════════════════════════════════════════════════════════════════════════
// Η ΝΟΑ ΧΩΡΙΣ ΑΚΙΝΗΤΟ ΔΕΝ ΑΓΓΙΖΕΙ ΤΗ ΒΑΣΗ
// ─────────────────────────────────────────────────────────────────────────
// Το `useAssistantActions` δεν έχει ούτε ένα hook της React μέσα του: είναι
// συνάρτηση που παίρνει κατάσταση και επιστρέφει χειριστές. Άρα δοκιμάζεται
// όπως είναι, χωρίς περιηγητή.
//
// ΤΙ ΚΡΙΝΕΤΑΙ. Πριν από το πρώτο ακίνητο (propertyId = null) κάθε ενέργεια που
// γράφει πρέπει να σταματά ΠΡΙΝ από το πρώτο ερώτημα: η δαπάνη, η εκκρεμότητα
// και το ραντεβού θα γράφονταν με κενό `property_id`, η επαφή και ο σύνδεσμος
// άφιξης θα άνοιγαν πρώτα το παράθυρο της σύμβασης επεξεργασίας. Ο ψεύτικος
// πελάτης της βάσης καταγράφει ΚΑΘΕ πρόσβαση· χωρίς ακίνητο πρέπει να μείνει
// άδειος.
//
// Τρέξε: npx tsx app/dashboard/components/assistant/useAssistantActions.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// Με άλλο όνομα, γιατί το «use» στην αρχή κάνει τον κανόνα των hooks να το
// κρίνει σαν hook. Δεν είναι: μέσα του δεν καλείται κανένα hook της React.
import { useAssistantActions as buildActions } from './useAssistantActions'
import { SETUP_REFUSAL, type AssistantAction } from '../assistantPersona'
import type { Msg } from './model'
import type { ScannedDoc } from '@/lib/billing/documents'

let passed = 0, failed = 0
const fails: string[] = []
const ok = (name: string, cond: boolean) => { if (cond) passed++; else { failed++; fails.push(name) } }

type Args = Parameters<typeof buildActions>[0]

/** Ψεύτικος πελάτης βάσης: κάθε ιδιότητα που ζητείται γράφεται στο `touched`. */
function spySupabase(touched: string[]) {
  const chain: unknown = new Proxy(function () { /* κλήση */ }, {
    get(_t, prop) {
      if (prop === 'then') return undefined   // να μη μοιάζει με υπόσχεση
      touched.push(String(prop))
      return chain
    },
    apply() { return chain },
  })
  return chain as Args['supabase']
}

function harness(propertyId: string | null) {
  const touched: string[] = []
  let msgs: Msg[] = []
  const calls = { scan: 0, add: 0, feedback: 0, nav: [] as string[], busy: [] as boolean[], close: 0 }
  const args: Args = {
    onScan: () => { calls.scan++ },
    onNavigate: (t: string) => { calls.nav.push(t) },
    onAddProperty: () => { calls.add++ },
    setFeedbackOpen: ((v: boolean) => { if (v) calls.feedback++ }) as Args['setFeedbackOpen'],
    setOpen: ((v: boolean) => { if (!v) calls.close++ }) as Args['setOpen'],
    clientsLite: [{ id: 'c1', name: 'Γιάννης', phone: '6912345678', afm: '' }],
    contactsLite: [{ name: 'Κώστας', role: 'plumber', phone: '6912345678', email: '' }],
    setMsgs: ((u: Msg[] | ((m: Msg[]) => Msg[])) => { msgs = typeof u === 'function' ? u(msgs) : u }) as Args['setMsgs'],
    pendingDoc: { doc: { doc_type: 'bill', title: 'ΔΕΗ', amount: 120 } as unknown as ScannedDoc, file: {} as File },
    busy: false,
    setBusy: ((v: boolean) => { calls.busy.push(v) }) as Args['setBusy'],
    propertyId, userId: 'u1',
    setReconcile: (() => {}) as Args['setReconcile'],
    setPendingDoc: (() => {}) as Args['setPendingDoc'],
    setCtxStr: (() => {}) as Args['setCtxStr'],
    loadContext: async () => {},
    supabase: spySupabase(touched),
    openBills: [{ id: 'b1', name: 'ΔΕΗ', category: 'electricity', amount: 120 }],
    openRent: [],
    setClientsStr: (() => {}) as Args['setClientsStr'],
  }
  return { api: buildActions(args), touched, calls, msgs: () => msgs }
}

// Οι ενέργειες τρέχουν χωρίς await (όπως από το κουμπί): περιμένουμε να
// τελειώσει ό,τι ξεκίνησαν πριν κρίνουμε.
const settle = () => new Promise(r => setTimeout(r, 20))

const WRITES: AssistantAction[] = [
  { type: 'expense', description: 'Υδραυλικός', amount: 80 },
  { type: 'task', description: 'Αλλαγή κλειδαριάς', due_date: '2026-11-01' },
  { type: 'paid', description: 'ΔΕΗ', amount: 120 },
  { type: 'book', title: 'Επίσκεψη τεχνικού', date: '2026-11-03' },
  { type: 'contact', name: 'Κώστας', phone: '6912345678' },
  { type: 'inventory', name: 'Πλυντήριο', value: 450 },
  { type: 'checkin', who: 'Γιάννης' },
  { type: 'client', name: 'Γιάννης', phone: '6912345678' },
  { type: 'reach', name: 'Κώστας', channel: 'call' },
  { type: 'commit-doc', label: 'ΔΕΗ' },
  { type: 'go', tab: 'finances' },
]

async function main() {
  // ── Χωρίς ακίνητο: καμία ενέργεια εγγραφής δεν φτάνει στη βάση ─────────────
  for (const a of WRITES) {
    const h = harness(null)
    h.api.runAction(a)
    await settle()
    ok(`χωρίς ακίνητο το ${a.type} δεν αγγίζει τη βάση (άγγιξε: ${h.touched.slice(0, 4).join(',')})`, h.touched.length === 0)
    const last = h.msgs().at(-1)
    ok(`χωρίς ακίνητο το ${a.type} απαντά με την άρνηση`, last?.text === SETUP_REFUSAL)
    ok(`χωρίς ακίνητο το ${a.type} δείχνει τον δρόμο: προσθήκη ακινήτου`, last?.action?.type === 'add-property')
    ok(`χωρίς ακίνητο το ${a.type} δεν πλοηγεί πουθενά`, h.calls.nav.length === 0)
  }

  // Η καταχώρηση σαρωμένου εγγράφου καλείται και ΑΠΕΥΘΕΙΑΣ από τα κουμπιά της
  // ερώτησης συμφωνίας, όχι μόνο από το runAction.
  {
    const h = harness(null)
    await h.api.commitPendingDoc(null)
    await settle()
    ok('χωρίς ακίνητο η απευθείας καταχώρηση εγγράφου δεν ξεκινά', h.calls.busy.length === 0 && h.touched.length === 0)
  }

  // ── Χωρίς ακίνητο: οι ενέργειες του πρώτου βήματος δουλεύουν ──────────────
  {
    const h = harness(null)
    h.api.runAction({ type: 'add-property' })
    ok('προσθήκη ακινήτου → ανοίγει ο οδηγός', h.calls.add === 1)
    ok('προσθήκη ακινήτου → το πάνελ κλείνει για να φανεί ο οδηγός', h.calls.close === 1)
    h.api.runAction({ type: 'scan' })
    ok('σάρωση → περνά από τον οδηγό του γονέα', h.calls.scan === 1)
    h.api.runAction({ type: 'feedback' })
    ok('αξιολόγηση → ανοίγει', h.calls.feedback === 1)
    await settle()
    ok('οι ενέργειες του πρώτου βήματος δεν αγγίζουν τη βάση', h.touched.length === 0)
  }

  // ── Με ακίνητο: ο φράχτης δεν κόβει τίποτα ─────────────────────────────────
  // Χωρίς αυτόν τον έλεγχο, ένας φράχτης που κόβει τα πάντα θα περνούσε τα
  // παραπάνω. Η δαπάνη με ακίνητο ΠΡΕΠΕΙ να φτάσει στη βάση.
  {
    const h = harness('prop-1')
    h.api.runAction({ type: 'expense', description: 'Υδραυλικός', amount: 80 })
    await settle()
    ok('με ακίνητο η δαπάνη φτάνει στη βάση', h.touched.includes('from'))
    ok('με ακίνητο καμία άρνηση', !h.msgs().some(m => m.text === SETUP_REFUSAL))
    const g = harness('prop-1')
    g.api.runAction({ type: 'go', tab: 'finances' })
    ok('με ακίνητο η πλοήγηση περνά', g.calls.nav.join() === 'finances')
  }

  console.log(`\nuseAssistantActions (χωρίς ακίνητο), ${passed} passed, ${failed} failed`)
  if (failed) { console.log('FAILED:\n' + fails.map(f => '  ✗ ' + f).join('\n')); process.exit(1) }
  console.log('όλα πέρασαν')
}

void main()
