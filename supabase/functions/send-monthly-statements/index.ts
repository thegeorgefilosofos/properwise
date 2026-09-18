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
import { emailShell, eyebrow, grUp, h, p, button, dataTable } from '../_shared/emailTemplates.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.110.8'
import { APP_URL } from '../_shared/site.ts'
import { authorizeCron, cronDenial, type CronAuth } from '../_shared/auth.ts'
import { eur } from '../_shared/format.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET    = Deno.env.get('MONTHLY_STATEMENTS_CRON_SECRET') || ''
const FROM_EMAIL     = Deno.env.get('RESEND_FROM') || 'PROPERWISE <onboarding@resend.dev>'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } })
const MONTHS = ['Ιανουαρίου', 'Φεβρουαρίου', 'Μαρτίου', 'Απριλίου', 'Μαΐου', 'Ιουνίου', 'Ιουλίου', 'Αυγούστου', 'Σεπτεμβρίου', 'Οκτωβρίου', 'Νοεμβρίου', 'Δεκεμβρίου']

// Εξουσιοδότηση cron (zero-config): service-role bearer, ή x-cron-secret env, ή το
// κοινό μυστικό του πίνακα cron_secrets (το στέλνει το pg_cron).
async function authorized(req: Request): Promise<CronAuth> {
  return authorizeCron(req, { serviceKey: SERVICE_KEY, envSecret: CRON_SECRET, supabase })
}

interface Rent { property_id: string | null; tenant_id: string | null; amount: number | null; paid: boolean | null }

function statementHtml(ownerRows: { primary: string; secondary: string; expected: number; paid: number }[], expected: number, collected: number, periodLabel: string): string {
  const outstanding = Math.max(0, expected - collected)
  const rows = ownerRows.map(r => {
    // ΚΑΜΙΑ ΠΑΥΛΑ ΣΕ ΘΕΣΗ ΤΙΜΗΣ. Οταν δεν αναμένεται μίσθωμα, η κατάσταση δεν
    // είναι άγνωστη: είναι «δεν οφείλεται τίποτα». Η παύλα το έκρυβε πίσω από
    // ένα σημάδι που ο αναγνώστης οθόνης διαβάζει ως «παύλα».
    const status = r.expected === 0 ? 'Χωρίς μίσθωμα' : r.paid >= r.expected ? 'Πλήρης' : r.paid > 0 ? 'Μερική' : 'Εκκρεμεί'
    const color = r.expected === 0 ? '#80868b' : r.paid >= r.expected ? '#188038' : r.paid > 0 ? '#b8860b' : '#d93025'
    return `<tr>
      <td class="rule-b" style="padding:11px 0;border-bottom:1px solid #e8e8ed;">
        <span class="ink" style="display:block;font-size:13px;color:#1d1d1f;font-weight:500;">${r.primary}</span>
        <span class="fa" style="display:block;font-size:11px;color:#8a9099;">${r.secondary}</span>
      </td>
      <td class="rule-b tx" style="padding:11px 0;border-bottom:1px solid #e8e8ed;text-align:right;font-size:13px;color:#4a4f55;">${eur(r.paid)} / ${eur(r.expected)}</td>
      <td class="rule-b" style="padding:11px 0;border-bottom:1px solid #e8e8ed;text-align:right;font-size:12px;font-weight:700;color:${color};">${status}</td>
    </tr>`
  }).join('')
  // ΤΟ ΔΑΠΕΔΟ ΤΩΝ 11px ΙΣΧΥΕΙ ΚΑΙ ΕΔΩ, ΚΑΙ ΤΑ ΚΕΦΑΛΑΙΑ ΔΕΝ ΚΡΑΤΟΥΝ ΤΟΝΟ. Ηταν
  // 10 εικονοστοιχεία, το μικρότερο κείμενο ολόκληρου του προϊόντος, σε email
  // που ανοίγει σχεδόν πάντα σε τηλέφωνο. Και το «uppercase» πάνω σε ωμό
  // ελληνικό έγραφε «ΑΚΊΝΗΤΟ» και «ΚΑΤΆΣΤΑΣΗ».
  const head = `<tr>${['Ακίνητο / Ενοικιαστής', 'Εισπρ. / Αναμ.', 'Κατάσταση'].map((t, i) =>
    `<td class="fa rule-b" style="padding:0 0 7px;${i ? 'text-align:right;' : ''}font-size:11px;color:#8a9099;letter-spacing:.06em;font-weight:700;border-bottom:1px solid #e8e8ed;">${grUp(t)}</td>`).join('')}</tr>`
  const total = `<tr><td class="ink" style="padding:13px 0 0;font-size:14px;font-weight:700;color:#1d1d1f;">Σύνολο</td><td class="ink" style="padding:13px 0 0;text-align:right;font-size:14px;font-weight:700;color:#1d1d1f;">${eur(collected)} / ${eur(expected)}</td><td></td></tr>`
  return emailShell({
    preheader: `Εισπράχθηκαν ${eur(collected)} από ${eur(expected)} τον ${periodLabel}.`,
    footerNote: 'Ενημερωτική κατάσταση με βάση τα δεδομένα σου. Δεν αποτελεί επίσημο λογιστικό ή φορολογικό έγγραφο. · properwise.gr',
    bodyHtml: eyebrow('Μηνιαία κατάσταση')
      + h(`Εισπράξεις ${periodLabel}`)
      + p(`Εισπράχθηκαν <b class="ink" style="color:#1d1d1f;">${eur(collected)}</b> από ${eur(expected)}${outstanding > 0 ? ` · ανείσπρακτα <b class="neg" style="color:#d93025;">${eur(outstanding)}</b>` : ''}.`)
      + dataTable(head + rows + total)
      + button('Άνοιγμα στο PROPERWISE', `${APP_URL}/dashboard`),
  })
}

Deno.serve(async (req) => {
  const auth = await authorized(req)
  if (!auth.ok) return json(...cronDenial(auth))
  if (!RESEND_API_KEY) return json({ error: 'no_resend_key' }, 500)

  // Προηγούμενος μήνας.
  const now = new Date()
  let py = now.getUTCFullYear(), pm = now.getUTCMonth() // getUTCMonth: 0-11 → ο προηγούμενος μήνας (1-based) είναι ίδιος αριθμός
  if (pm === 0) { py -= 1; pm = 12 }
  const periodLabel = `${MONTHS[pm - 1]} ${py}`
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
  const { data: allowedRows, error: allowedErr } = await supabase.rpc('reminder_recipients')
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

    const rows = rents.map(r => {
      const prop = r.property_id ? propMap[r.property_id] : null
      const ten = r.tenant_id ? tenMap[r.tenant_id] : null
      return { primary: prop || ten || 'Ενοίκιο', secondary: [prop && ten ? ten : null].filter(Boolean).join(' · ') || 'Μίσθωμα', expected: Number(r.amount) || 0, paid: r.paid ? (Number(r.amount) || 0) : 0 }
    })
    const expected = rows.reduce((s, r) => s + r.expected, 0)
    const collected = rows.reduce((s, r) => s + r.paid, 0)

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM_EMAIL, to: pref.reminder_email, subject: `PROPERWISE · Μηνιαία κατάσταση ${periodLabel}`, html: statementHtml(rows, expected, collected, periodLabel) }),
      })
      if (res.ok) {
        sent++
        await supabase.from('notification_log').insert({ user_id: pref.user_id, event_id: null, reminder_type: 'monthly_statement', created_at: new Date().toISOString() })
      } else { failed++ }
    } catch { failed++ }
  }

  return json({ sent, skipped, failed, unreadable, period: periodLabel })
})
