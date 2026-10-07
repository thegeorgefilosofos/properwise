// ═══════════════════════════════════════════════════════════════════════════
// Η ΠΑΛΙΑ ΑΠΑΝΤΗΣΗ ΔΕΝ ΓΡΑΦΕΙ ΠΑΝΩ ΣΤΗ ΝΕΑ ΚΑΙ Η ΡΙΠΗ ΓΙΝΕΤΑΙ ΜΙΑ ΦΟΡΤΩΣΗ
// ─────────────────────────────────────────────────────────────────────────
// Ο μηχανισμός του app/hooks/useLoad.ts, σε σκέτο Node, με ψεύτικους
// χρονομετρητές ώστε το «μέσα σε 300ms» να ελέγχεται χωρίς αναμονή.
//
// Τι καρφώνεται:
//   · αρίθμηση: η παλαιότερη φόρτωση που απαντά ΤΕΛΕΥΤΑΙΑ μαθαίνει ότι δεν
//     είναι η τελευταία και το σήμα της έχει ακυρωθεί·
//   · συγχώνευση: δέκα `schedule()` μέσα στο παράθυρο, μία φόρτωση·
//   · μια άμεση εκτέλεση απορροφά την εκκρεμή συγχωνευμένη·
//   · μετά την αποχώρηση της οθόνης καμία απάντηση δεν είναι η τελευταία.
//
// Τρέξε: npx tsx app/hooks/useLoad.test.ts
// ═══════════════════════════════════════════════════════════════════════════
import { createLoadRunner, COALESCE_MS, type LoadTurn } from './useLoad'

let passed = 0, failed = 0
const fails: string[] = []
const ok = (name: string, cond: boolean) => { if (cond) passed++; else { failed++; fails.push(name) } }

/** Ψεύτικοι χρονομετρητές: ο χρόνος προχωρά μόνο όταν το λέμε. */
function fakeTimers() {
  let now = 0
  let nextId = 1
  const pending = new Map<number, { at: number; fn: () => void }>()
  return {
    setTimeout: (fn: () => void, ms: number) => { const id = nextId++; pending.set(id, { at: now + ms, fn }); return id },
    clearTimeout: (id: unknown) => { pending.delete(id as number) },
    advance(ms: number) {
      now += ms
      for (const [id, t] of [...pending]) if (t.at <= now) { pending.delete(id); t.fn() }
    },
    count: () => pending.size,
  }
}

/** Υπόσχεση που λύνεται όταν το πούμε: το «δίκτυο» με τη σειρά που θέλουμε. */
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(r => { resolve = r })
  return { promise, resolve }
}

const tick = () => new Promise<void>(r => setTimeout(r, 0))

async function run() {
  // ── 1. ΑΡΙΘΜΗΣΗ: η παλαιότερη απάντηση που έρχεται τελευταία δεν γράφει ──
  {
    const r = createLoadRunner({ timers: fakeTimers() })
    let state = 'κενό'
    const turns: LoadTurn[] = []
    const net = [deferred(), deferred()]
    let call = 0
    const load = async (turn: LoadTurn) => {
      const mine = call++
      turns.push(turn)
      await net[mine].promise
      if (!turn.isLatest()) return
      state = mine === 0 ? 'παλιά' : 'νέα'
    }
    const first = r.run(load)
    const second = r.run(load)
    ok('η πρώτη εκτέλεση δεν είναι πια η τελευταία', turns[0].isLatest() === false)
    ok('το σήμα της πρώτης ακυρώθηκε μόλις ξεκίνησε η δεύτερη', turns[0].signal.aborted === true)
    ok('η δεύτερη είναι η τελευταία', turns[1].isLatest() === true && !turns[1].signal.aborted)
    net[1].resolve(); await second
    ok('η νέα απάντηση γράφτηκε', state === 'νέα')
    net[0].resolve(); await first
    ok('η παλιά απάντηση που ήρθε ΜΕΤΑ δεν έγραψε από πάνω', state === 'νέα')
  }

  // ── 2. Η φόρτωση ξεκινά σύγχρονα, όπως με το χειρόγραφο effect ───────────
  {
    const r = createLoadRunner({ timers: fakeTimers() })
    let started = false
    const p = r.run(async () => { started = true })
    ok('η run() καλεί τη φόρτωση πριν επιστρέψει', started)
    await p
  }

  // ── 3. ΣΥΓΧΩΝΕΥΣΗ: ριπή δέκα συμβάντων, μία φόρτωση ─────────────────────
  {
    const t = fakeTimers()
    const r = createLoadRunner({ timers: t })
    let loads = 0
    await r.run(async () => { loads++ })
    ok('η αρχική φόρτωση έτρεξε μία φορά', loads === 1)
    const waits: Promise<void>[] = []
    let resolved = 0
    for (let i = 0; i < 10; i++) {
      waits.push(r.schedule().then(() => { resolved++ }))
      t.advance(20)   // 10 × 20ms = 200ms < 300ms
    }
    await tick()
    ok('καμία φόρτωση πριν κλείσει το παράθυρο', loads === 1)
    ok('ένας μόνο χρονομετρητής για όλη τη ριπή', t.count() === 1)
    t.advance(COALESCE_MS)
    await Promise.all(waits)
    ok('η ριπή έγινε ΜΙΑ φόρτωση', loads === 2)
    ok('και οι δέκα αναμονές λύθηκαν από αυτήν', resolved === 10)
    // Νέο συμβάν μετά το παράθυρο: νέα φόρτωση.
    const again = r.schedule()
    t.advance(COALESCE_MS)
    await again
    ok('συμβάν μετά το παράθυρο φέρνει νέα φόρτωση', loads === 3)
  }

  // ── 4. Η συγχωνευμένη τρέχει την ΤΡΕΧΟΥΣΑ φόρτωση, όχι την πρώτη ────────
  {
    const t = fakeTimers()
    const r = createLoadRunner({ timers: t })
    const seen: string[] = []
    await r.run(async () => { seen.push('ακίνητο Α') })
    await r.run(async () => { seen.push('ακίνητο Β') })
    const p = r.schedule()
    t.advance(COALESCE_MS)
    await p
    ok('η reload ξανατρέχει την τελευταία load', seen.join('|') === 'ακίνητο Α|ακίνητο Β|ακίνητο Β')
  }

  // ── 5. Μια άμεση εκτέλεση απορροφά την εκκρεμή συγχωνευμένη ─────────────
  {
    const t = fakeTimers()
    const r = createLoadRunner({ timers: t })
    let loads = 0
    const load = async () => { loads++ }
    await r.run(load)
    const waiting = r.schedule()
    await r.run(load)
    await waiting
    ok('η αναμονή λύθηκε από την άμεση εκτέλεση', loads === 2)
    ok('ο χρονομετρητής καθαρίστηκε', t.count() === 0)
    t.advance(COALESCE_MS * 2)
    await tick()
    ok('δεν ακολουθεί δεύτερη, περιττή φόρτωση', loads === 2)
  }

  // ── 6. Η οθόνη έφυγε: καμία απάντηση δεν είναι πια η τελευταία ──────────
  {
    const t = fakeTimers()
    const r = createLoadRunner({ timers: t })
    let turn: LoadTurn | null = null
    const net = deferred()
    const p = r.run(async x => { turn = x; await net.promise })
    let loads = 0
    const waiting = r.schedule().then(() => { loads++ })
    r.cancel()
    ok('η εκτέλεση σε πτήση δεν είναι πια η τελευταία', (turn as LoadTurn | null)?.isLatest() === false)
    ok('και το σήμα της ακυρώθηκε', (turn as LoadTurn | null)?.signal.aborted === true)
    ok('η εκκρεμής συγχωνευμένη ακυρώθηκε', t.count() === 0)
    await waiting
    ok('όποιος περίμενε δεν έμεινε κρεμασμένος', loads === 1)
    net.resolve(); await p
  }

  // ── 7. Χωρίς παράθυρο, η reload τρέχει αμέσως ────────────────────────────
  {
    const r = createLoadRunner({ coalesceMs: 0, timers: fakeTimers() })
    let loads = 0
    const load = async () => { loads++ }
    await r.run(load)
    await r.schedule()
    ok('coalesceMs 0: άμεση φόρτωση', loads === 2)
  }

  // ── 8. Το σφάλμα της φόρτωσης φτάνει σε όποιον περιμένει ────────────────
  {
    const t = fakeTimers()
    const r = createLoadRunner({ timers: t })
    let fail = false
    const load = async () => { if (fail) throw new Error('δίκτυο') }
    await r.run(load)
    fail = true
    const p = r.schedule()
    t.advance(COALESCE_MS)
    let caught = ''
    await p.catch((e: Error) => { caught = e.message })
    ok('η απόρριψη έφτασε στην αναμονή', caught === 'δίκτυο')
  }

  console.log(`useLoad: ${passed} ✓ · ${failed} ✗`)
  if (failed) { for (const f of fails) console.log('  ✗ ' + f); process.exit(1) }
}

run().catch(e => { console.error(e); process.exit(1) })
