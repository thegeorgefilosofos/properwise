// ═══════════════════════════════════════════════════════════════════════════
// ΕΠΙΣΤΡΟΦΗ ΧΡΗΜΑΤΩΝ Η ΑΜΦΙΣΒΗΤΗΣΗ: ΝΑ ΤΟ ΜΑΘΕΙ ΑΝΘΡΩΠΟΣ, ΑΜΕΣΩΣ
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΚΕΝΟ (έλεγχος 27.09.2026, D7). Ο webhook διαβάζει μόνο γεγονότα
// συνδρομής· το `refund.created` και το `dispute.created` έπαιρναν 200 και
// χάνονταν. Μια επιστροφή χρημάτων δεν ακυρώνει από μόνη της τη συνδρομή στον
// έμπορο, οπότε η επόμενη ανανέωση θα ξαναχρέωνε τον ίδιο άνθρωπο.
//
// ΓΙΑΤΙ ΕΙΔΟΠΟΙΗΣΗ ΚΑΙ ΟΧΙ ΑΥΤΟΜΑΤΗ ΑΚΥΡΩΣΗ. Το σχήμα αυτών των δύο γεγονότων
// δεν έχει δοκιμαστεί ακόμη με αληθινή επιστροφή. Μια αυτόματη ακύρωση πάνω σε
// λάθος πεδίο θα έκοβε λάθος πελάτη. Ως τότε, το γεγονός φτάνει στο
// γραμματοκιβώτιο της υποστήριξης με ό,τι χρειάζεται για να βρεθεί η
// συνδρομή στον πίνακα του εμπόρου· η ακύρωση γίνεται με το χέρι.
//
// ΚΑΝΕΝΑ ΠΡΟΣΩΠΙΚΟ ΣΤΟΙΧΕΙΟ ΣΤΟ ΜΗΝΥΜΑ. Μόνο αναγνωριστικά και ποσό: αρκούν
// για την αναζήτηση και δεν αντιγράφουν δεδομένα πελάτη σε δεύτερο σύστημα.
// ═══════════════════════════════════════════════════════════════════════════
import { IDENTITY } from '@/lib/legal/identity';
import { SEND_URL } from '@/lib/inbound/sendAck';
import { merchant } from '@/lib/billing/merchant';

export interface MerchantAlert {
  subject: string;
  text: string;
}

const idOf = (v: unknown): string => {
  if (typeof v === 'string') return v.trim();
  if (v && typeof v === 'object' && typeof (v as { id?: unknown }).id === 'string') return (v as { id: string }).id.trim();
  return '';
};

/**
 * Το μήνυμα για ένα γεγονός, ή `null` όταν δεν αφορά επιστροφή ή αμφισβήτηση.
 * Καθαρή συνάρτηση: δεν στέλνει τίποτα.
 */
export function alertFor(payload: unknown): MerchantAlert | null {
  const p = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  const name = String(p.eventType || '').trim();
  const kind = name.startsWith('refund.') ? 'refund' : name.startsWith('dispute.') ? 'dispute' : null;
  if (!kind) return null;

  const obj = (p.object && typeof p.object === 'object' ? p.object : {}) as Record<string, unknown>;
  const tx = (obj.transaction && typeof obj.transaction === 'object' ? obj.transaction : {}) as Record<string, unknown>;
  const subscription = idOf(obj.subscription) || idOf(tx.subscription);
  const amount = obj.refund_amount ?? obj.amount ?? tx.amount;
  const currency = String(obj.refund_currency ?? obj.currency ?? tx.currency ?? '').toUpperCase();

  const what = kind === 'refund' ? 'Επιστροφή χρημάτων' : 'Αμφισβήτηση πληρωμής';
  const mor = merchant().name;
  const none = 'άγνωστο';
  return {
    subject: `PROPERWISE | ${what} στο ${mor}: ακύρωσε τη συνδρομή`,
    text: [
      `${what} στον πίνακα του ${mor} (${name}).`,
      '',
      `Συνδρομή: ${subscription || none}`,
      `Γεγονός: ${idOf(obj) || none}`,
      `Ποσό: ${typeof amount === 'number' ? `${(amount / 100).toFixed(2)} ${currency}`.trim() : none}`,
      '',
      `Τι κάνεις: ${mor} · Subscriptions · η συνδρομή · Cancel.`,
      'Χωρίς ακύρωση, η επόμενη ανανέωση χρεώνει ξανά τον ίδιο πελάτη.',
    ].join('\n'),
  };
}

/**
 * ΔΥΟ ΖΩΝΤΑΝΕΣ ΣΥΝΔΡΟΜΕΣ ΣΤΟΝ ΙΔΙΟ ΛΟΓΑΡΙΑΣΜΟ.
 *
 * Ο webhook κρατά ΜΙΑ συνδρομή ανά λογαριασμό και γράφει τη νέα· η παλιά όμως
 * συνεχίζει να χρεώνει στον έμπορο και δεν φαίνεται πουθενά στην εφαρμογή.
 * Ως τώρα το μάθαινε μόνο το αρχείο καταγραφής, που κανείς δεν διαβάζει χωρίς
 * λόγο (έλεγχος 27.09.2026, D3). Η ακύρωση και η επιστροφή γίνονται με το
 * χέρι, όπως και στην επιστροφή χρημάτων.
 *
 * ΜΟΝΟ ΑΝΑΓΝΩΡΙΣΤΙΚΑ. Αρκούν για να βρεθούν οι δύο συνδρομές στον πίνακα του
 * εμπόρου και δεν αντιγράφουν στοιχεία πελάτη σε δεύτερο σύστημα.
 */
export function duplicateAlert(userId: string, oldSubId: string, newSubId: string): MerchantAlert {
  const mor = merchant().name;
  return {
    subject: `PROPERWISE | Δύο ζωντανές συνδρομές στο ${mor}: έλεγξε για διπλή χρέωση`,
    text: [
      `Ο ίδιος λογαριασμός έχει δύο συνδρομές που ισχύουν ταυτόχρονα στον πίνακα του ${mor}.`,
      '',
      `Λογαριασμός: ${userId}`,
      `Παλιά συνδρομή: ${oldSubId}`,
      `Νέα συνδρομή: ${newSubId}`,
      '',
      'Η εφαρμογή κρατά πλέον τη νέα. Η παλιά χρεώνει ώσπου να ακυρωθεί.',
      `Τι κάνεις: ${mor} · Subscriptions · η παλιά συνδρομή · Cancel. Αν χρεώθηκαν και οι δύο για την ίδια περίοδο, επιστροφή της παλιάς.`,
    ].join('\n'),
  };
}

/**
 * ΠΛΗΡΩΜΗ ΧΩΡΙΣ ΛΟΓΑΡΙΑΣΜΟ ΣΤΗΝ ΕΦΑΡΜΟΓΗ.
 *
 * Ο webhook βρίσκει τον λογαριασμό από το `metadata.user_id` που ταξιδεύει από
 * το δικό μας ταμείο. Μια αγορά που έγινε αλλού (ο δημόσιος κατάλογος του
 * εμπόρου, ένας σύνδεσμος πληρωμής που κυκλοφόρησε) δεν το έχει. Ως τώρα έπαιρνε
 * 422 και γραφόταν μόνο στο αρχείο καταγραφής: ο πελάτης είχε πληρώσει και δεν
 * είχε πακέτο (28.09.2026, ο κατάλογος βρέθηκε ανοιχτός με «Buy Now» και στα
 * οκτώ πακέτα).
 *
 * ΜΟΝΟ ΑΝΑΓΝΩΡΙΣΤΙΚΑ, όπως στα υπόλοιπα. Το email του πελάτη το βρίσκει ο
 * άνθρωπος στον πίνακα του εμπόρου από τη συνδρομή.
 */
export function orphanAlert(eventName: string, subId: string, plan: string, cycle: string): MerchantAlert {
  const mor = merchant().name;
  return {
    subject: `PROPERWISE | Πληρωμή στο ${mor} χωρίς λογαριασμό στην εφαρμογή`,
    text: [
      `Ο ${mor} έστειλε γεγονός για συνδρομή που δεν αντιστοιχεί σε λογαριασμό της εφαρμογής (${eventName}).`,
      'Η αγορά δεν έγινε από το ταμείο της εφαρμογής, οπότε ο πελάτης πλήρωσε και δεν έχει πακέτο.',
      '',
      `Συνδρομή: ${subId}`,
      `Πακέτο: ${plan} · ${cycle === 'annual' ? 'ετήσιο' : 'μηνιαίο'}`,
      '',
      `Τι κάνεις: ${mor} · Subscriptions · η συνδρομή · email του πελάτη. Αν έχει λογαριασμό, του γράφεις να αγοράσει από την εφαρμογή. Μετά ακυρώνεις και επιστρέφεις αυτή τη συνδρομή.`,
      'Και έλεγξε ότι ο δημόσιος κατάλογος καταστήματος στον έμπορο είναι κλειστός.',
    ].join('\n'),
  };
}

/**
 * Στέλνει το μήνυμα στο γραμματοκιβώτιο της υποστήριξης. Δεν πετά ποτέ: μια
 * αποτυχία ειδοποίησης δεν επιτρέπεται να γυρίσει σφάλμα στον έμπορο.
 *
 * @param fetcher Δίνεται ως όρισμα ώστε ο έλεγχος να μη χτυπά δίκτυο.
 */
export async function sendMerchantAlert(
  alert: MerchantAlert, apiKey: string | undefined, fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const key = (apiKey || '').trim();
  if (!key) return false;
  try {
    const res = await fetcher(SEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `PROPERWISE Billing <${IDENTITY.supportEmail}>`,
        to: IDENTITY.supportEmail,
        subject: alert.subject,
        text: alert.text,
      }),
      // ΧΡΟΝΙΚΟ ΟΡΙΟ. Ο webhook περιμένει την αποστολή πριν απαντήσει στον
      // έμπορο· κολλημένο αίτημα θα κρατούσε το γεγονός ως το όριο της
      // πλατφόρμας και ο έμπορος θα το ξανάστελνε ως αποτυχημένο.
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
