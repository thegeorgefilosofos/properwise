// ═══════════════════════════════════════════════════════════════════════════
// Shared cron/service authorization for edge functions — one source of truth.
//
// Before this, every cron function inlined the same three-way check with plain
// `===` string comparison, which is timing-unsafe (an attacker can, in theory,
// recover a secret byte-by-byte from response-time differences) and drifted
// subtly between functions. This centralises it with a constant-time compare.
//
// The real protection is still the 122-bit secret itself; the constant-time
// compare is defense-in-depth and, more importantly, makes the authz identical
// and auditable across all functions.
// ═══════════════════════════════════════════════════════════════════════════

// Constant-time string equality. Runs over the longer of the two inputs and
// folds any length mismatch into the result, so it does not early-return on the
// first differing byte (which is what leaks timing).
export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const ba = enc.encode(a ?? '')
  const bb = enc.encode(b ?? '')
  const len = Math.max(ba.length, bb.length)
  let diff = ba.length ^ bb.length
  for (let i = 0; i < len; i++) diff |= (ba[i] ?? 0) ^ (bb[i] ?? 0)
  return diff === 0
}

/**
 * The minimal shape of a Supabase client this module needs: we only ever call
 * `.from('cron_secrets').select().eq().maybeSingle()`.
 *
 * Exported so callers can annotate their own helpers with the SAME type instead
 * of re-declaring it. That matters: `ReturnType<typeof createClient>` does not
 * work here — with the `npm:` specifier `createClient` is a generic const arrow,
 * so `ReturnType<>` instantiates it with `unknown`/`never` and every call site
 * fails with TS2345. One structural type, declared once, used by everyone.
 */
// Η ΜΟΝΑΔΙΚΗ ΑΛΥΣΙΔΑ ΠΟΥ ΚΑΛΕΙΤΑΙ ΕΔΩ, ΔΗΛΩΜΕΝΗ ΑΝΤΙ ΓΙΑ `any`.
//
// ΓΙΑΤΙ `unknown` ΣΤΗΝ ΕΠΙΣΤΡΟΦΗ ΤΟΥ `from`, ΚΑΙ ΟΧΙ Η ΑΛΥΣΙΔΑ ΑΠΕΥΘΕΙΑΣ: αν ο
// τύπος περιγράψει τα τρία βήματα εκεί, ο μεταγλωττιστής πρέπει να συγκρίνει
// τους πλήρεις γενικούς τύπους του PostgREST με αυτόν — και σκάει με
// «Type instantiation is excessively deep» σε δέκα συναρτήσεις ακρου. Με
// `unknown` η ανάθεση δεν κοστίζει τίποτε και ο ισχυρισμός γίνεται ΜΙΑ φορά,
// εδώ, ακριβώς πάνω στις τρεις μεθόδους που πράγματι καλούνται.
interface CronSecretFilter {
  eq: (column: string, value: string) => CronSecretFilter
  // Το `error` ΔΗΛΩΝΕΤΑΙ, ώστε ο μεταγλωττιστής να μη δέχεται ανάγνωση που το αγνοεί.
  maybeSingle: () => PromiseLike<{ data: { secret?: string | null } | null; error: { message?: string } | null }>
}
interface CronSecretTable {
  select: (columns: string) => CronSecretFilter
}

export type MinimalSupabaseClient = { from: (table: string) => unknown }

interface CronAuthOpts {
  serviceKey?: string        // SUPABASE_SERVICE_ROLE_KEY — accepted as Bearer
  envSecret?: string         // per-function *_CRON_SECRET env (optional)
  supabase?: MinimalSupabaseClient
  dbSecretName?: string | string[]  // row name(s) in public.cron_secrets (default 'email_cron')
}

// Authorize a cron/service request (zero-config): accepts (a) the service-role
// key as `Authorization: Bearer`, (b) the per-function env secret via
// `x-cron-secret`, or (c) the shared secret stored in public.cron_secrets — the
// zero-config path pg_cron uses. All comparisons are constant-time.
// ═══ «ΛΑΘΟΣ ΜΥΣΤΙΚΟ» ΚΑΙ «ΔΕΝ ΜΠΟΡΩ ΝΑ ΔΙΑΒΑΣΩ ΤΟ ΜΥΣΤΙΚΟ» ΕΙΝΑΙ ΔΥΟ ═══════
//
// Η συνάρτηση γύριζε `boolean`. Οταν η ανάγνωση του `cron_secrets` αποτύγχανε —
// η βάση σε συντήρηση, το δίκτυο κομμένο, ένα όριο συνδέσεων — το `data` ερχόταν
// κενό ΧΩΡΙΣ να κοιταχτεί το `error`, το `dbSecret` έμενε '' και η απάντηση ήταν
// η ίδια ακριβώς με του εισβολέα: 401.
//
// ΤΟ ΚΟΣΤΟΣ ΕΙΝΑΙ ΠΡΑΓΜΑΤΙΚΟ, ΟΧΙ ΘΕΩΡΗΤΙΚΟ. Το 401 λέει στον χρονοπρογραμματιστή
// «δεν έχεις δικαίωμα»: δεν ξαναδοκιμάζει. Το 503 λέει «δοκίμασε ξανά». Με τα δύο
// ενωμένα σε ένα, μια στιγμιαία διακοπή της βάσης ΑΚΥΡΩΝΕ την υπενθύμιση της
// ημέρας — και στο ημερολόγιο του `net._http_response` φαινόταν σαν λάθος
// ρύθμιση μυστικού, δηλαδή ο χειριστής θα κυνηγούσε λάθος πράγμα.
//
// Η άρνηση παραμένει άρνηση: ΚΑΝΕΝΑ μονοπάτι δεν επιτρέπει είσοδο επειδή απέτυχε
// η ανάγνωση. Αλλάζει μόνο ΤΙ ΛΕΕΙ η άρνηση.
export type CronAuth =
  | { ok: true }
  | { ok: false; reason: 'unauthorized' }
  | { ok: false; reason: 'secret_store_unreadable'; detail: string }

/** Το σώμα και ο κωδικός που ταιριάζουν στην άρνηση — ο καλών το περνά στο δικό
 *  του `json()`, ώστε να κρατήσει τις δικές του κεφαλίδες. */
export function cronDenial(a: Extract<CronAuth, { ok: false }>): [Record<string, string>, number] {
  return a.reason === 'unauthorized'
    ? [{ error: 'unauthorized' }, 401]
    : [{ error: a.reason, detail: a.detail }, 503]
}

export async function authorizeCron(req: Request, opts: CronAuthOpts): Promise<CronAuth> {
  const { serviceKey = '', envSecret = '', supabase, dbSecretName = 'email_cron' } = opts
  const bearer = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (serviceKey && timingSafeEqual(bearer, serviceKey)) return { ok: true }
  const header = req.headers.get('x-cron-secret') || ''
  if (envSecret && timingSafeEqual(header, envSecret)) return { ok: true }
  // ═══ ΤΟ ΟΝΟΜΑ ΜΠΟΡΕΙ ΝΑ ΕΙΝΑΙ ΠΕΡΙΣΣΟΤΕΡΑ ΑΠΟ ΕΝΑ, ΟΠΩΣ ΣΤΟΝ ΚΑΛΟΥΝΤΑ ═══════
  // Οι εργασίες cron γράφουν `coalesce((… 'ical_cron'), (… 'email_cron'))`:
  // στέλνουν το ειδικό μυστικό αν υπάρχει, αλλιώς το κοινό. Η συνάρτηση όμως
  // συνέκρινε με ΕΝΑ όνομα. Οταν τα δύο δεν συμπίπτουν, η κλήση γυρίζει 401 —
  // και επειδή κανείς δεν κοιτάζει το `net._http_response`, το χαρακτηριστικό
  // πεθαίνει αθόρυβα. Ο κατάλογος δοκιμάζεται με τη ΣΕΙΡΑ που τον γράφει ο
  // καλών, δηλαδή ίδια προτεραιότητα με το `coalesce`.
  const names = Array.isArray(dbSecretName) ? dbSecretName : [dbSecretName]
  // Η πρώτη αποτυχία ΑΝΑΓΝΩΣΗΣ κρατιέται στην άκρη αντί να πεταχτεί: αν κάποιο
  // από τα επόμενα ονόματα ταιριάξει, δεν έγινε τίποτα κακό ΚΑΙ η κλήση περνά.
  // Αν κανένα δεν ταιριάξει, η αποτυχία είναι η σωστότερη εξήγηση της άρνησης.
  let storeError = ''
  if (supabase && header) {
    for (const name of names) {
      try {
        const table = supabase.from('cron_secrets') as CronSecretTable
        const { data, error } = await table.select('secret').eq('name', name).maybeSingle()
        if (error) { storeError ||= error.message || String(error); continue }
        const dbSecret = data?.secret || ''
        if (dbSecret && timingSafeEqual(header, dbSecret)) return { ok: true }
      } catch (err) { storeError ||= String(err) }
    }
  }
  if (storeError) {
    console.error('[authorizeCron] δεν διαβάστηκε το cron_secrets:', storeError)
    return { ok: false, reason: 'secret_store_unreadable', detail: storeError }
  }
  return { ok: false, reason: 'unauthorized' }
}
