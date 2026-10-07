// ═══════════════════════════════════════════════════════════════════════════
// Ο ΕΝΟΙΚΙΑΣΤΗΣ ΣΒΗΝΕΤΑΙ ΟΛΟΣ Ή ΚΑΘΟΛΟΥ ΚΑΙ ΤΟ ΑΜΕΤΑΚΛΗΤΟ ΠΑΕΙ ΤΕΛΕΥΤΑΙΟ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ. Η «Οριστική διαγραφή» ήταν τέσσερα αιτήματα από τον περιηγητή:
// πρώτα το PDF του μισθωτηρίου, μετά οι δόσεις, οι φθορές και ο ενοικιαστής.
// Αν αποτύγχανε ένα από τα τελευταία, ο ενοικιαστής έμενε στην οθόνη χωρίς
// μισθωτήριο και χωρίς ιστορικό πληρωμών (Ε2, έσοδα της χρονιάς).
//
// Τι καρφώνεται:
//   1. ΣΥΜΠΕΡΙΦΟΡΑ (`purgeTenant`, με ψεύτικη βάση): τα αρχεία δεν αγγίζονται
//      αν η `delete_tenant` αποτύχει· σβήνονται μετά την επιτυχία της· η
//      αποτυχία τους λέγεται χωρίς να γυρίζει πίσω τη διαγραφή.
//   2. ΔΟΜΗ (κείμενο του TabTenant.tsx): η διαγραφή δεν ξαναγράφεται ως σειρά
//      αιτημάτων από τον περιηγητή και το κουμπί είναι κάδος, όχι «×».
//   3. Η ΜΕΤΑΝΑΣΤΕΥΣΗ (κείμενο): SECURITY INVOKER ώστε να ισχύει η RLS,
//      σταθερό search_path, κανένα δικαίωμα στον ανώνυμο, κανένα σβήσιμο από
//      τον χώρο αποθήκευσης μέσα στη βάση.
//
// Η συμπεριφορά της ίδιας της συνάρτησης (ξένος χρήστης, δόση που δεν
// σβήνεται, κανονική διαγραφή, δεύτερη κλήση) ελέγχθηκε σε Postgres με όλες
// τις μεταναστεύσεις· εδώ δεν υπάρχει βάση.
//
// Τρέξε: npx tsx app/dashboard/components/TabTenantDelete.test.ts
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { purgeTenant } from './TabTenant'

let passed = 0, failed = 0
const fails: string[] = []
const ok = (name: string, cond: boolean) => { if (cond) passed++; else { failed++; fails.push(name) } }

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..')
const SRC = readFileSync(join(HERE, 'TabTenant.tsx'), 'utf8')
const MIG_DIR = join(ROOT, 'supabase', 'migrations')
const MIG_FILE = readdirSync(MIG_DIR).find(f => f.startsWith('20261007130000_'))
const MIG = MIG_FILE ? readFileSync(join(MIG_DIR, MIG_FILE), 'utf8') : ''

/** Ψεύτικη βάση που γράφει τη σειρά των κλήσεων. */
function fakeDb(rpc: { data: unknown; error: { message: string; code?: string } | null }, rm: { error: { message: string } | null } | 'throw' = { error: null }) {
  const calls: string[] = []
  const removed: string[][] = []
  return {
    calls, removed,
    io: {
      deleteRows: async () => { calls.push('rpc'); return rpc },
      removeFiles: async (paths: string[]) => {
        calls.push('remove'); removed.push(paths)
        if (rm === 'throw') throw new Error('δίκτυο')
        return rm
      },
    },
  }
}

async function run() {
  // ── 1α. Η βάση αρνείται: κανένα αρχείο δεν αγγίζεται ─────────────────────
  for (const [code, message] of [
    ['P0002', 'tenant_not_found'],
    ['42501', 'payments_not_deletable'],
    ['42501', 'tenant_not_deletable'],
    ['08006', 'connection lost'],
  ] as const) {
    const db = fakeDb({ data: null, error: { code, message } })
    const r = await purgeTenant(db.io)
    ok(`${message}: αποτυχία`, r.ok === false)
    ok(`${message}: το μισθωτήριο ΔΕΝ σβήστηκε`, db.calls.join(',') === 'rpc')
    ok(`${message}: το μήνυμα λέει ότι δεν διαγράφηκε τίποτα`, !r.ok && /Δεν διαγράφηκε τίποτα|δεν διαγράφηκε τίποτα/.test(r.error))
    ok(`${message}: το μήνυμα είναι ελληνικό, όχι ο κωδικός`, !r.ok && !r.error.includes(message))
  }

  // ── 1β. Επιτυχία: πρώτα οι γραμμές, ΜΕΤΑ τα αρχεία ──────────────────────
  {
    const paths = ['u/t/misthotirio.pdf', 'u/t/parartima.pdf']
    const db = fakeDb({ data: { paths, payments: 14, damages: 2 }, error: null })
    const r = await purgeTenant(db.io)
    ok('επιτυχία', r.ok === true)
    ok('η σειρά είναι rpc και μετά remove', db.calls.join(',') === 'rpc,remove')
    ok('σβήνονται ακριβώς τα αρχεία που επέστρεψε η βάση', JSON.stringify(db.removed[0]) === JSON.stringify(paths))
    ok('οι μετρήσεις περνούν', r.ok && r.payments === 14 && r.damages === 2 && r.files === 2 && r.filesError === null)
  }

  // ── 1γ. Χωρίς αρχεία: καμία κλήση στον χώρο αποθήκευσης ──────────────────
  {
    const db = fakeDb({ data: { paths: [], payments: 0, damages: 0 }, error: null })
    const r = await purgeTenant(db.io)
    ok('χωρίς αρχεία, μόνο rpc', r.ok && db.calls.join(',') === 'rpc')
  }

  // ── 1δ. Το αρχείο δεν σβήστηκε: λέγεται, η διαγραφή μένει ───────────────
  for (const rm of [{ error: { message: 'storage down' } }, 'throw'] as const) {
    const db = fakeDb({ data: { paths: ['u/t/a.pdf'], payments: 1, damages: 0 }, error: null }, rm)
    const r = await purgeTenant(db.io)
    ok(`αποτυχία αρχείων (${rm === 'throw' ? 'throw' : 'error'}): ο ενοικιαστής μετρά ως διαγραμμένος`, r.ok === true)
    ok(`αποτυχία αρχείων (${rm === 'throw' ? 'throw' : 'error'}): λέγεται`, r.ok && !!r.filesError && r.filesError.startsWith('Ο ενοικιαστής διαγράφηκε, αλλά το μισθωτήριο'))
  }

  // ── 1ε. Απάντηση με άκυρο σχήμα δεν σβήνει τίποτα στα τυφλά ──────────────
  {
    const db = fakeDb({ data: { paths: [null, 3, ''] }, error: null })
    const r = await purgeTenant(db.io)
    ok('άκυρες διαδρομές αγνοούνται', r.ok && r.files === 0 && db.calls.join(',') === 'rpc')
  }

  // ── 2. ΔΟΜΗ ΤΟΥ TabTenant.tsx ─────────────────────────────────────────────
  const start = SRC.indexOf('const delTenant=')
  const end = SRC.indexOf('};', start)
  const del = start >= 0 ? SRC.slice(start, end) : ''
  ok('η delTenant υπάρχει', del.length > 0)
  ok('η delTenant καλεί τη delete_tenant', del.includes("rpc('delete_tenant'"))
  ok('η delTenant δεν σβήνει δόσεις από τον περιηγητή', !del.includes('removeOfTenant'))
  ok('η delTenant δεν σβήνει φθορές από τον περιηγητή', !/tenant_damages'\)\.delete/.test(del))
  ok('η delTenant δεν σβήνει τη γραμμή του ενοικιαστή από τον περιηγητή', !del.includes('tenantStore.remove('))
  ok('η delTenant δεν ψάχνει μόνη της στον χώρο αποθήκευσης', !del.includes('.list('))
  ok('ζητά επιβεβαίωση πριν από οτιδήποτε', del.indexOf('confirmDialog(') >= 0 && del.indexOf('confirmDialog(') < del.indexOf('purgeTenant('))

  const btn = SRC.slice(SRC.indexOf('onClick={()=>delTenant(t)}') - 300, SRC.indexOf('onClick={()=>delTenant(t)}') + 200)
  ok('το κουμπί έχει λεκτικό «Διαγραφή ενοικιαστή»', btn.includes('label={`Διαγραφή ενοικιαστή'))
  ok('το κουμπί έχει τόνο κινδύνου', btn.includes('tone="danger"'))
  ok('το κουμπί δείχνει κάδο', btn.includes('<Trash2'))
  ok('το κουμπί δεν δείχνει πια «×»', !btn.includes('M18 6 6 18'))

  // ── 3. Η ΜΕΤΑΝΑΣΤΕΥΣΗ ─────────────────────────────────────────────────────
  const code = MIG.split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
  ok('η μετανάστευση υπάρχει', MIG_FILE !== undefined)
  ok('SECURITY INVOKER, ώστε να κρίνει η RLS', /\bsecurity\s+invoker\b/i.test(code) && !/\bsecurity\s+definer\b/i.test(code))
  ok('σταθερό search_path', /set\s+search_path\s*=\s*'public',\s*'pg_temp'/i.test(code))
  ok('κανένα δικαίωμα στον ανώνυμο', /revoke\s+all\s+on\s+function\s+public\.delete_tenant\(uuid\)\s+from\s+public,\s*anon/i.test(code))
  ok('εκτελεί μόνο ο συνδεδεμένος', /grant\s+execute\s+on\s+function\s+public\.delete_tenant\(uuid\)\s+to\s+authenticated\s*;/i.test(code))
  ok('δεν σβήνει από storage.objects (guard-storage-delete)', !/delete\s+from\s+storage\.objects/i.test(code))
  ok('κλειδώνει τον ενοικιαστή', /for\s+update/i.test(code))
  const iDam = code.indexOf('delete from public.tenant_damages')
  const iPay = code.indexOf('delete from public.rent_payments')
  const iTen = code.indexOf('delete from public.tenants')
  ok('σβήνει φθορές, δόσεις και ενοικιαστή, με αυτή τη σειρά', iDam > 0 && iPay > iDam && iTen > iPay)
  ok('η δόση που κρύβει η RLS από τη διαγραφή ακυρώνει τα πάντα', code.includes('payments_not_deletable'))
  ok('ο ενοικιαστής που δεν σβήνεται ακυρώνει τα πάντα', code.includes('tenant_not_deletable'))
  ok('επιστρέφει τις διαδρομές του lease-documents', code.includes("'lease-documents'") && code.includes("'paths'"))

  console.log(`TabTenant διαγραφή: ${passed} ✓ · ${failed} ✗`)
  if (failed) { for (const f of fails) console.log('  ✗ ' + f); process.exit(1) }
}

run().catch(e => { console.error(e); process.exit(1) })
