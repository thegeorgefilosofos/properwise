// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΛΟΓΙΑ ΓΙΑ ΤΑ ΧΡΗΜΑΤΑ ΓΡΑΦΟΝΤΑΙ ΜΙΑ ΦΟΡΑ
// ─────────────────────────────────────────────────────────────────────────
// Πέντε επιφάνειες μιλούν για τη χρέωση: οι Οροι, η Πολιτική απορρήτου, η
// σελίδα εμπιστοσύνης, το FAQ της αρχικής και το μητρώο υπεργολάβων. Καθεμιά
// είχε τη δική της διατύπωση, γραμμένη με το χέρι, σε διαφορετικό πέρασμα.
//
// ΟΣΟ ΗΤΑΝ ΟΛΕΣ ΨΕΥΔΕΙΣ Ή ΟΛΕΣ ΑΛΗΘΕΙΣ ΜΑΖΙ, ΚΑΝΕΙΣ ΔΕΝ ΤΟ ΠΡΟΣΕΞΕ. Το
// πρόβλημα γεννήθηκε τη στιγμή που ο κώδικας απέκτησε ζωντανό κουμπί πληρωμής
// και τα κείμενα δεν το έμαθαν: δέκα δηλώσεις «δεν γίνεται χρέωση» απέναντι σε
// μια διαδρομή που χρεώνει. Σε νομικό κείμενο αυτό δεν είναι αβλεψία — είναι
// ανακριβής ενημέρωση του υποκειμένου και το πρώτο ερώτημα κάθε ελέγχου.
//
// ΕΔΩ ΟΙ ΔΥΟ ΚΑΤΑΣΤΑΣΕΙΣ ΖΟΥΝ ΔΙΠΛΑ ΔΙΠΛΑ. Οποιος αλλάξει τη μία βλέπει την
// άλλη και η επιλογή γίνεται από την ΙΔΙΑ συνθήκη που δείχνει το κουμπί
// (`checkoutIsLive`). Δεν υπάρχει τρόπος να αποκλίνουν.
//
// ΚΑΙ Ο ΦΥΛΑΚΑΣ ΤΟ ΕΠΙΒΑΛΛΕΙ: `scripts/guard-billing-claims.mjs` κόβει κάθε
// δήλωση για ενεργή ή ανενεργή χρέωση που γράφεται εκτός αυτού του αρχείου.
//
// ── ΤΟ ΜΟΝΤΕΛΟ ΤΗΣ 27.09.2026: ΔΟΚΙΜΗ ΧΩΡΙΣ ΚΑΡΤΑ, ΧΡΕΩΣΗ ΣΤΗΝ ΑΓΟΡΑ ──────
// Απόφαση ιδιοκτήτη 27.09.2026. Η δοκιμή των 30 ημερών τρέχει ΜΕΣΑ στην
// εφαρμογή, για κάθε νέο λογαριασμό, χωρίς κάρτα (`trialState`). Τα προϊόντα
// του εμπόρου ΔΕΝ έχουν δοκιμή: όποιος αγοράζει συνδρομή χρεώνεται τη
// στιγμή της αγοράς. Οι 14 ημέρες της υπαναχώρησης μετρούν από εκεί και η
// επιστροφή είναι ολόκληρη. Τα κείμενα έλεγαν «κάρτα στην αρχή, χρέωση την
// 31η», ενώ ο έμπορος χρέωνε την πρώτη μέρα (έλεγχος 27.09.2026, P0).
//
// ── ΤΟ ΠΡΟΗΓΟΥΜΕΝΟ ΜΟΝΤΕΛΟ, ΓΙΑ ΤΟ ΙΣΤΟΡΙΚΟ ──────────────────────────────
// Ολα τα κείμενα εδώ γράφτηκαν όταν η δοκιμή έτρεχε ΧΩΡΙΣ κάρτα και ο
// λογαριασμός έπεφτε μόνος του στο «χωρίς συνδρομή». Σήμερα η κάρτα δηλώνεται
// αμέσως μετά την επιβεβαίωση του email και η πρώτη χρέωση φεύγει την 31η
// ημέρα: οι ίδιες προτάσεις έλεγαν πλέον το ΑΚΡΙΒΩΣ αντίθετο από ό,τι κάνει ο
// κώδικας. Οποιος αλλάξει ξανά το μοντέλο, αλλάζει ΠΡΩΤΑ αυτό το αρχείο.
//
// ── ΚΑΙ Η ΥΠΑΝΑΧΩΡΗΣΗ ΑΠΕΚΤΗΣΕ ΤΡΥΠΑ ΠΟΥ ΤΗΝ ΚΛΕΙΝΟΥΜΕ ΜΟΝΟΙ ΜΑΣ ────────
// Οι 14 ημέρες του νόμου μετρούν από τη ΣΥΝΑΨΗ της σύμβασης, δηλαδή από το
// ταμείο. Με δοκιμή 30 ημερών, η προθεσμία λήγει δεκαέξι ημέρες ΠΡΙΝ φύγει το
// πρώτο ευρώ: τυπικά νόμιμο, πρακτικά ένας πελάτης που πληρώνει και δεν έχει
// κανένα δικαίωμα επιστροφής. Η εγγύηση των 14 ημερών από την πρώτη χρέωση
// είναι δική μας δέσμευση, πάνω από τον νόμο και γράφεται εδώ ώστε να τη
// διαβάζουν και οι Οροι και η σελίδα εμπιστοσύνης από την ίδια πηγή.
//
// ── ΟΧΙ ΠΙΑ «ΕΓΓΥΗΣΗ» ΓΙΑ ΤΟΝ ΚΑΤΑΝΑΛΩΤΗ (απόφαση ιδιοκτήτη 09/11/2026) ────
// Από το μοντέλο της 27.09.2026 η πρώτη χρέωση ΕΙΝΑΙ η σύναψη, οπότε για τον
// καταναλωτή οι «14 ημέρες από την πρώτη χρέωση» συμπίπτουν ακριβώς με το
// δικαίωμα υπαναχώρησης του ν. 2251/1994. Η παρουσίασή του ως δικής μας
// παροχής είναι πρακτική της «μαύρης λίστας» (Οδηγία 2005/29/ΕΚ, Παράρτημα Ι
// σημ. 10, όπως ενσωματώθηκε στον ν. 2251/1994· νομικός έλεγχος 09/11/2026,
// εύρημα Ο-1). Ο καταναλωτής διαβάζει πλέον το δικαίωμα ως δικαίωμα του νόμου.
// Η δέσμευση μένει δική μας μόνο για τον επαγγελματία, που δικαίωμα
// υπαναχώρησης δεν έχει· και λέγεται «δέσμευση επιστροφής χρημάτων», όχι
// «εγγύηση», που παραπέμπει στην εμπορική εγγύηση. Η λειτουργία δεν άλλαξε.
// ═══════════════════════════════════════════════════════════════════════════

import { merchant, type BillingEnv, type MerchantPort } from '@/lib/billing/merchant';
import { morSellerDisclosed } from '@/lib/legal/merchant';
// ΤΟ ΤΑΜΕΙΟ ΚΡΙΝΕΤΑΙ ΚΑΙ ΑΠΟ ΤΗΝ ΤΑΥΤΟΤΗΤΑ ΤΟΥ ΠΩΛΗΤΗ (20/10/2026). Ζωντανό
// κλειδί με ανώνυμο φορέα έδινε τη «ζωντανή» εκδοχή των λόγων: lib/legal/checkout.ts.
import { checkoutState } from '@/lib/legal/checkout';
import { IDENTITY, sellerIdentityGaps, sellerFieldLabel, type LegalIdentity } from '@/lib/legal/identity';
import { TRIAL_DAYS, PLANS } from '@/lib/billing/plans';
import { SCAN_LIMITS } from '@/lib/billing/aiLimits';
import { INVITE_LIMITS } from '@/lib/billing/inviteLimits';
import { PROFESSIONAL_MIN_PLAN } from '@/lib/billing/entitlements';

// ── ΜΕΤΑ ΤΗ ΔΟΚΙΜΗ: ΤΟ ΔΩΡΕΑΝ ΠΑΚΕΤΟ, ΟΧΙ ΔΙΑΓΡΑΦΗ ────────────────────────
// ΑΠΟΦΑΣΗ ΙΔΙΟΚΤΗΤΗ (25.09.2026). Ως τώρα, χωρίς συνδρομή ο λογαριασμός
// κρατιόταν τριάντα ημέρες και διαγραφόταν. Με τον «Ιδιοκτήτη» δωρεάν, όποιος
// δεν πληρώνει δεν «λήγει»: συνεχίζει στο δωρεάν πακέτο. Το χρονόμετρο της
// διαγραφής αφαιρέθηκε από τη βάση (20260925190000) και οι προτάσεις από εδώ.
const FREE_AFTER_TRIAL =
  `Με τη λήξη της δοκιμής, αν δεν έχεις συνδρομή, ο λογαριασμός συνεχίζει στο δωρεάν πακέτο «${PLANS.free.name}»: ένα ακίνητο, τα φορολογικά εργαλεία, ${SCAN_LIMITS.free} σαρώσεις τον μήνα, χωρίς τη Νόα. Τα δεδομένα σου μένουν· ακίνητα πέρα από το πρώτο δεν διαγράφονται, αλλά δεν προσθέτεις νέα ούτε χρησιμοποιείς τα εργαλεία των μεγαλύτερων πακέτων ώσπου να επιλέξεις συνδρομή.`;
const KEPT_UNTIL_YOU_DELETE =
  'Παραμένουν δικά σου όσο ο λογαριασμός ζει· και ζει και χωρίς συνδρομή, στο δωρεάν πακέτο: τα εξάγεις όποτε θέλεις και τον διαγράφεις με ένα κουμπί, χωρίς να ζητήσεις τίποτα από κανέναν. Με τη διαγραφή σβήνονται όλα, εκτός από όσα ο νόμος επιβάλλει να τηρηθούν.';

export interface BillingWords {
  /** Χρεώνει η υπηρεσία σήμερα; */
  live: boolean;
  /** Η μία πρόταση: γίνεται ή δεν γίνεται χρέωση τώρα. */
  chargingToday: string;
  /** Τι συμβαίνει στη λήξη της δοκιμής. */
  afterTrial: string;
  /**
   * Το ίδιο, στο μέτρο μιας απάντησης FAQ.
   *
   * ΓΙΑΤΙ ΤΡΙΤΟ ΠΕΔΙΟ ΓΙΑ ΤΟ ΙΔΙΟ ΓΕΓΟΝΟΣ. Το `afterTrial` γράφτηκε για τους
   * Ορους, όπου η πληρότητα μετράει περισσότερο από το μήκος: πεντακόσιοι
   * χαρακτήρες, πέντε γραμμές. Μέσα στις Συχνές Ερωτήσεις, όπου οι άλλες
   * έντεκα απαντήσεις είναι δύο γραμμές, η ίδια παράγραφος διάβαζε σαν να
   * κρύβει κάτι. Το `firstCharge` πάλι λέει μόνο πότε φεύγει το πρώτο ευρώ
   * και σιωπά για το τι γίνεται αν δεν πληρώσεις ποτέ — που είναι ακριβώς
   * το μισό της ερώτησης «τι γίνεται όταν λήξει η δοκιμή;».
   */
  afterTrialShort: string;
  /** Στοιχεία κάρτας: ποιος τα αγγίζει. */
  cardData: string;
  /** Οι δωρεάν μήνες των προσκλήσεων. */
  compMonths: string;
  /**
   * Ο λογαριασμός λογιστικού ή φοροτεχνικού γραφείου και η χρέωση.
   *
   * ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΟΥΣ ΟΡΟΥΣ (απόφαση ιδιοκτήτη 05/11/2026: τα γραφεία δεν
   * πληρώνουν). Καμία πύλη των γραφείων δεν ρωτά πακέτο ή συνδρομή
   * (20261104120000, 20261104130000, 20261104150000).
   */
  firmAccount: string;
  /** Το δικαίωμα υπαναχώρησης, στον χρόνο που ισχύει. */
  withdrawal: string;
  /**
   * Το δικαίωμα υπαναχώρησης του καταναλωτή και η δέσμευση επιστροφής για τον
   * επαγγελματία, σε δύο προτάσεις.
   *
   * ΞΕΧΩΡΙΣΤΟ ΠΕΔΙΟ ΓΙΑΤΙ ΤΟ ΖΗΤΑΝΕ ΔΥΟ ΔΙΑΦΟΡΕΤΙΚΑ ΜΕΡΗ. Οι Οροι θέλουν την
   * ολόκληρη παράγραφο της υπαναχώρησης· ο τιμοκατάλογος θέλει μία γραμμή στα
   * ψιλά γράμματα, εκεί που αποφασίζει ο επισκέπτης. Γραμμένη δύο φορές, θα
   * απέκλιναν — και η απόκλιση θα ήταν σε υπόσχεση με χρήματα μέσα.
   */
  moneyBack: string;
  /** Πώς πληρώνεται το προϊόν, για τη σελίδα εμπιστοσύνης. */
  howWeArePaid: string;
  /** Πότε και πώς ζητείται το μέσο πληρωμής. */
  paymentMethodAsked: string;
  /**
   * Τι γίνεται στα χρήματα όταν αλλάζεις πακέτο.
   *
   * ΚΑΙ ΤΑ ΤΡΙΑ ΠΕΔΙΑ ΠΟΥ ΑΚΟΛΟΥΘΟΥΝ ΗΤΑΝ ΓΡΑΜΜΕΝΑ ΣΤΟΝ ΕΝΕΣΤΩΤΑ ΜΕΣΑ ΣΤΟΥΣ
   * ΟΡΟΥΣ. «Χρεώνεται αναλογικά», «η κάρτα σου βρίσκεται στη διαχείριση
   * συνδρομής», «η συνδρομή ανανεώνεται»: δίπλα ακριβώς σε παράγραφο που
   * έλεγε ότι σήμερα δεν υπάρχει καμία χρέωση. Δύο γειτονικές παράγραφοι
   * αντέλεγαν η μία στην άλλη.
   */
  planChange: string;
  /** Πού βρίσκονται τα παραστατικά, το μέσο πληρωμής και η συνδρομή. */
  subscriptionPlace: string;
  /** Η ανανέωση και οι υπενθυμίσεις της. */
  renewal: string;
  /**
   * Η κατάσταση του εμπόρου μέσα στη δική του γραμμή του μητρώου.
   *
   * ΔΕΝ ΕΙΝΑΙ ΤΟ `cardData`. Εκείνο λέει «ο πάροχος πληρωμών» σε τρίτο
   * πρόσωπο και μέσα στη γραμμή του ΙΔΙΟΥ παρόχου διαβαζόταν σαν να μιλά για
   * άλλον.
   */
  merchantRow: string;
  /**
   * Πότε φεύγει το πρώτο ευρώ, σε μία γραμμή.
   *
   * ΓΙΑ ΤΙΣ ΣΤΕΝΕΣ ΕΠΙΦΑΝΕΙΕΣ: τα ψιλά γράμματα του τιμοκαταλόγου και η
   * περιγραφή της σελίδας εγγραφής στα αποτελέσματα αναζήτησης. Η μεγάλη
   * παράγραφος (`afterTrial`) δεν χωράει εκεί και όποιος τη συντόμευε με το
   * χέρι έγραφε δεύτερη πηγή — που την πρώτη φορά είπε ότι θα γίνει χρέωση
   * ενώ η χρέωση δεν ήταν καν ρυθμισμένη.
   */
  firstCharge: string;
  /**
   * Πόσο μένει ένας λογαριασμός χωρίς συνδρομή, για τον χρόνο διατήρησης.
   *
   * Η Πολιτική απορρήτου έγραφε σταθερά «διαγράφεται μετά από τόσες ημέρες»,
   * ενώ ο καθαρισμός επιστρέφει `billing_not_live` όσο η χρέωση είναι κλειστή
   * και οι Οροι, από εδώ, έλεγαν ότι δεν τρέχει. Δύο δεσμευτικά κείμενα που
   * διαφωνούσαν στο άρθρο 13§2 στοιχείο α΄ GDPR.
   */
  lapsedRetention: string;
  /**
   * Το ίδιο, στο μέτρο της απάντησης «Τι γίνεται με τα δεδομένα μου;».
   *
   * Η ΑΠΑΝΤΗΣΗ ΤΗΣ ΑΡΧΙΚΗΣ ΕΛΕΓΕ ΤΟ ΑΝΤΙΘΕΤΟ ΑΠΟ ΤΗΝ ΑΠΟ ΠΑΝΩ ΤΗΣ. Γραμμένη με
   * το χέρι, υποσχόταν διαγραφή σε τριάντα ημέρες ενώ ο καθαρισμός δεν τρέχει
   * όσο η χρέωση είναι κλειστή· η γειτονική απάντηση για τη λήξη της
   * δοκιμής (από εδώ) έλεγε ότι τα δεδομένα μένουν. Δύο διαστήματα διατήρησης
   * στην ίδια ενότητα· και τα δύο μέσα στο FAQPage των αποτελεσμάτων.
   */
  lapsedRetentionShort: string;
  /**
   * Η ειδοποίηση πάνω από τον τιμοκατάλογο όσο δεν αγοράζεται τίποτα, αλλιώς
   * `null`. Τέσσερις τιμές με κουμπιά διαβάζονται ως «αγόρασέ το τώρα»· το ότι
   * δεν χρεώνεται κανείς πρέπει να φαίνεται ΠΑΝΩ από τις τιμές, όχι στη μέση
   * των ψιλών γραμμάτων από κάτω τους.
   */
  pricingNotice: { title: string; body: string } | null;
  /**
   * Πότε μετρά ο στόχος του Προγράμματος Συνεργατών, ή `null` όταν δεν
   * χρειάζεται επιφύλαξη.
   *
   * Ο στόχος μετρά ΣΥΝΔΡΟΜΗΤΕΣ (PRO_PAID_TARGET). Χωρίς ζωντανό ταμείο δεν
   * υπάρχει συνδρομητής, άρα η κάρτα της αρχικής υποσχόταν ανταμοιβή που
   * κανείς δεν μπορούσε να πιάσει, χωρίς να το λέει.
   */
  partnerTarget: string | null;
  /**
   * Η γραμμή των όρων στο πλαίσιο του πακέτου της εγγραφής, ή `null` όταν
   * ισχύει ο κύκλος χρέωσης («Ετήσια χρέωση»).
   *
   * Η εγγραφή έγραφε «Ετήσια χρέωση» και «να ολοκληρώσεις τη συνδρομή σου» ενώ
   * η περιγραφή της ίδιας σελίδας, από εδώ, έλεγε ότι δεν γίνεται καμία
   * χρέωση. Η οθόνη είναι πελάτης και δεν ξέρει αν το ταμείο είναι ανοιχτό·
   * της το λέει ο διακομιστής με αυτό το πεδίο.
   */
  signupPlanTerms: string | null;
  /**
   * Το σήμα δίπλα στον τίτλο της εγγραφής. Ιδιο με ταμείο ανοιχτό ή κλειστό:
   * η δοκιμή δεν ζητά κάρτα σε καμία από τις δύο καταστάσεις (απόφαση
   * ιδιοκτήτη, 27.09.2026). Ζει εδώ επειδή κάθε «χωρίς κάρτα» είναι δήλωση για
   * τη χρέωση και τέτοιες δηλώσεις γράφονται μόνο σε αυτό το αρχείο.
   */
  trialBadge: string;
  /**
   * Η ήσυχη γραμμή κάτω από τα ψιλά του τιμοκαταλόγου: ποιος εισπράττει, ή
   * `null` όσο το ταμείο είναι κλειστό.
   *
   * ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΗ ΣΕΛΙΔΑ. Η φράση ονομάζει τον έμπορο και ισχύει μόνο
   * όταν χρεώνουμε: είναι δήλωση για τη χρέωση· και τέτοιες δηλώσεις ζουν σε
   * αυτό το αρχείο. Γραμμένη στη σελίδα θα κρατούσε το όνομα με το χέρι και
   * θα έμενε ορατή τη μέρα που το ταμείο κλείνει.
   */
  securedBy: string | null;
  /** Το ίδιο σήμα χωρίς το όνομα, για όταν το όνομα το λέει το λογότυπο του εμπόρου. */
  securedByLead: string | null;
  /**
   * Τα βήματα της σύναψης, για το άρθρο 9 του π.δ. 131/2003.
   *
   * Οι Οροι μετρούσαν τρία βήματα και έλεγαν ότι η σύμβαση καταρτίζεται με την
   * ενεργοποίηση του λογαριασμού, ενώ με ζωντανό ταμείο υπάρχει και τέταρτο,
   * το ταμείο, από το οποίο μετρούν και οι 14 ημέρες της υπαναχώρησης.
   */
  contractSteps: string;
  /**
   * Με ποιον συναλλάσσεσαι, ή `null` όσο το ταμείο είναι κλειστό.
   *
   * ΤΟ ΣΧΟΛΙΟ ΤΗΣ ΟΘΟΝΗΣ ΧΡΕΩΣΗΣ ΕΛΕΓΕ ΤΟ ΑΝΤΙΘΕΤΟ ΑΠΟ ΤΟ `chargingToday`: ότι
   * πωλητής είναι ο φορέας λειτουργίας και ότι αυτός εκδίδει το παραστατικό.
   * Ο έμπορος πουλά στο δικό του όνομα και εκδίδει το παραστατικό
   * (lib/billing/invoicing.ts)· εμείς παρέχουμε την Υπηρεσία. Οι Οροι το λένε
   * από εδώ, μία φορά.
   */
  contractParties: string | null;
  /**
   * Πού στέλνεται η δήλωση υπαναχώρησης όταν την επιστροφή την εκτελεί ο
   * έμπορος, ή `null` όσο το ταμείο είναι κλειστό.
   *
   * ΚΑΙ ΣΤΟΥΣ ΔΥΟ, ΟΧΙ ΜΟΝΟ ΣΕ ΕΜΑΣ. Πωλητής της συνδρομής είναι ο έμπορος·
   * το δικαίωμα ασκείται απέναντί του και δεν περιορίζεται με όρο που λέει
   * «όχι σε εκείνον». Η δική μας διεύθυνση είναι διευκόλυνση, όχι η μόνη οδός.
   */
  withdrawalVia: string | null;
  /**
   * Ο παραλήπτης στο υπόδειγμα εντύπου υπαναχώρησης όταν πουλά ο έμπορος, ή
   * `null` όσο το ταμείο είναι κλειστό. Διεύθυνση του εμπόρου δεν υπάρχει στον
   * κώδικα (lib/legal/merchant.ts), οπότε δεν γράφεται με το χέρι: παραπέμπει
   * στα στοιχεία του παραστατικού που έστειλε ο ίδιος.
   */
  withdrawalTo: string | null;
  /**
   * Γιατί δεν πουλάμε ακόμη, όταν ο λόγος είναι η ταυτότητα του πωλητή, αλλιώς
   * `null`.
   *
   * ΓΡΑΦΕΤΑΙ ΓΙΑ ΤΗ ΣΕΛΙΔΑ «ΠΟΙΟΙ ΕΙΜΑΣΤΕ». Η αξιολόγηση της 20/10/2026 βρήκε
   * ταμείο ανοιχτό με ανώνυμο φορέα· τώρα το ταμείο μένει κλειστό ώσπου να
   * δημοσιευθούν τα στοιχεία (lib/legal/checkout.ts) και η σελίδα λέει ακριβώς
   * αυτό, με τα πεδία που λείπουν, αντί για ένα γενικό «σύντομα».
   */
  saleClosedReason: string | null;
  /**
   * Ο πωλητής σε μία γραμμή, με τον σύνδεσμο των όρων του για τον αγοραστή, ή
   * `null` όταν το ταμείο είναι κλειστό ή ο έμπορος δεν είναι merchant of record.
   *
   * ΑΠΟΦΑΣΗ GEORGE 21/10/2026. Το ταμείο ανοίγει με πωλητή τον έμπορο, χωρίς τα
   * στοιχεία του φορέα (lib/legal/checkout.ts). Η γραμμή φαίνεται στο ταμείο, στον
   * τιμοκατάλογο και στους Όρους, πριν από την πληρωμή: ο αγοραστής μαθαίνει από
   * ποιον αγοράζει. Τα στοιχεία: lib/legal/merchant.ts, MOR_SELLERS.
   */
  seller: { line: string; termsUrl: string; termsLabel: string } | null;
}

/**
 * Ο ΦΠΑ στις τιμές, σε μία πρόταση για τα ψιλά γράμματα.
 *
 * Η αρχική έγραφε ότι οι τιμές αφορούν καταναλωτές στην Ελλάδα και τα πακέτα
 * σκέτο «περιλαμβάνουν ΦΠΑ», δηλαδή υπόσχονταν την ίδια τελική τιμή και σε
 * πελάτη άλλης χώρας, όπου ο ΦΠΑ είναι άλλος. Οι Οροι λένε το ίδιο αναλυτικά.
 * Ισχύει με ταμείο ανοιχτό ή κλειστό, γι' αυτό είναι σταθερά.
 */
export const PRICES_VAT = 'Οι τιμές αφορούν καταναλωτές στην Ελλάδα και περιλαμβάνουν ΦΠΑ.';

/**
 * Η συνδρομή δεν δένει: ακυρώνεται χωρίς ποινή. Δήλωση για τη χρέωση, άρα ζει
 * εδώ και όχι στα ψιλά κάθε σελίδας. Ισχύει με ταμείο ανοιχτό ή κλειστό.
 */
export const NO_COMMITMENT = 'Χωρίς δέσμευση ή ποινή αποχώρησης.';
/** Η ίδια υπόσχεση με το ρήμα, για τα ψιλά του τιμοκαταλόγου. */
export const CANCEL_ANYTIME = 'Ακυρώνεις όποτε θέλεις.';

/**
 * Ποιος στέλνει πρόσκληση πελατών με email και με ποια όρια στη δοκιμή.
 *
 * ΗΤΑΝ ΓΡΑΜΜΕΝΗ ΣΤΗΝ ΟΘΟΝΗ. Η κάρτα «Πρόσκληση πελατών» (BulkInvite) έλεγε
 * με δικά της λόγια τι επιτρέπει η δοκιμή, δηλαδή δήλωση για τη δοκιμή έξω
 * από αυτό το αρχείο. Οι αριθμοί είναι αυτοί που επιβάλλει η βάση
 * (`send_quota_rule`, 20261021120000) μέσω του `INVITE_LIMITS`, που το
 * accountantInvites.test.ts κρατά ίσο με τη μετάβαση.
 *
 * Η οθόνη ζει στον περιηγητή και ΔΕΝ εισάγει αυτό το αρχείο (θα έσερνε τον
 * έμπορο και το `node:crypto` στον πελάτη): τα παίρνει από το
 * /api/billing/words, όπως κάθε άλλη οθόνη του πίνακα.
 */
const INVITE_TRIAL = `στη δοκιμή έως ${INVITE_LIMITS.trialPerDay} τη μέρα και ${INVITE_LIMITS.trialTotal} συνολικά`;
export const INVITE_ACCESS = `Για πακέτο «${PLANS[PROFESSIONAL_MIN_PLAN].name}» και πάνω· ${INVITE_TRIAL}.`;
/** Η άρνηση της βάσης (`plan_required`), με τα ίδια όρια. */
export const INVITE_PLAN_REFUSAL = `Η πρόσκληση με email ανοίγει στο πακέτο «${PLANS[PROFESSIONAL_MIN_PLAN].name}» και πάνω· ${INVITE_TRIAL}.`;

/**
 * Το δικαίωμα του νόμου για τον καταναλωτή, σε μία πρόταση για τα ψιλά του
 * τιμοκαταλόγου και του ταμείου. ΔΙΚΑΙΩΜΑ ΤΟΥ ΝΟΜΟΥ, ΟΧΙ ΠΑΡΟΧΗ ΜΑΣ (Ο-1).
 */
// «Η ΕΦΑΡΜΟΓΗ», ΟΧΙ «Η ΥΠΗΡΕΣΙΑ». Η πρόταση διαβάζεται και στα ψιλά του
// τιμοκαταλόγου, όπου ο νομικός όρος με κεφαλαίο ακουγόταν σαν συμβόλαιο.
// ΤΗΝ ΕΠΙΣΤΡΟΦΗ ΤΗΝ ΚΑΝΕΙ Ο ΕΜΠΟΡΟΣ. Το αίτημα έρχεται σε εμάς ή σε εκείνον,
// τα χρήματα επιστρέφονται από εκείνον.
const consumerRightLive = (mor: string): string =>
  `Ως καταναλωτής έχεις από τον νόμο (ν. 2251/1994) δικαίωμα υπαναχώρησης 14 ημερών από την αγορά, με επιστροφή ολόκληρου του ποσού μέσω της ${mor}.`;
/** Η δέσμευση για τον επαγγελματία, που δικαίωμα υπαναχώρησης δεν έχει. Δική μας, γι' αυτό λέγεται έτσι. */
const proRefundLive = (mor: string): string =>
  `Αν αγοράζεις ως επαγγελματίας, οπότε το δικαίωμα αυτό δεν σε καλύπτει, δεσμευόμαστε να σου επιστραφεί ολόκληρο το ποσό της πρώτης χρέωσης μέσω της ${mor}, αν το ζητήσεις μέσα σε 14 ημέρες από αυτήν, χωρίς να χρειάζεται να δικαιολογηθείς.`;
const moneyBackLive = (mor: string): string => `${consumerRightLive(mor)} ${proRefundLive(mor)}`;
const CONSUMER_RIGHT_SOON =
  'Όταν ενεργοποιηθεί η χρέωση, ως καταναλωτής θα έχεις από τον νόμο (ν. 2251/1994) δικαίωμα υπαναχώρησης 14 ημερών από την αγορά, με επιστροφή ολόκληρου του ποσού.';
const PRO_REFUND_SOON =
  'Αν αγοράσεις ως επαγγελματίας, οπότε το δικαίωμα αυτό δεν σε καλύπτει, δεσμευόμαστε να σου επιστραφεί ολόκληρο το ποσό της πρώτης χρέωσης, αν το ζητήσεις μέσα σε 14 ημέρες από αυτήν.';
const MONEY_BACK_SOON = `${CONSUMER_RIGHT_SOON} ${PRO_REFUND_SOON}`;

// ── ΤΟ ΟΝΟΜΑ ΤΟΥ ΕΜΠΟΡΟΥ ΔΕΝ ΓΡΑΦΕΤΑΙ ΕΔΩ ────────────────────────────────
// ΤΟ ΣΦΑΛΜΑ, ΟΠΩΣ ΗΤΑΝ. Δύο από αυτές τις προτάσεις ονόμαζαν τον έμπορο
// κυριολεκτικά, ενώ ο κώδικας είχε ήδη δεύτερο έμπορο και μεταβλητή που
// διαλέγει ποιος εισπράττει. Την ημέρα που η μεταβλητή γύριζε, οι Οροι και η
// Πολιτική απορρήτου θα έλεγαν σε ποια εταιρεία πάει η κάρτα σου — και θα
// έλεγαν λάθος εταιρεία. Το όνομα έρχεται πλέον από τη θύρα που εισπράττει.
//
// ΓΙΑΤΙ ΣΥΝΑΡΤΗΣΗ ΚΑΙ ΟΧΙ ΣΤΑΘΕΡΑ: μια σταθερά θα έπρεπε να θυμηθεί κάποιος
// να την αλλάξει και αυτό ακριβώς είναι που δεν συνέβη.
const liveWords = (mor: string): Omit<BillingWords, 'live' | 'saleClosedReason' | 'seller'> => ({
  chargingToday:
    `Η χρέωση συνδρομής γίνεται μέσω της ${mor}, που ενεργεί ως merchant of record: πουλά τη συνδρομή στο δικό της όνομα, εκδίδει το παραστατικό και αποδίδει τον ΦΠΑ της χώρας σου.`,
  // Χωρίς τις ημέρες: οι Οροι τις λένε στην αμέσως προηγούμενη παράγραφο
  // («δωρεάν δοκιμή 30 ημερών, μία φορά») και η §6 περιέγραφε τη δοκιμή δύο φορές.
  afterTrial:
    `Η δοκιμή γίνεται χωρίς κάρτα και χωρίς χρέωση. Το δωρεάν πακέτο «${PLANS.free.name}» δεν ζητά ποτέ μέσο πληρωμής. Συνδρομή αγοράζεις όποτε θέλεις: δηλώνεις μέσο πληρωμής στο ταμείο της ${mor} και η πρώτη χρέωση γίνεται τη στιγμή της αγοράς, στο πακέτο και στον κύκλο που διάλεξες. Επαναλαμβάνεται σε κάθε ανανέωση ώσπου να ακυρώσεις. ${FREE_AFTER_TRIAL}`,
  afterTrialShort:
    `Η δοκιμή των ${TRIAL_DAYS} ημερών δεν ζητά κάρτα. Κάρτα ζητείται μόνο όταν αγοράζεις συνδρομή και η χρέωση γίνεται τη στιγμή της αγοράς. Χωρίς συνδρομή συνεχίζεις στο πακέτο «${PLANS.free.name}», με ένα ακίνητο και χωρίς τη Νόα.`,
  cardData:
    `Τα στοιχεία της κάρτας τα χειρίζεται αποκλειστικά η ${mor} και δεν περνούν ποτέ από τους δικούς μας διακομιστές: η πληρωμή γίνεται στο δικό της περιβάλλον και εμείς λαμβάνουμε μόνο την επιβεβαίωση.`,
  compMonths:
    'Οι ανταμοιβές είναι αξία προϊόντος, δηλαδή μήνες συνδρομής χωρίς χρέωση και επιπλέον θέσεις ακινήτων· πιστώνονται στον λογαριασμό σου και δεν εξαργυρώνονται σε μετρητά.',
  firmAccount:
    'Ο λογαριασμός γραφείου δεν χρεώνεται: το γραφείο και τα μέλη του δεν πληρώνουν συνδρομή για να βλέπουν ή να καταχωρούν στους λογαριασμούς των πελατών τους. Τη συνδρομή του λογαριασμού του την επιλέγει και την πληρώνει, αν θέλει, μόνο ο πελάτης.',
  // Η ΣΥΝΔΡΟΜΗ ΧΡΕΩΝΕΤΑΙ ΣΤΗΝ ΑΓΟΡΑ, ΑΡΑ ΟΙ 14 ΗΜΕΡΕΣ ΚΑΛΥΠΤΟΥΝ ΧΡΗΜΑΤΑ.
  // Η επιστροφή είναι ΟΛΟΚΛΗΡΗ, όχι αναλογική: δεν χρειάζεται δήλωση για
  // «άμεση έναρξη της παροχής», που θα έπρεπε να ζητηθεί στο ταμείο και δεν
  // ζητείται πουθενά. Και ονομάζεται ποιος την εκτελεί: ο έμπορος που
  // εξέδωσε το παραστατικό, όχι εμείς.
  // Δύο προθεσμίες και όχι τρεις αναφορές στις «14 ημέρες»: η αρχή της
  // προθεσμίας λέγεται με λέξεις (η στιγμή της αγοράς), η δέσμευση για τον
  // επαγγελματία και ο χρόνος της επιστροφής με τον αριθμό τους. Το δικαίωμα
  // του καταναλωτή το λέει ήδη η πρώτη παράγραφος της ενότητας στους Όρους.
  withdrawal:
    `Η συνδρομή χρεώνεται τη στιγμή της αγοράς, που είναι και η στιγμή της σύναψης: από εκεί μετρά η προθεσμία. Η υπαναχώρηση μέσα σε αυτήν δεν σου κοστίζει τίποτα, ούτε για τις ημέρες που χρησιμοποίησες την εφαρμογή. Την επιστροφή ολόκληρου του ποσού την εκτελεί η ${mor}, που εξέδωσε το παραστατικό, με τον ίδιο τρόπο πληρωμής και μέσα σε 14 ημέρες από τη δήλωσή σου. ${proRefundLive(mor)}`,
  moneyBack: moneyBackLive(mor),
  howWeArePaid:
    'Τα έσοδά μας είναι οι συνδρομές.',
  paymentMethodAsked:
    `Το μέσο πληρωμής ζητείται μόνο για συνδρομή, ρητά, στο ταμείο της ${mor}: αμέσως μετά την επιβεβαίωση του email αν διάλεξες συνδρομή στην εγγραφή, αλλιώς όποτε την αγοράσεις από τον «Λογαριασμό». Βλέπεις το ποσό και την περίοδο πριν πληρώσεις. Η χρέωση γίνεται τη στιγμή της αγοράς και λαμβάνεις ειδοποίηση πριν από κάθε ανανέωση.`,
  planChange:
    'Το πακέτο το αλλάζεις όποτε θέλεις μέσα από την εφαρμογή. Η αναβάθμιση ισχύει αμέσως και χρεώνεται αναλογικά: πληρώνεις μόνο τη διαφορά για τις ημέρες που απομένουν ως την επόμενη ανανέωση, με πίστωση όσων έχεις ήδη πληρώσει στο προηγούμενο πακέτο. Η υποβάθμιση δεν επιστρέφει χρήματα: κρατάς το πακέτο που έχεις πληρώσει ως το τέλος της τρέχουσας περιόδου και η νέα, χαμηλότερη τιμή ισχύει από την επόμενη ανανέωση.',
  subscriptionPlace:
    'Τα παραστατικά, το μέσο πληρωμής και η ίδια η συνδρομή βρίσκονται στη διαχείριση συνδρομής, μέσα από τον Λογαριασμό σου.',
  renewal:
    'Η συνδρομή ανανεώνεται στο τέλος κάθε περιόδου, εκτός αν την ακυρώσεις πριν από την ανανέωση. Στην ετήσια συνδρομή στέλνουμε υπενθύμιση τουλάχιστον 30 ημέρες πριν και στη μηνιαία τουλάχιστον 3, με το ποσό και την ημερομηνία.',
  merchantRow:
    `Τα στοιχεία της κάρτας τα χειρίζεται αποκλειστικά η ${mor} και δεν περνούν ποτέ από τους δικούς μας διακομιστές.`,
  lapsedRetention:
    `Λογαριασμός χωρίς ενεργή συνδρομή: συνεχίζει στο δωρεάν πακέτο «${PLANS.free.name}» και διατηρείται μαζί με τα δεδομένα του ώσπου να τον διαγράψεις εσύ. Δεν διαγράφεται αυτόματα επειδή δεν πληρώνει.`,
  lapsedRetentionShort: KEPT_UNTIL_YOU_DELETE,
  pricingNotice: null,
  contractSteps:
    `Για το δωρεάν πακέτο «${PLANS.free.name}» τα βήματα είναι δύο: συμπληρώνεις τη φόρμα εγγραφής και επιβεβαιώνεις τη διεύθυνση email σου. Για συνδρομή είναι τέσσερα: συμπληρώνεις τη φόρμα εγγραφής και διαλέγεις πακέτο, επιβεβαιώνεις τη διεύθυνση email σου, δηλώνεις μέσο πληρωμής στο ταμείο και επιβεβαιώνεις την αγορά. Ο λογαριασμός ενεργοποιείται με την επιβεβαίωση του email και η σύμβαση συνδρομής καταρτίζεται με την επιβεβαίωση στο ταμείο.`,
  // Χωρίς τις ημέρες, όπως και στη σκοτεινή εκδοχή: η αρχική, τα πακέτα και η
  // εγγραφή τις λένε στην αμέσως προηγούμενη πρόταση και η σελίδα έγραφε
  // «30 ημέρες δοκιμής… Η δοκιμή των 30 ημερών…» δύο φορές στη σειρά.
  firstCharge:
    'Η δοκιμή δεν ζητά κάρτα. Σε συνδρομή η χρέωση γίνεται τη στιγμή της αγοράς.',
  partnerTarget: null,
  signupPlanTerms: null,
  trialBadge: TRIAL_BADGE,
  securedBy: `Πληρωμές με ασφάλεια μέσω της ${mor}`,
  securedByLead: 'Πληρωμές με ασφάλεια μέσω',
  contractParties:
    `Τη συνδρομή την αγοράζεις από την ${mor}, που την πουλά στο δικό της όνομα· για την ίδια την πληρωμή ισχύουν και οι δικοί της όροι. Την Υπηρεσία σού την παρέχουμε εμείς με τους παρόντες Όρους και απαντάμε απέναντί σου για αυτήν.`,
  withdrawalVia:
    `Μπορείς να τη στείλεις και απευθείας στην ${mor}, με τα στοιχεία επικοινωνίας του παραστατικού που σου έστειλε. Αν τη λάβουμε εμείς, τη διαβιβάζουμε στην ${mor}, που εκτελεί την επιστροφή.`,
  withdrawalTo:
    `${mor}, πωλήτρια της συνδρομής (στοιχεία επικοινωνίας στο παραστατικό της)`,
});

const TRIAL_BADGE = `Δοκιμή ${TRIAL_DAYS} ημερών χωρίς κάρτα`;

const NOT_LIVE: Omit<BillingWords, 'live' | 'saleClosedReason' | 'seller'> = {
  chargingToday:
    'Η χρέωση συνδρομής δεν έχει ενεργοποιηθεί και σήμερα δεν γίνεται καμία πληρωμή μέσα από την Υπηρεσία.',
  afterTrial:
    `Δεν ζητείται μέσο πληρωμής κατά την εγγραφή και καμία χρέωση δεν πραγματοποιείται, ούτε κατά τη δοκιμή ούτε μετά: η χρέωση συνδρομών δεν έχει ενεργοποιηθεί. ${FREE_AFTER_TRIAL}`,
  afterTrialShort:
    `Δεν ζητείται κάρτα και δεν γίνεται καμία χρέωση, ούτε στη δοκιμή των ${TRIAL_DAYS} ημερών ούτε μετά: η χρέωση συνδρομών δεν έχει ενεργοποιηθεί. Μετά τη δοκιμή συνεχίζεις στο πακέτο «${PLANS.free.name}», χωρίς συνδρομή, με ένα ακίνητο και χωρίς τη Νόα.`,
  cardData:
    'Η χρέωση με κάρτα δεν έχει ενεργοποιηθεί, οπότε σήμερα δεν υπάρχει καμία επεξεργασία στοιχείων κάρτας. Όταν ενεργοποιηθεί, τα στοιχεία της κάρτας θα τα χειρίζεται αποκλειστικά ο πάροχος πληρωμών και δεν θα περνούν ποτέ από τους δικούς μας διακομιστές.',
  compMonths:
    'Οι ανταμοιβές είναι αξία προϊόντος, δηλαδή μήνες συνδρομής χωρίς χρέωση και επιπλέον θέσεις ακινήτων· πιστώνονται στον λογαριασμό σου και δεν εξαργυρώνονται σε μετρητά. Όσο δεν έχει ενεργοποιηθεί η χρέωση συνδρομών, οι μήνες αυτοί δίνονται ως αντίστοιχη πρόσβαση χωρίς πληρωμή.',
  firmAccount:
    'Ο λογαριασμός γραφείου δεν χρεώνεται: το γραφείο και τα μέλη του δεν πληρώνουν για να βλέπουν ή να καταχωρούν στους λογαριασμούς των πελατών τους. Σήμερα άλλωστε καμία χρέωση δεν γίνεται μέσα από την Υπηρεσία.',
  withdrawal:
    `Σήμερα δεν υπάρχει καμία χρέωση, οπότε αν υπαναχωρήσεις δεν οφείλεις τίποτα. Όταν ενεργοποιηθεί η χρέωση, η συνδρομή θα χρεώνεται τη στιγμή της αγοράς και η προθεσμία θα μετρά από τότε. ${PRO_REFUND_SOON}`,
  moneyBack: MONEY_BACK_SOON,
  howWeArePaid:
    'Τα έσοδά μας θα είναι οι συνδρομές. Σήμερα η χρέωση συνδρομών δεν έχει ενεργοποιηθεί.',
  paymentMethodAsked:
    'Όταν η χρέωση ενεργοποιηθεί, το μέσο πληρωμής θα ζητείται ρητά στο ταμείο και μόνο για συνδρομή, με σαφή αναφορά στο ποσό και στην περίοδο πριν πληρώσεις. Η χρέωση θα γίνεται τη στιγμή της αγοράς.',
  // ΔΕΝ ΥΠΟΣΧΕΤΑΙ ΚΟΥΜΠΙ ΠΟΥ ΔΕΝ ΥΠΑΡΧΕΙ (έλεγχος 12/11/2026). Ελεγε «το
  // αλλάζεις όποτε θέλεις… σήμερα δεν κοστίζει τίποτα», ενώ το
  // app/api/billing/plan/route.ts απαντά 403 σε όποιον δεν έχει συνδρομή και
  // 503 όσο το ταμείο είναι κλειστό. Η αλλαγή πακέτου υπάρχει μόνο από τη
  // στιγμή που ανοίγουν οι συνδρομές· ως τότε το λέμε όπως είναι.
  planChange:
    'Οι συνδρομές δεν έχουν ανοίξει ακόμη, οπότε σήμερα δεν αγοράζεις ούτε αλλάζεις πακέτο μέσα από την εφαρμογή· ανοίγουν σύντομα. Από τότε, η αναβάθμιση θα ισχύει αμέσως και θα χρεώνεται αναλογικά, μόνο για τις ημέρες ως την επόμενη ανανέωση. Η υποβάθμιση θα ισχύει από την επόμενη ανανέωση, χωρίς επιστροφή για την περίοδο που έχεις ήδη πληρώσει.',
  subscriptionPlace:
    'Όταν ενεργοποιηθεί η χρέωση, τα παραστατικά, το μέσο πληρωμής και η συνδρομή θα βρίσκονται στη διαχείριση συνδρομής, μέσα από τον Λογαριασμό σου.',
  renewal:
    'Όταν ενεργοποιηθεί η χρέωση, η συνδρομή θα ανανεώνεται στο τέλος κάθε περιόδου, εκτός αν την ακυρώσεις πριν από την ανανέωση. Στην ετήσια συνδρομή θα στέλνουμε υπενθύμιση τουλάχιστον 30 ημέρες πριν και στη μηνιαία τουλάχιστον 3, με το ποσό και την ημερομηνία.',
  merchantRow:
    'Δεν έχει ενεργοποιηθεί. Όταν ενεργοποιηθεί, τα στοιχεία της κάρτας θα τα χειρίζεται μόνο αυτή και δεν θα περνούν από τους δικούς μας διακομιστές.',
  lapsedRetention:
    `Λογαριασμός χωρίς ενεργή συνδρομή: συνεχίζει στο δωρεάν πακέτο «${PLANS.free.name}» και διατηρείται μαζί με τα δεδομένα του ώσπου να τον διαγράψεις εσύ. Δεν διαγράφεται αυτόματα επειδή δεν πληρώνει.`,
  lapsedRetentionShort: KEPT_UNTIL_YOU_DELETE,
  pricingNotice: {
    title: 'Οι συνδρομές δεν έχουν ανοίξει ακόμη.',
    body: `Σήμερα ξεκινάς με τη δοκιμή των ${TRIAL_DAYS} ημερών, χωρίς κάρτα και χωρίς χρέωση. Πριν από οποιαδήποτε χρέωση θα σου ζητηθεί ρητά μέσο πληρωμής.`,
  },
  contractSteps:
    'Τα βήματα είναι τρία: συμπληρώνεις τη φόρμα εγγραφής και διαλέγεις πακέτο, επιβεβαιώνεις τη διεύθυνση email σου και ο λογαριασμός ενεργοποιείται. Η σύμβαση καταρτίζεται με την ενεργοποίηση.',
  // Χωρίς τις ημέρες της δοκιμής: κάθε επιφάνεια που τη δανείζεται τις έχει
  // ήδη πει στην προηγούμενη πρόταση και η επανάληψη διάβαζε σαν ψιλά γράμματα.
  firstCharge:
    'Δεν ζητείται κάρτα και δεν γίνεται καμία χρέωση: η χρέωση συνδρομών δεν έχει ενεργοποιηθεί ακόμη.',
  partnerTarget:
    'Ο στόχος μετρά συνδρομητές, οπότε ισχύει από τη μέρα που θα ενεργοποιηθεί η χρέωση συνδρομών.',
  signupPlanTerms: 'Χωρίς χρέωση προς το παρόν',
  trialBadge: TRIAL_BADGE,
  // ΚΑΝΕΝΑ ΣΗΜΑ ΑΣΦΑΛΕΙΑΣ ΧΩΡΙΣ ΤΑΜΕΙΟ. Μια γραμμή «πληρωμές μέσω…» πάνω από
  // τιμές που δεν αγοράζονται θα υπονοούσε ότι αγοράζονται.
  securedBy: null,
  securedByLead: null,
  contractParties: null,
  withdrawalVia: null,
  withdrawalTo: null,
};

/** Τα στοιχεία σε φράση, με «και» πριν από το τελευταίο. */
const listOf = (xs: string[]): string =>
  xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} και ${xs[xs.length - 1]}`;

/**
 * Η εξήγηση όταν το ταμείο κλείνει για την ταυτότητα. Ισχύει όποια κι αν είναι
 * η ρύθμιση του εμπόρου: ακόμη κι αν εκείνη ήταν πλήρης, δεν θα πουλούσαμε.
 */
function saleClosedReason(id: LegalIdentity): string | null {
  const gaps = sellerIdentityGaps(id);
  if (!gaps.length) return null;
  return `Η αγορά συνδρομών μένει κλειστή ώσπου να δημοσιευθούν εδώ τα στοιχεία του φορέα που ζητά ο νόμος για κάθε πώληση από απόσταση: ${listOf(gaps.map(f => sellerFieldLabel(f, id)))}. Δεν θέλουμε να πληρώνεις χωρίς να ξέρεις από ποιον αγοράζεις. Μόλις δημοσιευθούν, οι συνδρομές ανοίγουν και τα στοιχεία φαίνονται πριν από την αγορά.`;
}

/**
 * Τα λόγια που ισχύουν αυτή τη στιγμή. Διαβάζεται ΜΟΝΟ σε διακομιστή.
 *
 * @param id η ταυτότητα του φορέα, ρητά μόνο για τις σουίτες· στην εφαρμογή
 *   είναι πάντα το IDENTITY.
 */
export function billingWords(
  env: BillingEnv = process.env, id: LegalIdentity = IDENTITY, port: MerchantPort = merchant(env),
): BillingWords {
  const { live } = checkoutState(env, id, port);
  return {
    live,
    ...(live ? liveWords(port.name) : NOT_LIVE),
    // ΜΕ ΑΝΟΙΧΤΟ ΤΑΜΕΙΟ ΚΑΜΙΑ ΕΞΗΓΗΣΗ «ΓΙΑΤΙ ΚΛΕΙΣΤΟ». Με πωλητή τον έμπορο το
    // ταμείο ανοίγει και με ελλιπή ταυτότητα φορέα· η σελίδα «Ποιοι είμαστε»
    // δεν επιτρέπεται να λέει ταυτόχρονα ότι η αγορά μένει κλειστή.
    saleClosedReason: live ? null : saleClosedReason(id),
    seller: live ? sellerOf(port) : null,
  };
}

/** Η γραμμή του πωλητή, μόνο για έμπορο merchant of record με δηλωμένα στοιχεία. */
function sellerOf(port: MerchantPort): BillingWords['seller'] {
  const s = port.sellerOfRecord;
  if (!morSellerDisclosed(s)) return null;
  return {
    line: `Πωλητής: ${s.name} (merchant of record). Εισπράττει την πληρωμή, εκδίδει την απόδειξη και αποδίδει τον ΦΠΑ.`,
    termsUrl: s.buyerTermsUrl,
    termsLabel: `Όροι αγοραστή της ${s.name}`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ΤΑ ΙΔΙΑ ΛΟΓΙΑ ΣΤΑ ΑΓΓΛΙΚΑ (σελίδες /en), ΑΠΟ ΤΗΝ ΙΔΙΑ ΣΥΝΘΗΚΗ
// ─────────────────────────────────────────────────────────────────────────
// Η αγγλική βιτρίνα λέει για δοκιμή, κάρτα και χρέωση ΑΚΡΙΒΩΣ ό,τι η
// ελληνική και το διαβάζει από το ίδιο `checkoutState`. Ιδιο σχήμα
// (`BillingWords`), ίδιες περιπτώσεις, ίδιοι αριθμοί από τον κώδικα· αλλάζει
// μόνο η γλώσσα. Μεταφορά, όχι παράφραση: οι υποχρεώσεις λέγονται όπως στα
// ελληνικά. Δεσμευτικό κείμενο μένει το ελληνικό (βλ. τις νομικές σελίδες).
//
// ΚΑΝΕΝΑ «FREE» ΔΙΠΛΑ ΣΕ ΠΑΚΕΤΟ Η ΤΙΜΗ: το πακέτο χωρίς συνδρομή λέγεται
// «no-subscription», όπως ο ελληνικός κανόνας για το «δωρεάν».
// ═══════════════════════════════════════════════════════════════════════════
const PLAN_EN_FREE = 'Owner';
const NOA_EN = 'Noa';

const AFTER_TRIAL_EN =
  `When the trial ends, if you have no subscription, your account continues on the no-subscription “${PLAN_EN_FREE}” plan: one property, the tax tools and ${SCAN_LIMITS.free} scans a month, without ${NOA_EN}. Your data stays. Properties beyond the first are not deleted, but you cannot add new ones or use the tools of the larger plans until you choose a subscription.`;
const KEPT_UNTIL_YOU_DELETE_EN =
  'It stays yours for as long as your account exists, and your account exists without a subscription too, on the no-subscription plan. You can export it whenever you like and delete the account with one button, without asking anyone. Deleting it erases everything, except what the law requires us to keep.';

export const PRICES_VAT_EN = 'Prices apply to consumers in Greece and include VAT.';
export const NO_COMMITMENT_EN = 'No commitment and no exit fee.';
export const CANCEL_ANYTIME_EN = 'Cancel whenever you like.';

// Ο-1, όπως στα ελληνικά: δικαίωμα του νόμου για τον καταναλωτή, δέσμευση μας μόνο για τον επαγγελματία.
const consumerRightLiveEn = (mor: string): string =>
  `As a consumer you have a statutory right of withdrawal (Greek Law 2251/1994) for 14 days from purchase, with a full refund through ${mor}.`;
const proRefundLiveEn = (mor: string): string =>
  `If you buy as a business, so that this right does not cover you, we undertake that the full amount of the first charge is refunded to you through ${mor} if you ask within 14 days of it, with no questions asked.`;
const moneyBackLiveEn = (mor: string): string => `${consumerRightLiveEn(mor)} ${proRefundLiveEn(mor)}`;
const CONSUMER_RIGHT_SOON_EN =
  'Once billing is switched on, as a consumer you will have a statutory right of withdrawal (Greek Law 2251/1994) for 14 days from purchase, with a full refund.';
const PRO_REFUND_SOON_EN =
  'If you buy as a business, so that this right does not cover you, we undertake that the full amount of the first charge is refunded to you if you ask within 14 days of it.';
const MONEY_BACK_SOON_EN = `${CONSUMER_RIGHT_SOON_EN} ${PRO_REFUND_SOON_EN}`;
const TRIAL_BADGE_EN = `${TRIAL_DAYS}-day trial, no card`;

const liveWordsEn = (mor: string): Omit<BillingWords, 'live' | 'saleClosedReason' | 'seller'> => ({
  chargingToday:
    `Subscriptions are charged through ${mor}, which acts as merchant of record: it sells the subscription in its own name, issues the receipt and remits the VAT of your country.`,
  afterTrial:
    `The trial requires no card and involves no charge. The no-subscription “${PLAN_EN_FREE}” plan never asks for a payment method. You can buy a subscription whenever you like: you enter a payment method at the ${mor} checkout and the first charge is made at the moment of purchase, for the plan and billing cycle you chose. It repeats at every renewal until you cancel. ${AFTER_TRIAL_EN}`,
  afterTrialShort:
    `The ${TRIAL_DAYS}-day trial does not ask for a card. A card is requested only when you buy a subscription, and the charge is made at the moment of purchase. Without a subscription you continue on the “${PLAN_EN_FREE}” plan, with one property and without ${NOA_EN}.`,
  cardData:
    `Card details are handled exclusively by ${mor} and never pass through our servers: payment takes place in its own environment and we receive only the confirmation.`,
  compMonths:
    'Rewards are product value, meaning subscription months without charge and extra property slots. They are credited to your account and cannot be exchanged for cash.',
  firmAccount:
    'A firm account is not charged: the firm and its members do not pay a subscription to view or record in their clients’ accounts. Only the client chooses, and pays for if they wish, the subscription of their own account.',
  withdrawal:
    `A subscription is charged at the moment of purchase, which is also when the contract is concluded, and the withdrawal period runs from then. Withdrawing within that period costs you nothing, not even for the days you used the app. The full refund is made by ${mor}, which issued the receipt, using the same payment method and within 14 days of your notice. ${proRefundLiveEn(mor)}`,
  moneyBack: moneyBackLiveEn(mor),
  howWeArePaid:
    'Our revenue comes from subscriptions.',
  paymentMethodAsked:
    `A payment method is requested only for a subscription, explicitly, at the ${mor} checkout: right after you confirm your email if you chose a subscription at sign-up, otherwise whenever you buy one from “Account”. You see the amount and the period before you pay. The charge is made at the moment of purchase and you are notified before every renewal.`,
  planChange:
    'You can change plans at any time from within the app. An upgrade takes effect immediately and is charged pro rata: you pay only the difference for the days left until the next renewal, with credit for what you have already paid on the previous plan. A downgrade does not refund money: you keep the plan you paid for until the end of the current period, and the new, lower price applies from the next renewal.',
  subscriptionPlace:
    'Receipts, your payment method and the subscription itself are in subscription management, under your Account.',
  renewal:
    'A subscription renews at the end of each period unless you cancel before the renewal. For annual subscriptions we send a reminder at least 30 days ahead, and for monthly ones at least 3, with the amount and the date.',
  merchantRow:
    `Card details are handled exclusively by ${mor} and never pass through our servers.`,
  lapsedRetention:
    `An account without an active subscription continues on the no-subscription “${PLAN_EN_FREE}” plan and is kept, with its data, until you delete it yourself. It is not deleted automatically for not paying.`,
  lapsedRetentionShort: KEPT_UNTIL_YOU_DELETE_EN,
  pricingNotice: null,
  contractSteps:
    `For the no-subscription “${PLAN_EN_FREE}” plan there are two steps: you complete the sign-up form and confirm your email address. For a subscription there are four: you complete the sign-up form and choose a plan, confirm your email address, enter a payment method at checkout and confirm the purchase. The account is activated when you confirm your email, and the subscription contract is concluded when you confirm at checkout.`,
  firstCharge:
    'The trial does not ask for a card. With a subscription, the charge is made at the moment of purchase.',
  partnerTarget: null,
  signupPlanTerms: null,
  trialBadge: TRIAL_BADGE_EN,
  securedBy: `Payments secured by ${mor}`,
  securedByLead: 'Payments secured by',
  contractParties:
    `You buy the subscription from ${mor}, which sells it in its own name; its own terms also apply to the payment itself. We provide the Service to you under these Terms and are responsible to you for it.`,
  withdrawalVia:
    `You can also send it directly to ${mor}, using the contact details on the receipt it sent you. If we receive it, we forward it to ${mor}, which makes the refund.`,
  withdrawalTo:
    `${mor}, seller of the subscription (contact details on its receipt)`,
});

const NOT_LIVE_EN: Omit<BillingWords, 'live' | 'saleClosedReason' | 'seller'> = {
  chargingToday:
    'Subscription billing has not been switched on, and no payment is made through the Service today.',
  afterTrial:
    `No payment method is requested at sign-up and no charge is made, either during the trial or after it: subscription billing has not been switched on. ${AFTER_TRIAL_EN}`,
  afterTrialShort:
    `No card is requested and no charge is made, either during the ${TRIAL_DAYS}-day trial or after it: subscription billing has not been switched on. After the trial you continue on the “${PLAN_EN_FREE}” plan, with no subscription, one property and without ${NOA_EN}.`,
  cardData:
    'Card billing has not been switched on, so no card data is processed today. Once it is, card details will be handled exclusively by the payment provider and will never pass through our servers.',
  compMonths:
    'Rewards are product value, meaning subscription months without charge and extra property slots. They are credited to your account and cannot be exchanged for cash. Until subscription billing is switched on, these months are given as equivalent access without payment.',
  firmAccount:
    'A firm account is not charged: the firm and its members do not pay to view or record in their clients’ accounts. In any case, no charge is made through the Service today.',
  withdrawal:
    `There is no charge today, so if you withdraw you owe nothing. Once billing is switched on, a subscription will be charged at the moment of purchase and the withdrawal period will run from then. ${PRO_REFUND_SOON_EN}`,
  moneyBack: MONEY_BACK_SOON_EN,
  howWeArePaid:
    'Our revenue will come from subscriptions. Subscription billing has not been switched on today.',
  paymentMethodAsked:
    'Once billing is switched on, a payment method will be requested explicitly at checkout and only for a subscription, with the amount and the period shown clearly before you pay. The charge will be made at the moment of purchase.',
  planChange:
    'Subscriptions are not open yet, so today you cannot buy or change a plan in the app; they open soon. From then on, an upgrade will take effect immediately and be charged pro rata, only for the days until the next renewal. A downgrade will apply from the next renewal, with no refund for the period you have already paid.',
  subscriptionPlace:
    'Once billing is switched on, receipts, your payment method and the subscription will be in subscription management, under your Account.',
  renewal:
    'Once billing is switched on, a subscription will renew at the end of each period unless you cancel before the renewal. For annual subscriptions we will send a reminder at least 30 days ahead, and for monthly ones at least 3, with the amount and the date.',
  merchantRow:
    'Not switched on. Once it is, card details will be handled only by this provider and will not pass through our servers.',
  lapsedRetention:
    `An account without an active subscription continues on the no-subscription “${PLAN_EN_FREE}” plan and is kept, with its data, until you delete it yourself. It is not deleted automatically for not paying.`,
  lapsedRetentionShort: KEPT_UNTIL_YOU_DELETE_EN,
  pricingNotice: {
    title: 'Subscriptions are not open yet.',
    body: `Today you start with the ${TRIAL_DAYS}-day trial, with no card and no charge. Before any charge, you will be asked explicitly for a payment method.`,
  },
  contractSteps:
    'There are three steps: you complete the sign-up form and choose a plan, you confirm your email address, and the account is activated. The contract is concluded on activation.',
  firstCharge:
    'No card is requested and no charge is made: subscription billing has not been switched on yet.',
  partnerTarget:
    'The target counts subscribers, so it applies from the day subscription billing is switched on.',
  signupPlanTerms: 'No charge for now',
  trialBadge: TRIAL_BADGE_EN,
  securedBy: null,
  securedByLead: null,
  contractParties: null,
  withdrawalVia: null,
  withdrawalTo: null,
};

const SELLER_FIELD_EN: Record<ReturnType<typeof sellerIdentityGaps>[number], (id: LegalIdentity) => string> = {
  legalName: id => (id.kind === 'company' ? 'company name' : 'full name'),
  address: id => (id.kind === 'company' ? 'registered address' : 'address'),
  afm: () => 'tax number (AFM)',
  phone: () => 'phone number',
  gemi: () => 'business registry number (GEMI)',
};
const listOfEn = (xs: string[]): string =>
  xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

/** Οι ίδιες δηλώσεις με το `billingWords`, στα αγγλικά. Ιδια συνθήκη, ίδιοι αριθμοί. */
export function billingWordsEn(
  env: BillingEnv = process.env, id: LegalIdentity = IDENTITY, port: MerchantPort = merchant(env),
): BillingWords {
  const { live } = checkoutState(env, id, port);
  const gaps = sellerIdentityGaps(id);
  const s = port.sellerOfRecord;
  return {
    live,
    ...(live ? liveWordsEn(port.name) : NOT_LIVE_EN),
    saleClosedReason: live || !gaps.length ? null
      : `Subscription purchases stay closed until we publish here the operator details the law requires for every distance sale: ${listOfEn(gaps.map(f => SELLER_FIELD_EN[f](id)))}. We do not want you to pay without knowing who you are buying from. Once they are published, subscriptions open and the details are shown before purchase.`,
    seller: live && morSellerDisclosed(s) ? {
      line: `Seller: ${s.name} (merchant of record). It collects the payment, issues the receipt and remits the VAT.`,
      termsUrl: s.buyerTermsUrl,
      termsLabel: `${s.name} buyer terms`,
    } : null,
  };
}
