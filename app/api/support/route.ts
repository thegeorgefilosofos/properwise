// ═══════════════════════════════════════════════════════════════════════════
// Η ΦΟΡΜΑ ΥΠΟΣΤΗΡΙΞΗΣ: ΕΓΓΥΗΜΕΝΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ, ΓΙΑΤΙ Ο ΑΠΟΣΤΟΛΕΑΣ ΕΙΝΑΙ Η ΣΥΝΕΔΡΙΑ
// ─────────────────────────────────────────────────────────────────────────
// Οι Όροι («Υποστήριξη») λένε ότι στο «Επαγγελματίας+» τα μηνύματα απαντώνται
// πριν από τα υπόλοιπα. Το email στο support@ δεν μπορεί να το εγγυηθεί: το
// From δεν επαληθεύεται (lib/inbound/priority.ts). Εδώ μπορεί:
//   1. η συνεδρία (και το δεύτερο βήμα) λέει ποιος γράφει·
//   2. η βάση (`support_submit`, μόνο ρόλος υπηρεσίας, με ρητό χρήστη) δίνει
//      διεύθυνση και πακέτο, καταγράφει με `sender_verified = true` και κόβει
//      στο όριο ρυθμού ανά χρήστη, χωρίς αγώνα (advisory lock)·
//   3. η προώθηση στο SUPPORT_FORWARD_TO γράφει «[Προτεραιότητα · <πακέτο>]»
//      μόνο όταν το πακέτο το δικαιούται.
//
// ΤΟ ΙΔΙΟ ΜΗΝΥΜΑ ΔΕΝ ΦΕΥΓΕΙ ΔΥΟ ΦΟΡΕΣ. Κλειδί = χρήστης + hash κειμένου, ίδιο στη
// βάση (24 ώρες) και στο Idempotency-Key του παρόχου. Αν η αποστολή μείνει
// αβέβαιη (δίκτυο, 5xx), η γραμμή μένει `forward_error = 'uncertain'` και η
// επανάληψη του χρήστη ξαναδοκιμάζει με το ίδιο κλειδί.
//
// ΤΙ ΔΕΝ ΓΡΑΦΕΤΑΙ ΣΤΑ ΑΡΧΕΙΑ ΚΑΤΑΓΡΑΦΗΣ: διεύθυνση, θέμα, κείμενο. Μόνο κωδικοί.
// Το κείμενο δεν αποθηκεύεται ούτε στη βάση· φεύγει μόνο προς το inbox.
// ═══════════════════════════════════════════════════════════════════════════
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { sameOrigin, ORIGIN_DENIED } from '@/lib/api/origin';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient, serviceClientError } from '@/lib/supabase/service';
import { requireSecondStep } from '@/lib/auth/secondStep';
import { checkSupport } from '@/lib/support/form';
import { supportPriority, forwardSupport, forwardSubject, forwardKey, FORWARD_ENV } from '@/lib/inbound/priority';
import { KEY_ENV } from '@/lib/inbound/fetchBody';
import { INBOUND_DOMAIN } from '@/lib/inbound/address';
import { IDENTITY, MAIL_DOMAIN } from '@/lib/legal/identity';
import { reportRoute, codeOf } from '@/lib/observability/route';

const ROUTE = 'api/support';
const log = (...parts: unknown[]) => console.info('[support]', ...parts);

/** Όταν δεν μπορούμε να το στείλουμε, ο χρήστης μαθαίνει τον άλλο δρόμο. */
const fallback = (status: number, why: string) =>
  NextResponse.json({ error: `${why} Γράψε μας στο ${IDENTITY.supportEmail}.` }, { status });

export async function POST(request: NextRequest) {
  if (!sameOrigin(request.headers)) return NextResponse.json({ error: ORIGIN_DENIED }, { status: 403 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Απαιτείται σύνδεση.' }, { status: 401 });
  const denied = await requireSecondStep(supabase, user);
  if (denied) return denied;

  let raw: Record<string, unknown> = {};
  try { raw = (await request.json()) as Record<string, unknown>; } catch { /* κενό σώμα: το πιάνει ο έλεγχος */ }
  const checked = checkSupport(raw);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });

  // Χωρίς inbox ή κλειδί δεν καταγράφουμε κάτι που δεν θα διαβάσει κανείς.
  if (!process.env[FORWARD_ENV] || !process.env[KEY_ENV] || serviceClientError(process.env)) {
    log('η φόρμα δεν έχει ρυθμιστεί');
    void reportRoute(ROUTE, 'not configured', { status: 503 });
    return fallback(503, 'Η φόρμα δεν είναι διαθέσιμη αυτή τη στιγμή.');
  }

  // Μετά τον έλεγχο συνεδρίας και δεύτερου βήματος, η βάση με τον ρόλο υπηρεσίας
  // και ρητό χρήστη. Ο χρήστης δεν φτάνει μόνος του τη συνάρτηση.
  const admin = createServiceClient();
  const dedupe = createHash('sha256').update(`${user.id}\n${checked.value.subject}\n${checked.value.message}`).digest('hex');
  const { data: row, error: submitError } = await admin.rpc('support_submit', {
    p_user_id: user.id, p_subject: checked.value.subject, p_dedupe: dedupe,
  });
  if (submitError || !row) {
    if (submitError?.message?.includes('rate_limited')) {
      return NextResponse.json({ error: 'Έστειλες αρκετά μηνύματα σε λίγο χρόνο. Θα σου απαντήσουμε σε αυτά· ξαναδοκίμασε αργότερα.' }, { status: 429 });
    }
    log('η καταγραφή απέτυχε:', codeOf(submitError));
    void reportRoute(ROUTE, 'submit failed', { status: 502, code: codeOf(submitError) });
    return fallback(502, 'Το μήνυμα δεν στάλθηκε.');
  }
  const saved = row as { id: string; plan_rank: number; email: string; duplicate: boolean; forwarded: boolean };
  const priority = supportPriority(saved.plan_rank);
  // Το ίδιο μήνυμα έφυγε ήδη μέσα στο εικοσιτετράωρο: τίποτα δεύτερο.
  if (saved.duplicate && saved.forwarded) return NextResponse.json({ ok: true, priority: priority.claimed });

  const fwd = await forwardSupport({
    to: process.env[FORWARD_ENV], apiKey: process.env[KEY_ENV], key: forwardKey(`form/${dedupe}`),
    replyTo: saved.email, subject: forwardSubject(checked.value.subject, priority, true),
    body: { text: checked.value.message, html: null }, urgent: priority.claimed,
  }, fetch, [INBOUND_DOMAIN, MAIL_DOMAIN].filter(Boolean));
  if (!fwd.ok) {
    if (fwd.uncertain) {
      // Μπορεί να έφτασε. Η γραμμή μένει· η επανάληψη στέλνει με το ίδιο κλειδί.
      const { error: markUncertain } = await admin.from('support_inbox').update({ forward_error: 'uncertain' }).eq('id', saved.id);
      // Η σημείωση είναι ίχνος· η γραμμή μένει ούτως ή άλλως και το ίδιο κλειδί
      // κρατά την επανάληψη σε μία αποστολή. Αν δεν γραφτεί, λέγεται.
      if (markUncertain) void reportRoute(ROUTE, 'uncertain mark failed', { status: 502, code: codeOf(markUncertain) });
      log('αβέβαιη αποστολή:', fwd.code);
      void reportRoute(ROUTE, 'forward uncertain', { status: 502, code: fwd.code });
      return fallback(502, 'Δεν είμαστε σίγουροι ότι το μήνυμα στάλθηκε. Αν το ξαναστείλεις όπως είναι, δεν θα φτάσει δεύτερη φορά.');
    }
    // Σίγουρα δεν έφυγε: αποσύρεται, για να μη χρεώνεται στο όριο.
    await admin.rpc('support_withdraw', { p_user_id: user.id, p_id: saved.id });
    log('η προώθηση απέτυχε:', fwd.code);
    const status = fwd.kind === 'retry' ? 502 : 503;
    void reportRoute(ROUTE, 'forward failed', { status, code: fwd.code });
    return fallback(status, 'Το μήνυμα δεν στάλθηκε.');
  }

  const { error: markError } = await admin.from('support_inbox')
    .update({ forward_state: 'sent', forwarded_at: new Date().toISOString(), forward_error: null }).eq('id', saved.id);
  if (markError) {
    // Το μήνυμα έφυγε· μόνο η σημείωση λείπει. Δεν το λέμε αποτυχία στον χρήστη.
    log('η σημείωση της προώθησης απέτυχε:', codeOf(markError));
    void reportRoute(ROUTE, 'forward mark failed', { status: 200, code: codeOf(markError) });
  }

  return NextResponse.json({ ok: true, priority: priority.claimed });
}
