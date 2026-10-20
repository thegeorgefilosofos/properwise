// ═══════════════════════════════════════════════════════════════════════════
// Η ΔΗΛΩΣΗ ΥΠΑΝΑΧΩΡΗΣΗΣ, ΑΠΟ ΤΗ ΛΕΙΤΟΥΡΓΙΑ ΤΗΣ ΔΙΕΠΑΦΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Η υποχρέωση και οι πηγές της: lib/legal/withdrawal.ts (άρθ. 11α Οδηγίας
// 2011/83/ΕΕ από την Οδηγία (ΕΕ) 2023/2673· άρθ. 3ζα ν. 2251/1994, ο νόμος
// που το πρόσθεσε στο docs/legal/ypanaxorisi.md). Εδώ φτάνει το ΔΕΥΤΕΡΟ βήμα της φόρμας, το «Επιβεβαίωση
// υπαναχώρησης»· το πρώτο βήμα δεν στέλνει τίποτα.
//
// ── Η ΣΕΙΡΑ ΚΑΙ ΓΙΑΤΙ ΑΥΤΗ ──────────────────────────────────────────────
//   1. Προέλευση και έλεγχος της δήλωσης.
//   2. ΚΑΤΑΓΡΑΦΗ ΠΡΩΤΑ, με την ώρα της βάσης. Η εμπρόθεσμη υποβολή κρίνεται
//      από αυτή τη στιγμή· ό,τι αποτύχει μετά (email, έμπορος) δεν τη σβήνει.
//   3. Ακύρωση της ανανέωσης στον έμπορο, ΜΟΝΟ όταν η συνδρομή βρίσκεται από
//      τον λογαριασμό πλήρους συνεδρίας. Χωρίς σύνδεση δεν ακυρώνουμε τίποτα με
//      βάση ένα email που έγραψε οποιοσδήποτε: τη βρίσκει άνθρωπος.
//   4. Αποδεικτικό στον καταναλωτή και διαβίβαση στην υποστήριξη, που ζητά την
//      επιστροφή από τον έμπορο (πωλητή της συνδρομής, merchant of record).
//
// ── ΔΗΜΟΣΙΑ ΔΙΑΔΡΟΜΗ, ΜΕ ΦΡΕΝΟ ───────────────────────────────────────────
// Η λειτουργία πρέπει να δουλεύει και χωρίς σύνδεση. Αρα όποιος ξέρει τη
// διεύθυνση μπορεί να βάλει τον διακομιστή να στείλει email σε τρίτον. Το
// φρένο: έως PER_EMAIL δηλώσεις ανά διεύθυνση το 24ωρο και έως PER_HOUR
// συνολικά την ώρα. Πάνω από αυτά απαντάμε 429 με τη διεύθυνση της
// υποστήριξης, ώστε ο καταναλωτής να έχει ΠΑΝΤΑ δρόμο.
// ═══════════════════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { sameOrigin, ORIGIN_DENIED } from '@/lib/api/origin';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient, SERVICE_CLIENT_LOG } from '@/lib/supabase/service';
import { requireSecondStep } from '@/lib/auth/secondStep';
import { merchant } from '@/lib/billing/merchant';
import * as billing from '@/lib/data/billing';
import { IDENTITY } from '@/lib/legal/identity';
import { validateWithdrawal, withinWithdrawalPeriod, withdrawalReference } from '@/lib/legal/withdrawal';
import {
  withdrawalAckEmail, withdrawalAlert, sendWithdrawalMail, declarationLines,
  type CancelOutcome, type WithdrawalRecord,
} from '@/lib/legal/withdrawalMail';
import { reportRoute, codeOf } from '@/lib/observability/route';

const ROUTE = 'api/withdrawal';
const PER_EMAIL = 3;
const PER_HOUR = 60;

/** Η απάντηση όταν δεν μπορούμε να καταγράψουμε: ποτέ χωρίς εναλλακτικό δρόμο. */
const fallback = (status: number, why: string) => NextResponse.json({
  error: `${why} Στείλε τη δήλωσή σου στο ${IDENTITY.supportEmail}: η προθεσμία τηρείται αν σταλεί πριν λήξει.`,
}, { status });

export async function POST(request: NextRequest) {
  if (!sameOrigin(request.headers)) return NextResponse.json({ error: ORIGIN_DENIED }, { status: 403 });

  let body: Record<string, unknown> = {};
  try { body = (await request.json()) as Record<string, unknown>; } catch { /* κενό σώμα: το πιάνει ο έλεγχος */ }
  // Το κρυφό πεδίο το γεμίζουν μόνο τα ρομπότ.
  if (String(body.website ?? '').trim()) return NextResponse.json({ error: 'Η δήλωση δεν έγινε δεκτή.' }, { status: 400 });

  const now = new Date();
  const checked = validateWithdrawal({
    name: String(body.name ?? ''), email: String(body.email ?? ''),
    contract: String(body.contract ?? ''), purchaseDate: String(body.purchaseDate ?? ''),
  }, now);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  const v = checked.value;

  let admin;
  try { admin = createServiceClient(); } catch (e) {
    console.info(`[withdrawal] ${SERVICE_CLIENT_LOG}`, String(e));
    void reportRoute(ROUTE, 'service client missing', { status: 503 });
    return fallback(503, 'Η λειτουργία δεν είναι διαθέσιμη αυτή τη στιγμή.');
  }

  // ── ΤΟ ΦΡΕΝΟ ─────────────────────────────────────────────────────────
  const dayAgo = new Date(now.getTime() - 86_400_000).toISOString();
  const hourAgo = new Date(now.getTime() - 3_600_000).toISOString();
  const [perEmail, perHour] = await Promise.all([
    admin.from('withdrawal_requests').select('id', { count: 'exact', head: true }).eq('consumer_email', v.email).gte('submitted_at', dayAgo),
    admin.from('withdrawal_requests').select('id', { count: 'exact', head: true }).gte('submitted_at', hourAgo),
  ]);
  if ((perEmail.count ?? 0) >= PER_EMAIL || (perHour.count ?? 0) >= PER_HOUR) {
    return fallback(429, 'Έχουν καταγραφεί ήδη αρκετές δηλώσεις σε λίγο χρόνο.');
  }

  // ── ΠΟΙΟΣ ΔΗΛΩΝΕΙ ───────────────────────────────────────────────────
  // Η μισή συνεδρία (συσκευή δηλωμένη, εξαψήφιος όχι) δεν ακυρώνει συνδρομή.
  // ΔΕΝ ΤΗΝ ΑΠΟΡΡΙΠΤΟΥΜΕ ΟΜΩΣ ΜΕ 403, όπως οι άλλες διαδρομές: η δήλωση
  // υπαναχώρησης γίνεται δεκτή και χωρίς σύνδεση, άρα και με μισή. Ο,τι θα
  // επέστρεφε η πύλη δείχνει μόνο ότι ο λογαριασμός δεν είναι βέβαιος· η
  // δήλωση γράφεται όπως μιας ανώνυμης και τη συνδρομή τη βρίσκει άνθρωπος.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const halfSession = user ? await requireSecondStep(supabase, user) : null;
  const trusted = !!user && !halfSession;
  let subscriptionId: string | null = null;
  if (trusted && user) {
    const profile = await billing.profile<{ mor_subscription_id: string | null }>(supabase, user.id, 'mor_subscription_id');
    subscriptionId = (profile?.mor_subscription_id || '').trim() || null;
  }

  // ── 2. ΚΑΤΑΓΡΑΦΗ ΠΡΩΤΑ ──────────────────────────────────────────────
  const within = withinWithdrawalPeriod(v.purchaseIso, now);
  const { data: row, error: insertError } = await admin.from('withdrawal_requests').insert({
    account_id: trusted && user ? user.id : null,
    consumer_name: v.name,
    consumer_email: v.email,
    contract: v.contract,
    purchase_date: v.purchaseIso,
    within_period: within,
    subscription_id: subscriptionId,
    cancel_outcome: trusted ? 'none' : 'not_signed_in',
  }).select('id, submitted_at').single();
  if (insertError || !row) {
    console.info('[withdrawal] η δήλωση δεν καταγράφηκε:', insertError?.message);
    void reportRoute(ROUTE, 'withdrawal not recorded', { status: 502, code: codeOf(insertError) });
    return fallback(502, 'Η δήλωση δεν καταγράφηκε.');
  }
  const rec = row as { id: string; submitted_at: string };

  // ── 3. ΑΚΥΡΩΣΗ ΤΗΣ ΑΝΑΝΕΩΣΗΣ, ΟΤΑΝ ΞΕΡΟΥΜΕ ΠΟΙΑ ΣΥΝΔΡΟΜΗ ΕΙΝΑΙ ──────────
  // Η ακύρωση ΔΕΝ περνά από τη συνθήκη του ταμείου (lib/legal/checkout.ts):
  // αφορά συνδρομή που υπάρχει ήδη. Αρκεί να μιλάμε στον έμπορο.
  let cancel: CancelOutcome = trusted ? 'none' : 'not_signed_in';
  const mor = merchant();
  if (subscriptionId && mor.canTalk(process.env)) {
    const { after, error } = await mor.subscriptionState(subscriptionId, process.env);
    if (error || !after) cancel = 'failed';
    else if (mor.needsCancelling(after.status)) {
      const out = await mor.cancel(subscriptionId, process.env);
      cancel = out.error ? 'failed' : 'cancelled';
    }
    if (cancel === 'failed') void reportRoute(ROUTE, 'subscription not cancelled on withdrawal', { status: 502 });
  } else if (subscriptionId) {
    cancel = 'failed';
  }

  // ── 4. ΑΠΟΔΕΙΚΤΙΚΟ ΚΑΙ ΔΙΑΒΙΒΑΣΗ ────────────────────────────────────
  const record: WithdrawalRecord = {
    reference: withdrawalReference(rec.id),
    submittedAt: new Date(rec.submitted_at),
    name: v.name, email: v.email, contract: v.contract,
    purchaseIso: v.purchaseIso, within, cancel, subscriptionId,
  };
  const ack = withdrawalAckEmail(record);
  const alert = withdrawalAlert(record);
  const [ackSent, forwarded] = await Promise.all([
    sendWithdrawalMail({ to: v.email, subject: ack.subject, html: ack.html, text: ack.text }, process.env.RESEND_API_KEY),
    sendWithdrawalMail({ to: IDENTITY.supportEmail, subject: alert.subject, text: alert.text }, process.env.RESEND_API_KEY),
  ]);
  const stamp = new Date().toISOString();
  const { error: updateError } = await admin.from('withdrawal_requests').update({
    cancel_outcome: cancel,
    ack_sent_at: ackSent ? stamp : null,
    forwarded_at: forwarded ? stamp : null,
  }).eq('id', rec.id);
  if (updateError) void reportRoute(ROUTE, 'withdrawal outcome not written', { status: 502, code: codeOf(updateError) });
  if (!ackSent || !forwarded) void reportRoute(ROUTE, 'withdrawal mail not sent', { status: 502 });

  // Η ΔΗΛΩΣΗ ΚΑΤΑΓΡΑΦΗΚΕ, ΑΡΑ 200 ΑΚΟΜΗ ΚΙ ΑΝ ΤΟ EMAIL ΔΕΝ ΕΦΥΓΕ. Η οθόνη δείχνει
  // το ίδιο περιεχόμενο με το αποδεικτικό και λέει τίμια αν το email έφυγε.
  return NextResponse.json({
    ok: true,
    reference: record.reference,
    lines: declarationLines(record),
    ackSent,
  });
}
