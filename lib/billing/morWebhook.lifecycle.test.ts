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
  mor_renews_at: P1, mor_event_at: iso(T0), ...over,
});

async function step(raw: string, db: FakeDb, now: number, alerts = fakeAlerts()) {
  return runWebhook(raw, db, alerts, iso(now));
}

async function main() {
  // ══ 1. ΑΝΑΝΕΩΣΗ: ΔΕΥΤΕΡΗ ΠΕΡΙΟΔΟΣ ═════════════════════════════════════
  {
    const db = fakeDb([paying()]);
    const r = await step(ev('subscription.paid', T1, {}, P2), db, T1 + 60_000);
    const row = db.rows[0];
    ok('ανανέωση: 200 ok', r.status === 200 && r.body.ok === true);
    ok('ανανέωση: το πακέτο μένει', row.plan === 'solo' && row.subscription_status === 'active');
    ok('ανανέωση: η επόμενη ανανέωση πάει στη δεύτερη περίοδο', row.mor_renews_at === P2);
    ok('ανανέωση: η ώρα του γεγονότος προχωρά', row.mor_event_at === iso(T1));
    ok('ανανέωση: καμία λήξη, κανένα «σε καθυστέρηση»', row.mor_ends_at === null && row.mor_past_due_at === null);
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

  // ══ 3. ΕΠΙΣΤΡΟΦΗ ΧΡΗΜΑΤΩΝ: ΤΕΛΟΣ ΠΡΟΣΒΑΣΗΣ ════════════════════════════
  const TR = T0 + 3 * DAY;                                   // η επιστροφή
  {
    const db = fakeDb([paying()]);
    const alerts = fakeAlerts();
    const r = await step(moneyEvent('refund', TR), db, TR + 60_000, alerts);
    const row = db.rows[0];
    ok('επιστροφή: 200 με revoked', r.status === 200 && r.body.ok === true && r.body.revoked === true);
    ok('επιστροφή: δωρεάν', row.plan === 'free');
    ok('επιστροφή: η κατάσταση γίνεται «έληξε»', row.subscription_status === 'expired');
    ok('επιστροφή: καταγράφεται πότε και γιατί', row.mor_revoked_at === iso(TR) && row.mor_revoked_reason === 'refund');
    ok('επιστροφή: η πρόσβαση τελείωσε τη στιγμή της επιστροφής', row.mor_ends_at === iso(TR));
    ok('επιστροφή: καμία ανανέωση δεν περιμένει', row.mor_renews_at === null);
    ok('επιστροφή: η συνδρομή μένει καταγεγραμμένη, για την πύλη πελάτη', row.mor_subscription_id === 'sub_1');
    ok('επιστροφή: ΜΙΑ ειδοποίηση, που λέει ότι η πρόσβαση έκλεισε', alerts.sent.length === 1
       && /έκλεισε/.test(alerts.sent[0].text) && alerts.sent[0].text.includes('sub_1'));
    ok('κανένα email πελάτη στο μήνυμα', !alerts.sent[0].text.includes('a@b.gr'));

    // ΙΔΙΑ ΕΠΙΣΤΡΟΦΗ ΔΕΥΤΕΡΗ ΦΟΡΑ: τίποτα δεν αλλάζει, κανένα δεύτερο μήνυμα.
    const alerts2 = fakeAlerts();
    const again = await step(moneyEvent('refund', TR), db, TR + 120_000, alerts2);
    ok('επιστροφή δύο φορές: 200, χωρίς δεύτερη εγγραφή', again.status === 200
       && again.body.skipped === 'already_revoked' && db.upserts.length === 1);
    ok('επιστροφή δύο φορές: χωρίς δεύτερο μήνυμα', alerts2.sent.length === 0);
    ok('επιστροφή δύο φορές: η ώρα της πρώτης μένει', db.rows[0].mor_revoked_at === iso(TR));

    // ΚΑΘΥΣΤΕΡΗΜΕΝΟ «ΕΝΕΡΓΗ» ΠΟΥ ΣΥΝΕΒΗ ΠΡΙΝ ΑΠΟ ΤΗΝ ΕΠΙΣΤΡΟΦΗ: δεν ξανανοίγει τίποτα.
    await step(ev('subscription.active', TR - DAY), db, TR + 180_000);
    ok('παλιό «ενεργή» μετά την επιστροφή: μένει δωρεάν', db.rows[0].plan === 'free');

    // Ο ΕΜΠΟΡΟΣ ΛΕΕΙ ΑΚΟΜΗ «active» (η επιστροφή δεν ακυρώνει μόνη της τη
    // συνδρομή εκεί): νεότερη ενημέρωση ΧΩΡΙΣ πληρωμή δεν δίνει πρόσβαση.
    const up = await step(ev('subscription.update', TR + DAY), db, TR + DAY + 60_000);
    ok('νεότερη ενημέρωση χωρίς πληρωμή: μένει δωρεάν', db.rows[0].plan === 'free' && up.body.skipped === 'revoked');
    ok('και η καταγραφή της επιστροφής μένει', db.rows[0].mor_revoked_reason === 'refund');
  }
  // ΝΕΑ ΧΡΕΩΣΗ ΤΗΣ ΙΔΙΑΣ ΣΥΝΔΡΟΜΗΣ ΜΕΤΑ ΤΗΝ ΕΠΙΣΤΡΟΦΗ: πλήρωσε, άρα πρόσβαση,
  // αλλά ο άνθρωπος πρέπει να μάθει ότι η συνδρομή δεν ακυρώθηκε.
  {
    const db = fakeDb([paying({ plan: 'free', subscription_status: 'expired', mor_revoked_at: iso(TR),
      mor_revoked_reason: 'refund', mor_ends_at: iso(TR), mor_event_at: iso(TR), mor_renews_at: null })]);
    const alerts = fakeAlerts();
    await step(ev('subscription.paid', T1, {}, P2), db, T1 + 60_000, alerts);
    ok('χρέωση μετά την επιστροφή: το πακέτο ξανανοίγει', db.rows[0].plan === 'solo' && db.rows[0].subscription_status === 'active');
    ok('χρέωση μετά την επιστροφή: η καταγραφή σβήνει', db.rows[0].mor_revoked_at === null && db.rows[0].mor_revoked_reason === null);
    ok('χρέωση μετά την επιστροφή: ειδοποίηση στην υποστήριξη', alerts.sent.length === 1
       && alerts.sent[0].text.includes('sub_1'));
  }
  // ΕΠΙΣΤΡΟΦΗ ΠΟΥ ΦΤΑΝΕΙ ΜΕΤΑ ΑΠΟ ΝΕΟΤΕΡΟ ΓΕΓΟΝΟΣ: εφαρμόζεται κανονικά.
  {
    const later = TR + 60 * 60_000;
    const db = fakeDb([paying({ mor_event_at: iso(later) })]);
    const r = await step(moneyEvent('refund', TR), db, later + 60_000);
    ok('επιστροφή εκτός σειράς: εφαρμόζεται', r.body.revoked === true && db.rows[0].plan === 'free');
    ok('επιστροφή εκτός σειράς: η ώρα τελευταίου γεγονότος δεν γυρίζει πίσω', db.rows[0].mor_event_at === iso(later));
  }
  // ΜΕΡΙΚΗ ΕΠΙΣΤΡΟΦΗ: δεν κόβει το πακέτο, φτάνει σε άνθρωπο.
  {
    const db = fakeDb([paying()]);
    const alerts = fakeAlerts();
    const r = await step(moneyEvent('refund', TR, { refund: 100, paid: 499 }), db, TR + 60_000, alerts);
    ok('μερική επιστροφή: το πακέτο μένει', db.upserts.length === 0 && db.rows[0].plan === 'solo' && r.body.revoked !== true);
    ok('μερική επιστροφή: ειδοποίηση που το λέει', alerts.sent.length === 1 && /μερική/i.test(alerts.sent[0].text));
  }
  // ΕΠΙΣΤΡΟΦΗ ΠΑΛΙΑΣ ΣΥΝΔΡΟΜΗΣ: η ζωντανή δεν αγγίζεται.
  {
    const db = fakeDb([paying({ plan: 'agency', mor_subscription_id: 'sub_live' })]);
    const alerts = fakeAlerts();
    const r = await step(moneyEvent('refund', TR), db, TR + 60_000, alerts);
    ok('επιστροφή άλλης συνδρομής: καμία εγγραφή', db.upserts.length === 0 && db.rows[0].plan === 'agency');
    ok('επιστροφή άλλης συνδρομής: 200 και ειδοποίηση', r.status === 200 && alerts.sent.length === 1);
  }
  // ΕΠΙΣΤΡΟΦΗ ΧΩΡΙΣ ΣΥΝΔΡΟΜΗ (μεμονωμένη αγορά, άγνωστο σχήμα): μόνο ειδοποίηση.
  {
    const db = fakeDb([paying()]);
    const alerts = fakeAlerts();
    const r = await step(moneyEvent('refund', TR, { subscription: null }), db, TR + 60_000, alerts);
    ok('επιστροφή χωρίς συνδρομή: η βάση δεν αγγίζεται', db.opened === 0 && db.rows[0].plan === 'solo');
    ok('επιστροφή χωρίς συνδρομή: 200 και ειδοποίηση', r.status === 200 && r.body.alerted === true);
  }
  // Η ΒΑΣΗ ΔΕΝ ΓΡΑΦΕΙ: 502, ώστε ο έμπορος να ξαναστείλει.
  {
    const db = fakeDb([paying()], { upsert: true });
    const alerts = fakeAlerts();
    const r = await step(moneyEvent('refund', TR), db, TR + 60_000, alerts);
    ok('επιστροφή που δεν γράφτηκε: 502', r.status === 502 && r.body.error === 'write_failed');
    ok('επιστροφή που δεν γράφτηκε: το μήνυμα περιμένει την επανάληψη', alerts.sent.length === 0);
  }
  {
    const db = fakeDb([paying()], { lookup: true });
    const r = await step(moneyEvent('refund', TR), db, TR + 60_000);
    ok('επιστροφή με αναζήτηση που απέτυχε: 502', r.status === 502 && r.body.error === 'lookup_failed');
  }
  // ΝΕΑ ΑΓΟΡΑ ΜΕΤΑ ΤΗΝ ΕΠΙΣΤΡΟΦΗ: νέα συνδρομή, καθαρή καταγραφή.
  {
    const db = fakeDb([paying({ plan: 'free', subscription_status: 'expired', mor_revoked_at: iso(TR),
      mor_revoked_reason: 'refund', mor_ends_at: iso(TR), mor_event_at: iso(TR) })]);
    await step(ev('subscription.active', TR + DAY, { id: 'sub_2', product: { id: 'prod_c' } }), db, TR + DAY + 60_000);
    ok('νέα αγορά μετά την επιστροφή: ανοίγει', db.rows[0].plan === 'owner' && db.rows[0].mor_subscription_id === 'sub_2');
    ok('νέα αγορά μετά την επιστροφή: η παλιά καταγραφή σβήνει', db.rows[0].mor_revoked_at === null);
  }

  // ══ 4. ΑΜΦΙΣΒΗΤΗΣΗ: ΤΕΛΟΣ ΠΡΟΣΒΑΣΗΣ ΑΠΟ ΤΗΝ ΠΡΩΤΗ ΣΤΙΓΜΗ ══════════════
  {
    const db = fakeDb([paying({ subscription_status: 'past_due', mor_past_due_at: iso(T2) })]);
    const alerts = fakeAlerts();
    const r = await step(moneyEvent('dispute', TR), db, TR + 60_000, alerts);
    ok('αμφισβήτηση: δωρεάν και καταγραφή', r.body.revoked === true && db.rows[0].plan === 'free'
       && db.rows[0].mor_revoked_reason === 'dispute' && db.rows[0].subscription_status === 'expired');
    ok('αμφισβήτηση: το «σε καθυστέρηση» σβήνει', db.rows[0].mor_past_due_at === null);
    ok('αμφισβήτηση: ειδοποίηση', alerts.sent.length === 1 && /Αμφισβήτηση/.test(alerts.sent[0].subject));
  }
  // ΑΜΦΙΣΒΗΤΗΣΗ ΜΕΤΑ ΑΠΟ ΕΠΙΣΤΡΟΦΗ: ήδη κλειστή, ο λόγος μένει ο πρώτος.
  {
    const db = fakeDb([paying({ plan: 'free', subscription_status: 'expired', mor_revoked_at: iso(TR), mor_revoked_reason: 'refund' })]);
    const r = await step(moneyEvent('dispute', TR + DAY), db, TR + DAY + 60_000);
    ok('αμφισβήτηση μετά την επιστροφή: τίποτα δεν ξαναγράφεται', r.body.skipped === 'already_revoked'
       && db.upserts.length === 0 && db.rows[0].mor_revoked_reason === 'refund');
  }
}

main().then(() => {
  console.log(fail === 0 ? `✓ morWebhook (μηχανή καταστάσεων): ${pass} έλεγχοι πέρασαν` : `✗ morWebhook (μηχανή καταστάσεων): ${fail} απέτυχαν από ${pass + fail}`);
  if (fail > 0) process.exit(1);
});
