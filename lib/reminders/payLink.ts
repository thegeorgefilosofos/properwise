// ═══════════════════════════════════════════════════════════════════════════
// «ΠΛΗΡΩΣΑ» ΜΕ ΕΝΑ ΠΑΤΗΜΑ — ΤΟ ΔΙΑΚΡΙΤΙΚΟ ΚΑΙ Ο ΚΑΝΟΝΑΣ ΤΗΣ ΔΑΠΑΝΗΣ
// ─────────────────────────────────────────────────────────────────────────
// Η υπενθύμιση (email ή ειδοποίηση) φέρνει σύνδεσμο που σημειώνει ΜΙΑ
// συγκεκριμένη προθεσμία ως πληρωμένη, χωρίς σύνδεση. Ο σύνδεσμος είναι το
// μόνο κλειδί, οπότε:
//
//   · 32 τυχαία byte από το `crypto.getRandomValues` (256 bit), base64url.
//   · Στη βάση μένει ΜΟΝΟ το SHA-256 του. Μια διαρροή του πίνακα δεν δίνει
//     κανέναν σύνδεσμο που να δουλεύει.
//   · Δεμένο σε έναν χρήστη και ένα γεγονός: η εξαργύρωση ελέγχει ότι το
//     γεγονός ανήκει στον χρήστη του διακριτικού (IDOR).
//   · Μίας χρήσης, με λήξη: το `used_at` γράφεται με ατομικό UPDATE … WHERE
//     used_at IS NULL, άρα δύο ταυτόχρονα πατήματα δεν περνούν και τα δύο.
//   · Το GET δεν αλλάζει τίποτα: η σελίδα ρωτά και το κουμπί κάνει POST. Οι
//     σαρωτές συνδέσμων των παρόχων email ανοίγουν κάθε URL· αν το άνοιγμα
//     πλήρωνε, θα πλήρωναν εκείνοι.
//
// ΚΑΘΑΡΟ ΑΡΧΕΙΟ, ΧΩΡΙΣ ΨΕΥΔΩΝΥΜΑ ΕΙΣΑΓΩΓΗΣ. Το εισάγει και η συνάρτηση
// send-reminders (Deno), που δεν ξέρει το `@/`. Μόνο Web Crypto, ίδιο σε Node
// και Deno.
// ═══════════════════════════════════════════════════════════════════════════

/** Η διαδρομή της σελίδας επιβεβαίωσης: /plirosa/<διακριτικό>. */
export const PAY_PATH = '/plirosa';

/**
 * Πόσες μέρες ισχύει ο σύνδεσμος. Η πρώτη υπενθύμιση φεύγει επτά μέρες πριν
 * και το εκπρόθεσμο θυμίζεται για τριάντα μέρες μετά (DAYS_BACK του push):
 * σαράντα πέντε καλύπτουν όλο το διάστημα με περιθώριο.
 */
export const PAY_TOKEN_DAYS = 45;

/** Πόσες ώρες μετά το «Πλήρωσα» δέχεται αναίρεση ο ίδιος σύνδεσμος. */
export const PAY_UNDO_HOURS = 24;

const b64url = (bytes: Uint8Array): string => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** Μόνο ό,τι μοιάζει με δικό μας διακριτικό: 43 χαρακτήρες base64url. */
export const isPayTokenShape = (t: unknown): t is string => typeof t === 'string' && /^[A-Za-z0-9_-]{43}$/.test(t);

/** Το SHA-256 του διακριτικού, σε δεκαεξαδικό. Αυτό μόνο γράφεται στη βάση. */
export async function hashPayToken(token: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Νέο διακριτικό και το αποτύπωμά του. */
export async function newPayToken(): Promise<{ token: string; hash: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = b64url(bytes);
  return { token, hash: await hashPayToken(token) };
}

/** Η λήξη, `PAY_TOKEN_DAYS` μέρες από τώρα, σε ISO. */
export const payTokenExpiry = (now: Date): string => new Date(now.getTime() + PAY_TOKEN_DAYS * 86_400_000).toISOString();

/** Ο σύνδεσμος της σελίδας επιβεβαίωσης. */
export const payUrl = (appUrl: string, token: string): string => `${appUrl.replace(/\/+$/, '')}${PAY_PATH}/${token}`;

/** Το γεγονός όπως το χρειάζεται ο κανόνας της δαπάνης. */
export interface PaidEvent {
  id: string;
  title: string;
  amount: number | null;
  source: string | null;
  property_id: string | null;
}

/** Η δαπάνη που καταχωρείται μαζί με το «Πλήρωσα», ή `null`. */
export interface PayExpense { category: string; amount: number; description: string; dedupHash: string }

/**
 * Το αποτύπωμα (`expenses.dedup_hash`) της δαπάνης που γράφει το «Πλήρωσα» για
 * ένα γεγονός. Ενα ανά γεγονός: η δεύτερη καταχώρηση είναι αδύνατη. Η
 * αναίρεση (εδώ ή από το Ημερολόγιο της εφαρμογής) βρίσκει αυτήν και μόνο.
 */
export const payDedupHash = (eventId: string): string => `reminder-pay:${eventId}`;

/**
 * ΠΟΙΑ ΠΛΗΡΩΜΗ ΓΙΝΕΤΑΙ ΚΑΙ ΔΑΠΑΝΗ. Μόνο η δόση ΕΝΦΙΑ με γνωστό ποσό: έχει
 * κατηγορία της ταξινομίας (`enfia`, λογαριασμός 64.11, δεν εκπίπτει) και
 * ακριβές ποσό από το εκκαθαριστικό. Η δαπάνη γράφεται ΜΟΝΟ όταν ο χρήστης το
 * επιβεβαιώσει στη σελίδα του «Πλήρωσα»· το κουμπί της ειδοποίησης σημειώνει
 * μόνο την πληρωμή. Τα υπόλοιπα (δηλώσεις, τέλη χωρίς ποσό,
 * δικές σου υπενθυμίσεις) σημειώνονται πληρωμένα χωρίς δαπάνη: ένα ποσό που
 * δεν ξέρουμε δεν γράφεται στα λογιστικά σου.
 *
 * Το `dedupHash` κάνει τη δεύτερη καταχώρηση αδύνατη, όποια διαδρομή κι αν
 * φτάσει πρώτη (email, ειδοποίηση, επανάληψη μετά από σφάλμα δικτύου).
 */
export function expenseForPaidEvent(e: PaidEvent): PayExpense | null {
  const enfia = typeof e.source === 'string' && /^tax:enfia-(first|instalment|last)-\d{4}/.test(e.source);
  if (!enfia || !e.property_id || !(typeof e.amount === 'number' && e.amount > 0)) return null;
  return { category: 'enfia', amount: Math.round(e.amount * 100) / 100, description: e.title, dedupHash: payDedupHash(e.id) };
}

/**
 * ΠΡΙΝ ΤΗ ΜΕΤΑΝΑΣΤΕΥΣΗ. Ο κώδικας φτάνει στην παραγωγή (Vercel, edge
 * functions) ΠΡΙΝ από τον πίνακα `reminder_pay_tokens`: η ροή του αποθετηρίου
 * ανεβάζει πρώτα τις συναρτήσεις και μετά τρέχει το `db push`. Σε εκείνο το
 * παράθυρο (και όσο η μετανάστευση δεν έχει εφαρμοστεί) κάθε γραφή διακριτικού
 * αποτυγχάνει με «δεν υπάρχει ο πίνακας». Αυτό δεν είναι βλάβη· σημαίνει ότι η
 * υπενθύμιση φεύγει ΧΩΡΙΣ «Πλήρωσα», όπως πριν.
 *
 *   42P01       Postgres: undefined_table
 *   PGRST205    PostgREST: ο πίνακας δεν είναι στην κρυφή μνήμη του σχήματος
 */
export const isMissingTable = (e: { code?: string | null; message?: string | null } | null | undefined): boolean =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /reminder_pay_tokens.*(does not exist|schema cache)/i.test(e.message ?? ''));

/** Χωράει ακόμη αναίρεση; */
export const canUndo = (usedAt: string | null, undoneAt: string | null, now: Date): boolean =>
  !!usedAt && !undoneAt && now.getTime() - new Date(usedAt).getTime() <= PAY_UNDO_HOURS * 3_600_000;
