// Η ΔΙΕΥΘΥΝΣΗ ΠΟΥ ΑΚΟΥΕΙ ΤΟΝ CREEM.
//
// ΓΙΑΤΙ ΚΑΘΕ ΕΜΠΟΡΟΣ ΘΕΛΕΙ ΔΙΚΗ ΤΟΥ ΔΙΕΥΘΥΝΣΗ: η υπογραφή ελέγχεται με το ΔΙΚΟ
// του μυστικό. Δύο πάροχοι στην ίδια διεύθυνση σημαίνει ότι ο ένας δοκιμάζει
// την υπογραφή του άλλου και αποτυγχάνει.
//
// ΤΟ ΣΩΜΑ ΔΙΑΒΑΖΕΤΑΙ ΩΜΟ ΚΑΙ ΜΙΑ ΦΟΡΑ. Η υπογραφή υπολογίζεται πάνω στα ίδια
// ακριβώς bytes που έστειλε ο έμπορος· ένα `request.json()` πρώτα αλλάζει κενά
// και κάθε γνήσιο γεγονός θα απορριπτόταν.
//
// Η ΚΡΙΣΗ ΕΙΝΑΙ ΜΙΑ, ΣΤΟ lib/billing/morWebhook.ts. Εκείνη δεν ήξερε ποτέ
// πάροχο: καλεί `merchant()`. Εδώ μένει η πόρτα, ώστε όποιος διαβάζει τη
// διαδρομή να βλέπει ποιος την προστατεύει.
import { NextResponse } from 'next/server';
import { merchant } from '@/lib/billing/merchant';
import { applyMerchantEvent } from '@/lib/billing/morWebhook';
import { reportRoute } from '@/lib/observability/route';

/** Οι κωδικοί 5xx της κρίσης. Ο,τι άλλο δεν ταξιδεύει, γιατί δεν το ξέρουμε. */
const KNOWN_5XX = new Set(['not_configured', 'lookup_failed', 'write_failed']);

export async function POST(request: Request) {
  const raw = await request.text();
  if (!merchant().verifyWebhook(raw, request.headers, process.env)) {
    // ΔΕΝ ΛΕΕΙ ΑΝ ΕΦΤΑΙΓΕ Η ΥΠΟΓΡΑΦΗ Η ΤΟ ΜΥΣΤΙΚΟ. Η διεύθυνση είναι δημόσια·
    // η διαφορά των δύο μηνυμάτων θα έλεγε σε άγνωστο αν έχουμε ρυθμιστεί.
    console.info(`[${merchant().id}]`, 'υπογραφή που δεν επαληθεύεται');
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  // ΓΕΓΟΝΟΣ ΠΟΥ ΔΕΝ ΓΡΑΦΤΗΚΕ ΕΙΝΑΙ ΠΛΗΡΩΜΗ ΧΩΡΙΣ ΠΑΚΕΤΟ. Ο έμπορος θα
  // ξαναδοκιμάσει, αλλά κάποιος πρέπει να το μάθει πριν από τον πελάτη. Η
  // υπογραφή ελέγχθηκε από πάνω, οπότε κανένας άγνωστος δεν φτάνει ως εδώ.
  const res = await applyMerchantEvent(raw);
  if (res.status >= 500) {
    const body = await res.clone().json().catch(() => null) as { error?: unknown } | null;
    const code = typeof body?.error === 'string' && KNOWN_5XX.has(body.error) ? body.error : null;
    void reportRoute('api/billing/creem', 'webhook not applied', { status: res.status, code });
  }
  return res;
}
