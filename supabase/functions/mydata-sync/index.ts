// ═══════════════════════════════════════════════════════════════════════════
// mydata-sync — ο λογιστής φέρνει τα παραστατικά των πελατών που το επέτρεψαν
// ─────────────────────────────────────────────────────────────────────────
// Πηγή: ΑΑΔΕ, myDATA REST API, τεκμηρίωση ERP v2.0.2 (09/2026), §4.1
// (κεφαλίδες) και §4.2 (RequestDocs με entityVatNumber για λογιστή). Η λογική
// ζει στο ../_shared/mydata.ts (ανάγνωση, αντιστοίχιση, σφάλματα) και στο
// ../_shared/mydataEngine.ts (σειρά βημάτων), δοκιμασμένα χωρίς δίκτυο.
//
// Ενέργειες (body.action):
//   connect    λογιστής (JWT)  δοκιμάζει το κλειδί στην ΑΑΔΕ και το φυλάει στο Vault
//   sync       λογιστής (JWT)  kind 'manual' (ανά 5 λεπτά) ή 'auto' (μετά από 12 ώρες)
//   sync-all   cron            νυχτερινός, όλοι οι λογιστές με ενεργό κλειδί
//   retry-due  cron            κάθε 15 λεπτά, μόνο πελάτες που περιμένουν νέα προσπάθεια
//
// ΑΣΦΑΛΕΙΑ
//   · Ο λογιστής βγαίνει από το JWT, ποτέ από το αίτημα. Ο,τι κρίνει ποιοι
//     πελάτες ζητούνται ζει στη βάση (mydata_sync_targets, mydata_consent_live
//     πριν από ΚΑΘΕ σελίδα και ξανά μέσα στη mydata_ingest).
//   · Το κλειδί: διαβάζεται από το Vault με τον ρόλο υπηρεσίας, μπαίνει μόνο
//     στις δύο κεφαλίδες της §4.1 και δεν επιστρέφει, δεν καταγράφεται, δεν
//     μπαίνει σε μήνυμα. Ο φύλακας scripts/guard-mydata-key.mjs το κρατά έτσι.
//   · Περιβάλλον: χωρίς `MYDATA_ENV` πάει στο ΔΟΚΙΜΑΣΤΙΚΟ της ΑΑΔΕ. Η παραγωγή
//     θέλει ρητό `MYDATA_ENV=prod`. Χωρίς `MYDATA_SYNC_ENABLED=1` δεν τρέχει
//     τίποτα (σημαία ως την απόφαση του ιδιοκτήτη για το πακέτο).
// ═══════════════════════════════════════════════════════════════════════════
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import { authorizeCron, cronDenial } from '../_shared/auth.ts'
import { reportEdgeError } from '../_shared/report.ts'
import { mydataBase, probeUrl, aadeHeaders, classifyHttp, athensIso, PARSER_VERSION } from '../_shared/mydata.ts'
import { runAccountant, type Store, type SyncKind, type EngineDeps } from '../_shared/mydataEngine.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!
const ENABLED      = Deno.env.get('MYDATA_SYNC_ENABLED') === '1'
const BASE         = mydataBase(Deno.env.get('MYDATA_ENV'), Deno.env.get('MYDATA_FAKE_URL'))

/** Πόσο τρέχει μια κλήση. Το όριο των συναρτήσεων άκρου είναι 150″. */
const BUDGET_MS = 140_000

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

/** Η βάση για τον κινητήρα. Καθε κλήση ελέγχει το `error` και πετά κωδικό, ποτέ δεδομένα. */
const store: Store = {
  async begin(accountantId, kind, actor) {
    const { data, error } = await admin.rpc('mydata_sync_begin', { p_accountant: accountantId, p_kind: kind, p_actor: actor })
    if (error) throw new Error('db_begin')
    return data as Awaited<ReturnType<Store['begin']>>
  },
  async credentials(accountantId) {
    const { data, error } = await admin.rpc('mydata_key_read', { p_accountant: accountantId })
    if (error) throw new Error('db_key')
    const row = Array.isArray(data) ? data[0] : null
    return row ? { aadeUserId: String(row.aade_user_id), key: String(row.api_key) } : null
  },
  async targets(accountantId, lease, kind) {
    const { data, error } = await admin.rpc('mydata_sync_targets', { p_accountant: accountantId, p_lease: lease, p_kind: kind, p_parser: PARSER_VERSION })
    if (error) throw new Error('db_targets')
    return ((data ?? []) as { consent_id: string; afm: string; window_from: string; last_mark: number | string; resume: unknown }[])
      .map(r => ({
        consentId: r.consent_id, afm: r.afm, windowFrom: r.window_from, lastMark: String(r.last_mark),
        resume: (r.resume && typeof r.resume === 'object') ? r.resume as NonNullable<Awaited<ReturnType<Store['targets']>>[number]['resume']> : null,
      }))
  },
  async consentLive(consentId, lease) {
    const { data, error } = await admin.rpc('mydata_consent_live', { p_consent: consentId, p_lease: lease })
    if (error) throw new Error('db_live')
    return data === true
  },
  async ingest(i) {
    const { data, error } = await admin.rpc('mydata_ingest', {
      p_lease: i.lease, p_consent: i.consentId, p_docs: i.docs, p_cancels: i.cancels,
      p_quarantine: i.quarantine, p_fetched: i.fetched, p_rejected: i.rejected,
      p_max_mark: i.maxMark, p_resume: i.resume, p_done: i.done,
    })
    if (error) throw new Error('db_ingest')
    const r = data as { ok?: boolean; added?: number } | null
    return { ok: r?.ok === true, added: Number(r?.added ?? 0) }
  },
  async clientDone(lease, consentId, err, added, more) {
    const { error } = await admin.rpc('mydata_client_done', { p_lease: lease, p_consent: consentId, p_error: err, p_added: added, p_more: more })
    if (error) throw new Error('db_client_done')
  },
  async end(accountantId, lease, err, added) {
    const { error } = await admin.rpc('mydata_sync_end', { p_accountant: accountantId, p_lease: lease, p_error: err, p_added: added })
    if (error) reportEdgeError('mydata-sync', new Error('db_end'))
  },
  // Α2: τα επιβεβαιωμένα ανά πάροχο, για το «νέος πάροχος» και το «2× τον μέσο όρο».
  async providerStats(lease, consentId) {
    const { data, error } = await admin.rpc('mydata_provider_stats', { p_lease: lease, p_consent: consentId })
    if (error) throw new Error('db_stats')
    const out: Record<string, { n: number; avgCents: number; category: string | null }> = {}
    for (const [afm, v] of Object.entries((data ?? {}) as Record<string, { n?: number; avg?: number; cat?: string | null }>)) {
      out[afm] = { n: Number(v?.n ?? 0), avgCents: Math.round(Number(v?.avg ?? 0)), category: typeof v?.cat === 'string' ? v.cat : null }
    }
    return out
  },
  async defer(accountantId, consentIds) {
    const { error } = await admin.rpc('mydata_defer', { p_accountant: accountantId, p_consents: consentIds })
    if (error) reportEdgeError('mydata-sync', new Error('db_defer'))
  },
}

const deps = (base: string, started: number): EngineDeps => ({
  store, base,
  fetch: (url, init) => fetch(url, init),
  now: () => new Date(),
  sleep: (ms) => new Promise(r => setTimeout(r, ms)),
  deadline: started + BUDGET_MS,
  // ΑΛΛΑΓΗ ΣΧΗΜΑΤΟΣ ΑΠΟ ΤΗΝ ΑΑΔΕ: τίποτα δεν γράφτηκε, ειδοποίηση σε εμάς.
  // Μόνο ο κωδικός· ποτέ σώμα απάντησης, ΑΦΜ ή όνομα.
  alert: (code, aadeCodes) => reportEdgeError('mydata-sync', new Error(`schema:${code}`), { aadeCodes: aadeCodes.join(',') }),
})

/**
 * Το όνομα του βήματος που απέτυχε, μόνο αν είναι ένας από τους δικούς μας
 * κωδικούς («db_ingest»). Μήνυμα τρίτου (βιβλιοθήκη, δίκτυο) δεν περνά ποτέ:
 * θα μπορούσε να κουβαλά διεύθυνση με ΑΦΜ ή κεφαλίδα.
 */
const codeOf = (e: unknown): string => {
  const m = e instanceof Error ? e.message : ''
  return /^db_[a-z_]{1,20}$/.test(m) ? m : 'unknown'
}

const KEY_RE = /^[A-Za-z0-9]{16,200}$/
const USER_RE = /^\S{1,100}$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const started = Date.now()
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const action = String(body.action || '')
    if (!ENABLED) return json({ ok: false, reason: 'disabled' }, 503)
    if (!BASE) {
      reportEdgeError('mydata-sync', new Error('config:MYDATA_ENV'))
      return json({ ok: false, reason: 'config' }, 500)
    }

    // ── Cron ─────────────────────────────────────────────────────────────
    if (action === 'sync-all' || action === 'retry-due' || req.headers.get('x-cron-secret')) {
      const auth = await authorizeCron(req, { serviceKey: SERVICE_KEY, supabase: admin })
      if (!auth.ok) return json(...cronDenial(auth))
      const kind: SyncKind = action === 'retry-due' ? 'retry' : 'nightly'
      const { data, error } = await admin.rpc('mydata_due_accountants', { p_kind: kind === 'retry' ? 'retry' : 'nightly' })
      if (error) {
        reportEdgeError('mydata-sync', new Error('db_due'))
        return json({ ok: false, reason: 'db' }, 503)
      }
      const ids = ((data ?? []) as (string | { mydata_due_accountants: string })[])
        .map(r => typeof r === 'string' ? r : r.mydata_due_accountants)
      let done = 0, added = 0, failed = 0
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i]
        // Οσοι λογιστές δεν πρόλαβαν: οι πελάτες τους ξαναμπαίνουν σε ένα λεπτό
        // και τους πιάνει η επανάληψη, όχι η επόμενη νύχτα.
        if (Date.now() > started + BUDGET_MS - 10_000) {
          for (const rest of ids.slice(i)) await store.defer(rest, null)
          break
        }
        // Ενας λογιστής που σκάει δεν σταματά τους υπόλοιπους.
        try {
          const r = await runAccountant(deps(BASE, started), id, kind)
          done++; added += r.added; failed += r.failed
        } catch (e) {
          reportEdgeError('mydata-sync', new Error(`run:${codeOf(e)}`))
        }
      }
      return json({ ok: true, accountants: done, of: ids.length, added, failed })
    }

    // ── Λογιστής, με το δικό του JWT ─────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) return json({ ok: false, reason: 'anonymous' }, 401)
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } })
    const { data: who, error: whoErr } = await userClient.auth.getUser(token)
    if (whoErr || !who?.user) return json({ ok: false, reason: 'anonymous' }, 401)
    const me = who.user.id

    // Η ΠΥΛΗ: ο ίδιος κανόνας με την οθόνη, ρωτημένος με το JWT του χρήστη.
    // Χωρίς δεύτερο βήμα (όπου απαιτείται) η βάση απαντά mfa_required.
    const { data: clientsNow, error: gateErr } = await userClient.rpc('mydata_clients_status')
    if (gateErr) {
      const second = gateErr.code === '42501'
      return json({ ok: false, reason: second ? 'mfa_required' : 'db' }, second ? 403 : 503)
    }
    const linked = Array.isArray(clientsNow) ? clientsNow.length : 0

    if (action === 'connect') {
      const aadeUserId = String(body.aadeUserId ?? '').trim()
      const subscriptionKey = String(body.key ?? '').trim()
      if (!USER_RE.test(aadeUserId)) return json({ ok: false, reason: 'bad_user' }, 400)
      const keyShapeOk = KEY_RE.test(subscriptionKey)
      if (!keyShapeOk) return json({ ok: false, reason: 'bad_key_shape' }, 400)
      if (linked === 0) return json({ ok: false, reason: 'no_clients' }, 403)
      const { data: quota, error: quotaErr } = await userClient.rpc('bump_send_quota', {
        p_kind: 'mydata_connect', p_units: 1, p_max: 10, p_window: '1 hour',
      })
      if (quotaErr) return json({ ok: false, reason: 'db' }, 503)
      if (!(quota as { allowed?: boolean } | null)?.allowed) return json({ ok: false, reason: 'too_many' }, 429)

      // Ο έλεγχος στην ΑΑΔΕ, πριν φυλαχτεί οτιδήποτε. Το 401 σημαίνει λάθος
      // κλειδί ή user id. Αν η ΑΑΔΕ δεν απαντά, το κλειδί φυλάγεται και
      // δοκιμάζεται στον πρώτο συγχρονισμό· η οθόνη το λέει.
      let verdict = 'network'
      try {
        const res = await fetch(probeUrl(BASE, athensIso()), { headers: aadeHeaders(aadeUserId, subscriptionKey), signal: AbortSignal.timeout(15_000) })
        verdict = classifyHttp(res.status, await res.text()).code
      } catch { verdict = 'network' }
      if (verdict === 'auth') return json({ ok: false, reason: 'key_rejected' }, 200)
      if (verdict === 'forbidden' || verdict === 'bad_request') return json({ ok: false, reason: 'key_rejected' }, 200)

      const { error: storeErr } = await admin.rpc('mydata_key_store', { p_accountant: me, p_user_id: aadeUserId, p_key: subscriptionKey })
      if (storeErr) {
        reportEdgeError('mydata-sync', new Error('db_key_store'))
        return json({ ok: false, reason: 'db' }, 503)
      }
      return json({ ok: true, verified: verdict === 'ok' })
    }

    if (action === 'sync') {
      const kind: SyncKind = body.kind === 'auto' ? 'auto' : 'manual'
      const r = await runAccountant(deps(BASE, started), me, kind, me)
      return json(r)
    }

    return json({ ok: false, reason: 'unknown_action' }, 400)
  } catch (e) {
    // Μόνο το όνομα του βήματος: τα μηνύματα του κινητήρα είναι κωδικοί.
    reportEdgeError('mydata-sync', new Error(`fatal:${codeOf(e)}`))
    return json({ ok: false, reason: 'error' }, 500)
  }
})
