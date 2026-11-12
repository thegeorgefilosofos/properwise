// ═══════════════════════════════════════════════════════════════════════════
// ΓΙΑΤΙ ΕΙΝΑΙ ΚΛΕΙΣΤΟ ΤΟ ΤΑΜΕΙΟ, ΓΙΑ ΤΟΝ ΔΙΑΧΕΙΡΙΣΤΗ
// ─────────────────────────────────────────────────────────────────────────
// ΠΗΓΗ: έλεγχος ετοιμότητας πληρωμών 12/11/2026, «Λείπει (κώδικας)» 5. Οι τρεις
// μεταβλητές του Creem υπήρχαν στο Production και το ταμείο έμενε κλειστό.
// Το ταμείο γράφει στο αρχείο καταγραφής μόνο «δεν είναι ρυθμισμένη» και την
// αιτία την έλεγε μόνο η πύλη πελάτη, σε όποιον είχε ήδη συνδρομή. Δηλαδή
// κανείς δεν μπορούσε να δει ΠΟΙΟ κομμάτι της ρύθμισης φταίει χωρίς να
// διαβάσει την τιμή ενός μυστικού.
//
// ΚΑΜΙΑ ΤΙΜΗ. Η απάντηση λέει «λείπει», «δοκιμαστικό», «λείπουν αυτά τα ζεύγη»,
// ποτέ το ίδιο το κλειδί, το μυστικό ή αναγνωριστικό προϊόντος. Τα ονόματα των
// μεταβλητών λέγονται, γιατί η απάντηση φτάνει μόνο σε διαχειριστή με δεύτερο
// βήμα (app/api/billing/diagnostic).
// ═══════════════════════════════════════════════════════════════════════════
import { merchant, type BillingEnv, type MerchantPort, type ConfigDiagnosis } from '@/lib/billing/merchant';
import { checkoutState, type CheckoutClosedBy } from '@/lib/legal/checkout';
import { IDENTITY, type LegalIdentity } from '@/lib/legal/identity';

export interface CheckoutDiagnosis {
  merchant: string;
  /** Η ίδια απάντηση με το κουμπί αγοράς (`checkoutState`). */
  live: boolean;
  closedBy: CheckoutClosedBy;
  config: ConfigDiagnosis;
  /** Τι να διορθωθεί, μία πρόταση ανά εμπόδιο, χωρίς τιμές. Κενό όταν δεν λείπει τίποτα. */
  problems: string[];
}

export function checkoutDiagnosis(
  env: BillingEnv = process.env, port: MerchantPort = merchant(env), id: LegalIdentity = IDENTITY,
): CheckoutDiagnosis {
  const gate = checkoutState(env, id, port);
  const c = port.diagnose(env);
  const problems: string[] = [];
  if (c.key === 'missing') problems.push('Λείπει το κλειδί API του εμπόρου (CREEM_API_KEY).');
  if (c.testKeyInProduction) problems.push('Το CREEM_API_KEY είναι δοκιμαστικό κλειδί μέσα στο Production. Βάλε ζωντανό κλειδί.');
  if (c.testModeConflict) problems.push('Το CREEM_TEST_MODE ζητά δοκιμαστική λειτουργία με ζωντανό κλειδί. Σβήσε τη μεταβλητή.');
  if (c.products === 'missing') problems.push('Λείπει ο χάρτης προϊόντων (CREEM_PRODUCTS).');
  if (c.products === 'unreadable') problems.push(`Ο χάρτης προϊόντων (CREEM_PRODUCTS) έχει ${c.badEntries} γραμμές που δεν διαβάζονται.`);
  if (c.products !== 'missing' && c.missingPairs.length) {
    problems.push(`Στον χάρτη προϊόντων λείπουν τα ζεύγη πακέτου και κύκλου: ${c.missingPairs.join(', ')}.`);
  }
  if (!c.webhookSecret) problems.push('Λείπει το μυστικό υπογραφής του webhook (CREEM_WEBHOOK_SECRET): κάθε γεγονός του εμπόρου θα έπαιρνε 401, γι\' αυτό το ταμείο μένει κλειστό.');
  if (gate.closedBy === 'identity') problems.push('Ο έμπορος δεν πουλά ως merchant of record και η ταυτότητα του φορέα δεν έχει δημοσιευθεί.');
  return { merchant: port.id, live: gate.live, closedBy: gate.closedBy, config: c, problems };
}
