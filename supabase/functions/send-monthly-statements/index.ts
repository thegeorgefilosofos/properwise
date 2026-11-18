// ─────────────────────────────────────────────────────────────────────────
// send-monthly-statements — αυτόματη μηνιαία κατάσταση εισπράξεων ενοικίων στον
// ιδιοκτήτη. Ο cron το τρέχει την 1η κάθε μήνα· για τον ΠΡΟΗΓΟΥΜΕΝΟ μήνα συνθέτει
// ανά ιδιοκτήτη μια καθαρή, branded κατάσταση (ανά ακίνητο/ενοικιαστή: αναμενόμενο,
// εισπραχθέν, κατάσταση + σύνολα) και τη στέλνει στο reminder_email του. Η ίδια
// κατάσταση είναι ήδη διαθέσιμη ζωντανά μέσα στην εφαρμογή/portal.
//
// Αυθεντικοποίηση (zero-config): x-cron-secret ή Authorization: Bearer, που
// επαληθεύεται με το κοινό μυστικό του πίνακα public.cron_secrets (ίδιο μοτίβο με
// τα υπόλοιπα cron functions). Δεν χρειάζεται κανένα χειροκίνητο μυστικό.
//
// Deploy: supabase functions deploy send-monthly-statements  (verify_jwt=false)
// Χρειάζεται RESEND_API_KEY (υπάρχει) + προαιρετικά RESEND_FROM (branded αποστολέας).
// ─────────────────────────────────────────────────────────────────────────
// Το email ζει στο _shared/statementEmail.ts, σε δύο γλώσσες· η γλώσσα κάθε
// ιδιοκτήτη από τη «Γλώσσα μηνυμάτων και email» του Λογαριασμού.
import { statementHtml, statementSubject, statementWords, periodLabelOf } from '../_shared/statementEmail.ts'
import { msgLangReader } from '../_shared/msgLang.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import { authorizeCron, cronDenial, type CronAuth } from '../_shared/auth.ts'
import { senderFrom, REPLY_TO } from '../_shared/sender.mjs'
import { allPages } from '../_shared/pages.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET    = Deno.env.get('MONTHLY_STATEMENTS_CRON_SECRET') || ''
const FROM_EMAIL     = senderFrom(Deno.env.get('RESEND_FROM'))

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } })

// Εξουσιοδότηση cron (zero-config): service-role bearer, ή x-cron-secret env, ή το
// κοινό μυστικό του πίνακα cron_secrets (το στέλνει το pg_cron).
async function authorized(req: Request): Promise<CronAuth> {
  return authorizeCron(req, { serviceKey: SERVICE_KEY, envSecret: CRON_SECRET, supabase })
}

interface Rent { property_id: string | null; tenant_id: string | null; amount: number | null; paid: boolean | null }


Deno.serve(async (req) => {
  const auth = await authorized(req)
  if (!auth.ok) return json(...cronDenial(auth))
  if (!RESEND_API_KEY) return json({ error: 'no_resend_key' }, 500)

  // Προηγούμενος μήνας.
  const now = new Date()
  let py = now.getUTCFullYear(), pm = now.getUTCMonth() // getUTCMonth: 0-11 → ο προηγούμενος μήνας (1-based) είναι ίδιος αριθμός
  if (pm === 0) { py -= 1; pm = 12 }
  const periodLabel = periodLabelOf(py, pm)
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()

  // ── ΣΕ ΠΟΙΑ ΔΙΕΥΘΥΝΣΗ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΣΤΑΛΕΙ, ΤΟ ΛΕΕΙ Η ΒΑΣΗ ──────────────
  // Το `reminder_email` είναι ελεύθερο κείμενο που έγραψε ο ιδιοκτήτης: μπορεί
  // να είναι πρώην σύντροφος, γείτονας ή παλιά διεύθυνση. Η μηνιαία κατάσταση
  // περιέχει ΚΑΘΕ όνομα ακινήτου, κάθε όνομα ενοικιαστή και τι εισπράχθηκε.
  //
  // Ο έλεγχος διπλής συναίνεσης γράφτηκε ακριβώς γι' αυτό (20260810070000) και
  // η `send-reminders` τον χρησιμοποιεί. Αυτός ο αποστολέας διάβαζε την
  // ανεπιβεβαίωτη διεύθυνση κατευθείαν από τον πίνακα και έστελνε.
  // ΑΠΟΤΥΧΙΑ ΕΔΩ ΔΕΝ ΕΙΝΑΙ «ΚΑΝΕΝΑΣ ΧΡΗΣΤΗΣ». Χωρίς το `error`, μια αποτυχία
  // γύριζε `undefined`, το `|| []` το έκανε κενό — και η εργασία απαντούσε 200
  // «no_users»: καμία μηνιαία κατάσταση σε κανέναν ιδιοκτήτη, με πράσινο
  // τρέξιμο στον πίνακα. Ιδιο σφάλμα με την αποστολή υπενθυμίσεων, ίδια λύση.
  // ΣΕ ΣΕΛΙΔΕΣ (έλεγχος κλίμακας 10/11/2026): σε ΕΝΑ αίτημα το PostgREST κόβει
  // στις 1.000 και ο ιδιοκτήτης 1.001 δεν έπαιρνε ποτέ μηνιαία κατάσταση.
  const { rows: allowedRows, error: allowedErr } = await allPages<{ user_id: string; email: string | null }>(
    (from, to) => supabase.rpc('reminder_recipients').order('user_id', { ascending: true }).range(from, to))
  if (allowedErr) {
    console.error('[monthly-statements] οι επιτρεπτοί παραλήπτες δεν διαβάστηκαν:', allowedErr)
    return json({ error: 'reminder_recipients unreadable', detail: allowedErr.message }, 500)
  }
  const prefs = ((allowedRows || []) as { user_id: string; email: string | null }[])
    .filter(r => !!r.email)
    .map(r => ({ user_id: r.user_id, reminder_email: r.email }))
  if (!prefs.length) return json({ message: 'no_users' })

  // ΤΟ «ΠΑΡΑΛΕΙΦΘΗΚΕ» ΚΑΙ ΤΟ «ΔΕΝ ΔΙΑΒΑΣΤΗΚΕ» ΕΙΝΑΙ ΔΥΟ ΔΙΑΦΟΡΕΤΙΚΑ ΠΡΑΓΜΑΤΑ
  // ΚΑΙ ΦΑΙΝΟΝΤΑΝ ΙΔΙΑ. Ο ιδιοκτήτης χωρίς ενοίκια τον μήνα και ο ιδιοκτήτης
  // που τα ενοίκιά του δεν διαβάστηκαν μετριούνταν και οι δύο ως `skipped`:
  // το ένα είναι φυσιολογικό, το άλλο είναι κατάσταση που δεν έφυγε ποτέ.
  let sent = 0, skipped = 0, failed = 0, unreadable = 0
  const langOf = msgLangReader(supabase)
  for (const pref of prefs as { user_id: string; reminder_email: string | null }[]) {
    if (!pref.reminder_email) { skipped++; continue }

    // Idempotency: αν έχει ήδη σταλεί κατάσταση αυτόν τον μήνα, παράλειψε.
    // Ο ΜΟΝΟΣ ΦΡΑΓΜΟΣ ΓΙΑ ΔΕΥΤΕΡΗ ΚΑΤΑΣΤΑΣΗ ΤΟΝ ΙΔΙΟ ΜΗΝΑ. Αγνοώντας το `error`,
    // μια αποτυχία γινόταν «δεν έχει σταλεί» και ο ιδιοκτήτης έπαιρνε την ίδια
    // κατάσταση δεύτερη φορά. Το να λείψει μια κατάσταση φαίνεται τον επόμενο
    // μήνα· ένα διπλό email δεν ξαναπαίρνεται πίσω.
    const { data: already, error: alreadyErr } = await supabase.from('notification_log')
      .select('id').eq('user_id', pref.user_id).eq('reminder_type', 'monthly_statement').gte('created_at', monthStart).limit(1)
    if (alreadyErr) { console.error('[monthly-statements] μητρώο απεσταλμένων:', alreadyErr); unreadable++; continue }
    if (already?.length) { skipped++; continue }

    const { data: rentData, error: rentErr } = await supabase.from('rent_payments')
      .select('property_id,tenant_id,amount,paid').eq('user_id', pref.user_id).eq('period_year', py).eq('period_month', pm)
    if (rentErr) { console.error('[monthly-statements] τα ενοίκια δεν διαβάστηκαν:', rentErr); unreadable++; continue }
    const rents = (rentData || []) as Rent[]
    if (!rents.length) { skipped++; continue }

    // Batched ονόματα ακινήτων/ενοικιαστών.
    const propIds = [...new Set(rents.map(r => r.property_id).filter((v): v is string => v != null))]
    const tenantIds = [...new Set(rents.map(r => r.tenant_id).filter((v): v is string => v != null))]
    const propMap: Record<string, string> = {}, tenMap: Record<string, string> = {}
    // ΚΑΤΑΣΤΑΣΗ ΜΕ ΚΕΝΑ ΟΝΟΜΑΤΑ ΔΕΝ ΕΙΝΑΙ ΚΑΤΑΣΤΑΣΗ. Το έγγραφο φεύγει σε
    // ιδιοκτήτη και αντιστοιχεί ποσά σε ακίνητα και ενοικιαστές· αν οι χάρτες
    // μείνουν άδειοι από αποτυχημένη ανάγνωση, τα ποσά μένουν και τα ονόματα
    // χάνονται. Καλύτερα να μη φύγει καθόλου παρά να φύγει έτσι.
    if (propIds.length) {
      const { data, error } = await supabase.from('user_properties').select('id,name').in('id', propIds)
      if (error) throw new Error(`ονόματα ακινήτων: ${error.message}`)
      for (const p of data || []) propMap[p.id] = p.name
    }
    if (tenantIds.length) {
      const { data, error } = await supabase.from('tenants').select('id,full_name').in('id', tenantIds)
      if (error) throw new Error(`ονόματα ενοικιαστών: ${error.message}`)
      for (const t of data || []) tenMap[t.id] = t.full_name
    }

    const lang = await langOf(pref.user_id)
    const words = statementWords(lang)
    const label = periodLabelOf(py, pm, lang)
    const rows = rents.map(r => {
      const prop = r.property_id ? propMap[r.property_id] : null
      const ten = r.tenant_id ? tenMap[r.tenant_id] : null
      return { primary: prop || ten || words.rent, secondary: [prop && ten ? ten : null].filter(Boolean).join(' · ') || words.lease, expected: Number(r.amount) || 0, paid: r.paid ? (Number(r.amount) || 0) : 0 }
    })
    const expected = rows.reduce((s, r) => s + r.expected, 0)
    const collected = rows.reduce((s, r) => s + r.paid, 0)

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM_EMAIL, reply_to: REPLY_TO, to: pref.reminder_email, subject: statementSubject(label, lang), html: statementHtml(rows, expected, collected, label, lang) }),
      })
      if (res.ok) {
        sent++
        await supabase.from('notification_log').insert({ user_id: pref.user_id, event_id: null, reminder_type: 'monthly_statement', created_at: new Date().toISOString() })
      } else { failed++ }
    } catch { failed++ }
  }

  return json({ sent, skipped, failed, unreadable, period: periodLabel })
})
