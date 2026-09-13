// npx tsx lib/billing/aiRefund.test.ts
// ═══════════════════════════════════════════════════════════════════════════
// Η ΕΠΙΣΤΡΟΦΗ ΜΟΝΑΔΑΣ AI: ΤΡΕΙΣ ΑΠΑΝΤΗΣΕΙΣ ΠΟΥ ΔΕΝ ΕΙΝΑΙ Η ΙΔΙΑ
//
// Οταν η ερώτηση προς τη Νόα αποτύχει, η μονάδα γυρίζει πίσω. Ο καλών ΚΡΙΝΕΙ
// από την απάντηση αν θα διορθώσει τις κεφαλίδες υπολοίπου που στέλνει στην
// οθόνη — άρα το `true`/`false` δεν είναι διακοσμητικό.
//
// ΤΡΕΙΣ ΠΕΡΙΠΤΩΣΕΙΣ ΠΟΥ ΜΟΙΑΖΟΥΝ ΚΑΙ ΔΕΝ ΕΙΝΑΙ:
//   · η βάση μείωσε τον μετρητή            → `true`
//   · η βάση απάντησε «δεν βρήκα γραμμή»   → `false`, ΧΩΡΙΣ σφάλμα
//   · η βάση γύρισε σφάλμα                 → `false`, με καταγραφή
//
// Το δεύτερο είναι το ύπουλο: δεν είναι σφάλμα, οπότε ένα `return !error` θα
// έλεγε «επιστράφηκε» για μονάδα που ΔΕΝ επιστράφηκε — και ο χρήστης θα έβλεπε
// υπόλοιπο μεγαλύτερο από το πραγματικό.
//
// ΔΟΚΙΜΑΖΕΤΑΙ Η ΑΛΗΘΙΝΗ ΣΥΝΑΡΤΗΣΗ, ΟΧΙ ΑΝΤΙΓΡΑΦΟ ΤΗΣ. Η πρώτη γραφή αυτού του
// αρχείου ξανάγραφε τη λογική εδώ, επειδή η αληθινή ήταν κλεισμένη γύρω από
// πελάτη που θέλει κλειδί υπηρεσίας και δίκτυο. Ενας έλεγχος που δοκιμάζει
// αντίγραφο μένει πράσινος όταν αλλάξει το πρωτότυπο — χειρότερος από κανέναν,
// γιατί διαβάζεται ως κάλυψη. Η κρίση βγήκε στο `refundOutcome`, που δέχεται
// ΑΚΡΙΒΩΣ ό,τι επιστρέφει το `rpc`.
// ═══════════════════════════════════════════════════════════════════════════
import { refundOutcome, REFUND_LOG } from './aiRefund';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean) => { if (cond) { pass++ } else { fail++; console.error('✗ ' + name) } };
const eq = (name: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++ } else { fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`) }
};

// Η καταγραφή αιχμαλωτίζεται: ένα σφάλμα που δεν γράφεται είναι χαμένη
// επιστροφή που κανείς δεν θα βρει ποτέ στα αρχεία.
const logged: string[] = [];
const realError = console.error;
console.error = (...a: unknown[]) => { logged.push(a.map(String).join(' ')) };

// ── ΕΠΙΤΥΧΙΑ ──────────────────────────────────────────────────────────────
ok('η βάση μείωσε τον μετρητή → true', refundOutcome({ data: { refunded: true }, error: null }));

// ── «ΔΕΝ ΒΡΗΚΑ ΓΡΑΜΜΗ»: ΟΧΙ ΣΦΑΛΜΑ, ΚΑΙ ΟΧΙ ΕΠΙΣΤΡΟΦΗ ────────────────────
ok('«no_row» → false', !refundOutcome({ data: { refunded: false, reason: 'no_row' }, error: null }));
ok('κενή απάντηση → false', !refundOutcome({ data: null, error: null }));
ok('απάντηση χωρίς πεδίο → false', !refundOutcome({ data: {}, error: null }));
ok('undefined → false', !refundOutcome({ data: undefined, error: null }));

// ── ΤΟ ΑΥΣΤΗΡΟ `=== true` ΕΧΕΙ ΛΟΓΟ ──────────────────────────────────────
// Μια απάντηση `"true"` ή `1` δεν αποδεικνύει ότι μειώθηκε μετρητής —
// αποδεικνύει ότι κάτι άλλαξε στο σχήμα· τότε σιωπή είναι η σωστή στάση.
ok('«true» ως κείμενο ΔΕΝ μετράει', !refundOutcome({ data: { refunded: 'true' }, error: null }));
ok('1 ως αριθμός ΔΕΝ μετράει', !refundOutcome({ data: { refunded: 1 }, error: null }));

// ── ΣΦΑΛΜΑ: false, ΚΑΙ ΓΡΑΦΤΗΚΕ ΜΕ ΤΟ ΚΟΙΝΟ ΠΡΟΘΕΜΑ ─────────────────────
logged.length = 0;
ok('σφάλμα βάσης → false', !refundOutcome({ data: null, error: { message: 'permission denied' } }));
eq('γράφτηκε μία γραμμή', logged.length, 1);
ok('με το κοινό πρόθεμα', logged[0].startsWith(REFUND_LOG));
ok('και με το μήνυμα της βάσης', logged[0].includes('permission denied'));

// ΤΟ ΣΦΑΛΜΑ ΝΙΚΑ ΤΑ ΔΕΔΟΜΕΝΑ. Αν η βάση γυρίσει ΚΑΙ σφάλμα ΚΑΙ `refunded:
// true`, δεν υπάρχει λόγος να πιστέψουμε το δεύτερο.
logged.length = 0;
ok('σφάλμα μαζί με «refunded» → false', !refundOutcome({ data: { refunded: true }, error: { message: 'timeout' } }));
eq('και αυτό γράφτηκε', logged.length, 1);

// ── ΤΟ ΠΡΟΘΕΜΑ ΚΑΤΑΓΡΑΦΗΣ ΕΙΝΑΙ ΕΝΑ ─────────────────────────────────────
// Γράφεται σε ένα σημείο ώστε η αναζήτηση στα αρχεία να βρίσκει ΟΛΕΣ τις
// χαμένες επιστροφές, όχι τα δύο τρίτα τους.
ok('το πρόθεμα είναι αναγνωρίσιμο', REFUND_LOG.includes('AI') && REFUND_LOG.length > 15);

console.error = realError;
console.log(fail === 0 ? `✓ aiRefund: ${pass} έλεγχοι πέρασαν` : `✗ aiRefund: ${fail} απέτυχαν από ${pass + fail}`);
if (fail > 0) process.exit(1);
