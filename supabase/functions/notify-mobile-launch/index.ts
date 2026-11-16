// ─────────────────────────────────────────────────────────────────────────
// notify-mobile-launch — εφάπαξ αποστολή ενημερωτικού email στη λίστα αναμονής
// του PROPERWISE Mobile, ΤΗΝ ΗΜΕΡΑ ΚΥΚΛΟΦΟΡΙΑΣ. Διαβάζει όσους πάτησαν
// «Ειδοποίησέ με μόλις βγει» (mobile_waitlist, notified_at IS NULL), στέλνει το
// email μέσω Resend και σημειώνει notified_at ώστε να μη σταλεί δεύτερη φορά.
//
// Ασφάλεια (least privilege): απαιτεί σωστό x-cron-secret (MOBILE_LAUNCH_SECRET).
// Το service-role key μένει ΜΟΝΟ μέσα στο function. Τρέχει χειροκίνητα στο launch
// (όχι pg_cron) — μπορεί να ξανακληθεί με ασφάλεια (μόνο τους μη-ειδοποιημένους).
//
// Ενεργοποίηση (μία φορά, όταν βγει η εφαρμογή):
//   supabase secrets set MOBILE_LAUNCH_SECRET="<τυχαίο-μακρύ-μυστικό>"
//   supabase functions deploy notify-mobile-launch
//   curl -X POST "https://<PROJECT_REF>.functions.supabase.co/notify-mobile-launch" \
//        -H "x-cron-secret: <το-ίδιο-μυστικό>" -H "Content-Type: application/json" \
//        -d '{"limit":200}'
//   (Επανάλαβε μέχρι το "sent" να γίνει 0 — στέλνει σε παρτίδες.)
// ─────────────────────────────────────────────────────────────────────────

import { emailShell, eyebrow, h, p, buttonPair, linkLine } from '../_shared/emailTemplates.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { APP_URL as SITE } from '../_shared/site.ts'
import { timingSafeEqual } from '../_shared/auth.ts'
import { senderFrom, REPLY_TO } from '../_shared/sender.mjs'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const LAUNCH_SECRET  = Deno.env.get('MOBILE_LAUNCH_SECRET') || ''
const FROM_EMAIL     = senderFrom(Deno.env.get('RESEND_FROM'))
const APP_URL        = `${SITE}/dashboard`
// ΤΑ ΔΥΟ ΚΑΤΑΣΤΗΜΑΤΑ, ΑΠΟ ΤΟ ΠΕΡΙΒΑΛΛΟΝ ΚΑΙ ΟΧΙ ΚΑΡΦΩΤΑ.
// Καμία από τις δύο καταχωρήσεις δεν υπάρχει ακόμη, άρα ΚΑΝΕΝΑ αναγνωριστικό
// δεν είναι γνωστό: ούτε το «id» του Google Play ούτε το αριθμητικό του App
// Store. Ενα μαντεμένο εδώ θα ταξίδευε μέσα σε email προς πελάτες και θα
// άνοιγε σελίδα «δεν βρέθηκε». Οι προεπιλογές δείχνουν στην αναζήτηση του κάθε
// καταστήματος, που ΑΠΑΝΤΑ πάντα και οι πραγματικές μπαίνουν ως μεταβλητές
// την ημέρα της δημοσίευσης.
const IOS_URL        = Deno.env.get('IOS_APP_URL') || 'https://www.apple.com/app-store/'
const ANDROID_URL    = Deno.env.get('ANDROID_APP_URL') || 'https://play.google.com/store/search?q=PROPERWISE&c=apps'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

function launchEmail(): { subject: string; html: string } {
  const subject = 'Η εφαρμογή PROPERWISE για κινητά κυκλοφόρησε'
  const html = emailShell({
    preheader: 'Η εφαρμογή για κινητό είναι διαθέσιμη.',
    footerNote: 'Λαμβάνεις αυτό το email επειδή ζήτησες ειδοποίηση για την εφαρμογή. Είναι το μόνο μήνυμα αυτής της λίστας. · properwise.gr',
    bodyHtml: eyebrow('Μόλις κυκλοφόρησε')
      + h('Η εφαρμογή για κινητά είναι εδώ')
      + p('Ζήτησες να μάθεις πρώτος. Η εφαρμογή για κινητό είναι πλέον διαθέσιμη: όλη η διαχείριση των ακινήτων σου στο κινητό, με λίγα πατήματα ή με τη φωνή σου.')
      + buttonPair({ label: 'App Store', url: IOS_URL }, { label: 'Google Play', url: ANDROID_URL })
      + linkLine('ή συνέχισε από τον υπολογιστή', APP_URL),
  })
  return { subject, html }
}

/**
 * Τι έγινε με μία αποστολή.
 *   sent   : έφυγε (ή το ίδιο κλειδί έφυγε ήδη: 409).
 *   failed : 4xx αυτού του παραλήπτη (άκυρη διεύθυνση, suppressed κ.λπ.)·
 *            fail_count +1, δεν ξαναβγαίνει, ώσπου ο χρήστης να ξαναμπεί στη λίστα.
 *   retry  : προσωρινή (δίκτυο, 5xx, 429)· στο τέλος της ουράς.
 *   config : λάθος ΔΙΚΟ ΜΑΣ (401, 403, 422 για αποστολέα ή τομέα): η εκτέλεση
 *            σταματά αμέσως και κανείς δεν χρεώνεται αποτυχία.
 */
type Outcome = { kind: 'sent' | 'failed' | 'retry' } | { kind: 'config'; status: number }

/** 422 που αφορά τον δικό μας αποστολέα ή τομέα, όχι τον παραλήπτη. */
const SENDER_PROBLEM = /domain|sender|\bfrom\b/i

// ΜΙΑ ΑΠΟΣΤΟΛΗ ΑΝΑ ΠΑΡΑΛΗΠΤΗ. Το Idempotency-Key βγαίνει από τον χρήστη: αν η
// δέσμευση λήξει πριν σημειωθεί το αποτέλεσμα, η νέα προσπάθεια δεν ξαναστέλνει.
async function sendEmail(userId: string, to: string, subject: string, html: string): Promise<Outcome> {
  let res: Response
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json',
        'Idempotency-Key': `mobile-launch/${userId}`,
      },
      body: JSON.stringify({ from: FROM_EMAIL, reply_to: REPLY_TO, to, subject, html }),
    })
  } catch { return { kind: 'retry' } }
  if (res.ok || res.status === 409) return { kind: 'sent' }
  if (res.status === 429 || res.status >= 500) return { kind: 'retry' }
  if (res.status === 401 || res.status === 403) return { kind: 'config', status: res.status }
  const why = await res.text().catch(() => '')
  // 422 για τον αποστολέα ή τον τομέα: δικό μας λάθος, σταματά το κύμα. Κάθε άλλο
  // 4xx αφορά αυτόν τον παραλήπτη: fail_count +1 και η εκτέλεση συνεχίζει.
  if (res.status === 422 && SENDER_PROBLEM.test(why)) return { kind: 'config', status: res.status }
  return { kind: 'failed' }
}

Deno.serve(async (req) => {
  const header = req.headers.get('x-cron-secret') || ''
  if (!LAUNCH_SECRET || !timingSafeEqual(header, LAUNCH_SECRET)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  // ΤΡΙΑ ΚΥΜΑΤΑ, ΟΠΩΣ ΛΕΝΕ ΟΙ ΟΡΟΙ («Προτεραιότητα στις νέες δυνατότητες»):
  //   first    «Επαγγελματίας+»
  //   priority από «Ιδιοκτήτης+» και οι Συνεργάτες, office_lead_days() μετά
  //   everyone όλοι, early_access_days() μετά το priority
  // Τα πακέτα και τις αποστάσεις τα κρατά και τα επιβάλλει η βάση
  // (mobile_launch_claim → early_access_window). Χωρίς `wave` στέλνεται μόνο το
  // πρώτο: μια βιαστική κλήση δεν φτάνει ποτέ σε κανέναν πριν από την ώρα του.
  //
  // ΠΟΤΕ ΣΤΑΜΑΤΑ Ο ΧΕΙΡΙΣΤΗΣ: όταν η απάντηση γράφει `done: true`, το κύμα δεν
  // έχει άλλον παραλήπτη. Οι μόνιμες αποτυχίες δεν ξαναβγαίνουν και οι
  // προσωρινές γίνονται μόνιμες μετά από πέντε, άρα η επανάληψη τελειώνει.
  let limit = 200
  let wave: 'first' | 'priority' | 'everyone' = 'first'
  try {
    const body = await req.json()
    if (body?.limit) limit = Math.min(500, Math.max(1, Number(body.limit)))
    if (body?.wave === 'priority' || body?.wave === 'everyone') wave = body.wave
  } catch { /* no body */ }

  try {
    const { data: rows, error: rowsErr } = await supabase
      .rpc('mobile_launch_claim', { p_wave: wave, p_limit: limit })

    if (rowsErr && /early_access_window/.test(rowsErr.message)) {
      return new Response(JSON.stringify({ error: 'early_access_window', wave, done: false }), { status: 409, headers: { 'Content-Type': 'application/json' } })
    }
    // «Κανείς δεν περιμένει» και «δεν μπόρεσα να δω ποιος περιμένει» δεν δίνουν
    // την ίδια απάντηση: το δεύτερο είναι σφάλμα.
    if (rowsErr) {
      console.error('[notify-mobile-launch] λίστα αναμονής:', rowsErr)
      return new Response(JSON.stringify({ error: 'waitlist_unreadable', detail: rowsErr.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }
    if (!rows?.length) {
      return new Response(JSON.stringify({ message: 'Κανένας εκκρεμής παραλήπτης σε αυτό το κύμα', wave, sent: 0, done: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    const { subject, html } = launchEmail()
    const sent: string[] = [], failed: string[] = [], retry: string[] = [], release: string[] = []
    let stop: number | null = null
    for (const r of rows) {
      const id = r.user_id as string
      if (stop !== null) { release.push(id); continue }
      const out = await sendEmail(id, r.email as string, subject, html)
      if (out.kind === 'config') { stop = out.status; release.push(id); continue }
      ;(out.kind === 'sent' ? sent : out.kind === 'failed' ? failed : retry).push(id)
    }

    const { data: left, error: settleErr } = await supabase
      .rpc('mobile_launch_settle', { p_sent: sent, p_failed: failed, p_retry: retry, p_release: release })
    if (settleErr) {
      console.error('[notify-mobile-launch] σημείωση αποτελέσματος:', settleErr)
      return new Response(JSON.stringify({ error: 'settle_failed', detail: settleErr.message, sent: sent.length }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }

    if (stop !== null) {
      // ΛΑΘΟΣ ΡΥΘΜΙΣΗΣ: το κλειδί ή ο αποστολέας. Κανείς δεν σημειώθηκε αποτυχημένος·
      // διόρθωσε τη ρύθμιση στο Resend ή στις μεταβλητές και ξανακάλεσε το ίδιο κύμα.
      console.error('[notify-mobile-launch] ο πάροχος αρνήθηκε τη ρύθμιση:', stop)
      return new Response(JSON.stringify({ error: 'resend_config', status: stop, wave, sent: sent.length, released: release.length, done: false }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({ success: true, wave, sent: sent.length, failed: failed.length, retry: retry.length, remaining: left, done: false }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
