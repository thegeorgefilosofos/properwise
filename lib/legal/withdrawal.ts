// ═══════════════════════════════════════════════════════════════════════════
// Η ΛΕΙΤΟΥΡΓΙΑ ΥΠΑΝΑΧΩΡΗΣΗΣ («ΚΟΥΜΠΙ ΥΠΑΝΑΧΩΡΗΣΗΣ»)
// ─────────────────────────────────────────────────────────────────────────
// ΤΟ ΚΕΝΟ (νομική αξιολόγηση 20/10/2026, εύρημα 4). Η υπαναχώρηση γινόταν
// μόνο με email στο support@ ή στον έμπορο (Οροι, «Δικαίωμα υπαναχώρησης»).
//
// Η ΥΠΟΧΡΕΩΣΗ, ΜΕ ΠΗΓΕΣ:
//   · Οδηγία (ΕΕ) 2023/2673, άρθ. 1, που προσθέτει το άρθ. 11α στην Οδηγία
//     2011/83/ΕΕ· εφαρμογή από 19/06/2026.
//     https://eur-lex.europa.eu/eli/dir/2023/2673/oj
//     Το επίσημο κείμενο δεν ανοίχτηκε από αυτό το περιβάλλον (δεν
//     επαληθεύτηκε κατά λέξη). Το περιεχόμενο που ακολουθεί είναι όπως το
//     περιγράφουν ταυτόσημα οι αναλύσεις:
//     https://www.williamfry.com/knowledge/world-consumer-rights-day-part-3-mandatory-withdrawal-button-coming-june-2026/
//     https://vbb.com/wp-content/uploads/2026/06/8-06-26-The-online-withdrawal-button.pdf
//       (1) λειτουργία με την ένδειξη «υπαναχώρηση από τη σύμβαση εδώ» ή
//           ισοδύναμη σαφή διατύπωση, εμφανής και διαθέσιμη σε όλη την
//           προθεσμία υπαναχώρησης·
//       (2) ο καταναλωτής δίνει ή επιβεβαιώνει όνομα, στοιχεία που
//           ταυτοποιούν τη σύμβαση και το ηλεκτρονικό μέσο για την
//           επιβεβαίωση·
//       (3) λειτουργία επιβεβαίωσης («επιβεβαίωση υπαναχώρησης» ή ισοδύναμη)·
//       (4) αποδεικτικό παραλαβής σε σταθερό μέσο, χωρίς αδικαιολόγητη
//           καθυστέρηση, με το περιεχόμενο της δήλωσης και την ημερομηνία και
//           ώρα υποβολής·
//       (5) εμπρόθεσμη είναι η δήλωση που υποβλήθηκε πριν λήξει η προθεσμία.
//   · Ελλάδα: άρθ. 3ζα ν. 2251/1994, που προστέθηκε τον Ιούλιο 2026. Ο
//     τροποποιητικός νόμος, το φύλλο της Εφημερίδας και οι σύνδεσμοι ζουν στο
//     docs/legal/ypanaxorisi.md: ο αριθμός του δεν είναι ακόμη στο μητρώο
//     πηγών (data/accounting-sources.json, προστατευμένο) και μπαίνει εκεί με
//     απόφαση ιδιοκτήτη.
//     Το κείμενο του 3ζα ΔΕΝ διαβάστηκε κατά λέξη (δεν επαληθεύτηκε)· ο
//     σχεδιασμός ακολουθεί το άρθ. 11α της Οδηγίας, που το 3ζα ενσωματώνει.
//   · Η προθεσμία: ν. 2251/1994 άρθ. 3ε (14 ημέρες από τη σύναψη για
//     υπηρεσίες, άρθ. 9§2 α΄ Οδηγίας 2011/83/ΕΕ). Υπολογισμός κατά τον Καν.
//     (ΕΟΚ, Ευρατόμ) 1182/71 άρθ. 3§1 και 3§2 β΄: η ημέρα της σύναψης δεν
//     μετρά, η προθεσμία λήγει στο τέλος της 14ης ημέρας (αιτιολογική σκέψη
//     41 της Οδηγίας 2011/83/ΕΕ).
//
// ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΕΙΝΑΙ ΚΑΘΑΡΟ ΚΑΙ ΦΤΑΝΕΙ ΚΑΙ ΣΤΟΝ ΠΕΡΙΗΓΗΤΗ. Τα μηνύματα και
// ό,τι ονομάζει τον έμπορο ζουν στο lib/legal/withdrawalMail.ts (διακομιστής).
// ═══════════════════════════════════════════════════════════════════════════
import { parseDate } from '@/lib/core/greek';
import { athensToday, daysBetweenIso } from '@/lib/core/time';

// Οι σταθερές ζουν σε δικό τους αρχείο, ώστε ο σύνδεσμος των Ρυθμίσεων να μη
// φέρνει στη δέσμη του πίνακα ελέγχου τον αναλυτή ημερομηνιών.
export { WITHDRAWAL_DAYS, WITHDRAWAL_PATH, WITHDRAWAL_LABEL, WITHDRAWAL_CONFIRM_LABEL } from './withdrawalLabels';
import { WITHDRAWAL_DAYS } from './withdrawalLabels';

/** Ορια μήκους: αρκούν για κάθε πραγματική δήλωση και κόβουν τα σκουπίδια. */
const MAX = { name: 120, email: 254, contract: 500 } as const;

/** Η δήλωση όπως τη στέλνει η φόρμα. */
export interface WithdrawalInput {
  name: string;
  email: string;
  /** Τι σύμβαση: πακέτο, αριθμός παραστατικού, ό,τι την ταυτοποιεί. */
  contract: string;
  /** Η ημερομηνία αγοράς, όπως τη γράφει ο άνθρωπος (ΗΗ/ΜΜ/ΕΕΕΕ). Προαιρετική. */
  purchaseDate?: string;
}

/** Η δήλωση καθαρή, με την ημερομηνία σε ISO ή `null`. */
export interface WithdrawalClean {
  name: string;
  email: string;
  contract: string;
  purchaseIso: string | null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const squash = (v: unknown): string => String(v ?? '').replace(/\s+/g, ' ').trim();

/**
 * Ελέγχει τη δήλωση. Το μήνυμα λάθους είναι για άνθρωπο και λέει τι να διορθώσει.
 *
 * Η ΗΜΕΡΟΜΗΝΙΑ ΔΕΝ ΕΙΝΑΙ ΥΠΟΧΡΕΩΤΙΚΗ. Το άρθ. 11α ζητά στοιχεία που
 * ταυτοποιούν τη σύμβαση, όχι ημερομηνία· ο καταναλωτής που δεν τη θυμάται δεν
 * χάνει το δικαίωμα. Αν όμως γραφτεί, πρέπει να είναι υπαρκτή και όχι μελλοντική.
 */
export function validateWithdrawal(
  raw: Partial<WithdrawalInput>, now: Date = new Date(),
): { ok: true; value: WithdrawalClean } | { ok: false; error: string } {
  const name = squash(raw.name);
  const email = squash(raw.email).toLowerCase();
  const contract = squash(raw.contract);
  const dateText = squash(raw.purchaseDate);
  if (name.length < 2) return { ok: false, error: 'Γράψε το ονοματεπώνυμό σου.' };
  if (name.length > MAX.name) return { ok: false, error: 'Το ονοματεπώνυμο είναι πολύ μεγάλο.' };
  if (!EMAIL.test(email) || email.length > MAX.email) return { ok: false, error: 'Γράψε μια έγκυρη διεύθυνση email: εκεί θα λάβεις το αποδεικτικό.' };
  if (contract.length < 2) return { ok: false, error: 'Γράψε ποια σύμβαση αφορά, για παράδειγμα το πακέτο ή τον αριθμό του παραστατικού.' };
  if (contract.length > MAX.contract) return { ok: false, error: 'Η περιγραφή της σύμβασης είναι πολύ μεγάλη.' };
  let purchaseIso: string | null = null;
  if (dateText) {
    purchaseIso = parseDate(dateText);
    if (!purchaseIso) return { ok: false, error: 'Η ημερομηνία αγοράς δεν διαβάζεται. Γράψε τη ως ΗΗ/ΜΜ/ΕΕΕΕ ή άφησέ τη κενή.' };
    if (purchaseIso > athensToday(now)) return { ok: false, error: 'Η ημερομηνία αγοράς είναι στο μέλλον.' };
  }
  return { ok: true, value: { name, email, contract, purchaseIso } };
}

/** Η τελευταία ημέρα της προθεσμίας (ISO) για σύμβαση που συνάφθηκε στο `purchaseIso`. */
export function withdrawalLastDay(purchaseIso: string): string {
  const d = new Date(Date.UTC(+purchaseIso.slice(0, 4), +purchaseIso.slice(5, 7) - 1, +purchaseIso.slice(8, 10)));
  d.setUTCDate(d.getUTCDate() + WITHDRAWAL_DAYS);
  return d.toISOString().slice(0, 10);
}

/**
 * Εμπρόθεσμη η δήλωση; `null` όταν δεν ξέρουμε την ημερομηνία αγοράς.
 *
 * ΚΡΙΝΕΤΑΙ ΜΕ ΤΗΝ ΗΜΕΡΟΜΗΝΙΑ ΤΗΣ ΕΛΛΑΔΑΣ, όχι του διακομιστή: δήλωση στις 01:30
 * της 15ης ώρας Αθήνας είναι ακόμη 14η σε UTC και το ανάποδο.
 *
 * ΚΑΙ ΔΕΝ ΜΠΛΟΚΑΡΕΙ ΠΟΤΕ. Εκπρόθεσμη δήλωση καταγράφεται κι αυτή: η ημερομηνία
 * που γράφει ο άνθρωπος μπορεί να είναι λάθος και την κρίση την κάνει άνθρωπος
 * με το παραστατικό μπροστά του, όχι η φόρμα.
 */
export function withinWithdrawalPeriod(purchaseIso: string | null, now: Date = new Date()): boolean | null {
  if (!purchaseIso) return null;
  return daysBetweenIso(purchaseIso, athensToday(now)) <= WITHDRAWAL_DAYS;
}

/** Ο κωδικός αναφοράς που διαβάζει άνθρωπος: τα 8 πρώτα του αναγνωριστικού. */
export function withdrawalReference(id: string): string {
  return `ΥΠ-${String(id).replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}
