// ═══════════════════════════════════════════════════════════════════════════
// Ο WEBHOOK ΤΟΥ ΕΜΠΟΡΟΥ, ΕΞΩ ΑΠΟ ΤΟΝ ΦΑΚΕΛΟ ΕΝΟΣ ΕΜΠΟΡΟΥ
// ─────────────────────────────────────────────────────────────────────────
// ΓΙΑΤΙ ΜΕΤΑΚΟΜΙΣΕ, ΧΩΡΙΣ ΝΑ ΑΛΛΑΞΕΙ ΓΡΑΜΜΗ. Ο κώδικας δεν ήξερε ποτέ πάροχο:
// καλεί `merchant()` και ζητά υπογραφή και γεγονός από τη θύρα. Ζούσε όμως στο
// «app/api/billing/lemon/route.ts», δηλαδή ο δεύτερος έμπορος θα σήμαινε είτε
// αντίγραφο διακοσίων γραμμών είτε διεύθυνση webhook με ξένο όνομα.
//
// ΚΑΘΕ ΕΜΠΟΡΟΣ ΘΕΛΕΙ ΔΙΚΗ ΤΟΥ ΔΙΕΥΘΥΝΣΗ ΚΑΙ ΕΙΝΑΙ ΣΩΣΤΟ: η υπογραφή ελέγχεται
// με το ΔΙΚΟ του μυστικό. Δύο πάροχοι στην ίδια διεύθυνση θα σήμαινε ότι ο ένας
// δοκιμάζει την υπογραφή του άλλου και αποτυγχάνει. Η διαδρομή είναι λεπτή
// (σήμερα μία, «app/api/billing/creem/route.ts»)· η κρίση είναι μία και ζει
// εδώ.
//
// ── ΤΕΣΣΕΡΙΣ ΑΠΟΦΑΣΕΙΣ, ΑΜΕΤΑΒΛΗΤΕΣ ──────────────────────────────────────
// ΤΟ ΣΩΜΑ ΔΙΑΒΑΖΕΤΑΙ ΩΜΟ, ΠΡΙΝ ΑΠΟ ΚΑΘΕ ΑΛΛΟ. Η υπογραφή υπολογίζεται πάνω στα
// ίδια ακριβώς bytes που έστειλε ο έμπορος. Ενα `request.json()` πρώτα και
// `JSON.stringify` μετά αλλάζει κενά και κάθε γνήσιο γεγονός θα απορριπτόταν.
//
// Η ΑΠΑΝΤΗΣΗ ΛΕΕΙ ΤΗΝ ΑΛΗΘΕΙΑ ΣΤΟΝ ΕΜΠΟΡΟ. Ενα βολικό «200 σε όλα» κρύβει τις
// αποτυχίες από τον πίνακα του εμπόρου — που είναι το μόνο μέρος όπου θα
// τις δει ποτέ κανείς. Γεγονός που δεν μας αφορά παίρνει 200· γεγονός που δεν
// καταλάβαμε ή δεν γράφτηκε παίρνει σφάλμα, ώστε να ξαναδοκιμαστεί και να
// φανεί.
//
// ΤΟ «ΓΙΑΤΙ ΟΧΙ» ΜΕΝΕΙ ΜΕΣΑ. Στα αρχεία καταγραφής γράφεται ονομαστικά τι
// έφταιξε· στην απάντηση πάει μόνο κωδικός. Ονόματα μεταβλητών και δομή της
// βάσης δεν εκτίθενται σε δημόσια διεύθυνση.
//
// ΤΑ ΚΑΘΥΣΤΕΡΗΜΕΝΑ ΓΕΓΟΝΟΤΑ ΔΕΝ ΓΡΑΦΟΥΝ ΠΑΝΩ ΑΠΟ ΤΑ ΝΕΟΤΕΡΑ. Τα webhook δεν
// φτάνουν με σειρά. Οταν ο έμπορος στέλνει ώρα τελευταίας μεταβολής, κρατιέται
// και συγκρίνεται· όταν δεν τη στέλνει, το γεγονός εφαρμόζεται — δεν
// εφευρίσκουμε ώρα για να δικαιολογήσουμε απόρριψη.
//
// ── ΚΑΙ ΔΥΟ ΑΚΟΜΗ, ΑΠΟ ΤΟΝ ΕΛΕΓΧΟ ΕΤΟΙΜΟΤΗΤΑΣ ΠΛΗΡΩΜΩΝ (12/11/2026) ────────
// Η ΕΠΙΣΤΡΟΦΗ ΧΡΗΜΑΤΩΝ ΚΑΙ Η ΑΜΦΙΣΒΗΤΗΣΗ ΚΛΕΙΝΟΥΝ ΤΗΝ ΠΡΟΣΒΑΣΗ, μόνο για τη
// συνδρομή που έχει ήδη καταγράψει ένας λογαριασμός. Και το κλείσιμο ΜΕΝΕΙ:
// κανένα επόμενο γεγονός της ίδιας συνδρομής δεν το αναιρεί, εκτός από νέα
// χρέωση που πέρασε μετά. Η επιστροφή είναι γεγονός, όχι κατάσταση: δεν
// περνά από το φίλτρο σειράς.
//
// ΤΟ `past_due` ΕΧΕΙ ΟΡΙΟ. Η πρώτη αποτυχία σημειώνεται μία φορά
// (`mor_past_due_at`) και η πρόσβαση κρατά `PAST_DUE_GRACE_DAYS` ημέρες από
// εκεί. Το όριο κρίνεται και στην ανάγνωση (`user_plan_rank`, `livePlan`),
// χωρίς να περιμένει άλλο γεγονός.
// ═══════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';
import { merchant, type MerchantPort, type BillingEnv, type Revocation } from '@/lib/billing/merchant';
import { isEntitled, isMorStatus, type MorStatus } from '@/lib/billing/subscription';
import { profileForPlan } from '@/lib/billing/entitlements';
import {
  alertFor, duplicateAlert, orphanAlert, otherSubscriptionAlert, rechargedAlert, refundedTransactionAlert,
  revokedNoTransactionAlert, sendMerchantAlert, unprovenPaymentAlert,
  type MerchantAlert, type RevocationOutcome,
} from '@/lib/billing/merchantAlert';

/** Ο πίνακας που κρατά το πακέτο του κάθε λογαριασμού. */
const TABLE = 'billing_profiles';

// ═══ ΟΙ ΑΠΟΦΑΣΕΙΣ, ΧΩΡΙΣΤΑ ΑΠΟ ΤΗ ΜΕΤΑΦΟΡΑ ══════════════════════════════════
// ΓΙΑΤΙ ΒΓΗΚΑΝ ΕΞΩ. Το `applyMerchantEvent` δένεται με τον έμπορο, με τον
// πελάτη υπηρεσίας και με το `NextResponse`: για να ελεγχθεί ολόκληρο θα
// χρειαζόταν να πλαστογραφηθούν τρία modules — ένας τέτοιος έλεγχος
// δοκιμάζει κυρίως τα πλαστά. Οι κρίσεις όμως —ποιος κωδικός σε ποια αποτυχία,
// ποιο γεγονός είναι παλιό, πότε σφραγίζεται η δοκιμή— είναι ΠΟΛΙΤΙΚΗ· η
// πολιτική πρέπει να διαβάζεται και να ελέγχεται χωρίς δίκτυο.
//
// Καμία αλλαγή συμπεριφοράς: οι ίδιες γραμμές, σε συναρτήσεις με όνομα.
//
// ΚΑΙ Η ΡΟΗ ΕΛΕΓΧΕΤΑΙ ΠΛΕΟΝ ΟΛΟΚΛΗΡΗ, ΧΩΡΙΣ ΠΛΑΣΤΟ MODULE. Το περιβάλλον, η
// βάση και ο αποστολέας περνούν ως όρισμα (`MerchantEventDeps`) και η σουίτα
// «morWebhook.apply.test.ts» στέλνει αληθινά σώματα του εμπόρου σε ψεύτικη
// βάση που θυμάται ό,τι γράφτηκε.

/**
 * ΤΟ ΓΕΓΟΝΟΣ ΠΟΥ ΗΡΘΕ ΑΡΓΟΤΕΡΑ ΑΛΛΑ ΣΥΝΕΒΗ ΝΩΡΙΤΕΡΑ.
 *
 * Τα webhook δεν φτάνουν με σειρά. Ενα καθυστερημένο «ακυρώθηκε» που γράφει
 * πάνω από ένα νεότερο «ανανεώθηκε» κλείνει τη συνδρομή πελάτη που πλήρωσε.
 *
 * Οταν ο έμπορος ΔΕΝ στέλνει ώρα, το γεγονός εφαρμόζεται: δεν εφευρίσκουμε
 * ώρα για να δικαιολογήσουμε απόρριψη.
 */
export function isStaleEvent(eventAt: string | null | undefined, seenAt: string | null | undefined): boolean {
  if (!eventAt || !seenAt) return false;
  const a = new Date(eventAt).getTime(), b = new Date(seenAt).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return false;   // ώρα που δεν διαβάζεται δεν κρίνει
  return a < b;
}

/**
 * Η ΣΦΡΑΓΙΔΑ ΤΗΣ ΔΟΚΙΜΗΣ ΓΡΑΦΕΤΑΙ ΜΙΑ ΦΟΡΑ.
 *
 * Οταν υπάρχει ήδη, μένει: χωρίς αυτό κάθε επόμενο γεγονός θα μετακινούσε την
 * ημερομηνία προς τα εμπρός και το «η δοκιμή χρησιμοποιήθηκε» θα κρινόταν από
 * την τελευταία ανανέωση αντί από την πρώτη δοκιμή.
 *
 * Και σφραγίζεται μόνο όταν ο ΕΜΠΟΡΟΣ λέει `on_trial` — όχι όταν άνοιξε το
 * ταμείο. Ταμείο που εγκαταλείφθηκε δεν καίει τη δοκιμή κανενός.
 */
export function trialStamp(seenTrialAt: string | null | undefined, status: string, eventAt: string | null | undefined): string | null {
  return seenTrialAt ?? (status === 'on_trial' ? (eventAt ?? null) : null);
}

/**
 * ΤΟ ΡΟΛΟΪ ΤΗΣ ΧΑΡΗΣ ΞΕΚΙΝΑ ΜΙΑ ΦΟΡΑ.
 *
 * Ο έμπορος ξαναδοκιμάζει την είσπραξη και στέλνει `past_due` σε κάθε
 * αποτυχία. Αν κάθε γεγονός έγραφε τη δική του ώρα, η χάρη θα ξεκινούσε από
 * την αρχή σε κάθε προσπάθεια και δεν θα έληγε ποτέ, δηλαδή ακριβώς το κενό
 * που κλείνει. Κρατιέται η ώρα της ΠΡΩΤΗΣ αποτυχίας της ΙΔΙΑΣ συνδρομής· μόλις
 * η κατάσταση πάψει να είναι `past_due`, σβήνει.
 *
 * Χωρίς ώρα γεγονότος μετρά από τη στιγμή που το είδαμε: η χάρη δεν μένει
 * ανοιχτή για πάντα επειδή ο φάκελος δεν είχε ημερομηνία.
 */
export function pastDueStamp(
  status: string, seenAt: string | null | undefined, sameSubscription: boolean,
  eventAt: string | null | undefined, nowIso: string,
): string | null {
  if (status !== 'past_due') return null;
  if (sameSubscription && seenAt) return seenAt;
  return eventAt ?? nowIso;
}

/**
 * Ο ΤΥΠΟΣ ΠΡΟΦΙΛ ΑΚΟΛΟΥΘΕΙ ΤΗΝ ΑΓΟΡΑ.
 *
 * Πρώτη γραφή: γραφόταν μόνο όταν έλειπε, για να μη σβήσει ο webhook τη
 * δήλωση του χρήστη. Ομως ο δηλωμένος «Επαγγελματίας» χωρίς το πακέτο του
 * έμενε κολλημένος: η οθόνη τον έδειχνε «Ιδιώτη», το ταμείο τον έκρινε
 * «Επαγγελματία» και δεν αγόραζε τίποτα (έλεγχος 28.09.2026).
 *
 * Η αγορά είναι νεότερη δήλωση από το κουμπί των Ρυθμίσεων. Οποιος πλήρωσε
 * «Επαγγελματίας» βρίσκει ανοιχτές τις καρτέλες που αγόρασε και όποιος
 * πλήρωσε «Ιδιοκτήτης+» βλέπει τον τρόπο που αντιστοιχεί στο πακέτο του.
 *
 * Μόνο γεγονός που ΔΙΝΕΙ πρόσβαση γράφει. Η λήξη μιας παλιάς συνδρομής δεν
 * αγόρασε τίποτα και δεν έχει λόγο να αλλάξει τον τρόπο χρήσης.
 */
export function profileTypeToWrite(
  seenType: string | null | undefined,
  plan: Parameters<typeof profileForPlan>[0],
  entitled: boolean,
): string | null {
  const bought = profileForPlan(plan);
  const seen = (seenType || '').trim();
  if (!seen) return bought;
  return entitled && seen !== bought ? bought : null;
}

/**
 * ΜΙΑ ΕΙΔΟΠΟΙΗΣΗ ΠΟΥ ΔΕΝ ΜΠΟΡΕΙ ΝΑ ΡΙΞΕΙ ΤΟ ΓΕΓΟΝΟΣ.
 *
 * Ο προεπιλεγμένος αποστολέας δεν πετά ποτέ, αλλά ο webhook δεν το υποθέτει:
 * ό,τι δοθεί ως αποστολέας τυλίγεται εδώ και μια εξαίρεση γίνεται «δεν
 * στάλθηκε», όχι 500 προς τον έμπορο.
 */
async function safeSend(send: (a: MerchantAlert) => Promise<boolean>, alert: MerchantAlert): Promise<boolean> {
  try { return await send(alert); } catch { return false; }
}

/**
 * ΟΣΑ Ο WEBHOOK ΠΑΙΡΝΕΙ ΑΠΟ ΕΞΩ, ΩΣΤΕ Η ΡΟΗ ΝΑ ΔΟΚΙΜΑΖΕΤΑΙ ΧΩΡΙΣ ΔΙΚΤΥΟ.
 *
 * ΓΙΑΤΙ ΟΡΙΣΜΑ ΚΑΙ ΟΧΙ ΠΛΑΣΤΟΓΡΑΦΗΣΗ MODULE. Οι καθαρές κρίσεις παραπάνω
 * ελέγχονται μόνες τους· η ΡΟΗ όμως (τι διαβάζεται, τι γράφεται, τι απαντά ο
 * webhook) δεν ελεγχόταν πουθενά. Με το περιβάλλον, τη βάση και τον αποστολέα
 * ως ορίσματα, η σουίτα δίνει αληθινό σώμα του εμπόρου και ψεύτικη βάση που
 * θυμάται κάθε εγγραφή, χωρίς να αντικαταστήσει ούτε ένα module.
 *
 * Ολα προαιρετικά: η διαδρομή δεν δίνει τίποτα και παίρνει ακριβώς την
 * προηγούμενη συμπεριφορά.
 */
export interface MerchantEventDeps {
  /** Το περιβάλλον. Προεπιλογή το `process.env`. */
  env?: BillingEnv;
  /** Ο έμπορος. Προεπιλογή ο `merchant(env)`. */
  mor?: MerchantPort;
  /** Ο πελάτης της βάσης. Προεπιλογή ο πελάτης υπηρεσίας· μπορεί να πετάξει. */
  db?: () => SupabaseClient;
  /** Η αποστολή ειδοποίησης σε άνθρωπο. Δεν επιτρέπεται να ρίξει το γεγονός. */
  sendAlert?: (alert: MerchantAlert) => Promise<boolean>;
  /** Η ώρα, σε ISO, για το «ισχύει ακόμη». Προεπιλογή η τρέχουσα. */
  now?: () => string;
}

/**
 * ΕΠΙΣΤΡΟΦΗ ΧΡΗΜΑΤΩΝ Ή ΑΜΦΙΣΒΗΤΗΣΗ: ΤΕΛΟΣ ΠΡΟΣΒΑΣΗΣ, ΜΟΝΟ ΟΤΑΝ ΕΙΝΑΙ ΣΑΦΕΣ.
 *
 * ΠΗΓΗ: έλεγχος ετοιμότητας πληρωμών 12/11/2026, «Λείπει (κώδικας)» 1· και ο
 * έλεγχος του PR 558 (M1, L3, L4). Ως τότε έφευγε μόνο email και ο πελάτης που
 * πήρε πίσω τα χρήματά του κρατούσε το πακέτο.
 *
 * ΠΟΤΕ ΚΟΒΕΙ. Μόνο όταν ΚΑΙ τα τρία ισχύουν:
 *   · ολόκληρη επιστροφή: ποσά παρόντα, ίδιο νόμισμα, ίσα με όσα πλήρωσε ο
 *     πελάτης (`whole === 'yes'`, creem.ts)·
 *   · η συνδρομή είναι ΑΥΤΗ που έχει καταγράψει ένας λογαριασμός·
 *   · η συναλλαγή είναι η ΤΕΛΕΥΤΑΙΑ πληρωμένη της συνδρομής
 *     (`mor_last_transaction_id`). Η επιστροφή του πρώτου μήνα αφού πληρώθηκε ο
 *     δεύτερος δεν κόβει πελάτη που πληρώνει.
 * Σε κάθε άλλη περίπτωση η πρόσβαση μένει και φεύγει email στην υποστήριξη.
 * Ούτε `metadata` ούτε email πελάτη: το σχήμα δεν έχει περάσει από αληθινή
 * επιστροφή.
 *
 * ΣΕ ΕΝΑ ΒΗΜΑ ΣΤΗ ΒΑΣΗ. Η `public.revoke_mor_access` ελέγχει και γράφει με ένα
 * υπό όρους UPDATE: καμία ανάγνωση που θα μπορούσε να παλιώσει ανάμεσα. Και η
 * σκανδάλη `keep_mor_revocation` κρατά την ανάκληση απέναντι σε ταυτόχρονο
 * γεγονός `subscription.*` που διάβασε πριν από αυτήν: μόνο νέα συνδρομή ή νέα
 * πληρωμένη συναλλαγή τη σηκώνει (μετανάστευση 20261112190000).
 *
 * ΜΙΑ ΦΟΡΑ. Η αναφορά της επιστροφής (`mor_revoked_ref`) μένει και μετά από
 * νέα χρέωση· η ίδια επιστροφή που ξαναστέλνεται δεν ξανακόβει. Το ρολόι των
 * γεγονότων συνδρομής (`mor_event_at`) δεν αγγίζεται: η επιστροφή δεν είναι
 * γεγονός συνδρομής.
 */
async function applyRevocation(
  rv: Revocation, payload: unknown, deps: MerchantEventDeps,
  sendAlert: (a: MerchantAlert) => Promise<boolean>, log: (...parts: unknown[]) => void,
) {
  const notify = async (outcome?: RevocationOutcome): Promise<boolean> => {
    const alert = alertFor(payload, outcome);
    if (!alert) return false;
    const sent = await safeSend(sendAlert, alert);
    log(`${alert.subject}· ειδοποίηση ${sent ? 'στάλθηκε' : 'ΔΕΝ στάλθηκε'}`);
    return sent;
  };
  const kept = async (outcome: RevocationOutcome, why: string) => {
    log(`${rv.kind} για τη συνδρομή ${rv.subscriptionId}: ${why}· η πρόσβαση δεν άλλαξε`);
    return NextResponse.json({ ok: true, alerted: await notify(outcome), revoked: false });
  };

  if (!rv.subscriptionId) {
    log(`${rv.kind} χωρίς συνδρομή· η πρόσβαση δεν άλλαξε`);
    return NextResponse.json({ ok: true, alerted: await notify() });
  }
  if (rv.whole !== 'yes') return kept(rv.whole, `όχι σαφώς ολόκληρη (${rv.whole})`);
  if (!rv.transactionId) return kept('missing', 'χωρίς συναλλαγή');

  let db;
  try { db = (deps.db ?? (() => createServiceClient()))(); } catch (e) {
    log('πελάτης υπηρεσίας:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'not_configured' }, { status: 500 });
  }

  const nowIso = deps.now ? deps.now() : new Date().toISOString();
  const { data, error } = await db.rpc('revoke_mor_access', {
    p_subscription: rv.subscriptionId,
    p_transaction: rv.transactionId,
    p_reference: rv.reference ?? `${rv.kind}:${rv.transactionId}`,
    p_reason: rv.kind,
    p_at: rv.occurredAt ?? nowIso,
  });
  if (error) {
    // 502: ο έμπορος ξαναστέλνει. Το μήνυμα φεύγει με την επιτυχημένη
    // επανάληψη, ένα ανά περιστατικό.
    log('η ανάκληση δεν γράφτηκε:', error.message);
    return NextResponse.json({ error: 'write_failed' }, { status: 502 });
  }
  const out = (data ?? {}) as { outcome?: string; user_id?: string };
  switch (out.outcome) {
    case 'revoked':
      log(`${rv.kind} για τη συνδρομή ${rv.subscriptionId}: η πρόσβαση του λογαριασμού ${out.user_id} έκλεισε`);
      return NextResponse.json({ ok: true, alerted: await notify('revoked'), revoked: true });
    case 'already_same_ref':
      // Η ΙΔΙΑ επιστροφή ή αμφισβήτηση ξαναπαραδόθηκε: το email έφυγε την
      // πρώτη φορά. Μόνο αυτή μένει σιωπηλή.
      log(`${rv.kind} για τη συνδρομή ${rv.subscriptionId}: ίδια αναφορά, ξαναπαράδοση`);
      return NextResponse.json({ ok: true, skipped: 'same_reference' });
    case 'already':
      // ΑΛΛΗ επιστροφή ή αμφισβήτηση σε πρόσβαση ήδη κλειστή, π.χ. αμφισβήτηση
      // μετά από επιστροφή (έλεγχος του PR 558, εύρημα 2). Δεν ξαναγράφεται
      // τίποτα, αλλά είναι νέο περιστατικό στον έμπορο και το μαθαίνει άνθρωπος.
      return kept('already', 'ήδη κλειστή από άλλη επιστροφή ή αμφισβήτηση');
    case 'not_latest':
      return kept('older', 'όχι η τελευταία πληρωμένη συναλλαγή');
    default:
      return kept('unmatched', 'δεν την κρατά κανένας λογαριασμός');
  }
}

/**
 * Ο,ΤΙ ΓΙΝΕΤΑΙ ΑΦΟΥ Η ΥΠΟΓΡΑΦΗ ΕΧΕΙ ΗΔΗ ΕΠΑΛΗΘΕΥΤΕΙ.
 *
 * Η ΕΠΑΛΗΘΕΥΣΗ ΜΕΝΕΙ ΣΤΗΝ ΠΟΡΤΑ ΚΑΙ ΟΧΙ ΕΠΕΙΔΗ ΤΟ ΖΗΤΗΣΕ ΦΥΛΑΚΑΣ. Ο φύλακας
 * των διαδρομών σαρώνει τα «app/api/ * * /route.*» και απαιτεί να βλέπει εκεί
 * μέσα συνεδρία, υπογραφή ή μυστικό. Μια διαδρομή που κάνει σκέτο re-export δεν
 * του δείχνει τίποτα — και έχει δίκιο να την κόβει: όποιος διαβάζει τη διαδρομή
 * πρέπει να βλέπει ποιος την προστατεύει, χωρίς να ακολουθήσει εισαγωγή.
 *
 * Το ωμό σώμα περνά ως όρισμα γιατί διαβάζεται ΜΙΑ φορά: ένα δεύτερο
 * `request.text()` σε ήδη καταναλωμένο σώμα επιστρέφει κενό.
 */
export async function applyMerchantEvent(raw: string, deps: MerchantEventDeps = {}) {
  const env = deps.env ?? process.env;
  const mor = deps.mor ?? merchant(env);
  const sendAlert = deps.sendAlert ?? ((a: MerchantAlert) => sendMerchantAlert(a, env.RESEND_API_KEY));
  const log = (...parts: unknown[]) => console.info(`[${mor.id}]`, ...parts);
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch {
    log('σώμα που δεν είναι JSON');
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const read = mor.readEvent(payload, env);
  if (!read.ok) {
    // ΔΥΟ ΔΙΑΦΟΡΕΤΙΚΑ ΠΡΑΓΜΑΤΑ, ΔΥΟ ΑΠΑΝΤΗΣΕΙΣ. Γεγονός που δεν μας αφορά —
    // παραγγελία, παραστατικό, γεγονός που δεν ξέρουμε — είναι φυσιολογικό και
    // παίρνει 200. Γεγονός ΣΥΝΔΡΟΜΗΣ που δεν διαβάστηκε είναι πρόβλημα και
    // πρέπει να φανεί στον πίνακα του εμπόρου.
    //
    // Η ΚΡΙΣΗ ΔΕΝ ΓΙΝΕΤΑΙ ΜΕ ΤΟ ΠΡΟΘΕΜΑ. Τα `subscription_payment_*` αρχίζουν
    // κι εκείνα από «subscription_» και φέρνουν παραστατικό, όχι συνδρομή:
    // απαντώντας τους 422 ζητούσαμε από τον έμπορο να τα ξαναστείλει, για
    // πάντα.
    // ΚΑΙ ΤΡΙΤΗ ΠΕΡΙΠΤΩΣΗ: ΔΙΚΗ ΜΑΣ ΡΥΘΜΙΣΗ ΣΠΑΣΜΕΝΗ. Το να ζητάς από τον
    // έμπορο να ξαναστείλει δεν διορθώνει μεταβλητή περιβάλλοντος.
    if (read.config) {
      log('η ρύθμιση του εμπόρου δεν διαβάστηκε:', read.reason);
      return NextResponse.json({ error: 'not_configured' }, { status: 500 });
    }
    // ΕΠΙΣΤΡΟΦΗ ΧΡΗΜΑΤΩΝ Η ΑΜΦΙΣΒΗΤΗΣΗ: κλείνει την πρόσβαση της
    // καταγεγραμμένης συνδρομής ΚΑΙ φτάνει σε άνθρωπο, γιατί η συνδρομή
    // πρέπει να ακυρωθεί και στον έμπορο (`applyRevocation`).
    const revocation = mor.readRevocation(payload);
    if (revocation) return applyRevocation(revocation, payload, deps, sendAlert, log);
    log('γεγονός που δεν εφαρμόστηκε:', read.reason);
    return NextResponse.json({ ok: !read.ours }, { status: read.ours ? 422 : 200 });
  }

  const sub = read.event.sub;
  const variant = read.event.plan;
  if (!variant) {
    // ΠΑΡΑΛΛΑΓΗ ΕΚΤΟΣ ΧΑΡΤΗ ΔΕΝ ΑΝΑΒΑΘΜΙΖΕΙ ΚΑΝΕΝΑΝ και δεν υποβαθμίζει κιόλας:
    // πιθανότερο είναι να λείπει μια εγγραφή από τη ρύθμιση παρά να πούλησε ο
    // έμπορος κάτι ανύπαρκτο. Το γεγονός μένει ακράτητο ώστε να ξαναέρθει.
    log(`παραλλαγή «${sub.variantId}» εκτός χάρτη· το γεγονός ${read.event.name} δεν εφαρμόστηκε`);
    return NextResponse.json({ error: 'unknown_variant' }, { status: 422 });
  }

  let db;
  try { db = (deps.db ?? (() => createServiceClient()))(); } catch (e) {
    log('πελάτης υπηρεσίας:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'not_configured' }, { status: 500 });
  }

  // ── ΠΟΙΟΝ ΑΦΟΡΑ ─────────────────────────────────────────────────────────
  // Πρώτα το `custom_data.user_id` που ταξίδεψε από το ταμείο. Οταν λείπει —
  // γεγονός που γεννήθηκε από τον πίνακα του εμπόρου, όχι από checkout — ο
  // λογαριασμός βρίσκεται από τη ΣΥΝΔΡΟΜΗ που έχει ήδη καταγραφεί. Το
  // ηλεκτρονικό ταχυδρομείο ΔΕΝ χρησιμοποιείται: ο πελάτης μπορεί να πλήρωσε με
  // άλλο από αυτό που έχει στην εφαρμογή και μια τέτοια αντιστοίχιση θα
  // ενεργοποιούσε ξένη συνδρομή σε λάθος λογαριασμό.
  let userId = sub.userId;
  if (!userId) {
    const { data, error } = await db.from(TABLE)
      .select('user_id').eq('mor_subscription_id', sub.id).maybeSingle();
    if (error) {
      log('η αναζήτηση προφίλ απέτυχε:', error.message);
      return NextResponse.json({ error: 'lookup_failed' }, { status: 502 });
    }
    userId = (data as { user_id?: string } | null)?.user_id ?? null;
  }
  if (!userId) {
    log(`το γεγονός ${read.event.name} για τη συνδρομή ${sub.id} δεν αντιστοιχεί σε λογαριασμό`);
    // Κάποιος πλήρωσε χωρίς να περάσει από την εφαρμογή: το μαθαίνει άνθρωπος
    // (merchantAlert.ts, orphanAlert). Μένει 422, ώστε το γεγονός να μη χαθεί.
    await safeSend(sendAlert, orphanAlert(read.event.name, sub.id, variant.plan, variant.cycle));
    return NextResponse.json({ error: 'no_account' }, { status: 422 });
  }

  // ── ΤΑ ΚΑΘΥΣΤΕΡΗΜΕΝΑ ΔΕΝ ΓΡΑΦΟΥΝ ΠΑΝΩ ΑΠΟ ΤΑ ΝΕΟΤΕΡΑ ────────────────────
  const eventAt = read.event.occurredAt;
  if (eventAt) {
    // ΚΑΙ ΑΥΤΗ Η ΑΝΑΓΝΩΣΗ ΚΟΙΤΑ ΤΟ ΣΦΑΛΜΑ ΤΗΣ. Αν αποτύχει, το `data` έρχεται
    // κενό — δηλαδή «καμία προηγούμενη ώρα», δηλαδή «εφάρμοσε το γεγονός».
    // Η κατεύθυνση είναι η ασφαλής, αλλά η αποτυχία δεν επιτρέπεται να είναι
    // αόρατη: αν το φίλτρο σειράς σταματήσει να δουλεύει, θέλουμε να το ξέρουμε
    // πριν γράψει ένα καθυστερημένο «ακυρώθηκε» πάνω από ένα «ανανεώθηκε».
    const { data, error: readError } = await db.from(TABLE)
      .select('mor_event_at').eq('user_id', userId).maybeSingle();
    if (readError) log('η ώρα του τελευταίου γεγονότος δεν διαβάστηκε:', readError.message);
    const seen = (data as { mor_event_at?: string | null } | null)?.mor_event_at;
    if (isStaleEvent(eventAt, seen)) {
      log(`γεγονός ${read.event.name} παλαιότερο από το καταγεγραμμένο· αγνοήθηκε`);
      return NextResponse.json({ ok: true, skipped: 'stale' });
    }
  }

  const nowIso = deps.now ? deps.now() : new Date().toISOString();
  const { data: stored, error: storedError } = await db.from(TABLE)
    .select('mor_subscription_id, subscription_status, mor_ends_at, mor_past_due_at, mor_revoked_at, mor_last_transaction_id, mor_event_at, mor_revoked_tx')
    .eq('user_id', userId).maybeSingle();
  if (storedError) log('η καταγεγραμμένη συνδρομή δεν διαβάστηκε:', storedError.message);
  const current = stored as {
    mor_subscription_id?: string | null; subscription_status?: string | null; mor_ends_at?: string | null;
    mor_past_due_at?: string | null; mor_revoked_at?: string | null; mor_last_transaction_id?: string | null;
    mor_event_at?: string | null; mor_revoked_tx?: string | null;
  } | null;
  const sameSubscription = current?.mor_subscription_id === sub.id;
  /** Συνέβη το γεγονός ΑΥΣΤΗΡΑ μετά από αυτή τη στιγμή; Χωρίς μία από τις δύο ώρες: όχι. */
  const happenedAfter = (t: string | null | undefined): boolean =>
    !!eventAt && !!t && Date.parse(eventAt) > Date.parse(t);

  // ── ΑΛΛΗ ΣΥΝΔΡΟΜΗ ΔΕΝ ΣΗΚΩΝΕΙ ΑΝΑΚΛΗΣΗ (έλεγχος του PR 558, εύρημα 5) ─────
  // Ο λογαριασμός κρατά συνδρομή που έκλεισε από επιστροφή ή αμφισβήτηση. Ενα
  // καθυστερημένο γεγονός ΑΛΛΗΣ, παλαιότερης συνδρομής θα έγραφε
  // `mor_revoked_at = null` και θα γύριζε την καταγραφή στην παλιά.
  //
  // ΝΕΟΤΕΡΗ ΣΗΜΑΙΝΕΙ «ΓΕΝΝΗΘΗΚΕ ΜΕΤΑ ΤΗΝ ΑΝΑΚΛΗΣΗ», από το `created_at` της
  // συνδρομής. Η ώρα του ΓΕΓΟΝΟΤΟΣ δεν αρκεί: μια παλιά συνδρομή που ζει ακόμη
  // στέλνει κι αυτή φρέσκα γεγονότα. Οσο η ανάκληση ισχύει το ταμείο μας είναι
  // κλειστό (flow.ts, 409), οπότε συνδρομή που γεννήθηκε μετά ήρθε από αλλού:
  // γράφεται, γιατί ο πελάτης πληρώνει· φεύγει και email για διπλή χρέωση.
  //
  // Οτιδήποτε άλλο ΔΕΝ γράφεται: η ανάκληση μένει, η καταγραφή μένει στη
  // συνδρομή της. Αν όμως το γεγονός λέει ότι η άλλη συνδρομή ζει, ο έμπορος
  // ίσως χρεώνει τον ίδιο άνθρωπο: το μαθαίνει άνθρωπος. Ετσι η εφαρμογή ούτε
  // κρύβει μια ζωντανή συνδρομή ούτε ανοίγει ταμείο για δεύτερη.
  let duplicate: MerchantAlert | null = null;
  if (!sameSubscription && current?.mor_subscription_id && current.mor_revoked_at) {
    const bornAfter = !!sub.createdAt && Date.parse(sub.createdAt) > Date.parse(current.mor_revoked_at);
    if (!bornAfter) {
      const live = isEntitled({ ...sub, pastDueSince: pastDueStamp(sub.status, null, false, eventAt, nowIso) }, nowIso);
      const alerted = live
        ? await safeSend(sendAlert, otherSubscriptionAlert(userId, current.mor_subscription_id, sub.id))
        : false;
      log(`γεγονός ${read.event.name} για τη συνδρομή ${sub.id}, ενώ η ${current.mor_subscription_id} έκλεισε από επιστροφή· αγνοήθηκε${live ? `, ειδοποίηση ${alerted ? 'στάλθηκε' : 'ΔΕΝ στάλθηκε'}` : ''}`);
      return NextResponse.json({ ok: true, skipped: 'other_subscription', ...(live ? { alerted } : {}) });
    }
    duplicate = duplicateAlert(userId, current.mor_subscription_id, sub.id);
  }

  // ── ΣΥΝΔΡΟΜΗ ΠΟΥ ΕΚΛΕΙΣΕ ΑΠΟ ΕΠΙΣΤΡΟΦΗ Ή ΑΜΦΙΣΒΗΤΗΣΗ ΜΕΝΕΙ ΚΛΕΙΣΤΗ ──────
  // Η επιστροφή δεν ακυρώνει τη συνδρομή στον έμπορο, οπότε εκείνος μπορεί
  // να στείλει και μετά «active» ή ενημερώσεις, με νεότερη ώρα. Καμία από
  // αυτές δεν ξανανοίγει το πακέτο. Μόνο ΝΕΑ ΧΡΕΩΣΗ που πέρασε ΜΕΤΑ την
  // επιστροφή: ο πελάτης πλήρωσε, άρα δικαιούται· ο άνθρωπος μαθαίνει ότι
  // η ακύρωση στον έμπορο δεν έγινε.
  //
  // ΝΕΑ ΧΡΕΩΣΗ ΣΗΜΑΙΝΕΙ: γεγονός πληρωμής, με συναλλαγή ΑΛΛΗ από την
  // επιστραμμένη (`mor_last_transaction_id`, που η ανάκληση απαιτεί να είναι
  // αυτή που επιστράφηκε) ΚΑΙ με ώρα που αποδεικνύει ότι η χρέωση έγινε ΜΕΤΑ
  // από την επιστραμμένη. Χωρίς νέα συναλλαγή η σκανδάλη `keep_mor_revocation`
  // θα κρατούσε έτσι κι αλλιώς την ανάκληση.
  //
  // Η ΩΡΑ ΑΠΟΔΕΙΚΝΥΕΙ ΜΕ ΔΥΟ ΤΡΟΠΟΥΣ (έλεγχος του PR 558, εύρημα 3):
  //   · μετά την ανάκληση: χρέωση που πέρασε αφού κλείσαμε·
  //   · μετά το τελευταίο γεγονός συνδρομής (`mor_event_at`). Αυτό το γεγονός,
  //     ή παλαιότερο, ανέφερε την επιστραμμένη ως τελευταία πληρωμένη· άρα
  //     γεγονός πληρωμής νεότερο από αυτό με άλλη συναλλαγή είναι ΝΕΟΤΕΡΗ
  //     χρέωση. Είναι η περίπτωση «πληρώθηκε ο Τ2, η ειδοποίηση άργησε, η
  //     επιστροφή του Τ1 έκλεισε στο μεταξύ». Με τη σωστή σειρά άφιξης η
  //     επιστροφή του Τ1 θα ήταν `not_latest` και η πρόσβαση δεν θα έκλεινε
  //     ποτέ, οπότε ξανανοίγει, με email ότι η επιστροφή αφορούσε παλαιότερη.
  // ΑΣΦΑΛΗΣ ΕΠΙΛΟΓΗ: χωρίς απόδειξη ώρας (λείπει η ώρα του γεγονότος ή του
  // καταγεγραμμένου) η πρόσβαση ΔΕΝ ανοίγει, αλλά η πληρωμή με νέα συναλλαγή
  // δεν χάνεται σιωπηλά: φεύγει email στην υποστήριξη.
  const revokedAt = sameSubscription ? (current?.mor_revoked_at ?? null) : null;
  const newTransaction = !!sub.lastTransactionId && sub.lastTransactionId !== (current?.mor_last_transaction_id ?? null);
  const afterRevocation = happenedAfter(revokedAt);
  const recharged = !!revokedAt && read.event.paid && newTransaction
    && (afterRevocation || happenedAfter(current?.mor_event_at));
  const lateCharge = recharged && !afterRevocation;
  if (revokedAt && !recharged) {
    if (read.event.paid && newTransaction) {
      const alerted = await safeSend(sendAlert, unprovenPaymentAlert(userId, sub.id, sub.lastTransactionId as string));
      log(`πληρωμή ${sub.lastTransactionId} για τη συνδρομή ${sub.id}, που έκλεισε στις ${revokedAt}, χωρίς απόδειξη σειράς· η πρόσβαση μένει κλειστή, ειδοποίηση ${alerted ? 'στάλθηκε' : 'ΔΕΝ στάλθηκε'}`);
      return NextResponse.json({ ok: true, skipped: 'revoked', alerted });
    }
    log(`γεγονός ${read.event.name} για τη συνδρομή ${sub.id}, που έκλεισε στις ${revokedAt}· αγνοήθηκε`);
    return NextResponse.json({ ok: true, skipped: 'revoked' });
  }

  // ── Η ΧΑΡΗ ΤΗΣ ΑΠΟΤΥΧΗΜΕΝΗΣ ΠΛΗΡΩΜΗΣ ΜΕΤΡΑ ΑΠΟ ΤΗΝ ΠΡΩΤΗ ΑΠΟΤΥΧΙΑ ──────
  const pastDueSince = pastDueStamp(sub.status, current?.mor_past_due_at, sameSubscription, eventAt, nowIso);

  // ΤΟ ΠΑΚΕΤΟ ΒΓΑΙΝΕΙ ΑΠΟ ΤΗΝ ΚΑΤΑΣΤΑΣΗ, ΟΧΙ ΑΠΟ ΤΟ ΟΝΟΜΑ ΤΟΥ ΓΕΓΟΝΟΤΟΣ. Οσο
  // η συνδρομή ισχύει, δίνει ό,τι αγοράστηκε· μόλις πάψει, ο λογαριασμός πέφτει
  // στο «χωρίς συνδρομή» και όχι σε κάτι ενδιάμεσο που δεν πλήρωσε κανείς.
  const entitled = isEntitled({ ...sub, pastDueSince }, nowIso);

  // ── Η ΣΥΝΑΛΛΑΓΗ ΠΟΥ ΕΠΙΣΤΡΑΦΗΚΕ ΔΕΝ ΞΑΝΑΝΟΙΓΕΙ ΤΙΠΟΤΑ (έλεγχος του PR 558, γύρος 3) ──
  // Η σκανδάλη `keep_mor_revocation` και το `revokedAt` παραπάνω κρατούν την
  // ανάκληση μόνο όσο υπάρχει `mor_revoked_at`. Το σβήνουν όμως, χωρίς νέα
  // πληρωμή, δύο δρόμοι: νεότερη συνδρομή που έγινε δεκτή από το `created_at`
  // της και το SQL της υποστήριξης (docs/ops/creem-vercel-odigos.md, Ζ4.4).
  // Από εκεί και πέρα ένα «active» της συνδρομής που επιστράφηκε, με την ΙΔΙΑ
  // επιστραμμένη συναλλαγή, θα ξανάνοιγε το πακέτο.
  //
  // Το `mor_revoked_tx` (μετανάστευση 20261113120000) δεν σβήνει ποτέ. Γεγονός
  // που θα έδινε πρόσβαση με αυτήν ως τελευταία πληρωμένη ΔΕΝ γράφεται: η γραμμή
  // μένει όπως είναι (χωρίς πακέτο, ή στη συνδρομή που κρατά) και η συνδρομή,
  // που ζει ακόμη στον έμπορο, φτάνει σε άνθρωπο. Η συναλλαγή ανήκει σε μία
  // μόνο συνδρομή, οπότε η ίδια συναλλαγή σημαίνει και την ίδια συνδρομή. Μόνο
  // ΝΕΑ συναλλαγή ανοίγει ξανά, με τους κανόνες σειράς που ισχύουν ήδη.
  const revokedTx = current?.mor_revoked_tx ?? null;
  if (entitled && revokedTx && sub.lastTransactionId === revokedTx) {
    const alerted = await safeSend(sendAlert, refundedTransactionAlert(userId, sub.id, revokedTx));
    log(`γεγονός ${read.event.name} για τη συνδρομή ${sub.id} με τη συναλλαγή ${revokedTx}, που επιστράφηκε· η πρόσβαση δεν άνοιξε, ειδοποίηση ${alerted ? 'στάλθηκε' : 'ΔΕΝ στάλθηκε'}`);
    return NextResponse.json({ ok: true, skipped: 'revoked_transaction', alerted });
  }

  // ── ΚΑΙ ΧΩΡΙΣ ΣΥΝΑΛΛΑΓΗ, ΑΠΟ ΤΗΝ ΙΔΙΑ ΣΥΝΔΡΟΜΗ (έλεγχος του PR 560, L1) ────
  // Ο έλεγχος παραπάνω πιάνει μόνο γεγονός που ΛΕΕΙ την επιστραμμένη. Γεγονός
  // χωρίς `last_transaction_id` (ή `last_transaction`, creem.ts) δεν λέει
  // τίποτα και θα περνούσε. Μετά το Ζ4.4 θα ξανάνοιγε το πακέτο.
  //
  // ΚΛΕΙΝΕΙ ΜΟΝΟ ΟΤΑΝ ΚΑΙ ΤΑ ΤΡΙΑ ΙΣΧΥΟΥΝ:
  //   · η συνδρομή είναι η καταγεγραμμένη·
  //   · η τελευταία πληρωμένη της γραμμής είναι ΑΚΟΜΗ η επιστραμμένη, δηλαδή
  //     καμία πληρωμή δεν πέρασε από την ανάκληση και μετά·
  //   · το γεγονός θα έδινε πρόσβαση.
  // Η γραμμή μένει όπως είναι και φεύγει email.
  //
  // ΓΙΑΤΙ ΔΕΝ ΚΛΕΙΔΩΝΕΙ ΕΞΩ ΠΕΛΑΤΗ ΠΟΥ ΠΛΗΡΩΝΕΙ. Κάθε νέα πληρωμή κουβαλά
  // συναλλαγή (`subscription.paid`), περνά από εδώ και γράφει νέο
  // `mor_last_transaction_id`· από εκεί και πέρα ο όρος δεν ισχύει πια και τα
  // γεγονότα χωρίς συναλλαγή γράφονται όπως πάντα. Νέα συνδρομή που γράφεται
  // χωρίς συναλλαγή σβήνει το `mor_last_transaction_id` (πιο κάτω, στο
  // `upsert`), οπότε ούτε αυτή πέφτει εδώ. Η νόμιμη επαναφορά (Ζ7 του οδηγού)
  // σβήνει και το `mor_revoked_tx`.
  //
  // ΤΟ ΟΡΙΟ ΠΟΥ ΜΕΝΕΙ. Μετά από νεότερη συνδρομή που έγινε δεκτή, η γραμμή
  // κρατά εκείνη και δεν ξέρει σε ποια συνδρομή ανήκε το `mor_revoked_tx`.
  // Γεγονός χωρίς συναλλαγή από την ΠΑΛΙΑ συνδρομή δεν ξεχωρίζει από γεγονός
  // μιας τρίτης, οπότε περνά από τον έλεγχο ξένης συνδρομής πιο κάτω: αν η
  // καταγεγραμμένη ζει, φεύγει email για διπλή συνδρομή· αν όχι, γράφεται.
  // Γι' αυτό η υποστήριξη ακυρώνει στον έμπορο κάθε συνδρομή που επιστράφηκε
  // (docs/ops/creem-vercel-odigos.md, Ζ4.4).
  if (entitled && revokedTx && !sub.lastTransactionId && sameSubscription
      && (current?.mor_last_transaction_id ?? null) === revokedTx) {
    const alerted = await safeSend(sendAlert, revokedNoTransactionAlert(userId, sub.id, revokedTx));
    log(`γεγονός ${read.event.name} για τη συνδρομή ${sub.id} χωρίς συναλλαγή, με τελευταία πληρωμένη την ${revokedTx} που επιστράφηκε· η πρόσβαση δεν άνοιξε, ειδοποίηση ${alerted ? 'στάλθηκε' : 'ΔΕΝ στάλθηκε'}`);
    return NextResponse.json({ ok: true, skipped: 'revoked_no_transaction', alerted });
  }

  // ── ΞΕΝΗ ΣΥΝΔΡΟΜΗ ΔΕΝ ΓΡΑΦΕΙ ΠΑΝΩ ΣΕ ΖΩΝΤΑΝΗ ──────────────────────────
  // Ο λογαριασμός κρατά ΜΙΑ συνδρομή. Ενα γεγονός για ΑΛΛΗ συνδρομή, π.χ. η
  // επιστροφή χρημάτων μιας παλιάς, θα έγραφε `plan = 'free'` και θα έστρεφε
  // την πύλη στην παλιά, ενώ η καινούργια συνεχίζει να χρεώνει χωρίς να
  // φαίνεται πουθενά (έλεγχος 27.09.2026, D3). Γεγονός που ΔΕΝ δίνει πρόσβαση,
  // για συνδρομή διαφορετική από την καταγεγραμμένη που ισχύει, αγνοείται.
  // Γεγονός που δίνει πρόσβαση περνά (νέα αγορά μετά από ακύρωση), αλλά αν η
  // παλιά ισχύει ακόμη, γράφεται στο αρχείο ΚΑΙ φτάνει σε άνθρωπο: δύο
  // ζωντανές συνδρομές σημαίνουν διπλή χρέωση και κανείς δεν διαβάζει τα
  // αρχεία καταγραφής χωρίς λόγο.
  if (current?.mor_subscription_id && !sameSubscription
      && isMorStatus(current.subscription_status || '')
      && isEntitled({
        status: current.subscription_status as MorStatus, endsAt: current.mor_ends_at ?? null,
        pastDueSince: current.mor_past_due_at ?? null,
      }, nowIso)) {
    if (!entitled) {
      log(`γεγονός ${read.event.name} για τη συνδρομή ${sub.id}, ενώ ισχύει η ${current.mor_subscription_id}· αγνοήθηκε`);
      return NextResponse.json({ ok: true, skipped: 'other_subscription' });
    }
    log(`ΔΥΟ ΖΩΝΤΑΝΕΣ ΣΥΝΔΡΟΜΕΣ για τον λογαριασμό ${userId}: ${current.mor_subscription_id} και ${sub.id}. Έλεγξε για διπλή χρέωση.`);
    duplicate = duplicateAlert(userId, current.mor_subscription_id, sub.id);
  }

  // ── Η ΔΟΚΙΜΗ ΣΦΡΑΓΙΖΕΤΑΙ ΟΤΑΝ ΟΝΤΩΣ ΔΟΘΗΚΕ ────────────────────────────
  // ΟΧΙ ΟΤΑΝ ΑΝΟΙΞΕ ΤΟ ΤΑΜΕΙΟ: ένα ταμείο που άνοιξε και εγκαταλείφθηκε δεν
  // πρέπει να καίει τη δοκιμή κανενός. Εδώ ξέρουμε ότι δόθηκε, γιατί ο ίδιος ο
  // έμπορος λέει `on_trial`.
  //
  // ΚΑΙ ΓΡΑΦΕΤΑΙ ΜΙΑ ΦΟΡΑ. Χωρίς το `??`, κάθε επόμενο γεγονός θα μετακινούσε
  // την ημερομηνία προς τα εμπρός — και το `skip_trial` θα κρινόταν από τη
  // στιγμή της τελευταίας ανανέωσης αντί της πρώτης δοκιμής.
  const seen = (await db.from(TABLE).select('trial_used_at, profile_type').eq('user_id', userId).maybeSingle())
    .data as { trial_used_at?: string | null; profile_type?: string | null } | null;
  const trialUsedAt = trialStamp(seen?.trial_used_at, sub.status, eventAt);

  // ── Ο ΤΥΠΟΣ ΠΡΟΦΙΛ ΓΡΑΦΕΤΑΙ ΟΤΑΝ ΤΟΝ ΑΠΟΔΕΙΚΝΥΕΙ Η ΑΓΟΡΑ ────────────────
  // Ο τύπος ζητιέται στο καλωσόρισμα, δηλαδή ΜΕΤΑ την εγγραφή· όποιος πέρασε
  // από τον τιμοκατάλογο κατευθείαν στο ταμείο έφτασε ως εδώ χωρίς αυτόν. Και
  // χωρίς τύπο ο λογαριασμός λογίζεται «ιδιώτης», οπότε ο πελάτης που μόλις
  // πλήρωσε «Επαγγελματία» θα έβλεπε κλειδωμένες ακριβώς τις καρτέλες που
  // αγόρασε.
  //
  // ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΟ ΤΑΜΕΙΟ: εκεί ξέρουμε μόνο τι ΑΝΟΙΞΕ κάποιος. Ενα
  // ταμείο που εγκαταλείφθηκε θα χαρακτήριζε «επαγγελματία» όποιον απλώς
  // κοίταξε την ακριβή κάρτα και η οθόνη χρέωσης θα του πρότεινε στο εξής
  // μόνο πακέτα του Επαγγελματία. Εδώ ξέρουμε τι ΑΓΟΡΑΣΕ.
  //
  // ΚΑΙ ΟΤΑΝ Η ΑΓΟΡΑ ΑΝΤΙΛΕΓΕΙ ΣΤΗ ΔΗΛΩΣΗ, ΚΕΡΔΙΖΕΙ Η ΑΓΟΡΑ: είναι νεότερη.
  const profileType = profileTypeToWrite(seen?.profile_type, variant.plan, entitled);

  const { error } = await db.from(TABLE).upsert({
    user_id: userId,
    plan: entitled ? variant.plan : 'free',
    billing_cycle: variant.cycle === 'annual' ? 'annual' : 'monthly',
    subscription_status: sub.status,
    mor_customer_id: sub.customerId || null,
    mor_subscription_id: sub.id,
    mor_variant_id: sub.variantId,
    mor_renews_at: sub.renewsAt,
    mor_ends_at: sub.endsAt,
    mor_event_at: eventAt,
    mor_past_due_at: pastDueSince,
    // Εδώ φτάνει μόνο συνδρομή που ΔΕΝ έχει κλείσει από επιστροφή (το έλεγξε το
    // `revokedAt` παραπάνω), νέα συνδρομή, ή νέα χρέωση μετά την επιστροφή.
    // Σε όλες η παλιά καταγραφή δεν ισχύει πια.
    mor_revoked_at: null,
    mor_revoked_reason: null,
    // Η αναφορά της επιστροφής (`mor_revoked_ref`) ΔΕΝ σβήνει: η ίδια επιστροφή
    // που ξαναστέλνεται μετά από νέα χρέωση δεν ξανακόβει.
    // Η ΤΕΛΕΥΤΑΙΑ ΠΛΗΡΩΜΕΝΗ ΑΝΗΚΕΙ ΣΤΗ ΣΥΝΔΡΟΜΗ ΤΗΣ (έλεγχος του PR 563, M1).
    // Γεγονός χωρίς συναλλαγή κρατά την τιμή μόνο για την ΙΔΙΑ συνδρομή. Σε
    // αλλαγή συνδρομής (και στον δρόμο `bornAfter`) σβήνει: αλλιώς η
    // επιστραμμένη της παλιάς θα έμενε ως «τελευταία πληρωμένη» της νέας και
    // ο έλεγχος L1 πιο πάνω θα έριχνε τα επόμενα γεγονότα της νέας.
    ...(sub.lastTransactionId
      ? { mor_last_transaction_id: sub.lastTransactionId }
      : sameSubscription ? {} : { mor_last_transaction_id: null }),
    ...(trialUsedAt ? { trial_used_at: trialUsedAt } : {}),
    ...(profileType ? { profile_type: profileType } : {}),
    // ΖΩΝΗ ΚΑΙ ΤΙΡΑΝΤΕΣ: η σκανδάλη `ensure_billing_profile` γεννά τη γραμμή
    // μαζί με τον λογαριασμό, οπότε το `upsert` δεν θα χρειαστεί να εισαγάγει
    // ποτέ. Αν όμως χρειαστεί —παλιός λογαριασμός, χειροκίνητη διαγραφή— το
    // `update` θα ταίριαζε ΜΗΔΕΝ γραμμές και το PostgREST δεν το λέει σφάλμα:
    // πληρωμένος πελάτης χωρίς πακέτο, με 200 στον πίνακα του εμπόρου.
  }, { onConflict: 'user_id' });

  if (error) {
    // 502 ΚΑΙ ΟΧΙ 200: ο έμπορος ξαναδοκιμάζει τα αποτυχημένα. Ενα
    // βολικό 200 εδώ σημαίνει πληρωμένη συνδρομή που δεν ενεργοποιήθηκε ποτέ,
    // και κανένα ίχνος πουθενά.
    log('η εγγραφή του προφίλ απέτυχε:', error.message);
    return NextResponse.json({ error: 'write_failed' }, { status: 502 });
  }

  // ── Η ΕΙΔΟΠΟΙΗΣΗ ΔΙΠΛΗΣ ΣΥΝΔΡΟΜΗΣ ΦΕΥΓΕΙ ΜΕΤΑ ΤΗΝ ΕΓΓΡΑΦΗ ───────────────
  // ΟΧΙ ΠΡΙΝ: μια εγγραφή που αποτυγχάνει γυρίζει 502 και ο έμπορος ξαναστέλνει
  // το γεγονός, οπότε κάθε προσπάθεια θα έστελνε και δικό της μήνυμα. Μετά την
  // εγγραφή η καταγεγραμμένη συνδρομή είναι η νέα, άρα η επανάληψη δεν
  // ξαναβρίσκει δύο ζωντανές: ένα μήνυμα ανά περιστατικό.
  //
  // ΚΑΙ ΔΕΝ ΡΙΧΝΕΙ ΤΙΠΟΤΑ. Το πακέτο έχει ήδη γραφτεί· μια αποτυχία αποστολής
  // που γύριζε σφάλμα θα έκανε τον έμπορο να ξαναστείλει ολόκληρο το γεγονός.
  if (duplicate) {
    const sent = await safeSend(sendAlert, duplicate);
    log(`ειδοποίηση διπλής συνδρομής ${sent ? 'στάλθηκε' : 'ΔΕΝ στάλθηκε'}`);
  }
  // ΙΔΙΟΣ ΚΑΝΟΝΑΣ: ΜΕΤΑ ΤΗΝ ΕΓΓΡΑΦΗ. Η επανάληψη βρίσκει πια καθαρή καταγραφή
  // και δεν ξαναστέλνει.
  if (recharged) {
    const sent = await safeSend(sendAlert, rechargedAlert(userId, sub.id, lateCharge));
    log(`νέα χρέωση μετά από επιστροφή· ειδοποίηση ${sent ? 'στάλθηκε' : 'ΔΕΝ στάλθηκε'}`);
  }

  // ── ΤΑ ΔΥΟ ΤΕΛΕΥΤΑΙΑ ΣΚΑΛΙΑ ΤΟΥ ΧΩΝΙΟΥ, ΑΠΟ ΤΗ ΜΟΝΗ ΠΗΓΗ ΠΟΥ ΤΑ ΞΕΡΕΙ ──
  // Ο περιηγητής ξέρει μόνο ότι κάποιος ΑΝΟΙΞΕ το ταμείο. Αν το γεγονός
  // γραφόταν εκεί, το χωνί θα έλεγε ότι πλήρωσαν άνθρωποι που εγκατέλειψαν
  // στη σελίδα της κάρτας. Εδώ το λέει ο ίδιος ο έμπορος.
  //
  // ΤΑ ΔΥΟ ΞΕΧΩΡΙΖΟΥΝ ΑΠΟ ΤΗΝ ΚΑΤΑΣΤΑΣΗ ΠΟΥ ΣΤΕΛΝΕΙ: `on_trial` σημαίνει ότι
  // η δοκιμή ΔΟΘΗΚΕ, οτιδήποτε άλλο με πρόσβαση σημαίνει ότι πληρώνεται.
  // Χρησιμοποιείται η `log_event_for`, που δέχεται χρήστη και εκτελείται μόνο
  // από service role: ο πίνακας κρατά τη ΜΙΑ πόρτα του και ο φύλακας των
  // πινάκων μόνο-υπηρεσίας μένει χωρίς εξαίρεση.
  //
  // ΠΟΤΕ ΔΕΝ ΜΠΛΟΚΑΡΕΙ ΤΗΝ ΠΛΗΡΩΜΗ. Μια αποτυχία μέτρησης δεν επιτρέπεται να
  // γυρίσει σφάλμα στον έμπορο και να ξαναδοκιμαστεί ολόκληρο το γεγονός.
  if (entitled) {
    const measured = sub.status === 'on_trial' ? 'trial_started' : 'subscription_started';
    const { error: mErr } = await db.rpc('log_event_for', {
      p_user: userId,
      p_event: measured,
      p_props: { plan: variant.plan, cycle: variant.cycle },
    });
    if (mErr) log('η μέτρηση δεν γράφτηκε:', mErr.message);
  }

  log(`${read.event.name}: ${variant.plan}/${variant.cycle}, κατάσταση ${sub.status}, πρόσβαση ${entitled ? 'ναι' : 'όχι'}${pastDueSince ? `, σε καθυστέρηση από ${pastDueSince}` : ''}${trialUsedAt && !seen?.trial_used_at ? ', η δοκιμή σφραγίστηκε' : ''}${profileType ? `, τύπος προφίλ ${profileType}` : ''}`);
  return NextResponse.json({ ok: true });
}
