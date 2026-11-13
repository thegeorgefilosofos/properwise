// npx tsx lib/billing/morWebhook.lifecycle.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// Η ΜΗΧΑΝΗ ΚΑΤΑΣΤΑΣΕΩΝ ΤΗΣ ΣΥΝΔΡΟΜΗΣ, ΓΕΓΟΝΟΣ ΜΕ ΓΕΓΟΝΟΣ
// ─────────────────────────────────────────────────────────────────────────
// ΠΗΓΗ: έλεγχος ετοιμότητας πληρωμών της 12/11/2026, «Λείπει (κώδικας)» 1-3.
// Τρία κενά πριν ανοίξει το ταμείο:
//
//   · η επιστροφή χρημάτων και η αμφισβήτηση έστελναν μόνο email· ο πελάτης
//     που πήρε πίσω τα χρήματά του κρατούσε το πακέτο·
//   · το `past_due` έδινε πρόσβαση χωρίς όριο χρόνου·
//   · η ανανέωση, η αποτυχημένη πληρωμή και η επιστροφή δεν είχαν δοκιμή
//     εφαρμογής στη βάση.
//
// Κάθε σενάριο εδώ στέλνει αληθινό σώμα του Creem στο `applyMerchantEvent` και
// κοιτάζει ΤΙ ΕΜΕΙΝΕ στη γραμμή του λογαριασμού: όχι τι επέστρεψε μια
// συνάρτηση, αλλά τι θα διαβάσει η `user_plan_rank` στο επόμενο αίτημα.
// ═══════════════════════════════════════════════════════════════════════════
import { fakeDb, fakeAlerts, profile, subEvent, moneyEvent, runWebhook, type FakeDb, type Row } from './morWebhook.testkit';
import { PAST_DUE_GRACE_DAYS } from './subscription';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { if (c) pass++; else { fail++; console.error('✗ ' + n); } };
console.info = () => {};

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();
const T0 = Date.parse('2026-10-01T09:00:00.000Z');        // η αγορά
const P1 = '2026-11-01T09:00:00.000Z';                    // τέλος πρώτης περιόδου
const P2 = '2026-12-01T09:00:00.000Z';                    // τέλος δεύτερης περιόδου
const T1 = Date.parse(P1) + 5 * 60_000;                   // η ανανέωση, λίγο μετά

const ev = (name: string, at: number, over: Record<string, unknown> = {}, periodEnd = P1) =>
  subEvent(over, name, at, periodEnd);

/** Η γραμμή ενός πληρωμένου «Ενός ακινήτου» με ενεργή συνδρομή. */
const paying = (over: Row = {}) => profile({
  plan: 'solo', subscription_status: 'active', mor_subscription_id: 'sub_1',
  mor_renews_at: P1, mor_event_at: iso(T0), mor_last_transaction_id: 'tran_1', ...over,
});

async function step(raw: string, db: FakeDb, now: number, alerts = fakeAlerts()) {
  return runWebhook(raw, db, alerts, iso(now));
}

async function main() {
  // ══ 1. ΑΝΑΝΕΩΣΗ: ΔΕΥΤΕΡΗ ΠΕΡΙΟΔΟΣ ═════════════════════════════════════
  {
    const db = fakeDb([paying()]);
    const r = await step(ev('subscription.paid', T1, { last_transaction_id: 'tran_2' }, P2), db, T1 + 60_000);
    const row = db.rows[0];
    ok('ανανέωση: 200 ok', r.status === 200 && r.body.ok === true);
    ok('ανανέωση: το πακέτο μένει', row.plan === 'solo' && row.subscription_status === 'active');
    ok('ανανέωση: η επόμενη ανανέωση πάει στη δεύτερη περίοδο', row.mor_renews_at === P2);
    ok('ανανέωση: η ώρα του γεγονότος προχωρά', row.mor_event_at === iso(T1));
    ok('ανανέωση: καμία λήξη, κανένα «σε καθυστέρηση»', row.mor_ends_at === null && row.mor_past_due_at === null);
    ok('ανανέωση: η τελευταία πληρωμένη συναλλαγή γράφεται', row.mor_last_transaction_id === 'tran_2');
    // ΙΔΙΟ ΓΕΓΟΝΟΣ ΔΕΥΤΕΡΗ ΦΟΡΑ (ο έμπορος ξαναστέλνει ό,τι δεν είδε 2xx).
    const again = await step(ev('subscription.paid', T1, {}, P2), db, T1 + 120_000);
    ok('ανανέωση δύο φορές: ίδιο αποτέλεσμα', again.status === 200
       && db.rows[0].plan === 'solo' && db.rows[0].mor_renews_at === P2 && db.rows.length === 1);
  }
  // ΚΑΘΥΣΤΕΡΗΜΕΝΗ ΑΝΑΝΕΩΣΗ ΤΗΣ ΠΡΩΤΗΣ ΠΕΡΙΟΔΟΥ ΔΕΝ ΓΥΡΙΖΕΙ ΠΙΣΩ ΤΗΝ ΗΜΕΡΟΜΗΝΙΑ.
  {
    const db = fakeDb([paying({ mor_renews_at: P2, mor_event_at: iso(T1) })]);
    const r = await step(ev('subscription.paid', T0, {}, P1), db, T1 + DAY);
    ok('παλιό «πληρώθηκε»: αγνοείται ως παλαιότερο', r.body.skipped === 'stale' && db.rows[0].mor_renews_at === P2);
  }

  // ══ 2. ΑΠΟΤΥΧΗΜΕΝΗ ΠΛΗΡΩΜΗ: ΠΕΡΙΟΔΟΣ ΧΑΡΙΤΟΣ ΜΕ ΟΡΙΟ ═════════════════
  const T2 = T1;                                             // η πρώτη αποτυχία
  const grace = PAST_DUE_GRACE_DAYS * DAY;
  {
    const db = fakeDb([paying()]);
    await step(ev('subscription.past_due', T2, { status: 'past_due' }), db, T2 + 3_600_000);
    ok('πρώτο past_due: η πρόσβαση μένει', db.rows[0].plan === 'solo' && db.rows[0].subscription_status === 'past_due');
    ok('πρώτο past_due: σημειώνεται η ώρα της πρώτης αποτυχίας', db.rows[0].mor_past_due_at === iso(T2));

    // ΔΕΥΤΕΡΗ ΑΠΟΤΥΧΙΑ (νέα προσπάθεια του εμπόρου): το ρολόι ΔΕΝ ξεκινά από την αρχή.
    const T3 = T2 + 3 * DAY;
    await step(ev('subscription.past_due', T3, { status: 'past_due' }), db, T3 + 60_000);
    ok('δεύτερο past_due: η ώρα μένει της πρώτης', db.rows[0].mor_past_due_at === iso(T2));
    ok('δεύτερο past_due: μέσα στη χάρη, πρόσβαση', db.rows[0].plan === 'solo');

    // ΜΕΤΑ ΤΗ ΧΑΡΗ: πίσω στο δωρεάν, ακόμη κι αν ο έμπορος λέει ακόμη past_due.
    const T4 = T2 + grace + DAY;
    await step(ev('subscription.past_due', T4, { status: 'past_due' }), db, T4 + 60_000);
    ok(`past_due μετά από ${PAST_DUE_GRACE_DAYS} ημέρες: δωρεάν`, db.rows[0].plan === 'free');
    ok('η κατάσταση μένει όπως τη λέει ο έμπορος', db.rows[0].subscription_status === 'past_due');
    ok('και η ώρα της πρώτης αποτυχίας μένει, για την κάρτα', db.rows[0].mor_past_due_at === iso(T2));

    // Η ΚΑΡΤΑ ΕΝΗΜΕΡΩΘΗΚΕ: ο έμπορος εισπράττει, το πακέτο επιστρέφει.
    const T5 = T4 + DAY;
    await step(ev('subscription.paid', T5, { status: 'active' }, P2), db, T5 + 60_000);
    ok('πληρωμή μετά την αποτυχία: το πακέτο επιστρέφει', db.rows[0].plan === 'solo' && db.rows[0].subscription_status === 'active');
    ok('πληρωμή μετά την αποτυχία: το «σε καθυστέρηση» σβήνει', db.rows[0].mor_past_due_at === null);
  }
  // ΣΥΝΔΡΟΜΗ ΠΟΥ ΗΤΑΝ ΗΔΗ past_due ΧΩΡΙΣ ΩΡΑ (πριν από τη στήλη): μετρά από τώρα.
  {
    const db = fakeDb([paying({ subscription_status: 'past_due' })]);
    await step(ev('subscription.past_due', T2, { status: 'past_due' }), db, T2 + 60_000);
    ok('past_due χωρίς καταγεγραμμένη ώρα: παίρνει την ώρα του γεγονότος', db.rows[0].mor_past_due_at === iso(T2));
  }
  // ΑΝΕΙΣΠΡΑΚΤΗ: τέλος, χωρίς χάρη.
  {
    const db = fakeDb([paying({ subscription_status: 'past_due', mor_past_due_at: iso(T2) })]);
    await step(ev('subscription.update', T2 + 2 * DAY, { status: 'unpaid' }), db, T2 + 2 * DAY + 60_000);
    ok('unpaid: δωρεάν', db.rows[0].plan === 'free' && db.rows[0].subscription_status === 'unpaid');
    ok('unpaid: το «σε καθυστέρηση» σβήνει, η κατάσταση το λέει πια', db.rows[0].mor_past_due_at === null);
  }
  // ΠΑΥΣΗ: χωρίς πρόσβαση.
  {
    const db = fakeDb([paying()]);
    await step(ev('subscription.paused', T1, { status: 'paused' }), db, T1 + 60_000);
    ok('paused: δωρεάν', db.rows[0].plan === 'free' && db.rows[0].subscription_status === 'paused');
  }

  // ══ 3. ΕΠΙΣΤΡΟΦΗ ΧΡΗΜΑΤΩΝ: ΤΕΛΟΣ ΠΡΟΣΒΑΣΗΣ ΜΟΝΟ ΟΤΑΝ ΕΙΝΑΙ ΣΑΦΕΣ ═══════
  // Ολόκληρη επιστροφή, ποσά παρόντα, ίδιο νόμισμα, ίδια βάση (όσα πλήρωσε ο
  // πελάτης)· και η συναλλαγή είναι η ΤΕΛΕΥΤΑΙΑ πληρωμένη της συνδρομής. Σε
  // κάθε άλλη περίπτωση η πρόσβαση μένει και φεύγει μόνο email (έλεγχος του
  // PR 558, M1).
  const TR = T0 + 3 * DAY;                                   // η επιστροφή
  {
    const db = fakeDb([paying()]);
    const alerts = fakeAlerts();
    const r = await step(moneyEvent('refund', TR), db, TR + 60_000, alerts);
    const row = db.rows[0];
    ok('επιστροφή: 200 με revoked', r.status === 200 && r.body.ok === true && r.body.revoked === true);
    ok('επιστροφή: δωρεάν', row.plan === 'free');
    ok('επιστροφή: η κατάσταση γίνεται «έληξε»', row.subscription_status === 'expired');
    ok('επιστροφή: καταγράφεται πότε, γιατί και ποια', row.mor_revoked_at === iso(TR)
       && row.mor_revoked_reason === 'refund' && row.mor_revoked_ref === 'ref_1');
    ok('επιστροφή: θυμάται τη συναλλαγή που επιστράφηκε', row.mor_revoked_tx === 'tran_1');
    ok('επιστροφή: η πρόσβαση τελείωσε τη στιγμή της επιστροφής', row.mor_ends_at === iso(TR));
    ok('επιστροφή: καμία ανανέωση δεν περιμένει', row.mor_renews_at === null);
    ok('επιστροφή: η συνδρομή μένει καταγεγραμμένη, για την πύλη πελάτη', row.mor_subscription_id === 'sub_1');
    ok('επιστροφή: το ρολόι των γεγονότων συνδρομής δεν αγγίζεται', row.mor_event_at === iso(T0));
    ok('επιστροφή: με μία ατομική κλήση στη βάση, όχι ανάγνωση και εγγραφή',
       db.rpcs.some(c => c.fn === 'revoke_mor_access' && c.args.p_transaction === 'tran_1') && db.upserts.length === 0);
    ok('επιστροφή: ΜΙΑ ειδοποίηση, που λέει ότι η πρόσβαση έκλεισε', alerts.sent.length === 1
       && /έκλεισε/.test(alerts.sent[0].text) && alerts.sent[0].text.includes('sub_1'));
    ok('κανένα email πελάτη στο μήνυμα', !alerts.sent[0].text.includes('a@b.gr'));

    // ΙΔΙΑ ΕΠΙΣΤΡΟΦΗ ΔΕΥΤΕΡΗ ΦΟΡΑ: τίποτα δεν αλλάζει, κανένα δεύτερο μήνυμα.
    const alerts2 = fakeAlerts();
    const again = await step(moneyEvent('refund', TR), db, TR + 120_000, alerts2);
    ok('επιστροφή δύο φορές: 200, χωρίς δεύτερη ανάκληση', again.status === 200
       && again.body.skipped === 'same_reference' && db.revokes === 1);
    ok('επιστροφή δύο φορές: χωρίς δεύτερο μήνυμα', alerts2.sent.length === 0);
    ok('επιστροφή δύο φορές: η ώρα της πρώτης μένει', db.rows[0].mor_revoked_at === iso(TR));

    // ΚΑΘΥΣΤΕΡΗΜΕΝΟ «ΕΝΕΡΓΗ» ΠΟΥ ΣΥΝΕΒΗ ΠΡΙΝ ΑΠΟ ΤΗΝ ΕΠΙΣΤΡΟΦΗ: δεν ξανανοίγει τίποτα.
    await step(ev('subscription.active', TR - DAY), db, TR + 180_000);
    ok('παλιό «ενεργή» μετά την επιστροφή: μένει δωρεάν', db.rows[0].plan === 'free');

    // Ο ΕΜΠΟΡΟΣ ΛΕΕΙ ΑΚΟΜΗ «active»: νεότερη ενημέρωση ΧΩΡΙΣ πληρωμή δεν ανοίγει.
    const up = await step(ev('subscription.update', TR + DAY), db, TR + DAY + 60_000);
    ok('νεότερη ενημέρωση χωρίς πληρωμή: μένει δωρεάν', db.rows[0].plan === 'free' && up.body.skipped === 'revoked');
    ok('και η καταγραφή της επιστροφής μένει', db.rows[0].mor_revoked_reason === 'refund');
  }

  // ── Η ΧΡΕΩΣΗ ΜΕΤΑ ΤΗΝ ΕΠΙΣΤΡΟΦΗ: ΜΟΝΟ ΑΝ ΕΓΙΝΕ ΜΕΤΑ, ΜΕ ΝΕΑ ΣΥΝΑΛΛΑΓΗ ──────
  const revoked = (over: Row = {}) => paying({
    plan: 'free', subscription_status: 'expired', mor_revoked_at: iso(TR), mor_revoked_reason: 'refund',
    mor_revoked_ref: 'ref_1', mor_revoked_tx: 'tran_1', mor_ends_at: iso(TR), mor_renews_at: null, ...over,
  });
  {
    const db = fakeDb([revoked()]);
    const alerts = fakeAlerts();
    await step(ev('subscription.paid', T1, { last_transaction_id: 'tran_2' }, P2), db, T1 + 60_000, alerts);
    ok('χρέωση μετά την επιστροφή: το πακέτο ξανανοίγει', db.rows[0].plan === 'solo' && db.rows[0].subscription_status === 'active');
    ok('χρέωση μετά την επιστροφή: η καταγραφή σβήνει, η αναφορά μένει', db.rows[0].mor_revoked_at === null
       && db.rows[0].mor_revoked_reason === null && db.rows[0].mor_revoked_ref === 'ref_1');
    ok('χρέωση μετά την επιστροφή: ειδοποίηση στην υποστήριξη', alerts.sent.length === 1 && alerts.sent[0].text.includes('sub_1'));

    // Η ΙΔΙΑ ΕΠΙΣΤΡΟΦΗ ΞΑΝΑΣΤΕΛΝΕΤΑΙ ΜΕΤΑ ΤΗ ΝΕΑ ΧΡΕΩΣΗ: δεν ξανακόβει (L4).
    const r = await step(moneyEvent('refund', TR), db, T1 + 120_000);
    ok('ίδια επιστροφή μετά από νέα χρέωση: δεν ξανακλείνει', db.rows[0].plan === 'solo' && r.body.revoked !== true);
  }
  // ΕΚΤΟΣ ΣΕΙΡΑΣ (L5, έλεγχος του PR 558 εύρημα 3): πληρώθηκε ο Τ2 ΜΕΤΑ τον Τ1
  // (`mor_event_at` = T0, το γεγονός που ανέφερε τον tran_1) αλλά ΠΡΙΝ από την
  // επιστροφή του Τ1· η ειδοποίησή του έφτασε μετά την ανάκληση. Με τη σωστή
  // σειρά η επιστροφή του Τ1 δεν θα έκλεινε τίποτα (`not_latest`): ξανανοίγει
  // και το μαθαίνει άνθρωπος.
  {
    const db = fakeDb([revoked()]);
    const alerts = fakeAlerts();
    const r = await step(ev('subscription.paid', TR - 60_000, { last_transaction_id: 'tran_2' }, P2), db, TR + 60_000, alerts);
    ok('«πληρώθηκε» ο Τ2 πριν από την επιστροφή του Τ1, έφτασε μετά: ξανανοίγει', r.status === 200
       && db.rows[0].plan === 'solo' && db.rows[0].mor_revoked_at === null && db.rows[0].mor_last_transaction_id === 'tran_2');
    ok('και φεύγει email ότι η πληρωμή άργησε', alerts.sent.length === 1 && /άργησε|καθυστέρηση/.test(alerts.sent[0].subject + alerts.sent[0].text)
       && alerts.sent[0].text.includes('sub_1'));
  }
  // Χωρίς ώρα του τελευταίου γεγονότος συνδρομής η σειρά δεν αποδεικνύεται:
  // μένει κλειστή, αλλά η πληρωμή με νέα συναλλαγή φτάνει σε άνθρωπο.
  {
    const db = fakeDb([revoked({ mor_event_at: null })]);
    const alerts = fakeAlerts();
    const r = await step(ev('subscription.paid', TR - 60_000, { last_transaction_id: 'tran_2' }), db, TR + 60_000, alerts);
    ok('«πληρώθηκε» πριν από την επιστροφή, χωρίς απόδειξη σειράς: μένει κλειστή', db.rows[0].plan === 'free'
       && db.rows[0].mor_revoked_at === iso(TR) && r.body.skipped === 'revoked');
    ok('«πληρώθηκε» πριν από την επιστροφή, χωρίς απόδειξη σειράς: email στην υποστήριξη', alerts.sent.length === 1
       && alerts.sent[0].text.includes('tran_2') && r.body.alerted === true);
  }
  // Παλαιότερο από το καταγεγραμμένο γεγονός: φίλτρο σειράς, τίποτα δεν αλλάζει.
  {
    const db = fakeDb([revoked({ mor_event_at: iso(TR - DAY) })]);
    await step(ev('subscription.paid', TR - 2 * DAY, { last_transaction_id: 'tran_0' }), db, TR + 60_000);
    ok('«πληρώθηκε» παλαιότερο από το τελευταίο γεγονός: μένει κλειστή', db.rows[0].plan === 'free' && db.rows[0].mor_revoked_at === iso(TR));
  }
  {
    const db = fakeDb([revoked()]);
    const alerts = fakeAlerts();
    const raw = JSON.parse(ev('subscription.paid', TR + DAY, { last_transaction_id: 'tran_2', updated_at: null }));
    delete raw.created_at;
    await step(JSON.stringify(raw), db, TR + DAY + 60_000, alerts);
    ok('«πληρώθηκε» χωρίς ώρα: μένει κλειστή', db.rows[0].plan === 'free' && db.rows[0].mor_revoked_at === iso(TR));
    ok('«πληρώθηκε» χωρίς ώρα με νέα συναλλαγή: email στην υποστήριξη', alerts.sent.length === 1 && alerts.sent[0].text.includes('tran_2'));
  }
  {
    const db = fakeDb([revoked()]);
    const alerts = fakeAlerts();
    await step(ev('subscription.paid', TR + DAY, { last_transaction_id: 'tran_1' }), db, TR + DAY + 60_000, alerts);
    ok('«πληρώθηκε» με την ίδια, επιστραμμένη συναλλαγή: μένει κλειστή', db.rows[0].plan === 'free');
    ok('«πληρώθηκε» με την ίδια, επιστραμμένη συναλλαγή: κανένα email', alerts.sent.length === 0);
  }

  // ── ΟΤΙΔΗΠΟΤΕ ΔΕΝ ΕΙΝΑΙ ΣΑΦΕΣ: Η ΠΡΟΣΒΑΣΗ ΜΕΝΕΙ, ΦΕΥΓΕΙ ΜΟΝΟ EMAIL ─────────
  const stays = async (name: string, raw: string, rows: Row[], text: RegExp) => {
    const db = fakeDb(rows);
    const alerts = fakeAlerts();
    const r = await step(raw, db, TR + 60_000, alerts);
    ok(`${name}: η πρόσβαση μένει`, r.status === 200 && r.body.revoked !== true && db.revokes === 0
       && db.rows[0].plan === rows[0].plan && db.rows[0].mor_revoked_at === null);
    ok(`${name}: μόνο ειδοποίηση`, alerts.sent.length === 1 && text.test(alerts.sent[0].text));
  };
  // Ο ΜΗΝΑΣ 1 ΕΠΙΣΤΡΕΦΕΤΑΙ ΑΦΟΥ ΠΛΗΡΩΘΗΚΕ Ο ΜΗΝΑΣ 2.
  await stays('επιστροφή του πρώτου μήνα μετά την πληρωμή του δεύτερου',
    moneyEvent('refund', TR, { transaction: 'tran_1' }), [paying({ mor_last_transaction_id: 'tran_2' })], /παλαιότερη χρέωση/);
  await stays('συνδρομή χωρίς καταγεγραμμένη τελευταία συναλλαγή',
    moneyEvent('refund', TR), [paying({ mor_last_transaction_id: null })], /παλαιότερη χρέωση/);
  await stays('μερική επιστροφή', moneyEvent('refund', TR, { refund: 100 }), [paying()], /μερική/i);
  await stays('επιστροφή χωρίς ποσό', moneyEvent('refund', TR, { refund: null }), [paying()], /χωρίς ποσό/);
  await stays('συναλλαγή χωρίς ποσό πληρωμής', moneyEvent('refund', TR, { paid: null }), [paying()], /χωρίς ποσό/);
  // ΚΑΘΑΡΟ ΑΠΕΝΑΝΤΙ ΣΕ ΜΙΚΤΟ: η επιστροφή ίση με το ποσό πριν από τον φόρο δεν
  // είναι ολόκληρη επιστροφή όσων πλήρωσε ο πελάτης.
  await stays('επιστροφή στο καθαρό ποσό, ενώ πληρώθηκε το μικτό',
    moneyEvent('refund', TR, { refund: 419, paid: 499, net: 419 }), [paying()], /άλλη βάση/);
  await stays('επιστροφή σε άλλο νόμισμα', moneyEvent('refund', TR, { currency: 'USD' }), [paying()], /άλλη βάση/);
  {
    const db = fakeDb([paying({ plan: 'agency', mor_subscription_id: 'sub_live' })]);
    const alerts = fakeAlerts();
    const r = await step(moneyEvent('refund', TR), db, TR + 60_000, alerts);
    ok('επιστροφή άλλης συνδρομής: καμία ανάκληση', db.revokes === 0 && db.rows[0].plan === 'agency');
    ok('επιστροφή άλλης συνδρομής: 200 και ειδοποίηση', r.status === 200 && alerts.sent.length === 1);
  }
  {
    const db = fakeDb([paying()]);
    const alerts = fakeAlerts();
    const r = await step(moneyEvent('refund', TR, { subscription: null }), db, TR + 60_000, alerts);
    ok('επιστροφή χωρίς συνδρομή: η βάση δεν αγγίζεται', db.opened === 0 && db.rows[0].plan === 'solo');
    ok('επιστροφή χωρίς συνδρομή: 200 και ειδοποίηση', r.status === 200 && r.body.alerted === true);
  }
  {
    const db = fakeDb([paying()], { revoke: true });
    const alerts = fakeAlerts();
    const r = await step(moneyEvent('refund', TR), db, TR + 60_000, alerts);
    ok('ανάκληση που δεν γράφτηκε: 502', r.status === 502 && r.body.error === 'write_failed');
    ok('ανάκληση που δεν γράφτηκε: το μήνυμα περιμένει την επανάληψη', alerts.sent.length === 0);
  }
  // ΝΕΑ ΑΓΟΡΑ ΜΕΤΑ ΤΗΝ ΕΠΙΣΤΡΟΦΗ: συνδρομή που ΓΕΝΝΗΘΗΚΕ μετά, καθαρή καταγραφή.
  {
    const db = fakeDb([revoked({ mor_event_at: iso(TR) })]);
    const alerts = fakeAlerts();
    await step(ev('subscription.active', TR + DAY, {
      id: 'sub_2', product: { id: 'prod_c' }, last_transaction_id: 'tran_9', created_at: iso(TR + DAY - 60_000),
    }), db, TR + DAY + 60_000, alerts);
    ok('νέα αγορά μετά την επιστροφή: ανοίγει', db.rows[0].plan === 'owner' && db.rows[0].mor_subscription_id === 'sub_2');
    ok('νέα αγορά μετά την επιστροφή: η παλιά καταγραφή σβήνει', db.rows[0].mor_revoked_at === null);
    ok('νέα αγορά μετά την επιστροφή: email για πιθανή διπλή χρέωση', alerts.sent.length === 1
       && alerts.sent[0].text.includes('sub_1') && alerts.sent[0].text.includes('sub_2'));
  }
  // ΠΑΛΑΙΟΤΕΡΗ, ΑΛΛΗ ΣΥΝΔΡΟΜΗ ΜΕΤΑ ΤΗΝ ΑΝΑΚΛΗΣΗ (έλεγχος του PR 558, εύρημα 5).
  // Η sub_0 γεννήθηκε πριν από την ανάκληση της sub_1 και στέλνει γεγονός με
  // νεότερη ώρα: δεν σηκώνει την ανάκληση, δεν γυρίζει την καταγραφή πίσω.
  for (const [what, over] of [
    ['γεννημένη πριν', { created_at: iso(T0 - 30 * DAY) }],
    ['χωρίς ώρα γέννησης', {}],
  ] as const) {
    const db = fakeDb([revoked({ mor_event_at: iso(TR) })]);
    const alerts = fakeAlerts();
    const r = await step(ev('subscription.update', TR + DAY, {
      id: 'sub_0', product: { id: 'prod_e' }, last_transaction_id: 'tran_old', ...over,
    }), db, TR + DAY + 60_000, alerts);
    const row = db.rows[0];
    ok(`άλλη συνδρομή ${what}: η ανάκληση μένει`, row.plan === 'free' && row.mor_revoked_at === iso(TR)
       && row.mor_revoked_reason === 'refund' && r.body.skipped === 'other_subscription');
    ok(`άλλη συνδρομή ${what}: η καταγραφή μένει στη συνδρομή της`, row.mor_subscription_id === 'sub_1'
       && row.mor_last_transaction_id === 'tran_1' && db.upserts.length === 0);
    ok(`άλλη συνδρομή ${what}, ζωντανή: email στην υποστήριξη`, alerts.sent.length === 1
       && alerts.sent[0].text.includes('sub_0') && alerts.sent[0].text.includes('sub_1'));
  }
  {
    const db = fakeDb([revoked({ mor_event_at: iso(TR) })]);
    const alerts = fakeAlerts();
    await step(ev('subscription.expired', TR + DAY, { id: 'sub_0', status: 'expired', created_at: iso(T0 - 30 * DAY) }),
      db, TR + DAY + 60_000, alerts);
    ok('παλαιότερη συνδρομή που έληξε: τίποτα δεν γράφεται, κανένα email', db.upserts.length === 0
       && db.rows[0].mor_subscription_id === 'sub_1' && db.rows[0].mor_revoked_at === iso(TR) && alerts.sent.length === 0);
  }

  // ── Η ΣΥΝΑΛΛΑΓΗ ΠΟΥ ΕΠΙΣΤΡΑΦΗΚΕ ΔΕΝ ΞΑΝΑΝΟΙΓΕΙ (έλεγχος του PR 558, γύρος 3) ──
  // Η αναπαραγωγή του ευρήματος: η sub_1 κλείνει από επιστροφή, η sub_2
  // γεννιέται μετά και πληρώνεται (σβήνει το `mor_revoked_at`), η sub_2 λήγει
  // και η sub_1 στέλνει «active» με την ίδια επιστραμμένη tran_1.
  {
    const db = fakeDb([paying()]);
    const alerts = fakeAlerts();
    await step(moneyEvent('refund', TR), db, TR + 60_000, alerts);
    ok('αναπαραγωγή: η επιστροφή κλείνει', db.rows[0].plan === 'free' && db.rows[0].mor_revoked_tx === 'tran_1');
    await step(ev('subscription.paid', TR + DAY, {
      id: 'sub_2', last_transaction_id: 'tran_2', created_at: iso(TR + DAY - 60_000),
    }, P2), db, TR + DAY + 60_000, alerts);
    ok('αναπαραγωγή: η νέα συνδρομή ανοίγει και σβήνει την ανάκληση', db.rows[0].plan === 'solo'
       && db.rows[0].mor_subscription_id === 'sub_2' && db.rows[0].mor_revoked_at === null);
    ok('αναπαραγωγή: η επιστραμμένη συναλλαγή μένει γραμμένη', db.rows[0].mor_revoked_tx === 'tran_1');
    await step(ev('subscription.expired', TR + 2 * DAY, {
      id: 'sub_2', status: 'expired', last_transaction_id: 'tran_2', created_at: iso(TR + DAY - 60_000),
    }, P2), db, TR + 2 * DAY + 60_000, alerts);
    ok('αναπαραγωγή: η sub_2 λήγει', db.rows[0].plan === 'free' && db.rows[0].subscription_status === 'expired');
    const before = alerts.sent.length;
    const r = await step(ev('subscription.update', TR + 3 * DAY, { last_transaction_id: 'tran_1' }, P2),
      db, TR + 3 * DAY + 60_000, alerts);
    ok('«active» με την επιστραμμένη συναλλαγή: η πρόσβαση ΔΕΝ ανοίγει', db.rows[0].plan === 'free'
       && db.rows[0].subscription_status === 'expired' && db.rows[0].mor_subscription_id === 'sub_2');
    ok('«active» με την επιστραμμένη συναλλαγή: 200 και καμία εγγραφή', r.status === 200
       && r.body.skipped === 'revoked_transaction' && db.upserts.length === 2);
    ok('«active» με την επιστραμμένη συναλλαγή: email στην υποστήριξη', alerts.sent.length === before + 1
       && alerts.sent[before].text.includes('sub_1') && alerts.sent[before].text.includes('tran_1')
       && r.body.alerted === true);
    // ΑΚΥΡΩΜΕΝΗ ΜΕ ΜΕΛΛΟΝΤΙΚΟ ΤΕΛΟΣ ΠΕΡΙΟΔΟΥ: δίνει πρόσβαση, άρα ούτε αυτή.
    await step(ev('subscription.canceled', TR + 4 * DAY, {
      status: 'canceled', last_transaction_id: 'tran_1', canceled_at: iso(TR + 4 * DAY),
    }, P2), db, TR + 4 * DAY + 60_000, alerts);
    ok('«canceled» με μελλοντικό τέλος και την επιστραμμένη συναλλαγή: δεν ανοίγει', db.rows[0].plan === 'free'
       && db.rows[0].mor_subscription_id === 'sub_2');
  }
  // Ζ4.4: Η ΥΠΟΣΤΗΡΙΞΗ ΣΒΗΝΕΙ ΤΗΝ ΚΑΤΑΓΡΑΦΗ. Το `mor_revoked_tx` μένει και
  // κρατά τη γραμμή· μόνο νέα συναλλαγή ανοίγει ξανά.
  {
    const db = fakeDb([revoked({ mor_revoked_at: null, mor_revoked_reason: null })]);
    const alerts = fakeAlerts();
    const r = await step(ev('subscription.update', TR + DAY, { last_transaction_id: 'tran_1' }, P2), db, TR + DAY + 60_000, alerts);
    ok('Ζ4.4, «active» με την επιστραμμένη: μένει δωρεάν', db.rows[0].plan === 'free'
       && db.rows[0].subscription_status === 'expired' && r.body.skipped === 'revoked_transaction');
    ok('Ζ4.4, «active» με την επιστραμμένη: email', alerts.sent.length === 1);
    // Η ΙΔΙΑ ΕΠΙΣΤΡΟΦΗ ΞΑΝΑΣΤΕΛΝΕΤΑΙ: σιωπηλή, αλλά η πρόσβαση μένει κλειστή.
    await step(moneyEvent('refund', TR), db, TR + DAY + 90_000);
    ok('Ζ4.4, ξαναπαράδοση της επιστροφής: η πρόσβαση μένει κλειστή', db.rows[0].plan === 'free');
    // ΓΕΓΟΝΟΣ ΧΩΡΙΣ ΠΡΟΣΒΑΣΗ ΜΕ ΤΗΝ ΕΠΙΣΤΡΑΜΜΕΝΗ: γράφεται κανονικά, χωρίς email.
    const a2 = fakeAlerts();
    await step(ev('subscription.expired', TR + DAY + 3_600_000, { status: 'expired', last_transaction_id: 'tran_1' }, P2),
      db, TR + DAY + 3_660_000, a2);
    ok('Ζ4.4, «expired» με την επιστραμμένη: γράφεται, κανένα email', db.rows[0].plan === 'free'
       && db.rows[0].subscription_status === 'expired' && a2.sent.length === 0);
    // ΝΕΑ ΣΥΝΑΛΛΑΓΗ: ανοίγει ξανά, η επιστραμμένη μένει γραμμένη.
    await step(ev('subscription.paid', TR + 2 * DAY, { last_transaction_id: 'tran_2' }, P2), db, TR + 2 * DAY + 60_000);
    ok('Ζ4.4, νέα συναλλαγή: ανοίγει', db.rows[0].plan === 'solo' && db.rows[0].mor_last_transaction_id === 'tran_2'
       && db.rows[0].mor_revoked_tx === 'tran_1');
  }
  // Ζ4.4 ΚΑΙ ΓΕΓΟΝΟΣ ΧΩΡΙΣ ΣΥΝΑΛΛΑΓΗ (έλεγχος του PR 560, L1): η ίδια συνδρομή
  // στέλνει «active» χωρίς `last_transaction_id`. Η τελευταία πληρωμένη της
  // γραμμής είναι ακόμη η επιστραμμένη, οπότε τίποτα δεν δείχνει νέα πληρωμή.
  {
    const db = fakeDb([revoked({ mor_revoked_at: null, mor_revoked_reason: null })]);
    const alerts = fakeAlerts();
    const r = await step(ev('subscription.update', TR + DAY, {}, P2), db, TR + DAY + 60_000, alerts);
    ok('Ζ4.4, «active» χωρίς συναλλαγή: μένει δωρεάν', db.rows[0].plan === 'free'
       && db.rows[0].subscription_status === 'expired' && db.upserts.length === 0);
    ok('Ζ4.4, «active» χωρίς συναλλαγή: 200 και λόγος', r.status === 200 && r.body.skipped === 'revoked_no_transaction');
    ok('Ζ4.4, «active» χωρίς συναλλαγή: email στην υποστήριξη', alerts.sent.length === 1 && r.body.alerted === true
       && alerts.sent[0].text.includes('sub_1') && alerts.sent[0].text.includes('tran_1'));
    // Η ΝΕΑ ΠΛΗΡΩΜΗ ΚΟΥΒΑΛΑ ΠΑΝΤΑ ΣΥΝΑΛΛΑΓΗ: ανοίγει κανονικά.
    await step(ev('subscription.paid', TR + 2 * DAY, { last_transaction_id: 'tran_2' }, P2), db, TR + 2 * DAY + 60_000);
    ok('Ζ4.4, νέα πληρωμή μετά από γεγονός χωρίς συναλλαγή: ανοίγει', db.rows[0].plan === 'solo'
       && db.rows[0].mor_last_transaction_id === 'tran_2');
    // ΚΑΙ ΜΕΤΑ ΑΠΟ ΑΥΤΗΝ, γεγονός χωρίς συναλλαγή γράφεται: ο πελάτης πλήρωσε.
    await step(ev('subscription.update', TR + 3 * DAY, { status: 'canceled', canceled_at: iso(TR + 3 * DAY) }, P2),
      db, TR + 3 * DAY + 60_000);
    ok('Ζ4.4, γεγονός χωρίς συναλλαγή μετά από νέα πληρωμή: γράφεται', db.rows[0].plan === 'solo'
       && db.rows[0].subscription_status === 'cancelled' && db.upserts.length === 2);
  }
  // ΠΕΛΑΤΗΣ ΠΟΥ ΠΛΗΡΩΝΕΙ, ΜΕ ΠΑΛΙΑ ΕΠΙΣΤΡΑΜΜΕΝΗ ΣΤΗ ΓΡΑΜΜΗ: η ανανέωση και τα
  // γεγονότα χωρίς συναλλαγή περνούν όπως πάντα.
  {
    const db = fakeDb([paying({ mor_last_transaction_id: 'tran_2', mor_revoked_tx: 'tran_1', mor_revoked_ref: 'ref_1' })]);
    const alerts = fakeAlerts();
    const up = await step(ev('subscription.update', T1 - DAY), db, T1 - DAY + 60_000, alerts);
    ok('πληρώνει, παλιά επιστραμμένη: ενημέρωση χωρίς συναλλαγή γράφεται', up.body.skipped === undefined
       && db.upserts.length === 1 && db.rows[0].plan === 'solo' && alerts.sent.length === 0);
    await step(ev('subscription.paid', T1, { last_transaction_id: 'tran_3' }, P2), db, T1 + 60_000, alerts);
    ok('πληρώνει, παλιά επιστραμμένη: η ανανέωση περνά', db.rows[0].plan === 'solo'
       && db.rows[0].mor_renews_at === P2 && db.rows[0].mor_last_transaction_id === 'tran_3' && alerts.sent.length === 0);
  }

  // ══ 4. ΑΜΦΙΣΒΗΤΗΣΗ: ΙΔΙΟΣ ΚΑΝΟΝΑΣ ═════════════════════════════════════
  {
    const db = fakeDb([paying({ subscription_status: 'past_due', mor_past_due_at: iso(T2) })]);
    const alerts = fakeAlerts();
    const r = await step(moneyEvent('dispute', TR), db, TR + 60_000, alerts);
    ok('αμφισβήτηση: δωρεάν και καταγραφή', r.body.revoked === true && db.rows[0].plan === 'free'
       && db.rows[0].mor_revoked_reason === 'dispute' && db.rows[0].subscription_status === 'expired');
    ok('αμφισβήτηση: το «σε καθυστέρηση» σβήνει', db.rows[0].mor_past_due_at === null);
    ok('αμφισβήτηση: ειδοποίηση', alerts.sent.length === 1 && /Αμφισβήτηση/.test(alerts.sent[0].subject));
  }
  await stays('αμφισβήτηση παλαιότερης χρέωσης',
    moneyEvent('dispute', TR, { transaction: 'tran_1' }), [paying({ mor_last_transaction_id: 'tran_2' })], /παλαιότερη χρέωση/);
  await stays('αμφισβήτηση χωρίς ποσό', moneyEvent('dispute', TR, { refund: null }), [paying()], /χωρίς ποσό/);
  // ΑΜΦΙΣΒΗΤΗΣΗ ΜΕΤΑ ΑΠΟ ΕΠΙΣΤΡΟΦΗ (έλεγχος του PR 558, εύρημα 2): ήδη κλειστή,
  // ο λόγος μένει ο πρώτος. Είναι όμως ΝΕΟ περιστατικό στον έμπορο: email.
  {
    const db = fakeDb([revoked()]);
    const alerts = fakeAlerts();
    const r = await step(moneyEvent('dispute', TR + DAY), db, TR + DAY + 60_000, alerts);
    ok('αμφισβήτηση μετά την επιστροφή: τίποτα δεν ξαναγράφεται', r.body.revoked === false
       && db.revokes === 0 && db.rows[0].mor_revoked_reason === 'refund' && db.rows[0].mor_revoked_ref === 'ref_1');
    ok('αμφισβήτηση μετά την επιστροφή: email στην υποστήριξη', r.body.alerted === true && alerts.sent.length === 1
       && /Αμφισβήτηση/.test(alerts.sent[0].subject) && /είχε ήδη κλείσει/.test(alerts.sent[0].text));
    // Η ΙΔΙΑ αμφισβήτηση ξαναστέλνεται: δεν ξαναγράφεται, αλλά δεν είναι η
    // αναφορά που έκλεισε, οπότε ξαναφεύγει email. Σιωπηλή μένει ΜΟΝΟ η
    // επανάληψη της αναφοράς που έκλεισε την πρόσβαση.
    const alerts2 = fakeAlerts();
    const again = await step(moneyEvent('refund', TR), db, TR + DAY + 120_000, alerts2);
    ok('ξαναπαράδοση της επιστροφής που έκλεισε: σιωπηλή', again.body.skipped === 'same_reference' && alerts2.sent.length === 0);
  }
  // ΔΕΥΤΕΡΗ, ΔΙΑΦΟΡΕΤΙΚΗ ΕΠΙΣΤΡΟΦΗ ΣΤΗΝ ΙΔΙΑ ΣΥΝΔΡΟΜΗ: επίσης email.
  {
    const db = fakeDb([revoked()]);
    const alerts = fakeAlerts();
    const r = await step(moneyEvent('refund', TR + DAY, { id: 'ref_2' }), db, TR + DAY + 60_000, alerts);
    ok('δεύτερη επιστροφή σε κλειστή: email', r.body.alerted === true && alerts.sent.length === 1 && db.revokes === 0);
  }
}

main().then(() => {
  console.log(fail === 0 ? `✓ morWebhook (μηχανή καταστάσεων): ${pass} έλεγχοι πέρασαν` : `✗ morWebhook (μηχανή καταστάσεων): ${fail} απέτυχαν από ${pass + fail}`);
  if (fail > 0) process.exit(1);
});
